package edu.augustana.csc305.project.security;

/** POJO for login requests. */
public record LoginRequest(String email, String password) { }