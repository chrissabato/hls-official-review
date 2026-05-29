# HLS Official Review

A browser-based HLS video player for reviewing basketball game footage. Paste any `.m3u8` stream URL and play it with frame-accurate playback controls.

## Usage

Open `index.html` in a browser or serve it with any static file server:

```
npx serve .
```

Paste an HLS stream URL and click **Load & Play Stream**, or click **Load Demo Feed** to try it with a sample stream.

## Playback Controls

| Control | Action |
|--------|--------|
| Rewind/Forward buttons | Jump back or forward 1f / 1s / 5s / 10s / 30s / 60s |
| Speed buttons | 0.1x, 0.25x, 0.5x, 1.0x |
| LIVE button | Jump to live edge |
| `Space` | Play / Pause |
| `←` / `→` | Rewind / Forward 5s |
| `Escape` | Close player |

## FloSports Streams

FloSports HLS URLs contain time-limited tokens that expire. Refresh them from the [FloSports SSP](https://ssp.flosports.net/hls-playback-url). Your browser must be logged into the SSP for the stream to load.

## Dependencies

Loaded from CDN — no install required.

- [HLS.js](https://github.com/video-dev/hls.js/) — HLS playback in non-Safari browsers
- [Tailwind CSS](https://tailwindcss.com/) — styling
