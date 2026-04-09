# PWA (Home Screen App) Design

**Date:** 2026-04-08
**Status:** Approved

## Goal

Allow the shop owner to install the app on their iPhone home screen so it opens full-screen without Safari browser UI, looks and feels like a native app.

## User Flow

1. Open `http://192.168.100.177:5173` in Safari on iPhone
2. Tap Share → "Add to Home Screen"
3. App appears as an icon named "مصنع المضيان"
4. Tapping the icon opens the app full-screen (no address bar, no Safari chrome)

## What Changes

### `client/public/manifest.json`

Web App Manifest telling browsers/iOS how to treat the app when installed:

- `name`: "مصنع المضيان"
- `short_name`: "المضيان"
- `display`: "standalone" — removes browser UI
- `background_color`: "#16120D" — matches `--bg-primary`
- `theme_color`: "#C9A84C" — matches `--gold`
- `dir`: "rtl"
- `lang`: "ar"
- `start_url`: "/"
- Icons: 180×180 and 512×512

### `client/index.html`

Apple-specific meta tags (iOS ignores the manifest for some properties):

- `apple-mobile-web-app-capable`: enables standalone mode on iOS
- `apple-mobile-web-app-status-bar-style`: `black-translucent` — status bar blends with app
- `apple-mobile-web-app-title`: "المضيان"
- `apple-touch-icon`: points to 180×180 icon
- `theme-color` meta tag: `#C9A84C`

### `client/public/icons/`

Two PNG icons generated via Canvas API in a Node script:

- `icon-180.png` — used by iOS for home screen
- `icon-512.png` — used by manifest for splash/PWA

Icon design: dark background (`#16120D`), gold circle border, gold `◈` symbol centered.

### `client/vite.config.js`

No changes needed — Vite already serves `public/` files as static assets.

## Out of Scope

- Service worker / offline support (app is LAN-only, no value in caching)
- App Store submission
- Capacitor / native shell
- Push notifications
- Splash screen customization beyond background color
