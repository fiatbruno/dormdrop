package edu.augustana.csc305.project.dto;

public class AuthResponse {
    private String message;

    public AuthResponse(){}

    public AuthResponse(String message){
        this.message = message;
    }

    public String getMessage(){
        return message;
    }

    public void setMessage(String message){
        this.message = message;
    }
}
