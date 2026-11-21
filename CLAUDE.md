# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An HLS video review tool. Paste any HLS stream URL and watch it with fine-grained playback controls.

## Running locally

No build step — Tailwind CSS and HLS.js are loaded from CDN at runtime. Open `index.html` directly in a browser, or serve it with any static file server:

```
npx serve .
# or
python3 -m http.server 8080
```

## Architecture

### Entry point

- **`index.html`** — Single page. URL input, demo button, and the shared video player.

### Shared video player (three files)

`video-player.js`, `video-player.html`, and the `#playerContainer` DOM id form a single logical unit:

1. **`video-player.html`** — A bare HTML fragment (no `<html>`/`<body>`) containing the full-screen overlay player with all control buttons. It is **not** embedded in the pages — it's fetched at runtime.
2. **`video-player.js`** — `loadVideoPlayerHTML()` fetches `video-player.html` via `fetch()` and appends it to `<body>`. `initVideoPlayer()` calls this, then instantiates `VideoPlayerManager`. Both `index.php` and `index.html` call `initVideoPlayer()` and await the returned player instance before attaching their own event listeners.
3. **`VideoPlayerManager`** — Takes DOM element references in its constructor options and wires up all playback logic: HLS.js streaming, native HLS fallback (Safari), play/pause, seek (1f/1s/5s/10s/30s/60s), speed (0.1x–1.0x), go-to-live, fullscreen, keyboard shortcuts, and pinch-to-zoom. Zoom only affects `#videoZoomArea`, so the button bar isn't affected. Chrome/Edge crop the video with `object-view-box`; other browsers draw the visible region onto `#zoomCanvas`. Never CSS-scale the `<video>` itself, and don't use the canvas on Chrome — both render black on some Windows GPUs; `touch-action: none` on `#playerContainer` stops the browser's page zoom. Native video controls are hidden while zoomed (they'd scale off-screen).

### FloSports HLS tokens

FloSports stream URLs contain time-limited HMAC tokens (`st`, `exp`, `acl`, `hmac2` query params). They expire and must be refreshed from the [FloSports SSP](https://ssp.flosports.net/hls-playback-url). The browser must be authenticated at the SSP for these streams to load.

## Keyboard shortcuts (when player overlay is visible)

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `←` | Rewind 5s |
| `→` | Forward 5s |

