// ==UserScript==
// @name         [YouTube] Disable Numpad Navigation
// @namespace    https://github.com/myouisaur/YouTube
// @icon         https://www.youtube.com/s/desktop/c90d512c/img/favicon.ico
// @version      1.3
// @description  Disable numpad number keys for YouTube video navigation while keeping regular number keys
// @author       Xiv
// @match        *://*.youtube.com/*
// @noframes
// @updateURL    https://myouisaur.github.io/YouTube/disable-numpad.user.js
// @downloadURL  https://myouisaur.github.io/YouTube/disable-numpad.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Prevent duplicate initialization during SPA navigations
    if (window.__ytDisableNumpadRunning) return;
    window.__ytDisableNumpadRunning = true;

    // Centralized configuration
    const CONFIG = {
        DEBUG: false,
        TARGET_PATH: '/watch',
        INPUT_TAGS: ['INPUT', 'TEXTAREA'],
        PLAYER_CLASSES: ['html5-video-player', 'ytp-chrome-bottom'],
        VIDEO_TAG: 'VIDEO'
    };

    /**
     * Structured logging utility
     */
    function logDebug(message, ...args) {
        if (CONFIG.DEBUG) {
            console.log(`[YouTube Disable Numpad][Events] ${message}`, ...args);
        }
    }

    /**
     * Handles keydown events to intercept numpad inputs
     */
    function handleKeydown(event) {
        // Modern check: verifies event.code matches 'Numpad0' through 'Numpad9'
        if (/^Numpad\d$/.test(event.code)) {
            // Defensive check in case activeElement is null
            const activeElement = document.activeElement || document.body;

            // Don't block if we're typing in an input field or contentEditable area
            if (CONFIG.INPUT_TAGS.includes(activeElement.tagName) || activeElement.isContentEditable) {
                return;
            }

            // Only block when video player area is focused AND we're on a video page
            const isOnVideoPage = window.location.pathname.startsWith(CONFIG.TARGET_PATH);
            const isVideoPlayerFocused =
                activeElement.tagName === CONFIG.VIDEO_TAG ||
                activeElement === document.body ||
                CONFIG.PLAYER_CLASSES.some(cls => activeElement.classList.contains(cls));

            if (isOnVideoPage && isVideoPlayerFocused) {
                event.preventDefault();
                event.stopPropagation();
                logDebug('Blocked numpad key:', event.code);
            }
        }
    }

    // Capture keydown events in the capturing phase to intercept before YouTube
    document.addEventListener('keydown', handleKeydown, true);

    logDebug('Initialized successfully');
})();
