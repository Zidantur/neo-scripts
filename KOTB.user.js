// ==UserScript==
// @name         PW KOTB Helper
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Assists with collecting KOTB stats
// @author       You
// @match        https://www.neopets.com/editpage.phtml*
// @match        https://www.neopets.com/~*
// @match        https://www.neopets.com/petlookup.phtml*
// @match        https://www.neopets.com/userlookup.phtml*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=neopets.com
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.addValueChangeListener
// ==/UserScript==

(async function () {
    "use strict";

    const KOTB_PETPAGE = "https://www.neopets.com/~Ardonfal";

    const BASE_PETLOOKUP_URL = "https://www.neopets.com/petlookup.phtml?pet=";
    const BASE_USERLOOKUP_URL =
        "https://www.neopets.com/userlookup.phtml?user=";
    const BASE_EDIT_PETPAGE_URL = "https://www.neopets.com/editpage.phtml?pet=";

    const ROSTER_STORAGE_KEY = "KOTBRoster";
    const THEME_STORAGE_KEY = "KOTBTheme";
    const STATS_STORAGE_KEY = "KOTBStats";
    const COLLECTING_FLAG_KEY = "KOTBCollecting";
    const COLLECTION_INDEX_KEY = "KOTBCollectionIndex";
    const COLLECTION_STAGE_KEY = "KOTBCollectionStage";
    const TEMP_LEVEL_KEY = "KOTBTempLevel";
    const MODAL_OPEN_KEY = "KOTBModalOpen";
    const ACTIVE_TAB_KEY = "KOTBActiveTab";
    const GUIDED_MODE_KEY = "KOTBGuidedMode";

    const THEMES = {
        light: {
            panelBg: "#fff",
            headerText: "#333",
            headerBorder: "#0055aa",
            formBg: "#f0f0f0",
            formBorder: "#0055aa",
            labelText: "#555",
            inputBg: "#fff",
            inputBorder: "#ccc",
            inputText: "#333",
            buttonBg: "#0055aa",
            buttonText: "#fff",
            itemBg: "#f9f9f9",
            itemBorder: "#ddd",
            ownerText: "#0055aa",
            petText: "#666",
            removeBtn: "#d9534f",
            removeBtnHover: "#c9302c",
            emptyText: "#666",
            toggleBg: "#e0e0e0",
            toggleText: "#333",
            sideToggleBgHover: "#f0f0f0",
        },
        dark: {
            panelBg: "#2a2a2a",
            headerText: "#e8e8e8",
            headerBorder: "#0055aa",
            formBg: "#1a1a1a",
            formBorder: "#0055aa",
            labelText: "#e8e8e8",
            inputBg: "#3a3a3a",
            inputBorder: "#555",
            inputText: "#e8e8e8",
            buttonBg: "#0055aa",
            buttonText: "#fff",
            itemBg: "#333",
            itemBorder: "#555",
            ownerText: "#4a9eff",
            petText: "#aaa",
            removeBtn: "#d9534f",
            removeBtnHover: "#c9302c",
            emptyText: "#aaa",
            toggleBg: "#1a1a1a",
            toggleText: "#e8e8e8",
            sideToggleBgHover: "#3a3a3a",
        },
    };

    // These are on pet owner userlookup
    const ALL_PETS_CONTAINERS_SELECTOR =
        'document.querySelector("#bxlist").querySelectorAll("center")';
    const PET_NAME_FROM_CONTAINERS_SELECTOR =
        'container.querySelector("b").innerText.trim()';
    const PET_LEVEL_FROM_CONTAINERS_SELECTOR =
        'container.querySelectorAll("b")[3].nextSibling.textContent.trim()';

    // These are on petlookup
    const PET_STATS_TD_SELECTOR =
        'document.querySelectorAll(".contentModuleContent")[1].querySelector("table").querySelectorAll("td")[1]';
    const PET_HP_SELECTOR =
        "petStatsTd.querySelectorAll(\"b\")[2].textContent.split('/')[1].trim()";
    const PET_STRENGTH_SELECTOR =
        "petStatsTd.querySelectorAll(\"b\")[3].nextSibling.textContent.split('(')[1].split(')')[0]";
    const PET_DEFENCE_SELECTOR =
        "petStatsTd.querySelectorAll(\"b\")[4].nextSibling.textContent.split('(')[1].split(')')[0]";
    const PET_MOVEMENT_SELECTOR =
        "petStatsTd.querySelectorAll(\"b\")[5].nextSibling.textContent.split('(')[1].split(')')[0]";

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        MODAL: {
            MAX_WIDTH: "1200px",
            WIDTH: "90vw",
            MAX_HEIGHT: "80vh",
            Z_INDEX: "10000",
            TOGGLE_Z_INDEX: "10001",
        },
        ANIMATION: {
            PULSE_DURATION_MS: 500,
            PULSE_COUNT: 3,
        },
        IDS: {
            MODAL_WRAPPER: "kotb-modal-wrapper",
            MODAL: "kotb-modal",
            TOGGLE_BTN: "kotb-toggle",
        },
        ICONS: {
            TOGGLE: "📋",
        },
    };

    // Font configuration - change this to update the font throughout the application
    const FONT_FAMILY = "'Segoe UI', Tahoma, Arial, sans-serif";

    // ==================== STYLE INJECTION ====================
    function injectStyles() {
        const style = document.createElement("style");
        style.textContent = `
            @keyframes pulse-kotb-button {
                0%, 100% { 
                    transform: scale(1); 
                    background-color: #333;
                }
                50% { 
                    transform: scale(1.2); 
                    background-color: #0055aa;
                }
            }
            .pulse-kotb-animation {
                animation: pulse-kotb-button ${CONFIG.ANIMATION.PULSE_DURATION_MS}ms ease-in-out ${CONFIG.ANIMATION.PULSE_COUNT};
            }
            .kotb-remove-btn:hover {
                background-color: #c9302c !important;
                transform: scale(1.05);
            }
            .kotb-close-btn:hover {
                background-color: #c9302c !important;
                transform: scale(1.05);
            }
            .kotb-tab-btn {
                transition: all 0.2s ease;
            }
            .kotb-tab-btn:hover {
                opacity: 0.8;
            }
            .kotb-collection-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
            }
            @media (max-width: 768px) {
                .kotb-collection-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ==================== STORAGE OPERATIONS ====================
    async function getOwnerPetPairings() {
        try {
            const stored = await GM.getValue(ROSTER_STORAGE_KEY, "[]");
            return JSON.parse(stored);
        } catch (error) {
            console.error("Error loading pairings:", error);
            return [];
        }
    }

    async function saveOwnerPetPairings(pairings) {
        try {
            await GM.setValue(ROSTER_STORAGE_KEY, JSON.stringify(pairings));
        } catch (error) {
            console.error("Error saving pairings:", error);
        }
    }

    async function addPairing(owner, pet) {
        const pairings = await getOwnerPetPairings();
        const normalizedOwner = owner.toLowerCase();

        const exists = pairings.some(
            (p) =>
                p.owner.toLowerCase() === normalizedOwner &&
                p.pet.toLowerCase() === pet.toLowerCase()
        );

        if (!exists) {
            pairings.push({ owner: normalizedOwner, pet });
            await saveOwnerPetPairings(pairings);
            return true;
        }
        return false;
    }

    async function removePairing(owner, pet) {
        const pairings = await getOwnerPetPairings();
        const filtered = pairings.filter(
            (p) => !(p.owner === owner && p.pet === pet)
        );

        if (filtered.length !== pairings.length) {
            await saveOwnerPetPairings(filtered);
            return true;
        }
        return false;
    }

    async function getTheme() {
        try {
            const theme = await GM.getValue(THEME_STORAGE_KEY, "light");
            return theme;
        } catch (error) {
            console.error("Error loading theme:", error);
            return "light";
        }
    }

    async function saveTheme(theme) {
        try {
            await GM.setValue(THEME_STORAGE_KEY, theme);
        } catch (error) {
            console.error("Error saving theme:", error);
        }
    }

    async function toggleTheme() {
        const currentTheme = await getTheme();
        const newTheme = currentTheme === "light" ? "dark" : "light";
        await saveTheme(newTheme);
        await updateModal();
    }

    async function getGuidedMode() {
        try {
            const guidedMode = await GM.getValue(GUIDED_MODE_KEY, true);
            guidedMode &&
                (await new Promise((resolve) => setTimeout(resolve, 1500)));
            return guidedMode;
        } catch (error) {
            console.error("Error loading guided mode:", error);
            return false;
        }
    }

    async function setGuidedMode(guidedMode) {
        try {
            await GM.setValue(GUIDED_MODE_KEY, guidedMode);
        } catch (error) {
            console.error("Error saving guided mode:", error);
        }
    }

    // ==================== STATS COLLECTION STORAGE ====================
    function getEndDateKey() {
        return new Date().toDateString();
    }

    async function getStatsData() {
        try {
            const stored = await GM.getValue(STATS_STORAGE_KEY, "{}");
            return JSON.parse(stored);
        } catch (error) {
            console.error("Error loading stats data:", error);
            return {};
        }
    }

    async function saveStatsData(statsData) {
        try {
            await GM.setValue(STATS_STORAGE_KEY, JSON.stringify(statsData));
        } catch (error) {
            console.error("Error saving stats data:", error);
        }
    }

    async function checkIfStatsComplete(dateKey, petName) {
        const statsData = await getStatsData();
        if (!statsData[dateKey] || !statsData[dateKey][petName]) {
            return false;
        }
        const stats = statsData[dateKey][petName];
        return (
            stats.level &&
            stats.hp &&
            stats.strength &&
            stats.defence &&
            stats.movement
        );
    }

    async function checkIfLevelComplete(dateKey, petName) {
        const statsData = await getStatsData();
        if (!statsData[dateKey] || !statsData[dateKey][petName]) {
            return false;
        }
        const stats = statsData[dateKey][petName];
        return !!stats.level;
    }

    async function checkIfPetStatsComplete(dateKey, petName) {
        const statsData = await getStatsData();
        if (!statsData[dateKey] || !statsData[dateKey][petName]) {
            return false;
        }
        const stats = statsData[dateKey][petName];
        return (
            !!stats.hp &&
            !!stats.strength &&
            !!stats.defence &&
            !!stats.movement
        );
    }

    async function savePetStats(dateKey, petName, owner, stats) {
        const statsData = await getStatsData();
        if (!statsData[dateKey]) {
            statsData[dateKey] = {};
        }
        // Merge with existing data to support partial stats collection
        const existingStats = statsData[dateKey][petName] || {};
        const mergedStats = { ...existingStats, owner, ...stats };
        // Calculate total when saving
        const total =
            (mergedStats.level || 0) +
            (mergedStats.hp || 0) +
            (mergedStats.strength || 0) +
            (mergedStats.defence || 0) +
            (mergedStats.movement || 0);
        statsData[dateKey][petName] = { ...mergedStats, total };
        await saveStatsData(statsData);
    }

    async function getAvailableDates() {
        const statsData = await getStatsData();
        const dates = Object.keys(statsData);
        // Sort dates in descending order (most recent first)
        return dates.sort((a, b) => new Date(b) - new Date(a));
    }

    async function getStatsForDate(dateKey) {
        const statsData = await getStatsData();
        if (!statsData[dateKey]) {
            return [];
        }

        const results = [];
        for (const [petName, stats] of Object.entries(statsData[dateKey])) {
            results.push({
                pet: petName,
                owner: stats.owner || "Unknown",
                level: stats.level || "-",
                hp: stats.hp || "-",
                strength: stats.strength || "-",
                defence: stats.defence || "-",
                movement: stats.movement || "-",
                total: stats.total || "-",
            });
        }
        return results;
    }

    // ==================== DOM EXTRACTION FUNCTIONS ====================
    async function retryExtraction(
        extractionFn,
        maxAttempts = 3,
        delays = [0, 2000, 5000]
    ) {
        for (let i = 0; i < maxAttempts; i++) {
            if (delays[i] > 0) {
                await new Promise((resolve) => setTimeout(resolve, delays[i]));
            }

            const result = extractionFn();
            if (result !== null && result !== undefined) {
                return result;
            }

            console.log(
                `Extraction attempt ${i + 1} failed, ${
                    i < maxAttempts - 1 ? "retrying..." : "giving up"
                }`
            );
        }
        return null;
    }

    function extractLevelForPet(targetPetName) {
        try {
            const containers = eval(ALL_PETS_CONTAINERS_SELECTOR);
            for (const container of containers) {
                const petName = eval(PET_NAME_FROM_CONTAINERS_SELECTOR);
                if (petName === targetPetName) {
                    const level = eval(PET_LEVEL_FROM_CONTAINERS_SELECTOR);
                    return parseInt(level);
                }
            }
            return null;
        } catch (error) {
            console.error("Error extracting level:", error);
            return null;
        }
    }

    function extractPetStats() {
        try {
            const petStatsTd = eval(PET_STATS_TD_SELECTOR);
            const hp = parseInt(eval(PET_HP_SELECTOR));
            const strength = parseInt(eval(PET_STRENGTH_SELECTOR));
            const defence = parseInt(eval(PET_DEFENCE_SELECTOR));
            const movement = parseInt(eval(PET_MOVEMENT_SELECTOR));
            return { hp, strength, defence, movement };
        } catch (error) {
            console.error("Error extracting stats:", error);
            return null;
        }
    }

    // ==================== SMART NAVIGATION ====================
    /**
     * Determines the next page that needs to be visited for data collection.
     * Returns { index, stage } where stage is "userlookup" or "petlookup",
     * or null if all pets have complete stats.
     */
    async function determineNextNavigation(startFromIndex = 0) {
        const pairings = await getOwnerPetPairings();
        const dateKey = getEndDateKey();

        // Check each pet starting from the given index
        for (let i = startFromIndex; i < pairings.length; i++) {
            const pet = pairings[i].pet;

            // Check if we need level for this pet
            const hasLevel = await checkIfLevelComplete(dateKey, pet);
            if (!hasLevel) {
                console.log(`Next needed: Level for ${pet} (index ${i})`);
                return { index: i, stage: "userlookup" };
            }

            // Check if we need stats for this pet
            const hasStats = await checkIfPetStatsComplete(dateKey, pet);
            if (!hasStats) {
                console.log(`Next needed: Stats for ${pet} (index ${i})`);
                return { index: i, stage: "petlookup" };
            }

            // This pet is complete, continue to next pet
            console.log(`Skipping ${pet} (index ${i}) - already complete`);
        }

        // All pets have complete stats
        console.log("All pets have complete stats for today");
        return null;
    }

    // ==================== COLLECTION WORKFLOW ====================
    async function startCollection() {
        const pairings = await getOwnerPetPairings();
        if (pairings.length === 0) {
            alert("No pairings to collect! Add some first.");
            return;
        }

        // Find the first page that needs to be visited
        const nextNav = await determineNextNavigation(0);

        if (!nextNav) {
            alert("All pets already have complete stats for today!");
            return;
        }

        // Count how many pets still need data
        const dateKey = getEndDateKey();
        let remainingCount = 0;
        for (let i = 0; i < pairings.length; i++) {
            const hasStats = await checkIfStatsComplete(
                dateKey,
                pairings[i].pet
            );
            if (!hasStats) {
                remainingCount++;
            }
        }

        if (
            !confirm(
                `Collect stats for ${remainingCount} ${
                    remainingCount === 1 ? "pet" : "pets"
                }? This will navigate through multiple pages.`
            )
        ) {
            return;
        }

        await GM.setValue(COLLECTING_FLAG_KEY, true);
        await GM.setValue(COLLECTION_INDEX_KEY, nextNav.index);
        await GM.setValue(COLLECTION_STAGE_KEY, nextNav.stage);

        const targetPairing = pairings[nextNav.index];
        if (nextNav.stage === "userlookup") {
            window.location.href = BASE_USERLOOKUP_URL + targetPairing.owner;
        } else {
            window.location.href = BASE_PETLOOKUP_URL + targetPairing.pet;
        }
    }

    async function handleUserlookup() {
        const isCollecting = await GM.getValue(COLLECTING_FLAG_KEY, false);
        if (!isCollecting) return;

        const stage = await GM.getValue(COLLECTION_STAGE_KEY);
        if (stage !== "userlookup") return;

        const index = await GM.getValue(COLLECTION_INDEX_KEY, 0);
        const pairings = await getOwnerPetPairings();
        if (index >= pairings.length) return;

        const currentPairing = pairings[index];
        const urlParams = new URLSearchParams(window.location.search);
        const currentUser = urlParams.get("user");

        if (currentUser !== currentPairing.owner) return;

        const dateKey = getEndDateKey();
        const levelAlreadyComplete = await checkIfLevelComplete(
            dateKey,
            currentPairing.pet
        );

        let extractedLevel = null;
        // Only collect if not already complete
        if (!levelAlreadyComplete) {
            // Retry extraction with delays if not found
            extractedLevel = await retryExtraction(() =>
                extractLevelForPet(currentPairing.pet)
            );
            if (extractedLevel === null) {
                console.error(
                    "Could not extract level for",
                    currentPairing.pet,
                    "after multiple attempts"
                );
                return;
            }

            await savePetStats(
                dateKey,
                currentPairing.pet,
                currentPairing.owner,
                {
                    level: extractedLevel,
                }
            );

            // Update modal to show the new checkmark
            await updateModal();
        }

        const guidedMode = await getGuidedMode();
        if (guidedMode) {
            // Check if this pet needs stats collected
            const needsStats = !(await checkIfPetStatsComplete(
                dateKey,
                currentPairing.pet
            ));

            if (needsStats) {
                // Go collect stats for this pet
                // Use the already extracted level if we just collected it, otherwise extract it
                if (extractedLevel === null) {
                    extractedLevel = await retryExtraction(() =>
                        extractLevelForPet(currentPairing.pet)
                    );
                }
                await GM.setValue(TEMP_LEVEL_KEY, extractedLevel);
                await GM.setValue(COLLECTION_STAGE_KEY, "petlookup");

                if (
                    confirm(`Continue to pet lookup for ${currentPairing.pet}?`)
                ) {
                    window.location.href =
                        BASE_PETLOOKUP_URL + currentPairing.pet;
                } else {
                    // User cancelled, stop collection
                    await GM.setValue(COLLECTING_FLAG_KEY, false);
                    await GM.setValue(COLLECTION_INDEX_KEY, 0);
                    await GM.setValue(TEMP_LEVEL_KEY, null);
                }
            } else {
                // This pet already has stats, find next page to visit
                console.log(
                    `${currentPairing.pet} already has stats, finding next target...`
                );
                const nextNav = await determineNextNavigation(index + 1);

                if (nextNav) {
                    await GM.setValue(COLLECTION_INDEX_KEY, nextNav.index);
                    await GM.setValue(COLLECTION_STAGE_KEY, nextNav.stage);

                    const nextPairing = pairings[nextNav.index];
                    const nextPageType =
                        nextNav.stage === "userlookup"
                            ? "user lookup"
                            : "pet lookup";
                    const nextTarget =
                        nextNav.stage === "userlookup"
                            ? nextPairing.owner
                            : nextPairing.pet;

                    if (
                        confirm(
                            `Continue to ${nextPageType} for ${nextTarget}?`
                        )
                    ) {
                        if (nextNav.stage === "userlookup") {
                            window.location.href =
                                BASE_USERLOOKUP_URL + nextPairing.owner;
                        } else {
                            window.location.href =
                                BASE_PETLOOKUP_URL + nextPairing.pet;
                        }
                    } else {
                        // User cancelled, stop collection
                        await GM.setValue(COLLECTING_FLAG_KEY, false);
                        await GM.setValue(COLLECTION_INDEX_KEY, 0);
                        await GM.setValue(TEMP_LEVEL_KEY, null);
                    }
                } else {
                    // Collection complete
                    await GM.setValue(COLLECTING_FLAG_KEY, false);
                    await GM.setValue(COLLECTION_INDEX_KEY, 0);
                    await GM.setValue(TEMP_LEVEL_KEY, null);
                    window.location.href = KOTB_PETPAGE;
                }
            }
        } else {
            // Manual mode: end collection
            await GM.setValue(COLLECTING_FLAG_KEY, false);
            await GM.setValue(COLLECTION_STAGE_KEY, null);
        }
    }

    async function handlePetlookup() {
        const isCollecting = await GM.getValue(COLLECTING_FLAG_KEY, false);
        if (!isCollecting) return;

        const stage = await GM.getValue(COLLECTION_STAGE_KEY);
        if (stage !== "petlookup") return;

        const index = await GM.getValue(COLLECTION_INDEX_KEY, 0);
        const pairings = await getOwnerPetPairings();
        if (index >= pairings.length) return;

        const currentPairing = pairings[index];

        // Verify we're on the correct pet's page by searching for the pet name in contentModuleContent
        const verifyPetPage = () => {
            try {
                const contentModules = document.querySelectorAll(
                    ".contentModuleContent"
                );
                for (const module of contentModules) {
                    const boldElements = module.querySelectorAll("b");
                    for (const bold of boldElements) {
                        if (bold.textContent.trim() === currentPairing.pet) {
                            return true;
                        }
                    }
                }
                return false;
            } catch (error) {
                console.error("Error verifying pet page:", error);
                return false;
            }
        };

        // Retry verification with delays if not found
        const isCorrectPet = await retryExtraction(verifyPetPage);
        if (!isCorrectPet) {
            console.error(
                "Not on the correct pet page for",
                currentPairing.pet
            );
            return;
        }

        const dateKey = getEndDateKey();
        const petStatsAlreadyComplete = await checkIfPetStatsComplete(
            dateKey,
            currentPairing.pet
        );
        const alreadyComplete = await checkIfStatsComplete(
            dateKey,
            currentPairing.pet
        );

        if (!petStatsAlreadyComplete) {
            // Retry extraction with delays if not found
            const stats = await retryExtraction(() => extractPetStats());
            if (stats === null) {
                console.error(
                    "Could not extract stats for",
                    currentPairing.pet,
                    "after multiple attempts"
                );
                return;
            }

            const level = await GM.getValue(TEMP_LEVEL_KEY);
            const statsToSave = { ...stats };
            // Only include level if it's valid (set in guided mode)
            if (level !== null && level !== undefined) {
                statsToSave.level = level;
            }
            await savePetStats(
                dateKey,
                currentPairing.pet,
                currentPairing.owner,
                statsToSave
            );

            // Update modal to show the new checkmark
            await updateModal();
        }

        const guidedMode = await getGuidedMode();
        if (guidedMode) {
            // Find the next page that needs to be visited
            // Start from index+1 since we just finished the current pet
            const nextNav = await determineNextNavigation(index + 1);

            if (nextNav) {
                await GM.setValue(COLLECTION_INDEX_KEY, nextNav.index);
                await GM.setValue(COLLECTION_STAGE_KEY, nextNav.stage);

                const nextPairing = pairings[nextNav.index];
                const nextPageType =
                    nextNav.stage === "userlookup"
                        ? "user lookup"
                        : "pet lookup";
                const nextTarget =
                    nextNav.stage === "userlookup"
                        ? nextPairing.owner
                        : nextPairing.pet;

                if (confirm(`Continue to ${nextPageType} for ${nextTarget}?`)) {
                    if (nextNav.stage === "userlookup") {
                        window.location.href =
                            BASE_USERLOOKUP_URL + nextPairing.owner;
                    } else {
                        window.location.href =
                            BASE_PETLOOKUP_URL + nextPairing.pet;
                    }
                } else {
                    // User cancelled, stop collection
                    await GM.setValue(COLLECTING_FLAG_KEY, false);
                    await GM.setValue(COLLECTION_INDEX_KEY, 0);
                    await GM.setValue(TEMP_LEVEL_KEY, null);
                }
            } else {
                // Collection complete
                await GM.setValue(COLLECTING_FLAG_KEY, false);
                await GM.setValue(COLLECTION_INDEX_KEY, 0);
                await GM.setValue(TEMP_LEVEL_KEY, null);

                window.location.href = KOTB_PETPAGE;
            }
        } else {
            // Manual mode: end collection
            await GM.setValue(COLLECTING_FLAG_KEY, false);
            await GM.setValue(COLLECTION_STAGE_KEY, null);
        }
    }

    // ==================== MODAL TOGGLE BUTTON ====================
    function createToggleButton(onToggle) {
        const toggleBtn = document.createElement("button");
        toggleBtn.id = CONFIG.IDS.TOGGLE_BTN;
        toggleBtn.innerHTML = CONFIG.ICONS.TOGGLE;
        toggleBtn.title = "Toggle KOTB tracker modal";

        Object.assign(toggleBtn.style, {
            position: "fixed",
            top: "20px",
            left: "20px",
            backgroundColor: "#333",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "12px",
            cursor: "pointer",
            zIndex: CONFIG.MODAL.TOGGLE_Z_INDEX,
            fontSize: "20px",
            boxShadow: "2px 2px 8px rgba(0,0,0,0.2)",
            transition: "background-color 0.3s",
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
        overlay.id = "kotb-overlay";

        Object.assign(overlay.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: String(parseInt(CONFIG.MODAL.Z_INDEX) - 1),
            opacity: "0",
            visibility: "hidden",
            pointerEvents: "none",
            transition: "opacity 0.3s ease-in-out, visibility 0.3s ease-in-out",
        });

        return overlay;
    }

    // ==================== MODAL WRAPPER ====================
    function createModalWrapper() {
        const modalWrapper = document.createElement("div");
        modalWrapper.id = CONFIG.IDS.MODAL_WRAPPER;

        Object.assign(modalWrapper.style, {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) scale(0.95)",
            width: CONFIG.MODAL.WIDTH,
            maxWidth: CONFIG.MODAL.MAX_WIDTH,
            height: CONFIG.MODAL.MAX_HEIGHT,
            backgroundColor: "#fff",
            borderRadius: "12px",
            zIndex: CONFIG.MODAL.Z_INDEX,
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            opacity: "0",
            visibility: "hidden",
            transition:
                "opacity 0.3s ease-in-out, visibility 0.3s ease-in-out, transform 0.3s ease-in-out",
            display: "flex",
            flexDirection: "column",
        });

        const modal = document.createElement("div");
        modal.id = CONFIG.IDS.MODAL;

        Object.assign(modal.style, {
            width: "100%",
            height: "100%",
            padding: "20px",
            fontFamily: FONT_FAMILY,
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
        });

        modalWrapper.appendChild(modal);
        return modalWrapper;
    }

    // ==================== MODAL STATE MANAGER ====================
    const ModalManager = {
        isOpen: false,
        toggleBtn: null,
        modalWrapper: null,
        overlay: null,

        async initialize() {
            this.toggleBtn = createToggleButton(() => this.toggle());
            this.modalWrapper = createModalWrapper();
            this.overlay = createOverlay();

            document.body.appendChild(this.overlay);
            document.body.appendChild(this.modalWrapper);
            document.body.appendChild(this.toggleBtn);

            this.setupOutsideClickHandler();

            // Restore modal state from storage
            const savedOpen = await GM.getValue(MODAL_OPEN_KEY, false);
            if (savedOpen) {
                this.isOpen = true;
                this.updateModalPosition();
            }
        },

        async toggle() {
            this.isOpen = !this.isOpen;
            await GM.setValue(MODAL_OPEN_KEY, this.isOpen);
            this.updateModalPosition();
        },

        async close() {
            if (this.isOpen) {
                this.isOpen = false;
                await GM.setValue(MODAL_OPEN_KEY, false);
                this.updateModalPosition();
            }
        },

        updateModalPosition() {
            if (this.isOpen) {
                this.modalWrapper.style.opacity = "1";
                this.modalWrapper.style.visibility = "visible";
                this.modalWrapper.style.transform =
                    "translate(-50%, -50%) scale(1)";
                this.overlay.style.opacity = "1";
                this.overlay.style.visibility = "visible";
                this.overlay.style.pointerEvents = "auto";
                document.body.style.overflow = "hidden";
            } else {
                this.modalWrapper.style.opacity = "0";
                this.modalWrapper.style.visibility = "hidden";
                this.modalWrapper.style.transform =
                    "translate(-50%, -50%) scale(0.95)";
                this.overlay.style.opacity = "0";
                this.overlay.style.visibility = "hidden";
                this.overlay.style.pointerEvents = "none";
                document.body.style.overflow = "";
            }
        },

        setupOutsideClickHandler() {
            document.addEventListener("click", (e) => {
                if (
                    this.isOpen &&
                    !this.modalWrapper.contains(e.target) &&
                    !this.toggleBtn.contains(e.target)
                ) {
                    this.close();
                }
            });

            if (this.overlay) {
                this.overlay.addEventListener("click", () => {
                    if (this.isOpen) {
                        this.close();
                    }
                });
            }
        },
    };

    // ==================== MODAL HELPERS ====================
    async function openModalToCollection() {
        // Switch to collection tab
        await setActiveTab("collection");

        // Open modal
        if (!ModalManager.isOpen) {
            ModalManager.isOpen = true;
            await GM.setValue(MODAL_OPEN_KEY, true);
            ModalManager.updateModalPosition();
        }

        // Update modal content
        await updateModal();
    }

    // ==================== TAB SYSTEM ====================
    async function getActiveTab() {
        try {
            return await GM.getValue(ACTIVE_TAB_KEY, "collection");
        } catch (error) {
            return "collection";
        }
    }

    async function setActiveTab(tab) {
        try {
            await GM.setValue(ACTIVE_TAB_KEY, tab);
        } catch (error) {
            console.error("Error saving active tab:", error);
        }
    }

    function renderTabButtons(activeTab, theme) {
        return `
            <div style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 2px solid ${
                theme.headerBorder
            }; flex-shrink: 0;">
                <button 
                    class="kotb-tab-btn" 
                    data-tab="collection" 
                    style="
                        padding: 10px 20px; 
                        background: ${
                            activeTab === "collection"
                                ? theme.buttonBg
                                : "transparent"
                        }; 
                        color: ${
                            activeTab === "collection"
                                ? theme.buttonText
                                : theme.headerText
                        }; 
                        border: none; 
                        border-bottom: 3px solid ${
                            activeTab === "collection"
                                ? theme.buttonBg
                                : "transparent"
                        };
                        cursor: pointer; 
                        font-size: 12pt; 
                        font-weight: bold;
                        border-radius: 4px 4px 0 0;
                    ">
                    Collection
                </button>
                <button 
                    class="kotb-tab-btn" 
                    data-tab="list" 
                    style="
                        padding: 10px 20px; 
                        background: ${
                            activeTab === "list"
                                ? theme.buttonBg
                                : "transparent"
                        }; 
                        color: ${
                            activeTab === "list"
                                ? theme.buttonText
                                : theme.headerText
                        }; 
                        border: none; 
                        border-bottom: 3px solid ${
                            activeTab === "list"
                                ? theme.buttonBg
                                : "transparent"
                        };
                        cursor: pointer; 
                        font-size: 12pt; 
                        font-weight: bold;
                        border-radius: 4px 4px 0 0;
                    ">
                    List Management
                </button>
                <button 
                    class="kotb-tab-btn" 
                    data-tab="stats-view" 
                    style="
                        padding: 10px 20px; 
                        background: ${
                            activeTab === "stats-view"
                                ? theme.buttonBg
                                : "transparent"
                        }; 
                        color: ${
                            activeTab === "stats-view"
                                ? theme.buttonText
                                : theme.headerText
                        }; 
                        border: none; 
                        border-bottom: 3px solid ${
                            activeTab === "stats-view"
                                ? theme.buttonBg
                                : "transparent"
                        };
                        cursor: pointer; 
                        font-size: 12pt; 
                        font-weight: bold;
                        border-radius: 4px 4px 0 0;
                    ">
                    View Stats
                </button>
                <button 
                    class="kotb-tab-btn" 
                    data-tab="export" 
                    style="
                        padding: 10px 20px; 
                        background: ${
                            activeTab === "export"
                                ? theme.buttonBg
                                : "transparent"
                        }; 
                        color: ${
                            activeTab === "export"
                                ? theme.buttonText
                                : theme.headerText
                        }; 
                        border: none; 
                        border-bottom: 3px solid ${
                            activeTab === "export"
                                ? theme.buttonBg
                                : "transparent"
                        };
                        cursor: pointer; 
                        font-size: 12pt; 
                        font-weight: bold;
                        border-radius: 4px 4px 0 0;
                    ">
                    Compare
                </button>
            </div>
        `;
    }

    function renderTabContent(activeTab, pairings, theme) {
        if (activeTab === "list") {
            const form = renderAddForm(theme);
            const listHeader = `
                <h3 style="margin: 0 0 12px 0; color: ${theme.headerText}; font-size: 14pt; font-family: ${FONT_FAMILY}; flex-shrink: 0;">
                    Tracked Pairings (${pairings.length})
                </h3>
            `;
            const list =
                pairings.length === 0
                    ? renderEmptyState(theme)
                    : pairings.map((p) => renderPairingItem(p, theme)).join("");
            return `
                <div style="display: flex; gap: 20px; align-items: stretch; flex: 1; min-height: 0;">
                    <div style="flex: 0 0 auto; width: 100%; max-width: 450px;">
                        ${form}
                    </div>
                    <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0;">
                        ${listHeader}
                        <div style="overflow-y: auto; flex: 1; min-height: 0;">${list}</div>
                    </div>
                </div>
            `;
        }
        return "";
    }

    async function renderCollectionTab(theme, pairings, dateKey) {
        if (pairings.length === 0) {
            return `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; padding: 40px;">
                    <div style="text-align: center; color: ${theme.emptyText};">
                        No pairings added yet. Go to List Management to add pairings.
                    </div>
                </div>
            `;
        }

        // Guided collection button at the top
        const guidedCollectionSection = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 20px; background: ${
                theme.formBg
            }; border: 2px solid ${
            theme.formBorder
        }; border-radius: 8px; margin-bottom: 20px;">
                <p style="color: ${
                    theme.labelText
                }; font-size: 11pt; font-family: ${FONT_FAMILY}; margin: 0; text-align: center;">
                    Collect stats for all ${pairings.length} ${
            pairings.length === 1 ? "pet" : "pets"
        } with guided navigation
                </p>
                <button id="kotb-collect-stats-btn" style="padding: 12px 24px; background: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 12pt; font-weight: bold; font-family: ${FONT_FAMILY}; box-shadow: 0 2px 8px rgba(0,0,0,0.2); transition: transform 0.2s;">
                    📊 Guided Collection
                </button>
            </div>
        `;

        // Manual mode - render list of pairings with individual buttons in two columns
        const rows = await Promise.all(
            pairings.map(async (pairing) => {
                const levelComplete = await checkIfLevelComplete(
                    dateKey,
                    pairing.pet
                );
                const petStatsComplete = await checkIfPetStatsComplete(
                    dateKey,
                    pairing.pet
                );
                const allComplete = await checkIfStatsComplete(
                    dateKey,
                    pairing.pet
                );

                const borderColor = allComplete ? "#28a745" : theme.itemBorder;
                const levelBadge = levelComplete
                    ? '<span style="padding: 2px 8px; background: #28a745; color: white; border-radius: 4px; font-size: 9pt;">✓</span>'
                    : '<span style="width: 24px;"></span>';
                const statsBadge = petStatsComplete
                    ? '<span style="padding: 2px 8px; background: #28a745; color: white; border-radius: 4px; font-size: 9pt;">✓</span>'
                    : '<span style="width: 24px;"></span>';

                return `
                <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: ${theme.itemBg}; border: 2px solid ${borderColor}; border-radius: 6px;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="color: ${theme.ownerText}; font-weight: bold; font-size: 11pt; font-family: ${FONT_FAMILY}; margin-bottom: 4px;">
                            ${pairing.owner}
                        </div>
                        <div style="color: ${theme.petText}; font-size: 10pt; font-family: ${FONT_FAMILY};">
                            ${pairing.pet}
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <button class="kotb-visit-user-btn" data-owner="${pairing.owner}" style="padding: 6px 12px; background: ${theme.buttonBg}; color: ${theme.buttonText}; border: none; border-radius: 4px; cursor: pointer; font-size: 11pt; font-weight: bold; font-family: ${FONT_FAMILY}; white-space: nowrap; transition: opacity 0.2s; min-width: 120px; height: 36px; display: inline-flex; align-items: center; justify-content: space-between;">
                            <span>Get Level</span>${levelBadge}
                        </button>
                        <button class="kotb-visit-pet-btn" data-pet="${pairing.pet}" style="padding: 6px 12px; background: ${theme.buttonBg}; color: ${theme.buttonText}; border: none; border-radius: 4px; cursor: pointer; font-size: 11pt; font-weight: bold; font-family: ${FONT_FAMILY}; white-space: nowrap; transition: opacity 0.2s; min-width: 120px; height: 36px; display: inline-flex; align-items: center; justify-content: space-between;">
                            <span>Get Stats</span>${statsBadge}
                        </button>
                    </div>
                </div>
            `;
            })
        );

        const manualCollectionSection = `
            <div class="kotb-collection-grid">
                ${rows.join("")}
            </div>
        `;

        return `
            <div style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                ${guidedCollectionSection}
                <div style="overflow-y: auto; flex: 1; min-height: 0;">
                    ${manualCollectionSection}
                </div>
            </div>
        `;
    }

    function renderStatsView(theme, selectedDate, sortColumn, sortDirection) {
        // This will be populated dynamically
        return `
            <div style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                <div style="margin-bottom: 16px; flex-shrink: 0; text-align: left;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold; color: ${theme.labelText}; font-size: 11pt; font-family: ${FONT_FAMILY};">Select Date:</label>
                    <select id="kotb-date-select" style="width: 100%; max-width: 300px; padding: 8px; border: 1px solid ${theme.inputBorder}; border-radius: 4px; font-size: 11pt; font-family: ${FONT_FAMILY}; background: ${theme.inputBg}; color: ${theme.inputText}; cursor: pointer;">
                        <option value="">Loading...</option>
                    </select>
                </div>
                <div style="overflow-y: auto; flex: 1; min-height: 0;">
                    <table id="kotb-stats-table" style="width: 100%; border-collapse: collapse; background: ${theme.itemBg}; table-layout: fixed;">
                        <thead>
                            <tr style="background: ${theme.formBg}; border-bottom: 2px solid ${theme.headerBorder};">
                                <th data-column="owner" style="width: 20%; padding: 12px; text-align: left; cursor: pointer; color: ${theme.headerText}; font-size: 11pt; font-weight: 600; font-family: ${FONT_FAMILY}; user-select: none;">
                                    Owner <span class="sort-arrow"></span>
                                </th>
                                <th data-column="pet" style="width: 20%; padding: 12px; text-align: left; cursor: pointer; color: ${theme.headerText}; font-size: 11pt; font-weight: 600; font-family: ${FONT_FAMILY}; user-select: none;">
                                    Pet <span class="sort-arrow"></span>
                                </th>
                                <th data-column="level" style="width: 12%; padding: 12px; text-align: right; cursor: pointer; color: ${theme.headerText}; font-size: 11pt; font-weight: 600; font-family: ${FONT_FAMILY}; user-select: none;">
                                    Level <span class="sort-arrow"></span>
                                </th>
                                <th data-column="hp" style="width: 12%; padding: 12px; text-align: right; cursor: pointer; color: ${theme.headerText}; font-size: 11pt; font-weight: 600; font-family: ${FONT_FAMILY}; user-select: none;">
                                    HP <span class="sort-arrow"></span>
                                </th>
                                <th data-column="strength" style="width: 12%; padding: 12px; text-align: right; cursor: pointer; color: ${theme.headerText}; font-size: 11pt; font-weight: 600; font-family: ${FONT_FAMILY}; user-select: none;">
                                    Strength <span class="sort-arrow"></span>
                                </th>
                                <th data-column="defence" style="width: 12%; padding: 12px; text-align: right; cursor: pointer; color: ${theme.headerText}; font-size: 11pt; font-weight: 600; font-family: ${FONT_FAMILY}; user-select: none;">
                                    Defence <span class="sort-arrow"></span>
                                </th>
                                <th data-column="movement" style="width: 12%; padding: 12px; text-align: right; cursor: pointer; color: ${theme.headerText}; font-size: 11pt; font-weight: 600; font-family: ${FONT_FAMILY}; user-select: none;">
                                    Movement <span class="sort-arrow"></span>
                                </th>
                                <th data-column="total" style="width: 12%; padding: 12px; text-align: right; cursor: pointer; color: ${theme.headerText}; font-size: 11pt; font-weight: 600; font-family: ${FONT_FAMILY}; user-select: none;">
                                    Total <span class="sort-arrow"></span>
                                </th>
                            </tr>
                        </thead>
                        <tbody id="kotb-stats-tbody">
                            <tr>
                                <td colspan="8" style="padding: 20px; text-align: center; color: ${theme.emptyText};">Loading stats...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ==================== COMPARE FUNCTIONS ====================
    function getRankingFromGain(gain) {
        if (gain >= 5 && gain <= 25) return { name: "Grasshopper", points: 1 };
        if (gain >= 26 && gain <= 50) return { name: "Trainee", points: 3 };
        if (gain >= 51 && gain <= 75) return { name: "Master", points: 6 };
        if (gain >= 76 && gain <= 125)
            return { name: "Grand Master", points: 8 };
        if (gain >= 126 && gain <= 175)
            return { name: "Techo Master", points: 10 };
        if (gain >= 176) return { name: "Guru", points: 12 };
        return { name: "-", points: 0 };
    }

    async function calculateCompareData(endDateKey, startDateKey) {
        const endStats = await getStatsForDate(endDateKey);
        const startStats = await getStatsForDate(startDateKey);

        // Create a map of start stats for easy lookup
        const startMap = new Map();
        startStats.forEach((stat) => {
            startMap.set(stat.pet, stat);
        });

        // Calculate compare data for each pet in end stats
        const compareData = [];
        for (const end of endStats) {
            const start = startMap.get(end.pet);

            // Convert "-" to 0 for calculations
            const endTotal = end.total === "-" ? 0 : end.total;
            const startTotal = start && start.total !== "-" ? start.total : 0;

            let initial = "-";
            let gain = "-";
            let ranking = "-";
            let points = 0;
            let levelGain = null;
            let hpGain = null;
            let strengthGain = null;
            let defenceGain = null;
            let movementGain = null;

            if (start) {
                initial = start.total;
                if (endTotal !== 0 && startTotal !== 0) {
                    const gainValue = endTotal - startTotal;
                    gain = gainValue;
                    const rankData = getRankingFromGain(gainValue);
                    ranking = rankData.name;
                    points = rankData.points;
                }

                // Calculate individual stat gains
                const endLevel = end.level === "-" ? 0 : end.level;
                const startLevel = start.level === "-" ? 0 : start.level;
                const endHP = end.hp === "-" ? 0 : end.hp;
                const startHP = start.hp === "-" ? 0 : start.hp;
                const endStr = end.strength === "-" ? 0 : end.strength;
                const startStr = start.strength === "-" ? 0 : start.strength;
                const endDef = end.defence === "-" ? 0 : end.defence;
                const startDef = start.defence === "-" ? 0 : start.defence;
                const endMove = end.movement === "-" ? 0 : end.movement;
                const startMove = start.movement === "-" ? 0 : start.movement;

                if (endLevel !== 0 && startLevel !== 0) {
                    const diff = endLevel - startLevel;
                    if (diff !== 0) levelGain = diff;
                }
                if (endHP !== 0 && startHP !== 0) {
                    const diff = endHP - startHP;
                    if (diff !== 0) hpGain = diff;
                }
                if (endStr !== 0 && startStr !== 0) {
                    const diff = endStr - startStr;
                    if (diff !== 0) strengthGain = diff;
                }
                if (endDef !== 0 && startDef !== 0) {
                    const diff = endDef - startDef;
                    if (diff !== 0) defenceGain = diff;
                }
                if (endMove !== 0 && startMove !== 0) {
                    const diff = endMove - startMove;
                    if (diff !== 0) movementGain = diff;
                }
            }

            compareData.push({
                owner: end.owner === "Unknown" ? "-" : end.owner,
                pet: end.pet,
                level: end.level,
                hp: end.hp,
                strength: end.strength,
                defence: end.defence,
                movement: end.movement,
                total: end.total,
                initial: initial,
                gain: gain,
                ranking: ranking,
                points: points,
                levelGain: levelGain,
                hpGain: hpGain,
                strengthGain: strengthGain,
                defenceGain: defenceGain,
                movementGain: movementGain,
            });
        }

        // Sort by Gain descending (treat "-" as lowest value), then by total descending
        compareData.sort((a, b) => {
            const gainA = a.gain === "-" ? -Infinity : a.gain;
            const gainB = b.gain === "-" ? -Infinity : b.gain;

            // Primary sort by Gain
            if (gainB !== gainA) {
                return gainB - gainA;
            }

            // Secondary sort by total (Current)
            const totalA = a.total === "-" ? -Infinity : a.total;
            const totalB = b.total === "-" ? -Infinity : b.total;
            return totalB - totalA;
        });

        return compareData;
    }

    function generateCSV(compareData) {
        // CSV header
        const header =
            "Warlord,Current,Initial,Gain,Ranking,Points,Pet,Level,HP,STR,def,move,total,warlord";

        // Function to escape CSV values
        const escapeCSV = (value) => {
            const str = String(value);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };

        // Generate rows
        const rows = compareData.map((data) => {
            return [
                escapeCSV(data.owner),
                escapeCSV(data.total),
                escapeCSV(data.initial),
                escapeCSV(data.gain),
                escapeCSV(data.ranking),
                escapeCSV(data.points),
                escapeCSV(data.pet),
                escapeCSV(data.level),
                escapeCSV(data.hp),
                escapeCSV(data.strength),
                escapeCSV(data.defence),
                escapeCSV(data.movement),
                escapeCSV(data.total),
                escapeCSV(data.owner),
            ].join(",");
        });

        return [header, ...rows].join("\n");
    }

    function downloadCSV(csvString, filename) {
        const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";

        const modalWrapper = document.getElementById(CONFIG.IDS.MODAL_WRAPPER);
        const container = modalWrapper || document.body;
        container.appendChild(link);
        link.click();
        container.removeChild(link);

        URL.revokeObjectURL(url);
    }

    function renderCompareView(theme) {
        return `
            <div style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                <div style="margin-bottom: 16px; flex-shrink: 0; display: flex; gap: 16px; align-items: flex-end;">
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 4px; font-weight: bold; color: ${theme.labelText}; font-size: 11pt; font-family: ${FONT_FAMILY};">Start Date:</label>
                        <select id="kotb-compare-start-date" style="width: 100%; max-width: 300px; padding: 8px; border: 1px solid ${theme.inputBorder}; border-radius: 4px; font-size: 11pt; font-family: ${FONT_FAMILY}; background: ${theme.inputBg}; color: ${theme.inputText}; cursor: pointer;">
                            <option value="">Loading...</option>
                        </select>
                    </div>
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 4px; font-weight: bold; color: ${theme.labelText}; font-size: 11pt; font-family: ${FONT_FAMILY};">End Date:</label>
                        <select id="kotb-compare-end-date" style="width: 100%; max-width: 300px; padding: 8px; border: 1px solid ${theme.inputBorder}; border-radius: 4px; font-size: 11pt; font-family: ${FONT_FAMILY}; background: ${theme.inputBg}; color: ${theme.inputText}; cursor: pointer;">
                            <option value="">Loading...</option>
                        </select>
                    </div>
                    <button id="kotb-download-csv-btn" style="padding: 8px 20px; background: ${theme.buttonBg}; color: ${theme.buttonText}; border: none; border-radius: 4px; cursor: pointer; font-size: 11pt; font-weight: bold; font-family: ${FONT_FAMILY}; white-space: nowrap;">
                        Download CSV
                    </button>
                </div>
                <div style="overflow-y: auto; flex: 1; min-height: 0;">
                    <table id="kotb-compare-table" style="width: 100%; border-collapse: collapse; background: ${theme.itemBg}; table-layout: fixed;">
                        <thead>
                            <tr style="background: ${theme.formBg}; border-bottom: 2px solid ${theme.headerBorder};">
                                <th style="width: 12%; padding: 12px; text-align: left; color: ${theme.headerText}; font-size: 11pt; font-weight: 600; font-family: ${FONT_FAMILY};">Owner</th>
                                <th style="width: 12%; padding: 12px; text-align: left; color: ${theme.headerText}; font-size: 11pt; font-weight: 600; font-family: ${FONT_FAMILY};">Pet</th>
                                <th style="width: 8%; padding: 12px; text-align: right; color: ${theme.headerText}; font-size: 11pt; font-weight: 600; font-family: ${FONT_FAMILY};">Level</th>
                                <th style="width: 8%; padding: 12px; text-align: right; color: ${theme.headerText}; font-size: 11pt; font-weight: 600; font-family: ${FONT_FAMILY};">HP</th>
                                <th style="width: 8%; padding: 12px; text-align: right; color: ${theme.headerText}; font-size: 11pt; font-weight: 600; font-family: ${FONT_FAMILY};">STR</th>
                                <th style="width: 8%; padding: 12px; text-align: right; color: ${theme.headerText}; font-size: 11pt; font-weight: 600; font-family: ${FONT_FAMILY};">DEF</th>
                                <th style="width: 8%; padding: 12px; text-align: right; color: ${theme.headerText}; font-size: 11pt; font-weight: 600; font-family: ${FONT_FAMILY};">MOVE</th>
                                <th style="width: 10%; padding: 12px; text-align: right; color: ${theme.headerText}; font-size: 11pt; font-weight: 600; font-family: ${FONT_FAMILY};">Total</th>
                                <th style="width: 10%; padding: 12px; text-align: left; color: ${theme.headerText}; font-size: 11pt; font-weight: 600; font-family: ${FONT_FAMILY};">Ranking</th>
                                <th style="width: 6%; padding: 12px; text-align: right; color: ${theme.headerText}; font-size: 11pt; font-weight: 600; font-family: ${FONT_FAMILY};">Points</th>
                            </tr>
                        </thead>
                        <tbody id="kotb-compare-tbody">
                            <tr>
                                <td colspan="10" style="padding: 20px; text-align: center; color: ${theme.emptyText};">Select dates to compare stats</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    async function loadCompareTable(endDateKey, startDateKey, theme) {
        const tbody = document.querySelector("#kotb-compare-tbody");
        if (!tbody) return;

        if (!endDateKey || !startDateKey) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="padding: 20px; text-align: center; color: ${theme.emptyText};">
                        Please select both dates
                    </td>
                </tr>
            `;
            return;
        }

        if (endDateKey === startDateKey) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="padding: 20px; text-align: center; color: ${theme.emptyText};">
                        Please select different dates
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="padding: 20px; text-align: center; color: ${theme.emptyText};">
                    Loading comparison...
                </td>
            </tr>
        `;

        try {
            const compareData = await calculateCompareData(
                endDateKey,
                startDateKey
            );

            if (compareData.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="10" style="padding: 20px; text-align: center; color: ${theme.emptyText};">
                            No data available for selected dates
                        </td>
                    </tr>
                `;
                return;
            }

            const rows = compareData
                .map((data, index) => {
                    const bgColor =
                        index % 2 === 0 ? theme.itemBg : theme.formBg;
                    return `
                    <tr style="background: ${bgColor}; border-bottom: 1px solid ${
                        theme.itemBorder
                    };">
                        <td style="padding: 10px; color: ${
                            theme.ownerText
                        }; font-size: 10pt; font-weight: bold; font-family: ${FONT_FAMILY};">${
                        data.owner
                    }</td>
                        <td style="padding: 10px; color: ${
                            theme.petText
                        }; font-size: 10pt; font-family: ${FONT_FAMILY};">${
                        data.pet
                    }</td>
                        <td style="padding: 10px; text-align: right; color: ${
                            theme.inputText
                        }; font-size: 10pt; font-family: ${FONT_FAMILY};">
                            ${data.level}${
                        data.levelGain !== null
                            ? ` <span style="color: ${
                                  data.levelGain >= 0 ? "#5cb85c" : "#d9534f"
                              }; font-size: 9pt;">(${
                                  data.levelGain >= 0 ? "+" : ""
                              }${data.levelGain})</span>`
                            : ""
                    }
                        </td>
                        <td style="padding: 10px; text-align: right; color: ${
                            theme.inputText
                        }; font-size: 10pt; font-family: ${FONT_FAMILY};">
                            ${data.hp}${
                        data.hpGain !== null
                            ? ` <span style="color: ${
                                  data.hpGain >= 0 ? "#5cb85c" : "#d9534f"
                              }; font-size: 9pt;">(${
                                  data.hpGain >= 0 ? "+" : ""
                              }${data.hpGain})</span>`
                            : ""
                    }
                        </td>
                        <td style="padding: 10px; text-align: right; color: ${
                            theme.inputText
                        }; font-size: 10pt; font-family: ${FONT_FAMILY};">
                            ${data.strength}${
                        data.strengthGain !== null
                            ? ` <span style="color: ${
                                  data.strengthGain >= 0 ? "#5cb85c" : "#d9534f"
                              }; font-size: 9pt;">(${
                                  data.strengthGain >= 0 ? "+" : ""
                              }${data.strengthGain})</span>`
                            : ""
                    }
                        </td>
                        <td style="padding: 10px; text-align: right; color: ${
                            theme.inputText
                        }; font-size: 10pt; font-family: ${FONT_FAMILY};">
                            ${data.defence}${
                        data.defenceGain !== null
                            ? ` <span style="color: ${
                                  data.defenceGain >= 0 ? "#5cb85c" : "#d9534f"
                              }; font-size: 9pt;">(${
                                  data.defenceGain >= 0 ? "+" : ""
                              }${data.defenceGain})</span>`
                            : ""
                    }
                        </td>
                        <td style="padding: 10px; text-align: right; color: ${
                            theme.inputText
                        }; font-size: 10pt; font-family: ${FONT_FAMILY};">
                            ${data.movement}${
                        data.movementGain !== null
                            ? ` <span style="color: ${
                                  data.movementGain >= 0 ? "#5cb85c" : "#d9534f"
                              }; font-size: 9pt;">(${
                                  data.movementGain >= 0 ? "+" : ""
                              }${data.movementGain})</span>`
                            : ""
                    }
                        </td>
                        <td style="padding: 10px; text-align: right; color: ${
                            theme.inputText
                        }; font-size: 10pt; font-weight: bold; font-family: ${FONT_FAMILY};">
                            ${data.total}${
                        data.gain !== "-" && data.gain !== 0
                            ? ` <span style="color: ${
                                  data.gain >= 0 ? "#5cb85c" : "#d9534f"
                              }; font-size: 9pt;">(${
                                  data.gain >= 0 ? "+" : ""
                              }${data.gain})</span>`
                            : ""
                    }
                        </td>
                        <td style="padding: 10px; color: ${
                            theme.inputText
                        }; font-size: 10pt; font-family: ${FONT_FAMILY};">${
                        data.ranking
                    }</td>
                        <td style="padding: 10px; text-align: right; color: ${
                            theme.inputText
                        }; font-size: 10pt; font-weight: bold; font-family: ${FONT_FAMILY};">${
                        data.points
                    }</td>
                    </tr>
                `;
                })
                .join("");

            tbody.innerHTML = rows;
        } catch (error) {
            console.error("Error loading comparison:", error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="padding: 20px; text-align: center; color: ${theme.removeBtn};">
                        Error loading comparison
                    </td>
                </tr>
            `;
        }
    }

    // ==================== PANEL RENDERING ====================
    function renderAddForm(theme) {
        return `
            <div style="padding: 15px; background: ${theme.formBg}; border-radius: 6px; border: 2px solid ${theme.formBorder};">
                <h3 style="margin: 0 0 12px 0; color: ${theme.labelText}; font-size: 14pt; font-family: ${FONT_FAMILY};">Add Owner/Pet Pairing</h3>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold; color: ${theme.labelText}; font-size: 11pt; font-family: ${FONT_FAMILY};">Owner:</label>
                    <input type="text" id="kotb-owner-input" placeholder="Username" autocomplete="off" style="width: 100%; padding: 8px; border: 1px solid ${theme.inputBorder}; border-radius: 4px; box-sizing: border-box; font-size: 11pt; font-family: ${FONT_FAMILY}; background: ${theme.inputBg}; color: ${theme.inputText};">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold; color: ${theme.labelText}; font-size: 11pt; font-family: ${FONT_FAMILY};">Pet:</label>
                    <input type="text" id="kotb-pet-input" placeholder="Pet name" autocomplete="off" style="width: 100%; padding: 8px; border: 1px solid ${theme.inputBorder}; border-radius: 4px; box-sizing: border-box; font-size: 11pt; font-family: ${FONT_FAMILY}; background: ${theme.inputBg}; color: ${theme.inputText};">
                </div>
                <button id="kotb-add-btn" style="width: 100%; padding: 10px; background: ${theme.buttonBg}; color: ${theme.buttonText}; border: none; border-radius: 4px; cursor: pointer; font-size: 12pt; font-weight: bold; font-family: ${FONT_FAMILY};">
                    Add Pairing
                </button>
            </div>
        `;
    }

    function renderEmptyState(theme) {
        return `
            <div style="color: ${theme.emptyText}; font-size: 11pt; font-family: ${FONT_FAMILY}; text-align: center; padding: 20px;">
                No pairings tracked yet
            </div>
        `;
    }

    function renderPairingItem(pairing, theme) {
        return `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding: 12px; background: ${theme.itemBg}; border-radius: 6px; border: 1px solid ${theme.itemBorder};">
                <div style="flex: 1;">
                    <div style="font-size: 12pt; font-weight: bold; font-family: ${FONT_FAMILY}; color: ${theme.ownerText}; margin-bottom: 4px;">
                        ${pairing.owner}
                    </div>
                    <div style="font-size: 11pt; font-family: ${FONT_FAMILY}; color: ${theme.petText};">
                        Pet: ${pairing.pet}
                    </div>
                </div>
                <button class="kotb-remove-btn" data-owner="${pairing.owner}" data-pet="${pairing.pet}" style="background: ${theme.removeBtn}; color: white; border: none; border-radius: 4px; padding: 8px 10px; cursor: pointer; font-size: 11pt; font-weight: bold; font-family: ${FONT_FAMILY}; transition: background-color 0.2s;">
                    ✖
                </button>
            </div>
        `;
    }

    async function renderModalContent(pairings, themeName, theme) {
        const activeTab = await getActiveTab();
        const url = window.location.href;
        const isOnLookupPage =
            url.includes("userlookup.phtml") || url.includes("petlookup.phtml");

        const header = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-shrink: 0; border-bottom: 2px solid ${
                theme.headerBorder
            }; padding-bottom: 8px;">
                <h2 style="margin: 0; color: ${
                    theme.headerText
                }; font-size: 16pt;">
                    KOTB Tracker
                </h2>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    ${
                        isOnLookupPage
                            ? `<button id="kotb-return-dashboard-btn" title="Return to Dashboard" style="background: ${theme.buttonBg}; color: ${theme.buttonText}; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 11pt; font-weight: bold;">
                        🏠 Dashboard
                    </button>`
                            : ""
                    }
                    <button id="kotb-theme-toggle" title="Toggle theme" style="background: ${
                        theme.toggleBg
                    }; color: ${theme.toggleText}; border: 1px solid ${
            theme.itemBorder
        }; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 11pt; font-weight: bold;">
                        ${themeName === "light" ? "🌙" : "☀️"}
                    </button>
                    <button id="kotb-close-btn" class="kotb-close-btn" title="Close modal" style="background: ${
                        theme.removeBtn
                    }; color: white; border: none; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 14pt; font-weight: bold; transition: background-color 0.2s;">
                        ✖
                    </button>
                </div>
            </div>
        `;

        const tabs = renderTabButtons(activeTab, theme);
        let content;
        if (activeTab === "stats-view") {
            content = renderStatsView(theme, null, "total", "desc");
        } else if (activeTab === "collection") {
            const dateKey = getEndDateKey();
            content = await renderCollectionTab(theme, pairings, dateKey);
        } else if (activeTab === "export") {
            content = renderCompareView(theme);
        } else {
            content = renderTabContent(activeTab, pairings, theme);
        }

        return `${header}<div style="display: flex; flex-direction: column; flex: 1; min-height: 0;">${tabs}${content}</div>`;
    }

    function attachModalListeners(modal) {
        // Return to Dashboard button
        const returnBtn = modal.querySelector("#kotb-return-dashboard-btn");
        if (returnBtn) {
            returnBtn.addEventListener("click", () => {
                window.location.href = KOTB_PETPAGE;
            });
        }

        // Close button
        const closeBtn = modal.querySelector("#kotb-close-btn");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                ModalManager.close();
            });
        }

        // Tab buttons
        const tabButtons = modal.querySelectorAll(".kotb-tab-btn");
        tabButtons.forEach((btn) => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const tab = btn.getAttribute("data-tab");
                await setActiveTab(tab);
                await updateModal();
            });
        });

        // Collection tab: Visit User buttons (manual mode)
        modal.querySelectorAll(".kotb-visit-user-btn").forEach((btn) => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const owner = btn.getAttribute("data-owner");

                // Set manual mode
                await setGuidedMode(false);

                // Find the pairing's index in the roster
                const pairings = await getOwnerPetPairings();
                const pairingIndex = pairings.findIndex(
                    (p) => p.owner === owner
                );

                if (pairingIndex >= 0) {
                    await GM.setValue(COLLECTING_FLAG_KEY, true);
                    await GM.setValue(COLLECTION_STAGE_KEY, "userlookup");
                    await GM.setValue(COLLECTION_INDEX_KEY, pairingIndex);
                    window.location.href = BASE_USERLOOKUP_URL + owner;
                }
            });
        });

        // Collection tab: Visit Pet buttons (manual mode)
        modal.querySelectorAll(".kotb-visit-pet-btn").forEach((btn) => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const pet = btn.getAttribute("data-pet");

                // Set manual mode
                await setGuidedMode(false);

                // Find the pairing's index in the roster
                const pairings = await getOwnerPetPairings();
                const pairingIndex = pairings.findIndex((p) => p.pet === pet);

                if (pairingIndex >= 0) {
                    await GM.setValue(COLLECTING_FLAG_KEY, true);
                    await GM.setValue(COLLECTION_STAGE_KEY, "petlookup");
                    await GM.setValue(COLLECTION_INDEX_KEY, pairingIndex);
                    window.location.href = BASE_PETLOOKUP_URL + pet;
                }
            });
        });

        // Collection tab: Collect Stats button (auto mode)
        const collectStatsBtn = modal.querySelector("#kotb-collect-stats-btn");
        if (collectStatsBtn) {
            collectStatsBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                // Set guided mode
                await setGuidedMode(true);
                await startCollection();
            });
        }

        // Prevent scroll propagation on the scrollable list container
        const scrollableList = modal.querySelector(
            '[style*="overflow-y: auto"]'
        );
        if (scrollableList) {
            scrollableList.addEventListener(
                "wheel",
                (e) => {
                    const isScrollingDown = e.deltaY > 0;
                    const isAtTop = scrollableList.scrollTop === 0;
                    const isAtBottom =
                        scrollableList.scrollTop +
                            scrollableList.clientHeight >=
                        scrollableList.scrollHeight - 1;

                    if (
                        (isAtTop && !isScrollingDown) ||
                        (isAtBottom && isScrollingDown)
                    ) {
                        e.preventDefault();
                    }
                },
                { passive: false }
            );
        }

        // Theme toggle
        const themeToggle = modal.querySelector("#kotb-theme-toggle");
        if (themeToggle) {
            themeToggle.addEventListener("click", async (e) => {
                e.stopPropagation();
                await toggleTheme();
            });
        }

        // Add button
        const addBtn = modal.querySelector("#kotb-add-btn");
        const ownerInput = modal.querySelector("#kotb-owner-input");
        const petInput = modal.querySelector("#kotb-pet-input");

        if (addBtn && ownerInput && petInput) {
            const handleAdd = async (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                const owner = ownerInput.value.trim();
                const pet = petInput.value.trim();

                if (owner && pet) {
                    const wasAdded = await addPairing(owner, pet);
                    if (wasAdded) {
                        ownerInput.value = "";
                        petInput.value = "";
                        await updateModal();
                        document.getElementById("kotb-owner-input")?.focus();
                    } else {
                        alert("This pairing already exists!");
                    }
                }
            };

            addBtn.addEventListener("click", handleAdd);

            // Allow Enter key in inputs
            ownerInput.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                }
            });

            petInput.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                }
            });
        }

        // Remove buttons
        modal.querySelectorAll(".kotb-remove-btn").forEach((btn) => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const owner = btn.getAttribute("data-owner");
                const pet = btn.getAttribute("data-pet");

                if (confirm(`Remove pairing: ${owner} / ${pet}?`)) {
                    await removePairing(owner, pet);
                    await updateModal();
                }
            });
        });

        // Stats view listeners
        const dateSelect = modal.querySelector("#kotb-date-select");
        if (dateSelect) {
            // Populate date dropdown
            (async () => {
                const availableDates = await getAvailableDates();
                if (availableDates.length === 0) {
                    dateSelect.innerHTML =
                        '<option value="">No data available</option>';

                    // Update table to show no data message
                    const tbody = modal.querySelector("#kotb-stats-tbody");
                    const themeName = await getTheme();
                    const theme = THEMES[themeName];
                    if (tbody) {
                        tbody.innerHTML = `
                            <tr>
                                <td colspan="8" style="padding: 20px; text-align: center; color: ${theme.emptyText};">
                                    No data available
                                </td>
                            </tr>
                        `;
                    }
                } else {
                    dateSelect.innerHTML = availableDates
                        .map(
                            (date) => `<option value="${date}">${date}</option>`
                        )
                        .join("");

                    // Load initial data for first date
                    const firstDate = availableDates[0];
                    await loadStatsTable(firstDate, "total", "desc");
                }
            })();

            // Handle date change
            dateSelect.addEventListener("change", async (e) => {
                const selectedDate = e.target.value;
                if (selectedDate) {
                    await loadStatsTable(selectedDate, "total", "desc");
                }
            });
        }

        // Column header click for sorting
        const columnHeaders = modal.querySelectorAll(
            "#kotb-stats-table th[data-column]"
        );
        columnHeaders.forEach((header) => {
            header.addEventListener("click", async () => {
                const column = header.getAttribute("data-column");

                // Determine sort direction based on column type
                // Text columns (owner, pet) sort ascending, numeric columns sort descending
                const direction = ["owner", "pet"].includes(column)
                    ? "asc"
                    : "desc";

                const dateSelect = modal.querySelector("#kotb-date-select");
                const selectedDate = dateSelect?.value;

                if (selectedDate) {
                    await loadStatsTable(selectedDate, column, direction);
                }
            });
        });

        // Compare tab listeners
        const compareEndDateSelect = modal.querySelector(
            "#kotb-compare-end-date"
        );
        const compareStartDateSelect = modal.querySelector(
            "#kotb-compare-start-date"
        );
        const downloadCsvBtn = modal.querySelector("#kotb-download-csv-btn");

        if (compareEndDateSelect && compareStartDateSelect) {
            // Track previous valid values for reset on validation failure
            let previousValidEndDate = "";
            let previousValidStartDate = "";

            // Populate date dropdowns
            (async () => {
                const availableDates = await getAvailableDates();
                if (availableDates.length === 0) {
                    compareEndDateSelect.innerHTML =
                        '<option value="">No data available</option>';
                    compareStartDateSelect.innerHTML =
                        '<option value="">No data available</option>';
                } else {
                    const dateOptions = availableDates
                        .map(
                            (date) => `<option value="${date}">${date}</option>`
                        )
                        .join("");

                    compareEndDateSelect.innerHTML =
                        '<option value="">Select a date...</option>' +
                        dateOptions;
                    compareStartDateSelect.innerHTML =
                        '<option value="">Select a date...</option>' +
                        dateOptions;

                    // Auto-select most recent for end date and second most recent for start date if available
                    if (availableDates.length >= 2) {
                        compareStartDateSelect.value = availableDates[1];
                        compareEndDateSelect.value = availableDates[0];

                        // Initialize tracking variables
                        previousValidStartDate = availableDates[1];
                        previousValidEndDate = availableDates[0];

                        // Load initial data
                        const themeName = await getTheme();
                        const theme = THEMES[themeName];
                        await loadCompareTable(
                            availableDates[0],
                            availableDates[1],
                            theme
                        );
                    }
                }
            })();

            // Handle date selection changes with validation
            const handleDateChange = async () => {
                const endDate = compareEndDateSelect.value;
                const startDate = compareStartDateSelect.value;

                // Validate chronological order
                if (startDate && endDate) {
                    const startDateObj = new Date(startDate);
                    const endDateObj = new Date(endDate);

                    if (startDateObj >= endDateObj) {
                        alert("Start Date must be before End Date.");
                        // Reset to previous valid values
                        compareStartDateSelect.value = previousValidStartDate;
                        compareEndDateSelect.value = previousValidEndDate;
                        return;
                    }
                }

                // Update tracking variables on success
                previousValidStartDate = startDate;
                previousValidEndDate = endDate;

                const themeName = await getTheme();
                const theme = THEMES[themeName];
                await loadCompareTable(endDate, startDate, theme);
            };

            compareEndDateSelect.addEventListener("change", handleDateChange);
            compareStartDateSelect.addEventListener("change", handleDateChange);
        }

        // Handle CSV download
        if (downloadCsvBtn) {
            downloadCsvBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                e.preventDefault();

                const endDate = compareEndDateSelect?.value;
                const startDate = compareStartDateSelect?.value;

                if (!endDate || !startDate) {
                    alert("Please select both dates before downloading.");
                    return;
                }

                if (endDate === startDate) {
                    alert("Please select different dates.");
                    return;
                }

                // Validate chronological order
                const startDateObj = new Date(startDate);
                const endDateObj = new Date(endDate);
                if (startDateObj >= endDateObj) {
                    alert("Start Date must be before End Date.");
                    return;
                }

                try {
                    const compareData = await calculateCompareData(
                        endDate,
                        startDate
                    );

                    if (compareData.length === 0) {
                        alert("No data available for export.");
                        return;
                    }

                    // Confirm before downloading
                    const confirmed = confirm(
                        `Download CSV?\nStart Date: ${startDate}\nEnd Date: ${endDate}`
                    );

                    if (!confirmed) {
                        return;
                    }

                    const csvString = generateCSV(compareData);
                    const filename = `KOTB_Export_${startDate.replace(
                        /\s+/g,
                        "_"
                    )}_to_${endDate.replace(/\s+/g, "_")}.csv`;
                    downloadCSV(csvString, filename);
                } catch (error) {
                    console.error("Error generating CSV:", error);
                    alert("Error generating CSV. Please try again.");
                }
            });
        }
    }

    async function loadStatsTable(dateKey, sortColumn, sortDirection) {
        const modal = document.getElementById(CONFIG.IDS.MODAL);
        const tbody = modal?.querySelector("#kotb-stats-tbody");
        const themeName = await getTheme();
        const theme = THEMES[themeName];

        if (!tbody) return;

        let stats = await getStatsForDate(dateKey);

        // Calculate total for each stat (treating "-" as 0)
        stats = stats.map((stat) => {
            const level = stat.level === "-" ? 0 : parseInt(stat.level);
            const hp = stat.hp === "-" ? 0 : parseInt(stat.hp);
            const strength =
                stat.strength === "-" ? 0 : parseInt(stat.strength);
            const defence = stat.defence === "-" ? 0 : parseInt(stat.defence);
            const movement =
                stat.movement === "-" ? 0 : parseInt(stat.movement);
            const total = level + hp + strength + defence + movement;
            return { ...stat, total };
        });

        // Apply sorting if specified
        if (sortColumn) {
            stats.sort((a, b) => {
                let aVal = a[sortColumn];
                let bVal = b[sortColumn];

                // Handle numeric sorting for stat columns
                if (
                    [
                        "level",
                        "hp",
                        "strength",
                        "defence",
                        "movement",
                        "total",
                    ].includes(sortColumn)
                ) {
                    aVal = aVal === "-" ? -1 : parseInt(aVal);
                    bVal = bVal === "-" ? -1 : parseInt(bVal);
                } else {
                    // String sorting for owner/pet
                    aVal = String(aVal).toLowerCase();
                    bVal = String(bVal).toLowerCase();
                }

                if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
                if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
                return 0;
            });
        }

        // Update sort arrows
        const headers = modal.querySelectorAll(
            "#kotb-stats-table th[data-column]"
        );
        headers.forEach((header) => {
            const arrow = header.querySelector(".sort-arrow");
            const column = header.getAttribute("data-column");
            if (column === sortColumn) {
                arrow.textContent = sortDirection === "asc" ? " ▲" : " ▼";
            } else {
                arrow.textContent = "";
            }
        });

        // Render table rows
        if (stats.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="padding: 20px; text-align: center; color: ${theme.emptyText};">
                        No stats collected for this date
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = stats
                .map(
                    (stat, index) => `
                <tr style="border-bottom: 1px solid ${theme.itemBorder}; ${
                        index % 2 === 0
                            ? `background: ${theme.itemBg};`
                            : `background: ${theme.formBg};`
                    }">
                    <td style="padding: 10px; color: ${
                        theme.ownerText
                    }; font-size: 10pt; font-weight: bold; font-family: ${FONT_FAMILY};">${
                        stat.owner
                    }</td>
                    <td style="padding: 10px; color: ${
                        theme.petText
                    }; font-size: 10pt; font-family: ${FONT_FAMILY};">${
                        stat.pet
                    }</td>
                    <td style="padding: 10px; text-align: right; color: ${
                        theme.headerText
                    }; font-size: 10pt; font-family: ${FONT_FAMILY};">${
                        stat.level
                    }</td>
                    <td style="padding: 10px; text-align: right; color: ${
                        theme.headerText
                    }; font-size: 10pt; font-family: ${FONT_FAMILY};">${
                        stat.hp
                    }</td>
                    <td style="padding: 10px; text-align: right; color: ${
                        theme.headerText
                    }; font-size: 10pt; font-family: ${FONT_FAMILY};">${
                        stat.strength
                    }</td>
                    <td style="padding: 10px; text-align: right; color: ${
                        theme.headerText
                    }; font-size: 10pt; font-family: ${FONT_FAMILY};">${
                        stat.defence
                    }</td>
                    <td style="padding: 10px; text-align: right; color: ${
                        theme.headerText
                    }; font-size: 10pt; font-family: ${FONT_FAMILY};">${
                        stat.movement
                    }</td>
                    <td style="padding: 10px; text-align: right; color: ${
                        theme.headerText
                    }; font-size: 10pt; font-weight: bold; font-family: ${FONT_FAMILY};">${
                        stat.total
                    }</td>
                </tr>
            `
                )
                .join("");
        }
    }

    async function updateModal() {
        let modal = document.getElementById(CONFIG.IDS.MODAL);
        let modalWrapper = document.getElementById(CONFIG.IDS.MODAL_WRAPPER);

        if (!modal) {
            await ModalManager.initialize();
            modal = document.getElementById(CONFIG.IDS.MODAL);
            modalWrapper = document.getElementById(CONFIG.IDS.MODAL_WRAPPER);
        }

        const themeName = await getTheme();
        const theme = THEMES[themeName];

        // Update modal wrapper background
        if (modalWrapper) {
            modalWrapper.style.backgroundColor = theme.panelBg;
        }

        // Update toggle button to match theme
        const toggleBtn = document.getElementById(CONFIG.IDS.TOGGLE_BTN);
        if (toggleBtn) {
            toggleBtn.style.backgroundColor = theme.panelBg;
            toggleBtn.style.color = theme.headerText;
            toggleBtn.style.boxShadow = `2px 2px 8px rgba(0,0,0,${
                themeName === "dark" ? "0.4" : "0.2"
            })`;

            // Replace event listeners to match theme hover
            const newToggleBtn = toggleBtn.cloneNode(true);
            toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);

            newToggleBtn.addEventListener("mouseenter", () => {
                newToggleBtn.style.backgroundColor = theme.sideToggleBgHover;
            });
            newToggleBtn.addEventListener("mouseleave", () => {
                newToggleBtn.style.backgroundColor = theme.panelBg;
            });
            newToggleBtn.addEventListener("click", () => ModalManager.toggle());

            // Update ModalManager reference to the new button
            ModalManager.toggleBtn = newToggleBtn;
        }

        const pairings = await getOwnerPetPairings();
        modal.innerHTML = await renderModalContent(pairings, themeName, theme);
        attachModalListeners(modal);
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        try {
            const url = window.location.href;

            if (url.startsWith(KOTB_PETPAGE)) {
                injectStyles();
                await ModalManager.initialize();
                await updateModal();

                // Listen for storage changes to refresh UI when stats are collected
                // This handles manual collection from other tabs
                if (typeof GM !== "undefined" && GM.addValueChangeListener) {
                    GM.addValueChangeListener(
                        STATS_STORAGE_KEY,
                        async (name, oldValue, newValue, remote) => {
                            // Only update if change came from another context (tab)
                            if (remote) {
                                const activeTab = await getActiveTab();
                                // Only refresh if we're on the collection tab
                                if (activeTab === "collection") {
                                    await updateModal();
                                }
                            }
                        }
                    );
                }
            } else if (url.includes("userlookup.phtml")) {
                injectStyles();
                await ModalManager.initialize();
                await updateModal();
                await handleUserlookup();
            } else if (url.includes("petlookup.phtml")) {
                injectStyles();
                await ModalManager.initialize();
                await updateModal();
                await handlePetlookup();
            }
        } catch (error) {
            console.error("Initialization error:", error);
        }
    }

    await init();
})();
