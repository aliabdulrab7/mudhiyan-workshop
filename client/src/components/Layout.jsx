import { NavLink, useNavigate } from "react-router-dom";
import { clearAuth, getRole } from "../api/auth";

const nav = [
  { to: "/",        icon: "◈", label: "الطلبات" },
  { to: "/new",     icon: "✦", label: "صيانة جديدة", roles: ["shop_employee"] },
  { to: "/scan",    icon: "⌖", label: "مسح" },
  { to: "/branches",    icon: "⊛", label: "الفروع",    roles: ["workshop"] },
  { to: "/reports",    icon: "◉", label: "التقارير", roles: ["workshop"] },
  { to: "/technicians",icon: "⚙", label: "الفنيون",  roles: ["workshop"] },
  { to: "/inventory",  icon: "◻", label: "المخزون",  roles: ["workshop"] },
  { to: "/services",   icon: "✧", label: "الخدمات",  roles: ["workshop"] },
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
        background: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        padding: "0",
        borderLeft: "1px solid #E5E7EB",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid #E5E7EB" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "4px",
          }}>
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "6px",
              background: "linear-gradient(135deg, #2980B9, #1A6EA0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1rem",
              color: "#ffffff",
              flexShrink: 0,
            }}>◈</div>
            <div style={{
              fontFamily: "Almarai, sans-serif",
              fontWeight: 700,
              fontSize: "0.95rem",
              color: "#222222",
              lineHeight: 1.3,
            }}>
              مجوهرات سليمان المضيان
            </div>
          </div>
          <div style={{ color: "#9CA3AF", fontSize: "0.70rem", marginTop: "6px", paddingRight: "42px" }}>
            إدارة صيانة المجوهرات
          </div>
        </div>

        <nav style={{ padding: "8px 8px", flex: 1 }}>
          {visibleNav.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 12px",
                borderRadius: "6px",
                marginBottom: "2px",
                color: isActive ? "#2980B9" : "#2D3436",
                background: isActive ? "rgba(41,128,185,0.08)" : "transparent",
                textDecoration: "none",
                fontSize: "0.875rem",
                fontWeight: isActive ? 600 : 400,
                transition: "all 0.15s ease",
              })}
            >
              <span style={{ fontSize: "0.9rem", opacity: 0.75 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: "16px 8px", borderTop: "1px solid #E5E7EB" }}>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              background: "transparent",
              border: "1px solid #E5E7EB",
              color: "#9CA3AF",
              borderRadius: "6px",
              padding: "7px 12px",
              fontSize: "0.80rem",
              fontFamily: "Almarai, sans-serif",
              cursor: "pointer",
              textAlign: "right",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.target.style.color = "#DC2626"; e.target.style.borderColor = "rgba(220,38,38,0.3)"; e.target.style.background = "rgba(220,38,38,0.04)"; }}
            onMouseLeave={e => { e.target.style.color = "#9CA3AF"; e.target.style.borderColor = "#E5E7EB"; e.target.style.background = "transparent"; }}
          >
            تسجيل الخروج ←
          </button>
          <div style={{ color: "#9CA3AF", fontSize: "0.62rem", marginTop: "8px", textAlign: "center" }}>
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
