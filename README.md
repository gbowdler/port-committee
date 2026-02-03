# Port Committee

This repo contains a single-page HTML app (`index.html`) and a lightweight Node server that provides a persistent JSON storage API.

## Getting started

### 1) Run the local server (recommended)

```bash
npm start
```

Then open `http://localhost:3000` in your browser. The server persists data in `storage.json` via the `/api/storage` endpoint, and the app will automatically use that when available.

### 2) Open the HTML file directly (fallback)

If you open `index.html` via `file://`, the app will fall back to `localStorage`. This works but data is scoped to your browser profile and can be cleared by the browser.

## Storage behavior

The app prefers server storage when running over HTTP and falls back to `localStorage` if the API is unavailable or if the file is opened directly. If the browser blocks `localStorage`, it keeps data in-memory for the current session.
The app prefers server storage when running over HTTP and falls back to `localStorage` if the API is unavailable or if the file is opened directly.
