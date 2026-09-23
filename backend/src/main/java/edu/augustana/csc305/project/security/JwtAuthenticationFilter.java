package edu.augustana.csc305.project.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Checks every incoming request for a JWT token in its Authorization header
 * ("Authorization: Bearer <token>"). If the token is valid, the request is
 * marked as authenticated with the user's email as the "principal". This is
 * what lets requests through to endpoints marked authenticated() in
 * {@link SecurityConfig}.
 *
 * If there is no token, or the token is invalid or expired, the request
 * simply continues unauthenticated. Spring Security then rejects it with a
 * 401 if the endpoint requires authentication.
 *
 * In a controller, you can get the logged-in user's email by adding a
 * parameter like: {@code @AuthenticationPrincipal String email}
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;

    public JwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override protected void doFilterInternal(HttpServletRequest request,
                                              HttpServletResponse response,
                                              FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith(BEARER_PREFIX)) {
            try {
                Claims claims = jwtService.parseToken(header.substring(BEARER_PREFIX.length()));
                UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(claims.getSubject(), null, List.of());
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (JwtException | IllegalArgumentException e) {
                // Bad or expired token: leave the request unauthenticated.
            }
        }
        chain.doFilter(request, response);
    }
}
