package edu.augustana.csc305.project;

import edu.augustana.csc305.project.model.Conversation;
import edu.augustana.csc305.project.model.OfferNegotiation;
import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.ConversationRepository;
import edu.augustana.csc305.project.repository.MessageRepository;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.service.ConversationService;
import edu.augustana.csc305.project.service.ListingVisibilityPolicy;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ConversationOfferTest {
    @Test void onlyParticipantsSeeAnOfferMatchedToTheConversation() {
        var mongo = mock(MongoTemplate.class);
        var users = mock(UserRepository.class);
        var messages = mock(MessageRepository.class);
        var service = new ConversationService(mock(ConversationRepository.class), users, mongo, messages, new ListingVisibilityPolicy());
        var buyer = new User(new ObjectId(), "Buyer", "buyer@augustana.edu", "hash");
        var seller = new User(new ObjectId(), "Seller", "seller@augustana.edu", "hash");
        var outsider = new User(new ObjectId(), "Other", "other@augustana.edu", "hash");
        var conversation = new Conversation(new ObjectId(), buyer.getId(), seller.getId());
        conversation.setId(new ObjectId());
        var offer = OfferNegotiation.create(conversation.getListingId(), buyer.getId(), seller.getId(), BigDecimal.TEN, Instant.now());
        when(users.findByEmail(buyer.getEmail())).thenReturn(Optional.of(buyer));
        when(users.findByEmail(seller.getEmail())).thenReturn(Optional.of(seller));
        when(users.findByEmail(outsider.getEmail())).thenReturn(Optional.of(outsider));
        when(users.findById(any(ObjectId.class))).thenReturn(Optional.empty());
        when(messages.findFirstByConversationIdOrderBySentAtDesc(conversation.getId())).thenReturn(Optional.empty());
        when(mongo.findOne(any(Query.class), eq(OfferNegotiation.class))).thenReturn(offer);
        assertEquals(offer.id().toHexString(), service.toResponse(conversation, buyer.getEmail()).offer().id());
        assertEquals(offer.id().toHexString(), service.toResponse(conversation, seller.getEmail()).offer().id());
        assertEquals(403, assertThrows(ResponseStatusException.class, () -> service.toResponse(conversation, outsider.getEmail())).getStatusCode().value());
        var query = org.mockito.ArgumentCaptor.forClass(Query.class);
        verify(mongo, times(2)).findOne(query.capture(), eq(OfferNegotiation.class));
        String filter = query.getValue().getQueryObject().toString();
        assertTrue(filter.contains(conversation.getListingId().toHexString()));
        assertTrue(filter.contains(buyer.getId().toHexString()));
        assertTrue(filter.contains(seller.getId().toHexString()));
        assertTrue(filter.contains("PENDING"));
    }
}
