
import api from "./client";

export const getNotifications = async () => {
  const response = await api.get("/notifications");
  return response.data;
};

export const markNotificationRead = async (id) => {
  await api.patch(
    `/notifications/${encodeURIComponent(id)}/read`
  );
};

export const markAllNotificationsRead = async () => {
  await api.patch("/notifications/read-all");
};
