import api from "./client";

export async function submitListingReport(listingId, report, idempotencyKey) {
  const { data } = await api.post(
    `/home/${encodeURIComponent(listingId)}/reports`,
    report,
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return data;
}

export async function getAdminMessageReports() {
  const { data } = await api.get("/admin/message-reports");
  return data;
}

export async function getMyReports(page = 0, size = 20) {
  const { data } = await api.get("/me/reports", { params: { page, size } });
  return data;
}

export async function getStaffReportQueue(filters = {}) {
  const { data } = await api.get("/admin/reports", { params: filters });
  return data;
}

export async function getStaffReportCase(caseId) {
  const { data } = await api.get(
    `/admin/reports/${encodeURIComponent(caseId)}`,
  );
  return data;
}

export async function getStaffReportMedia(caseId, snapshotId, mediaKey) {
  const { data } = await api.get(
    `/staff/cases/${encodeURIComponent(caseId)}/snapshots/${encodeURIComponent(snapshotId)}/media/${encodeURIComponent(mediaKey)}`,
    { responseType: "blob" },
  );
  return data;
}

export async function assignStaffReportCase(caseId, expectedVersion, assigneeId) {
  const { data } = await api.patch(
    `/admin/reports/${encodeURIComponent(caseId)}/assignment`,
    { expectedVersion, assigneeId },
  );
  return data;
}

export async function decideStaffReportCase(
  caseId,
  decision,
  idempotencyKey,
) {
  const { data } = await api.post(
    `/admin/reports/${encodeURIComponent(caseId)}/decisions`,
    decision,
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return data;
}
