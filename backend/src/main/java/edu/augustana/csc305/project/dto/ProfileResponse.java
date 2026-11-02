package edu.augustana.csc305.project.dto;

import edu.augustana.csc305.project.model.UserRole;
import edu.augustana.csc305.project.security.PermissionPolicy.Capability;
import java.util.List;

public record ProfileResponse(
    String id,
    String name,
    String email,
    boolean emailVerified,
    String campus,
    String aboutYou,
    UserRole role,
    List<Capability> capabilities
){

}
