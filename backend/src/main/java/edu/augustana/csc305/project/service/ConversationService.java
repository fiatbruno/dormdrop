
package edu.augustana.csc305.project.service;

import edu.augustana.csc305.project.model.Conversation;
import edu.augustana.csc305.project.dto.ConversationResponse;
import edu.augustana.csc305.project.repository.MessageRepository;
import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.ConversationRepository;
import edu.augustana.csc305.project.repository.UserRepository;

import org.bson.types.ObjectId;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;
    private final MessageRepository messageRepository;

    public ConversationService(
            ConversationRepository conversationRepository,
            UserRepository userRepository,
            MongoTemplate mongoTemplate,
            MessageRepository messageRepository
    ) {
        this.conversationRepository = conversationRepository;
        this.userRepository = userRepository;
        this.mongoTemplate = mongoTemplate;
        this.messageRepository = messageRepository;
    }

    public Conversation startConversation(
            String listingId,
            String userEmail
    ) {
        User buyer = getUserByEmail(userEmail);

        if (!ObjectId.isValid(listingId)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "This listing ID is invalid."
            );
        }

        ObjectId id = new ObjectId(listingId);

        Listing listing = mongoTemplate.findById(
                id,
                Listing.class
        );

        if (listing == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "This listing was not found."
            );
        }

        ObjectId sellerId = listing.getOwnerId();

        if (sellerId == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "There is no seller for this listing."
            );
        }

        if (sellerId.equals(buyer.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Conversations can only be started with other people."
            );
        }

        return conversationRepository
                .findByListingIdAndBuyerId(id, buyer.getId())
                .orElseGet(() -> {
                    Conversation conversation = new Conversation(
                            id,
                            buyer.getId(),
                            sellerId
                    );

                    try {
                        return conversationRepository.save(conversation);
                    } catch (DuplicateKeyException ex) {
                        return conversationRepository
                                .findByListingIdAndBuyerId(
                                        id, buyer.getId()
                                )
                                .orElseThrow(() -> ex);
                    }
                });
    }

    public List<Conversation> getMyConversations(
            String userEmail
    ) {
        User user = getUserByEmail(userEmail);

        return conversationRepository
                .findByBuyerIdOrSellerIdOrderByLastMessageAtDesc(
                        user.getId(),
                        user.getId()
                );
    }

    public Conversation getConversation(
            String conversationId,
            String userEmail
    ) {
        User user = getUserByEmail(userEmail);

        if (!ObjectId.isValid(conversationId)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid conversation ID."
            );
        }

        Conversation conversation = conversationRepository
                .findById(new ObjectId(conversationId))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Conversation not found."
                ));

        boolean isBuyer =
                conversation.getBuyerId().equals(user.getId());

        boolean isSeller =
                conversation.getSellerId().equals(user.getId());

        if (!isBuyer && !isSeller) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You cannot access this conversation."
            );
        }

        return conversation;
    }

    public ConversationResponse toResponse(Conversation conversation, String email) {
        User current = getUserByEmail(email);
        boolean buyer = current.getId().equals(conversation.getBuyerId());
        if (!buyer && !current.getId().equals(conversation.getSellerId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot access this conversation.");
        }
        User other = userRepository.findById(buyer ? conversation.getSellerId() : conversation.getBuyerId()).orElse(null);
        Listing listing = mongoTemplate.findById(conversation.getListingId(), Listing.class);
        var summary = listing == null ? null : new ConversationResponse.ListingSummary(
                listing.getIdString(), listing.getTitle(), listing.getPrice(), listing.getListingType(),
                listing.getStatus().name(), listing.getImageUrl());
        String preview = messageRepository.findFirstByConversationIdOrderBySentAtDesc(conversation.getId())
                .map(message -> message.getContent()).orElse("");
        long unread = messageRepository.countByConversationIdAndSenderIdNotAndReadAtIsNull(conversation.getId(), current.getId());
        return new ConversationResponse(conversation.getId().toHexString(), current.getId().toHexString(),
                new ConversationResponse.Participant(other == null ? "Member unavailable" : other.getName(),
                        other != null && other.isEmailVerified()), summary, preview,
                conversation.getCreatedAt(), conversation.getLastMessageAt(), unread);
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "User not found."
                ));
    }
}
