import { NavLink, useNavigate } from "react-router-dom";
import { clearAuth, getRole } from "../api/auth";

const nav = [
  { to: "/",        icon: "◈", label: "الطلبات" },
  { to: "/new",     icon: "✦", label: "صيانة جديدة", roles: ["shop_employee"] },
  { to: "/scan",    icon: "⌖", label: "مسح" },
  { to: "/branches",icon: "⊛", label: "الفروع", roles: ["workshop"] },
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
        width: "240px",
        minWidth: "240px",
        background: "linear-gradient(180deg, #0D1225 0%, #0A0E1B 100%)",
        display: "flex",
        flexDirection: "column",
        padding: "0",
        borderLeft: "1px solid rgba(212,168,67,0.08)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Ambient glow */}
        <div style={{
          position: "absolute",
          top: "-40px",
          right: "-40px",
          width: "180px",
          height: "180px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,168,67,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ padding: "32px 24px 24px", position: "relative" }}>
          <div style={{
            fontFamily: "Almarai, sans-serif",
            fontWeight: 800,
            fontSize: "1.25rem",
            background: "linear-gradient(135deg, var(--gold), var(--gold-bright))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "0.01em",
            lineHeight: 1.3,
          }}>
            مصنع المضيان
          </div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.72rem", marginTop: "4px", letterSpacing: "0.02em" }}>
            إدارة صيانة المجوهرات
          </div>
        </div>

        <div className="gold-line" style={{ margin: "0 20px" }} />

        <nav style={{ padding: "16px 14px", flex: 1 }}>
          {visibleNav.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 14px",
                borderRadius: "12px",
                marginBottom: "4px",
                color: isActive ? "var(--gold)" : "rgba(255,255,255,0.5)",
                background: isActive ? "rgba(212,168,67,0.08)" : "transparent",
                borderRight: isActive ? "2px solid var(--gold)" : "2px solid transparent",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: isActive ? 700 : 400,
                transition: "all 0.2s ease",
                ...(isActive ? { boxShadow: "0 0 20px rgba(212,168,67,0.05)" } : {}),
              })}
            >
              <span style={{ fontSize: "1.05rem", opacity: 0.85 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: "20px 24px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.4)",
              borderRadius: "10px",
              padding: "9px 14px",
              fontSize: "0.78rem",
              fontFamily: "Almarai, sans-serif",
              cursor: "pointer",
              textAlign: "right",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.target.style.color = "var(--gold)"; e.target.style.borderColor = "rgba(212,168,67,0.2)"; e.target.style.background = "rgba(212,168,67,0.04)"; }}
            onMouseLeave={e => { e.target.style.color = "rgba(255,255,255,0.4)"; e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.background = "rgba(255,255,255,0.03)"; }}
          >
            تسجيل الخروج ←
          </button>
          <div style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.62rem", marginTop: "10px", textAlign: "center" }}>
            يتطلب Chrome أو Edge للطباعة
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: "auto", background: "transparent" }}>
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
        <button
          onClick={handleLogout}
          className="tab-item"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <span className="tab-icon">⇤</span>
          <span>خروج</span>
        </button>
      </nav>
    </div>
  );
}
