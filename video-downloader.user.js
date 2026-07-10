// ==UserScript==
// @name         [YouTube] Video Downloader
// @namespace    https://github.com/myouisaur/YouTube
// @icon         https://www.youtube.com/s/desktop/c90d512c/img/favicon.ico
// @version      4.0
// @description  Adds a button to download YouTube videos via cnvmp3.com in the background
// @author       Xiv
// @match        *://*.youtube.com/*
// @match        *://*.cnvmp3.com/*
// @noframes
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        window.close
// @run-at       document-idle
// @updateURL    https://myouisaur.github.io/YouTube/video-downloader.user.js
// @downloadURL  https://myouisaur.github.io/YouTube/video-downloader.user.js
// ==/UserScript==

(function() {
    'use strict';

    if (window.__ytDlInit) return;
    window.__ytDlInit = true;

    // ==========================================
    // CENTRALIZED CONFIGURATION
    // ==========================================
    const CONFIG = {
        debug: false,
        urls: {
            converter: 'https://cnvmp3.com/'
        },
        storage: {
            urlKey: 'yt_dl_url'
        },
        colors: {
            bgNormal:  '#272727',
            bgHover:   '#3D3D3D',
            bgActive:  '#FFFFFF',
            fgNormal:  '#FFFFFF',
            fgActive:  '#272727'
        },
        selectors: {
            ytMicBtn:          '#voice-search-button',
            captcha:           'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"]',
            cnvUrlInput:       '#video-url',
            cnvSubmitBtn:      '#convert-button-1',
            cnvFormatDisplay:  '#format-select-display',
            cnvMp4Opt:         '.format-select-options[data-format="0"]',
            cnvVideoBox:       '.quality-video-select-box',
            cnvQualityDisplay: '#quality-video-select-display',
            cnvQualityOpts:    '.quality-video-select-options'
        },
        timeouts: {
            uiWait:        10000,
            dlMaxWait:     60000,
            tabCloseDelay: 2500,
            cnvActionWait: 200
        }
    };

    // ==========================================
    // CORE UTILITIES
    // ==========================================
    const logger = {
        info:  (...args) => CONFIG.debug && console.log('[YouTube Downloader]', ...args),
        warn:  (...args) => console.warn('[YouTube Downloader]', ...args),
        error: (...args) => console.error('[YouTube Downloader]', ...args)
    };

    const storage = {
        get: (key, def = null) => {
            try { return GM_getValue(key) || def; }
            catch (e) { logger.error(`Failed to read ${key}`, e); return def; }
        },
        set: (key, val) => {
            try { GM_setValue(key, val); }
            catch (e) { logger.error(`Failed to write ${key}`, e); }
        }
    };

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    const domUtils = {
        simulateClick: (element) => {
            if (!element) return;
            element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            element.click();
        },

        setInputValue: (inputEl, value) => {
            try {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                if (nativeSetter) nativeSetter.call(inputEl, value);
                else inputEl.value = value;

                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (e) {
                logger.error('Failed to inject value into input', e);
            }
        },

        waitForElement: (selector, timeoutMs = CONFIG.timeouts.uiWait) => {
            return new Promise((resolve, reject) => {
                const el = document.querySelector(selector);
                if (el) return resolve(el);

                const observer = new MutationObserver((_, obs) => {
                    const found = document.querySelector(selector);
                    if (found) {
                        obs.disconnect();
                        clearTimeout(timer);
                        resolve(found);
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });

                const timer = setTimeout(() => {
                    observer.disconnect();
                    reject(new Error(`Element '${selector}' not found`));
                }, timeoutMs);
            });
        }
    };

    const isCaptchaPresent = () => document.querySelector(CONFIG.selectors.captcha) !== null;

    // ==========================================
    // YOUTUBE MODULE
    // ==========================================
    if (location.hostname.includes('youtube.com')) {

        const styleId = 'yt-dl-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                #dl-btn-scratch {
                    background: ${CONFIG.colors.bgNormal} !important;
                    border: none !important; border-radius: 50% !important;
                    height: 40px !important; width: 40px !important;
                    min-width: 40px !important; min-height: 40px !important;
                    padding: 0 !important; margin-left: 10px !important;
                    cursor: pointer !important; z-index: 999999 !important;
                    flex-shrink: 0 !important; display: flex !important;
                    align-items: center !important; justify-content: center !important;
                    transition: all 0.2s ease !important;
                }
                #dl-btn-scratch:hover:not([data-state="processing"]) {
                    background: ${CONFIG.colors.bgHover} !important;
                }
                #dl-btn-scratch[data-state="processing"] {
                    background: ${CONFIG.colors.bgActive} !important;
                    opacity: 0.5 !important;
                }
            `;
            document.head.appendChild(style);
        }

        const injectButton = async () => {
            const path = location.pathname;
            if (!path.startsWith('/watch') && !path.startsWith('/shorts')) {
                document.getElementById('dl-btn-scratch')?.remove();
                return;
            }

            if (document.getElementById('dl-btn-scratch')) return;

            try {
                const micBtn = await domUtils.waitForElement(CONFIG.selectors.ytMicBtn, 5000);

                const btn = document.createElement('button');
                btn.id = 'dl-btn-scratch';
                btn.title = 'Download via cnvmp3';
                btn.dataset.state = 'idle';

                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('width', '24');
                svg.setAttribute('height', '24');
                svg.style.fill = CONFIG.colors.fgNormal;
                svg.style.pointerEvents = 'none';
                svg.style.transition = 'fill 0.2s ease';

                const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathEl.setAttribute('d', 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z');
                svg.appendChild(pathEl);
                btn.appendChild(svg);

                btn.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    if (btn.dataset.state === 'processing') return;

                    let url = location.origin + location.pathname;
                    if (location.pathname.startsWith('/watch')) {
                        const urlParams = new URLSearchParams(location.search);
                        url += urlParams.has('v') ? `?v=${urlParams.get('v')}` : location.search.split('&')[0];
                    }

                    storage.set(CONFIG.storage.urlKey, url);

                    // Lock button visually
                    btn.dataset.state = 'processing';
                    svg.style.fill = CONFIG.colors.fgActive;

                    setTimeout(() => {
                        GM_openInTab(CONFIG.urls.converter, { active: false, insert: true });

                        // Instantly unlock once the tab is spawned
                        btn.dataset.state = 'idle';
                        svg.style.fill = CONFIG.colors.fgNormal;
                    }, 500);
                };

                micBtn.after(btn);
                logger.info('Button injected successfully');

            } catch (error) {
                logger.warn('Could not locate mic button for UI injection.', error.message);
            }
        };

        window.addEventListener('yt-navigate-finish', injectButton);
        injectButton();

    // ==========================================
    // CNVMP3 MODULE (Background Tab)
    // ==========================================
    } else if (location.hostname.includes('cnvmp3.com')) {

        const executeDownload = async () => {
            const url = storage.get(CONFIG.storage.urlKey);
            if (!url) return;

            logger.info('Starting automated conversion for:', url);
            storage.set(CONFIG.storage.urlKey, null);

            try {
                // 1. Initial Checks & Input Injection
                const input = await domUtils.waitForElement(CONFIG.selectors.cnvUrlInput);
                const submitBtn = await domUtils.waitForElement(CONFIG.selectors.cnvSubmitBtn);

                if (isCaptchaPresent()) throw new Error('captcha');

                // 2. Select Format (MP4)
                domUtils.simulateClick(await domUtils.waitForElement(CONFIG.selectors.cnvFormatDisplay));
                await sleep(CONFIG.timeouts.cnvActionWait);
                domUtils.simulateClick(await domUtils.waitForElement(CONFIG.selectors.cnvMp4Opt));

                // 3. Wait for Video Quality Options Box
                await domUtils.waitForElement(CONFIG.selectors.cnvVideoBox);
                for (let i = 0; i < 20; i++) {
                    const box = document.querySelector(CONFIG.selectors.cnvVideoBox);
                    if (box && box.style.display !== 'none') break;
                    await sleep(100);
                }

                // 4. Select Highest Quality (1080p fallback loop)
                domUtils.simulateClick(await domUtils.waitForElement(CONFIG.selectors.cnvQualityDisplay));
                await sleep(CONFIG.timeouts.cnvActionWait);

                const opts = Array.from(document.querySelectorAll(CONFIG.selectors.cnvQualityOpts));
                const highestNode = document.querySelector(`${CONFIG.selectors.cnvQualityOpts}[data-quality="1080"]`) ||
                    opts.reduce((prev, curr) => (parseInt(curr.dataset.quality) || 0) > (parseInt(prev.dataset.quality) || 0) ? curr : prev, opts[0]);

                if (highestNode) domUtils.simulateClick(highestNode);
                await sleep(CONFIG.timeouts.cnvActionWait);

                // 5. Inject URL & Submit
                domUtils.setInputValue(input, url);
                await sleep(CONFIG.timeouts.cnvActionWait);
                domUtils.simulateClick(submitBtn);

                // 6. Wait for Download Button Generation
                document.title = "Processing...";
                const finalBtn = await new Promise((resolve, reject) => {
                    const findDlBtn = () => {
                        if (isCaptchaPresent()) return reject(new Error('captcha'));
                        for (const el of document.querySelectorAll('a, button')) {
                            const text = el.innerText.toLowerCase();
                            if (text.includes('download') && !text.includes('downloader') && el.offsetWidth > 0) {
                                return el;
                            }
                        }
                        return null;
                    };

                    const initialCheck = findDlBtn();
                    if (initialCheck) return resolve(initialCheck);

                    const obs = new MutationObserver(() => {
                        const btn = findDlBtn();
                        if (btn) { obs.disconnect(); clearTimeout(tmr); resolve(btn); }
                    });
                    obs.observe(document.body, { childList: true, subtree: true });

                    const tmr = setTimeout(() => {
                        obs.disconnect(); reject(new Error('timeout'));
                    }, CONFIG.timeouts.dlMaxWait);
                });

                // 7. Click Download & Cleanup
                document.title = "Downloading...";
                domUtils.simulateClick(finalBtn);

                setTimeout(() => window.close(), CONFIG.timeouts.tabCloseDelay);

            } catch (error) {
                logger.error('Automation aborted:', error.message);

                if (error.message === 'captcha') {
                    document.title = "⚠️ Captcha Required!";
                } else if (error.message === 'timeout') {
                    document.title = "❌ Conversion Timeout";
                }
            }
        };

        executeDownload();
    }
})();
