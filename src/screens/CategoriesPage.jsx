import { useCallback, useEffect, useMemo, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Icon from "../components/Icon.jsx";
import Sheet from "../components/Sheet.jsx";
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  isBuiltIn,
  newCategoryId,
} from "../lib/categories.js";
import { formatMoney, parseAmount } from "../lib/money.js";
import { useExpenses } from "../state/useExpenses.js";

const KINDS = [
  { id: "expense", label: "Spending" },
  { id: "income", label: "Income" },
];

/**
 * Manage the category list: rename, recolour, reorder, hide, add, delete.
 *
 * Two rules shape the whole screen. A built-in can be hidden but never deleted,
 * because entries recorded against it still exist and would lose their meaning.
 * A custom category can be deleted, but only once nothing points at it — the
 * screen counts the entries first and offers to hide it instead.
 */
export default function CategoriesPage({ onClose, onToast }) {
  const { categories, currency, expenses, saveSettings } = useExpenses();

  const [kind, setKind] = useState("expense");
  const [editing, setEditing] = useState(null); // null | category | { isNew: true }
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => setClosing(true), []);
  useEffect(() => {
    if (!closing) return undefined;
    const timer = setTimeout(onClose, 200);
    return () => clearTimeout(timer);
  }, [closing, onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  /** How many entries point at each category, so nothing is deleted blindly. */
  const usage = useMemo(() => {
    const map = new Map();
    for (const e of expenses) map.set(e.categoryId, (map.get(e.categoryId) ?? 0) + 1);
    return map;
  }, [expenses]);

  const shown = categories.filter((c) => c.kind === kind);

  const commit = (next) => saveSettings({ categories: next });

  /* Reordering moves a category past its neighbour *of the same kind*: the two
     kinds share one list, so stepping one index at a time would walk a spending
     category into the income block. */
  const move = (id, delta) => {
    const order = shown.map((c) => c.id);
    const at = order.indexOf(id);
    const to = at + delta;
    if (at === -1 || to < 0 || to >= order.length) return;
    [order[at], order[to]] = [order[to], order[at]];

    let n = 0;
    commit(categories.map((c) => (c.kind === kind ? shown.find((x) => x.id === order[n++]) : c)));
  };

  const toggleHidden = (category) => {
    commit(
      categories.map((c) => (c.id === category.id ? { ...c, hidden: !c.hidden } : c)),
    );
    onToast?.(category.hidden ? `${category.label} is back` : `${category.label} hidden`);
  };

  const save = (draft) => {
    const exists = categories.some((c) => c.id === draft.id);
    commit(exists ? categories.map((c) => (c.id === draft.id ? draft : c)) : [...categories, draft]);
    onToast?.(exists ? "Category updated" : `${draft.label} added`);
    setEditing(null);
  };

  const remove = (category) => {
    commit(categories.filter((c) => c.id !== category.id));
    onToast?.(`${category.label} deleted`);
    setConfirmDelete(null);
    setEditing(null);
  };

  return (
    <div
      className={`page${closing ? " is-closing" : ""}`}
      role="dialog"
      aria-label="Categories"
    >
      <header className="page__bar">
        <button type="button" className="icon-btn" onClick={close} aria-label="Back">
          <Icon name="left" />
        </button>
        <h1 className="page__title">Categories</h1>
      </header>

      <div className="page__body">
        <div
          className="seg"
          style={{ "--seg-index": KINDS.findIndex((k) => k.id === kind), "--seg-count": KINDS.length }}
        >
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={`seg__btn${kind === k.id ? " is-active" : ""}`}
              onClick={() => setKind(k.id)}
              aria-pressed={kind === k.id}
            >
              {k.label}
            </button>
          ))}
        </div>

        <p className="hint">
          Hidden categories stay off the picker, but entries already filed under them
          keep their name and colour.
        </p>

        <div className="card card--flat setting-list">
          {shown.map((category, i) => {
            const count = usage.get(category.id) ?? 0;
            return (
              <div key={category.id} className={`cat-row${category.hidden ? " is-hidden" : ""}`}>
                {i > 0 && <div className="list__sep" />}

                <span className="cat cat--sm" style={{ "--cat-color": category.color }}>
                  <Icon name={category.icon} />
                </span>

                <button
                  type="button"
                  className="grow cat-row__main"
                  onClick={() => setEditing(category)}
                >
                  <span className="cat-row__label">{category.label}</span>
                  <span className="cat-row__meta">
                    {category.hidden ? "Hidden · " : ""}
                    {count === 0 ? "No entries" : `${count} ${count === 1 ? "entry" : "entries"}`}
                    {category.budget > 0 && ` · ${formatMoney(category.budget, currency)}/mo`}
                  </span>
                </button>

                <span className="cat-row__tools">
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm"
                    onClick={() => move(category.id, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${category.label} up`}
                  >
                    <Icon name="left" size={16} style={{ rotate: "90deg" }} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm"
                    onClick={() => move(category.id, 1)}
                    disabled={i === shown.length - 1}
                    aria-label={`Move ${category.label} down`}
                  >
                    <Icon name="right" size={16} style={{ rotate: "90deg" }} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="btn btn--ghost btn--lg btn--block"
          onClick={() => setEditing({ isNew: true })}
        >
          <Icon name="plus" size={17} />
          New {kind === "income" ? "income" : "spending"} category
        </button>
      </div>

      {editing && (
        <CategoryEditor
          key={editing.id ?? "new"}
          category={editing.isNew ? null : editing}
          kind={kind}
          currency={currency}
          usedBy={editing.id ? (usage.get(editing.id) ?? 0) : 0}
          onSave={save}
          onToggleHidden={toggleHidden}
          onDelete={(c) => setConfirmDelete(c)}
          onClose={() => setEditing(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${confirmDelete.label}?`}
          message={
            (usage.get(confirmDelete.id) ?? 0) > 0
              ? `${usage.get(confirmDelete.id)} entries are filed under it. Nothing is deleted with it — but they lose this name and show as Other from then on. Hiding it keeps the name and is usually what you want.`
              : "Nothing is filed under it, so this removes it cleanly."
          }
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => remove(confirmDelete)}
        />
      )}
    </div>
  );
}

