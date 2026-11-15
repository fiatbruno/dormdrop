import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout/AdminLayout";
import { getAdminMessageReports } from "../../api/reportsApi";
import "./AdminMessageReports.css";

function formattedDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export default function AdminMessageReports() {
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getAdminMessageReports()
      .then((items) => {
        if (active) {
          setReports(items);
          setSelectedId((current) =>
            items.some((item) => item.id === current)
              ? current
              : items[0]?.id || "",
          );
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

  const selected = reports.find((report) => report.id === selectedId);

  return (
    <AdminLayout
      breadcrumb="Admin / Message reports"
      showSearch={false}
      showUsers
    >
      <div className="admin-message-reports">
        <header className="admin-message-reports__heading">
          <div>
            <p>Moderation workspace</p>
            <h1>Review message reports</h1>
            <span>Review reported messages and the surrounding conversation.</span>
          </div>
          <Link to="/staff/reports">View listing reports</Link>
        </header>

        {error && (
          <div className="admin-message-reports__error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setAttempt((value) => value + 1);
              }}
            >
              Retry
            </button>
          </div>
        )}

        <div className="admin-message-reports__layout">
          <section
            className="admin-message-reports__queue"
            aria-labelledby="message-report-queue-title"
          >
            <div className="admin-message-reports__queue-heading">
              <h2 id="message-report-queue-title">Message reports</h2>
              <span>{reports.length}</span>
            </div>
            {loading ? (
              <p className="admin-message-reports__state" role="status">
                Loading message reports…
              </p>
            ) : !error && reports.length === 0 ? (
              <p className="admin-message-reports__state">
                No message reports have been submitted.
              </p>
            ) : (
              <ul>
                {reports.map((report) => (
                  <li key={report.id}>
                    <button
                      type="button"
                      className={
                        report.id === selectedId ? "selected" : undefined
                      }
                      onClick={() => setSelectedId(report.id)}
                      aria-current={report.id === selectedId ? "true" : undefined}
                    >
                      <strong>{report.reason}</strong>
                      <span>
                        {report.senderName || "Member"} ·{" "}
                        {formattedDate(report.createdAt)}
                      </span>
                      <span className="admin-message-reports__status">
                        {report.status === "OPEN" ? "Open · Awaiting review" : report.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="admin-message-reports__detail"
            aria-labelledby="message-report-detail-title"
          >
            {!selected ? (
              <div className="admin-message-reports__state">
                <h2 id="message-report-detail-title">Select a report</h2>
                <p>Choose a message report to review its details.</p>
              </div>
            ) : (
              <>
                <header className="admin-message-reports__detail-heading">
                  <div>
                    <p>Reported {formattedDate(selected.createdAt)}</p>
                    <h2 id="message-report-detail-title">Reported message</h2>
                  </div>
                  <span>{selected.status === "OPEN" ? "Open" : selected.status}</span>
                </header>

                <dl className="admin-message-reports__metadata">
                  <div>
                    <dt>Reported by</dt>
                    <dd>
                      {selected.reporterName || "Member"}
                      {selected.reporterEmail && <span>{selected.reporterEmail}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt>Message sender</dt>
                    <dd>
                      {selected.senderName || "Member"}
                      {selected.senderEmail && <span>{selected.senderEmail}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt>Listing</dt>
                    <dd>{selected.listingTitle || "Listing unavailable"}</dd>
                  </div>
                </dl>

                <section className="admin-message-reports__reason">
                  <h3>Reason selected: {selected.reason}</h3>
                  <p>{selected.details || "No additional details provided."}</p>
                </section>

                <section
                  className="admin-message-reports__context"
                  aria-labelledby="message-context-title"
                >
                  <h3 id="message-context-title">Related conversation</h3>
                  <p className="admin-message-reports__context-note">
                    The reported message and nearby conversation messages are
                    saved as they appeared when the report was submitted.
                  </p>
                  <div className="admin-message-reports__thread">
                    {(selected.conversationContext || []).map((message) => (
                      <article
                        key={message.messageId}
                        className={
                          message.messageId === selected.messageId
                            ? "reported"
                            : undefined
                        }
                      >
                        <div>
                          <strong>{message.senderName || "Member"}</strong>
                          <time dateTime={message.sentAt}>
                            {formattedDate(message.sentAt)}
                          </time>
                        </div>
                        <p>{message.content}</p>
                        {message.messageId === selected.messageId && (
                          <span className="admin-message-reports__reported-label">
                            Reported message
                          </span>
                        )}
                      </article>
                    ))}
                  </div>
                </section>

                <p className="admin-message-reports__reference">
                  Conversation {selected.conversationId} · Message{" "}
                  {selected.messageId}
                </p>
              </>
            )}
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
