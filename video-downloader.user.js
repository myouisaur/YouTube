// ==UserScript==
// @name         [YouTube] Video Downloader
// @namespace    https://github.com/myouisaur/YouTube
// @icon         https://www.youtube.com/s/desktop/c90d512c/img/favicon.ico
// @version      3.0
// @description  Adds a button to download YouTube videos via cnvmp3.com
// @author       Xiv
// @match        *://*.youtube.com/*
// @match        *://*.cnvmp3.com/*
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// @updateURL    https://myouisaur.github.io/YouTube/video-downloader.user.js
// @downloadURL  https://myouisaur.github.io/YouTube/video-downloader.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- UTILITIES ---

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    const simulateClick = (element) => {
        if (!element) return;
        element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        element.click();
    };

    // Sleek, non-intrusive UI alerts
    const showToast = (message, type = 'info') => {
        const existing = document.getElementById('yt-dl-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'yt-dl-toast';
        const colors = { info: '#272727', success: '#4CAF50', error: '#FF3B30' };

        toast.style.cssText = `
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            background: ${colors[type] || colors.info}; color: #ffffff;
            padding: 12px 24px; border-radius: 8px; font-family: Roboto, Arial, sans-serif;
            font-size: 14px; font-weight: 500; z-index: 9999999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); pointer-events: none;
            transition: opacity 0.3s ease; opacity: 1;
        `;
        toast.innerText = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    };

    // Captcha sensor
    const isCaptchaPresent = () => {
        return document.querySelector('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"]') !== null;
    };


    // ==========================================
    // YOUTUBE LOGIC
    // ==========================================
    if (location.hostname.includes('youtube.com')) {

        const maintainYouTubeUI = () => {
            // Only inject on video or shorts pages
            if (!location.pathname.startsWith('/watch') && !location.pathname.startsWith('/shorts')) {
                const existingBtn = document.getElementById('dl-btn-scratch');
                if (existingBtn) existingBtn.remove();
                return;
            }

            if (document.getElementById('dl-btn-scratch')) return;

            const micBtn = document.getElementById('voice-search-button');
            if (!micBtn) return;

            const btn = document.createElement('button');
            btn.id = 'dl-btn-scratch';
            btn.title = 'Download via cnvmp3';
            btn.dataset.clicking = 'false';

            btn.style.cssText = `
                background: #272727 !important;
                border: none !important;
                border-radius: 50% !important;
                height: 40px !important;
                width: 40px !important;
                min-width: 40px !important;
                min-height: 40px !important;
                padding: 0 !important;
                margin-left: 10px !important;
                cursor: pointer !important;
                z-index: 999999 !important;
                flex-shrink: 0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: background 0.2s ease, opacity 0.2s ease !important;
            `;

            // SVG creation bypassing Trusted Types
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('width', '24');
            svg.setAttribute('height', '24');
            svg.style.fill = '#FFFFFF';
            svg.style.pointerEvents = 'none';

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z');

            svg.appendChild(path);
            btn.appendChild(svg);

            btn.addEventListener('mouseenter', () => {
                if (btn.dataset.clicking === 'false') btn.style.background = '#3D3D3D';
            });
            btn.addEventListener('mouseleave', () => {
                if (btn.dataset.clicking === 'false') btn.style.background = '#272727';
            });

            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (btn.dataset.clicking === 'true') return;
                btn.dataset.clicking = 'true';

                btn.style.opacity = '0.5';

                // Smarter URL Parsing
                let url = location.origin + location.pathname;
                if (location.pathname.startsWith('/watch')) {
                    const urlParams = new URLSearchParams(location.search);
                    if (urlParams.has('v')) {
                        url += '?v=' + urlParams.get('v'); // Perfect surgical extraction
                    } else {
                        url += location.search.split('&')[0]; // Fallback
                    }
                }

                GM_setClipboard(url);
                GM_setValue('yt_url', url);

                btn.style.opacity = '1';
                btn.style.background = '#FFFFFF';
                svg.style.fill = '#272727';

                showToast("Link grabbed! Opening converter...", "success");

                setTimeout(() => {
                    GM_openInTab('https://cnvmp3.com/', {active: true});

                    btn.style.background = '#272727';
                    svg.style.fill = '#FFFFFF';
                    btn.dataset.clicking = 'false';
                }, 500);
            };

            micBtn.after(btn);
        };

        // Inject instantly on internal navigation + safety fallback loop
        window.addEventListener('yt-navigate-finish', maintainYouTubeUI);
        setInterval(maintainYouTubeUI, 1500);
        maintainYouTubeUI(); // Initial check

    // ==========================================
    // CNVMP3 LOGIC
    // ==========================================
    } else if (location.hostname.includes('cnvmp3.com')) {

        let url = GM_getValue('yt_url');
        if (!url) return;

        let attempts = 0;

        let timer = setInterval(async () => {
            let input = document.getElementById('video-url');
            let submitBtn = document.getElementById('convert-button-1');

            // --- SAFETY NET: Captcha Check ---
            if (isCaptchaPresent()) {
                showToast("Captcha detected! Please solve it to continue.", "error");
                clearInterval(timer);
                return;
            }

            if (input && submitBtn) {
                clearInterval(timer);
                GM_setValue('yt_url', null);

                // 1. Open Format Dropdown
                let formatDisplay = document.getElementById('format-select-display');
                simulateClick(formatDisplay);
                await sleep(200);

                // 2. Click MP4
                let mp4Opt = document.querySelector('.format-select-options[data-format="0"]');
                simulateClick(mp4Opt);

                // 3. Smart Wait for Video Options
                let videoQualityLoaded = false;
                for (let i = 0; i < 50; i++) {
                    let videoBox = document.querySelector('.quality-video-select-box');
                    if (videoBox && videoBox.style.display !== 'none') {
                        videoQualityLoaded = true;
                        break;
                    }
                    await sleep(100);
                }

                // --- SAFETY NET: Timeout Alert ---
                if (!videoQualityLoaded) {
                    showToast("Error: Video options took too long to load. Please try manually.", "error");
                    return;
                }

                // 4. Open Quality Dropdown
                let qualityDisplay = document.getElementById('quality-video-select-display');
                if (qualityDisplay) simulateClick(qualityDisplay);
                await sleep(200);

                // 5. Select Highest Quality
                let highestNode = document.querySelector('.quality-video-select-options[data-quality="1080"]');
                if (!highestNode) {
                    let qualityOpts = document.querySelectorAll('.quality-video-select-options');
                    let max = 0;
                    qualityOpts.forEach(node => {
                        let val = parseInt(node.getAttribute('data-quality')) || 0;
                        if (val > max) { max = val; highestNode = node; }
                    });
                }

                if (highestNode) simulateClick(highestNode);
                await sleep(200);

                // 6. Paste URL
                input.value = url;
                input.dispatchEvent(new Event('input', {bubbles:true}));
                input.dispatchEvent(new Event('change', {bubbles:true}));

                await sleep(300);

                // 7. Convert
                simulateClick(submitBtn);
                showToast("Processing video... Waiting for download.", "info");

                // 8. NEW: Automated Final Download Watcher
                let dlAttempts = 0;
                let dlTimer = setInterval(() => {
                    if (isCaptchaPresent()) {
                        showToast("Captcha detected during processing! Please solve.", "error");
                        clearInterval(dlTimer);
                        return;
                    }

                    // Scans the DOM for the newly generated download button
                    let finalDlBtn = Array.from(document.querySelectorAll('a, button')).find(el =>
                        el.innerText.toLowerCase().includes('download') &&
                        !el.innerText.toLowerCase().includes('downloader') && // Ignore header texts
                        el.offsetWidth > 0 && el.offsetHeight > 0 // Ensure it's physically visible
                    );

                    if (finalDlBtn) {
                        clearInterval(dlTimer);
                        showToast("Download ready! Clicking automatically.", "success");
                        simulateClick(finalDlBtn);
                    }

                    // Gives the server 60 seconds to convert before timing out
                    if (++dlAttempts > 120) {
                        showToast("Conversion timeout. Please download manually.", "error");
                        clearInterval(dlTimer);
                    }
                }, 500);
            }

            if (++attempts > 40) clearInterval(timer);
        }, 500);
    }
})();