function CategoryEditor({ category, kind, currency, usedBy, onSave, onToggleHidden, onDelete, onClose }) {
  const [label, setLabel] = useState(category?.label ?? "");
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(category?.icon ?? "other");
  const [budgetText, setBudgetText] = useState(
    category?.budget > 0 ? String(category.budget) : "",
  );

  const isExpense = (category?.kind ?? kind) === "expense";

  const name = label.trim();
  const valid = name.length > 0;
  const builtIn = category ? isBuiltIn(category.id) : false;

  return (
    <Sheet
      title={category ? "Edit category" : "New category"}
      onClose={onClose}
      footer={({ close }) => (
        <button
          type="button"
          className="btn btn--primary btn--lg btn--block"
          disabled={!valid}
          onClick={() => {
            onSave({
              id: category?.id ?? newCategoryId(name),
              label: name,
              color,
              icon,
              kind: category?.kind ?? kind,
              hidden: category?.hidden ?? false,
              budget: isExpense ? (parseAmount(budgetText) ?? 0) : 0,
            });
            close();
          }}
        >
          {category ? "Save changes" : "Add category"}
        </button>
      )}
    >
      <label className="field">
        <span className="field__label">Name</span>
        <input
          className="input"
          type="text"
          value={label}
          maxLength={24}
          autoFocus
          placeholder="Rent, School fees, Petrol…"
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>

      <div className="field">
        <span className="field__label">Colour</span>
        <div className="swatches">
          {CATEGORY_COLORS.map((c, i) => (
            <button
              key={c}
              type="button"
              className={`swatch${color === c ? " is-active" : ""}`}
              style={{ "--cat-color": c }}
              onClick={() => setColor(c)}
              aria-label={`Colour ${i + 1}`}
              aria-pressed={color === c}
            />
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label">Icon</span>
        <div className="icon-grid">
          {CATEGORY_ICONS.map((glyph) => (
            <button
              key={glyph}
              type="button"
              className={`icon-choice${icon === glyph ? " is-active" : ""}`}
              style={{ "--cat-color": color }}
              onClick={() => setIcon(glyph)}
              aria-label={glyph}
              aria-pressed={icon === glyph}
            >
              <Icon name={glyph} size={19} />
            </button>
          ))}
        </div>
      </div>

      {/* Only spending has a limit worth setting. A cap on income would be a
          target, which is a different idea and not one this app makes. */}
      {isExpense && (
        <label className="field">
          <span className="field__label">Monthly limit ({currency}) — optional</span>
          <input
            className="input num"
            type="text"
            inputMode="decimal"
            placeholder={`No limit${category?.budget ? "" : " — e.g. 4000"}`}
            value={budgetText}
            maxLength={10}
            onChange={(e) => setBudgetText(e.target.value.replace(/[^0-9.]/g, ""))}
          />
          <span className="field__hint">
            Its own bar on the Total tab, alongside the month's overall budget.
          </span>
        </label>
      )}

      {category && (
        <div className="stack">
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={() => {
              onToggleHidden(category);
              onClose();
            }}
          >
            {category.hidden ? "Show in the picker again" : "Hide from the picker"}
          </button>

          {/* A built-in has no delete: entries filed under it, going back years,
              would be left pointing at something the app no longer knows. */}
          {!builtIn && (
            <button
              type="button"
              className="btn btn--danger btn--block"
              onClick={() => onDelete(category)}
            >
              <Icon name="trash" size={16} />
              Delete{usedBy > 0 ? ` (${usedBy} entries use it)` : ""}
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
