package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.model.UserRole;
import edu.augustana.csc305.project.service.TeamRoleService;
import org.springframework.security.core.Authentication;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin/team")
public class TeamRoleController {
    private final TeamRoleService roles;
    public TeamRoleController(TeamRoleService roles) { this.roles = roles; }
    public record RoleRequest(String role) { }
    public record RoleResponse(UserRole role) { }
    @PatchMapping("/{userId}/role")
    public RoleResponse change(Authentication authentication, @PathVariable String userId,
                               @RequestBody RoleRequest request) {
        UserRole role;
        try {
            role = request == null || request.role() == null ? null : UserRole.valueOf(request.role());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported role.", ex);
        }
        return new RoleResponse(roles.changeRole(authentication, userId, role));
    }
}
