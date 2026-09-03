import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon.jsx";

/**
 * Bottom sheet. Render it conditionally (`{open && <Sheet …/>}`); it plays its own
 * slide-out before calling `onClose`, so the parent stays a plain boolean.
 *
 * `children` and `footer` may be nodes or render functions receiving `{ close }`,
 * letting a Save button trigger the same animated dismissal as the backdrop.
 */
export default function Sheet({ title, onClose, children, footer, headerRight }) {
  const [closing, setClosing] = useState(false);

  /* close() only flips a flag; the slide-out is timed by the effect below, which
     cleans its own timer up on unmount. Calling close() twice is harmless. */
  const close = useCallback(() => setClosing(true), []);

  useEffect(() => {
    if (!closing) return undefined;
    const timer = setTimeout(onClose, 190);
    return () => clearTimeout(timer);
  }, [closing, onClose]);

  /* Stop the page behind the sheet from scrolling with it. */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const render = (slot) => (typeof slot === "function" ? slot({ close }) : slot);

  return createPortal(
    <>
      <div className="backdrop" onClick={close} />
      <div
        className={`sheet${closing ? " is-closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sheet__grip" />
        <div className="sheet__head">
          <span className="sheet__title">{title}</span>
          <div className="hstack" style={{ gap: "var(--sp-2)" }}>
            {headerRight}
            <button type="button" className="icon-btn" onClick={close} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div className="sheet__body">{render(children)}</div>
        {footer && <div className="sheet__foot">{render(footer)}</div>}
      </div>
    </>,
    document.body,
  );
}
