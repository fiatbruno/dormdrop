package edu.augustana.csc305.project.service;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.repository.ListingRepository;
import edu.augustana.csc305.project.repository.UserRepository;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ListingSearchTest {
    private ListingService service(MongoTemplate mongo) {
        return new ListingService(mock(ListingRepository.class), mock(UserRepository.class), mongo);
    }

    private List<Listing> search(ListingService service, String q, String category, BigDecimal min, BigDecimal max) {
        return service.getListings(category, min, max, null, null, null, null, q);
    }

    @Test
    void validatesLengthAndCombinesExistingFilters() {
        MongoTemplate mongo = mock(MongoTemplate.class);
        ListingService service = service(mongo);
        search(service, "  .*  ChAiR  ", "Furniture", BigDecimal.TEN, new BigDecimal("50"));
        verify(mongo).find(argThat((Query query) -> {
            Document object = query.getQueryObject();
            List<Document> words = object.getList("$and", Document.class);
            if (words == null || words.size() != 2 || !object.containsKey("category") || !object.containsKey("price")) {
                return false;
            }
            for (int w = 0; w < words.size(); w++) {
                List<Document> fields = words.get(w).getList("$or", Document.class);
                if (fields == null || fields.size() != 3) return false;
                for (int i = 0; i < fields.size(); i++) {
                    Object regex = fields.get(i).get(List.of("title", "description", "category").get(i));
                    if (!(regex instanceof Pattern pattern) || !pattern.pattern().equals(Pattern.quote(List.of(".*", "ChAiR").get(w)))
                            || (pattern.flags() & Pattern.CASE_INSENSITIVE) == 0) return false;
                }
            }
            return true;
        }), eq(Listing.class));
        assertEquals(400, assertThrows(ResponseStatusException.class,
                () -> search(service, "x".repeat(201), null, null, null)).getStatusCode().value());
        assertDoesNotThrow(() -> search(service, "  " + "x".repeat(200) + "  ", null, null, null));
        search(service, "  ", null, null, null);
        verify(mongo).find(argThat((Query query) -> query.getQueryObject().isEmpty()), eq(Listing.class));
    }

    private Listing listing(String title, String description, String category, String price) {
        Listing listing = new Listing();
        listing.setTitle(title);
        listing.setDescription(description);
        listing.setCategory(category);
        listing.setPrice(new BigDecimal(price));
        return listing;
    }

    @Test
    void mongoSearchMatchesWordsAndCombinesFilters() {
        String uri = System.getenv("MONGODB_TEST_URI");
        assumeTrue(uri != null && !uri.isBlank(), "Set MONGODB_TEST_URI for MongoDB integration tests");
        try (MongoClient client = MongoClients.create(uri)) {
            MongoTemplate mongo = new MongoTemplate(client, "listing_search_test_" + UUID.randomUUID().toString().replace("-", ""));
            try {
                mongo.insertAll(List.of(listing("Blue Chair", "Soft seat", "Furniture", "30"),
                        listing("Lamp .*", "Desk light", "Furniture", "60"),
                        listing("Book", "Blue pages", "Books", "5")));
                ListingService service = service(mongo);
                assertEquals(2, search(service, "  bLuE  ", null, null, null).size());
                assertEquals(1, search(service, "soft SEAT", null, null, null).size());
                assertEquals(2, search(service, "furniture", null, null, null).size());
                assertEquals(1, search(service, "chair soft", null, null, null).size());
                assertEquals(1, search(service, "  SOFT   chair ", null, null, null).size());
                assertEquals(0, search(service, "chair missing", null, null, null).size());
                assertEquals(1, search(service, ".*", null, null, null).size());
                assertEquals(0, search(service, "no match", null, null, null).size());
                assertEquals(3, search(service, " ", null, null, null).size());
                assertEquals(3, search(service, null, null, null, null).size());
                assertEquals(1, search(service, "blue", "Furniture", BigDecimal.TEN, new BigDecimal("50")).size());
                assertEquals(0, search(service, "blue", "Furniture", new BigDecimal("31"), new BigDecimal("50")).size());
            } finally {
                mongo.getDb().drop();
            }
        }
    }
}
