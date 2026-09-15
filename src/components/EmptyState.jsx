import EmptyArt from "./EmptyArt.jsx";

/**
 * What a screen shows when it has nothing to show.
 *
 * `action` is the point of it: an empty screen that only explains itself leaves
 * you to find your own way out, so where there is an obvious next step it is
 * offered right here.
 */
export default function EmptyState({ art = "ledger", currency, title, text, action }) {
  return (
    <div className="empty">
      <EmptyArt name={art} currency={currency} />
      <span className="empty__title">{title}</span>
      {text && <p className="empty__text">{text}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}
