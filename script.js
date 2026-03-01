// script.js - Gestion du compte à rebours et accès développeur

document.addEventListener("DOMContentLoaded", function() {
    const countdownElement = document.getElementById("countdown");
    const ctaButton = document.getElementById("cta-button");

    function isDevMode() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('dev') === '1') {
            localStorage.setItem('devAccess','true');
            return true;
        }
        return localStorage.getItem('devAccess') === 'true';
    }

    // If no release date stored yet, set one 4 days from now
    const STORAGE_KEY = 'corelightRelease';
    let releaseTime = localStorage.getItem(STORAGE_KEY);
    if (!releaseTime) {
        const now = Date.now();
        releaseTime = now + 4 * 24 * 60 * 60 * 1000; // 4 jours
        localStorage.setItem(STORAGE_KEY, releaseTime);
    } else {
        releaseTime = parseInt(releaseTime, 10);
    }

    function updateCountdown() {
        const now = Date.now();
        const diff = releaseTime - now;
        if (diff <= 0 || isDevMode()) {
            countdownElement.innerHTML = "SYSTEM_ONLINE";
            countdownElement.style.color = "#0f0";
            ctaButton.classList.remove('disabled');
            ctaButton.href = "dashboard.html";
            ctaButton.innerHTML = "ENTRER DANS LA MATRICE";
            clearInterval(intervalId);
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);

        countdownElement.innerHTML =
            `${String(days).padStart(2,'0')}:${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
        countdownElement.style.color = "var(--accent-color)";
    }

    // Initial render
    updateCountdown();
    const intervalId = setInterval(updateCountdown, 1000);

    // Prevent clicking while locked
    ctaButton.addEventListener('click', function(e) {
        if (ctaButton.classList.contains('disabled')) {
            e.preventDefault();
        }
    });
});