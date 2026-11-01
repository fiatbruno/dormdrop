package edu.augustana.csc305.project.model;

public final class ModerationTypes {
    private ModerationTypes() {
    }

    public enum Visibility {
        VISIBLE,
        HIDDEN,
        REMOVED
    }

    public enum CaseStatus {
        OPEN,
        IN_REVIEW,
        RESOLVED
    }

    public enum Priority {
        LOW,
        MEDIUM,
        HIGH
    }

    // Agree these values with the report-submission developer.
    public enum ReportCategory {
        SUSPECTED_SCAM,
        INAPPROPRIATE_CONTENT,
        MISLEADING_INFORMATION,
        PROHIBITED_ITEM,
        OTHER
    }

    public enum DecisionAction {
        KEEP,
        HIDE,
        REMOVE
    }

    public enum EventType {
        CASE_CREATED,
        REPORT_ADDED,
        ASSIGNMENT_CHANGED,
        DECISION_RECORDED,
        HISTORY_CORRECTION
    }
}