document.addEventListener("DOMContentLoaded", () => {

    // Gestion des onglets avec transition directionnelle
    const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
    const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
    const tabNav = document.querySelector(".terminal-nav");
    const panelIndexById = new Map(tabPanels.map((panel, index) => [panel.id, index]));
    let isTabAnimating = false;

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
        window.addEventListener("resize", () => {
            const activeBtn = tabNav.querySelector(".tab-btn.active");
            if (activeBtn) updateTabIndicator(activeBtn);
        });
    }

    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const next = document.getElementById(btn.dataset.tab);
            if (!next) return;

            // mini flash glitch
            document.body.classList.add("glitch-flash");
            setTimeout(() => document.body.classList.remove("glitch-flash"), 350);

            if (isTabAnimating) return;

            tabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            updateTabIndicator(btn);

            const current = document.querySelector(".tab-panel.active");
            if (current === next) return;

            if (!current) {
                cleanupTabClasses(next);
                next.classList.add("active");
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

            setTimeout(() => {
                current.classList.remove("active");
                cleanupTabClasses(current);
                cleanupTabClasses(next);
                isTabAnimating = false;
            }, 430);
        });
    });

    // Journal simple (localStorage)
    const JOURNAL_KEY = "corelight-journal";
    const entriesDiv = document.getElementById("journal-entries");
    const input = document.getElementById("journal-input");
    const addBtn = document.getElementById("journal-add");

    function loadJournal() {
        const data = localStorage.getItem(JOURNAL_KEY);
        return data ? JSON.parse(data) : [];
    }

    function saveJournal(arr) {
        localStorage.setItem(JOURNAL_KEY, JSON.stringify(arr.slice(-30))); // garde max 30
    }

    function renderJournal() {
        if (!entriesDiv) return;
        entriesDiv.innerHTML = "";
        loadJournal().reverse().forEach(e => {
            const d = document.createElement("div");
            d.innerHTML = `<small>${e.date}</small><br>${e.text.replace(/\n/g, "<br>")}`;
            entriesDiv.appendChild(d);
        });
    }

    if (addBtn) {
        addBtn.addEventListener("click", () => {
            const text = input.value.trim();
            if (!text) return;
            const arr = loadJournal();
            arr.push({ date: new Date().toLocaleString("fr-CH"), text });
            saveJournal(arr);
            input.value = "";
            renderJournal();
        });
    }

    renderJournal();

    // Petit glitch aléatoire toutes les ~20–40 secondes
    setInterval(() => {
        if (Math.random() > 0.93) {
            document.body.classList.add("glitch-flash");
            setTimeout(() => document.body.classList.remove("glitch-flash"), 400);
        }
    }, 18000);

    // Terminal interactif fictif
    const terminal = document.getElementById('fake-terminal');
    const terminalInput = document.getElementById('terminal-input');

    if (terminal && terminalInput) {
        const PROMPT = '> ';
        let history = [];
        let histIdx = 0;
        const commands = {
            help: () => 'Commandes: help, about, matrix, clear',
            about: () => 'CoreLight v0.7\nProjet cyberpunk RGB réactif, Lausanne Node.\nAuteur: Tiago',
            matrix: () => 'Wake up, Neo...\nThe Matrix has you.\nFollow the white rabbit.',
            clear: () => { terminal.innerHTML = ''; return ''; }
        };
        function print(text) {
            if (text) terminal.innerHTML += text + '\n';
            terminal.scrollTop = terminal.scrollHeight;
        }
        print('Bienvenue dans le terminal CoreLight !\nTape "help" pour la liste des commandes.');
        terminalInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                const val = terminalInput.value.trim();
                if (!val) return;
                print(PROMPT + val);
                history.push(val);
                histIdx = history.length;
                if (commands[val]) {
                    const out = commands[val]();
                    if (out) print(out);
                } else {
                    print('Commande inconnue. Tape "help".');
                }
                terminalInput.value = '';
            } else if (e.key === 'ArrowUp') {
                if (histIdx > 0) {
                    histIdx--;
                    terminalInput.value = history[histIdx] || '';
                }
            } else if (e.key === 'ArrowDown') {
                if (histIdx < history.length - 1) {
                    histIdx++;
                    terminalInput.value = history[histIdx] || '';
                } else {
                    terminalInput.value = '';
                }
            }
        });
    }

    // Effet typewriter sur la ligne SYSTEM ONLINE
    const statusLine = document.querySelector('.status-line');
    if (statusLine) {
        const text = statusLine.textContent;
        statusLine.textContent = '';
        let i = 0;
        function type() {
            if (i < text.length) {
                statusLine.textContent += text[i];
                i++;
                setTimeout(type, 38 + Math.random()*40);
            }
        }
        setTimeout(type, 600);
    }

    // Effet glitch sur le bouton au survol/clic
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

    // Personnalisation du thème utilisateur
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
        Object.entries(themes[theme]).forEach(([k,v]) => root.style.setProperty(k,v));
        localStorage.setItem('corelight-theme', theme);
    }
    if (themeSelect) {
        themeSelect.addEventListener('change', e => applyTheme(e.target.value));
        // Appliquer le thème sauvegardé
        const saved = localStorage.getItem('corelight-theme');
        if (saved && themes[saved]) {
            themeSelect.value = saved;
            applyTheme(saved);
        }
    }
});