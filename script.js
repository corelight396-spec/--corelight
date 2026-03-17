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
            entriesDiv.innerHTML = '<p style="color:var(--text-dim);opacity:0.5;font-size:0.85rem;margin-top:1rem;">Aucune entrée pour l\'instant.</p>';
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
    // Typewriter on SYSTEM ONLINE line (index only)
    // ═══════════════════════════════════════════════
    const statusLine = document.querySelector('.status-line');
    if (statusLine) {
        const text = statusLine.textContent;
        statusLine.textContent = '';
        statusLine.setAttribute('aria-label', text); // A11Y: screenreaders get full text immediately
        let i = 0;
        function type() {
            if (i < text.length) {
                statusLine.textContent += text[i];
                i++;
                setTimeout(type, 38 + Math.random() * 40);
            }
        }
        setTimeout(type, 600);
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
