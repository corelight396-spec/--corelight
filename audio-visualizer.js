// audio-visualizer.js - Visualiseur audio interactif

const audioCanvas = document.getElementById('audio-visualizer');
const audioCtx = window.AudioContext ? new AudioContext() : new webkitAudioContext();
const ctx2 = audioCanvas.getContext('2d');
let analyser, source, dataArray, bufferLength, animationId;

function drawVisualizer() {
    ctx2.clearRect(0, 0, audioCanvas.width, audioCanvas.height);
    ctx2.save();
    ctx2.globalAlpha = 0.85;
    ctx2.shadowBlur = 16;
    ctx2.shadowColor = '#00f6ff';
    const barWidth = (audioCanvas.width / bufferLength) * 1.7;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 255;
        const h = audioCanvas.height * v;
        ctx2.fillStyle = `hsl(${180 + v*120}, 100%, 60%)`;
        ctx2.fillRect(x, audioCanvas.height - h, barWidth, h);
        x += barWidth + 1;
    }
    ctx2.restore();
    animationId = requestAnimationFrame(drawVisualizer);
}

function startVisualizer(stream) {
    source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    source.connect(analyser);
    drawVisualizer();
    function update() {
        analyser.getByteFrequencyData(dataArray);
        animationId = requestAnimationFrame(update);
    }
    update();
}

function stopVisualizer() {
    if (animationId) cancelAnimationFrame(animationId);
    ctx2.clearRect(0, 0, audioCanvas.width, audioCanvas.height);
}

// Bouton pour activer le micro
const btn = document.createElement('button');
btn.textContent = 'Activer le visualiseur audio';
btn.className = 'neon-button';
btn.style.display = 'block';
btn.style.margin = '0 auto 1.5rem auto';
btn.style.background = 'rgba(0,246,255,0.08)';
btn.style.fontSize = '1.1rem';
btn.style.cursor = 'pointer';
btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = 'Activation...';
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx.resume();
        startVisualizer(stream);
        btn.style.display = 'none';
    } catch (e) {
        btn.textContent = 'Micro refusé';
        btn.disabled = false;
    }
};
audioCanvas.parentNode.insertBefore(btn, audioCanvas);
