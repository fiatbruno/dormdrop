
import api from "./client";

const notificationPath = (id) =>
  `/notifications/${encodeURIComponent(id)}`;

export async function getNotifications() {
  const response = await api.get("/notifications");

  if (!Array.isArray(response.data)) {
    throw new Error("Invalid notifications response.");
  }

  return response.data;
}

export async function getUnreadNotificationCount() {
  const response = await api.get(
    "/notifications/unread-count"
  );

  if (
    !Number.isInteger(response.data?.count) ||
    response.data.count < 0
  ) {
    throw new Error("Invalid unread count response.");
  }

  return response.data.count;
}

export async function markNotificationAsRead(id) {
  const response = await api.patch(
    `${notificationPath(id)}/read`
  );

  return response.data;
}
