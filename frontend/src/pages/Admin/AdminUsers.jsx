
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

import AdminLayout from "../../components/AdminLayout/AdminLayout";
import { getAdminUsers } from "../../api/adminUsersApi";
import "./AdminUsers.css";

const PAGE_SIZE = 20;

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);

  const [result, setResult] = useState({
    items: [],
    total: 0,
    page: 0,
    totalPages: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(0);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;

    // Reset request feedback while loading the newly selected page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");

    getAdminUsers({
      search: query,
      page,
      size: PAGE_SIZE,
    })
      .then((data) => {
        if (active) {
          setResult(data);
        }
      })
      .catch((err) => {
        if (active) {
          setResult({
            items: [],
            total: 0,
            page: 0,
            totalPages: 0,
          });

          setError(
            err.response?.status === 403
              ? "Administrator access required."
              : err.response?.data?.message ||
                  err.message ||
                  "Could not load users."
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [query, page, reload]);

  const first = result.total
    ? result.page * PAGE_SIZE + 1
    : 0;

  const last = Math.min(
    result.total,
    (result.page + 1) * PAGE_SIZE
  );

  function activityLabel(user) {
    if (!user.lastActiveAt) return "No activity recorded";
    return user.active ? "Active" : "Inactive";
  }

  return (
    <AdminLayout
      breadcrumb="Users"
      search={search}
      onSearchChange={setSearch}
    >
      <div className="community-page">
        <div className="community-page-header">
          <div>
            <p className="community-eyebrow">Campus administration</p>
            <h1>Community members</h1>
            <p>Find registered members and see who has been active in the last 30 days.</p>
          </div>

          <button
            type="button"
            className="community-refresh-button"
            disabled={loading}
            onClick={() => setReload((n) => n + 1)}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {!loading && !error && Number.isFinite(result.activeCount) && (
          <div className="community-activity-summary">
            <span className="community-activity-summary__dot" aria-hidden="true" />
            <div><strong>{result.activeCount}</strong><span> active in the last 30 days</span></div>
          </div>
        )}
        <section className="community-directory">
          <div className="community-directory-header">
            <div><h2>Member directory</h2><p>Campus email addresses are masked to protect member privacy.</p></div>
            {!loading && !error && <span className="community-count">{result.total} {result.total === 1 ? "member" : "members"}</span>}
          </div>

          {error && (
            <p
              role="alert"
              className="community-state community-error"
            >
              {error}
            </p>
          )}

          {loading ? (
            <p className="community-state">
              Loading members...
            </p>
          ) : !error && result.items.length === 0 ? (
            <p className="community-state">
              No matching members.
            </p>
          ) : (
            !error && (
              <>
                <div className="community-table-scroll">
                  <table className="community-table">
                    <thead>
                      <tr>
                        <th>Member / User ID</th>
                        <th>Campus email</th>
                        <th>Verification</th>
                        <th>Activity</th>
                        <th>Role</th>
                      </tr>
                    </thead>

                    <tbody>
                      {result.items.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <div className="community-member-name">
                              <span>
                                {user.name ||
                                  "Name unavailable"}
                              </span>

                              <span className="community-member-id">
                                {" "}· {user.id}
                              </span>
                            </div>
                          </td>

                          <td>
                            {user.maskedEmail ||
                              "Not available"}
                          </td>

                          <td>
                            {user.emailVerified
                              ? "Verified"
                              : "Pending"}
                          </td>

                          <td>
                            <span className={`community-activity ${user.lastActiveAt ? (user.active ? "is-active" : "is-inactive") : "is-unknown"}`}>
                              {activityLabel(user)}
                            </span>
                            {user.lastActiveAt && (
                              <span className="community-last-active">Last active {new Date(user.lastActiveAt).toLocaleDateString()}</span>
                            )}
                          </td>

                          <td>
                            {user.role || "—"}
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="community-pagination">
                  <p>
                    {first}–{last} of {result.total} members
                  </p>

                  <div className="community-pagination-controls">
                    <button
                      type="button"
                      disabled={page === 0}
                      onClick={() =>
                        setPage((p) =>
                          Math.max(0, p - 1)
                        )
                      }
                    >
                      <ChevronLeft size={14} />
                      Previous
                    </button>

                    <span>
                      Page {result.page + 1} of{" "}
                      {Math.max(1, result.totalPages)}
                    </span>

                    <button
                      type="button"
                      disabled={
                        page + 1 >= result.totalPages
                      }
                      onClick={() =>
                        setPage((p) => p + 1)
                      }
                    >
                      Next
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
