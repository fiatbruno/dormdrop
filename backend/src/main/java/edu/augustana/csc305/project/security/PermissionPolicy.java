package edu.augustana.csc305.project.security;

import edu.augustana.csc305.project.model.UserRole;
import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;

/** The shared role-to-capability policy for HTTP, services, and client-facing identity. */
public final class PermissionPolicy {
    private PermissionPolicy() {}

    public enum Capability {
        MARKETPLACE, OWN_REPORTS, OWN_APPEALS,
        REVIEW_REPORTS, REVIEW_EVIDENCE, ASSIGN_CASES, MODERATE_LISTINGS, ISSUE_WARNINGS,
        VIEW_SELLER_CONTEXT, MANAGE_INTERNAL_NOTES, VIEW_SCOPED_ACTIVITY,
        MANAGE_SUSPENSIONS, DECIDE_APPEALS, MANAGE_ROLES, MANAGE_CAMPUS_POLICY,
        VIEW_CAMPUS_ACTIVITY, VIEW_MEMBER_DIRECTORY
    }

    private static final Set<Capability> STUDENT = Collections.unmodifiableSet(EnumSet.of(
            Capability.MARKETPLACE, Capability.OWN_REPORTS, Capability.OWN_APPEALS));
    private static final Set<Capability> MODERATOR;
    private static final Set<Capability> ADMIN;
    static {
        EnumSet<Capability> moderator = EnumSet.copyOf(STUDENT);
        moderator.addAll(EnumSet.of(Capability.REVIEW_REPORTS, Capability.REVIEW_EVIDENCE,
                Capability.ASSIGN_CASES, Capability.MODERATE_LISTINGS, Capability.ISSUE_WARNINGS,
                Capability.VIEW_SELLER_CONTEXT, Capability.MANAGE_INTERNAL_NOTES, Capability.VIEW_SCOPED_ACTIVITY));
        MODERATOR = Collections.unmodifiableSet(moderator);
        EnumSet<Capability> admin = EnumSet.copyOf(moderator);
        admin.addAll(EnumSet.of(Capability.MANAGE_SUSPENSIONS, Capability.DECIDE_APPEALS,
                Capability.MANAGE_ROLES, Capability.MANAGE_CAMPUS_POLICY,
                Capability.VIEW_CAMPUS_ACTIVITY, Capability.VIEW_MEMBER_DIRECTORY));
        ADMIN = Collections.unmodifiableSet(admin);
    }

    public static Set<Capability> capabilities(UserRole role) {
        if (role == UserRole.ADMIN) return ADMIN;
        if (role == UserRole.MODERATOR) return MODERATOR;
        return STUDENT;
    }

    public static boolean permits(UserRole role, Capability capability) {
        return capability != null && capabilities(role).contains(capability);
    }
}
