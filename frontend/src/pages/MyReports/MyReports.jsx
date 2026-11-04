import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../../components/Footer/Footer";
import Navbar from "../../components/Navbar/Navbar";
import { getMyReports } from "../../api/reportsApi";
import useAuth from "../../hooks/useAuth";
import "./MyReports.css";

const PAGE_SIZE = 20;

function safeReportStatus(report) {
  return {
    reportId: typeof report.reportId === "string" ? report.reportId : "",
    referenceNumber:
      typeof report.referenceNumber === "string" ? report.referenceNumber : "",
    status: typeof report.status === "string" ? report.status : "UNKNOWN",
    submittedAt:
      typeof report.submittedAt === "string" ? report.submittedAt : "",
  };
}

function formatStatus(status) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(date);
}

export default function MyReports() {
  const { token } = useAuth();
  return <MyReportsContent key={token || "signed-out"} />;
}

function MyReportsContent() {
  const [reports, setReports] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const loadPage = useCallback(
    async (pageNumber, append = false) => {
      if (pageNumber === 0) setLoading(true);
      else setLoadingMore(true);
      setError("");
      try {
        const result = await getMyReports(pageNumber, PAGE_SIZE);
        if (!Array.isArray(result)) {
          throw new Error("The report status response is invalid.");
        }
        const safeResults = result.map(safeReportStatus);
        setReports((current) =>
          append ? [...current, ...safeResults] : safeResults,
        );
        setPage(pageNumber);
        setHasMore(safeResults.length === PAGE_SIZE);
      } catch (requestError) {
        if (requestError.response?.status === 401) return;
        setError("We couldn't load your report statuses. Please try again.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch the authenticated user's own statuses.
    loadPage(0);
  }, [loadPage]);

  return (
    <div className="my-reports-shell">
      <Navbar showSearch={false} />
      <main className="my-reports-page">
        <p className="my-reports-eyebrow">Your activity</p>
        <h1>Your report status</h1>
        <p className="my-reports-intro">
          Only your own reports appear here. Staff notes and other reporters’
          information are private.
        </p>
        {error && (
          <div className="my-reports-state my-reports-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => loadPage(page)}>
              Try again
            </button>
          </div>
        )}
        {loading ? (
          <p className="my-reports-state" role="status">
            Loading your reports…
          </p>
        ) : reports.length === 0 && !error ? (
          <div className="my-reports-state">
            <p>You haven’t submitted any reports.</p>
            <Link to="/home">Browse listings</Link>
          </div>
        ) : (
          <ul className="my-reports-list">
            {reports.map((report, index) => (
              <li key={report.reportId || `${report.referenceNumber}-${index}`}>
                <div>
                  <h2>
                    {report.referenceNumber
                      ? `Report ${report.referenceNumber}`
                      : "Report"}
                  </h2>
                  <p>Submitted {formatDate(report.submittedAt)}</p>
                </div>
                <span>{formatStatus(report.status)}</span>
              </li>
            ))}
          </ul>
        )}
        {!loading && hasMore && (
          <button
            className="my-reports-load-more"
            type="button"
            onClick={() => loadPage(page + 1, true)}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </main>
      <Footer />
    </div>
  );
}
