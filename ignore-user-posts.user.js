// ==UserScript==
// @name         ignore-users-on-neoboards
// @namespace    http://tampermonkey.net/
// @version      2025-01-12
// @description  Ignore users on neoboards with dynamic list management
// @author       You
// @match        https://www.neopets.com/neoboards/topic.phtml*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=neopets.com
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(async function () {
    "use strict";

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        STORAGE_KEY: "ignoredUsers",
        PANEL: {
            WIDTH: "280px",
            HIDDEN_OFFSET: "-320px",
            Z_INDEX: "10000",
            TOGGLE_Z_INDEX: "10001",
        },
        ANIMATION: {
            PULSE_DURATION_MS: 500,
            PULSE_COUNT: 3,
        },
        SELECTORS: {
            POST_AUTHOR: ".postAuthorName",
            BOARD_POST: ".boardPost",
            REPORT_BUTTON: ".reportButton-neoboards",
            NAV_TOP: "#navtop__2020",
            NAV_TEXT: ".nav-text__2020",
            IGNORE_ICON: ".ignore-icon",
        },
        IDS: {
            PANEL_WRAPPER: "ignored-users-panel-wrapper",
            PANEL: "ignored-users-panel",
            TOGGLE_BTN: "ignored-users-toggle",
        },
        THEME: {
            NAV_TEXT_COLOR: "#7f7f7f",
            NAV_TEXT_SIZE: "16pt",
            USERNAME_COLOR: "#333",
            USERNAME_SIZE: "13pt",
            USERNAME_FAMILY: "Arial, sans-serif",
            FALLBACK_BG: "#fff",
        },
        ICONS: {
            IGNORE: "🚫",
            IGNORED_TEXT: "This user is ignored",
            IGNORE_TEXT: "Ignore this user",
        },
    };

    // ==================== STYLE INJECTION ====================
    function injectStyles() {
        const styles = ThemeManager.getThemeStyles();
        const style = document.createElement("style");
        style.textContent = `
            @keyframes pulse-button {
                0%, 100% { 
                    transform: translateY(-50%) scale(1); 
                    background-color: #333;
                }
                50% { 
                    transform: translateY(-50%) scale(1.2); 
                    background-color: ${styles.usernameColor};
                }
            }
            .pulse-animation {
                animation: pulse-button ${CONFIG.ANIMATION.PULSE_DURATION_MS}ms ease-in-out ${CONFIG.ANIMATION.PULSE_COUNT};
            }
            #boardTopic ul li ${CONFIG.SELECTORS.REPORT_BUTTON} {
                float: right !important;
                clear: right !important;
            }
        `;
        document.head.appendChild(style);
    }

    // ==================== DOM CACHE ====================
    const DOMCache = {
        _cache: {},
        get(id, selector) {
            if (!this._cache[id]) {
                this._cache[id] = selector.startsWith("#")
                    ? document.getElementById(selector.slice(1))
                    : document.querySelector(selector);
            }
            return this._cache[id];
        },
        clear(id) {
            if (id) {
                delete this._cache[id];
            } else {
                this._cache = {};
            }
        },
    };

    // ==================== STORAGE OPERATIONS ====================
    async function getIgnoredUsers() {
        try {
            const stored = await GM_getValue(CONFIG.STORAGE_KEY, "[]");
            return JSON.parse(stored);
        } catch (error) {
            console.error("Error loading ignored users:", error);
            return [];
        }
    }

    async function saveIgnoredUsers(users) {
        try {
            await GM_setValue(CONFIG.STORAGE_KEY, JSON.stringify(users));
        } catch (error) {
            console.error("Error saving ignored users:", error);
        }
    }

    async function addIgnoredUser(username) {
        const ignoredUsers = await getIgnoredUsers();
        if (!ignoredUsers.includes(username)) {
            ignoredUsers.push(username);
            await saveIgnoredUsers(ignoredUsers);
            return true;
        }
        return false;
    }

    async function removeIgnoredUser(username) {
        const ignoredUsers = await getIgnoredUsers();
        const filtered = ignoredUsers.filter((user) => user !== username);
        if (filtered.length !== ignoredUsers.length) {
            await saveIgnoredUsers(filtered);
            return true;
        }
        return false;
    }

    // ==================== THEME DETECTION ====================
    const ThemeManager = {
        _cachedStyles: null,

        getThemeStyles() {
            if (this._cachedStyles) {
                return this._cachedStyles;
            }

            const styles = {
                navTextColor: CONFIG.THEME.NAV_TEXT_COLOR,
                navTextSize: CONFIG.THEME.NAV_TEXT_SIZE,
                usernameColor: CONFIG.THEME.USERNAME_COLOR,
                usernameSize: CONFIG.THEME.USERNAME_SIZE,
                usernameFamily: CONFIG.THEME.USERNAME_FAMILY,
            };

            // Get nav text styles
            const navTextElement = document.querySelector(
                CONFIG.SELECTORS.NAV_TEXT
            );
            if (navTextElement) {
                const computedStyle = window.getComputedStyle(navTextElement);
                styles.navTextColor = computedStyle.color;
                styles.navTextSize = computedStyle.fontSize;
            }

            // Get username styles
            const postAuthorElement = document.querySelector(
                CONFIG.SELECTORS.POST_AUTHOR
            );
            if (postAuthorElement) {
                const computedStyle =
                    window.getComputedStyle(postAuthorElement);
                styles.usernameColor = computedStyle.color;
                styles.usernameSize = computedStyle.fontSize;
                styles.usernameFamily = computedStyle.fontFamily
                    .replace(/["']/g, "")
                    .replace(/,\s*$/, "");
            }

            this._cachedStyles = styles;
            return styles;
        },

        getNavBackground() {
            const navElement = document.getElementById(
                CONFIG.SELECTORS.NAV_TOP.slice(1)
            );
            if (navElement) {
                const computedStyle = window.getComputedStyle(navElement);
                return {
                    background: computedStyle.background,
                    borderBottom: computedStyle.borderBottom,
                };
            }
            return {
                background: CONFIG.THEME.FALLBACK_BG,
                borderBottom: "none",
            };
        },
    };

    // ==================== POST VISIBILITY ====================
    function hideIgnoredPosts(ignoredUsers) {
        const posters = document.querySelectorAll(CONFIG.SELECTORS.POST_AUTHOR);
        posters.forEach((poster) => {
            const username = poster.innerText.trim();
            const postElement = poster.closest("li");
            if (postElement) {
                const isIgnored = ignoredUsers.some((user) =>
                    username.includes(user)
                );
                postElement.style.display = isIgnored ? "none" : "";
            }
        });
    }

    // ==================== IGNORE BUTTON CREATION ====================
    function createIgnoreButton(username, isIgnored, onIgnore) {
        const styles = ThemeManager.getThemeStyles();
        const ignoreButton = document.createElement("button");
        ignoreButton.type = "button";
        ignoreButton.className = `${CONFIG.SELECTORS.REPORT_BUTTON.slice(
            1
        )} ${CONFIG.SELECTORS.IGNORE_ICON.slice(1)}`;
        ignoreButton.style.marginLeft = "8px";
        ignoreButton.title = isIgnored ? "Already ignored" : "Ignore this user";
        ignoreButton.style.opacity = isIgnored ? "0.5" : "1";
        ignoreButton.style.cursor = isIgnored ? "default" : "pointer";
        ignoreButton.style.borderColor = styles.usernameColor;

        const ignoreLink = document.createElement("a");
        ignoreLink.href = "#";
        ignoreLink.textContent = isIgnored
            ? CONFIG.ICONS.IGNORED_TEXT
            : CONFIG.ICONS.IGNORE_TEXT;
        ignoreLink.style.textDecoration = "none";
        ignoreLink.style.color = styles.usernameColor;

        ignoreButton.appendChild(ignoreLink);

        if (!isIgnored) {
            ignoreButton.addEventListener("click", async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await onIgnore(username);
            });
        }

        // Add hover effect to swap colors
        ignoreButton.addEventListener("mouseenter", () => {
            ignoreButton.style.backgroundColor = styles.usernameColor;
            ignoreLink.style.color = "#fff";
        });
        ignoreButton.addEventListener("mouseleave", () => {
            ignoreButton.style.backgroundColor = "";
            ignoreLink.style.color = styles.usernameColor;
        });

        return ignoreButton;
    }

    async function addIgnoreIcons() {
        const posts = document.querySelectorAll(CONFIG.SELECTORS.BOARD_POST);
        const ignoredUsers = await getIgnoredUsers();
        const styles = ThemeManager.getThemeStyles();

        posts.forEach((post) => {
            // Skip if icon already exists
            if (post.querySelector(CONFIG.SELECTORS.IGNORE_ICON)) {
                return;
            }

            const poster = post
                .closest("li")
                ?.querySelector(CONFIG.SELECTORS.POST_AUTHOR);
            if (!poster) return;

            const username = poster.innerText.trim();
            const isIgnored = ignoredUsers.some((user) =>
                username.includes(user)
            );

            const reportButton = post.querySelector(
                CONFIG.SELECTORS.REPORT_BUTTON
            );
            if (!reportButton) return;

            // Apply username color to report button
            const reportLink = reportButton.querySelector("a");
            if (reportLink) {
                reportLink.style.color = styles.usernameColor;

                // Add hover effect to swap colors
                reportButton.addEventListener("mouseenter", () => {
                    reportButton.style.backgroundColor = styles.usernameColor;
                    reportLink.style.color = "#fff";
                });
                reportButton.addEventListener("mouseleave", () => {
                    reportButton.style.backgroundColor = "";
                    reportLink.style.color = styles.usernameColor;
                });
            }
            reportButton.style.borderColor = styles.usernameColor;

            const ignoreButton = createIgnoreButton(
                username,
                isIgnored,
                ignoreUser
            );

            reportButton.parentNode.insertBefore(ignoreButton, reportButton);
        });
    }

    // ==================== PANEL TOGGLE BUTTON ====================
    function createToggleButton(onToggle) {
        const toggleBtn = document.createElement("button");
        toggleBtn.id = CONFIG.IDS.TOGGLE_BTN;
        toggleBtn.innerHTML = CONFIG.ICONS.IGNORE;
        toggleBtn.title = "Toggle ignored users panel";

        Object.assign(toggleBtn.style, {
            position: "fixed",
            top: "50%",
            right: "0",
            transform: "translateY(-50%)",
            backgroundColor: "#333",
            color: "#fff",
            border: "none",
            borderRadius: "8px 0 0 8px",
            padding: "12px 8px",
            cursor: "pointer",
            zIndex: CONFIG.PANEL.TOGGLE_Z_INDEX,
            fontSize: "20px",
            boxShadow: "-2px 2px 8px rgba(0,0,0,0.2)",
            transition: "background-color 0.3s, right 0.3s ease-in-out",
        });

        toggleBtn.addEventListener("mouseenter", () => {
            toggleBtn.style.backgroundColor = "#555";
        });
        toggleBtn.addEventListener("mouseleave", () => {
            toggleBtn.style.backgroundColor = "#333";
        });
        toggleBtn.addEventListener("click", onToggle);

        return toggleBtn;
    }

    // ==================== OVERLAY ====================
    function createOverlay() {
        const overlay = document.createElement("div");
        overlay.id = "ignored-users-overlay";

        Object.assign(overlay.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: String(parseInt(CONFIG.PANEL.Z_INDEX) - 1),
            opacity: "0",
            pointerEvents: "none",
            transition: "opacity 0.3s ease-in-out",
        });

        return overlay;
    }

    // ==================== PANEL WRAPPER ====================
    function createPanelWrapper() {
        const panelWrapper = document.createElement("div");
        panelWrapper.id = CONFIG.IDS.PANEL_WRAPPER;

        const bgStyles = ThemeManager.getNavBackground();

        Object.assign(panelWrapper.style, {
            position: "fixed",
            top: "0",
            right: CONFIG.PANEL.HIDDEN_OFFSET,
            width: CONFIG.PANEL.WIDTH,
            height: "100vh",
            borderLeft: "2px solid #333",
            zIndex: CONFIG.PANEL.Z_INDEX,
            boxShadow: "-4px 0 10px rgba(0,0,0,0.2)",
            transition: "right 0.3s ease-in-out",
            background: bgStyles.background,
            borderBottom: bgStyles.borderBottom,
        });

        const panel = document.createElement("div");
        panel.id = CONFIG.IDS.PANEL;
        panel.className = "nav-top-pattern__2020";

        Object.assign(panel.style, {
            width: "100%",
            height: "100%",
            padding: "20px",
            fontFamily: "Arial, sans-serif",
            overflowY: "auto",
            boxSizing: "border-box",
        });

        panelWrapper.appendChild(panel);
        return panelWrapper;
    }

    // ==================== PANEL STATE MANAGER ====================
    const PanelManager = {
        isOpen: false,
        toggleBtn: null,
        panelWrapper: null,
        overlay: null,

        initialize() {
            this.toggleBtn = createToggleButton(() => this.toggle());
            this.panelWrapper = createPanelWrapper();
            this.overlay = createOverlay();

            document.body.appendChild(this.overlay);
            document.body.appendChild(this.panelWrapper);
            document.body.appendChild(this.toggleBtn);

            this.setupOutsideClickHandler();
        },

        toggle() {
            this.isOpen = !this.isOpen;
            this.updatePanelPosition();
        },

        close() {
            if (this.isOpen) {
                this.isOpen = false;
                this.updatePanelPosition();
            }
        },

        updatePanelPosition() {
            if (this.isOpen) {
                this.panelWrapper.style.right = "0";
                this.toggleBtn.style.right = CONFIG.PANEL.WIDTH;
                this.overlay.style.opacity = "1";
                this.overlay.style.pointerEvents = "auto";
            } else {
                this.panelWrapper.style.right = CONFIG.PANEL.HIDDEN_OFFSET;
                this.toggleBtn.style.right = "0";
                this.overlay.style.opacity = "0";
                this.overlay.style.pointerEvents = "none";
            }
        },

        setupOutsideClickHandler() {
            document.addEventListener("click", (e) => {
                if (
                    this.isOpen &&
                    !this.panelWrapper.contains(e.target) &&
                    !this.toggleBtn.contains(e.target)
                ) {
                    this.close();
                }
            });

            // Close panel when clicking overlay
            if (this.overlay) {
                this.overlay.addEventListener("click", () => {
                    if (this.isOpen) {
                        this.close();
                    }
                });
            }
        },

        pulseToggleButton() {
            if (!this.isOpen && this.toggleBtn) {
                this.toggleBtn.classList.add("pulse-animation");
                setTimeout(() => {
                    this.toggleBtn.classList.remove("pulse-animation");
                }, CONFIG.ANIMATION.PULSE_COUNT * CONFIG.ANIMATION.PULSE_DURATION_MS);
            }
        },
    };

    // ==================== PANEL CONTENT RENDERING ====================
    function renderEmptyState(styles) {
        return `
            <div class="nav-text__2020" style="font-weight: bold; margin-bottom: 16px; font-size: ${styles.navTextSize}; color: ${styles.navTextColor}; border-bottom: 2px solid #333; padding-bottom: 8px;">
                Ignored Users
            </div>
            <div style="color: ${styles.navTextColor}; font-size: 12pt; opacity: 0.7;">
                No users ignored
            </div>
        `;
    }

    function renderUserItem(username, styles) {
        return `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding: 8px; background: #f5f5f5; border-radius: 6px; border: 1px solid #ddd;">
                <span style="font-size: ${styles.usernameSize}; font-family: ${styles.usernameFamily}; color: ${styles.usernameColor}; word-break: break-word; flex: 1; font-weight: 500;">
                    ${username}
                </span>
                <button class="unignore-btn" data-username="${username}" style="background: ${styles.usernameColor}; color: white; border: none; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 12px; margin-left: 8px; font-weight: bold;">
                    ✖
                </button>
            </div>
        `;
    }

    function renderIgnoredUsersList(ignoredUsers) {
        const styles = ThemeManager.getThemeStyles();

        if (ignoredUsers.length === 0) {
            return renderEmptyState(styles);
        }

        const header = `
            <div class="nav-text__2020" style="font-weight: bold; margin-bottom: 16px; font-size: ${styles.navTextSize}; color: ${styles.navTextColor}; border-bottom: 2px solid #333; padding-bottom: 8px;">
                Ignored Users
            </div>
        `;

        const userList = ignoredUsers
            .map((username) => renderUserItem(username, styles))
            .join("");

        return `
            ${header}
            <div>
                ${userList}
            </div>
        `;
    }

    function attachUnignoreListeners(panel) {
        panel.querySelectorAll(".unignore-btn").forEach((btn) => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const username = btn.getAttribute("data-username");
                await unignoreUser(username);
            });
        });
    }

    async function updateIgnoredUsersList(ignoredUsers) {
        let panel = document.getElementById(CONFIG.IDS.PANEL);

        if (!panel) {
            PanelManager.initialize();
            panel = document.getElementById(CONFIG.IDS.PANEL);
        }

        panel.innerHTML = renderIgnoredUsersList(ignoredUsers);
        attachUnignoreListeners(panel);
    }

    // ==================== USER ACTIONS ====================
    async function ignoreUser(username) {
        const wasAdded = await addIgnoredUser(username);
        if (wasAdded) {
            await refreshUI();
            PanelManager.pulseToggleButton();
        }
    }

    async function unignoreUser(username) {
        const wasRemoved = await removeIgnoredUser(username);
        if (wasRemoved) {
            await refreshUI();
        }
    }

    // ==================== UI REFRESH ====================
    async function refreshUI() {
        const ignoredUsers = await getIgnoredUsers();
        hideIgnoredPosts(ignoredUsers);

        // Remove and re-add ignore icons
        document
            .querySelectorAll(CONFIG.SELECTORS.IGNORE_ICON)
            .forEach((icon) => icon.remove());
        await addIgnoreIcons();

        await updateIgnoredUsersList(ignoredUsers);
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        try {
            injectStyles();
            const ignoredUsers = await getIgnoredUsers();
            hideIgnoredPosts(ignoredUsers);
            await addIgnoreIcons();
            await updateIgnoredUsersList(ignoredUsers);
        } catch (error) {
            console.error("Initialization error:", error);
        }
    }

    await init();
})();
