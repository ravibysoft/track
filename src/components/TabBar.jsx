import Icon from "./Icon.jsx";

const TABS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "history", label: "History", icon: "history" },
  { id: "stats", label: "Stats", icon: "stats" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export default function TabBar({ active, onChange }) {
  return (
    <nav className="tabbar">
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
