package edu.augustana.csc305.project.config;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/** Browser origins contain only scheme, host and port, even when the app URL has a path. */
public class FrontendOrigin {
    private final String value;

    public FrontendOrigin(String frontendUrl) {
        try {
            URI uri = new URI(frontendUrl.trim());
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!("http".equals(scheme) || "https".equals(scheme)) || uri.getHost() == null
                    || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                    || uri.getPort() > 65535) {
                throw new IllegalArgumentException("app.frontend-url must be an HTTP(S) URL without credentials, query, or fragment");
            }
            int port = uri.getPort();
            if (("http".equals(scheme) && port == 80) || ("https".equals(scheme) && port == 443)) port = -1;
            value = new URI(scheme, null, uri.getHost().toLowerCase(Locale.ROOT), port, null, null, null).toASCIIString();
        } catch (URISyntaxException | NullPointerException ex) {
            throw new IllegalArgumentException("Invalid app.frontend-url", ex);
        }
    }

    public String value() { return value; }
}
