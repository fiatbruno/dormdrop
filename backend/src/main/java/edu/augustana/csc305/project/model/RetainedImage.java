package edu.augustana.csc305.project.model;

/** Private evidence bytes; never serialize this document through a public DTO. */
public record RetainedImage(String key, String contentType, byte[] bytes) {
    public RetainedImage {
        bytes = bytes.clone();
    }

    @Override
    public byte[] bytes() {
        return bytes.clone();
    }
}
