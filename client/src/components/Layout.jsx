import { NavLink, useNavigate } from "react-router-dom";
import { clearAuth, getRole } from "../api/auth";

const nav = [
  { to: "/",     icon: "◈", label: "الطلبات" },
  { to: "/new",  icon: "✦", label: "صيانة جديدة", roles: ["shop_employee"] },
  { to: "/scan", icon: "⌖", label: "مسح" },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const role = getRole();

  function handleLogout() {
    clearAuth();
    navigate("/login");
  }

  const visibleNav = nav.filter(n => !n.roles || n.roles.includes(role));

  return (
    <div className="main-layout" style={{ display: "flex", height: "100%", minHeight: "100vh" }}>

      {/* Sidebar — desktop */}
      <aside className="sidebar" style={{
        width: "220px",
        minWidth: "220px",
        background: "var(--bg-sidebar)",
        display: "flex",
        flexDirection: "column",
        padding: "0",
      }}>
        <div style={{ padding: "28px 20px 20px" }}>
          <div style={{
            fontFamily: "Almarai, sans-serif",
            fontWeight: 800,
            fontSize: "1.15rem",
            color: "var(--gold)",
            letterSpacing: "0.02em",
            lineHeight: 1.3,
          }}>
            مصنع المضيان
          </div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.72rem", marginTop: "3px" }}>
            إدارة صيانة المجوهرات
          </div>
        </div>

        <div className="gold-line" style={{ margin: "0 16px" }} />

        <nav style={{ padding: "12px 10px", flex: 1 }}>
          {visibleNav.map(({ to, icon, label }) => (
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
                color: isActive ? "var(--gold)" : "rgba(255,255,255,0.65)",
                background: isActive ? "rgba(201,151,58,0.12)" : "transparent",
                borderRight: isActive ? "2px solid var(--gold)" : "2px solid transparent",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: isActive ? 700 : 400,
                transition: "all 0.15s",
              })}
            >
              <span style={{ fontSize: "1rem", opacity: 0.85 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.5)",
              borderRadius: "6px",
              padding: "7px 12px",
              fontSize: "0.78rem",
              fontFamily: "Almarai, sans-serif",
              cursor: "pointer",
              textAlign: "right",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.target.style.color = "#fff"; e.target.style.borderColor = "rgba(255,255,255,0.35)"; }}
            onMouseLeave={e => { e.target.style.color = "rgba(255,255,255,0.5)"; e.target.style.borderColor = "rgba(255,255,255,0.15)"; }}
          >
            تسجيل الخروج ←
          </button>
          <div style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.65rem", marginTop: "8px" }}>
            يتطلب Chrome أو Edge للطباعة
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: "auto", background: "var(--bg-primary)" }}>
        {children}
      </main>

      {/* Bottom tab bar — mobile */}
      <nav className="bottom-tab-bar">
        {visibleNav.map(({ to, icon, label }) => (
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
