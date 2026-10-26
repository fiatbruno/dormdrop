
import { adminClient } from "./adminAuthApi";

const userPath = (userId) =>
  `/admin/users/${encodeURIComponent(userId)}`;

// Retrieve user account information
export async function getAdminUserDetails(userId) {
  const response = await adminClient.get(userPath(userId));
  return response.data;
}

// Retrieve listings belonging to a user
export async function getAdminUserListings(userId) {
  const response = await adminClient.get(
    `${userPath(userId)}/listings`
  );
  return response.data;
}

// Retrieve reports and moderation decisions
export async function getModerationHistory(userId) {
  const response = await adminClient.get(
    `${userPath(userId)}/moderation-history`
  );
  return response.data;
}

// Retrieve internal moderator notes
export async function getAdminNotes(userId) {
  const response = await adminClient.get(
    `${userPath(userId)}/notes`
  );
  return response.data;
}

// Save a new internal note
export async function addAdminNote(userId, content) {
  const response = await adminClient.post(
    `${userPath(userId)}/notes`,
    { content }
  );
  return response.data;
}

// Send a policy warning
export async function sendPolicyWarning(userId, reason) {
  const response = await adminClient.post(
    `${userPath(userId)}/warnings`,
    { reason }
  );
  return response.data;
}

// Suspend an account
export async function suspendAdminUser(
  userId,
  reason,
  durationDays
) {
  const response = await adminClient.post(
    `${userPath(userId)}/suspensions`,
    { reason, durationDays }
  );
  return response.data;
}

// Retrieve a listing for moderation
export async function getAdminListingDetails(listingId) {
  const response = await adminClient.get(
    `/admin/listings/${encodeURIComponent(listingId)}`
  );
  return response.data;
}
