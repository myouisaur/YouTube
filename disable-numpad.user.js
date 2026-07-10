// ==UserScript==
// @name         [YouTube] Disable Numpad Navigation
// @namespace    https://github.com/myouisaur/YouTube
// @icon         https://www.youtube.com/s/desktop/c90d512c/img/favicon.ico
// @version      1.7
// @description  Disables numpad and page navigation keys on YouTube video pages to prevent accidental timeline jumping.
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
        TARGET_PATHS: ['/watch', '/shorts/'],
        INPUT_TAGS: new Set(['INPUT', 'TEXTAREA']), // Set used for O(1) lookups
        PLAYER_CLASSES: ['html5-video-player', 'ytp-chrome-bottom'],
        VIDEO_TAG: 'VIDEO',
        BLOCKED_KEYS: ['Home', 'End', 'PageUp', 'PageDown'],
        NUMPAD_REGEX: /^Numpad\d$/
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
     * Recursively finds the true active element, piercing through Shadow DOM boundaries
     */
    function getDeepActiveElement(root = document) {
        const activeEl = root.activeElement;
        if (activeEl && activeEl.shadowRoot && activeEl.shadowRoot.activeElement) {
            return getDeepActiveElement(activeEl.shadowRoot);
        }
        return activeEl;
    }

    /**
     * Handles keydown events to intercept numpad and navigation inputs
     */
    function handleKeydown(event) {
        const isNumpad = CONFIG.NUMPAD_REGEX.test(event.code);
        const isBlockedNavKey = CONFIG.BLOCKED_KEYS.includes(event.code);

        // Fast exit: if it's not a key we care about, do nothing
        if (!isNumpad && !isBlockedNavKey) return;

        // Fast exit: ensure we are actually on a video or shorts page before doing DOM reads
        const isOnVideoPage = CONFIG.TARGET_PATHS.some(path => window.location.pathname.startsWith(path));
        if (!isOnVideoPage) return;

        // Safely get the active element, even if it's inside a Web Component
        const activeElement = getDeepActiveElement() || document.body;

        // Don't block if we're typing in an input field or contentEditable area
        if (CONFIG.INPUT_TAGS.has(activeElement.tagName) || activeElement.isContentEditable) {
            return;
        }

        // Only block when video player area or main body is focused
        const isVideoPlayerFocused =
            activeElement.tagName === CONFIG.VIDEO_TAG ||
            activeElement === document.body ||
            CONFIG.PLAYER_CLASSES.some(cls => activeElement.classList.contains(cls));

        if (isVideoPlayerFocused) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            logDebug('Blocked key:', event.code);
        }
    }

    // Capture keydown events in the capturing phase to intercept before YouTube
    document.addEventListener('keydown', handleKeydown, true);

    logDebug('Initialized successfully');
})();
