import Icon from "./Icon.jsx";

export default function EmptyState({ icon = "wallet", title, text, action }) {
  return (
    <div className="empty">
      <span className="empty__art">
        <Icon name={icon} />
      </span>
      <span className="empty__title">{title}</span>
      {text && <p className="empty__text">{text}</p>}
      {action}
    </div>
  );
}
