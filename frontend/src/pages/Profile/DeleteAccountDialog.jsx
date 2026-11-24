import { useEffect, useRef, useState } from "react";
import Button from "../../components/Button/Button";
import { deleteMyAccount } from "../../api/profileApi";

export default function DeleteAccountDialog({ onClose, onDeleted }) {
  const dialog = useRef(null);
  const submitting = useRef(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (confirmation !== "DELETE" || submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      await deleteMyAccount(confirmation);
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete your account. Please try again.");
      submitting.current = false;
      setPending(false);
      return;
    }
    onDeleted();
  }

  return (
    <dialog
      ref={dialog}
      className="profile-visibility-dialog profile-delete-dialog"
      aria-labelledby="delete-account-title"
      onCancel={(event) => { event.preventDefault(); if (!submitting.current) onClose(); }}
    >
      <form className="profile-visibility-content" onSubmit={submit}>
        <h2 id="delete-account-title">Delete your account?</h2>
        <div className="profile-visibility-info profile-delete-warning">
          <strong>This action is permanent</strong>
          <p>Your profile and listings will be removed. Account deletion cannot be undone.</p>
        </div>
        <p>To confirm, enter DELETE below. Contact support if you need help with an active exchange.</p>
        <label className="profile-delete-label">
          Type DELETE to confirm
          <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off" spellCheck={false} disabled={pending} />
        </label>
        {error && <p role="alert" className="profile-visibility-error">{error}</p>}
        <div className="profile-visibility-actions">
          <Button type="button" disabled={pending} onClick={onClose}>Cancel</Button>
          <Button type="submit" className="profile-delete-submit" disabled={pending || confirmation !== "DELETE"}>
            {pending ? "Deleting..." : "Permanently delete"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}