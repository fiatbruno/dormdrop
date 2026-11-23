import { useEffect, useId, useRef } from "react";
import "./ExchangeDialog.css";

export default function ExchangeDialog({ title, badge, busy, onClose, children }) {
  const titleId = useId();
  const dialog = useRef(null);
  const heading = useRef(null);

  useEffect(() => {
    const trigger = document.activeElement;
    const node = dialog.current;
    node.showModal();
    return () => {
      node.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  useEffect(() => {
    heading.current.focus();
  }, [title]);

  return (
    <dialog
      ref={dialog}
      className="exchange-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      {badge && <span className="exchange-dialog__badge">{badge}</span>}
      <h2 ref={heading} id={titleId} tabIndex={-1}>{title}</h2>
      {children}
    </dialog>
  );
}
