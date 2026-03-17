(function () {
    const canvas = document.getElementById("led-strip-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const badge = document.getElementById("led-mode-badge");
    const ledBtnGrid = document.querySelector(".led-btn-grid");
    const NUM = 30;
    const transportFactory = window.CoreLightTransport?.createTransport;
    if (typeof transportFactory !== "function") return;
    const transport = transportFactory("mock");

    let leds = Array(NUM).fill("#111111");
    let modeTimer = null;
    let currentMode = "manual";

    transport.connect().catch(() => {});

    async function pushFrame() {
        try {
            await transport.sendFrame(leds);
        } catch {
            // Silent for now: UI simulation should keep running
        }
    }

    function drawStrip() {
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        const ledW = Math.floor((W - 20) / NUM) - 3;
        const gap = 3;
        const startX = 10;
        const ledH = Math.floor(H * 0.55);
        const ledY = Math.floor((H - ledH) / 2);

        for (let i = 0; i < NUM; i++) {
            const x = startX + i * (ledW + gap);
            ctx.shadowBlur = leds[i] === "#111111" ? 0 : 22;
            ctx.shadowColor = leds[i];
            ctx.fillStyle = leds[i];
            ctx.fillRect(x, ledY, ledW, ledH);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = "rgba(255,255,255,0.12)";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x, ledY, ledW, ledH);
            ctx.fillStyle = "rgba(255,255,255,0.07)";
            ctx.fillRect(x + ledW * 0.3, ledY + ledH, ledW * 0.4, 5);
        }
    }

    function renderAndPush() {
        drawStrip();
        void pushFrame();
    }

    canvas.addEventListener("click", (e) => {
        if (currentMode !== "manual") return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const x = (e.clientX - rect.left) * scaleX;
        const ledW = Math.floor((canvas.width - 20) / NUM) - 3;
        const idx = Math.floor((x - 10) / (ledW + 3));
        if (idx >= 0 && idx < NUM) {
            const colors = ["#ff0088", "#00f6ff", "#39ff14", "#d600f9", "#ffff00", "#ff6600"];
            leds[idx] = colors[Math.floor(Math.random() * colors.length)];
            renderAndPush();
        }
    });

    function stopMode() {
        clearInterval(modeTimer);
        clearTimeout(modeTimer);
        modeTimer = null;
    }

    function setActiveBtnStyle(id) {
        document.querySelectorAll(".led-btn").forEach((b) => b.classList.remove("active-mode"));
        const el = document.getElementById(id);
        if (el) el.classList.add("active-mode");
    }

    function ledMode(mode) {
        stopMode();
        currentMode = mode;

        const modeLabels = {
            music: "MODE : MUSIC REACT",
            rainbow: "MODE : RAINBOW",
            lightning: "MODE : ⚡ LIGHTNING",
            pulse: "MODE : PULSE",
            white: "MODE : WHITE",
            off: "MODE : OFFLINE",
        };
        if (badge) badge.textContent = modeLabels[mode] || "MODE : MANUEL";
        setActiveBtnStyle("btn-" + mode);

        if (mode === "off") {
            leds = Array(NUM).fill("#111111");
            renderAndPush();
            currentMode = "manual";
            if (badge) badge.textContent = "MODE : MANUEL";
            document.querySelectorAll(".led-btn").forEach((b) => b.classList.remove("active-mode"));
            return;
        }

        if (mode === "white") {
            leds = Array(NUM).fill("#ffffff");
            renderAndPush();
            return;
        }

        if (mode === "rainbow") {
            let offset = 0;
            modeTimer = setInterval(() => {
                for (let i = 0; i < NUM; i++) leds[i] = `hsl(${(i * 12 + offset) % 360},100%,60%)`;
                offset = (offset + 3) % 360;
                renderAndPush();
            }, 60);
            return;
        }

        if (mode === "music") {
            modeTimer = setInterval(() => {
                for (let j = 0; j < NUM; j++) {
                    if (Math.random() > 0.45) leds[j] = `hsl(${Math.random() * 360},100%,65%)`;
                    else leds[j] = "#111111";
                }
                renderAndPush();
            }, 70);
            return;
        }

        if (mode === "pulse") {
            let t = 0;
            modeTimer = setInterval(() => {
                const brightness = 40 + 30 * Math.sin(t);
                leds = Array(NUM).fill(`hsl(190,100%,${brightness}%)`);
                t += 0.13;
                renderAndPush();
            }, 40);
            return;
        }

        if (mode === "lightning") {
            const FLASH_PROB = 0.2;
            modeTimer = setInterval(() => {
                const isFlash = Math.random() < FLASH_PROB;
                if (isFlash) {
                    leds = Array(NUM).fill("#060610");
                    const strikeStart = Math.floor(Math.random() * (NUM - 4));
                    const strikeLen = 1 + Math.floor(Math.random() * 4);
                    for (let s = 0; s < strikeLen; s++) {
                        const idx = strikeStart + s;
                        if (idx < NUM) leds[idx] = Math.random() < 0.5 ? "#ffffff" : "rgb(100,100,255)";
                    }
                    if (Math.random() < 0.2) {
                        const branch = Math.floor(Math.random() * NUM);
                        leds[branch] = "rgba(100,100,255,0.7)";
                    }
                    for (let k = 0; k < NUM; k++) {
                        if (leds[k] === "#060610") {
                            leds[k] = `rgb(${10 + Math.floor(Math.random() * 18)},${10 + Math.floor(Math.random() * 18)},${30 + Math.floor(Math.random() * 30)})`;
                        }
                    }
                } else {
                    leds = Array(NUM).fill("#060610");
                }
                renderAndPush();
            }, Math.round(1000 / 15));
        }
    }

    if (ledBtnGrid) {
        ledBtnGrid.addEventListener("click", (event) => {
            const btn = event.target.closest("[data-led-mode]");
            if (!btn) return;
            const mode = btn.dataset.ledMode;
            if (!mode) return;
            ledMode(mode);
        });
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden && modeTimer) {
            stopMode();
            canvas.dataset.pausedMode = currentMode;
        } else if (!document.hidden && canvas.dataset.pausedMode) {
            const mode = canvas.dataset.pausedMode;
            delete canvas.dataset.pausedMode;
            if (mode !== "manual" && mode !== "off" && mode !== "white") ledMode(mode);
        }
    });

    renderAndPush();
})();
