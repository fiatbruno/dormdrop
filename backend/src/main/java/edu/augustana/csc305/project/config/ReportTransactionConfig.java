package edu.augustana.csc305.project.config;

import com.mongodb.ReadConcern;
import com.mongodb.TransactionOptions;
import com.mongodb.WriteConcern;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.transaction.support.TransactionTemplate;

@Configuration
public class ReportTransactionConfig {
    @Bean("reportTransactions")
    public TransactionOperations reportTransactions(MongoDatabaseFactory factory) {
        var options = TransactionOptions.builder().readConcern(ReadConcern.SNAPSHOT)
                .writeConcern(WriteConcern.MAJORITY).build();
        return new TransactionTemplate(new MongoTransactionManager(factory, options));
    }
}
