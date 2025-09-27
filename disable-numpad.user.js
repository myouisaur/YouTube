// ==UserScript==
// @name         [YouTube] Disable Numpad Navigation
// @namespace    https://github.com/myouisaur/YouTube
// @icon         https://www.youtube.com/s/desktop/c90d512c/img/favicon.ico
// @version      1.2
// @description  Disable numpad number keys for YouTube video navigation while keeping regular number keys
// @author       Xiv
// @match        *://*.youtube.com/*
// @grant        none
// @updateURL    https://myouisaur.github.io/YouTube/disable-numpad.user.js
// @downloadURL  https://myouisaur.github.io/YouTube/disable-numpad.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Function to handle keydown events
    function handleKeydown(event) {
        // Check if it's a numpad key (0-9 on numpad have keyCodes 96-105)
        if (event.keyCode >= 96 && event.keyCode <= 105) {
            const activeElement = document.activeElement;

            // Don't block if we're typing in an input field
            if (activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable) {
                return; // Allow typing in search boxes, comments, etc.
            }

            // Only block when video player area is focused AND we're on a video page
            const isOnVideoPage = window.location.pathname.startsWith('/watch');
            const isVideoPlayerFocused = activeElement.tagName === 'VIDEO' ||
                                       activeElement === document.body ||
                                       activeElement.classList.contains('html5-video-player') ||
                                       activeElement.classList.contains('ytp-chrome-bottom');

            if (isOnVideoPage && isVideoPlayerFocused) {
                event.preventDefault();
                event.stopPropagation();
                console.log('Blocked numpad key:', event.key);
            }
        }
    }

    // Add event listener to capture keydown events
    document.addEventListener('keydown', handleKeydown, true);

    console.log('YouTube Numpad Blocker loaded');
})();
