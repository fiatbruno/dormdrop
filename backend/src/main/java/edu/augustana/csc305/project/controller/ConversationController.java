
package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.StartConversationRequest;
import edu.augustana.csc305.project.model.Conversation;
import edu.augustana.csc305.project.service.ConversationService;

import edu.augustana.csc305.project.dto.SendMessageRequest;
import edu.augustana.csc305.project.model.Message;
import edu.augustana.csc305.project.service.MessageService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/conversations")
public class ConversationController {

    private final ConversationService conversationService;
    private final MessageService messageService;

    public ConversationController(
            ConversationService conversationService,
            MessageService messageService
    ) {
        this.conversationService = conversationService;
        this.messageService = messageService;
    }

    @PostMapping
    public Conversation startConversation(
            @Valid @RequestBody StartConversationRequest request,
            Authentication authentication
    ) {
        return conversationService.startConversation(
                request.listingId(),
                authentication.getName()
        );
    }

    @GetMapping
    public List<Conversation> getMyConversations(
            Authentication authentication
    ) {
        return conversationService.getMyConversations(
                authentication.getName()
        );
    }

    @GetMapping("/{id}")
    public Conversation getConversation(
            @PathVariable String id,
            Authentication authentication
    ) {
        return conversationService.getConversation(
                id,
                authentication.getName()
        );
    }



    @PostMapping("/{id}/messages")
    public ResponseEntity<Message> sendMessage(
            @PathVariable String id,
            @Valid @RequestBody SendMessageRequest request,
            Authentication authentication
    ) {
        Message message = messageService.sendMessage(
                id,
                authentication.getName(),
                request.content()
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(message);
    }


    @GetMapping("/{id}/messages")
    public List<Message> getMessages(
            @PathVariable String id,
            Authentication authentication
    ) {
        return messageService.getMessages(
                id,
                authentication.getName()
        );
    }


    @GetMapping("/{id}/unread-count")
    public long getUnreadCount(
            @PathVariable String id,
            Authentication authentication
    ) {
        return messageService.getUnreadCount(
                id,
                authentication.getName()
        );
    }


    @PatchMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markMessagesAsRead(
            @PathVariable String id,
            Authentication authentication
    ) {
        messageService.markMessagesAsRead(
                id,
                authentication.getName()
        );
    }


}
