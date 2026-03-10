document.addEventListener("DOMContentLoaded", () => {

    // Gestion des onglets
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));

            btn.classList.add("active");
            document.getElementById(btn.dataset.tab).classList.add("active");

            // mini flash glitch
            document.body.classList.add("glitch-flash");
            setTimeout(() => document.body.classList.remove("glitch-flash"), 350);
        });
    });

    // Amélioration transitions onglets dashboard (slide/fade)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const current = document.querySelector('.tab-panel.active');
            const next = document.getElementById(btn.dataset.tab);
            if (current === next) return;
            if (current) {
                current.classList.remove('active');
                // Forcer le repaint pour relancer l'animation si besoin
                void current.offsetWidth;
            }
            if (next) {
                next.classList.add('active');
            }
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