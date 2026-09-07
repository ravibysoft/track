import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Briefcase,
  Bus,
  Calendar,
  CalendarDays,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Contrast,
  Delete,
  Download,
  Equal,
  Gift,
  HeartPulse,
  House,
  Laptop,
  List,
  Moon,
  Package,
  Pencil,
  Percent,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Share2,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sun,
  Target,
  TrendingUp,
  Trash2,
  TriangleAlert,
  Upload,
  Utensils,
  Wallet,
  X,
} from "lucide-react";

/**
 * Every icon in the app, mapped onto Lucide.
 *
 * These replaced a hand-drawn set that read as emoji rather than iconography —
 * the paths were mine, and their weights and shapes never quite agreed with one
 * another. Lucide is one professionally drawn family on a shared 24px grid, so
 * the whole app is consistent for the first time.
 *
 * Category ids double as icon names, so <Icon name={entry.categoryId} /> works.
 */
const ICONS = {
  /* Expense categories */
  food: Utensils,
  groceries: ShoppingCart,
  travel: Bus,
  bills: ReceiptText,
  shopping: ShoppingBag,
  health: HeartPulse,
  entertainment: Clapperboard,
  other: Package,

  /* Income categories */
  salary: Banknote,
  business: Briefcase,
  freelance: Laptop,
  gift: Gift,
  interest: TrendingUp,
  refund: RotateCcw,
  "other-income": Percent,

  /* Navigation */
  home: House,
  history: List,
  stats: ChartColumn,
  settings: SlidersHorizontal,

  /* Money direction — the diagonal arrows from the design */
  "arrow-in": ArrowDownLeft,
  "arrow-out": ArrowUpRight,

  /* Actions */
  plus: Plus,
  close: X,
  trash: Trash2,
  edit: Pencil,
  search: Search,
  check: Check,
  left: ChevronLeft,
  right: ChevronRight,
  down: ChevronDown,
  download: Download,
  upload: Upload,
  share: Share2,
  calendar: Calendar,
  calendar_grid: CalendarDays,
  wallet: Wallet,
  alert: TriangleAlert,
  sun: Sun,
  moon: Moon,
  contrast: Contrast,
  target: Target,
  undo: RotateCcw,
  backspace: Delete,
  equals: Equal,
};

export default function Icon({ name, size, className, style }) {
  const Glyph = ICONS[name] ?? Package;
  return (
    <Glyph
      className={className}
      style={size ? { width: size, height: size, ...style } : style}
      strokeWidth={1.9}
      aria-hidden="true"
      focusable="false"
    />
  );
}
