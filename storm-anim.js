(function () {
    // TEMPETE FOUDRE - background animation (ported from tempete_foudre.py)
    const FRAME_MS = Math.round(1000 / 15);
    const FLASH_PROB = 0.15;
    const BG_NIGHT = "rgb(10, 10, 25)";
    const BG_FLASH = "rgb(40, 40, 70)";

    const canvas = document.getElementById("bg-anim");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function generatePath(startX, startY) {
        const pts = [[startX, startY]];
        let cx = startX;
        let cy = startY;
        while (cy < canvas.height) {
            cy += 10 + Math.floor(Math.random() * 21);
            cx += Math.floor((Math.random() - 0.5) * 80);
            pts.push([cx, cy]);
        }
        return pts;
    }

    function drawPath(pts, haloColor, coreColor, haloW, coreW) {
        if (pts.length < 2) return;
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.strokeStyle = haloColor;
        ctx.lineWidth = haloW;
        ctx.moveTo(pts[0][0], pts[0][1]);
        pts.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = coreColor;
        ctx.lineWidth = coreW;
        ctx.moveTo(pts[0][0], pts[0][1]);
        pts.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
        ctx.stroke();
    }

    function drawBranch(fromX, fromY) {
        const endY = Math.min(canvas.height, fromY + canvas.height * 0.35);
        const pts = [[fromX, fromY]];
        let cx = fromX;
        let cy = fromY;

        while (cy < endY) {
            cy += 5 + Math.floor(Math.random() * 16);
            cx += Math.floor((Math.random() - 0.5) * 50);
            pts.push([cx, cy]);
        }
        drawPath(pts, "rgba(100,100,255,0.45)", "rgba(255,255,255,0.70)", 3, 1);
    }

    let animInterval = null;

    function renderFrame() {
        const W = canvas.width;
        const H = canvas.height;
        const isFlash = Math.random() < FLASH_PROB;

        ctx.fillStyle = isFlash ? BG_FLASH : BG_NIGHT;
        ctx.fillRect(0, 0, W, H);

        if (!isFlash) return;

        const startX = 40 + Math.floor(Math.random() * (W - 80));
        const pts = generatePath(startX, 0);

        drawPath(pts, "rgba(100,100,255,0.85)", "rgba(255,255,255,1)", 6, 2);

        pts.forEach(([px, py]) => {
            if (Math.random() < 0.2) drawBranch(px, py);
        });

        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 14;
        ctx.shadowColor = "rgba(100,100,255,0.55)";
        drawPath(pts, "rgba(100,100,255,0.18)", "rgba(255,255,255,0.12)", 10, 4);
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = "source-over";
    }

    function startAnim() {
        if (!animInterval) animInterval = setInterval(renderFrame, FRAME_MS);
    }

    function stopAnim() {
        clearInterval(animInterval);
        animInterval = null;
    }

    startAnim();
    document.addEventListener("visibilitychange", () => {
        document.hidden ? stopAnim() : startAnim();
    });
})();
