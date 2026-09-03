import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return createPortal(
    <>
      <div className="backdrop" style={{ zIndex: 50 }} onClick={onCancel} />
      <div className="dialog-wrap">
        <div className="dialog" role="alertdialog" aria-modal="true" aria-label={title}>
          <h2 className="dialog__title">{title}</h2>
          {message && <p className="dialog__text">{message}</p>}
          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost grow" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`btn grow ${danger ? "btn--danger" : "btn--primary"}`}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
