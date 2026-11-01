package edu.augustana.csc305.project;

import edu.augustana.csc305.project.dto.*;
import edu.augustana.csc305.project.dto.NotificationDtos.*;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.security.*;
import edu.augustana.csc305.project.service.*;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.*;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

import java.time.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ModerationNoticeTest {
    private final MongoTemplate mongo=mock(MongoTemplate.class);
    private final UserRepository users=mock(UserRepository.class);
    private final Clock clock=Clock.fixed(Instant.parse("2026-11-01T12:00:00Z"),ZoneOffset.UTC);
    private final NotificationInboxService inbox=new NotificationInboxService(mongo,users,clock,"/api/v1");
    private final User seller=new User(new ObjectId(),"Seller","seller@augustana.edu","private-hash");
    private final ObjectId eventId=new ObjectId();

    private NotificationInboxEntry sellerEntry() {
        return new NotificationInboxEntry(NotificationInboxService.noticeId(eventId,seller.getId(),"SELLER",null),seller.getId(),
                "SELLER",eventId,ModerationTypes.DecisionAction.REMOVE,"Prohibited item","Public seller message",null,clock.instant(),null);
    }
    @Test
    void sellerSerializationExplicitlyExcludesReporterAndStaffData() throws Exception {
        var view=inbox.view(sellerEntry());
        assertInstanceOf(SellerNotice.class,view);
        assertEquals(List.of("id","type","outcome","reason","message","link","createdAt","readAt"),
                Arrays.stream(SellerNotice.class.getRecordComponents()).map(field->field.getName()).toList());
        String json=JsonMapper.builder().build().writeValueAsString(view);
        for (String forbidden:List.of("recipientId","reporterId","sourceEventId","reportStatus","reporterRecipientIds",
                "internalRationale","internalNote","privateEvidenceKeys","snapshotId","private-hash")) assertFalse(json.contains(forbidden));
        assertTrue(json.contains("Prohibited item")); assertTrue(json.contains("Public seller message"));
        assertFalse(json.contains("/staff/")); assertFalse(json.contains("/admin/"));
    }
    @Test
    void reporterSerializationContainsOnlyItsOwnSanitizedStatus() throws Exception {
        ObjectId reportId=new ObjectId();
        var status=new ModerationDtos.ReporterStatus(reportId.toHexString(),"RPT-reference",ModerationTypes.CaseStatus.RESOLVED,clock.instant());
        var entry=new NotificationInboxEntry(NotificationInboxService.noticeId(eventId,seller.getId(),"REPORTER",reportId),
                seller.getId(),"REPORTER",eventId,ModerationTypes.DecisionAction.REMOVE,null,"Your report was reviewed.",status,clock.instant(),null);
        String json=JsonMapper.builder().build().writeValueAsString(inbox.view(entry));
        assertTrue(json.contains(reportId.toHexString()));
        for (String forbidden:List.of("reporterId","recipientId","internalRationale","privateEvidenceKeys","staffId","reason"))
            assertFalse(json.contains(forbidden));
    }
    @Test
    void notificationsAndReadAcknowledgmentsAreOwnerScoped() {
        when(users.findByEmail(seller.getEmail())).thenReturn(Optional.of(seller));
        var auth=new UsernamePasswordAuthenticationToken(seller.getEmail(),null,List.of());
        var entry=sellerEntry();
        when(mongo.findOne(any(Query.class),eq(NotificationInboxEntry.class))).thenAnswer(call->{
            Query query=call.getArgument(0);
            assertEquals(seller.getId(),query.getQueryObject().get("recipientId"));
            return query.getQueryObject().get("_id").equals(entry.id())?entry:null;
        });
        assertInstanceOf(SellerNotice.class,inbox.get(auth,entry.id()));
        assertEquals(404,assertThrows(ResponseStatusException.class,()->inbox.get(auth,"a".repeat(64))).getStatusCode().value());
        assertEquals(401,assertThrows(ResponseStatusException.class,()->inbox.get(null,entry.id())).getStatusCode().value());
        assertEquals(400,assertThrows(ResponseStatusException.class,()->inbox.list(auth,-1,20,false)).getStatusCode().value());
        assertEquals(400,assertThrows(ResponseStatusException.class,()->inbox.list(auth,0,101,false)).getStatusCode().value());
    }
    @Test
    void sellerEnqueueRejectsReporterDetails() {
        var entry=sellerEntry();
        var status=new ModerationDtos.ReporterStatus("private-report","reference",ModerationTypes.CaseStatus.RESOLVED,clock.instant());
        assertThrows(IllegalArgumentException.class,()->inbox.enqueue(new NotificationInboxEntry(entry.id(),seller.getId(),
                "SELLER",eventId,entry.outcome(),entry.reason(),entry.message(),status,clock.instant(),null)));
        verifyNoInteractions(mongo);
    }
    @Test
    void retryUsesSharedBackoffAndDoesNotStorePrivateExceptionText() {
        var leases=new NotificationLeaseQueue(mongo,clock,5,30);
        var claim=new NotificationLeaseQueue.Claim(new Document("_id",eventId),"lease-owner",3);
        leases.retry("queue",claim,new org.springframework.messaging.MessagingException("PRIVATE INTERNAL TEXT"));
        var query=ArgumentCaptor.forClass(Query.class); var update=ArgumentCaptor.forClass(Update.class);
        verify(mongo).updateFirst(query.capture(),update.capture(),eq("queue"));
        assertEquals("lease-owner",query.getValue().getQueryObject().get("leaseToken"));
        var fields=update.getValue().getUpdateObject().get("$set",Document.class);
        assertEquals(clock.instant().plusSeconds(20),fields.get("nextAttemptAt"));
        assertEquals("MessagingException",fields.get("lastError"));
        assertFalse(fields.toString().contains("PRIVATE INTERNAL"));
    }
    @Test
    void livePublisherUsesOnlyAuthenticatedUserDestinationAndSafeView() {
        when(users.findById(seller.getId())).thenReturn(Optional.of(seller));
        var broker=mock(SimpMessagingTemplate.class); var view=inbox.view(sellerEntry());
        new WebSocketNotificationPublisher(users,broker).publish(seller.getId(),view);
        verify(broker).convertAndSendToUser(seller.getEmail(),"/queue/notifications",view);
    }
    @Test
    void websocketAllowsOnlyOwnNotificationSubscription() {
        var guard=new WebSocketAuthInterceptor(mock(JwtService.class),mock(WebSocketSessions.class),new PersistedUserDetailsService(users));
        var auth=new UsernamePasswordAuthenticationToken(seller.getEmail(),null,List.of());
        for (String destination:List.of("/user/queue/notifications","/queue/notifications","/user/someone/queue/notifications")) {
            var headers=StompHeaderAccessor.create(StompCommand.SUBSCRIBE); headers.setUser(auth); headers.setDestination(destination); headers.setLeaveMutable(true);
            var message=MessageBuilder.createMessage(new byte[0],headers.getMessageHeaders());
            if (destination.equals("/user/queue/notifications")) assertDoesNotThrow(()->guard.preSend(message,null));
            else assertThrows(org.springframework.security.access.AccessDeniedException.class,()->guard.preSend(message,null));
        }
        var headers=StompHeaderAccessor.create(StompCommand.SUBSCRIBE); headers.setDestination("/user/queue/notifications"); headers.setLeaveMutable(true);
        var anonymous=MessageBuilder.createMessage(new byte[0],headers.getMessageHeaders());
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->guard.preSend(anonymous,null));
    }
    @Test
    void schedulerFailureDoesNotPreventOtherDeliveryQueueFromRunning() {
        var consumer=mock(ModerationOutboxConsumer.class); var worker=mock(NotificationDeliveryWorker.class);
        when(consumer.processBatch()).thenThrow(new IllegalStateException("temporary persistence failure"));
        assertDoesNotThrow(()->new NotificationScheduler(consumer,worker).tick());
        verify(worker).processBatch();
    }
}
