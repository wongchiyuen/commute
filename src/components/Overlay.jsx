// ── Drawer ────────────────────────────────────────────────
export function Drawer({ open, title, children, onClose }) {
  return (
    <div className={`overlay${open ? ' open' : ''}`} onClick={e => { if (e.target.classList.contains('overlay')) onClose(); }}>
      <div className="drawer">
        <div className="drawer-handle" />
        <div className="drawer-title">
          <span>{title}</span>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────
export function Toast({ msg, visible }) {
  return (
    <div className={`toast${visible ? ' show' : ''}`}>{msg}</div>
  );
}

// ── Spinner ───────────────────────────────────────────────
export function Spinner() {
  return <div className="spinner" />;
}
