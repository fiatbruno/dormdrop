
import api from "./client";

const offerPath = (offerId) => `/offers/${encodeURIComponent(offerId)}`;
const transactionPath = (offerId) => `${offerPath(offerId)}/transaction`;

export async function getCompletedTransaction(offerId) {
  try {
    return (await api.get(transactionPath(offerId))).data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
}

export async function confirmItemReceived(offerId) {
  return (await api.post(`${transactionPath(offerId)}/confirm-receipt`)).data;
}

export async function submitSellerReview(offerId, review) {
  return (await api.post(`${transactionPath(offerId)}/review`, review)).data;
}

export async function getSellerReviews(offerId) {
  return (await api.get(`${transactionPath(offerId)}/seller-reviews`)).data;
}

export async function getOffer(offerId) {
  const { data } = await api.get(offerPath(offerId));
  return data;
}

export async function getMyListingOffer(listingId) {
  const { data } = await api.get(`/home/${encodeURIComponent(listingId)}/my-offer`);
  return data || null;
}

export async function submitOffer(listingId, amount, idempotencyKey) {
  const { data } = await api.post(
    `/home/${encodeURIComponent(listingId)}/offers`,
    { amount },
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return data;
}

export async function sendCounteroffer(
  offerId,
  amount,
  expectedVersion,
  idempotencyKey,
) {
  const { data } = await api.post(
    `${offerPath(offerId)}/counteroffers`,
    { amount, expectedVersion },
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return data;
}

export async function decideOffer(
  offerId,
  action,
  expectedVersion,
  idempotencyKey,
) {
  const { data } = await api.post(
    `${offerPath(offerId)}/decisions`,
    { action, expectedVersion },
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return data;
}

export async function confirmItemReceived(offerId) {
  const { data } = await api.post(
    `${offerPath(offerId)}/transaction/confirm-receipt`,
  );
  return data;
}

export async function getCompletedTransaction(offerId) {
  const { data } = await api.get(
    `${offerPath(offerId)}/transaction`,
  );
  return data;
}
