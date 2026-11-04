import api from "./client";

const offerPath = (offerId) => `/offers/${encodeURIComponent(offerId)}`;

export async function getOffer(offerId) {
  const { data } = await api.get(offerPath(offerId));
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
  decision,
  expectedVersion,
  idempotencyKey,
) {
  const { data } = await api.post(
    `${offerPath(offerId)}/decisions`,
    { decision, expectedVersion },
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return data;
}
