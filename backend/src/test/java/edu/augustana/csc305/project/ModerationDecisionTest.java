package edu.augustana.csc305.project;

import com.mongodb.client.result.UpdateResult;
import edu.augustana.csc305.project.controller.ModerationDecisionController;
import edu.augustana.csc305.project.dto.ModerationDecisionDtos.*;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.UserRepository;
import edu.augustana.csc305.project.security.StaffAccess;
import edu.augustana.csc305.project.service.*;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.data.mongodb.core.*;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.*;
import java.util.stream.Stream;

import static edu.augustana.csc305.project.model.ModerationTypes.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ModerationDecisionTest {
    private final MongoTemplate mongo = mock(MongoTemplate.class);
    private final UserRepository users = mock(UserRepository.class);
    private final DecisionEvidenceService evidence = mock(DecisionEvidenceService.class);
    private final TransactionOperations transactions = mock(TransactionOperations.class);
    private final User staff = new User(new ObjectId(),"Staff","staff@augustana.edu","hash");
    private final UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(staff.getEmail(),null,List.of());
    private final Listing listing = new Listing();
    private ModerationCase reportCase;
    private final Map<String,ModerationDecisionReceipt> receipts = new HashMap<>();
    private final List<ModerationDecision> decisions = new ArrayList<>();
    private final List<ModerationNotificationEvent> events = new ArrayList<>();
    private final ModerationDecisionService service;

    ModerationDecisionTest() {
        staff.setRole(UserRole.MODERATOR);
        listing.setId(new ObjectId()); listing.setOwnerId(new ObjectId()); listing.setVersion(3L);
        var draft = ModerationCase.open(listing.getId(),null);
        reportCase = new ModerationCase(draft.id(),draft.referenceNumber(),draft.listingId(),null,
                CaseStatus.OPEN,Priority.MEDIUM,null,draft.createdAt(),draft.updatedAt(),0L);
        when(users.findByEmail(staff.getEmail())).thenReturn(Optional.of(staff));
        when(mongo.findById(any(ObjectId.class),eq(ModerationCase.class))).thenAnswer(call -> reportCase);
        when(mongo.findOne(any(Query.class),eq(ModerationCase.class))).thenAnswer(call -> reportCase);
        when(mongo.findById(listing.getId(),Listing.class)).thenReturn(listing);
        when(mongo.findById(anyString(),eq(ModerationDecisionReceipt.class))).thenAnswer(call -> receipts.get(call.getArgument(0)));
        var snapshot = new ListingSnapshot(new ObjectId(),reportCase.id(),listing.getId(),listing.getOwnerId(),"Seller",
                3L,"Title","Description","Furniture",null,"Good","Campus","For sale",ListingStatus.AVAILABLE,
                List.of(),Instant.now(),List.of());
        when(evidence.retain(any(),any(),any())).thenReturn(snapshot);
        when(mongo.find(any(Query.class),eq(Report.class))).thenReturn(List.of());
        when(mongo.updateFirst(any(Query.class),any(Update.class),eq(Listing.class))).thenReturn(UpdateResult.acknowledged(1,1L,null));
        when(mongo.findAndModify(any(Query.class),any(Update.class),any(FindAndModifyOptions.class),eq(ModerationCase.class)))
                .thenAnswer(call -> {
                    Update update = call.getArgument(1);
                    CaseStatus status = update.getUpdateObject().get("$set",org.bson.Document.class).get("status",CaseStatus.class);
                    reportCase = new ModerationCase(reportCase.id(),reportCase.referenceNumber(),listing.getId(),null,status,
                            reportCase.priority(),null,reportCase.createdAt(),Instant.now(),reportCase.version()+1);
                    return reportCase;
                });
        when(mongo.insert(any(ModerationDecisionReceipt.class))).thenAnswer(call -> {
            ModerationDecisionReceipt receipt = call.getArgument(0); receipts.put(receipt.id(),receipt); return receipt;
        });
        when(mongo.insert(any(ModerationDecision.class))).thenAnswer(call -> {
            ModerationDecision decision = call.getArgument(0); decisions.add(decision); return decision;
        });
        when(mongo.insert(any(ModerationNotificationEvent.class))).thenAnswer(call -> {
            ModerationNotificationEvent event = call.getArgument(0); events.add(event); return event;
        });
        when(transactions.execute(any())).thenAnswer(call -> ((TransactionCallback<?>)call.getArgument(0))
                .doInTransaction(mock(TransactionStatus.class)));
        service = new ModerationDecisionService(mongo,new StaffAccess(users),evidence,transactions);
    }
    private Request request(DecisionAction action,long version) {
        return new Request(action,version,"Policy violation","INTERNAL_ONLY_RATIONALE","Public seller message");
    }
    private ModerationDecisionService.Outcome decide(DecisionAction action) {
        return service.decide(ModerationDecisionService.Target.CASE,reportCase.id().toHexString(),request(action,0),"decision-key",auth);
    }
    private void status(int expected,org.junit.jupiter.api.function.Executable operation) {
        assertEquals(expected,assertThrows(ResponseStatusException.class,operation).getStatusCode().value());
    }
    static Stream<Arguments> roles() {
        return Arrays.stream(DecisionAction.values()).flatMap(action -> Stream.of("MODERATOR","ADMIN","STUDENT","ANONYMOUS")
                .map(role -> Arguments.of(action,role)));
    }
    @ParameterizedTest @MethodSource("roles")
    void everyActionRequiresPersistedStaffCapability(DecisionAction action,String role) {
        if (role.equals("ANONYMOUS")) {
            status(401,() -> service.decide(ModerationDecisionService.Target.CASE,reportCase.id().toHexString(),request(action,0),"key",null));
        } else {
            staff.setRole(UserRole.valueOf(role));
            if (role.equals("STUDENT")) status(403,() -> decide(action));
            else assertTrue(decide(action).created());
        }
        if (role.equals("ANONYMOUS") || role.equals("STUDENT")) verifyNoInteractions(transactions,evidence);
    }
    @ParameterizedTest @EnumSource(DecisionAction.class)
    void allActionsValidateRequiredFieldsAndVersions(DecisionAction action) {
        String id = reportCase.id().toHexString();
        for (Request invalid : List.of(new Request(action,null,"Reason","Note","Seller"),
                new Request(action,-1L,"Reason","Note","Seller"),new Request(action,0L," ","Note","Seller"),
                new Request(action,0L,"Reason"," ","Seller"),new Request(action,0L,"x".repeat(501),"Note","Seller"))) {
            status(400,() -> service.decide(ModerationDecisionService.Target.CASE,id,invalid,"key",auth));
        }
        status(400,() -> service.decide(ModerationDecisionService.Target.CASE,id,request(action,0),null,auth));
        status(409,() -> service.decide(ModerationDecisionService.Target.CASE,id,request(action,99),"key",auth));
        status(409,() -> service.decide(ModerationDecisionService.Target.LISTING,listing.getId().toHexString(),request(action,99),"key",auth));
        if (action == DecisionAction.REMOVE) status(400,() -> service.decide(ModerationDecisionService.Target.CASE,id,
                new Request(action,0L,"Reason","Note",null),"key",auth));
        verifyNoInteractions(evidence);
    }
    @ParameterizedTest @EnumSource(DecisionAction.class)
    void sameKeyRetryNeverAddsDecisionOrNotification(DecisionAction action) {
        var first = decide(action);
        var second = decide(action);
        assertTrue(first.created()); assertFalse(second.created()); assertEquals(first.result(),second.result());
        assertEquals(1,decisions.size()); assertEquals(1,events.size()); assertEquals(1,receipts.size());
        assertEquals("PENDING",events.get(0).status());
        assertFalse(events.get(0).sellerMessage().contains("INTERNAL_ONLY"));
        status(409,() -> service.decide(ModerationDecisionService.Target.CASE,reportCase.id().toHexString(),
                new Request(action,0L,"Different reason","INTERNAL_ONLY_RATIONALE","Public seller message"),"decision-key",auth));
    }
    @Test
    void hideStaysOpenAndOwnsItsTemporaryHide() {
        var hidden = decide(DecisionAction.HIDE);
        assertEquals(Visibility.HIDDEN,hidden.result().visibility());
        assertEquals(CaseStatus.IN_REVIEW,reportCase.status());
        var change = org.mockito.ArgumentCaptor.forClass(Update.class);
        verify(mongo).updateFirst(any(Query.class),change.capture(),eq(Listing.class));
        assertEquals(reportCase.id(),change.getValue().getUpdateObject().get("$set",org.bson.Document.class).get("temporaryHideCaseId"));
        assertFalse(change.getValue().getUpdateObject().get("$set",org.bson.Document.class).containsKey("status"));
    }
    @ParameterizedTest @EnumSource(value=Visibility.class,names={"HIDDEN","REMOVED"})
    void keepCannotClearUnrelatedRestrictions(Visibility visibility) {
        listing.setModerationVisibility(visibility);
        listing.setTemporaryHideCaseId(new ObjectId());
        var kept = decide(DecisionAction.KEEP);
        assertEquals(visibility,kept.result().visibility()); assertEquals(CaseStatus.RESOLVED,reportCase.status());
        var change = org.mockito.ArgumentCaptor.forClass(Update.class);
        verify(mongo).updateFirst(any(Query.class),change.capture(),eq(Listing.class));
        assertFalse(change.getValue().getUpdateObject().containsKey("$set"));
    }
    @Test
    void keepClearsOnlyCaseOwnedHide() {
        listing.setModerationVisibility(Visibility.HIDDEN); listing.setTemporaryHideCaseId(reportCase.id());
        assertEquals(Visibility.VISIBLE,decide(DecisionAction.KEEP).result().visibility());
    }
    @Test
    void hideCannotDowngradeRemoval() {
        listing.setModerationVisibility(Visibility.REMOVED);
        status(409,() -> decide(DecisionAction.HIDE)); verifyNoInteractions(evidence);
    }
    static Stream<Arguments> routes() {
        return Arrays.stream(DecisionAction.values()).flatMap(action -> Arrays.stream(ModerationDecisionService.Target.values())
                .map(target -> Arguments.of(action,target)));
    }
    @ParameterizedTest @MethodSource("routes")
    void bothEndpointsUseSharedService(DecisionAction action,ModerationDecisionService.Target target) throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new ModerationDecisionController(service)).build();
        String path = target == ModerationDecisionService.Target.CASE ? "/admin/reports/"+reportCase.id()+"/decisions"
                : "/admin/listings/"+listing.getId()+"/decisions";
        long version = target == ModerationDecisionService.Target.CASE ? 0 : 3;
        String body = "{\"action\":\""+action+"\",\"expectedVersion\":"+version
                +",\"policyReason\":\"Reason\",\"internalRationale\":\"Private note\",\"sellerMessage\":\"Public message\"}";
        mvc.perform(post(path).principal(auth).header("Idempotency-Key","http-key").contentType("application/json").content(body))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isCreated());
        mvc.perform(post(path).principal(auth).header("Idempotency-Key","http-key").contentType("application/json").content(body))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
        assertEquals(1,events.size()); assertEquals(1,decisions.size());
    }
}
