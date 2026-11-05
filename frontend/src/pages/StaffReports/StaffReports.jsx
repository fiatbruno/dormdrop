import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import useAuth from "../../hooks/useAuth";
import { getProfile } from "../../api/profileApi";
import { getStaffIdentity } from "../../auth/staffCapabilities";
import {
  assignStaffReportCase,
  decideStaffReportCase,
  getStaffReportCase,
  getStaffReportMedia,
  getStaffReportQueue,
} from "../../api/reportsApi";
import "./StaffReports.css";

const PAGE_SIZE = 20;
const STATUS_FILTERS = ["", "OPEN", "IN_REVIEW", "RESOLVED"];
const PRIORITY_FILTERS = ["", "LOW", "MEDIUM", "HIGH"];
const DECISION_ACTIONS = ["KEEP", "HIDE", "REMOVE"];

function readable(value) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formattedDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function StaffSnapshotMedia({ caseId, snapshot, onPermissionLoss }) {
  const mediaKeys = Array.isArray(snapshot.mediaKeys) ? snapshot.mediaKeys : [];
  const mediaSignature = JSON.stringify(mediaKeys);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(mediaKeys.length > 0);

  useEffect(() => {
    let cancelled = false;
    const objectUrls = [];

    async function loadMedia() {
      const keys = JSON.parse(mediaSignature);
      if (!keys.length) {
        setMedia([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const results = await Promise.all(
        keys.map(async (key) => {
          try {
            const blob = await getStaffReportMedia(caseId, snapshot.id, key);
            if (cancelled) return { state: "cancelled" };
            const url = URL.createObjectURL(blob);
            objectUrls.push(url);
            return { state: "available", url };
          } catch (error) {
            const status = error.response?.status;
            if ([401, 403].includes(status)) {
              onPermissionLoss();
              return { state: "denied" };
            }
            return { state: status === 404 ? "missing" : "error" };
          }
        }),
      );
      if (!cancelled) {
        setMedia(results);
        setLoading(false);
      }
    }

    void loadMedia();
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [caseId, mediaSignature, onPermissionLoss, snapshot.id]);

  if (!mediaKeys.length) {
    return <p className="staff-evidence-state">Snapshot retained; no media is available.</p>;
  }
  if (loading) {
    return <p className="staff-evidence-state" role="status">Loading retained media…</p>;
  }
  return (
    <div className="staff-evidence-gallery" aria-label="Retained listing media">
      {media.map((item, index) =>
        item.state === "available" ? (
          <figure key={index}>
            <img src={item.url} alt={`Retained listing evidence ${index + 1}`} />
            <figcaption>Retained media {index + 1}</figcaption>
          </figure>
        ) : (
          <p className="staff-evidence-state" key={index} role="status">
            {item.state === "missing"
              ? `Retained media ${index + 1} is no longer available.`
              : `Retained media ${index + 1} could not be loaded.`}
          </p>
        ),
      )}
    </div>
  );
}

export default function StaffReports() {
  const { caseId } = useParams();
  const { token } = useAuth();
  return <StaffReportsProfile key={token || "signed-out"} caseId={caseId} />;
}

function StaffReportsProfile({ caseId }) {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [profileAttempt, setProfileAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getProfile()
      .then((currentProfile) => {
        if (active) {
          setProfile(currentProfile);
          setProfileError("");
        }
      })
      .catch(() => {
        if (active) {
          setProfile(null);
          setProfileError("Couldn't verify staff access. Please retry.");
        }
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });
    return () => {
      active = false;
    };
  }, [profileAttempt]);

  const staff = getStaffIdentity(profile);
  if (loadingProfile) {
    return (
      <div className="staff-reports-shell">
        <Navbar showSearch={false} />
        <main className="staff-reports-page">
          <h1>Listing reports</h1>
          <p role="status">Verifying staff access…</p>
        </main>
        <Footer />
      </div>
    );
  }
  if (profileError) {
    return (
      <div className="staff-reports-shell">
        <Navbar showSearch={false} />
        <main className="staff-reports-page">
          <h1>Listing reports</h1>
          <div role="alert">
            <p>{profileError}</p>
            <button
              type="button"
              onClick={() => {
                setLoadingProfile(true);
                setProfileAttempt((attempt) => attempt + 1);
              }}
            >
              Retry
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  return (
    <StaffReportsContent caseId={caseId} staff={staff} />
  );
}

function StaffReportsContent({ caseId, staff }) {
  const [queue, setQueue] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [page, setPage] = useState(0);
  const [loadingQueue, setLoadingQueue] = useState(staff.canReview);
  const [loadingCase, setLoadingCase] = useState(
    Boolean(caseId && staff.canReview),
  );
  const [queueError, setQueueError] = useState("");
  const [caseError, setCaseError] = useState("");
  const [permissionLost, setPermissionLost] = useState(false);
  const [claimPending, setClaimPending] = useState(false);
  const [decisionPending, setDecisionPending] = useState(false);
  const [decisionAction, setDecisionAction] = useState("KEEP");
  const [policyReason, setPolicyReason] = useState("");
  const [internalRationale, setInternalRationale] = useState("");
  const [sellerMessage, setSellerMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [decisionNotice, setDecisionNotice] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const permissionLostRef = useRef(false);

  const clearPrivateData = useCallback(() => {
    permissionLostRef.current = true;
    setQueue(null);
    setCaseDetail(null);
    setQueueError("");
    setCaseError("");
    setPolicyReason("");
    setInternalRationale("");
    setSellerMessage("");
    setFormError("");
    setDecisionNotice("");
    setIdempotencyKey("");
    setPermissionLost(true);
  }, []);

  const loadQueue = useCallback(async () => {
    if (!staff.canReview) return;
    setLoadingQueue(true);
    setQueueError("");
    try {
      const result = await getStaffReportQueue({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        page,
        size: PAGE_SIZE,
      });
      if (!permissionLostRef.current) setQueue(result);
    } catch (error) {
      if ([401, 403].includes(error.response?.status)) {
        clearPrivateData();
      } else {
        setQueueError("Couldn't load report cases. Please try again.");
      }
    } finally {
      setLoadingQueue(false);
    }
  }, [
    clearPrivateData,
    page,
    priorityFilter,
    staff.canReview,
    statusFilter,
  ]);

  const loadCase = useCallback(async () => {
    if (!staff.canReview || !caseId) {
      setCaseDetail(null);
      setLoadingCase(false);
      return;
    }
    setLoadingCase(true);
    setCaseError("");
    try {
      const result = await getStaffReportCase(caseId);
      if (!permissionLostRef.current) setCaseDetail(result);
    } catch (error) {
      if ([401, 403].includes(error.response?.status)) {
        clearPrivateData();
      } else {
        setCaseError(
          error.response?.status === 404
            ? "This case is unavailable."
            : "Couldn't load this case. Please try again.",
        );
        setCaseDetail(null);
      }
    } finally {
      setLoadingCase(false);
    }
  }, [caseId, clearPrivateData, staff.canReview]);

  useEffect(() => {
    if (!staff.canReview) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch authorized queue data after route/filter changes.
    void loadQueue();
    if (caseId) {
      void loadCase();
    }
  }, [staff.canReview, caseId, loadCase, loadQueue]);

  async function handleClaim() {
    const summary = caseDetail?.caseSummary;
    if (
      claimPending ||
      !staff.userId ||
      !Number.isFinite(Number(summary?.version))
    ) {
      return;
    }
    setClaimPending(true);
    setCaseError("");
    try {
      await assignStaffReportCase(caseId, summary.version, staff.userId);
      setDecisionNotice("Case claimed.");
      await Promise.all([loadCase(), loadQueue()]);
    } catch (error) {
      if ([401, 403].includes(error.response?.status)) {
        clearPrivateData();
      } else if (error.response?.status === 409) {
        await Promise.all([loadCase(), loadQueue()]);
        setCaseError("The case changed. The latest case details were loaded.");
      } else {
        setCaseError("Couldn't claim this case. Please try again.");
      }
    } finally {
      setClaimPending(false);
    }
  }

  function invalidateDecisionKey() {
    setIdempotencyKey("");
    setFormError("");
    setDecisionNotice("");
  }

  async function handleDecision(event) {
    event.preventDefault();
    if (decisionPending || !caseDetail?.caseSummary) return;
    setFormError("");
    setDecisionNotice("");
    if (
      !policyReason.trim() ||
      !internalRationale.trim() ||
      (decisionAction === "REMOVE" && !sellerMessage.trim())
    ) {
      setFormError(
        decisionAction === "REMOVE"
          ? "Provide a policy reason, seller notice, and internal rationale."
          : "Provide a policy reason and internal rationale.",
      );
      return;
    }

    const request = {
      action: decisionAction,
      expectedVersion: caseDetail.caseSummary.version,
      policyReason: policyReason.trim(),
      internalRationale: internalRationale.trim(),
      ...(decisionAction === "REMOVE"
        ? { sellerMessage: sellerMessage.trim() }
        : {}),
    };
    setDecisionPending(true);
    const key = idempotencyKey || crypto.randomUUID();
    setIdempotencyKey(key);
    try {
      await decideStaffReportCase(caseId, request, key);
      setDecisionNotice(`${readable(decisionAction)} decision recorded.`);
      setPolicyReason("");
      setInternalRationale("");
      setSellerMessage("");
      setIdempotencyKey("");
      await Promise.all([loadCase(), loadQueue()]);
    } catch (error) {
      if ([401, 403].includes(error.response?.status)) {
        clearPrivateData();
      } else if (error.response?.status === 409) {
        setFormError("This case changed. The latest details were loaded.");
        setIdempotencyKey("");
        await Promise.all([loadCase(), loadQueue()]);
      } else {
        setFormError(
          "Couldn't save the decision. Your entries are preserved; please retry.",
        );
      }
    } finally {
      setDecisionPending(false);
    }
  }

  const summary = caseDetail?.caseSummary;
  const totalPages = Number(queue?.totalPages) || 0;
  return (
    <div className="staff-reports-shell">
      <Navbar showSearch={false} />
      <main className="staff-reports-page">
        <p className="staff-reports-eyebrow">Staff workspace</p>
        <h1>Listing reports</h1>
        {!staff.canReview || permissionLost ? (
          <section className="staff-reports-state" role="alert">
            <h2>Staff access required</h2>
            <p>This area is only available to authorized moderators and admins.</p>
            <Link to="/home">Return to listings</Link>
          </section>
        ) : (
          <div className="staff-reports-layout">
            <section
              className="staff-reports-queue"
              aria-labelledby="staff-queue-title"
            >
              <div className="staff-reports-queue__heading">
                <h2 id="staff-queue-title">Case queue</h2>
                <span>{Number.isFinite(queue?.total) ? queue.total : "—"} cases</span>
              </div>
              <div className="staff-reports-filters">
                <label>
                  Status
                  <select
                    value={statusFilter}
                    onChange={(event) => {
                      setPage(0);
                      setStatusFilter(event.target.value);
                    }}
                  >
                    {STATUS_FILTERS.map((value) => (
                      <option key={value || "all"} value={value}>
                        {value ? readable(value) : "All statuses"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    value={priorityFilter}
                    onChange={(event) => {
                      setPage(0);
                      setPriorityFilter(event.target.value);
                    }}
                  >
                    {PRIORITY_FILTERS.map((value) => (
                      <option key={value || "all"} value={value}>
                        {value ? readable(value) : "All priorities"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {queueError && (
                <div className="staff-reports-error" role="alert">
                  <p>{queueError}</p>
                  <button type="button" onClick={loadQueue}>
                    Retry
                  </button>
                </div>
              )}
              {loadingQueue ? (
                <p className="staff-reports-state" role="status">
                  Loading report queue…
                </p>
              ) : (
                <>
                  {!queueError && (queue?.items || []).length === 0 ? (
                    <p className="staff-reports-state">No report cases found.</p>
                  ) : (
                    <ul className="staff-case-list">
                      {(queue?.items || []).map((item) => (
                        <li key={item.caseId}>
                          <Link
                            to={`/staff/reports/${encodeURIComponent(item.caseId)}`}
                            aria-current={item.caseId === caseId ? "page" : undefined}
                          >
                            <strong>{item.referenceNumber || item.caseId}</strong>
                            <span>
                              {readable(item.status)} · {readable(item.priority)}
                            </span>
                            <span>{item.reportCount} reports</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {totalPages > 1 && (
                    <nav className="staff-reports-pagination" aria-label="Case pages">
                      <button
                        type="button"
                        disabled={page === 0 || loadingQueue}
                        onClick={() => setPage((current) => Math.max(0, current - 1))}
                      >
                        Previous
                      </button>
                      <span>
                        Page {page + 1} of {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={page + 1 >= totalPages || loadingQueue}
                        onClick={() => setPage((current) => current + 1)}
                      >
                        Next
                      </button>
                    </nav>
                  )}
                </>
              )}
            </section>
            <section
              className="staff-reports-detail"
              aria-labelledby="staff-case-title"
            >
              {!caseId ? (
                <div className="staff-reports-state">
                  <h2 id="staff-case-title">Select a case</h2>
                  <p>Choose a report case from the queue to review its evidence.</p>
                </div>
              ) : loadingCase ? (
                <p className="staff-reports-state" role="status">
                  Loading case…
                </p>
              ) : caseError && !caseDetail ? (
                <div className="staff-reports-state staff-reports-error" role="alert">
                  <p>{caseError}</p>
                  <button type="button" onClick={loadCase}>
                    Retry
                  </button>
                </div>
              ) : (
                caseDetail && (
                  <>
                    <header className="staff-case-heading">
                      <div>
                        <p>{summary.referenceNumber || summary.caseId}</p>
                        <h2 id="staff-case-title">Report case</h2>
                      </div>
                      <span>{readable(summary.status)}</span>
                    </header>
                    {caseError && (
                      <p className="staff-reports-error" role="alert">
                        {caseError}
                      </p>
                    )}
                    {decisionNotice && (
                      <p className="staff-reports-success" role="status">
                        {decisionNotice}
                      </p>
                    )}
                    <dl className="staff-case-meta">
                      <div>
                        <dt>Priority</dt>
                        <dd>{readable(summary.priority)}</dd>
                      </div>
                      <div>
                        <dt>Reports</dt>
                        <dd>{summary.reportCount}</dd>
                      </div>
                      <div>
                        <dt>Assigned to</dt>
                        <dd>{summary.assignedTo ? "A staff reviewer" : "Unassigned"}</dd>
                      </div>
                      {caseDetail.seller?.displayName && (
                        <div>
                          <dt>Seller</dt>
                          <dd>{caseDetail.seller.displayName}</dd>
                        </div>
                      )}
                    </dl>
                    {summary.status !== "RESOLVED" &&
                      summary.assignedTo !== staff.userId && (
                      <div className="staff-claim">
                        {staff.userId ? (
                          <button
                            type="button"
                            onClick={handleClaim}
                            disabled={claimPending}
                          >
                            {claimPending ? "Claiming…" : "Claim case"}
                          </button>
                        ) : (
                          <p>
                            Staff account identity is unavailable; this case
                            can’t be claimed.
                          </p>
                        )}
                      </div>
                    )}

                    <section className="staff-case-section" aria-labelledby="evidence-title">
                      <h3 id="evidence-title">Retained listing evidence</h3>
                      {(caseDetail.snapshots || []).length === 0 ? (
                        <p className="staff-evidence-state">
                          No retained snapshot is available for this case.
                        </p>
                      ) : (
                        <div className="staff-snapshots">
                          {caseDetail.snapshots.map((snapshot) => {
                            const count = Array.isArray(snapshot.mediaKeys)
                              ? snapshot.mediaKeys.length
                              : 0;
                            const price = Number(snapshot.price);
                            return (
                              <article key={snapshot.id} className="staff-snapshot">
                                <h4>{snapshot.title || "Listing snapshot"}</h4>
                                <p>{snapshot.description || "No description saved."}</p>
                                <dl>
                                  <div>
                                    <dt>Category</dt>
                                    <dd>{snapshot.category || "Not recorded"}</dd>
                                  </div>
                                  <div>
                                    <dt>Price at capture</dt>
                                    <dd>
                                      {snapshot.price === null || snapshot.price === undefined
                                        ? "Not recorded"
                                        : Number.isFinite(price)
                                          ? new Intl.NumberFormat("en-US", {
                                              style: "currency",
                                              currency: "USD",
                                            }).format(price)
                                          : "Not recorded"}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>Listing status at capture</dt>
                                    <dd>{readable(snapshot.lifecycleStatus)}</dd>
                                  </div>
                                  <div>
                                    <dt>Captured</dt>
                                    <dd>{formattedDate(snapshot.capturedAt)}</dd>
                                  </div>
                                  {count > 0 && (
                                    <div>
                                      <dt>Evidence</dt>
                                      <dd>
                                        {count} retained media item{count === 1 ? "" : "s"}
                                      </dd>
                                    </div>
                                  )}
                                </dl>
                                <StaffSnapshotMedia
                                  caseId={caseId}
                                  snapshot={snapshot}
                                  onPermissionLoss={clearPrivateData}
                                />
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </section>

                    <section className="staff-case-section" aria-labelledby="reports-title">
                      <h3 id="reports-title">Reports grouped by snapshot</h3>
                      {(caseDetail.reportGroups || []).length === 0 ? (
                        <p>No reports are available for this case.</p>
                      ) : (
                        (caseDetail.reportGroups || []).map((group) => (
                          <div className="staff-report-group" key={group.snapshotId}>
                            <h4>
                              Snapshot{" "}
                              {(caseDetail.snapshots || []).find(
                                (snapshot) => snapshot.id === group.snapshotId,
                              )?.title || "details unavailable"}
                            </h4>
                            {(group.reports || []).map((report) => (
                              <article className="staff-report" key={report.reportId}>
                                <strong>{readable(report.category)}</strong>
                                <p>{report.description}</p>
                                <time dateTime={report.submittedAt}>
                                  Submitted {formattedDate(report.submittedAt)}
                                </time>
                              </article>
                            ))}
                          </div>
                        ))
                      )}
                    </section>

                    {(caseDetail.decisions || []).length > 0 && (
                      <section className="staff-case-section" aria-labelledby="decision-history-title">
                        <h3 id="decision-history-title">Internal decision history</h3>
                        {caseDetail.decisions.map((decision) => (
                          <article className="staff-history-entry" key={decision.decisionId}>
                            <strong>{readable(decision.action)}</strong>
                            <p>{decision.internalRationale || "No internal note recorded."}</p>
                            <time dateTime={decision.createdAt}>
                              {formattedDate(decision.createdAt)}
                            </time>
                          </article>
                        ))}
                      </section>
                    )}

                    {summary.status !== "RESOLVED" && (
                      <form
                        className="staff-decision-form"
                        onSubmit={handleDecision}
                        noValidate
                      >
                        <h3>Record a staff decision</h3>
                        <label htmlFor="decision-action">Action</label>
                        <select
                          id="decision-action"
                          value={decisionAction}
                          disabled={decisionPending}
                          onChange={(event) => {
                            invalidateDecisionKey();
                            setDecisionAction(event.target.value);
                          }}
                        >
                          {DECISION_ACTIONS.map((action) => (
                            <option key={action} value={action}>
                              {readable(action)}
                            </option>
                          ))}
                        </select>
                        <label htmlFor="policy-reason">Policy reason</label>
                        <textarea
                          id="policy-reason"
                          value={policyReason}
                          maxLength={500}
                          disabled={decisionPending}
                          onChange={(event) => {
                            invalidateDecisionKey();
                            setPolicyReason(event.target.value);
                          }}
                          required
                        />
                        {decisionAction === "REMOVE" && (
                          <>
                            <label htmlFor="seller-message">Seller-visible notice</label>
                            <textarea
                              id="seller-message"
                              value={sellerMessage}
                              maxLength={2000}
                              disabled={decisionPending}
                              onChange={(event) => {
                                invalidateDecisionKey();
                                setSellerMessage(event.target.value);
                              }}
                              required
                            />
                          </>
                        )}
                        <label htmlFor="internal-rationale">Internal rationale</label>
                        <textarea
                          id="internal-rationale"
                          value={internalRationale}
                          maxLength={4000}
                          disabled={decisionPending}
                          onChange={(event) => {
                            invalidateDecisionKey();
                            setInternalRationale(event.target.value);
                          }}
                          required
                        />
                        <p className="staff-decision-guidance">
                          Decision guidance is draft; follow current staff policy.
                        </p>
                        {formError && (
                          <p className="staff-reports-error" role="alert">
                            {formError}
                          </p>
                        )}
                        <button type="submit" disabled={decisionPending}>
                          {decisionPending ? "Saving decision…" : `Record ${readable(decisionAction)}`}
                        </button>
                      </form>
                    )}
                  </>
                )
              )}
            </section>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
