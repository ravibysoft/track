import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function Snackbar({
  message,
  actionLabel,
  onAction,
  onDismiss,
  duration = 5000,
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [onDismiss, duration, message]);

  return createPortal(
    <div className="snackbar" role="status">
      <span className="grow">{message}</span>
      {actionLabel && (
        <button
          type="button"
          className="snackbar__action"
          onClick={() => {
            onAction?.();
            onDismiss();
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>,
    document.body,
  );
}
