/**
 * Shared HLS Video Player Module
 * This module handles all video player functionality including playback controls,
 * HLS streaming, keyboard shortcuts, and UI state management.
 */

class VideoPlayerManager {
    constructor(options = {}) {
        // Required DOM elements
        this.playerContainer = options.playerContainer;
        this.videoPlayer = options.videoPlayer;
        this.closeBtn = options.closeBtn;
        this.messageBox = options.messageBox;
        
        // Control buttons
        this.playPauseBtn = options.playPauseBtn;
        this.playIcon = options.playIcon;
        this.pauseIcon = options.pauseIcon;
        this.playPauseText = options.playPauseText;
        this.toggleFullscreenBtn = options.toggleFullscreenBtn;
        this.goToLiveBtn = options.goToLiveBtn;
        this.rewindButtons = options.rewindButtons;
        this.forwardButtons = options.forwardButtons;
        this.speedButtons = options.speedButtons;
        this.zoomArea = options.zoomArea;
        
        // Configuration
        this.enableKeyboardShortcuts = options.enableKeyboardShortcuts !== false;
        
        this.init();
    }
    
    init() {
        this.attachEventListeners();
        if (this.zoomArea) {
            this.initZoom();
        }
    }
    
    /**
     * Pinch-to-zoom and pan on the video only. The button bar is outside
     * the zoom area, so it keeps its size and position.
     */
    initZoom() {
        this.minZoom = 1;
        this.maxZoom = 5;
        this.zoom = { scale: 1, x: 0, y: 0 };
        this.pointers = new Map();   // pointerId -> {x, y} in zoom-area coords
        this.gesture = null;         // state captured at the start of a pinch/pan
        this.lastTap = null;         // for double-tap-to-reset
        
        const area = this.zoomArea;
        
        // Ignore gestures that start on a button inside the area (e.g. close button)
        const isControl = (e) => e.target.closest('button');
        
        area.addEventListener('pointerdown', (e) => {
            if (isControl(e)) return;
            this.pointers.set(e.pointerId, this.toAreaCoords(e));
            
            // Take over the gesture once it's a pinch, or a pan while zoomed in.
            // At 1x with one finger, let taps reach the native video controls.
            if (this.pointers.size >= 2 || this.zoom.scale > 1) {
                e.preventDefault();
                try { area.setPointerCapture(e.pointerId); } catch (_) {}
                this.startGesture();
            }
        });
        
        area.addEventListener('pointermove', (e) => {
            if (!this.pointers.has(e.pointerId)) return;
            this.pointers.set(e.pointerId, this.toAreaCoords(e));
            if (this.gesture) {
                e.preventDefault();
                this.updateGesture();
            }
        });
        
        const endPointer = (e) => {
            if (!this.pointers.has(e.pointerId)) return;
            const wasSingle = this.pointers.size === 1;
            const moved = this.gesture && this.gesture.moved;
            this.pointers.delete(e.pointerId);
            
            if (e.type === 'pointerup' && wasSingle && !moved) {
                this.handleTap(e);
            }
            
            // Re-anchor so lifting one finger of a pinch doesn't make the video jump
            if (this.pointers.size > 0 && this.zoom.scale > 1) {
                this.startGesture();
            } else {
                this.gesture = null;
            }
        };
        area.addEventListener('pointerup', endPointer);
        area.addEventListener('pointercancel', endPointer);
        
        // Trackpad pinch on desktop arrives as ctrl+wheel
        area.addEventListener('wheel', (e) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            const p = this.toAreaCoords(e);
            this.zoomAt(p, this.zoom.scale * Math.exp(-e.deltaY * 0.01));
        }, { passive: false });
        
        // Safari fires its own gesture events for pinch; stop page zoom there too
        ['gesturestart', 'gesturechange', 'gestureend'].forEach(type => {
            this.playerContainer.addEventListener(type, (e) => e.preventDefault());
        });
        
