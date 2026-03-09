// bg-anim.js - Animation de fond néon dynamique

const canvas = document.getElementById('bg-anim');
const ctx = canvas.getContext('2d');
let w, h, lines;

function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
}

function randomColor() {
    const colors = ['#00f6ff', '#ff2ea5', '#39ff14', '#d600f9'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function createLines() {
    lines = [];
    for (let i = 0; i < 18; i++) {
        lines.push({
            x: Math.random() * w,
            y: Math.random() * h,
            len: 120 + Math.random() * 180,
            angle: Math.random() * Math.PI * 2,
            speed: 0.2 + Math.random() * 0.5,
            color: randomColor(),
            width: 1.5 + Math.random() * 2.5
        });
    }
}

function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = 0.22;
    for (const l of lines) {
        ctx.strokeStyle = l.color;
        ctx.shadowColor = l.color;
        ctx.shadowBlur = 16;
        ctx.lineWidth = l.width;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x + Math.cos(l.angle) * l.len, l.y + Math.sin(l.angle) * l.len);
        ctx.stroke();
    }
    ctx.restore();
}

function animate() {
    for (const l of lines) {
        l.x += Math.cos(l.angle) * l.speed;
        l.y += Math.sin(l.angle) * l.speed;
        if (l.x < -200 || l.x > w + 200 || l.y < -200 || l.y > h + 200) {
            l.x = Math.random() * w;
            l.y = Math.random() * h;
            l.angle = Math.random() * Math.PI * 2;
            l.color = randomColor();
        }
    }
    draw();
    requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
    resize();
    createLines();
});

resize();
createLines();
animate();
