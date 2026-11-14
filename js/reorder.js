// Drag-to-reorder for a list of cards, with mouse, pen and touch.
// Mouse: press and drag. Touch: press and hold, then drag, so ordinary swipes still scroll.
// Neighbours slide out of the way as the card passes them; the new order is reported on drop.

const HOLD_MS = 380, SLOP = 8, EDGE = 90;
let active = null;

/** True while a card is being dragged, so callers can hold off re-rendering. */
export const isDragging = () => !!active;

// Stops the page scrolling under a touch drag. It must be registered up front and non-passive.
document.addEventListener('touchmove', e => { if (active?.started) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', e => { if (active) e.preventDefault(); });

/**
 * @param list     stable container to listen on (it may be re-rendered inside)
 * @param item     selector for a card; each needs data-id
 * @param handle   optional selector inside a card that starts a drag (default: the whole card)
 * @param onDrop   called with the new array of ids
 */
export function sortable(list, { item, handle, onDrop }) {
  list.addEventListener('pointerdown', e => {
    if (active || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = e.target.closest(item);
    if (!el || !list.contains(el) || (handle && !e.target.closest(handle))) return;
    if (e.target.closest('button, a, input, select')) return;
    begin(e, el, el.parentElement, item, onDrop);
  });
}

function begin(e, el, list, item, onDrop) {
  const a = active = {
    el, list, item, onDrop, id: e.pointerId, touch: e.pointerType !== 'mouse',
    x: e.pageX, y: e.pageY, px: e.pageX, py: e.pageY, started: false, timer: 0, raf: 0,
    order: ids(list, item),
  };
  if (a.touch) a.timer = setTimeout(() => start(a), HOLD_MS);

  const move = ev => {
    if (ev.pointerId !== a.id) return;
    a.px = ev.pageX; a.py = ev.pageY;
    const far = Math.hypot(a.px - a.x, a.py - a.y) > SLOP;
    if (!a.started) {
      if (!far) return;
      if (a.touch) return end(false); // moved before the hold finished: it's a scroll
      start(a);
    }
    ev.preventDefault();
    follow(a);
  };
  const up = ev => { if (ev.pointerId === a.id) end(a.started); };
  const key = ev => { if (ev.key === 'Escape') end(false, true); };

  function end(commit, cancel = false) {
    clearTimeout(a.timer);
    cancelAnimationFrame(a.raf);
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', up);
    removeEventListener('keydown', key);
    if (a.started) {
      if (cancel) restore(a);
      settle(a);
      const now = ids(list, item);
      if (commit && !cancel && now.join() !== a.order.join()) onDrop(now);
    }
    active = null;
  }

  addEventListener('pointermove', move, { passive: false });
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
  addEventListener('keydown', key);
}

function start(a) {
  a.started = true;
  const r = a.el.getBoundingClientRect();
  a.home = { x: r.left + scrollX, y: r.top + scrollY }; // where the card sat when picked up
  a.el.classList.add('dragging');
  a.list.classList.add('sorting');
  navigator.vibrate?.(10);
  follow(a);
  autoscroll(a);
}

// Keep the card under the finger, and move it in the list when it passes over a neighbour.
function follow(a) {
  const { el } = a;
  const over = hit(a);
  if (over) {
    const sibs = [...a.list.querySelectorAll(a.item)];
    const before = sibs.map(s => s.getBoundingClientRect());
    const after = sibs.indexOf(over) > sibs.indexOf(el);
    a.list.insertBefore(el, after ? over.nextSibling : over);
    sibs.forEach((s, i) => {
      if (s === el) return;
      const r = s.getBoundingClientRect(), dx = before[i].left - r.left, dy = before[i].top - r.top;
      if (dx || dy) s.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 180, easing: 'cubic-bezier(.2,.7,.2,1)' });
    });
  }
  // Its untransformed spot in the layout, which may have just changed.
  el.style.transform = 'none';
  const r = el.getBoundingClientRect();
  const dx = a.home.x + (a.px - a.x) - (r.left + scrollX), dy = a.home.y + (a.py - a.y) - (r.top + scrollY);
  el.style.transform = `translate(${dx}px,${dy}px) scale(1.03)`;
}

// The card under the pointer, skipping the one being dragged and cards still sliding.
function hit(a) {
  const cx = a.px - scrollX, cy = a.py - scrollY;
  for (const s of a.list.querySelectorAll(a.item)) {
    if (s === a.el || s.getAnimations().length) continue;
    const r = s.getBoundingClientRect();
    // Require the pointer to be well inside, so the card doesn't flip back and forth on an edge.
    const ix = Math.min(r.width * 0.2, 24), iy = Math.min(r.height * 0.2, 40);
    if (cx > r.left + ix && cx < r.right - ix && cy > r.top + iy && cy < r.bottom - iy) return s;
  }
  return null;
}

// Scroll the page while the card is held near the top or bottom edge.
function autoscroll(a) {
  const step = () => {
    if (active !== a) return;
    const cy = a.py - scrollY, h = innerHeight;
    const v = cy < EDGE ? -(EDGE - cy) / 6 : cy > h - EDGE - 70 ? (cy - (h - EDGE - 70)) / 6 : 0;
    if (v) {
      const was = scrollY;
      scrollBy(0, v);
      a.py += scrollY - was; // the finger stays put on screen, so it moves down the page
      follow(a);
    }
    a.raf = requestAnimationFrame(step);
  };
  a.raf = requestAnimationFrame(step);
}

function restore(a) {
  for (const id of a.order) a.list.appendChild(a.list.querySelector(`${a.item}[data-id="${id}"]`));
}

// Glide the card from where it was let go into its slot.
function settle(a) {
  const { el } = a, from = el.style.transform;
  el.style.transform = '';
  el.classList.remove('dragging');
  a.list.classList.remove('sorting');
  el.animate([{ transform: from }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.7,.2,1)' });
}

const ids = (list, item) => [...list.querySelectorAll(item)].map(s => s.dataset.id);

/** Sorts items by a saved order of ids; anything not in it keeps its place at the end. */
export function arrange(items, saved, key = x => x.id) {
  if (!saved?.length) return items;
  const rank = new Map(saved.map((id, i) => [id, i]));
  return [...items].sort((p, q) => (rank.get(key(p)) ?? 1e9) - (rank.get(key(q)) ?? 1e9));
}