        // Keep the transform valid when the area changes size (fullscreen, rotation)
        window.addEventListener('resize', () => this.applyZoom());
    }
    
    toAreaCoords(e) {
        const rect = this.zoomArea.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    
    getGestureCenterAndDistance() {
        const pts = [...this.pointers.values()];
        if (pts.length === 1) {
            return { center: pts[0], distance: 0 };
        }
        const [a, b] = pts;
        return {
            center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
            distance: Math.hypot(b.x - a.x, b.y - a.y)
        };
    }
    
    startGesture() {
        const { center, distance } = this.getGestureCenterAndDistance();
        this.gesture = {
            startCenter: center,
            startDistance: distance,
            startScale: this.zoom.scale,
            // Point in the unscaled video that sits under the gesture center
            contentPoint: {
                x: (center.x - this.zoom.x) / this.zoom.scale,
                y: (center.y - this.zoom.y) / this.zoom.scale
            },
            moved: false
        };
    }
    
    updateGesture() {
        const g = this.gesture;
        const { center, distance } = this.getGestureCenterAndDistance();
        
        if (Math.hypot(center.x - g.startCenter.x, center.y - g.startCenter.y) > 5 ||
            (g.startDistance && Math.abs(distance - g.startDistance) > 5)) {
            g.moved = true;
        }
        
        let scale = g.startScale;
        if (this.pointers.size >= 2 && g.startDistance > 0) {
            scale = g.startScale * (distance / g.startDistance);
        }
        scale = Math.min(this.maxZoom, Math.max(this.minZoom, scale));
        
        // Keep the same video point under the fingers
        this.zoom.scale = scale;
        this.zoom.x = center.x - g.contentPoint.x * scale;
        this.zoom.y = center.y - g.contentPoint.y * scale;
        this.applyZoom();
    }
    
    zoomAt(point, newScale) {
        newScale = Math.min(this.maxZoom, Math.max(this.minZoom, newScale));
        const cx = (point.x - this.zoom.x) / this.zoom.scale;
        const cy = (point.y - this.zoom.y) / this.zoom.scale;
        this.zoom.scale = newScale;
        this.zoom.x = point.x - cx * newScale;
        this.zoom.y = point.y - cy * newScale;
        this.applyZoom();
    }
    
    handleTap(e) {
        const now = Date.now();
        const p = this.toAreaCoords(e);
        const last = this.lastTap;
        this.lastTap = { time: now, x: p.x, y: p.y };
        
        // Double-tap while zoomed resets to 1x
        if (last && now - last.time < 300 && Math.hypot(p.x - last.x, p.y - last.y) < 40) {
            this.lastTap = null;
            if (this.zoom.scale > 1) {
                this.resetZoom();
            }
        }
    }
    
    applyZoom() {
        if (!this.zoom) return;
        const { width, height } = this.zoomArea.getBoundingClientRect();
        const z = this.zoom;
        
        if (z.scale <= 1.001) {
            z.scale = 1;
            z.x = 0;
            z.y = 0;
        } else {
            // Don't let the video be dragged away from the edges
            z.x = Math.min(0, Math.max(width - width * z.scale, z.x));
            z.y = Math.min(0, Math.max(height - height * z.scale, z.y));
        }
        
        this.videoPlayer.style.transform = z.scale === 1
            ? ''
            : `translate(${z.x}px, ${z.y}px) scale(${z.scale})`;
        
        // Native controls would be scaled off-screen, so hide them while zoomed
        this.videoPlayer.controls = z.scale === 1;
    }
    
    resetZoom() {
        if (!this.zoom) return;
        this.zoom = { scale: 1, x: 0, y: 0 };
        this.pointers.clear();
        this.gesture = null;
        this.applyZoom();
    }
    
    attachEventListeners() {
        // Video state listeners
        this.videoPlayer.addEventListener('play', () => this.updatePlayPauseButton());
        this.videoPlayer.addEventListener('pause', () => this.updatePlayPauseButton());
        this.videoPlayer.addEventListener('loadeddata', () => this.updatePlayPauseButton());
        
        // Control button listeners
        this.closeBtn.addEventListener('click', () => this.closeVideoPlayer());
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.toggleFullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        this.goToLiveBtn.addEventListener('click', () => this.goToLive());
        
        // Rewind buttons
        this.rewindButtons.forEach(button => {
            button.addEventListener('click', () => {
                const seconds = parseFloat(button.dataset.seconds, 10);
                this.rewindVideo(seconds);
            });
        });
        
        // Forward buttons
        this.forwardButtons.forEach(button => {
            button.addEventListener('click', () => {
                const seconds = parseFloat(button.dataset.seconds, 10);
                this.fastForwardVideo(seconds);
            });
        });
        
        // Speed buttons
        this.speedButtons.forEach(button => {
            button.addEventListener('click', () => {
                const rate = parseFloat(button.dataset.rate);
                this.setPlaybackSpeed(rate);
            });
        });
        
        // Keyboard shortcuts
        if (this.enableKeyboardShortcuts) {
            document.addEventListener('keyup', (e) => this.handleKeyPress(e));
        }
    }
    
    showMessage(msg, type = 'warning', duration = 3000) {
        this.messageBox.textContent = msg;
        this.messageBox.className = 'mt-5 p-3 rounded-lg text-center';
        this.messageBox.style.display = 'block';

        // Remove existing type classes
        this.messageBox.classList.remove('bg-red-900', 'text-red-300', 
                                         'bg-green-900', 'text-green-300',
                                         'bg-yellow-900', 'text-yellow-300');
        
        if (type === 'error') {
            this.messageBox.classList.add('bg-red-900', 'text-red-300');
        } else if (type === 'success') {
            this.messageBox.classList.add('bg-green-900', 'text-green-300');
        } else {
            this.messageBox.classList.add('bg-yellow-900', 'text-yellow-300');
        }

        setTimeout(() => {
            this.messageBox.style.display = 'none';
        }, duration);
    }
    
    playVideo(url) {
        if (!url || url.trim() === '') {
            this.showMessage('Please enter a valid HLS stream URL.', 'error');
            return;
        }

        // Clean up previous HLS instance
        if (this.videoPlayer.hls) {
            this.videoPlayer.hls.destroy();
            this.videoPlayer.hls = null;
        }

        this.playerContainer.style.display = 'flex';

        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(this.videoPlayer);
            
            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                this.videoPlayer.play().catch(e => {
                    console.error('Autoplay failed:', e);
                    this.showMessage('Autoplay prevented. Click to play.', 'warning', 5000);
                    this.updatePlayPauseButton();
                });
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    console.error('HLS Fatal Error:', data.details, data);
                    
                    switch(data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            this.showMessage('HLS Network Error. Check URL or login.', 'error', 7000);
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            this.showMessage('HLS Media Error. Stream may be incompatible.', 'error', 7000);
                            break;
                        default:
                            this.showMessage('HLS Fatal Error. Trying native playback.', 'error', 7000);
                            break;
                    }
                    
                    this.videoPlayer.hls.destroy();
                    // Fallback to native playback
                    this.videoPlayer.src = url;
                    this.videoPlayer.play().catch(e => {
                        console.error('Native playback failed:', e);
                        this.showMessage('Failed to play video.', 'error', 7000);
                    });
                }
            });
            
            this.videoPlayer.hls = hls;
        } else if (this.videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari/iOS)
            this.videoPlayer.src = url;
            this.videoPlayer.play();
            this.showMessage('Using native HLS playback.', 'success');
        } else {
            this.showMessage('HLS playback not supported in this browser.', 'error');
        }
        
        // Reset playback speed and zoom
        this.setPlaybackSpeed(1.0);
        this.resetZoom();
        this.updatePlayPauseButton();
    }
    
    closeVideoPlayer() {
        if (this.playerContainer.style.display === 'flex') {
            this.playerContainer.style.display = 'none';
            this.resetZoom();
            this.videoPlayer.pause();
            
            if (this.videoPlayer.hls) {
                this.videoPlayer.hls.destroy();
                this.videoPlayer.hls = null;
            }
            
            this.videoPlayer.src = '';
            this.videoPlayer.removeAttribute('src');
            this.videoPlayer.load();
            this.updatePlayPauseButton();
        }
    }
    
    togglePlayPause() {
        if (this.videoPlayer.paused) {
            this.videoPlayer.play().catch(e => {
                console.error('Play failed:', e);
                this.showMessage('Playback failed.', 'error', 3000);
            });
        } else {
            this.videoPlayer.pause();
        }
        this.updatePlayPauseButton();
    }
    
    updatePlayPauseButton() {
        if (this.videoPlayer.paused) {
            this.playIcon.classList.remove('hidden');
            this.pauseIcon.classList.add('hidden');
            this.playPauseBtn.classList.remove('bg-yellow-600', 'hover:bg-yellow-700');
            this.playPauseBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        } else {
            this.playIcon.classList.add('hidden');
            this.pauseIcon.classList.remove('hidden');
            this.playPauseBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
            this.playPauseBtn.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
        }
    }
    
    rewindVideo(seconds) {
        if (this.videoPlayer.currentTime) {
            this.videoPlayer.currentTime = Math.max(0, this.videoPlayer.currentTime - seconds);
            this.showMessage(`Rewound by ${seconds}s.`, 'success', 1500);
        }
    }
    
    fastForwardVideo(seconds) {
        if (this.videoPlayer.currentTime && this.videoPlayer.duration) {
            this.videoPlayer.currentTime = Math.min(this.videoPlayer.duration, this.videoPlayer.currentTime + seconds);
            this.showMessage(`Forwarded by ${seconds}s.`, 'success', 1500);
        }
    }
    
    goToLive() {
        if (this.videoPlayer.readyState >= 2) {
            this.videoPlayer.currentTime = this.videoPlayer.duration-3;
            this.videoPlayer.play();
            this.showMessage('Jumping to Live Edge.', 'success', 1500);
        } else {
            this.showMessage('Stream not ready to seek.', 'warning', 1500);
        }
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.playerContainer.requestFullscreen().catch(err => {
                this.showMessage(`Error entering fullscreen: ${err.message}`, 'error', 5000);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    setPlaybackSpeed(rate) {
        this.videoPlayer.playbackRate = rate;
        this.showMessage(`Speed set to ${rate.toFixed(2)}x.`, 'success', 1500);

        // Update button styles
        this.speedButtons.forEach(btn => {
            const buttonRate = parseFloat(btn.dataset.rate);
            
            btn.classList.remove('bg-fuchsia-600', 'hover:bg-fuchsia-700');
            btn.classList.add('bg-blue-500', 'hover:bg-blue-600');
            
            if (buttonRate === rate) {
                btn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
                btn.classList.add('bg-fuchsia-600', 'hover:bg-fuchsia-700');
            }
        });
    }
    
    handleKeyPress(e) {
        // Only handle keys when player is visible
        if (this.playerContainer.style.display !== 'flex') {
            return;
        }
        
        if (e.key === 'Escape') {
            this.closeVideoPlayer();
        } else if (e.key === 'ArrowLeft') {
            this.rewindVideo(5);
        } else if (e.key === 'ArrowRight') {
            this.fastForwardVideo(5);
        } else if (e.code === 'Space' || e.key === ' ') {
            e.preventDefault();
            this.togglePlayPause();
        }
    }
}

/**
 * Load the video player HTML from external file
 * Returns a promise that resolves when the HTML is loaded
 */
async function loadVideoPlayerHTML() {
    try {
        const response = await fetch('video-player.html');
        const html = await response.text();
        
        // Insert the HTML into the body
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        document.body.appendChild(tempDiv.firstElementChild);
        
        return true;
    } catch (error) {
        console.error('Failed to load video player HTML:', error);
        return false;
    }
}

/**
 * Auto-initialize the player when the DOM is ready
 * Returns the player instance for custom usage
 */
async function initVideoPlayer() {
    // Check if player HTML is already in the DOM
    if (!document.getElementById('playerContainer')) {
        const loaded = await loadVideoPlayerHTML();
        if (!loaded) {
            throw new Error('Failed to load video player HTML');
        }
    }
    
    return new VideoPlayerManager({
        playerContainer: document.getElementById('playerContainer'),
        videoPlayer: document.getElementById('videoPlayer'),
        closeBtn: document.getElementById('closeBtn'),
        messageBox: document.getElementById('message'),
        playPauseBtn: document.getElementById('playPauseBtn'),
        playIcon: document.getElementById('playIcon'),
        pauseIcon: document.getElementById('pauseIcon'),
        playPauseText: document.getElementById('playPauseText'),
        toggleFullscreenBtn: document.getElementById('toggleFullscreenBtn'),
        goToLiveBtn: document.getElementById('goToLiveBtn'),
        rewindButtons: document.querySelectorAll('.rewind-btn'),
        forwardButtons: document.querySelectorAll('.forward-btn'),
        speedButtons: document.querySelectorAll('.speed-btn'),
        zoomArea: document.getElementById('videoZoomArea'),
        enableKeyboardShortcuts: true
    });
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoPlayerManager;
}