
import api from "./client";

const path = (conversationId) =>
  `/conversations/${encodeURIComponent(conversationId)}/pickup-proposals`;

export async function getPickupProposals(conversationId) {
  const { data } = await api.get(path(conversationId));
  return data;
}

export async function createPickupProposal(conversationId, payload) {
  const { data } = await api.post(path(conversationId), payload);
  return data;
}

export async function respondToPickupProposal(conversationId, proposalId, decision) {
  const { data } = await api.patch(
    `${path(conversationId)}/${encodeURIComponent(proposalId)}/respond`,
    null,
    { params: { decision } },
  );
  return data;
}
