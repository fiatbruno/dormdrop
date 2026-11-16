import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout/AdminLayout";
import {
  addMessageReportNote,
  dismissMessageReport,
  getAdminMessageReports,
  suspendMessageReportMember,
  warnMessageReportMember,
} from "../../api/reportsApi";
import "./AdminMessageReports.css";

const POLICY_REASONS = [
  "Safe exchanges and payment requests",
  "Respectful communication",
  "Accurate listings",
  "Prohibited items",
  "Repeated marketplace policy violations",
  "Other",
];

function formattedDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function errorText(error) {
  return error.response?.data?.message || "We couldn't save that action. Please try again.";
}

export default function AdminMessageReports() {
  const { reportId } = useParams();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [dialog, setDialog] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [note, setNote] = useState("");
  const [dismissReason, setDismissReason] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [policyReason, setPolicyReason] = useState("");
  const [memberMessage, setMemberMessage] = useState("");
  const [durationDays, setDurationDays] = useState("7");

  useEffect(() => {
    let active = true;
    getAdminMessageReports()
      .then((items) => {
        if (active) {
          setReports(items);
          setError("");
        }
      })
      .catch((requestError) => {
        if (active) {
          setReports([]);
          setError(
            requestError.response?.status === 403
              ? "Administrator access is required to view message reports."
              : "Couldn't load message reports. Please try again.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const selected = reports.find((report) => report.id === reportId);

  async function saveNote(event) {
    event.preventDefault();
    if (!selected) return;
    if (!note.trim()) {
      setActionError("Enter a decision note before saving.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      await addMessageReportNote(selected.id, note.trim());
      setReports((items) =>
        items.map((item) =>
          item.id === selected.id
            ? {
                ...item,
                internalNotes: [
                  ...(item.internalNotes || []),
                  { authorName: "You", content: note.trim(), createdAt: new Date().toISOString() },
                ],
              }
            : item,
        ),
      );
      setNote("");
    } catch (requestError) {
      setActionError(errorText(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function submitAction(event) {
    event.preventDefault();
    if (!selected) return;
    if (
      (dialog === "dismiss" && (!dismissReason.trim() || !decisionNote.trim())) ||
      (dialog !== "dismiss" &&
        (!policyReason.trim() || !memberMessage.trim() ||
          (dialog === "suspend" && !durationDays.trim())))
    ) {
      setActionError("Complete all required fields before submitting.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      if (dialog === "dismiss") {
        await dismissMessageReport(selected.id, {
          reason: dismissReason,
          internalNote: decisionNote,
        });
        updateReport("DISMISSED");
        setSuccess("Report dismissed");
      } else if (dialog === "warning") {
        await warnMessageReportMember(selected.id, {
          policyReason,
          message: memberMessage,
        });
        updateReport("WARNING_SENT");
        setSuccess("Policy warning sent");
      } else {
        const result = await suspendMessageReportMember(selected.id, {
          durationDays: Number(durationDays),
          policyReason,
          message: memberMessage,
        });
        updateReport("SUSPENDED", {
          suspensionExpiresAt: result.expiresAt,
          hiddenListings: result.hiddenListings,
        });
        setSuccess(`Account suspended for ${durationDays} days. ${result.hiddenListings} active listings hidden.`);
      }
      setDialog("success");
    } catch (requestError) {
      setActionError(errorText(requestError));
    } finally {
      setBusy(false);
    }
  }

  function updateReport(status, details = {}) {
    setReports((items) =>
      items.map((item) => (item.id === selected.id ? { ...item, ...details, status } : item)),
    );
  }

  function openDialog(type) {
    setDialog(type);
    setActionError("");
    setSuccess("");
    setDismissReason("");
    setDecisionNote("");
    setPolicyReason("");
    setDurationDays("7");
    setMemberMessage("");
  }

  function closeDialog() {
    if (busy) return;
    setDialog("");
    setActionError("");
  }

  return (
    <AdminLayout
      breadcrumb={reportId ? "Admin / Reports / Message report review" : "Admin / Reports"}
      showSearch={false}
      showUsers
    >
      <div className="admin-message-reports">
        {error && (
          <div className="admin-message-reports__error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => {
              setLoading(true);
              setAttempt((value) => value + 1);
            }}>
              Retry
            </button>
          </div>
        )}

        {!reportId ? (
          <>
            <header className="admin-message-reports__heading">
              <div>
                <h1>Message reports</h1>
                <p>Review reports submitted about messages in member conversations.</p>
              </div>
              <Link to="/staff/reports">View listing reports</Link>
            </header>
            <section className="admin-message-reports__queue" aria-label="Message reports">
              <h2>Reports <span>{reports.length}</span></h2>
              {loading ? (
                <p className="admin-message-reports__state" role="status">Loading message reports…</p>
              ) : !reports.length && !error ? (
                <p className="admin-message-reports__state">No message reports have been submitted.</p>
              ) : (
                <ul>
                  {reports.map((report) => (
                    <li key={report.id}>
                      <Link to={`/admin/message-reports/${report.id}`}>
                        <span className="admin-message-reports__queue-status">{report.status === "OPEN" ? "Open · Awaiting review" : report.status}</span>
                        <strong>{report.messageContent}</strong>
                        <span>{report.reason} · {formattedDate(report.createdAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : loading ? (
          <p className="admin-message-reports__state" role="status">Loading message report…</p>
        ) : !selected ? (
          <div className="admin-message-reports__state">
            <h1>Message report not found</h1>
            <Link to="/admin/message-reports">Back to reports</Link>
          </div>
        ) : (
          <>
            <header className="admin-message-reports__heading">
              <div>
                <h1>Review message report</h1>
                <p>{selected.id} · Reported {formattedDate(selected.createdAt)} · {selected.status === "OPEN" ? "Awaiting review" : selected.status}</p>
              </div>
              <Link to="/admin/message-reports">← Back to reports</Link>
            </header>

            <div className="admin-message-reports__review">
              <div className="admin-message-reports__primary">
                <section className="admin-message-reports__card">
                  <h2>Reported message</h2>
                  <div className="admin-message-reports__reported-message">
                    <strong>{selected.senderName || "Member"} · {formattedDate(selected.messageSentAt)}</strong>
                    <p>“{selected.messageContent}”</p>
                  </div>
                  <p className="admin-message-reports__selected-reason">Reason selected: {selected.reason}</p>
                  <p className="admin-message-reports__report-details">
                    Reporter&apos;s details: {selected.details || "No additional details provided."}
                  </p>
                  <span className="admin-message-reports__review-status">
                    {selected.status === "OPEN" ? "Needs review" : selected.status}
                  </span>
                  <p className="admin-message-reports__privacy">
                    Reporter identity is private and shown only to authorized moderators.
                  </p>
                </section>

                <section className="admin-message-reports__card admin-message-reports__related">
                  <h2>Related conversation</h2>
                  <dl>
                    <div><dt>Listing</dt><dd>{selected.listingTitle || "Listing unavailable"}</dd></div>
                    <div><dt>Reported member</dt><dd>{selected.senderName || "Member"} · {selected.senderEmail || "Email unavailable"}</dd></div>
                  </dl>
                  <p>Review the reported message and the context available to moderators before making a decision.</p>
                  <div className="admin-message-reports__thread">
                    {(selected.conversationContext || []).map((message) => (
                      <article key={message.messageId} className={message.messageId === selected.messageId ? "reported" : ""}>
                        <strong>{message.senderName || "Member"} · {formattedDate(message.sentAt)}</strong>
                        <p>{message.content}</p>
                        {message.messageId === selected.messageId && <span>Reported message</span>}
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              <div className="admin-message-reports__secondary">
                <section className="admin-message-reports__card admin-message-reports__decision">
                  <h2>Make a decision</h2>
                  <p>Choose a proportionate action and record the reason.</p>
                  {selected.status === "SUSPENDED" && selected.suspensionExpiresAt && (
                    <p className="admin-message-reports__suspension-state">
                      Suspension expiry: {formattedDate(selected.suspensionExpiresAt)}. {selected.hiddenListings || 0} active listings hidden.
                    </p>
                  )}
                  <button type="button" disabled={selected.status !== "OPEN"} onClick={() => openDialog("dismiss")}>Dismiss report</button>
                  <button type="button" disabled={selected.status !== "OPEN"} onClick={() => openDialog("warning")}>Send policy warning</button>
                  <button type="button" className="danger" disabled={selected.status !== "OPEN"} onClick={() => openDialog("suspend")}>Suspend account</button>
                  <Link to={`/admin/users?search=${encodeURIComponent(selected.senderEmail || selected.senderName || "")}`}>View member account</Link>
                  <small>A report alone is not a confirmed violation.</small>
                </section>

                <section className="admin-message-reports__card admin-message-reports__notes">
                  <h2>Internal case notes</h2>
                  {(selected.internalNotes || []).map((item, index) => (
                    <article key={`${item.createdAt}-${index}`}>
                      <p>{item.content}</p>
                      <small>{item.authorName} · {formattedDate(item.createdAt)}</small>
                    </article>
                  ))}
                  <form onSubmit={saveNote} noValidate>
                    <label htmlFor="message-report-note">Decision note</label>
                    <textarea id="message-report-note" value={note} onChange={(event) => {
                      setNote(event.target.value);
                      setActionError("");
                    }} placeholder="Add context for the moderation team." maxLength={2000} required />
                    {actionError && <p className="admin-message-reports__error-text" role="alert">{actionError}</p>}
                    <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save note"}</button>
                  </form>
                  <small>Notes are visible only to the moderation team.</small>
                </section>
              </div>
            </div>
          </>
        )}
      </div>

      {dialog && selected && (
        <div className="admin-message-reports__overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}>
          <section className={`admin-message-reports__dialog ${dialog === "suspend" ? "suspension" : ""} ${dialog === "success" ? "admin-message-reports__dialog--success" : ""}`} role="dialog" aria-modal="true" aria-labelledby="message-report-dialog-title">
            {dialog === "success" ? (
              <>
                <span className="admin-message-reports__saved">Decision saved</span>
                <h2 id="message-report-dialog-title">{success}</h2>
                <p>{selected.senderName || "The member"} has been notified. This action is recorded in the moderation history.</p>
                <button type="button" className="primary" onClick={closeDialog}>Done</button>
              </>
            ) : dialog === "dismiss" ? (
              <form onSubmit={submitAction} noValidate>
                <h2 id="message-report-dialog-title">Dismiss this report?</h2>
                <p>The message remains available and the report will be closed.</p>
                <label>Decision reason *
                  <select value={dismissReason} onChange={(event) => {
                    setDismissReason(event.target.value);
                    setActionError("");
                  }} required>
                  <option value="">Select a reason</option>
                  <option>No policy violation found</option>
                    <option>Insufficient context</option>
                    <option>Other</option>
                  </select>
                </label>
                <label>Internal note *
                  <input value={decisionNote} onChange={(event) => {
                    setDecisionNote(event.target.value);
                    setActionError("");
                  }} maxLength={2000} required />
                </label>
                {actionError && <p className="admin-message-reports__error-text" role="alert">{actionError}</p>}
                <div className="admin-message-reports__dialog-actions">
                  <button type="button" onClick={closeDialog} disabled={busy}>Cancel</button>
                  <button type="submit" className="primary" disabled={busy}>{busy ? "Saving…" : "Dismiss report"}</button>
                </div>
              </form>
            ) : (
              <form onSubmit={submitAction} noValidate>
                <h2 id="message-report-dialog-title">{dialog === "suspend" ? `Suspend ${selected.senderName || "member"}?` : "Send a policy warning"}</h2>
                <p className="admin-message-reports__member-subtitle">{selected.senderName || "Member"}</p>
                {dialog === "suspend" && (
                  <div className="admin-message-reports__warning-banner">
                    <strong>Account access will be restricted</strong>
                    <span>New listings and messages are blocked. Existing active listings are hidden during the suspension.</span>
                  </div>
                )}
                {dialog === "suspend" && (
                  <label>Duration *
                    <select value={durationDays} onChange={(event) => {
                      setDurationDays(event.target.value);
                      setActionError("");
                    }} required>
                      {[1, 3, 7, 14, 30].map((days) => <option key={days} value={days}>{days} {days === 1 ? "day" : "days"}</option>)}
                    </select>
                  </label>
                )}
                <label>{dialog === "warning" ? "Policy reason *" : "Reason *"}
                  <select value={policyReason} onChange={(event) => {
                    setPolicyReason(event.target.value);
                    setActionError("");
                  }} required>
                  <option value="">Select a reason</option>
                  {POLICY_REASONS.map((reason) => <option key={reason}>{reason}</option>)}
                  </select>
                </label>
                <label>{dialog === "warning" ? "Warning message *" : "Message to the member *"}
                  <textarea value={memberMessage} onChange={(event) => {
                    setMemberMessage(event.target.value);
                    setActionError("");
                  }} maxLength={2000} required rows={dialog === "warning" ? 4 : 3} />
                </label>
                {dialog === "warning" && <p className="admin-message-reports__dialog-hint">This warning is sent to the member and added to the moderation history. It does not suspend the account.</p>}
                {actionError && <p className="admin-message-reports__error-text" role="alert">{actionError}</p>}
                <div className="admin-message-reports__dialog-actions">
                  <button type="button" onClick={closeDialog} disabled={busy}>Cancel</button>
                  <button type="submit" className={dialog === "suspend" ? "danger" : "primary"} disabled={busy}>{busy ? "Saving…" : dialog === "suspend" ? "Suspend account" : "Send warning"}</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
