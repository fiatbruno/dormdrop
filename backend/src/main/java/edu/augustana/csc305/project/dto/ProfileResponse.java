package edu.augustana.csc305.project.dto;

public record ProfileResponse(
    String id,
    String name,
    String email,
    boolean emailVerified,
    String campus,
    String aboutYou
){

}
