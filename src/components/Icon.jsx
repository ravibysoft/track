/**
 * Every icon in the app, as one 24×24 stroked set so weights stay consistent.
 * Category ids double as icon names, so <Icon name={expense.categoryId} /> works.
 */
const PATHS = {
  /* Categories */
  food: "M3 11h18v1a7 7 0 0 1-7 7h-4a7 7 0 0 1-7-7zM8 7V4M12 7V3M16 7V4",
  groceries:
    "M2 4h2.6l2.6 11h10.2l2.6-8H6.4M9 20h.01M17 20h.01",
  travel:
    "M5 4h14a1 1 0 0 1 1 1v11H4V5a1 1 0 0 1 1-1zM4 11h16M8 20h.01M16 20h.01M4 16v2M20 16v2",
  bills: "M6 2h12v20l-3-2-3 2-3-2-3 2zM9.5 7h5M9.5 11h5M9.5 15h3",
  shopping: "M5.5 8h13l1 13H4.5zM9 8V6a3 3 0 0 1 6 0v2",
  health:
    "M20.8 5.6a5.4 5.4 0 0 0-7.7 0L12 6.7l-1.1-1.1a5.4 5.4 0 1 0-7.7 7.7L12 21.2l8.8-8.9a5.4 5.4 0 0 0 0-7.7z",
  entertainment: "M3 5h18v14H3zM8 5v14M16 5v14M3 9.5h5M3 14.5h5M16 9.5h5M16 14.5h5",
  other: "M3 7.5l9-4.5 9 4.5v9l-9 4.5-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9",

  /* Navigation */
  home: "M3 9.6 12 3l9 6.6V20a1 1 0 0 1-1 1h-5v-6.5H9V21H4a1 1 0 0 1-1-1z",
  history: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  stats: "M18 20V9M12 20V4M6 20v-7",
  settings:
    "M4 21v-6M4 11V3M12 21v-9M12 8V3M20 21v-4M20 13V3M1.5 15h5M9.5 8h5M17.5 17h5",

  /* Actions */
  plus: "M12 5v14M5 12h14",
  close: "M18 6 6 18M6 6l12 12",
  trash: "M3.5 6h17M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M18.5 6l-1 14a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1L5.5 6",
  edit: "M12 20h9M16.6 3.6a2.1 2.1 0 0 1 3 3L7.5 18.7 3.5 20l1.3-4z",
  search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20.5 20.5 16 16",
  check: "M20 6.5 9 17.5l-5-5",
  left: "M15 18.5 8.5 12 15 5.5",
  right: "M9 5.5 15.5 12 9 18.5",
  down: "M6 9.5 12 15.5l6-6",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7.5 10.5 12 15l4.5-4.5M12 15V3",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M16.5 7.5 12 3 7.5 7.5M12 3v12",
  share: "M18 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1",
  calendar: "M4 5h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM16 3v4M8 3v4M3 10h18",
  wallet:
    "M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v1.5M3 7.5v10A2.5 2.5 0 0 0 5.5 20H19a1 1 0 0 0 1-1v-3M3 7.5h16a1 1 0 0 1 1 1V16m0 0h-3.5a2.25 2.25 0 0 1 0-4.5H20",
  alert: "M12 8.5v4.5M12 16.5h.01M12 3 2.5 20h19z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1.5v2M12 20.5v2M3.9 3.9l1.5 1.5M18.6 18.6l1.5 1.5M1.5 12h2M20.5 12h2M3.9 20.1l1.5-1.5M18.6 5.4l1.5-1.5",
  moon: "M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8z",
  contrast: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 3v18",
  filter: "M3 5h18l-7 8v6l-4 2v-8z",
  target: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 16.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zM12 13.2a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4z",
  undo: "M3 8h11a6 6 0 0 1 0 12H8M3 8l4-4M3 8l4 4",
};

export default function Icon({ name, size, className, style }) {
  const d = PATHS[name] ?? PATHS.other;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size, ...style } : style}
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}
