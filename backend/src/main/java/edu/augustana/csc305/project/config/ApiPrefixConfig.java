package edu.augustana.csc305.project.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Prepend an API prefix (e.g., api/v1) to all {@link RestController}s.
 *
 * The reason we want a version prefix is to enable cleaner transitions when
 * the API changes in a backward-incompatible way. New clients can use the
 * breaking API version at a different prefix (e.g., api/v2), while all
 * old clients continue to work with the v1 API.
 */
@Configuration public class ApiPrefixConfig implements WebMvcConfigurer {

    /** Reads an API prefix from application.properties in the resources directory. */
    @Value("${api.prefix}") private String apiPrefix;

    @Override public void configurePathMatch(PathMatchConfigurer configurer) {
        configurer.addPathPrefix(apiPrefix,
                clazz -> clazz.isAnnotationPresent(RestController.class));
    }
}
