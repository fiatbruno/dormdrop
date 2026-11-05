package edu.augustana.csc305.project.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

@Component
public class PublicUrls {
    private final URI frontend;
    private final URI backend;
    private final String apiPrefix;

    public PublicUrls(@Value("${app.frontend-url:http://localhost:5173}") String frontend,
                      @Value("${app.backend-url:http://localhost:8080}") String backend,
                      @Value("${api.prefix:/api/v1}") String apiPrefix) {
        this.frontend = parseBase(frontend);
        this.backend = parseBase(backend);
        this.apiPrefix = apiPrefix;
    }

    private static URI parseBase(String value) {
        URI uri = URI.create(value.trim());
        if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                || uri.getHost() == null || uri.getUserInfo() != null
                || uri.getQuery() != null || uri.getFragment() != null) {
            throw new IllegalArgumentException("Public app URLs must be HTTP(S) URLs without credentials, query, or fragment");
        }
        return uri;
    }

    public URI passwordReset(String token) { return frontendToken("reset-password", token); }
    public URI verificationExpired(String token) { return frontendToken("verification-expired", token); }
    public URI verificationSuccess() {
        return UriComponentsBuilder.fromUri(frontend).pathSegment("verification-success").build().toUri();
    }
    public URI verification(String token) {
        var builder = UriComponentsBuilder.fromUri(backend);
        for (String segment : apiPrefix.split("/")) {
            if (!segment.isBlank()) builder.pathSegment(segment);
        }
        return builder.pathSegment("auth", "verify").queryParam("token", "{token}")
                .encode().buildAndExpand(token).toUri();
    }
    private URI frontendToken(String path, String token) {
        return UriComponentsBuilder.fromUri(frontend).pathSegment(path)
                .queryParam("token", "{token}").encode().buildAndExpand(token).toUri();
    }
}
