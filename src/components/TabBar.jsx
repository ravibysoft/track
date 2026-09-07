import Icon from "./Icon.jsx";

const TABS = [
  { id: "trans", label: "Trans.", icon: "history" },
  { id: "stats", label: "Stats", icon: "stats" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export default function TabBar({ active, onChange }) {
  return (
    <nav
      className="tabbar"
      style={{
        "--tab-index": TABS.findIndex((t) => t.id === active),
        "--tab-count": TABS.length,
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
    </nav>
  );
}
