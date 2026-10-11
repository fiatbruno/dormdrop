package edu.augustana.csc305.project.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.util.UUID;

@Service
public class ImageStorageService {

    private final Path uploadDirectory;

    public ImageStorageService(
            @Value("${app.upload-dir:uploads}")
            String directory) {

        this.uploadDirectory =
                Paths.get(directory).toAbsolutePath().normalize();

        try {
            Files.createDirectories(uploadDirectory);
        } catch (IOException e) {
            throw new IllegalStateException(
                    "Cannot initialize upload directory", e
            );
        }
    }

    public String store(MultipartFile file) {

        if (file.isEmpty() ||
                file.getSize() > 5 * 1024 * 1024) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Image must be between 1 byte and 5 MB"
            );
        }

        String extension;

        try (InputStream input = file.getInputStream()) {
            byte[] signature = input.readNBytes(12);

            if (isJpeg(signature)) {
                extension = ".jpg";
            } else if (isPng(signature)) {
                extension = ".png";
            } else if (isWebp(signature)) {
                extension = ".webp";
            } else {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Only JPEG, PNG, or WebP images allowed"
                );
            }
        } catch (IOException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Cannot read image"
            );
        }

        String filename = UUID.randomUUID() + extension;

        try {
            Files.copy(
                    file.getInputStream(),
                    uploadDirectory.resolve(filename),
                    StandardCopyOption.REPLACE_EXISTING
            );
        } catch (IOException e) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Image upload failed"
            );
        }

        return "/api/images/" + filename;
    }

    public Path getImage(String filename) {
        if (!filename.matches(
                "[a-fA-F0-9-]{36}\\.(jpg|png|webp)")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid filename"
            );
        }

        Path path = uploadDirectory.resolve(filename).normalize();

        if (!path.startsWith(uploadDirectory) ||
                !Files.isRegularFile(path)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Image not found"
            );
        }

        return path;
    }

    private boolean isJpeg(byte[] b) {
        return b.length >= 3 &&
                (b[0] & 255) == 255 &&
                (b[1] & 255) == 216 &&
                (b[2] & 255) == 255;
    }

    private boolean isPng(byte[] b) {
        return b.length >= 8 &&
                (b[0] & 255) == 137 &&
                b[1] == 80 && b[2] == 78 &&
                b[3] == 71;
    }

    private boolean isWebp(byte[] b) {
        return b.length >= 12 &&
                new String(b, 0, 4,
                        java.nio.charset.StandardCharsets.US_ASCII)
                        .equals("RIFF") &&
                new String(b, 8, 4,
                        java.nio.charset.StandardCharsets.US_ASCII)
                        .equals("WEBP");
    }
}
