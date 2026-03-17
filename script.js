document.addEventListener("DOMContentLoaded", () => {

    // ═══════════════════════════════════════════════
    // Utility: debounce
    // ═══════════════════════════════════════════════
    function debounce(fn, ms) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    }

    // ═══════════════════════════════════════════════
    // Tab navigation with directional transitions
    // ═══════════════════════════════════════════════
    const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
    const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
    const tabNav = document.querySelector(".terminal-nav");
    const panelIndexById = new Map(tabPanels.map((panel, index) => [panel.id, index]));
    let isTabAnimating = false;

    function syncPanelA11y(activePanel) {
        tabPanels.forEach((panel) => {
            const isActive = panel === activePanel;
            panel.hidden = !isActive;
            panel.setAttribute("aria-hidden", isActive ? "false" : "true");
            panel.setAttribute("tabindex", isActive ? "0" : "-1");
        });
    }

    function cleanupTabClasses(panel) {
        panel.classList.remove("tab-enter-forward", "tab-enter-backward", "tab-enter-active", "tab-exit-forward", "tab-exit-backward");
    }

    function updateTabIndicator(activeBtn) {
        if (!tabNav || !activeBtn) return;
        const navRect = tabNav.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        tabNav.style.setProperty("--active-x", `${btnRect.left - navRect.left}px`);
        tabNav.style.setProperty("--active-w", `${btnRect.width}px`);
        tabNav.style.setProperty("--indicator-opacity", "1");
    }

    if (tabNav && tabButtons.length > 0) {
        const initialActiveBtn = tabNav.querySelector(".tab-btn.active") || tabButtons[0];
        if (initialActiveBtn) updateTabIndicator(initialActiveBtn);
        // PERF: debounced resize handler
        window.addEventListener("resize", debounce(() => {
            const activeBtn = tabNav.querySelector(".tab-btn.active");
            if (activeBtn) updateTabIndicator(activeBtn);
        }, 150));
    }

    // ARIA: set up tab/tabpanel roles and connections
    tabButtons.forEach((btn, i) => {
        const panelId = btn.dataset.tab;
        btn.setAttribute("role", "tab");
        btn.setAttribute("aria-selected", btn.classList.contains("active") ? "true" : "false");
        btn.setAttribute("aria-controls", panelId);
        btn.setAttribute("id", `tab-${panelId}`);
        // Only active tab is in tab order; others reachable via arrow keys
        btn.setAttribute("tabindex", btn.classList.contains("active") ? "0" : "-1");
    });

    tabPanels.forEach(panel => {
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", `tab-${panel.id}`);
        panel.setAttribute("aria-hidden", panel.classList.contains("active") ? "false" : "true");
    });
    const initialPanel = document.querySelector(".tab-panel.active");
    if (initialPanel) syncPanelA11y(initialPanel);

    function activateTab(btn) {
        const next = document.getElementById(btn.dataset.tab);
        if (!next) return;

        // Mini flash glitch
        document.body.classList.add("glitch-flash");
        setTimeout(() => document.body.classList.remove("glitch-flash"), 350);

        if (isTabAnimating) return;

        tabButtons.forEach(b => {
            b.classList.remove("active");
            b.setAttribute("aria-selected", "false");
            b.setAttribute("tabindex", "-1");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        btn.setAttribute("tabindex", "0");
        btn.focus();
        updateTabIndicator(btn);

        const current = document.querySelector(".tab-panel.active");
        if (current === next) return;

        if (!current) {
            cleanupTabClasses(next);
            next.classList.add("active");
            syncPanelA11y(next);
            return;
        }

        const currentIndex = panelIndexById.get(current.id) ?? 0;
        const nextIndex = panelIndexById.get(next.id) ?? currentIndex;
        const direction = nextIndex >= currentIndex ? "forward" : "backward";

        isTabAnimating = true;
        cleanupTabClasses(current);
        cleanupTabClasses(next);

        current.classList.add(`tab-exit-${direction}`);
        next.classList.add("active", `tab-enter-${direction}`);

        requestAnimationFrame(() => {
            next.classList.add("tab-enter-active");
        });
        syncPanelA11y(next);

        setTimeout(() => {
            current.classList.remove("active");
            cleanupTabClasses(current);
            cleanupTabClasses(next);
            isTabAnimating = false;
        }, 430);
    }

    // Click handler
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => activateTab(btn));
    });

    // Deep-link support for dashboard tabs (?tab=wip or #videos)
    if (tabButtons.length > 0 && tabPanels.length > 0) {
        const params = new URLSearchParams(window.location.search);
        const tabFromQuery = params.get("tab");
        const tabFromHash = window.location.hash ? window.location.hash.slice(1) : null;
        const requestedTab = tabFromQuery || tabFromHash;
        if (requestedTab) {
            const targetBtn = tabButtons.find((b) => b.dataset.tab === requestedTab);
            if (targetBtn) activateTab(targetBtn);
        }
    }

    // A11Y: Keyboard navigation for tabs (Arrow Left/Right, Home, End)
    if (tabNav) {
        tabNav.addEventListener("keydown", (e) => {
            const currentBtn = document.activeElement;
            if (!tabButtons.includes(currentBtn)) return;

            let idx = tabButtons.indexOf(currentBtn);
            let newIdx = idx;

            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                newIdx = (idx + 1) % tabButtons.length;
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                newIdx = (idx - 1 + tabButtons.length) % tabButtons.length;
            } else if (e.key === "Home") {
                e.preventDefault();
                newIdx = 0;
            } else if (e.key === "End") {
                e.preventDefault();
                newIdx = tabButtons.length - 1;
            } else {
                return;
            }

            activateTab(tabButtons[newIdx]);
        });
    }

    // ═══════════════════════════════════════════════
    // Dashboard WebSerial hardware bridge
    // ═══════════════════════════════════════════════
    const serialConnectBtn = document.getElementById("serial-connect-btn");
    const statusLink = document.getElementById("status-link");
    const statusBoard = document.getElementById("status-board");
    const statusMode = document.getElementById("status-mode");
    const statusTemp = document.getElementById("status-temp");
    const statusRpm = document.getElementById("status-rpm");
    const statusMic = document.getElementById("status-mic");
    const oledScreen = document.getElementById("oled-screen");
    const brightnessSlider = document.getElementById("brightness-slider");
    const brightnessValue = document.getElementById("brightness-value");
    const fanSpeedSlider = document.getElementById("fan-speed-slider");
    const fanSpeedValue = document.getElementById("fan-speed-value");
    const fanToggles = Array.from(document.querySelectorAll(".fan-toggle"));
    const staticColorInput = document.getElementById("static-color-input");
    const applyStaticColorBtn = document.getElementById("apply-static-color");
    const ledModeButtons = Array.from(document.querySelectorAll(".led-btn[data-led-mode]"));
    const safeModeToggle = document.getElementById("safe-mode-toggle");
    const safeModeNotice = document.getElementById("safe-mode-notice");
    const hasSerialUI = !!serialConnectBtn;

    const SAFE_BRIGHTNESS_MAX = 60;
    const NORMAL_BRIGHTNESS_MAX = 255;
    const SAFE_POWER_SCALE = 0.4;
    const NORMAL_POWER_SCALE = 1;
    const SOFT_START_MS = 800;
    const SOFT_START_STEPS = 4;
    const COMMAND_DELAY_MS = 300;

    const serialState = {
        port: null,
        reader: null,
        writer: null,
        readBuffer: "",
        connected: false,
        boardLabel: "N/A",
        mode: "MANUAL",
        mic: 0,
        temp: null,
        rpm: null,
        lastTelemetryAt: 0,
        simulationTick: 0,
        safeMode: true,
        effectiveBrightness: Number(brightnessSlider?.value || 180),
        commandQueue: [],
        queueBusy: false,
        softStartTimer: null,
    };

    const ledModeMap = {
        rainbow: "RAINBOW",
        pulse: "PULSE",
        lightning: "LIGHTNING",
        music: "MUSIC_MODE",
        white: "STATIC_COLOR",
        off: "OFF",
    };

    function inferBoardLabel(port) {
        const info = port?.getInfo ? port.getInfo() : {};
        const vendor = info.usbVendorId;
        if (vendor === 0x2341 || vendor === 0x2A03) return "Arduino Nano";
        if (vendor === 0x1A86) return "Nano/CH340";
        if (vendor === 0x0403) return "Nano/FTDI";
        return "Arduino-compatible";
    }

    function updateOledPreview() {
        if (!oledScreen) return;
        const temp = typeof serialState.temp === "number" ? `${serialState.temp.toFixed(1)} C` : "--.- C";
        const rpm = typeof serialState.rpm === "number" ? `${Math.round(serialState.rpm)}` : "----";
        const mic = `${Math.max(0, Math.min(999, Math.round(serialState.mic || 0)))}`.padStart(3, "0");
        const linkLine = serialState.connected ? "LINK: ONLINE" : "LINK: OFFLINE";
        oledScreen.textContent = `CORELIGHT v0.8\n${linkLine}\nTEMP: ${temp}\nRPM : ${rpm}\nMIC : ${mic}`;
    }

    function refreshStatusUi() {
        if (!hasSerialUI) return;
        statusLink.textContent = serialState.connected ? "CONNECTED" : "DISCONNECTED";
        statusBoard.textContent = serialState.boardLabel;
        statusMode.textContent = serialState.mode;
        statusTemp.textContent = typeof serialState.temp === "number" ? `${serialState.temp.toFixed(1)} °C` : "-- °C";
        statusRpm.textContent = typeof serialState.rpm === "number" ? `${Math.round(serialState.rpm)}` : "--";
        statusMic.textContent = `${Math.round(serialState.mic || 0)}`;

        serialConnectBtn.classList.toggle("connected", serialState.connected);
        serialConnectBtn.classList.toggle("disconnected", !serialState.connected);
        serialConnectBtn.textContent = serialState.connected
            ? "✅ ARDUINO CONNECTED — CLICK TO DISCONNECT"
            : "🔌 CONNECT TO ARDUINO USB";
        serialConnectBtn.setAttribute("aria-pressed", serialState.connected ? "true" : "false");

        if (safeModeToggle) {
            safeModeToggle.textContent = serialState.safeMode ? "SAFE MODE ON" : "SAFE MODE OFF";
            safeModeToggle.classList.toggle("connected", serialState.safeMode);
            safeModeToggle.classList.toggle("disconnected", !serialState.safeMode);
            safeModeToggle.setAttribute("aria-pressed", serialState.safeMode ? "true" : "false");
        }
        if (safeModeNotice) {
            safeModeNotice.hidden = !serialState.safeMode;
        }

        updateOledPreview();
    }

    async function flushCommandQueue() {
        if (!serialState.connected || !serialState.writer || serialState.queueBusy) return;
        serialState.queueBusy = true;
        try {
            while (serialState.commandQueue.length > 0 && serialState.connected && serialState.writer) {
                const payload = serialState.commandQueue.shift();
                const line = `${JSON.stringify(payload)}\n`;
                await serialState.writer.write(new TextEncoder().encode(line));
                await new Promise((resolve) => setTimeout(resolve, COMMAND_DELAY_MS));
            }
        } catch {
            await disconnectSerial();
        } finally {
            serialState.queueBusy = false;
        }
    }

    function queueSerialJson(payload) {
        if (!serialState.connected || !serialState.writer) return;
        serialState.commandQueue.push(payload);
        void flushCommandQueue();
    }

    function effectiveBrightnessFromRaw(rawValue) {
        const raw = Number(rawValue) || 0;
        const max = serialState.safeMode ? SAFE_BRIGHTNESS_MAX : NORMAL_BRIGHTNESS_MAX;
        return Math.max(0, Math.min(max, raw));
    }

    function scheduleBrightnessSoftStart(targetRawValue) {
        const target = effectiveBrightnessFromRaw(targetRawValue);
        if (serialState.softStartTimer) {
            clearInterval(serialState.softStartTimer);
            serialState.softStartTimer = null;
        }
        const start = serialState.effectiveBrightness;
        const delta = target - start;
        let step = 0;
        const stepDuration = Math.round(SOFT_START_MS / SOFT_START_STEPS);
        serialState.softStartTimer = setInterval(() => {
            step += 1;
            const value = Math.round(start + (delta * step) / SOFT_START_STEPS);
            serialState.effectiveBrightness = value;
            queueSerialJson({
                cmd: "SET_BRIGHTNESS",
                value,
                safeMode: serialState.safeMode,
                powerScale: serialState.safeMode ? SAFE_POWER_SCALE : NORMAL_POWER_SCALE,
            });
            if (step >= SOFT_START_STEPS) {
                clearInterval(serialState.softStartTimer);
                serialState.softStartTimer = null;
            }
        }, stepDuration);
    }

    function applySafeModeToBrightnessUi() {
        if (!brightnessSlider || !brightnessValue) return;
        brightnessSlider.max = serialState.safeMode ? String(SAFE_BRIGHTNESS_MAX) : String(NORMAL_BRIGHTNESS_MAX);
        const clamped = effectiveBrightnessFromRaw(brightnessSlider.value);
        brightnessSlider.value = String(clamped);
        brightnessValue.textContent = String(clamped);
    }

    function applyTelemetry(data) {
        serialState.lastTelemetryAt = Date.now();
        if (typeof data.temp === "number") serialState.temp = data.temp;
        if (typeof data.rpm === "number") serialState.rpm = data.rpm;
        if (typeof data.mic === "number") serialState.mic = data.mic;
        if (typeof data.mode === "string") serialState.mode = data.mode.toUpperCase();
        if (typeof data.board === "string" && data.board.trim()) {
            serialState.boardLabel = data.board;
        }
        if (typeof data.shield === "string" && data.shield.toLowerCase().includes("gravity")) {
            serialState.boardLabel = `${serialState.boardLabel} + DFR Gravity`;
        }
        refreshStatusUi();
    }

    function parseSerialLine(line) {
        const clean = line.trim();
        if (!clean) return;
        try {
            const msg = JSON.parse(clean);
            if (msg.type === "telemetry" || msg.telemetry) {
                applyTelemetry(msg.telemetry || msg);
                return;
            }
            if (msg.type === "caps") {
                if (msg.board) serialState.boardLabel = msg.board;
                if (msg.shield) serialState.boardLabel = `${serialState.boardLabel} + ${msg.shield}`;
                refreshStatusUi();
            }
        } catch {
            // Ignore non-JSON lines from serial monitor output
        }
    }

    async function readSerialLoop() {
        if (!serialState.reader) return;
        try {
            while (serialState.connected) {
                const { value, done } = await serialState.reader.read();
                if (done) break;
                const chunk = new TextDecoder().decode(value || new Uint8Array());
                serialState.readBuffer += chunk;
                const lines = serialState.readBuffer.split("\n");
                serialState.readBuffer = lines.pop() || "";
                lines.forEach(parseSerialLine);
            }
        } catch {
            // fallthrough to disconnect
        }
        await disconnectSerial();
    }

    async function connectSerial(port, requestedByUser = false) {
        if (!hasSerialUI) return;
        try {
            if (!port && requestedByUser) {
                const filters = [
                    { usbVendorId: 0x2341 }, // Arduino
                    { usbVendorId: 0x2A03 }, // Arduino
                    { usbVendorId: 0x1A86 }, // CH340
                    { usbVendorId: 0x0403 }, // FTDI
                ];
                port = await navigator.serial.requestPort({ filters });
            }
            if (!port) return;
            await port.open({ baudRate: 115200 });
            serialState.port = port;
            serialState.reader = port.readable.getReader();
            serialState.writer = port.writable.getWriter();
            serialState.connected = true;
            serialState.boardLabel = inferBoardLabel(port);
            refreshStatusUi();

            queueSerialJson({
                cmd: "HELLO",
                client: "CoreLight Dashboard",
                expect: ["telemetry", "caps", "mic", "rpm", "temp"],
            });

            queueSerialJson({
                cmd: "SYNC",
                brightness: effectiveBrightnessFromRaw(brightnessSlider?.value || serialState.effectiveBrightness),
                fanSpeed: Number(fanSpeedSlider?.value || 120),
                safeMode: serialState.safeMode,
                powerScale: serialState.safeMode ? SAFE_POWER_SCALE : NORMAL_POWER_SCALE,
            });

            void readSerialLoop();
        } catch {
            serialState.connected = false;
            serialState.boardLabel = "N/A";
            refreshStatusUi();
        }
    }

    async function disconnectSerial() {
        if (!hasSerialUI) return;
        serialState.connected = false;
        try {
            if (serialState.reader) {
                await serialState.reader.cancel();
                serialState.reader.releaseLock();
            }
        } catch {}
        try {
            if (serialState.writer) {
                serialState.writer.releaseLock();
            }
        } catch {}
        try {
            if (serialState.port) {
                await serialState.port.close();
            }
        } catch {}

        serialState.port = null;
        serialState.reader = null;
        serialState.writer = null;
        serialState.readBuffer = "";
        serialState.commandQueue = [];
        serialState.queueBusy = false;
        if (serialState.softStartTimer) {
            clearInterval(serialState.softStartTimer);
            serialState.softStartTimer = null;
        }
        serialState.boardLabel = "N/A";
        serialState.mode = "MANUAL";
        refreshStatusUi();
    }

    function updateMicSimulation() {
        if (!hasSerialUI) return;
        if (!serialState.connected) return;
        const isTelemetryFresh = Date.now() - serialState.lastTelemetryAt < 1500;
        if (isTelemetryFresh) return;
        serialState.simulationTick += 0.24;
        const wave = 85 + Math.sin(serialState.simulationTick) * 55 + Math.random() * 32;
        serialState.mic = Math.max(0, Math.min(255, wave));
        if (typeof serialState.temp !== "number") serialState.temp = 28 + Math.sin(serialState.simulationTick * 0.5) * 1.8;
        if (typeof serialState.rpm !== "number") serialState.rpm = 820 + serialState.mic * 4.2;
        refreshStatusUi();
    }

    if (hasSerialUI) {
        applySafeModeToBrightnessUi();
        refreshStatusUi();

        if (!("serial" in navigator)) {
            serialConnectBtn.disabled = true;
            serialConnectBtn.textContent = "WEB SERIAL NOT SUPPORTED IN THIS BROWSER";
            serialConnectBtn.classList.add("disconnected");
        } else {
            navigator.serial.getPorts().then((ports) => {
                if (ports.length > 0) {
                    void connectSerial(ports[0], false);
                }
            }).catch(() => {});

            navigator.serial.addEventListener("disconnect", () => {
                void disconnectSerial();
            });

            serialConnectBtn.addEventListener("click", async () => {
                if (serialState.connected) {
                    await disconnectSerial();
                    return;
                }
                await connectSerial(null, true);
            });
        }

        if (brightnessSlider && brightnessValue) {
            brightnessSlider.addEventListener("input", () => {
                const clamped = effectiveBrightnessFromRaw(brightnessSlider.value);
                brightnessSlider.value = String(clamped);
                brightnessValue.textContent = String(clamped);
                scheduleBrightnessSoftStart(clamped);
            });
        }

        if (fanSpeedSlider && fanSpeedValue) {
            fanSpeedSlider.addEventListener("input", () => {
                fanSpeedValue.textContent = fanSpeedSlider.value;
                queueSerialJson({
                    cmd: "SET_FAN_SPEED",
                    value: Number(fanSpeedSlider.value),
                    safeMode: serialState.safeMode,
                    powerScale: serialState.safeMode ? SAFE_POWER_SCALE : NORMAL_POWER_SCALE,
                });
            });
        }

        fanToggles.forEach((btn) => {
            btn.addEventListener("click", () => {
                const fanId = Number(btn.dataset.fanId || 0);
                const nextOn = !btn.classList.contains("active");
                btn.classList.toggle("active", nextOn);
                btn.textContent = `FAN ${fanId} ${nextOn ? "ON" : "OFF"}`;
                queueSerialJson({
                    cmd: "SET_FAN",
                    fan: fanId,
                    on: nextOn,
                    safeMode: serialState.safeMode,
                    powerScale: serialState.safeMode ? SAFE_POWER_SCALE : NORMAL_POWER_SCALE,
                });
            });
        });

        ledModeButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                const mode = btn.dataset.ledMode || "off";
                const mapped = ledModeMap[mode] || "OFF";
                serialState.mode = mapped;
                refreshStatusUi();
                queueSerialJson({
                    cmd: "SET_LED_EFFECT",
                    effect: mapped,
                    safeMode: serialState.safeMode,
                    powerScale: serialState.safeMode ? SAFE_POWER_SCALE : NORMAL_POWER_SCALE,
                });
            });
        });

        if (applyStaticColorBtn && staticColorInput) {
            applyStaticColorBtn.addEventListener("click", () => {
                const hex = staticColorInput.value || "#00f6ff";
                serialState.mode = "STATIC_COLOR";
                refreshStatusUi();
                queueSerialJson({
                    cmd: "SET_LED_EFFECT",
                    effect: "STATIC_COLOR",
                    color: hex,
                    safeMode: serialState.safeMode,
                    powerScale: serialState.safeMode ? SAFE_POWER_SCALE : NORMAL_POWER_SCALE,
                });
            });
        }

        if (safeModeToggle) {
            safeModeToggle.addEventListener("click", () => {
                serialState.safeMode = !serialState.safeMode;
                applySafeModeToBrightnessUi();
                refreshStatusUi();
                scheduleBrightnessSoftStart(brightnessSlider?.value || serialState.effectiveBrightness);
                queueSerialJson({
                    cmd: "SET_SAFE_MODE",
                    enabled: serialState.safeMode,
                    powerScale: serialState.safeMode ? SAFE_POWER_SCALE : NORMAL_POWER_SCALE,
                });
            });
        }

        setInterval(updateMicSimulation, 320);
    }

    // ═══════════════════════════════════════════════
    // Journal (localStorage) — XSS-safe
    // ═══════════════════════════════════════════════
    const JOURNAL_KEY = "corelight-journal";
    const entriesDiv = document.getElementById("journal-entries");
    const input = document.getElementById("journal-input");
    const addBtn = document.getElementById("journal-add");

    function escapeHTML(str) {
        const div = document.createElement("div");
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function loadJournal() {
        try {
            const data = localStorage.getItem(JOURNAL_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    function saveJournal(arr) {
        try {
            localStorage.setItem(JOURNAL_KEY, JSON.stringify(arr.slice(-30)));
        } catch {
            // localStorage full or unavailable
        }
    }

    function renderJournal() {
        if (!entriesDiv) return;
        entriesDiv.innerHTML = "";
        const entries = loadJournal().reverse();
        if (entries.length === 0) {
            entriesDiv.innerHTML = '<p class="journal-empty">Aucune entrée pour l\'instant.</p>';
            return;
        }
        entries.forEach(e => {
            const d = document.createElement("div");
            const safeDate = escapeHTML(e.date || "");
            const safeText = escapeHTML(e.text || "").replace(/\n/g, "<br>");
            d.innerHTML = `<small>${safeDate}</small><br>${safeText}`;
            entriesDiv.appendChild(d);
        });
    }

    function addJournalEntry() {
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;
        const arr = loadJournal();
        arr.push({ date: new Date().toLocaleString("fr-CH"), text });
        saveJournal(arr);
        input.value = "";
        renderJournal();
        input.focus();
    }

    if (addBtn) {
        addBtn.addEventListener("click", addJournalEntry);
    }

    // A11Y: Ctrl+Enter to submit journal entry
    if (input) {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                addJournalEntry();
            }
        });
    }

    renderJournal();

    // ═══════════════════════════════════════════════
    // Random glitch every ~20–40s (pauses when hidden)
    // ═══════════════════════════════════════════════
    let glitchInterval = setInterval(() => {
        if (Math.random() > 0.93) {
            document.body.classList.add("glitch-flash");
            setTimeout(() => document.body.classList.remove("glitch-flash"), 400);
        }
    }, 18000);

    // PERF: Pause random glitch when tab hidden
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            clearInterval(glitchInterval);
        } else {
            glitchInterval = setInterval(() => {
                if (Math.random() > 0.93) {
                    document.body.classList.add("glitch-flash");
                    setTimeout(() => document.body.classList.remove("glitch-flash"), 400);
                }
            }, 18000);
        }
    });

    // ═══════════════════════════════════════════════
    // Gateway typewriter sequence (index only)
    // ═══════════════════════════════════════════════
    const gatewaySequence = document.getElementById("gateway-sequence");
    const welcomeMessage = document.getElementById("welcome-message");

    function typeText(el, text, speedMin = 22, speedJitter = 28) {
        return new Promise((resolve) => {
            if (!el) return resolve();
            el.textContent = "";
            let i = 0;
            function step() {
                if (i >= text.length) return resolve();
                el.textContent += text[i];
                i++;
                setTimeout(step, speedMin + Math.random() * speedJitter);
            }
            step();
        });
    }

    async function runGatewayTypewriter() {
        const protocolLine = document.getElementById("line-protocol");
        const systemLine = document.getElementById("line-system");
        const audioLine = document.getElementById("line-audio");
        const diveLine = document.getElementById("line-dive");
        if (!protocolLine || !systemLine || !audioLine || !diveLine) return;

        await typeText(protocolLine, "NEON PROTOCOL v0.7");
        await typeText(systemLine, "SYSTEM ONLINE — AWAITING MATRIX ACCESS");
        await typeText(audioLine, "Audio-réactif. WS2812B. Ventilateurs synchronisés.");
        await typeText(diveLine, "Plongez dans la grille néon.");

        if (welcomeMessage) welcomeMessage.classList.add("visible");
    }

    if (gatewaySequence) {
        runGatewayTypewriter();
    }

    // ═══════════════════════════════════════════════
    // Glitch on button hover/click (index only)
    // ═══════════════════════════════════════════════
    const neonBtn = document.querySelector('.neon-button');
    if (neonBtn) {
        neonBtn.addEventListener('mouseenter', () => {
            neonBtn.classList.add('glitch');
            setTimeout(() => neonBtn.classList.remove('glitch'), 600);
        });
        neonBtn.addEventListener('click', () => {
            neonBtn.classList.add('glitch');
            setTimeout(() => neonBtn.classList.remove('glitch'), 800);
        });
    }

    // ═══════════════════════════════════════════════
    // Smooth transition to dashboard + light preloading
    // ═══════════════════════════════════════════════
    const enterGridBtn = document.getElementById("enter-grid-btn");
    if (enterGridBtn) {
        const prefetch = document.createElement("link");
        prefetch.rel = "prefetch";
        prefetch.href = "./dashboard.html";
        document.head.appendChild(prefetch);

        enterGridBtn.addEventListener("click", (e) => {
            const href = enterGridBtn.getAttribute("href");
            if (!href) return;
            e.preventDefault();
            document.body.classList.add("gateway-transition-out");
            setTimeout(() => {
                window.location.href = href;
            }, 220);
        });
    }

    // ═══════════════════════════════════════════════
    // Theme customization (index only)
    // ═══════════════════════════════════════════════
    const themeSelect = document.getElementById('theme-select');
    const root = document.documentElement;
    const themes = {
        cyan:   { '--neon-cyan': '#00f6ff', '--neon-pink': '#ff2ea5', '--neon-green': '#39ff14', '--neon-purple': '#d600f9' },
        pink:   { '--neon-cyan': '#ff2ea5', '--neon-pink': '#00f6ff', '--neon-green': '#39ff14', '--neon-purple': '#d600f9' },
        green:  { '--neon-cyan': '#39ff14', '--neon-pink': '#00f6ff', '--neon-green': '#ff2ea5', '--neon-purple': '#d600f9' },
        purple: { '--neon-cyan': '#d600f9', '--neon-pink': '#00f6ff', '--neon-green': '#39ff14', '--neon-purple': '#ff2ea5' }
    };

    function applyTheme(theme) {
        if (!themes[theme]) return;
        Object.entries(themes[theme]).forEach(([k, v]) => root.style.setProperty(k, v));
        try { localStorage.setItem('corelight-theme', theme); } catch {}
    }

    if (themeSelect) {
        themeSelect.addEventListener('change', e => applyTheme(e.target.value));
        try {
            const saved = localStorage.getItem('corelight-theme');
            if (saved && themes[saved]) {
                themeSelect.value = saved;
                applyTheme(saved);
            }
        } catch {}
    }

    // ═══════════════════════════════════════════════
    // Runtime performance mode toggle
    // ═══════════════════════════════════════════════
    const PERF_KEY = "corelight-perf-lite";
    const perfToggle = document.getElementById("perf-toggle");

    function applyPerfMode(enabled) {
        document.body.classList.toggle("perf-lite", enabled);
        if (perfToggle) {
            perfToggle.classList.toggle("is-active", enabled);
            perfToggle.setAttribute("aria-pressed", enabled ? "true" : "false");
            perfToggle.textContent = enabled ? "PERF: ON" : "PERF: OFF";
        }
    }

    try {
        const savedPerf = localStorage.getItem(PERF_KEY) === "1";
        applyPerfMode(savedPerf);
    } catch {
        applyPerfMode(false);
    }

    if (perfToggle) {
        perfToggle.addEventListener("click", () => {
            const nextEnabled = !document.body.classList.contains("perf-lite");
            applyPerfMode(nextEnabled);
            try {
                localStorage.setItem(PERF_KEY, nextEnabled ? "1" : "0");
            } catch {}
        });
    }
});
