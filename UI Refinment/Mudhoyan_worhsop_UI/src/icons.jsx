// ── Inline icon components (Lucide-style, stroke-based) ──
const I = ({ d, size = 15, stroke = 'currentColor', sw = 1.75, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d ? <path d={d} /> : children}
  </svg>
);

const Icon = {
  Dashboard: (p) => <I {...p}><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></I>,
  Orders:    (p) => <I {...p}><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></I>,
  Inbox:     (p) => <I {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></I>,
  Plus:      (p) => <I {...p}><path d="M12 5v14"/><path d="M5 12h14"/></I>,
  Scan:      (p) => <I {...p}><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></I>,
  Printer:   (p) => <I {...p}><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></I>,
  Link:      (p) => <I {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></I>,
  Box:       (p) => <I {...p}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></I>,
  Chart:     (p) => <I {...p}><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></I>,
  Branch:    (p) => <I {...p}><path d="M3 21h18"/><path d="M5 21V7l5-4v18"/><path d="M19 21V11l-5-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/></I>,
  Search:    (p) => <I {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></I>,
  Bell:      (p) => <I {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></I>,
  Settings:  (p) => <I {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></I>,
  Filter:    (p) => <I {...p}><path d="M3 6h18l-7 8v6l-4-2v-4L3 6z"/></I>,
  Sort:      (p) => <I {...p}><path d="M11 5h10"/><path d="M11 9h7"/><path d="M11 13h4"/><path d="M3 17l3 3 3-3"/><path d="M6 18V4"/></I>,
  Group:     (p) => <I {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></I>,
  X:         (p) => <I {...p}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></I>,
  Check:     (p) => <I {...p}><path d="M20 6 9 17l-5-5"/></I>,
  More:      (p) => <I {...p}><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></I>,
  Arrow:     (p) => <I {...p}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></I>,
  ArrowUp:   (p) => <I {...p}><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></I>,
  ArrowDown: (p) => <I {...p}><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></I>,
  Download:  (p) => <I {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></I>,
  User:      (p) => <I {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></I>,
  Clock:     (p) => <I {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></I>,
  Phone:     (p) => <I {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></I>,
  Diamond:   (p) => <I {...p}><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M6 3 2 9l10 12 10-12-4-6"/><path d="M6 3h12l-6 18L6 3z"/></I>,
  Camera:    (p) => <I {...p}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="4"/></I>,
  QR:        (p) => <I {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3"/><path d="M20 14v3"/><path d="M14 17v4"/><path d="M17 20h4"/></I>,
  Warn:      (p) => <I {...p}><path d="m10.29 3.86-8.13 14a2 2 0 0 0 1.71 3h16.26a2 2 0 0 0 1.71-3l-8.13-14a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></I>,
  Bolt:      (p) => <I {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></I>,
  Archive:   (p) => <I {...p}><rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/></I>,
  Ellipsis:  (p) => <I {...p}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></I>,
  Tag:       (p) => <I {...p}><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l8.58-8.58a1 1 0 0 0 0-1.42z"/><path d="M7 7h.01"/></I>,
  Layers:    (p) => <I {...p}><path d="m12 2 10 6-10 6L2 8l10-6z"/><path d="m2 16 10 6 10-6"/><path d="m2 12 10 6 10-6"/></I>,
  Sparkle:   (p) => <I {...p}><path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="M5.6 5.6 8.5 8.5"/><path d="M15.5 15.5l2.9 2.9"/><path d="M5.6 18.4 8.5 15.5"/><path d="M15.5 8.5 18.4 5.6"/></I>,
  ChevRight: (p) => <I {...p}><path d="m9 18 6-6-6-6"/></I>,
  ChevDown:  (p) => <I {...p}><path d="m6 9 6 6 6-6"/></I>,
  Refresh:   (p) => <I {...p}><path d="M21 12a9 9 0 0 0-15-6.7L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/><path d="M21 21v-5h-5"/></I>,
  Globe:     (p) => <I {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></I>,
};

Object.assign(window, { Icon });
