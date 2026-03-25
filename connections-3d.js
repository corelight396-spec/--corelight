(function () {
    // Hologram connection schema (pseudo-3D on Canvas2D)
    // Auto-disabled on reduced motion (unless force-motion), coarse pointer.
    const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motionForced = document.body.classList.contains("force-motion");
    const isCoarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if ((prefersReducedMotion && !motionForced) || isCoarsePointer) return;
    if (document.body.classList.contains("perf-lite")) return;

    const canvas = document.getElementById("connex-3d");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const PERF = {
        targetFps: 24,
        maxDpr: 1.5,
        autoDowngradeAfterFrames: 40,
        slowFrameMs: 28,
        minNodeCount: 18,
        minLinkCount: 22,
    };

    const DPR = Math.min(PERF.maxDpr, window.devicePixelRatio || 1);
    let W = 0;
    let H = 0;

    const CONFIG = {
        nodeCount: 34,
        linkCount: 52,
        depth: 1.0,
        fov: 1.25,
        centerBias: 0.55,
        drift: 0.0016,
        rotation: 0.0007,
        pulseSpeed: 0.0012,
        maxAlpha: 0.68,
    };

    function hexToRgb(hex) {
        const h = hex.replace("#", "").trim();
        const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
        const n = parseInt(full, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    let palette = [];
    function syncPaletteFromCss() {
        const css = getComputedStyle(document.documentElement);
        const C = {
            cyan: (css.getPropertyValue("--neon-cyan").trim() || "#00f6ff"),
            pink: (css.getPropertyValue("--neon-pink").trim() || "#ff2ea5"),
            green: (css.getPropertyValue("--neon-green").trim() || "#39ff14"),
            purple: (css.getPropertyValue("--neon-purple").trim() || "#d600f9"),
        };
        palette = [hexToRgb(C.cyan), hexToRgb(C.pink), hexToRgb(C.green), hexToRgb(C.purple)];
    }
    syncPaletteFromCss();

    function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function rand(min, max) { return min + Math.random() * (max - min); }

    function resize() {
        // Use viewport sizing to avoid “0x0 rect” on some browsers at startup
        W = Math.max(1, Math.floor(window.innerWidth || 1));
        H = Math.max(1, Math.floor(window.innerHeight || 1));
        canvas.width = Math.floor(W * DPR);
        canvas.height = Math.floor(H * DPR);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    // Scene
    const nodes = [];
    const links = [];

    function makeNode(i) {
        // bias toward center for a “core” feel
        const r = Math.pow(Math.random(), CONFIG.centerBias);
        const theta = rand(0, Math.PI * 2);
        const phi = Math.acos(rand(-1, 1));
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);
        const colorIndex = i % palette.length;
        return {
            x: x * 0.95,
            y: y * 0.85,
            z: z * CONFIG.depth,
            vx: rand(-CONFIG.drift, CONFIG.drift),
            vy: rand(-CONFIG.drift, CONFIG.drift),
            vz: rand(-CONFIG.drift, CONFIG.drift),
            colorIndex,
            seed: Math.random() * 1000,
            label: null,
        };
    }

    function rebuild() {
        nodes.length = 0;
        links.length = 0;
        for (let i = 0; i < CONFIG.nodeCount; i++) nodes.push(makeNode(i));

        // Narrative labels for “story” nodes (cyberpunk HUD style)
        const labels = [
            { idx: 0, label: "CORE" },
            { idx: 6, label: "POWER" },
            { idx: 13, label: "AUDIO" },
            { idx: 19, label: "LED STRIP" },
            { idx: 27, label: "SENSORS" },
            { idx: 34, label: "UI HUD" },
        ];
        labels.forEach(({ idx, label }) => {
            if (nodes[idx]) nodes[idx].label = label;
        });

        // Build links by connecting to near neighbors
        for (let i = 0; i < CONFIG.linkCount; i++) {
            const a = Math.floor(Math.random() * nodes.length);
            let b = Math.floor(Math.random() * nodes.length);
            if (b === a) b = (b + 1) % nodes.length;
            links.push({ a, b, w: rand(0.6, 1.35), phase: Math.random() * Math.PI * 2 });
        }
    }

    function project(p) {
        // simple perspective projection; z in [-depth..depth]
        const z = p.z + 1.7; // push forward
        const s = CONFIG.fov / z;
        return {
            x: (p.x * s) * W * 0.42 + W * 0.5,
            y: (p.y * s) * H * 0.42 + H * 0.44,
            s,
            z,
        };
    }

    function rotateY(p, a) {
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const x = p.x * ca + p.z * sa;
        const z = -p.x * sa + p.z * ca;
        p.x = x; p.z = z;
    }

    function rotateX(p, a) {
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const y = p.y * ca - p.z * sa;
        const z = p.y * sa + p.z * ca;
        p.y = y; p.z = z;
    }

    let t0 = performance.now();
    let raf = 0;
    let lastPaletteSyncAt = 0;
    let lastRenderAt = 0;
    const frameMs = Math.round(1000 / PERF.targetFps);
    let slowFrames = 0;
    let qualityLevel = 0; // 0 = full, 1 = lighter, 2 = minimal

    // Interaction: hover focus + click lock
    let pointer = { x: -9999, y: -9999, inside: false };
    let hovered = -1;
    let locked = -1;

    function pickHovered(proj) {
        if (!pointer.inside) return -1;
        let best = -1;
        let bestD2 = Infinity;
        for (let i = 0; i < proj.length; i++) {
            const p = proj[i];
            const dx = p.x - pointer.x;
            const dy = p.y - pointer.y;
            const d2 = dx * dx + dy * dy;
            // dynamic pick radius based on depth
            const pr = 14 + clamp(p.s * 18, 0, 20);
            if (d2 < pr * pr && d2 < bestD2) {
                bestD2 = d2;
                best = i;
            }
        }
        return best;
    }

    function drawLabel(x, y, text, color, alpha) {
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        const padX = 10;
        const padY = 6;
        ctx.font = "700 12px 'Space Mono', monospace";
        const w = Math.ceil(ctx.measureText(text).width);
        const boxW = w + padX * 2;
        const boxH = 24;
        const bx = Math.round(x + 12);
        const by = Math.round(y - 10 - boxH);

        ctx.shadowBlur = 16;
        ctx.shadowColor = `rgba(${color.r},${color.g},${color.b},${0.45 * alpha})`;
        ctx.fillStyle = `rgba(5,0,10,${0.62 * alpha})`;
        ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},${0.55 * alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
            ctx.roundRect(bx, by, boxW, boxH, 8);
        } else {
            // Fallback for older Canvas2D implementations
            ctx.rect(bx, by, boxW, boxH);
        }
        ctx.fill();
        ctx.stroke();

        // small bracket ticks
        ctx.strokeStyle = `rgba(${255},${255},${255},${0.12 * alpha})`;
        ctx.beginPath();
        ctx.moveTo(bx + 8, by + 5); ctx.lineTo(bx + 18, by + 5);
        ctx.moveTo(bx + 8, by + boxH - 5); ctx.lineTo(bx + 18, by + boxH - 5);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(224,247,255,${0.92 * alpha})`;
        ctx.fillText(text, bx + padX, by + 16);
        ctx.restore();
    }

    function tick(now) {
        raf = requestAnimationFrame(tick);
        // FPS cap for thermals
        if (now - lastRenderAt < frameMs) return;
        lastRenderAt = now;
        const dt = clamp(now - t0, 0, 32);
        t0 = now;

        // keep in sync with theme changes (cheap, 1Hz)
        if (now - lastPaletteSyncAt > 1000) {
            syncPaletteFromCss();
            lastPaletteSyncAt = now;
        }

        // Auto-downgrade if slow for sustained frames
        if (dt > PERF.slowFrameMs) slowFrames += 1;
        else slowFrames = Math.max(0, slowFrames - 1);
        if (slowFrames > PERF.autoDowngradeAfterFrames) {
            slowFrames = 0;
            if (qualityLevel === 0) {
                qualityLevel = 1;
                CONFIG.nodeCount = Math.max(PERF.minNodeCount, Math.round(CONFIG.nodeCount * 0.75));
                CONFIG.linkCount = Math.max(PERF.minLinkCount, Math.round(CONFIG.linkCount * 0.7));
                CONFIG.maxAlpha = Math.min(CONFIG.maxAlpha, 0.52);
                rebuild();
            } else if (qualityLevel === 1) {
                qualityLevel = 2;
                CONFIG.nodeCount = Math.max(PERF.minNodeCount, Math.round(CONFIG.nodeCount * 0.75));
                CONFIG.linkCount = Math.max(PERF.minLinkCount, Math.round(CONFIG.linkCount * 0.75));
                CONFIG.maxAlpha = Math.min(CONFIG.maxAlpha, 0.42);
                rebuild();
            } else {
                // still slow: stop to protect machine
                stop();
                return;
            }
        }

        // Clear with very subtle fade for trails
        ctx.clearRect(0, 0, W, H);

        const rot = CONFIG.rotation * dt;
        const rotX = rot * 0.6;
        const rotY = rot * 1.0;

        // Update nodes
        for (const n of nodes) {
            n.x += n.vx * dt;
            n.y += n.vy * dt;
            n.z += n.vz * dt;

            // soft bounds
            if (Math.abs(n.x) > 1) n.vx *= -1;
            if (Math.abs(n.y) > 0.95) n.vy *= -1;
            if (Math.abs(n.z) > CONFIG.depth) n.vz *= -1;

            rotateY(n, rotY);
            rotateX(n, rotX);
        }

        // Project once for sorting
        const proj = nodes.map((n) => project(n));
        hovered = pickHovered(proj);
        const focus = locked >= 0 ? locked : hovered;
        const isFocused = (i) => focus >= 0 && i === focus;
        const linkFocused = (l) => focus >= 0 && (l.a === focus || l.b === focus);

        // Draw links (back to front)
        const time = now * CONFIG.pulseSpeed;
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Slight vignette focus: fade edges a bit
        const edgeFade = (x, y) => {
            const nx = (x / W) * 2 - 1;
            const ny = (y / H) * 2 - 1;
            const d = Math.sqrt(nx * nx + ny * ny);
            return clamp(1 - (d - 0.35) * 0.9, 0.15, 1);
        };

        for (const l of links) {
            const pa = proj[l.a];
            const pb = proj[l.b];
            const za = pa.z;
            const zb = pb.z;
            const depthAlpha = clamp(1.25 - (za + zb) * 0.32, 0.08, 1);

            const pulse = 0.55 + 0.45 * Math.sin(time + l.phase);
            const alpha = CONFIG.maxAlpha * depthAlpha * pulse * edgeFade((pa.x + pb.x) * 0.5, (pa.y + pb.y) * 0.5);

            const ca = palette[nodes[l.a].colorIndex];
            const cb = palette[nodes[l.b].colorIndex];
            const mid = { r: Math.round((ca.r + cb.r) * 0.5), g: Math.round((ca.g + cb.g) * 0.5), b: Math.round((ca.b + cb.b) * 0.5) };

            const focused = linkFocused(l);
            const a2 = focused ? clamp(alpha * 1.9, 0, 1) : alpha;

            // Shadow blur is expensive: keep it low, boost only on focus
            ctx.shadowBlur = focused ? 10 : 0;
            ctx.shadowColor = `rgba(${mid.r},${mid.g},${mid.b},${a2})`;

            ctx.strokeStyle = `rgba(${mid.r},${mid.g},${mid.b},${a2})`;
            ctx.lineWidth = (l.w * (0.9 + pulse * 0.9)) * (focused ? 1.35 : 1);
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);

            // slight curve
            const mx = (pa.x + pb.x) / 2;
            const my = (pa.y + pb.y) / 2;
            const bend = (0.5 - pulse) * 26;
            ctx.quadraticCurveTo(mx + bend, my - bend, pb.x, pb.y);
            ctx.stroke();
        }

        // Draw nodes (front to back)
        const order = nodes
            .map((n, i) => ({ i, z: proj[i].z }))
            .sort((a, b) => b.z - a.z);

        for (const o of order) {
            const i = o.i;
            const p = proj[i];
            const n = nodes[i];
            const fade = clamp(1.15 - p.z * 0.36, 0.12, 1);
            const r = lerp(1.2, 4.2, clamp(p.s * 1.2, 0, 1));

            ctx.shadowBlur = isFocused(i) ? 14 : 6;
            const col = palette[n.colorIndex];
            const focusBoost = isFocused(i) ? 1.9 : 1;
            ctx.shadowColor = `rgba(${col.r},${col.g},${col.b},${0.55 * fade * focusBoost})`;

            ctx.fillStyle = `rgba(${col.r},${col.g},${col.b},${0.42 * fade * focusBoost})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 1.55 * (isFocused(i) ? 1.35 : 1), 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = `rgba(255,255,255,${0.28 * fade * (isFocused(i) ? 1.2 : 1)})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 0.55, 0, Math.PI * 2);
            ctx.fill();
        }

        // Focus label
        if (focus >= 0) {
            const n = nodes[focus];
            if (n && n.label) {
                const p = proj[focus];
                const col = palette[n.colorIndex];
                drawLabel(p.x, p.y, n.label, col, 1);
            }
        }

        ctx.globalCompositeOperation = "source-over";
        ctx.shadowBlur = 0;
    }

    // Init sizing / layout: full viewport hologram
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    resize();
    rebuild();
    let running = !document.body.classList.contains("perf-lite");
    if (running) raf = requestAnimationFrame(tick);

    // Interaction: hover + click lock
    function updatePointerFromEvent(e) {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.inside = true;
    }

    window.addEventListener("pointermove", updatePointerFromEvent, { passive: true });
    window.addEventListener("pointerleave", () => { pointer.inside = false; hovered = -1; }, { passive: true });
    window.addEventListener("blur", () => { pointer.inside = false; hovered = -1; });
    window.addEventListener("pointerdown", () => {
        if (!pointer.inside) return;
        if (hovered < 0) {
            locked = -1;
            return;
        }
        locked = locked === hovered ? -1 : hovered;
    }, { passive: true });

    const onResize = () => resize();
    window.addEventListener("resize", onResize, { passive: true });

    // Pause when PERF is toggled on/off (observe body class)
    function stop() {
        if (!running) return;
        running = false;
        cancelAnimationFrame(raf);
    }
    function start() {
        if (running) return;
        running = true;
        t0 = performance.now();
        raf = requestAnimationFrame(tick);
    }

    const classObserver = new MutationObserver(() => {
        const perf = document.body.classList.contains("perf-lite");
        perf ? stop() : start();
    });
    classObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    // Pause when tab hidden
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            stop();
        } else {
            const perf = document.body.classList.contains("perf-lite");
            if (!perf) start();
        }
    });
})();

