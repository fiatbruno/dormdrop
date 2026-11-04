package edu.augustana.csc305.project;

import edu.augustana.csc305.project.config.ApiPrefixConfig;
import edu.augustana.csc305.project.controller.*;
import edu.augustana.csc305.project.model.*;
import edu.augustana.csc305.project.repository.*;
import edu.augustana.csc305.project.security.*;
import edu.augustana.csc305.project.service.*;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.context.annotation.*;
import org.springframework.core.env.MapPropertySource;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.mock.web.*;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.math.BigDecimal;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.stream.Stream;

import static edu.augustana.csc305.project.model.ModerationTypes.Visibility.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/** Actual HTTP controllers, JWT authorization/filter chain, and services; storage repositories are mocked. */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class VisibilityApiTest {
    enum Actor { ANONYMOUS, SHOPPER, OWNER, STAFF }
    @TempDir static Path uploads;
    private static Fixture f;
    private AnnotationConfigWebApplicationContext context;
    private MockMvc mvc;

    static Stream<Arguments> matrix() {
        return Arrays.stream(Actor.values()).flatMap(actor -> Arrays.stream(ModerationTypes.Visibility.values())
                .map(visibility -> Arguments.of(actor, visibility)));
    }

    @BeforeAll
    void start() {
        f = new Fixture(uploads);
        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("test", Map.of(
                "api.prefix", "/api/v1", "app.jwt.expiration", "60000", "app.jwt.secret", "unused-test-secret")));
        context.register(Web.class, SecurityConfig.class, ApiPrefixConfig.class);
        context.refresh();
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(context.getBean("springSecurityFilterChain", jakarta.servlet.Filter.class)).build();
    }
    @BeforeEach void resetFixture() throws Exception { f.reset(); }
    @AfterAll void close() { context.close(); }

    private MockHttpServletResponse call(Actor actor, AbstractMockHttpServletRequestBuilder<?> request) throws Exception {
        if (actor != Actor.ANONYMOUS) request.header("Authorization", "Bearer " + actor.name());
        return mvc.perform(request).andReturn().getResponse();
    }
    private void status(int expected, MockHttpServletResponse response) throws Exception {
        assertEquals(expected, response.getStatus(), response.getContentAsString());
    }
    private String path() { return "/api/v1/home/" + f.listing.getId().toHexString(); }
    private boolean privileged(Actor actor) { return actor == Actor.OWNER || actor == Actor.STAFF; }
    private void noContent(MockHttpServletResponse response) throws Exception {
        String json = response.getContentAsString();
        assertFalse(json.contains("PRIVATE_TITLE"));
        assertFalse(json.contains("PRIVATE_DESCRIPTION"));
        assertFalse(json.contains(f.filename));
        assertFalse(json.contains("privateEvidence"));
    }

    @ParameterizedTest(name="read paths: {0}, {1}") @MethodSource("matrix")
    void everyReadPathHonorsVisibility(Actor actor, ModerationTypes.Visibility visibility) throws Exception {
        f.listing.setModerationVisibility(visibility);
        boolean visible = visibility == VISIBLE;
        boolean anonymous = actor == Actor.ANONYMOUS;
        var browse = call(actor, get("/api/v1/home").param("category", "Furniture"));
        status(anonymous ? 401 : 200, browse);
        if (!visible) noContent(browse);
        var details = call(actor, get(path()));
        status(anonymous ? 401 : visible || privileged(actor) ? 200 : 404, details);
        if (!visible) {
            noContent(details);
            if (!anonymous && privileged(actor)) assertTrue(details.getContentAsString().contains("\"restricted\":true"));
        }
        var saved = call(actor, get("/api/v1/saved"));
        status(anonymous ? 401 : 200, saved);
        if (!visible) noContent(saved);
        var savedStatus = call(actor, get("/api/v1/saved/" + f.listing.getId() + "/status"));
        status(anonymous ? 401 : visible || privileged(actor) ? 200 : 404, savedStatus);
        if (!visible) noContent(savedStatus);
        var count = call(actor, get("/api/v1/saved/count"));
        status(anonymous ? 401 : 200, count);
        if (!anonymous) assertTrue(count.getContentAsString().contains("\"count\":" + (!visible && !privileged(actor) ? 0 : 1)));
        var favorites = call(actor, get("/api/v1/favorites"));
        status(anonymous ? 401 : 200, favorites);
        if (!anonymous && !visible) assertEquals("[]", favorites.getContentAsString());
        var image = call(actor, get("/api/v1/images/" + f.filename));
        status(anonymous ? 401 : visible ? 200 : 404, image);
        if (!anonymous && visible) assertArrayEquals(f.bytes, image.getContentAsByteArray());
        var mine = call(actor, get("/api/v1/users/me/listings"));
        status(anonymous ? 401 : 200, mine);
        if (!visible) noContent(mine);
        var owned = call(actor, get("/api/v1/users/me/listings/" + f.listing.getId()));
        status(anonymous ? 401 : actor == Actor.OWNER ? 200 : 404, owned);
        if (!visible) noContent(owned);
        var grouped = call(actor, get("/api/v1/users/me/listings/grouped"));
        status(anonymous ? 401 : 200, grouped);
        if (!visible) noContent(grouped);
        var conversation = call(actor, get("/api/v1/conversations/" + f.conversation.getId()));
        status(anonymous ? 401 : actor == Actor.STAFF ? 403 : 200, conversation);
        if (!visible) {
            noContent(conversation);
            if (!anonymous && actor != Actor.STAFF) assertTrue(conversation.getContentAsString().contains("\"listing\":null"));
        }
        var history = call(actor, get("/api/v1/conversations/" + f.conversation.getId() + "/messages"));
        status(anonymous ? 401 : actor == Actor.STAFF ? 403 : 200, history);
        if (!anonymous && actor != Actor.STAFF) assertTrue(history.getContentAsString().contains("Existing permitted message"));
        var newConversation = call(actor, post("/api/v1/conversations").contentType("application/json")
                .content("{\"listingId\":\"" + f.listing.getId() + "\"}"));
        status(anonymous ? 401 : !visible ? 404 : actor == Actor.OWNER ? 400 : 200, newConversation);
    }

    @ParameterizedTest(name="seller paths: {0}, {1}") @MethodSource("matrix")
    void sellerPathsCannotUndoRestriction(Actor actor, ModerationTypes.Visibility visibility) throws Exception {
        f.listing.setModerationVisibility(visibility);
        int allowed = actor == Actor.ANONYMOUS ? 401 : actor != Actor.OWNER ? 403 : visibility == VISIBLE ? 200 : 409;
        String json = "{\"title\":\"Edited\",\"description\":\"Text\",\"category\":\"Furniture\",\"price\":10,"
                + "\"condition\":\"Good\",\"pickupArea\":\"Campus\",\"listingType\":\"For sale\"}";
        status(allowed, call(actor, put(path()).contentType("application/json").content(json)));
        status(allowed, call(actor, patch(path()+"/status").param("status", "AVAILABLE")));
        var file = new MockMultipartFile("file", "image.jpg", "image/jpeg", f.bytes);
        status(allowed, call(actor, multipart("/api/v1/images/"+f.listing.getId()).file(file)));
        status(allowed == 200 ? 204 : allowed, call(actor, delete(path())));
        status(actor == Actor.ANONYMOUS ? 401 : actor != Actor.OWNER ? 404 : visibility == VISIBLE ? 200 : 409,
                call(actor, delete("/api/v1/users/me/listings/"+f.listing.getId())));
        assertEquals(visibility, f.listing.getModerationVisibility());
    }

    @ParameterizedTest @EnumSource(value=ListingStatus.class, names={"SOLD","DONATED"})
    void completedListingsNeverReopenAndCannotStartNewConversations(ListingStatus status) throws Exception {
        f.listing.setStatus(status);
        status(409, call(Actor.OWNER, patch(path()+"/status").param("status", "AVAILABLE")));
        assertEquals(status, f.listing.getStatus());
        status(409, call(Actor.SHOPPER, post("/api/v1/conversations").contentType("application/json")
                .content("{\"listingId\":\""+f.listing.getId()+"\"}")));
    }

    @Test
    void replacedDeletedOrUnlinkedImageUrlsCannotBypassPolicy() throws Exception {
        f.listing.setImageUrl("/api/v1/images/"+UUID.randomUUID()+".jpg");
        status(404, call(Actor.OWNER, get("/api/v1/images/"+f.filename)));
        status(404, call(Actor.STAFF, get("/api/v1/images/"+UUID.randomUUID()+".jpg")));
        status(400, call(Actor.SHOPPER, get("/api/v1/images/"+new ObjectId())));
    }

    static class Fixture {
        final UserRepository users = mock(UserRepository.class);
        final ListingRepository listings = mock(ListingRepository.class);
        final SavedListingRepository saved = mock(SavedListingRepository.class);
        final FavoriteRepository favorites = mock(FavoriteRepository.class);
        final ConversationRepository conversations = mock(ConversationRepository.class);
        final MessageRepository messages = mock(MessageRepository.class);
        final MongoTemplate mongo = mock(MongoTemplate.class);
        final JwtService jwt = mock(JwtService.class);
        final ListingVisibilityPolicy policy = new ListingVisibilityPolicy();
        final Map<Actor,User> actors = new EnumMap<>(Actor.class);
        final byte[] bytes = {(byte)255,(byte)216,(byte)255,1};
        final Path uploads;
        Listing listing;
        Conversation conversation;
        String filename;
        Fixture(Path uploads) {
            this.uploads = uploads;
            for (Actor actor : List.of(Actor.SHOPPER,Actor.OWNER,Actor.STAFF)) {
                User user = new User(new ObjectId(), actor.name(), actor.name()+"@augustana.edu", "hash");
                user.setRole(actor == Actor.STAFF ? UserRole.ADMIN : UserRole.STUDENT);
                user.setEmailVerified(true);
                actors.put(actor,user);
            }
        }
        void reset() throws Exception {
            org.mockito.Mockito.reset(users,listings,saved,favorites,conversations,messages,mongo,jwt);
            listing = new Listing(); listing.setId(new ObjectId()); listing.setOwnerId(actors.get(Actor.OWNER).getId());
            listing.setVersion(0L); listing.setTitle("PRIVATE_TITLE"); listing.setDescription("PRIVATE_DESCRIPTION");
            listing.setCategory("Furniture"); listing.setPrice(new BigDecimal("10.00"));
            filename = UUID.randomUUID()+".jpg"; listing.setImageUrl("/api/v1/images/"+filename);
            Files.write(uploads.resolve(filename), bytes);
            when(users.findByEmail(anyString())).thenAnswer(call -> actors.values().stream()
                    .filter(user -> user.getEmail().equals(call.getArgument(0))).findFirst());
            when(users.findById(any(ObjectId.class))).thenAnswer(call -> actors.values().stream()
                    .filter(user -> user.getId().equals(call.getArgument(0))).findFirst());
            when(jwt.parseToken(anyString())).thenAnswer(call -> io.jsonwebtoken.Jwts.claims()
                    .subject(actors.get(Actor.valueOf(call.getArgument(0))).getEmail()).build());
            when(listings.findById(listing.getId())).thenAnswer(call -> Optional.of(listing));
            when(listings.findAllByImageUrl(anyString())).thenAnswer(call -> Objects.equals(listing.getImageUrl(),call.getArgument(0))
                    ? List.of(listing) : List.of());
            when(listings.save(any(Listing.class))).thenAnswer(call -> call.getArgument(0));
            when(mongo.findById(listing.getId(),Listing.class)).thenAnswer(call -> listing);
            when(mongo.find(any(Query.class),eq(Listing.class))).thenAnswer(call -> {
                Query query = call.getArgument(0);
                Object owner = query.getQueryObject().get("ownerId");
                Object status = query.getQueryObject().get("status");
                if (owner != null && !owner.equals(listing.getOwnerId())) return List.of();
                if (status != null && status != listing.getStatus()) return List.of();
                if (query.getQueryObject().containsKey("moderationVisibility") && !policy.visible(listing)) return List.of();
                return List.of(listing);
            });
            when(mongo.findOne(any(Query.class),eq(Listing.class))).thenAnswer(call -> {
                Query query = call.getArgument(0);
                return Objects.equals(query.getQueryObject().get("ownerId"),listing.getOwnerId()) ? listing : null;
            });
            when(mongo.remove(any(Query.class),eq(Listing.class)))
                    .thenReturn(com.mongodb.client.result.DeleteResult.acknowledged(1));
            when(saved.findByUserIdOrderBySavedAtDesc(any())).thenAnswer(call -> List.of(new SavedListing(call.getArgument(0),listing.getId())));
            when(saved.findByUserIdAndListingId(any(),eq(listing.getId())))
                    .thenAnswer(call -> Optional.of(new SavedListing(call.getArgument(0),listing.getId())));
            when(favorites.findByUserId(any())).thenAnswer(call -> List.of(new Favorite(call.getArgument(0),listing.getId())));
            conversation = new Conversation(listing.getId(),actors.get(Actor.SHOPPER).getId(),actors.get(Actor.OWNER).getId());
            conversation.setId(new ObjectId());
            when(conversations.findById(conversation.getId())).thenReturn(Optional.of(conversation));
            when(conversations.findByListingIdAndBuyerId(eq(listing.getId()),any())).thenAnswer(call ->
                    call.getArgument(1).equals(actors.get(Actor.SHOPPER).getId()) ? Optional.of(conversation) : Optional.empty());
            when(conversations.save(any(Conversation.class))).thenAnswer(call -> {
                Conversation value = call.getArgument(0); value.setId(new ObjectId()); return value;
            });
            when(messages.findFirstByConversationIdOrderBySentAtDesc(any())).thenReturn(Optional.empty());
            Message message = new Message(conversation.getId(),actors.get(Actor.OWNER).getId(),"Existing permitted message");
            message.setId(new ObjectId());
            when(messages.findByConversationIdOrderBySentAtAsc(any())).thenReturn(List.of(message));
            when(messages.findByConversationIdAndSenderIdNotAndReadAtIsNull(any(),any())).thenReturn(List.of());
        }
    }

    @Configuration @EnableWebMvc @EnableWebSecurity
    static class Web {
        @Bean UserRepository users() { return f.users; }
        @Bean JwtService jwt() { return f.jwt; }
        @Bean PersistedUserDetailsService persisted() { return new PersistedUserDetailsService(f.users); }
        @Bean ListingController listings() { return new ListingController(new ListingService(f.listings,f.users,f.mongo,f.policy)); }
        @Bean MyListingsController mine() { return new MyListingsController(new MyListingsService(f.mongo,f.users,f.policy)); }
        @Bean SavedListingController saved() { return new SavedListingController(new SavedListingService(f.saved,f.listings,f.users,f.policy)); }
        @Bean FavoriteController favorites() { return new FavoriteController(new FavoriteService(f.favorites,f.users,f.listings,f.policy)); }
        @Bean ImageController images() { return new ImageController(new ImageStorageService(f.uploads.toString(),"/api/v1"),f.listings,f.users,f.policy); }
        @Bean ConversationController conversations() {
            var service = new ConversationService(f.conversations,f.users,f.mongo,f.messages,f.policy);
            return new ConversationController(service,new MessageService(f.messages,f.conversations,service,f.users,mock(SimpMessagingTemplate.class)));
        }
        @Bean ListingConflictAdvice conflicts() { return new ListingConflictAdvice(); }
    }
}
