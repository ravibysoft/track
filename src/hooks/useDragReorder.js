import { useCallback, useRef, useState } from "react";

/**
 * Drag a row to reorder a list, by pointer or by keyboard.
 *
 * Pointer events rather than HTML5 drag-and-drop, which does not exist on a
 * touch screen. The list reflows live under the finger: as the dragged row's
 * centre crosses a neighbour's band the array is rebuilt, and the row itself is
 * translated by however far the finger has moved *minus* the distance it has
 * already travelled by being re-slotted — so it stays under the finger instead
 * of jumping each time the order changes.
 *
 * Row heights are measured at drag start rather than assumed equal: a long
 * category name wraps to two lines, and a fixed row height would then mis-target
 * every row below it.
 *
 * `ids` is the current order. `onCommit(nextIds)` fires once, on release, and
 * only when the order actually changed.
 */
export default function useDragReorder(ids, onCommit) {
  const listRef = useRef(null);
  const geometry = useRef(null);
  const [drag, setDrag] = useState(null);

  /* What the caller should render: the live order while dragging, otherwise the
     real one. */
  const order = drag ? drag.order : ids;

  const finish = useCallback(
    (commit) => {
      setDrag((current) => {
        if (commit && current && current.order.join() !== ids.join()) onCommit(current.order);
        return null;
      });
      geometry.current = null;
    },
    [ids, onCommit],
  );

  const onPointerDown = useCallback(
    (id) => (event) => {
      // Ignore anything that is not a primary press — a right-click or a second
      // finger must not hijack a drag already in flight.
      if (event.button != null && event.button !== 0) return;
      const from = ids.indexOf(id);
      const host = listRef.current;
      if (from === -1 || !host) return;

      const rows = [...host.querySelectorAll("[data-drag-id]")];
      if (rows.length !== ids.length) return;

      geometry.current = {
        from,
        startY: event.clientY,
        rows: rows.map((node) => {
          const rect = node.getBoundingClientRect();
          return { top: rect.top, height: rect.height };
        }),
      };

      /* Capture keeps the moves coming if the finger slides off the grip, but it
         is only an optimisation — and it throws for a pointer the browser does
         not recognise. Letting that escape would abort the drag before it
         started, which is a silent dead handle rather than a visible error. */
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // Fine: the handlers are on the element either way.
      }

      event.preventDefault();
      setDrag({ id, order: ids, index: from, offset: 0 });
    },
    [ids],
  );

  const onPointerMove = useCallback(
    (event) => {
      const g = geometry.current;
      if (!g) return;

      const dy = event.clientY - g.startY;
      const centre = g.rows[g.from].top + g.rows[g.from].height / 2 + dy;

      // The first row whose bottom edge is still below the dragged centre.
      let index = g.rows.findIndex((r) => centre < r.top + r.height);
      if (index === -1) index = g.rows.length - 1;

      setDrag((current) => {
        if (!current) return current;
        // Rebuilt from the original order every time, never nudged from the last
        // one — incremental swaps drift once the pointer moves several rows.
        const next = ids.slice();
        next.splice(g.from, 1);
        next.splice(index, 0, current.id);
        return {
          ...current,
          index,
          order: next,
          offset: dy - (g.rows[index].top - g.rows[g.from].top),
        };
      });
    },
    [ids],
  );

  const onPointerUp = useCallback(() => finish(true), [finish]);
  const onPointerCancel = useCallback(() => finish(false), [finish]);

  /* A drag is pointer-only, so the same handle takes the arrow keys. Without
     this, reordering would simply be unavailable to anyone not using a finger
     or a mouse. */
  const onKeyDown = useCallback(
    (id) => (event) => {
      const delta = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
      if (!delta) return;
      const from = ids.indexOf(id);
      const to = from + delta;
      if (from === -1 || to < 0 || to >= ids.length) return;

      event.preventDefault();
      const next = ids.slice();
      next.splice(from, 1);
      next.splice(to, 0, id);
      onCommit(next);
    },
    [ids, onCommit],
  );

  /** Spread onto the row: marks it measurable and lifts it while it is dragged. */
  const rowProps = useCallback(
    (id) => ({
      "data-drag-id": id,
      className: drag?.id === id ? "is-dragging" : undefined,
      style:
        drag?.id === id
          ? { translate: `0 ${drag.offset}px`, zIndex: 2, position: "relative" }
          : undefined,
    }),
    [drag],
  );

  /** Spread onto the grip. */
  const handleProps = useCallback(
    (id) => ({
      onPointerDown: onPointerDown(id),
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onKeyDown: onKeyDown(id),
    }),
    [onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onKeyDown],
  );

  return { listRef, order, dragging: drag?.id ?? null, rowProps, handleProps };
}
