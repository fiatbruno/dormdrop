
import api from "./client";

export async function sendCounteroffer(offerId, amount) {
  const response = await api.post(
    `/offers/${encodeURIComponent(offerId)}/counteroffer`,
    { amount }
  );

  return response.data;
}
