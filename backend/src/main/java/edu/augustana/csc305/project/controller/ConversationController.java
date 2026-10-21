
package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.StartConversationRequest;
import edu.augustana.csc305.project.dto.ConversationResponse;
import edu.augustana.csc305.project.dto.MessageResponse;
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
    public ConversationResponse startConversation(
            @Valid @RequestBody StartConversationRequest request,
            Authentication authentication
    ) {
        return conversationService.toResponse(conversationService.startConversation(
                request.listingId(), authentication.getName()), authentication.getName());
    }

    @GetMapping
    public List<ConversationResponse> getMyConversations(
            Authentication authentication
    ) {
        return conversationService.getMyConversations(authentication.getName()).stream()
                .map(conversation -> conversationService.toResponse(conversation, authentication.getName())).toList();
    }

    @GetMapping("/{id}")
    public ConversationResponse getConversation(
            @PathVariable String id,
            Authentication authentication
    ) {
        return conversationService.toResponse(conversationService.getConversation(
                id, authentication.getName()), authentication.getName());
    }



    @PostMapping("/{id}/messages")
    public ResponseEntity<MessageResponse> sendMessage(
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
                .body(MessageResponse.from(message));
    }


    @GetMapping("/{id}/messages")
    public List<MessageResponse> getMessages(
            @PathVariable String id,
            Authentication authentication
    ) {
        return messageService.getMessages(id, authentication.getName()).stream()
                .map(MessageResponse::from).toList();
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
