
package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.dto.PickupProposalRequest;
import edu.augustana.csc305.project.model.Conversation;
import edu.augustana.csc305.project.model.PickupProposal;
import edu.augustana.csc305.project.model.PickupStatus;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.ConversationRepository;
import edu.augustana.csc305.project.repository.PickupProposalRepository;
import edu.augustana.csc305.project.repository.UserRepository;

import org.bson.types.ObjectId;
import org.springframework.http.HttpStatus;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

@Service
public class PickupProposalService {

    private final PickupProposalRepository pickupProposalRepository;
    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;

    private static final ZoneId CAMPUS_TIME_ZONE =
            ZoneId.of("America/Chicago");

    public PickupProposalService(
            PickupProposalRepository pickupProposalRepository,
            ConversationRepository conversationRepository,
            UserRepository userRepository,
            MongoTemplate mongoTemplate
    ) {
        this.pickupProposalRepository = pickupProposalRepository;
        this.conversationRepository = conversationRepository;
        this.userRepository = userRepository;
        this.mongoTemplate = mongoTemplate;
    }

    // Find the currently logged-in user
    private User getCurrentUser(String email) {

        return userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "User account not found."
                        )
                );
    }

    // Convert a string ID into a MongoDB ObjectId
    private ObjectId toObjectId(String id) {

        if (id == null || !ObjectId.isValid(id)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid ID."
            );
        }

        return new ObjectId(id);
    }

    // Find a conversation and check user membership
    private Conversation getAuthorizedConversation(
            String conversationId,
            String email
    ) {
        ObjectId id = toObjectId(conversationId);

        Conversation conversation =
                conversationRepository.findById(id)
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Conversation not found."
                                )
                        );

        User user = getCurrentUser(email);

        ObjectId userId = user.getId();

        boolean isBuyer =
                userId.equals(conversation.getBuyerId());

        boolean isSeller =
                userId.equals(conversation.getSellerId());

        if (!isBuyer && !isSeller) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You are not part of this conversation."
            );
        }

        return conversation;
    }

    // Create a new pickup proposal
    public PickupProposal createProposal(
            String conversationId,
            String email,
            PickupProposalRequest request
    ) {
        Conversation conversation =
                getAuthorizedConversation(conversationId, email);

        if (request == null ||
                request.meetingPlace() == null ||
                request.meetingPlace().isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Meeting place is required."
            );
        }

        if (request.timePickup() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Pickup time is required."
            );
        }

        if (!request.timePickup().atZone(CAMPUS_TIME_ZONE)
                .toInstant().isAfter(Instant.now())) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Pickup time must be in the future."
            );
        }

        String meetingPlace = request.meetingPlace().trim();

        if (meetingPlace.length() > 200) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Meeting place cannot exceed 200 characters."
            );
        }

        String meetingNote =
                request.note() == null
                        ? ""
                        : request.note().trim();

        if (meetingNote.length() > 500) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Meeting note cannot exceed 500 characters."
            );
        }

        User user = getCurrentUser(email);

        PickupProposal proposal = new PickupProposal(
                conversation.getId(),
                user.getId(),
                meetingPlace,
                request.timePickup(),
                meetingNote
        );

        PickupProposal savedProposal =
                pickupProposalRepository.save(proposal);

        // Update the conversation's latest activity
        Query query = Query.query(
                Criteria.where("_id").is(conversation.getId())
        );

        Update update = new Update()
                .set("lastMessageAt", Instant.now());

        mongoTemplate.updateFirst(
                query,
                update,
                Conversation.class
        );

        return savedProposal;
    }

    // Retrieve all proposals for a conversation
    public List<PickupProposal> getProposals(
            String conversationId,
            String email
    ) {
        Conversation conversation =
                getAuthorizedConversation(conversationId, email);

        return pickupProposalRepository
                .findByConversationIdOrderByTimeCreatedAsc(
                        conversation.getId()
                );
    }

    // Accept or decline a pickup proposal
    public PickupProposal respondToProposal(
            String conversationId,
            String proposalId,
            String email,
            PickupStatus decision
    ) {
        Conversation conversation =
                getAuthorizedConversation(conversationId, email);

        if (decision != PickupStatus.ACCEPTED &&
                decision != PickupStatus.REJECTED) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Decision must be ACCEPTED or DECLINED."
            );
        }

        ObjectId id = toObjectId(proposalId);

        PickupProposal proposal =
                pickupProposalRepository.findById(id)
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Pickup proposal not found."
                                )
                        );

        if (!proposal.getConversationId()
                .equals(conversation.getId())) {

            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Pickup proposal not found in this conversation."
            );
        }

        User user = getCurrentUser(email);

        // A user cannot accept or decline their own proposal
        if (user.getId().equals(proposal.getIdSuggester())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You cannot respond to your own proposal."
            );
        }

        if (proposal.getStatus() != PickupStatus.PENDING) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This proposal has already been answered."
            );
        }

        // Atomically update only a pending proposal
        Query query = Query.query(
                Criteria.where("_id").is(id)
                        .and("conversationId")
                        .is(conversation.getId())
                        .and("status")
                        .is(PickupStatus.PENDING)
        );

        Update update = new Update()
                .set("status", decision)
                .set("timeResponded", Instant.now());

        PickupProposal updatedProposal =
                mongoTemplate.findAndModify(
                        query,
                        update,
                        org.springframework.data.mongodb.core
                                .FindAndModifyOptions.options()
                                .returnNew(true),
                        PickupProposal.class
                );

        if (updatedProposal == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This proposal has already been answered."
            );
        }

        // Update conversation activity
        Query conversationQuery = Query.query(
                Criteria.where("_id").is(conversation.getId())
        );

        Update conversationUpdate = new Update()
                .set("lastMessageAt", Instant.now());

        mongoTemplate.updateFirst(
                conversationQuery,
                conversationUpdate,
                Conversation.class
        );

        return updatedProposal;
    }
}
