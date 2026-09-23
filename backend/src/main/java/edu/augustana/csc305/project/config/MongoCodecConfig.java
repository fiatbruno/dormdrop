package edu.augustana.csc305.project.config;

import com.mongodb.MongoClientSettings;
import org.bson.codecs.configuration.CodecRegistries;
import org.bson.codecs.configuration.CodecRegistry;
import org.bson.codecs.pojo.PojoCodecProvider;
import org.springframework.boot.mongodb.autoconfigure.MongoClientSettingsBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * This piece of configuration tells Spring Boot to build a MongoDB codex
 * for the POJOs in this project. It lets us transparently use our model
 * objects when interacting with MongoDB.
 */
@Configuration public class MongoCodecConfig {

    @Bean public MongoClientSettingsBuilderCustomizer pojoCodecCustomizer() {
        return builder -> {
            CodecRegistry pojoCodecRegistry = CodecRegistries.fromProviders(
                    PojoCodecProvider.builder().automatic(true).build());
            CodecRegistry customRegistry = CodecRegistries.fromRegistries(
                    MongoClientSettings.getDefaultCodecRegistry(),
                    pojoCodecRegistry);
            builder.codecRegistry(customRegistry);
        };
    }
}

