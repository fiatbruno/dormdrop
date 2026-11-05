import api from "./client";

const offerPath = (offerId) => `/offers/${encodeURIComponent(offerId)}`;

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
