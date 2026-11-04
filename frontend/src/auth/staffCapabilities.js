export function getStaffIdentity(profile) {
  const role = String(profile?.role || "").toUpperCase();
  const capabilities = Array.isArray(profile?.capabilities)
    ? profile.capabilities.map((capability) => String(capability).toUpperCase())
    : [];
  const canReview =
    role === "MODERATOR" ||
    role === "ADMIN" ||
    capabilities.includes("REVIEW_REPORTS");
  return {
    canReview,
    userId: profile?.id == null ? null : String(profile.id),
  };
}
