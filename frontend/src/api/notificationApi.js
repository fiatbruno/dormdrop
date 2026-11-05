
import api from "./client";

export async function getNotifications(
  page = 0,
  size = 20
) {
  const { data } = await api.get(
    "/me/notifications",
    {
      params: { page, size },
    }
  );

  if (!data || !Array.isArray(data.items)) {
    throw new Error(
      "Invalid notifications response."
    );
  }

  return data.items;
}

export async function getUnreadNotificationCount() {
  const { data } = await api.get(
    "/me/notifications/unread-count"
  );

  if (!Number.isInteger(data?.count)) {
    throw new Error("Invalid unread count.");
  }

  return data.count;
}

export async function markNotificationAsRead(id) {
  return (
    await api.patch(
      `/me/notifications/${encodeURIComponent(id)}/read`
    )
  ).data;
}
