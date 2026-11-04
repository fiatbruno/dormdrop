package edu.augustana.csc305.project.security;

import edu.augustana.csc305.project.model.User;
import edu.augustana.csc305.project.repository.UserRepository;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import java.util.Optional;
import static org.mockito.Mockito.*;

class WebSocketRoleInvalidationTest {
    @Test
    void multipleInstancesCloseOnlyChangedUsersAndFailClosed() throws Exception {
        var repository = mock(UserRepository.class);
        var first = new WebSocketSessions(repository);
        var second = new WebSocketSessions(repository);
        try {
            ObjectId changed = new ObjectId(), other = new ObjectId();
            var changedUser = new User(changed, "A", "a@augustana.edu", "hash");
            var otherUser = new User(other, "B", "b@augustana.edu", "hash");
            when(repository.findById(changed)).thenReturn(Optional.of(changedUser));
            when(repository.findById(other)).thenReturn(Optional.of(otherUser));
            var a = socket(first, "a");
            var b = socket(second, "b");
            var c = socket(second, "c");
            first.registerUser("a", changed, 0);
            second.registerUser("b", changed, 0);
            second.registerUser("c", other, 0);
            first.checkRoles(); second.checkRoles();
            verify(a, never()).close(any()); verify(b, never()).close(any());
            changedUser.setRoleVersion(1);
            first.checkRoles(); second.checkRoles();
            verify(a).close(any()); verify(b).close(any()); verify(c, never()).close(any());
            when(repository.findById(other)).thenThrow(new IllegalStateException("database unavailable"));
            second.checkRoles();
            verify(c).close(any());
        } finally { first.stop(); second.stop(); }
    }

    private WebSocketSession socket(WebSocketSessions registry, String id) throws Exception {
        var session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(id);
        registry.decorate(mock(WebSocketHandler.class)).afterConnectionEstablished(session);
        return session;
    }
}
