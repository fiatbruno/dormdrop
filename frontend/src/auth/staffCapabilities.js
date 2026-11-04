function tokenClaims(token) {
  try {
    const encoded = token?.split(".")[1];
    if (!encoded) return {};
    return JSON.parse(
      atob(encoded.replace(/-/g, "+").replace(/_/g, "/")),
    );
  } catch {
    return {};
  }
}

function asStrings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  return [];
}

export function getStaffIdentity(token) {
  const claims = tokenClaims(token);
  const roleClaims = [
    ...asStrings(claims.role),
    ...asStrings(claims.roles),
    ...asStrings(claims.authorities),
  ].map((role) => role.replace(/^ROLE_/, "").toUpperCase());
  const capabilities = [
    ...asStrings(claims.capabilities),
    ...asStrings(claims.permissions),
  ].map((capability) => capability.toUpperCase());

  const canReview =
    roleClaims.some((role) => role === "MODERATOR" || role === "ADMIN") ||
    capabilities.some((capability) =>
      ["REPORT_REVIEW", "MODERATE_REPORTS", "ADMIN_REPORTS"].includes(
        capability,
      ),
    );

  return {
    canReview,
    userId:
      claims.id || claims.userId || claims.user_id || null,
  };
}
