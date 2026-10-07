package edu.augustana.csc305.project.dto;

public class SignUpRequest {
    private String name;
    private String studentEmail;
    private String password;

    public SignUpRequest(){}

    public SignUpRequest(String name, String studentEmail, String password){
        this.name = name;
        this.studentEmail = studentEmail;
        this.password = password;
    }

    public String getName(){
        return name;
    }

    public void setName(String name){
        this.name = name;
    }

    public String getEmail(){
        return studentEmail;
    }

    public void setEmail(String studentEmail){
        this.studentEmail = studentEmail;
    }

    public String getPassword(){
        return password;
    }

    public void setPassword(String password){
        this.password = password;
    }
}
