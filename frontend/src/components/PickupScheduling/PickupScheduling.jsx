
import { useCallback, useEffect, useState } from "react";
import {
  createPickupProposal,
  getPickupProposals,
  respondToPickupProposal,
} from "../../api/pickupApi";
import "./PickupScheduling.css";

const campusTimeZone = "America/Chicago";

function errorMessage(error) {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  return data?.detail || data?.message || data?.reason ||
    (data?.error && data.error !== "Conflict" ? data.error : null) ||
    error?.message || "The request could not be completed.";
}

function idOf(value) {
  if (typeof value === "string") return value;
  return value?.$oid || value?.id || value?.toHexString?.() || "";
}

function campusNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: campusTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type) => parts.find((entry) => entry.type === type)?.value || "00";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function formatPickup(value) {
  if (!value) return "Time unavailable";
  const text = String(value).replace(" ", "T");
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return text;
  const [, year, month, day, hour, minute] = match;
  const hourNumber = Number(hour);
  const hour12 = hourNumber % 12 || 12;
  return `${Number(month)}/${Number(day)}/${year}, ${hour12}:${minute} ${hourNumber >= 12 ? "PM" : "AM"} (Central Time)`;
}

export default function PickupScheduling({ conversationId, currentUserId, open, onClose }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [respondingId, setRespondingId] = useState("");
  const [meetingPlace, setMeetingPlace] = useState("");
  const [timePickup, setTimePickup] = useState("");
  const [note, setNote] = useState("");

  const refresh = useCallback(async (silent = false) => {
    if (!conversationId) return;
    if (!silent) setLoading(true);
    try {
      const result = await getPickupProposals(conversationId);
      setProposals(Array.isArray(result) ? result : []);
      setError("");
    } catch (failure) {
      if (!silent) setError(errorMessage(failure));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    setProposals([]);
    setLoading(true);
    setError("");
    void refresh();
    const interval = setInterval(() => void refresh(true), 12000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (open) {
      setFormError("");
      setTimePickup("");
    }
  }, [open]);

  const ordered = [...proposals].sort((a, b) =>
    new Date(b.timeCreated || 0).getTime() - new Date(a.timeCreated || 0).getTime(),
  );
  const latest = ordered[0];
  const hasAccepted = latest?.status === "ACCEPTED";

  async function submit(event) {
    event.preventDefault();
    setFormError("");
    if (!meetingPlace.trim() || !timePickup) {
      setFormError("Enter a meeting place, date, and time.");
      return;
    }
    if (timePickup <= campusNow()) {
      setFormError("Choose a future pickup time in Central Time.");
      return;
    }
    setBusy(true);
    try {
      await createPickupProposal(conversationId, {
        meetingPlace: meetingPlace.trim(),
        timePickup: `${timePickup}:00`,
        note: note.trim(),
      });
      setMeetingPlace("");
      setTimePickup("");
      setNote("");
      onClose();
      await refresh();
    } catch (failure) {
      setFormError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function respond(proposalId, decision) {
    setRespondingId(proposalId);
    setError("");
    try {
      await respondToPickupProposal(conversationId, proposalId, decision);
      await refresh();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setRespondingId("");
    }
  }

  return (
    <>
      <section className="pickup-section" aria-label="Pickup arrangements">
        <div className="pickup-section-header">
          <strong>Pickup arrangements</strong>
          <button type="button" onClick={() => void refresh()} disabled={loading}>Refresh</button>
        </div>
        {loading && <p className="pickup-muted">Loading pickup arrangements…</p>}
        {error && <p className="pickup-error" role="alert">{error}</p>}
        {!loading && ordered.length === 0 && (
          <p className="pickup-muted">No pickup arrangement yet. Use Arrange pickup to propose a time and place.</p>
        )}
        {ordered.map((proposal, index) => {
          const own = idOf(proposal.idSuggester) === idOf(currentUserId);
          const pending = proposal.status === "PENDING";
          const proposalId = idOf(proposal.id);
          return (
            <article className="pickup-card" key={proposalId || index}>
              <div className="pickup-card-heading">
                <strong>{index === 0 ? "Latest proposal" : "Previous proposal"}</strong>
                <span className={`pickup-status pickup-status-${String(proposal.status).toLowerCase()}`}>
                  {proposal.status}
                </span>
              </div>
              <p><strong>Where:</strong> {proposal.meetingPlace}</p>
              <p><strong>When:</strong> {formatPickup(proposal.timePickUp)}</p>
              {proposal.meetingNote && <p><strong>Note:</strong> {proposal.meetingNote}</p>}
              {pending && own && <p className="pickup-muted">Waiting for the other person to respond.</p>}
              {pending && !own && index === 0 && (
                <div className="pickup-card-actions">
                  <button type="button" disabled={!!respondingId} onClick={() => void respond(proposalId, "REJECTED")}>Reject</button>
                  <button type="button" className="pickup-primary" disabled={!!respondingId} onClick={() => void respond(proposalId, "ACCEPTED")}>
                    {respondingId === proposalId ? "Saving…" : "Accept pickup"}
                  </button>
                </div>
              )}
              {index === 0 && hasAccepted && (
                <p className="pickup-muted">Pickup agreed. The buyer can confirm receipt after the scheduled time.</p>
              )}
            </article>
          );
        })}
      </section>
      {open && (
        <div className="pickup-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
          <div className="pickup-dialog" role="dialog" aria-modal="true" aria-labelledby="pickup-dialog-title">
            <div className="pickup-dialog-heading">
              <h2 id="pickup-dialog-title">Arrange pickup</h2>
              <button type="button" aria-label="Close" disabled={busy} onClick={onClose}>×</button>
            </div>
            <p className="pickup-muted">Choose a future pickup time in Central Time (Rock Island campus).</p>
            {hasAccepted && <p className="pickup-warning">A new proposal will become the latest arrangement and may require a new acceptance before receipt can be confirmed.</p>}
            <form onSubmit={(event) => void submit(event)} className="pickup-form">
              <label>Meeting place
                <input required maxLength={200} placeholder="e.g. Olin Center entrance" value={meetingPlace} onChange={(event) => setMeetingPlace(event.target.value)} />
              </label>
              <label>Pickup date and time (Central Time)
                <input required type="datetime-local" min={campusNow()} value={timePickup} onChange={(event) => setTimePickup(event.target.value)} />
              </label>
              <label>Note (optional)
                <textarea maxLength={500} rows={3} placeholder="Any details about where to meet" value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
              {formError && <p className="pickup-error" role="alert">{formError}</p>}
              <div className="pickup-form-actions">
                <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
                <button type="submit" className="pickup-primary" disabled={busy}>{busy ? "Sending…" : "Propose pickup"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
