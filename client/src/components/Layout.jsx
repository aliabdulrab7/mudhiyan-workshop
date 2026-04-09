import { NavLink } from "react-router-dom";

const nav = [
  { to: "/", icon: "◈", label: "الطلبات" },
  { to: "/new", icon: "✦", label: "صيانة جديدة" },
  { to: "/scan", icon: "⌖", label: "مسح" },
];

export default function Layout({ children }) {
  return (
    <div
      className="main-layout"
      style={{ display: "flex", height: "100%", minHeight: "100vh" }}
    >
      {/* Sidebar — desktop only (hidden on mobile via CSS) */}
      <aside
        className="sidebar"
        style={{
          width: "220px",
          minWidth: "220px",
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--gold-border)",
          display: "flex",
          flexDirection: "column",
          padding: "0",
        }}
      >
        <div style={{ padding: "28px 20px 20px" }}>
          <div
            style={{
              fontFamily: "Almarai, sans-serif",
              fontWeight: 800,
              fontSize: "1.15rem",
              color: "var(--gold)",
              letterSpacing: "0.02em",
              lineHeight: 1.3,
            }}
          >
            مصنع المضيان
          </div>
          <div
            style={{
              color: "var(--text-muted)",
              fontSize: "0.72rem",
              marginTop: "3px",
            }}
          >
            إدارة صيانة المجوهرات
          </div>
        </div>

        <div className="gold-line" style={{ margin: "0 16px" }} />

        <nav style={{ padding: "12px 10px", flex: 1 }}>
          {nav.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "8px",
                marginBottom: "4px",
                color: isActive ? "var(--gold)" : "var(--text-secondary)",
                background: isActive ? "rgba(201,168,76,0.08)" : "transparent",
                borderRight: isActive
                  ? "2px solid var(--gold)"
                  : "2px solid transparent",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: isActive ? 700 : 400,
                transition: "all 0.15s",
              })}
            >
              <span style={{ fontSize: "1rem", opacity: 0.8 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--gold-border)",
          }}
        >
          <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>
            يتطلب Chrome أو Edge
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>
            للطباعة والمسح
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{ flex: 1, overflow: "auto", background: "var(--bg-primary)" }}
      >
        {children}
      </main>

      {/* Bottom tab bar — mobile only (shown via CSS) */}
      <nav className="bottom-tab-bar">
        {nav.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) => `tab-item${isActive ? " active" : ""}`}
          >
            <span className="tab-icon">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
