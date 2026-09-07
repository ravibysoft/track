import Icon from "./Icon.jsx";

const TABS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "trans", label: "Trans.", icon: "calendar_grid" },
  { id: "stats", label: "Stats", icon: "stats" },
  { id: "backup", label: "Backup", icon: "download" },
];

/**
 * Four destinations plus a raised Add button in the fifth slot.
 *
 * Add sits in the bar rather than floating over the list, so it never covers a
 * row's amount the way the old floating button did.
 */
export default function TabBar({ active, onChange, onAdd }) {
  return (
    <nav
      className="tabbar"
      style={{
        "--tab-index": Math.max(0, TABS.findIndex((t) => t.id === active)),
        "--tab-count": TABS.length + 1,
      }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tabbar__btn${active === tab.id ? " is-active" : ""}`}
          onClick={() => onChange(tab.id)}
          aria-current={active === tab.id ? "page" : undefined}
        >
          <Icon name={tab.icon} />
          <span>{tab.label}</span>
        </button>
      ))}

      <button type="button" className="tabbar__add" onClick={onAdd} aria-label="Add an entry">
        <span className="tabbar__addCircle">
          <Icon name="plus" />
        </span>
        <span>Add</span>
      </button>
    </nav>
  );
}
