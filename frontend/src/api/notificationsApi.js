import api from "./client";

export async function getNotifications(page = 0, size = 20) {
  const { data } = await api.get("/me/notifications", {
    params: { page, size },
  });
  return data;
}

export async function getUnreadNotificationCount() {
  const { data } = await api.get("/me/notifications/unread-count");
  return data.count;
}

export async function markNotificationRead(id) {
  const { data } = await api.patch(
    `/me/notifications/${encodeURIComponent(id)}/read`,
  );
  return data;
}

export async function markAllNotificationsRead() {
  const unreadIds = [];
  let page = 0;

  while (true) {
    const result = await getNotifications(page, 100);
    if (!Array.isArray(result.items) || !Number.isFinite(result.total)) {
      throw new Error("The notification response is invalid.");
    }
    unreadIds.push(
      ...result.items.filter((item) => !item.readAt).map((item) => item.id),
    );
    if ((page + 1) * 100 >= result.total) break;
    page += 1;
  }

  const failedIds = [];
  for (let index = 0; index < unreadIds.length; index += 10) {
    const batch = unreadIds.slice(index, index + 10);
    const results = await Promise.allSettled(
      batch.map((id) => markNotificationRead(id)),
    );
    results.forEach((result, batchIndex) => {
      if (result.status === "rejected") failedIds.push(batch[batchIndex]);
    });
  }

  return {
    readIds: unreadIds.filter((id) => !failedIds.includes(id)),
    failedIds,
  };
}
