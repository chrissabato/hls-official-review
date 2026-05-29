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
        
        // Configuration
        this.enableKeyboardShortcuts = options.enableKeyboardShortcuts !== false;
        
        this.init();
    }
    
    init() {
        this.attachEventListeners();
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
        
        // Reset playback speed to normal
        this.setPlaybackSpeed(1.0);
        this.updatePlayPauseButton();
    }
    
    closeVideoPlayer() {
        if (this.playerContainer.style.display === 'flex') {
            this.playerContainer.style.display = 'none';
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
        enableKeyboardShortcuts: true
    });
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoPlayerManager;
}