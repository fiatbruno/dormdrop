package edu.augustana.csc305.project;

import edu.augustana.csc305.project.controller.*;
import edu.augustana.csc305.project.dto.*;
import edu.augustana.csc305.project.model.Listing;
import edu.augustana.csc305.project.model.ListingStatus;
import edu.augustana.csc305.project.service.*;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ListingVersionJsonTest {
    @Test
    void successfulEditsBroadcastAnInvalidationButFailedEditsDoNot() {
        var service = mock(ListingService.class);
        var messaging = mock(SimpMessagingTemplate.class);
        var controller = new ListingController(service, messaging);
        var id = new ObjectId();
        var auth = new UsernamePasswordAuthenticationToken("seller@example.edu", null, List.of());
        var listing = new Listing();
        when(service.updateListing(eq(id), any(), anyString())).thenReturn(listing)
                .thenThrow(new IllegalStateException("save failed"));
        var request = mock(CreateListingRequest.class);
        assertSame(listing, controller.updateListing(id.toHexString(), request, auth));
        verify(messaging).convertAndSend("/topic/listings", "updated");
        assertThrows(IllegalStateException.class, () -> controller.updateListing(id.toHexString(), request, auth));
        verifyNoMoreInteractions(messaging);
    }
    @Test
    void marketplaceAndOwnerListingResponsesNeverSerializeVersion() throws Exception {
        Listing listing = new Listing();
        listing.setId(new ObjectId()); listing.setTitle("Listing"); listing.setVersion(7L);
        var service = mock(ListingService.class);
        var mine = mock(MyListingsService.class);
        var auth = new UsernamePasswordAuthenticationToken("seller@augustana.edu", null, List.of());
        when(service.getListings(any(),any(),any(),any(),any(),any(),any(),any())).thenReturn(List.of(listing));
        when(service.getListingById(eq(listing.getId()),anyString())).thenReturn(ListingDetailsResponse.from(listing, "Seller"));
        when(service.createSecureListing(any(), anyString())).thenReturn(listing);
        when(service.updateListing(eq(listing.getId()), any(), anyString())).thenReturn(listing);
        when(service.updateStatus(eq(listing.getId()), any(), anyString())).thenReturn(listing);
        when(mine.getMyListings(anyString())).thenReturn(List.of(listing));
        when(mine.getMyListing(anyString(),anyString())).thenReturn(listing);
        when(mine.getMyListingsGrouped(anyString())).thenReturn(new MyListingsResponse(List.of(listing),List.of()));
        var mvc = MockMvcBuilders.standaloneSetup(new ListingController(service), new MyListingsController(mine)).build();
        for (String path : List.of("/home", "/home/"+listing.getId(), "/users/me/listings",
                "/users/me/listings/"+listing.getId(), "/users/me/listings/grouped")) {
            var result = mvc.perform(get(path).principal(auth)).andExpect(status().isOk()).andReturn();
            assertNoVersion(JsonMapper.builder().build().readTree(result.getResponse().getContentAsString()));
        }
        String body = "{\"title\":\"New\",\"description\":\"Description\",\"category\":\"Furniture\","
                + "\"price\":10,\"condition\":\"Good\",\"pickupArea\":\"Campus\",\"listingType\":\"For sale\"}";
        for (var request : List.of(post("/home").contentType("application/json").content(body),
                put("/home/"+listing.getId()).contentType("application/json").content(body),
                patch("/home/"+listing.getId()+"/status").param("status", ListingStatus.SOLD.name()))) {
            var result = mvc.perform(request.principal(auth)).andReturn();
            assertTrue(result.getResponse().getStatus() < 300);
            assertNoVersion(JsonMapper.builder().build().readTree(result.getResponse().getContentAsString()));
        }
        assertEquals(7L, listing.getVersion());
        assertNotNull(Listing.class.getDeclaredField("version").getAnnotation(org.springframework.data.annotation.Version.class));
    }

    private void assertNoVersion(tools.jackson.databind.JsonNode json) {
        if (json.isObject()) assertFalse(json.has("version"));
        for (var child : json) assertNoVersion(child);
    }
}
