
import api from "./client";

const offerPath = (offerId) => `/offers/${encodeURIComponent(offerId)}`;

export async function sendCounteroffer(
  offerId,
  amount,
  expectedVersion,
  idempotencyKey,
) {
  const response = await api.post(
    `${offerPath(offerId)}/counteroffers`,
    { amount, expectedVersion, idempotencyKey },
  );

  return response.data;
}

export async function decideOffer(
  offerId,
  decision,
  expectedVersion,
  idempotencyKey,
) {
  const response = await api.post(`${offerPath(offerId)}/decisions`, {
    decision,
    expectedVersion,
    idempotencyKey,
  });

  return response.data;
}
