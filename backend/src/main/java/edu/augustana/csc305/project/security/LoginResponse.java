package edu.augustana.csc305.project.security;

import edu.augustana.csc305.project.dto.UserDto;

/** POJO for login responses. */
public record LoginResponse(String token, UserDto user) { }
