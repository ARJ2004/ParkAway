import { Button, EmptyState, InlineBanner, Modal, StatusBadge, Table, TextField } from "@parkaway/ui-web";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { adminLogout } from "../api/auth";
import { restoreUser, searchUsers, type AdminUserSearchResult } from "../api/users";
import { clearSession, getRefreshToken, getRole } from "../session";
import { suspendUser } from "../api/users";
import styles from "./UserSearchScreen.module.css";

export function UserSearchScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getRole();

  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [selected, setSelected] = useState<AdminUserSearchResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["admin-users", submittedQuery],
    queryFn: () => searchUsers(submittedQuery),
    enabled: submittedQuery.length > 0,
  });

  const suspendMutation = useMutation({
    mutationFn: () => suspendUser(selected!.id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setSelected((prev) => (prev ? { ...prev, status: "suspended" } : prev));
      setModalOpen(false);
      setReason("");
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : "Could not suspend this user."),
  });

  const restoreMutation = useMutation({
    mutationFn: () => restoreUser(selected!.id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setSelected((prev) => (prev ? { ...prev, status: "active" } : prev));
      setModalOpen(false);
      setReason("");
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : "Could not restore this user."),
  });

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmittedQuery(query.trim());
    setSelected(null);
  }

  function handleLogout() {
    // Revoke server-side first so a leaked refresh token can't outlive this
    // session — clearing local storage alone (the previous behavior) never
    // actually invalidated it. Best-effort: the local session clears either
    // way, since the user's intent to log out shouldn't hang on network state.
    const refreshToken = getRefreshToken();
    clearSession();
    if (refreshToken) {
      adminLogout(refreshToken).catch(() => {});
    }
    navigate("/", { replace: true });
  }

  function openActionModal() {
    setReason("");
    setActionError(null);
    setModalOpen(true);
  }

  const isSuspendFlow = selected?.status === "active";
  const pendingAction = isSuspendFlow ? suspendMutation : restoreMutation;

  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <span className={styles.brand}>ParkAway Admin</span>
        {role && <span className={styles.roleTag}>{role.replace("_", " ")}</span>}
        <button className={styles.logout} onClick={handleLogout}>
          Log out
        </button>
      </nav>

      <div className={styles.content}>
        <div className={styles.main}>
          <form className={styles.searchBar} onSubmit={handleSearchSubmit}>
            <div className={styles.searchInput}>
              <TextField
                placeholder="Search by phone, user ID, vehicle, or email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" loading={isFetching}>
              Search
            </Button>
          </form>

          {submittedQuery && data && data.users.length === 0 && (
            <EmptyState title="No user found" description={`Nothing matched "${submittedQuery}".`} />
          )}

          {data && data.users.length > 0 && (
            <Table
              columns={[
                { key: "phone", header: "Phone", render: (u) => u.phone },
                { key: "name", header: "Name", render: (u) => u.name ?? "—" },
                { key: "email", header: "Email", render: (u) => u.email ?? "—" },
                { key: "status", header: "Status", render: (u) => <StatusBadge status={u.status} /> },
              ]}
              rows={data.users}
              rowKey={(u) => u.id}
              onRowClick={setSelected}
            />
          )}
        </div>

        {selected && (
          <div className={styles.panel}>
            <div className={styles.panelField}>
              <span className={styles.panelLabel}>Phone</span>
              <span className={styles.panelValue}>{selected.phone}</span>
            </div>
            <div className={styles.panelField}>
              <span className={styles.panelLabel}>Name</span>
              <span className={styles.panelValue}>{selected.name ?? "—"}</span>
            </div>
            <div className={styles.panelField}>
              <span className={styles.panelLabel}>Email</span>
              <span className={styles.panelValue}>{selected.email ?? "—"}</span>
            </div>
            <div className={styles.panelField}>
              <span className={styles.panelLabel}>Status</span>
              <StatusBadge status={selected.status} />
            </div>
            <Button variant={isSuspendFlow ? "danger" : "secondary"} onClick={openActionModal}>
              {isSuspendFlow ? "Suspend user" : "Restore user"}
            </Button>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={isSuspendFlow ? "Suspend user" : "Restore user"}
        onClose={() => setModalOpen(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={isSuspendFlow ? "danger" : "primary"}
              onClick={() => pendingAction.mutate()}
              loading={pendingAction.isPending}
              disabled={!reason.trim()}
            >
              Confirm
            </Button>
          </>
        }
      >
        {actionError && <InlineBanner variant="danger">{actionError}</InlineBanner>}
        <TextField
          label="Reason (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Reported fraudulent activity"
          autoFocus
        />
      </Modal>
    </div>
  );
}
