/* Statystyki meczu koszykówki — v1
 * Aplikacja działa w całości w przeglądarce telefonu.
 * Stan meczu jest trzymany tylko lokalnie na tym urządzeniu (ochrona przed
 * przypadkowym odświeżeniem strony). Nic nie jest wysyłane na żaden serwer.
 */
'use strict';
(() => {
  const APP_VERSION = '16'; // pokazywana na ekranie startowym; podbijaj razem z VERSION w sw.js
  const STORE_KEY = 'statystyki:v1';
  const HINT_MS = 5000; // jak długo czeka podpowiedź asysty/zbiórki
  const FT_MS = 10000;  // podpowiedź kolejnego rzutu wolnego czeka dłużej (sędzia podaje piłkę)
  const LONG_PRESS_MS = 500; // przytrzymanie kafelka = szybka zmiana

  const PALETTE = [
    '#ffffff', '#1a1a1a', '#d0202e', '#7a1f2b', '#ee7a1a', '#f2c230',
    '#1e8c45', '#4fb3e8', '#1f5fbf', '#1b2a55', '#6a3bb5', '#8a8f98',
  ];

  // Stały skład ŁKS U15 — zawsze dostępny; w każdym meczu wybierasz z niego skład meczowy.
  // [numer, nazwisko, imię]
  const LKS_NAME = 'ŁKS U15';
  const LKS_ROSTER = [
    ['0', 'Łęczyński', 'Antek'], ['1', 'Krawczyk', 'Wojtek'], ['2', 'Morou', 'Amadeusz'], ['3', 'Kluka', 'Rysiek'],
    ['5', 'Pawlak', 'Franek'], ['6', 'Walasik', 'Tymek'], ['7', 'Budner', 'Igor'], ['10', 'Domżał', 'Michał'],
    ['11', 'Buchacz', 'Julek'], ['12', 'Krysiak', 'Stanisław'], ['13', 'Juchacz', 'Oskar'], ['14', 'Miśkiewicz', 'Bartek'],
    ['17', 'Lewandowski', 'Leon'], ['18', 'Sikora', 'Tomek'], ['34', 'Marciniak', 'Jan'], ['39', 'Karbowiak', 'Maciek'],
    ['43', 'Kęcerski', 'Bartek'], ['44', 'Fajst-Święcicki', 'Miłosz'], ['45', 'Skalczyński', 'Bartek'], ['48', 'Petera', 'Michał'],
    ['52', 'Rzeźniczak', 'Radek'], ['66', 'Karpik', 'Hubert'], ['78', 'Omieciński', 'Marcel'], ['79', 'Chruściński', 'Igor'],
    ['87', 'Krysiak', 'Maciek'],
  ];

  // Wszystkie rodzaje zdarzeń zapisywanych w meczu
  const A = {
    p1m: { label: 'Celny za 1', short: '+1' },
    p1x: { label: 'Niecelny za 1', short: 'pudło 1' },
    p2m: { label: 'Celny za 2', short: '+2' },
    p2x: { label: 'Niecelny za 2', short: 'pudło 2' },
    p3m: { label: 'Celny za 3', short: '+3' },
    p3x: { label: 'Niecelny za 3', short: 'pudło 3' },
    oreb: { label: 'Zbiórka w ataku', short: 'ZB atak' },
    dreb: { label: 'Zbiórka w obronie', short: 'ZB obrona' },
    ast: { label: 'Asysta', short: 'Asysta' },
    stl: { label: 'Przechwyt', short: 'Przechwyt' },
    tov: { label: 'Strata', short: 'Strata' },
    blk: { label: 'Blok', short: 'Blok' },
    pf: { label: 'Faul popełniony', short: 'Faul' },
    fd: { label: 'Faul wymuszony', short: 'Faul wym.' },
    opp1: { label: '+1 pkt (drużyna)', short: '+1' },
    opp2: { label: '+2 pkt (drużyna)', short: '+2' },
    opp3: { label: '+3 pkt (drużyna)', short: '+3' },
    oppf: { label: 'Faul (drużyna)', short: 'F' },
    oppreb: { label: 'Zbiórka w ataku (drużyna)', short: 'ZA' },
    opptov: { label: 'Strata (drużyna)', short: 'STR' },
    oppmiss: { label: 'Niecelny rzut (drużyna)', short: '✕' },
    l1v1: { label: 'Przegrany pojedynek 1×1', short: 'P1×1' },
    gdef: { label: 'Dobra obrona', short: 'DO' },
    ghelp: { label: 'Dobra pomoc', short: 'DP' },
    brot: { label: 'Zła rotacja', short: 'ZR' },
  };
  // Krótki napis „błysku” na kafelku po zapisaniu akcji
  const FLASH = { p1m: '+1', p2m: '+2', p3m: '+3', p1x: '✕', p2x: '✕', p3x: '✕', oreb: 'ZB', dreb: 'ZB', ast: 'AS', stl: 'PRZ', tov: 'STR', blk: 'BL', pf: 'F', fd: 'FW', l1v1: '1×1', gdef: 'DO', ghelp: 'DP', brot: 'ZR' };
  const FLASH_GOOD = ['p1m', 'p2m', 'p3m', 'gdef', 'ghelp'];
  const FLASH_BAD = ['p1x', 'p2x', 'p3x', 'l1v1', 'brot'];
  const EDIT_ACTIONS = ['p1m', 'p1x', 'p2m', 'p2x', 'p3m', 'p3x', 'oreb', 'dreb', 'ast', 'stl', 'tov', 'blk', 'pf', 'fd', 'l1v1', 'gdef', 'ghelp', 'brot'];
  // Ocena gry w obronie (wpływa tylko na EVAL końcowy)
  const DEF_ACTIONS = [['gdef', 'Dobra obrona', 'pos'], ['ghelp', 'Dobra pomoc', 'pos'], ['l1v1', 'Przegrany 1×1', 'neg'], ['brot', 'Zła rotacja', 'neg']];
  const OTHER_ACTIONS = [
    ['oreb', 'ZB atak', 'reb'], ['dreb', 'ZB obrona', 'reb'], ['ast', 'Asysta', 'pos'], ['stl', 'Przechwyt', 'pos'],
    ['blk', 'Blok', 'pos'], ['tov', 'Strata', 'neg'], ['pf', 'Faul', 'neg'], ['fd', 'Faul wym.', 'neu'],
  ];

  const app = document.getElementById('app');
  const sheetRoot = document.getElementById('sheet-root');
  const toastEl = document.getElementById('toast');

  const THEME_KEY = 'statystyki:theme';
  let theme = 'dark';
  try { theme = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch (e) { /* brak */ }
  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    const m = document.querySelector('meta[name=theme-color]');
    if (m) m.setAttribute('content', theme === 'light' ? '#ffffff' : '#11151c');
  }
  applyTheme();

  let state = load();
  const ui = { selP: null, selA: null, follow: null, lastId: null, sheet: null, pasteOpen: false };
  let followTimer = null;

  // ---------- pomocnicze ----------
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const teamById = (id) => state.teams.find((t) => t.id === id);
  const otherTeam = (id) => state.teams.find((t) => t.id !== id);
  const teamName = (t) => (t.name || '').trim() || (t.id === 'A' ? 'Gospodarze' : 'Goście');
  const tracked = () => state.teams.filter((t) => t.tracked);
  const playerById = (t, pid) => t.players.find((p) => p.id === pid);
  const squadOf = (t) => t.players.filter((p) => t.squad.includes(p.id));
  const lksTeam = () => state.teams.find((t) => t.lks);
  const sortPlayers = (arr) => arr.slice().sort((a, b) => (parseInt(a.num, 10) - parseInt(b.num, 10)) || String(a.num).localeCompare(String(b.num)));
  const qLabel = (q) => (q <= 4 ? `${q}. kw.` : `Dogr. ${q - 4}`);
  const qShort = (q) => (q <= 4 ? String(q) : `D${q - 4}`);
  // Wibracja po akcji: Android — navigator.vibrate; iPhone (iOS 18+) — krótki „tik” przełącznika systemowego
  const VIBE_KEY = 'statystyki:vibe';
  const vibeOn = () => { try { return localStorage.getItem(VIBE_KEY) !== 'off'; } catch (e) { return true; } };
  const vibrate = (ms = 12) => {
    if (!vibeOn()) return;
    try {
      if (typeof navigator.vibrate === 'function') { navigator.vibrate(ms); return; }
      const l = document.createElement('label'); l.setAttribute('aria-hidden', 'true'); l.style.display = 'none';
      const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); l.appendChild(i);
      document.head.appendChild(l); l.click(); document.head.removeChild(l);
    } catch (e) { /* brak */ }
  };

  function textOn(hex) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substr(0, 2), 16) / 255, g = parseInt(h.substr(2, 2), 16) / 255, b = parseInt(h.substr(4, 2), 16) / 255;
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.35 ? '#111418' : '#ffffff';
  }
  const teamVars = (t) => `--tc:${t.color};--tx:${textOn(t.color)}`;

  function newMatch() {
    return {
      v: 1, id: uid(), screen: 'teams', created: Date.now(), finished: false, quarter: 1, hints: true, setupTab: 'A',
      teams: [
        { id: 'A', lks: true, name: LKS_NAME, color: '#d0202e', tracked: true, players: lksPlayers(), squad: [], onCourt: [] },
        { id: 'B', name: '', color: '#ffffff', tracked: false, players: [], squad: [], onCourt: [] },
      ],
      events: [],
    };
  }

  function lksPlayers() {
    return LKS_ROSTER.map(([num, last, first]) => ({ id: 'lks-' + num, num, last, first }));
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.v === 1 && Array.isArray(s.teams)) {
          s.teams.forEach((t) => { if (!Array.isArray(t.squad)) t.squad = t.players.map((p) => p.id); });
          if (!s.id) s.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
          return s;
        }
      }
    } catch (e) { /* brak dostępu do pamięci */ }
    return null;
  }
  function save() {
    try { if (state) localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* brak */ }
  }
  function clearSaved() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* brak */ }
  }

  let toastTimer = null, msgTimer = null;
  const onLive = () => app.classList.contains('scr-live');
  function refreshCtx() {
    const el = app.querySelector('.ctx');
    if (el && onLive()) el.outerHTML = renderCtx();
  }
  function toast(msg, kind = '') {
    // Na ekranie meczu komunikat pojawia się w pasku nad przyciskami (nie zasłania wyniku)
    if (onLive() && !ui.sheet) {
      ui.msg = { msg, kind };
      clearTimeout(msgTimer);
      msgTimer = setTimeout(() => { ui.msg = null; refreshCtx(); }, 2200);
      refreshCtx();
      return;
    }
    toastEl.textContent = msg;
    toastEl.className = 'show ' + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.className = ''; }, 2200);
  }

  // ---------- statystyki ----------
  const emptyStats = () => ({ p1m: 0, p1x: 0, p2m: 0, p2x: 0, p3m: 0, p3x: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, tov: 0, blk: 0, pf: 0, fd: 0, l1v1: 0, gdef: 0, ghelp: 0, brot: 0 });

  function derive(s) {
    const pts = s.p1m + 2 * s.p2m + 3 * s.p3m;
    const missed = s.p1x + s.p2x + s.p3x;
    const reb = s.oreb + s.dreb;
    // EVAL = punkty − wszystkie niecelne rzuty + asysty + przechwyty + zbiórki (A+O) + bloki − straty
    const ev = pts - missed + s.ast + s.stl + s.oreb + s.dreb + s.blk - s.tov;
    // EVAL końcowy = EVAL − przegrane 1×1 + dobra obrona + dobra pomoc − złe rotacje
    const evf = ev - s.l1v1 + s.gdef + s.ghelp - s.brot;
    return { ...s, pts, missed, reb, eval: ev, evalf: evf, p1a: s.p1m + s.p1x, p2a: s.p2m + s.p2x, p3a: s.p3m + s.p3x, fgm: s.p2m + s.p3m, fga: s.p2m + s.p2x + s.p3m + s.p3x };
  }

  function computeAll() {
    const players = new Map();
    const teamTot = { A: emptyStats(), B: emptyStats() };
    const qPts = { A: {}, B: {} };
    const qFouls = { A: {}, B: {} };
    const extra = { A: 0, B: 0 }; // punkty drużyny bez zawodnika (nieśledzona drużyna)
    const oppReb = { A: 0, B: 0 }, oppFouls = { A: 0, B: 0 }; // zbiórki w ataku i faule drużyny bez statystyk
    const oppTov = { A: 0, B: 0 }, oppMiss = { A: 0, B: 0 }; // straty i niecelne rzuty drużyny bez statystyk
    const rival = { A: teamById('B'), B: teamById('A') };
    const pm = new Map(); // +/−: różnica punktów, gdy zawodnik był na boisku
    const units = { A: new Map(), B: new Map() }; // piątki: punkty zdobyte i stracone, gdy grały razem
    const qTeam = { A: {}, B: {} }; // statystyki drużyny w poszczególnych kwartach
    const oppMade = { A: { 1: 0, 2: 0, 3: 0 }, B: { 1: 0, 2: 0, 3: 0 } }; // trafienia drużyny bez statystyk zawodników
    for (const e of state.events) {
      const evPts = { p1m: 1, p2m: 2, p3m: 3, opp1: 1, opp2: 2, opp3: 3 }[e.a] || 0;
      if (evPts && e.on) {
        for (const tid of Object.keys(e.on)) {
          const sign = tid === e.t ? 1 : -1;
          for (const pid of e.on[tid]) { const k = tid + ':' + pid; pm.set(k, (pm.get(k) || 0) + sign * evPts); }
          if (units[tid] && e.on[tid].length) {
            const uk = e.on[tid].slice().sort().join(',');
            const u = units[tid].get(uk) || { ids: uk.split(','), pf: 0, pa: 0 };
            if (sign > 0) u.pf += evPts; else u.pa += evPts;
            units[tid].set(uk, u);
          }
        }
      }
      if (/^opp[123]$/.test(e.a)) oppMade[e.t][+e.a.slice(3)]++;
      if (e.a === 'oppreb') { oppReb[e.t]++; continue; }
      if (e.a === 'opptov') { oppTov[e.t]++; continue; }
      if (e.a === 'oppmiss') { oppMiss[e.t]++; continue; }
      const pts = { p1m: 1, p2m: 2, p3m: 3, opp1: 1, opp2: 2, opp3: 3 }[e.a] || 0;
      if (pts) qPts[e.t][e.q] = (qPts[e.t][e.q] || 0) + pts;
      if (e.a === 'oppf') {
        oppFouls[e.t]++;
        const fq = Math.min(e.q, 4);
        qFouls[e.t][fq] = (qFouls[e.t][fq] || 0) + 1;
        continue;
      }
      if (e.a.startsWith('opp')) { extra[e.t] += pts; continue; }
      const key = e.t + ':' + e.p;
      if (!players.has(key)) players.set(key, emptyStats());
      players.get(key)[e.a]++;
      teamTot[e.t][e.a]++;
      (qTeam[e.t][e.q] || (qTeam[e.t][e.q] = emptyStats()))[e.a]++;
      // Rywal bez statystyk zawodników: akcje ŁKS automatycznie liczą się też rywalowi
      const rv = rival[e.t];
      if (rv && !rv.tracked) {
        if (e.a === 'fd' && !e.nd) { // faul wymuszony = faul rywala (chyba że zapisany z przycisku „Faul” rywala)
          oppFouls[rv.id]++;
          const fq = Math.min(e.q, 4);
          qFouls[rv.id][fq] = (qFouls[rv.id][fq] || 0) + 1;
        }
        if (e.a === 'stl') oppTov[rv.id]++;   // przechwyt = strata rywala
        if (e.a === 'blk') oppMiss[rv.id]++;  // blok = niecelny rzut rywala
      }
      if (e.a === 'pf') {
        const fq = Math.min(e.q, 4); // faule w dogrywce liczą się do 4. kwarty (FIBA)
        qFouls[e.t][fq] = (qFouls[e.t][fq] || 0) + 1;
      }
    }
    const score = {};
    for (const id of ['A', 'B']) score[id] = Object.values(qPts[id]).reduce((a, b) => a + b, 0);
    return {
      player: (t, pid) => ({ ...derive(players.get(t + ':' + pid) || emptyStats()), pm: pm.get(t + ':' + pid) || 0 }),
      team: (t) => ({ ...derive(teamTot[t]), pm: null }),
      teamQ: (t, q) => derive(qTeam[t][q] || emptyStats()),
      units: (t) => [...units[t].values()].map((u) => ({ ...u, pm: u.pf - u.pa })),
      score, qPts, qFouls, extra, oppReb, oppFouls, oppTov, oppMiss, oppMade,
      maxQ: Math.max(4, state.quarter, ...state.events.map((e) => e.q)),
    };
  }

  // ---------- nawigacja ----------
  function go(screen) {
    state.screen = screen;
    toastEl.className = '';
    ui.msg = null;
    ui.selP = ui.selA = null;
    clearFollow();
    save();
    render();
    window.scrollTo(0, 0);
    keepAwake(screen === 'live');
  }

  // Ekran startowy nie zmienia zapisanego ekranu meczu — „Wróć” przenosi tam, gdzie skończyłeś
  function showHome() {
    closeSheet();
    keepAwake(false);
    app.className = 'scr-home';
    app.innerHTML = renderHome();
    window.scrollTo(0, 0);
  }

  function render() {
    closeSheetDom();
    const s = state ? state.screen : 'home';
    const fn = { home: renderHome, teams: renderTeams, players: renderPlayers, lineup: renderLineup, live: renderLive, log: renderLog, box: renderBox }[s] || renderHome;
    app.className = 'scr-' + s + (s === 'live' ? ' teams-' + tracked().length : '');
    app.innerHTML = fn();
    if (ui.sheet) renderSheet();
    afterRender(s);
  }

  function afterRender(s) {
    if (s === 'players') {
      const f = document.getElementById('in-num');
      if (f && ui.focusNum) { f.focus(); ui.focusNum = false; }
    }
  }

  // ---------- ekran startowy ----------
  function renderHome() {
    let resume = '';
    const hasMatch = !!(state && state.screen && state.screen !== 'home');
    if (hasMatch) {
      const S = computeAll();
      const [a, b] = state.teams;
      const inSetup = ['teams', 'players', 'lineup'].includes(state.screen);
      resume = `
        <div class="card resume">
          <div class="muted small">${inSetup ? 'Przygotowanie meczu w toku' : 'Mecz w pamięci telefonu'}</div>
          <div class="resume-score">
            <span>${esc(teamName(a))}</span><b>${S.score.A} : ${S.score.B}</b><span>${esc(teamName(b))}</span>
          </div>
          <button class="btn primary block" data-act="resume">${inSetup ? 'Kontynuuj przygotowanie' : 'Wróć do meczu'}</button>
        </div>`;
    }
    return `
      <div class="home">
        <div class="brand">
          <img class="logo" src="icons/icon-192.png" alt="">
          <h1>Statystyki meczu</h1>
          <p class="muted">Koszykówka · zapis na żywo</p>
        </div>
        ${resume}
        <button class="btn ${hasMatch ? '' : 'primary'} block big" data-act="new">Nowy mecz</button>
        <p class="muted small center">${cloudReady() ? 'Po zakończeniu mecz zapisuje się też w Twoim Arkuszu Google.' : 'Dane meczu zostają wyłącznie na tym telefonie.'}</p>
        <button class="linkbtn center-link" data-act="cloud-settings">☁️ Arkusz Google: ${cloudReady() ? 'połączony' : 'skonfiguruj'}</button>
        <button class="linkbtn center-link" data-act="toggle-theme">${theme === 'light' ? '🌙 Włącz ciemny motyw' : '☀️ Włącz jasny motyw'}</button>
        <p class="muted small center app-ver">Wersja ${APP_VERSION}</p>
      </div>`;
  }

  // ---------- krok 1: drużyny ----------
  function renderTeams() {
    const cards = state.teams.map((t) => `
      <div class="card team-card" style="${teamVars(t)}">
        <div class="tc-head">
          <span class="jersey"></span>
          <span class="muted small">${t.id === 'A' ? 'Gospodarze' : 'Goście'}</span>
        </div>
        ${t.lks
    ? `<div class="lks-name">${esc(t.name)} <span class="muted small">· stały skład ${t.players.length} zaw.</span></div>`
    : `<input class="field" data-input="tname" data-team="${t.id}" value="${esc(t.name)}" placeholder="Nazwa drużyny przeciwnej" maxlength="40" autocomplete="off">`}
        <div class="label">Kolor strojów</div>
        <div class="swatches">
          ${PALETTE.map((c) => `<button class="sw ${c === t.color ? 'on' : ''}" style="background:${c}" data-act="color" data-team="${t.id}" data-color="${c}" aria-label="Kolor ${c}"></button>`).join('')}
          <label class="sw custom ${PALETTE.includes(t.color) ? '' : 'on'}" style="${PALETTE.includes(t.color) ? '' : 'background:' + t.color}" aria-label="Własny kolor">
            <input type="color" data-input="tcolor" data-team="${t.id}" value="${t.color}">
          </label>
        </div>
        <label class="toggle">
          <input type="checkbox" data-input="ttrack" data-team="${t.id}" ${t.tracked ? 'checked' : ''}>
          <span class="tg"></span>
          <span>Prowadzę statystyki tej drużyny</span>
        </label>
      </div>`).join('');
    return `
      ${stepHeader('Drużyny', 1, 'home')}
      <div class="wrap">
        <div class="label first">${esc(LKS_NAME)} gra jako</div>
        <div class="seg">
          <button class="${lksTeam().id === 'A' ? 'on' : ''}" data-act="lks-side" data-side="A">Gospodarze</button>
          <button class="${lksTeam().id === 'B' ? 'on' : ''}" data-act="lks-side" data-side="B">Goście</button>
        </div>
        ${cards}
        <p class="muted small">Dla drużyny bez statystyk zapisujesz tylko jej punkty (żeby wynik się zgadzał).</p>
      </div>
      <div class="footbar"><button class="btn primary block" data-act="teams-next">Dalej: zawodnicy</button></div>`;
  }

  function stepHeader(title, step, back) {
    return `
      <header class="topbar">
        <button class="icon-btn" data-act="back" data-to="${back}" aria-label="Wstecz">‹</button>
        <div class="tb-title">${title}</div>
        <div class="steps">${[1, 2, 3].map((i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
      </header>`;
  }

  // ---------- krok 2: zawodnicy ----------
  function renderPlayers() {
    const tr = tracked();
    if (!tr.find((t) => t.id === state.setupTab)) state.setupTab = tr[0].id;
    const t = teamById(state.setupTab);
    const tabs = tr.length > 1 ? `
      <div class="tabs">
        ${tr.map((x) => `<button class="tab ${x.id === t.id ? 'on' : ''}" style="${teamVars(x)}" data-act="tab" data-team="${x.id}"><span class="dot"></span>${esc(teamName(x))} <span class="cnt">${x.squad.length}</span></button>`).join('')}
      </div>` : '';
    if (t.lks) return renderSquadPicker(t, tabs);
    const list = sortPlayers(t.players).map((p) => `
      <li class="pl-row">
        <span class="num-badge" style="${teamVars(t)}">${esc(p.num)}</span>
        <span class="pl-name"><b>${esc(p.last)}</b> ${esc(p.first || '')}</span>
        <button class="icon-btn del" data-act="del-player" data-team="${t.id}" data-pid="${p.id}" aria-label="Usuń">✕</button>
      </li>`).join('');
    return `
      ${stepHeader('Zawodnicy', 2, 'teams')}
      ${tabs}
      <div class="wrap">
        <form class="entry card" data-form="add-player" data-team="${t.id}" autocomplete="off">
          <div class="entry-row">
            <input id="in-num" class="field num" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="Nr" enterkeyhint="next">
            <input id="in-last" class="field" placeholder="Nazwisko *" maxlength="30" enterkeyhint="done" autocapitalize="words">
          </div>
          <div class="entry-row">
            <input id="in-first" class="field" placeholder="Imię (opcjonalnie)" maxlength="30" enterkeyhint="done" autocapitalize="words">
            <button class="btn primary add" type="submit">Dodaj</button>
          </div>
          <button type="button" class="linkbtn" data-act="paste-toggle">${ui.pasteOpen ? 'Ukryj wklejanie' : 'Wklej całą listę naraz'}</button>
          ${ui.pasteOpen ? `
            <textarea id="paste" class="field paste" rows="6" placeholder="Jeden zawodnik w linii: numer nazwisko imię&#10;4 Kowalski Jan&#10;7 Nowak&#10;12 Wiśniewski Adam"></textarea>
            <button type="button" class="btn block" data-act="paste-add" data-team="${t.id}">Dodaj z listy</button>` : ''}
        </form>
        <div class="list-head"><span>${esc(teamName(t))}</span><span class="muted">${t.players.length} zaw.</span></div>
        <ul class="pl-list">${list || '<li class="empty muted">Brak zawodników — dodaj pierwszego powyżej.</li>'}</ul>
      </div>
      <div class="footbar"><button class="btn primary block" data-act="players-next">Dalej: pierwsza piątka</button></div>`;
  }

  // ŁKS: wybór składu meczowego ze stałej listy
  // Skład i pierwsza piątka ŁKS z ostatniego meczu (zapamiętane na tym telefonie)
  const LAST_KEY = 'statystyki:last';
  const lastLks = () => { try { const v = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); return v && Array.isArray(v.squad) ? v : null; } catch (e) { return null; } };
  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  function lastSquadFor(t) {
    const L = t.lks && lastLks();
    if (!L) return null;
    const ids = L.squad.filter((id) => t.players.some((p) => p.id === id));
    return ids.length ? ids : null;
  }
  function lastFiveFor(t) {
    const L = t.lks && lastLks();
    if (!L || !Array.isArray(L.five)) return null;
    const ids = L.five.filter((id) => t.squad.includes(id));
    return ids.length === Math.min(5, t.squad.length) && ids.length ? ids : null;
  }

  function renderSquadPicker(t, tabs) {
    const n = t.squad.length;
    const lastSq = lastSquadFor(t);
    const chips = sortPlayers(t.players).map((p) => `
      <button class="pchip tall ${t.squad.includes(p.id) ? 'on' : ''}" data-act="squad-toggle" data-team="${t.id}" data-pid="${p.id}">
        <span class="pc-num">${esc(p.num)}</span><span class="pc-name">${esc(p.last)}</span>${p.first ? `<span class="pc-first">${esc(p.first)}</span>` : ''}
      </button>`).join('');
    return `
      ${stepHeader('Skład meczowy', 2, 'teams')}
      ${tabs}
      <div class="wrap">
        <div class="card" style="${teamVars(t)}">
          <div class="list-head"><span><span class="dot"></span>${esc(teamName(t))}</span><span class="count ${n ? 'ok' : ''}">W składzie: ${n}</span></div>
          <p class="muted small" style="margin:0 0 10px">Dotknij zawodników, którzy grają w tym meczu.</p>
          ${lastSq && !sameSet(lastSq, t.squad) ? `<button class="btn block last-btn" data-act="squad-last" data-team="${t.id}">↺ Skład z ostatniego meczu (${lastSq.length})</button>` : ''}
          <div class="chip-grid">${chips}</div>
          <div class="row2">
            <button class="btn" data-act="squad-all" data-team="${t.id}">Zaznacz wszystkich</button>
            <button class="btn" data-act="squad-none" data-team="${t.id}">Wyczyść</button>
          </div>
        </div>
        <button type="button" class="linkbtn" data-act="extra-toggle">${ui.extraOpen ? 'Ukryj' : '＋ Zawodnik spoza listy (tylko na ten mecz)'}</button>
        ${ui.extraOpen ? `
          <form class="entry card" data-form="add-player" data-team="${t.id}" autocomplete="off">
            <div class="entry-row">
              <input id="in-num" class="field num" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="Nr" enterkeyhint="next">
              <input id="in-last" class="field" placeholder="Nazwisko *" maxlength="30" enterkeyhint="done" autocapitalize="words">
            </div>
            <div class="entry-row">
              <input id="in-first" class="field" placeholder="Imię (opcjonalnie)" maxlength="30" enterkeyhint="done" autocapitalize="words">
              <button class="btn primary add" type="submit">Dodaj</button>
            </div>
          </form>` : ''}
      </div>
      <div class="footbar"><button class="btn primary block" data-act="players-next">Dalej: pierwsza piątka</button></div>`;
  }

  function addPlayer(t, num, last, first) {
    num = String(num || '').trim().replace(/^#/, '');
    last = String(last || '').trim();
    first = String(first || '').trim();
    if (!num || !/^\d{1,3}$/.test(num)) return 'Podaj numer (cyfry).';
    if (!last) return 'Podaj nazwisko.';
    if (t.players.some((p) => p.num === num)) return `Numer ${num} już jest w składzie.`;
    const p = { id: uid(), num, last, first };
    t.players.push(p);
    t.squad.push(p.id);
    return null;
  }

  // ---------- krok 3: pierwsza piątka ----------
  function renderLineup() {
    const blocks = tracked().map((t) => {
      const sq = squadOf(t);
      t.onCourt = t.onCourt.filter((id) => t.squad.includes(id));
      const need = Math.min(5, sq.length);
      if (sq.length <= 5 && t.onCourt.length !== sq.length) { t.onCourt = sq.map((p) => p.id); save(); }
      const lastFive = lastFiveFor(t);
      return `
        <section class="card lineup" style="${teamVars(t)}">
          <div class="list-head"><span><span class="dot"></span>${esc(teamName(t))}</span><span class="count ${t.onCourt.length === need ? 'ok' : ''}">${t.onCourt.length}/${need}</span></div>
          ${lastFive && !sameSet(lastFive, t.onCourt) ? `<button class="btn block last-btn" data-act="five-last" data-team="${t.id}">↺ Piątka z ostatniego meczu</button>` : ''}
          <div class="chip-grid">
            ${sortPlayers(sq).map((p) => `
              <button class="pchip ${t.onCourt.includes(p.id) ? 'on' : ''}" data-act="lineup-toggle" data-team="${t.id}" data-pid="${p.id}">
                <span class="pc-num">${esc(p.num)}</span><span class="pc-name">${esc(p.last)}</span>
              </button>`).join('')}
          </div>
        </section>`;
    }).join('');
    return `
      ${stepHeader('Pierwsza piątka', 3, 'players')}
      <div class="wrap">${blocks}</div>
      <div class="footbar"><button class="btn primary block big" data-act="start">Rozpocznij mecz</button></div>`;
  }

  // ---------- mecz na żywo ----------
  function renderLive() {
    const S = computeAll();
    const [ta, tb] = state.teams;
    const scoreSide = (t, right) => {
      const fouls = S.qFouls[t.id][Math.min(state.quarter, 4)] || 0;
      // od 4 fauli drużyny w kwarcie (FIBA) każdy kolejny faul = rzuty wolne dla przeciwnika
      const sub = `<div class="sc-sub ${fouls >= 5 ? 'bad' : fouls >= 4 ? 'warn' : ''}">Faule zesp.: ${fouls}${fouls >= 4 ? ' <b class="lim">LIMIT</b>' : ''}</div>`;
      return `
        <div class="sc-team ${right ? 'right' : ''}" style="${teamVars(t)}">
          <div class="sc-name"><span class="dot"></span><span class="nm">${esc(teamName(t))}</span></div>
          <div class="sc-pts" data-team="${t.id}">${S.score[t.id]}</div>
          ${sub}
        </div>`;
    };
    const f = ui.follow;
    // Drużyna bez statystyk zawodników: osobny pasek na samym dole, wyraźnie inny niż kafelki ŁKS
    const oppBars = state.teams.filter((t) => !t.tracked).map((t) => `
        <div class="opp-bar" style="${teamVars(t)}">
          <div class="opp-label"><small>Rywal</small><b><span class="dot"></span>${esc(teamName(t))}</b></div>
          ${[1, 2, 3].map((v) => `<button class="opp-b pts" data-act="opp" data-team="${t.id}" data-v="${v}">+${v}</button>`).join('')}
          <button class="opp-b miss" data-act="opp" data-team="${t.id}" data-v="miss" aria-label="Niecelny rzut rywala"><b>✕</b><small>niecelny</small></button>
          <button class="opp-b reb" data-act="opp" data-team="${t.id}" data-v="reb" aria-label="Zbiórka w ataku rywala"><b>ZB</b><small>atak</small></button>
          <button class="opp-b tov" data-act="opp" data-team="${t.id}" data-v="tov">Strata</button>
          <button class="opp-b foul" data-act="opp" data-team="${t.id}" data-v="f">Faul</button>
        </div>`).join('');
    const teamBlocks = tracked().map((t) => {
      const court = sortPlayers(t.onCourt.map((id) => playerById(t, id)).filter(Boolean));
      const tiles = court.map((p) => {
        const st = S.player(t.id, p.id);
        const key = t.id + ':' + p.id;
        const sel = ui.selP && ui.selP.team === t.id && ui.selP.pid === p.id;
        const elig = f && f.elig.has(key);
        const fcls = st.pf >= 5 ? 'f5' : foulTrouble(st.pf) ? 'f4' : '';
        return `
          <button class="tile ${sel ? 'sel' : ''} ${elig ? 'elig' : ''} ${fcls}" data-act="player" data-team="${t.id}" data-pid="${p.id}">
            <span class="t-num">${esc(p.num)}</span>
            <span class="t-name">${esc(p.last)}</span>
            <span class="t-stat">${st.pts} pkt · <span class="t-f">${st.pf}F</span></span>
          </button>`;
      });
      while (tiles.length < 5) tiles.push('<div class="tile empty"></div>');
      return `
        <section class="team-block" style="${teamVars(t)}">
          <button class="tb-head" data-act="subs" data-team="${t.id}">
            <span class="tb-name"><span class="dot"></span>${esc(teamName(t))}</span>
            <span class="subs-btn">⇄ Zmiany</span>
          </button>
          <div class="tiles">${tiles.join('')}</div>
        </section>`;
    }).join('');

    const shotCol = (n) => `
      <div class="shot-col">
        <button class="a made ${ui.selA === 'p' + n + 'm' ? 'on' : ''}" data-act="action" data-a="p${n}m"><b>+${n} PKT</b><small>celny</small></button>
        <button class="a miss ${ui.selA === 'p' + n + 'x' ? 'on' : ''}" data-act="action" data-a="p${n}x"><b>✕</b><small>niecelny</small></button>
      </div>`;
    const others = OTHER_ACTIONS.map(([k, label, kind]) =>
      `<button class="a o ${kind} ${ui.selA === k ? 'on' : ''}" data-act="action" data-a="${k}">${label}</button>`).join('');

    return `
      <header class="score">
        ${scoreSide(ta, false)}
        <div class="sc-mid"><button class="sc-q" data-act="qsheet">${qLabel(state.quarter)} <span class="caret">▾</span></button></div>
        ${scoreSide(tb, true)}
      </header>
      <div class="teams-area">${teamBlocks}${renderRecent()}</div>
      ${renderCtx()}
      <div class="pad">
        <div class="shots">${shotCol(1)}${shotCol(2)}${shotCol(3)}</div>
        <div class="others">${others}</div>
        <div class="defs-h">Ocena obrony</div>
        <div class="defs">${DEF_ACTIONS.map(([k, label, kind]) => `<button class="a o d ${kind} ${ui.selA === k ? 'on' : ''}" data-act="action" data-a="${k}">${label}</button>`).join('')}</div>
      </div>
      ${oppBars}
      <nav class="bnav">
        <button data-act="undo" ${state.events.length ? '' : 'disabled'}><span>↶</span>Cofnij</button>
        <button data-act="go" data-to="log"><span>☰</span>Akcje</button>
        <button data-act="go" data-to="box"><span>▦</span>Tabela</button>
        <button data-act="menu"><span>⋯</span>Menu</button>
      </nav>`;
  }

  // Kłopoty z faulami: 2 faule w 1. kwarcie, 3 do przerwy, 4 w drugiej połowie
  const foulLimitFor = (q) => Math.min(q, 3) + 1;
  const foulTrouble = (pf) => pf >= 4 || pf >= foulLimitFor(state.quarter);

  // Pasek „ostatnie akcje” — najnowsza po lewej; dotknięcie otwiera pełną listę
  const RECENT_SHORT = { oppf: 'faul', oppreb: 'ZB atak', opptov: 'strata', oppmiss: 'pudło', l1v1: 'przegr. 1×1', gdef: 'dobra obrona', ghelp: 'dobra pomoc', brot: 'zła rotacja', p1x: 'pudło 1', p2x: 'pudło 2', p3x: 'pudło 3' };
  function renderRecent() {
    const items = state.events.slice(-4).reverse().map((e) => {
      const t = teamById(e.t), p = e.p && playerById(t, e.p);
      const who = p ? p.last : 'Rywal';
      return `<span class="rc-i" style="${teamVars(t)}"><span class="dot"></span>${esc(who)} <b>${esc(RECENT_SHORT[e.a] || A[e.a].short)}</b></span>`;
    }).join('');
    return `<button class="recent" data-act="go" data-to="log" aria-label="Ostatnie akcje — pokaż wszystkie">${items || '<span class="rc-empty">Tu zobaczysz ostatnie zapisane akcje</span>'}</button>`;
  }

  function evDesc(e) {
    const t = teamById(e.t);
    if (!e.p) return `${teamName(t)} · ${A[e.a].label}`;
    const p = playerById(t, e.p);
    return `#${p ? p.num : '?'} ${p ? p.last : ''} · ${A[e.a].label}`;
  }

  function renderCtx() {
    const f = ui.follow;
    if (f) {
      const PARTS = {
        ast: ['Asysta?', 'dotknij podającego'], reb: ['Zbiórka?', 'dotknij zbierającego'],
        tov: ['Kto stracił piłkę?', 'dotknij zawodnika rywala'], fd: ['Kto wymusił faul?', 'dotknij zawodnika rywala'],
        pf: ['Kto faulował?', 'dotknij zawodnika rywala'],
      };
      let title, sub;
      if (f.ft) {
        title = f.ftLabel || 'Kolejny wolny?';
        sub = f.type === 'reb' ? 'albo dotknij zbierającego' : f.type === 'pf' ? 'albo dotknij faulującego' : 'tego samego zawodnika';
      } else [title, sub] = PARTS[f.type];
      if (f.sub) sub = f.sub;
      const left = Math.max(0, f.expires - Date.now());
      const btns = (f.ft ? '<button class="ctx-btn ft-m" data-act="ft" data-r="m" aria-label="Celny">✓</button><button class="ctx-btn ft-x" data-act="ft" data-r="x" aria-label="Niecelny">✕</button>' : '')
        + (f.andOne ? '<button class="ctx-btn and1" data-act="and-one">+ faul</button>' : '')
        + (f.oppReb ? '<button class="ctx-btn oreb" data-act="opp-oreb">ZB rywala</button>' : '')
        + '<button class="ctx-btn" data-act="follow-skip">Pomiń</button>';
      return `<div class="ctx follow"><span class="ctx-l"><b>${title}</b><small>${sub}</small></span>
        <span class="ctx-acts">${btns}</span>
        <i class="timer" style="animation-duration:${f.ms}ms;animation-delay:-${f.ms - left}ms"></i></div>`;
    }
    if (ui.selP) {
      const t = teamById(ui.selP.team), p = playerById(t, ui.selP.pid);
      return `<div class="ctx pick" style="${teamVars(t)}"><span><span class="num-badge sm">${esc(p.num)}</span> <b>${esc(p.last)}</b> <span class="muted">→ wybierz akcję</span></span>
        <button class="ctx-btn" data-act="clear-sel">✕</button></div>`;
    }
    if (ui.selA) {
      return `<div class="ctx pick"><span><b>${A[ui.selA].label}</b> <span class="muted">→ wybierz zawodnika</span></span>
        <button class="ctx-btn" data-act="clear-sel">✕</button></div>`;
    }
    if (ui.msg) return `<div class="ctx msg ${ui.msg.kind}"><span class="ctx-txt">${esc(ui.msg.msg)}</span></div>`;
    const last = ui.lastId && state.events.find((e) => e.id === ui.lastId);
    if (last) {
      return `<div class="ctx done"><span class="ok">✓</span><span class="ctx-txt">${esc(evDesc(last))}</span>
        <button class="ctx-btn" data-act="undo">Cofnij</button></div>`;
    }
    return `<div class="ctx hint muted"><span class="ctx-l"><span>Dotknij zawodnika, potem akcję (albo odwrotnie)</span><small>Przytrzymaj kafelek zawodnika = szybka zmiana</small></span></div>`;
  }

  // ---------- zapis zdarzeń ----------
  // opts.chained — akcja z podpowiedzi (bez kolejnej podpowiedzi); opts.andOne — faul przy celnym rzucie
  function record(a, team, pid, opts = {}) {
    const ev = { id: uid(), t: team, p: pid, a, q: state.quarter, ts: Date.now(), on: lineupNow() };
    if (opts.nd) ev.nd = 1; // faul wymuszony zapisany z przycisku „Faul” rywala — faul rywala już policzony
    state.events.push(ev);
    ui.lastId = ev.id;
    ui.msg = null;
    save();
    vibrate();
    clearFollow();
    // 5. faul: od razu okno zmiany tego zawodnika
    let fouledOut = false;
    if (a === 'pf' && pid && teamById(team).tracked) {
      const n = state.events.filter((e) => e.t === team && e.p === pid && e.a === 'pf').length;
      fouledOut = n === 5;
    }
    if (!opts.chained && !fouledOut) setFollow(ev, opts);
    render();
    flash(ev);
    if (!fouledOut) { const w = foulWarning(ev); if (w) toast(w, 'bad'); }
    if (fouledOut) {
      const t = teamById(team), p = playerById(t, pid);
      const bench = squadOf(t).filter((x) => !t.onCourt.includes(x.id));
      if (bench.length) openQuickSub(team, pid, 'fouls');
      else toast(`#${p.num} ${p.last}: 5 fauli — brak zawodników na ławce`, 'bad');
    }
  }

  // Ostrzeżenie po faulu: limit fauli drużyny (4 w kwarcie) albo zawodnik w kłopotach z faulami
  function foulWarning(ev) {
    const fq = Math.min(ev.q, 4);
    let ft = null;
    if (ev.a === 'pf' || ev.a === 'oppf') ft = ev.t;
    else if (ev.a === 'fd' && !ev.nd && !otherTeam(ev.t).tracked) ft = otherTeam(ev.t).id;
    if (!ft) return null;
    const S = computeAll();
    if ((S.qFouls[ft][fq] || 0) === 4) {
      return `${teamName(teamById(ft))}: LIMIT fauli (4) — każdy kolejny faul to rzuty wolne`;
    }
    if (ev.a === 'pf' && ev.p) {
      const t = teamById(ev.t), p = playerById(t, ev.p);
      const n = S.player(ev.t, ev.p).pf;
      if (n === 4) return `#${p.num} ${p.last}: 4 faule — piąty oznacza zejście`;
      if (n >= foulLimitFor(ev.q) && n < 5) return `#${p.num} ${p.last}: ${n} faule ${ev.q === 1 ? 'w 1. kwarcie' : 'w 1. połowie'}`;
    }
    return null;
  }

  // Kto był na boisku w chwili akcji (potrzebne do +/−)
  function lineupNow() {
    const on = {};
    for (const t of state.teams) if (t.tracked) on[t.id] = t.onCourt.slice();
    return on;
  }

  // Krótki „błysk” na kafelku zawodnika (i podbicie wyniku przy punktach) — widać kątem oka, że akcja się zapisała
  function flash(ev) {
    try {
      if (ev.p && FLASH[ev.a]) {
        const el = app.querySelector(`.tile[data-team="${ev.t}"][data-pid="${ev.p}"]`);
        if (el) {
          const sp = document.createElement('span');
          sp.className = 'flash ' + (FLASH_GOOD.includes(ev.a) ? 'good' : FLASH_BAD.includes(ev.a) ? 'bad' : '');
          sp.textContent = FLASH[ev.a];
          el.appendChild(sp);
        }
      }
      const pts = { p1m: 1, p2m: 2, p3m: 3, opp1: 1, opp2: 2, opp3: 3 }[ev.a];
      if (pts) { const sc = app.querySelector(`.sc-pts[data-team="${ev.t}"]`); if (sc) sc.classList.add('bump'); }
      if (ev.a.startsWith('opp')) { const b = app.querySelector(`.opp-b[data-team="${ev.t}"][data-v="${ev.a.slice(3)}"]`); if (b) b.classList.add('hit'); }
    } catch (e) { /* tylko efekt wizualny */ }
  }

  function setFollow(ev, opts = {}) {
    if (!state.hints) return;
    if (!ev.p) {
      // rywal bez statystyk: po niecelnym rzucie — kto zebrał; po faulu — kto z ŁKS wymusił
      const o = otherTeam(ev.t);
      if (!o.tracked) return;
      const elig = o.onCourt.map((id) => o.id + ':' + id);
      if (!elig.length) return;
      let f = null;
      if (ev.a === 'oppmiss') f = { type: 'reb', oppReb: ev.t, sub: 'dotknij zbierającego z ' + teamName(o) };
      else if (ev.a === 'oppf') f = { type: 'fd', nd: true, sub: 'dotknij zawodnika ' + teamName(o) };
      if (!f) return;
      ui.follow = { ...f, elig: new Set(elig), src: ev.t, ms: HINT_MS, expires: Date.now() + HINT_MS };
      followTimer = setTimeout(() => { ui.follow = null; if (state.screen === 'live' && onLive() && !ui.sheet) render(); }, HINT_MS);
      return;
    }
    const t = teamById(ev.t), o = otherTeam(ev.t);
    const keys = (team, exclude) => team.onCourt.filter((id) => id !== exclude).map((id) => team.id + ':' + id);
    const shooter = { team: ev.t, pid: ev.p };
    let type = null, elig = [], ft = null, andOne = null, ms = HINT_MS, ftLabel = null;
    if (ev.a === 'p2m' || ev.a === 'p3m') { type = 'ast'; elig = keys(t, ev.p); andOne = shooter; }
    else if (ev.a === 'p1m') { ft = shooter; ms = FT_MS; }
    else if (ev.a === 'p1x') { type = 'reb'; elig = keys(t).concat(o.tracked ? keys(o) : []); ft = shooter; ms = FT_MS; }
    else if (ev.a === 'p2x' || ev.a === 'p3x') { type = 'reb'; elig = keys(t).concat(o.tracked ? keys(o) : []); }
    else if (ev.a === 'stl' && o.tracked) { type = 'tov'; elig = keys(o); }
    else if (ev.a === 'pf' && o.tracked) { type = 'fd'; elig = keys(o); }
    else if (ev.a === 'fd') {
      if (o.tracked) { type = 'pf'; elig = keys(o); }
      if (opts.andOne) { ft = shooter; ms = FT_MS; ftLabel = 'Rzut wolny (and-one)?'; }
    }
    if (type && !elig.length) type = null;
    if (!type && !ft && !andOne) return;
    ui.follow = { type, elig: new Set(type ? elig : []), src: ev.t, ft, andOne, ftLabel, ms, expires: Date.now() + ms };
    followTimer = setTimeout(() => { ui.follow = null; if (state.screen === 'live' && onLive()) { if (ui.sheet) return; render(); } }, ms);
  }
  function clearFollow() {
    clearTimeout(followTimer);
    ui.follow = null;
  }

  function tapPlayer(team, pid) {
    const f = ui.follow;
    const key = team + ':' + pid;
    if (f && f.elig.has(key)) {
      const a = f.type === 'reb' ? (team === f.src ? 'oreb' : 'dreb') : f.type;
      record(a, team, pid, { chained: true, nd: f.nd });
      // and-one: po wskazaniu faulującego nadal czekamy na wynik rzutu wolnego
      if (f.ft && f.type === 'pf' && !ui.sheet && state.hints) {
        ui.follow = { type: null, elig: new Set(), src: f.src, ft: f.ft, ftLabel: f.ftLabel, ms: FT_MS, expires: Date.now() + FT_MS };
        followTimer = setTimeout(() => { ui.follow = null; if (onLive() && !ui.sheet) render(); }, FT_MS);
        render();
      }
      return;
    }
    clearFollow();
    if (ui.selA) { const a = ui.selA; ui.selA = null; record(a, team, pid); return; }
    ui.selP = ui.selP && ui.selP.team === team && ui.selP.pid === pid ? null : { team, pid };
    render();
  }

  function tapAction(a) {
    clearFollow();
    if (ui.selP) { const p = ui.selP; ui.selP = null; record(a, p.team, p.pid); return; }
    ui.selA = ui.selA === a ? null : a;
    render();
  }

  function openQuickSub(team, pid, reason) {
    openSheet({ kind: 'qsub', team, pid, reason });
  }

  function undo() {
    const e = state.events.pop();
    if (!e) return;
    clearFollow();
    ui.lastId = null;
    save();
    vibrate(25);
    ui.msg = { msg: 'Cofnięto: ' + evDesc(e), kind: '' };
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { ui.msg = null; refreshCtx(); }, 2200);
    render();
  }

  // ---------- lista akcji ----------
  function renderLog() {
    const evs = state.events.slice().reverse();
    let curQ = null;
    const rows = evs.map((e) => {
      const t = teamById(e.t);
      let head = '';
      if (e.q !== curQ) { curQ = e.q; head = `<li class="log-q">${qLabel(e.q)}</li>`; }
      return `${head}<li class="log-row" style="${teamVars(t)}"><span class="dot"></span>
        <button class="log-txt" data-act="edit-event" data-id="${e.id}">${esc(evDesc(e))}<span class="log-edit">✎</span></button>
        <button class="icon-btn del" data-act="del-event" data-id="${e.id}" aria-label="Usuń">✕</button></li>`;
    }).join('');
    return `
      <header class="topbar">
        <button class="icon-btn" data-act="go" data-to="live" aria-label="Wstecz">‹</button>
        <div class="tb-title">Akcje (${state.events.length})</div><div></div>
      </header>
      <div class="wrap"><p class="muted small log-tip">Dotknij akcji, aby ją poprawić (zawodnik, rodzaj, kwarta). ✕ usuwa.</p><ul class="log">${rows || '<li class="empty muted">Brak zapisanych akcji.</li>'}</ul></div>`;
  }

  // ---------- tabela ----------
  // Kolumny tabeli w grupach (nagłówek grupy nad skrótami)
  const COL_GROUPS = [
    ['', [['pts', 'PKT']]],
    ['RZUTY', [['s1', '1 PKT'], ['s2', '2 PKT'], ['s3', '3 PKT'], ['sfg', 'Z GRY']]],
    ['ZBIÓRKI', [['oreb', 'ZA'], ['dreb', 'ZO'], ['reb', 'ZB']]],
    ['GRA', [['ast', 'AS'], ['stl', 'PRZ'], ['tov', 'STR'], ['blk', 'BL'], ['pf', 'FP'], ['fd', 'FW'], ['pm', '+/−']]],
    ['', [['eval', 'EVAL']]],
    ['OCENA OBRONY', [['l1v1', 'P1×1'], ['gdef', 'DO'], ['ghelp', 'DP'], ['brot', 'ZR']]],
    ['', [['evalf', 'EVAL K']]],
  ];
  const COLS = COL_GROUPS.flatMap(([, cols]) => cols);
  const GROUP_START = new Set(COL_GROUPS.map(([, cols]) => cols[0][0]));
  // „Najlepszy w meczu” — wyróżnienie w kolumnach, w których więcej = lepiej
  const BEST_KEYS = ['pts', 'sfg', 'oreb', 'dreb', 'reb', 'ast', 'stl', 'blk', 'fd', 'pm', 'eval', 'gdef', 'ghelp', 'evalf'];
  const bestVal = (s, k) => (k === 'sfg' ? s.fgm : s[k]);
  function bestOf(list) {
    const best = {};
    for (const k of BEST_KEYS) {
      const m = Math.max(...list.map((s) => bestVal(s, k)));
      if (m > 0) best[k] = m;
    }
    return (s, k) => best[k] !== undefined && bestVal(s, k) === best[k];
  }
  const fmtPm = (v) => (v === null || v === undefined ? '' : v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '0');
  // rzuty: celne/wykonane i skuteczność w nawiasie, np. 8/10 (80%); bez rzutów samo 0/0
  const shot = (m, a) => (a ? `${m}/${a} (${Math.round((100 * m) / a)}%)` : `${m}/${a}`);
  const num = (v) => (typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : v); // ujemne z typograficznym minusem
  const cell = (s, k) => (k === 's1' ? shot(s.p1m, s.p1a) : k === 's2' ? shot(s.p2m, s.p2a) : k === 's3' ? shot(s.p3m, s.p3a) : k === 'sfg' ? shot(s.fgm, s.fga) : k === 'pm' ? fmtPm(s.pm) : num(s[k]));
  const pct = (m, a) => (a ? Math.round((100 * m) / a) + '%' : '–');
  const LEGEND = 'c/w (%) – celne/wykonane i skuteczność · Z GRY – rzuty za 2 i 3 pkt razem · ZA – zbiórki w ataku · ZO – zbiórki w obronie · ZB – zbiórki razem · AS – asysty · PRZ – przechwyty · STR – straty · BL – bloki · FP – faule popełnione · FW – faule wymuszone · +/− – różnica punktów (zdobyte − stracone), gdy zawodnik był na boisku · EVAL = punkty − niecelne rzuty + asysty + przechwyty + zbiórki + bloki − straty · P1×1 – przegrane pojedynki 1×1 · DO – dobra obrona · DP – dobra pomoc · ZR – zła rotacja · EVAL K (końcowy) = EVAL − P1×1 + DO + DP − ZR';

  // Drużyna bez statystyk zawodników: zbiórki w ataku i faule (porównanie ze zbiórkami w obronie ŁKS)
  function oppSummaries(S) {
    return state.teams.filter((t) => !t.tracked).map((t) => {
      const o = otherTeam(t.id);
      return { t, pts: S.score[t.id], made: S.oppMade[t.id], oreb: S.oppReb[t.id], fouls: S.oppFouls[t.id], tov: S.oppTov[t.id], miss: S.oppMiss[t.id], ourDreb: o.tracked ? S.team(o.id).dreb : null, ourName: teamName(o) };
    });
  }

  // Raport: najpierw ŁKS, wszystko o rywalu na końcu
  const reportTeams = () => tracked().slice().sort((a, b) => (b.lks ? 1 : 0) - (a.lks ? 1 : 0));
  const oppItems = (x) => [['Punkty', x.pts], ['Trafione za 3 pkt', x.made[3]], ['Trafione za 2 pkt', x.made[2]], ['Trafione rzuty wolne (1 pkt)', x.made[1]],
    ['Niecelne rzuty', x.miss], ['Zbiórki w ataku', x.oreb], ['Straty', x.tov], ['Faule', x.fouls]];
  const OPP_NOTE = 'Statystyki rywala bez statystyk zawodników: straty obejmują też przechwyty naszych zawodników, niecelne rzuty — ich bloki, a faule — faule przez nich wymuszone.';

  // Drużyna w kolejnych kwartach: punkty zdobyte/stracone, rzuty, zbiórki, asysty, straty, faule
  const QCOLS = [['pf_', 'Zdobyte'], ['pa_', 'Stracone'], ['sfg', 'Z gry'], ['s3', 'Za 3'], ['s1', 'Wolne'], ['reb', 'ZB'], ['ast', 'AS'], ['tov', 'STR'], ['pf', 'FP']];
  function teamQuarterRows(S, t) {
    const qs = Array.from({ length: S.maxQ }, (_, i) => i + 1).filter((q) => q <= 4 || state.events.some((e) => e.q === q));
    const o = otherTeam(t.id);
    const val = (st, k, q) => (k === 'pf_' ? (q ? S.qPts[t.id][q] || 0 : S.score[t.id]) : k === 'pa_' ? (q ? S.qPts[o.id][q] || 0 : S.score[o.id]) : String(cell(st, k)));
    const rows = qs.map((q) => ({ label: qLabel(q), vals: QCOLS.map(([k]) => val(S.teamQ(t.id, q), k, q)) }));
    rows.push({ label: 'Razem', total: true, vals: QCOLS.map(([k]) => val(S.team(t.id), k, 0)) });
    return rows;
  }
  // Piątki: bilans punktów, gdy grały razem (najlepsze na górze)
  function unitRows(S, t) {
    return S.units(t.id).filter((u) => u.ids.length >= Math.min(5, t.squad.length))
      .sort((a, b) => b.pm - a.pm || b.pf - a.pf || a.pa - b.pa)
      .slice(0, 8)
      .map((u) => ({ ...u, names: sortPlayers(u.ids.map((id) => playerById(t, id)).filter(Boolean)).map((p) => `${p.num} ${p.last}`) }));
  }

  function quarterRows(S) {
    const qs = Array.from({ length: S.maxQ }, (_, i) => i + 1);
    return { qs, rows: state.teams.map((t) => ({ t, vals: qs.map((q) => S.qPts[t.id][q] || 0), total: S.score[t.id] })) };
  }

  function renderBox() {
    const S = computeAll();
    const [ta, tb] = state.teams;
    const QR = quarterRows(S);
    const qTable = `
      <table class="qtable"><thead><tr><th></th>${QR.qs.map((q) => `<th>${qShort(q)}</th>`).join('')}<th>Σ</th></tr></thead>
      <tbody>${QR.rows.map((r) => `<tr><td><span class="dot" style="${teamVars(r.t)}"></span>${esc(teamName(r.t))}</td>${r.vals.map((v) => `<td>${v}</td>`).join('')}<td><b>${r.total}</b></td></tr>`).join('')}</tbody></table>`;
    const tables = reportTeams().map((t) => {
      const plist = sortPlayers(squadOf(t)).map((p) => ({ p, s: S.player(t.id, p.id) }));
      const isBest = bestOf(plist.map((x) => x.s));
      const cls = (s, k) => [
        k === 'pts' || k === 'eval' || k === 'evalf' ? 'em' : '',
        k === 'evalf' ? 'evalf' : '',
        GROUP_START.has(k) ? 'gs' : '',
        k === 'pm' ? (s.pm > 0 ? 'pm-plus' : s.pm < 0 ? 'pm-minus' : '') : '',
        isBest(s, k) ? 'best' : '',
      ].filter(Boolean).join(' ');
      const rows = plist.map(({ p, s }) => `<tr><td class="stk nr">${esc(p.num)}</td><td class="stk nm">${esc(p.last)}${p.first ? ' ' + esc(p.first.charAt(0)) + '.' : ''}</td>${COLS.map(([k]) => `<td class="${cls(s, k)}">${cell(s, k)}</td>`).join('')}</tr>`).join('');
      const T = S.team(t.id);
      const groupRow = `<tr class="grp"><th class="stk nr"></th><th class="stk nm"></th>${COL_GROUPS.map(([g, cols]) => `<th colspan="${cols.length}" class="gs ${g ? '' : 'nog'}">${g}</th>`).join('')}</tr>`;
      const QT = teamQuarterRows(S, t);
      const qtab = `
          <h3 class="box-sub">${esc(teamName(t))} w kwartach</h3>
          <div class="tscroll"><table class="stats qstats">
            <thead><tr><th class="stk q">Kwarta</th>${QCOLS.map(([, h]) => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${QT.filter((r) => !r.total).map((r) => `<tr><td class="stk q">${r.label}</td>${r.vals.map((v, i) => `<td class="${i < 2 ? 'em' : ''}">${v}</td>`).join('')}</tr>`).join('')}</tbody>
            <tfoot>${QT.filter((r) => r.total).map((r) => `<tr><td class="stk q">${r.label}</td>${r.vals.map((v) => `<td>${v}</td>`).join('')}</tr>`).join('')}</tfoot>
          </table></div>`;
      const U = unitRows(S, t);
      const utab = U.length ? `
          <h3 class="box-sub">Najskuteczniejsze piątki ${esc(teamName(t))} — bilans +/−</h3>
          <ol class="units">${U.map((u, i) => `<li><span class="u-rk">${i + 1}.</span><span class="u-pm ${u.pm > 0 ? 'plus' : u.pm < 0 ? 'minus' : ''}">${fmtPm(u.pm)}</span><span class="u-sc">${u.pf}:${u.pa}</span><span class="u-nm">${u.names.map(esc).join(', ')}</span></li>`).join('')}</ol>
          <p class="muted small">Kombinacje pięciu zawodników, które były razem na parkiecie, od najlepszego bilansu. Liczby: punkty zdobyte : stracone, gdy dokładnie ta piątka grała razem.</p>` : '';
      return `
        <section class="box-team" style="${teamVars(t)}">
          <h2><span class="dot"></span>${esc(teamName(t))}</h2>
          <div class="tscroll"><table class="stats">
            <thead>${groupRow}<tr><th class="stk nr">Nr</th><th class="stk nm">Zawodnik</th>${COLS.map(([k, h]) => `<th class="${GROUP_START.has(k) ? 'gs' : ''}${k === 'evalf' ? ' evalf' : ''}">${h}</th>`).join('')}</tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td class="stk nr"></td><td class="stk nm">Razem</td>${COLS.map(([k]) => `<td class="${GROUP_START.has(k) ? 'gs' : ''}${k === 'evalf' ? ' evalf' : ''}">${cell(T, k)}</td>`).join('')}</tr></tfoot>
          </table></div>
          <p class="muted small">Skuteczność: z gry ${pct(T.fgm, T.fga)} · 1 pkt ${pct(T.p1m, T.p1a)} · 2 pkt ${pct(T.p2m, T.p2a)} · 3 pkt ${pct(T.p3m, T.p3a)} · <span class="best-key">wyróżnione</span> = najlepszy wynik w meczu</p>
          ${qtab}
          ${utab}
        </section>`;
    }).join('');
    const canShare = !!(navigator.canShare && window.File);
    return `
      <header class="topbar">
        <button class="icon-btn" data-act="go" data-to="live" aria-label="Wstecz">‹</button>
        <div class="tb-title">${state.finished ? 'Wynik końcowy' : 'Tabela statystyk'}</div><div></div>
      </header>
      <div class="wrap">
        <div class="final">
          <div style="${teamVars(ta)}"><span class="dot"></span>${esc(teamName(ta))}</div>
          <b>${S.score.A} : ${S.score.B}</b>
          <div style="${teamVars(tb)}">${esc(teamName(tb))}<span class="dot"></span></div>
        </div>
        ${qTable}
        ${tables}
        ${oppSummaries(S).map((x) => `
          <section class="opp-final" style="${teamVars(x.t)}">
            <h2><span class="dot"></span>${esc(teamName(x.t))} <span class="muted small">— rywal</span></h2>
            <ul class="opp-list">${oppItems(x).map(([l, v]) => `<li>${l}: <b>${v}</b></li>`).join('')}</ul>
          </section>`).join('')}
        <p class="legend muted small">${LEGEND}${oppSummaries(S).length ? ' · ' + OPP_NOTE : ''}</p>
      </div>
      <div class="footbar box-foot">
        <button class="btn block cloud-btn" data-act="cloud-save">☁️ Zapisz w Arkuszu Google<small>${esc(cloudStatus())}</small></button>
        <div class="two">
          <button class="btn primary" data-act="pdf">Pobierz PDF</button>
          ${canShare ? '<button class="btn" data-act="share">Udostępnij PDF</button>' : '<button class="btn" data-act="go" data-to="live">Wróć do meczu</button>'}
        </div>
      </div>`;
  }

  // ---------- zapis w Arkuszu Google ----------
  // Adres skryptu i PIN są tylko w pamięci tego telefonu (nie w kodzie w publicznym repozytorium).
  const CLOUD_KEY = 'statystyki:cloud';
  const QUEUE_KEY = 'statystyki:queue';
  const SENT_KEY = 'statystyki:sent';
  const lsGet = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* brak */ } };
  const cloudCfg = () => lsGet(CLOUD_KEY, null);
  const cloudReady = () => { const c = cloudCfg(); return !!(c && c.url && c.pin); };
  let flushing = false;

  function cloudStatus() {
    if (!cloudReady()) return 'nie skonfigurowano — dotknij, aby ustawić';
    if (lsGet(QUEUE_KEY, []).some((x) => x.id === state.id)) return 'czeka na wysłanie (brak internetu?)';
    const t = lsGet(SENT_KEY, {})[state.id];
    if (t) return 'ostatnio zapisano: ' + new Date(t).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    return 'jeszcze nie zapisano';
  }

  function buildCloudMatch() {
    const S = computeAll();
    const [ta, tb] = state.teams;
    const lks = lksTeam();
    const QR = quarterRows(S);
    const quarters = QR.qs.map((q) => `${qShort(q)}: ${S.qPts.A[q] || 0}-${S.qPts.B[q] || 0}`).join(', ');
    let lksResult = '';
    if (lks && state.finished) {
      const a = S.score[lks.id], b = S.score[otherTeam(lks.id).id];
      lksResult = a > b ? 'wygrana' : a < b ? 'porażka' : 'remis';
    }
    const rows = [];
    for (const t of tracked()) {
      for (const p of sortPlayers(squadOf(t))) {
        const st = S.player(t.id, p.id);
        rows.push({
          team: teamName(t), opponent: teamName(otherTeam(t.id)), num: p.num, last: p.last, first: p.first || '',
          pts: st.pts, p1m: st.p1m, p1a: st.p1a, p2m: st.p2m, p2a: st.p2a, p3m: st.p3m, p3a: st.p3a,
          oreb: st.oreb, dreb: st.dreb, reb: st.reb, ast: st.ast, stl: st.stl, tov: st.tov, blk: st.blk, pf: st.pf, fd: st.fd, eval: st.eval, pm: st.pm,
          l1v1: st.l1v1, gdef: st.gdef, ghelp: st.ghelp, brot: st.brot, evalf: st.evalf,
        });
      }
    }
    return {
      id: state.id, created: state.created, finished: !!state.finished,
      home: teamName(ta), away: teamName(tb), scoreHome: S.score.A, scoreAway: S.score.B,
      lksSide: lks ? (lks.id === 'A' ? 'gospodarz' : 'gość') : '', lksResult, quarters, rows,
      oppOreb: oppSummaries(S).length ? oppSummaries(S)[0].oreb : '', oppFouls: oppSummaries(S).length ? oppSummaries(S)[0].fouls : '',
      oppTov: oppSummaries(S).length ? oppSummaries(S)[0].tov : '', oppMiss: oppSummaries(S).length ? oppSummaries(S)[0].miss : '',
      replay: {
        v: 1, created: state.created, finished: !!state.finished, quarter: state.quarter,
        teams: state.teams.map((t) => ({ id: t.id, lks: !!t.lks, name: t.name, color: t.color, tracked: t.tracked, players: t.players, squad: t.squad })),
        events: state.events.map((e) => [e.t, e.p, e.a, e.q, e.ts, e.on || null, e.nd || 0]),
      },
    };
  }

  function queueMatch() {
    if (!state.id) { state.id = uid(); save(); }
    const q = lsGet(QUEUE_KEY, []).filter((x) => x.id !== state.id);
    q.push({ id: state.id, v: Date.now(), match: buildCloudMatch() });
    lsSet(QUEUE_KEY, q);
  }

  async function postCloud(url, body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    try {
      const r = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', signal: ctrl.signal });
      const txt = await r.text();
      try { return JSON.parse(txt); } catch (e) {
        return { ok: false, error: 'Nieoczekiwana odpowiedź. Sprawdź adres skryptu i ustawienie „Kto ma dostęp: Każdy”.' };
      }
    } finally { clearTimeout(timer); }
  }

  // Wysyła wszystkie mecze czekające w kolejce. Bez internetu zostają w kolejce na później.
  async function flushQueue(verbose) {
    const c = cloudCfg();
    if (flushing || !c || !c.url) return;
    let q = lsGet(QUEUE_KEY, []);
    if (!q.length) return;
    flushing = true;
    let sent = 0, offline = false, err = null;
    for (const item of q) {
      try {
        const res = await postCloud(c.url, { pin: c.pin, match: item.match });
        if (res && res.ok) {
          sent++;
          lsSet(QUEUE_KEY, lsGet(QUEUE_KEY, []).filter((x) => !(x.id === item.id && x.v === item.v)));
          const sentMap = lsGet(SENT_KEY, {}); sentMap[item.id] = Date.now(); lsSet(SENT_KEY, sentMap);
        } else err = (res && res.error) || 'Nieznany błąd';
      } catch (e) { offline = true; break; }
    }
    flushing = false;
    if (verbose) {
      if (offline) toast('Brak internetu — mecz wyśle się sam, gdy wróci zasięg.');
      else if (err) toast('Arkusz Google: ' + err, 'bad');
      else if (sent) toast(sent > 1 ? `Zapisano w Arkuszu Google (${sent} mecze) ✓` : 'Zapisano w Arkuszu Google ✓');
    }
    if (state && state.screen === 'box' && app.className === 'scr-box') render();
  }

  function saveToCloud() {
    if (!cloudReady()) { openSheet({ kind: 'cloud' }); return; }
    queueMatch();
    toast('Wysyłam do Arkusza Google…');
    flushQueue(true);
  }

  window.addEventListener('online', () => flushQueue(false));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flushQueue(false); });

  // ---------- PDF ----------
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Nie udało się wczytać ' + src));
      document.head.appendChild(s);
    });
  }
  async function ensurePdf() {
    if (!window.pdfMake) await loadScript('lib/pdfmake.min.js');
    if (!window.pdfMake.vfs || !Object.keys(window.pdfMake.vfs).length) await loadScript('lib/vfs_fonts.js');
  }

  function pdfFileName() {
    const clean = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
    const d = new Date(state.created);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `statystyki_${clean(teamName(state.teams[0]))}_${clean(teamName(state.teams[1]))}_${ds}.pdf`;
  }

  function buildDoc() {
    const S = computeAll();
    const [ta, tb] = state.teams;
    const QR = quarterRows(S);
    const d = new Date(state.created);
    const dateStr = d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }) + ', ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    const thin = { hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => '#c9ced6', paddingTop: () => 3, paddingBottom: () => 3, paddingLeft: () => 4, paddingRight: () => 4 };

    const content = [
      {
        columns: [
          { text: teamName(ta), style: 'teamName', alignment: 'right' },
          { text: `${S.score.A} : ${S.score.B}`, style: 'score', width: 120, alignment: 'center' },
          { text: teamName(tb), style: 'teamName' },
        ], columnGap: 12,
      },
      { text: `${state.finished ? 'Wynik końcowy' : 'Stan meczu'} · ${dateStr}`, style: 'meta', alignment: 'center', margin: [0, 4, 0, 10] },
      {
        columns: [{ width: '*', text: '' }, {
          width: 'auto',
          table: {
            headerRows: 1,
            body: [
              [{ text: '', style: 'th' }, ...QR.qs.map((q) => ({ text: qShort(q), style: 'th', alignment: 'center' })), { text: 'Razem', style: 'th', alignment: 'center' }],
              ...QR.rows.map((r) => [{ text: teamName(r.t), bold: true }, ...r.vals.map((v) => ({ text: String(v), alignment: 'center' })), { text: String(r.total), bold: true, alignment: 'center' }]),
            ],
          }, layout: thin,
        }, { width: '*', text: '' }],
        margin: [0, 0, 0, 14],
      },
    ];
    const BEST_FILL = '#d6f2df', EVALK_FILL = '#fff1c7';
    for (const t of reportTeams()) {
      const T = S.team(t.id);
      const plist = sortPlayers(squadOf(t)).map((p) => ({ p, s: S.player(t.id, p.id) }));
      const isBest = bestOf(plist.map((x) => x.s));
      const groupRow = [{ text: '', style: 'th' }, { text: '', style: 'th' }];
      for (const [g, cols] of COL_GROUPS) {
        groupRow.push({ text: g, style: 'thg', colSpan: cols.length, alignment: 'center' });
        for (let i = 1; i < cols.length; i++) groupRow.push({});
      }
      const head = [{ text: 'Nr', style: 'th' }, { text: 'Zawodnik', style: 'th' }, ...COLS.map(([k, h]) => ({ text: h, style: 'th', alignment: 'center', fillColor: k === 'evalf' ? EVALK_FILL : undefined }))];
      const body = [groupRow, head];
      for (const { p, s } of plist) {
        body.push([
          { text: p.num, alignment: 'center' },
          { text: [{ text: p.last, bold: true }, p.first ? ' ' + p.first.charAt(0) + '.' : ''], noWrap: true },
          ...COLS.map(([k]) => {
            const best = isBest(s, k);
            return { text: String(cell(s, k)), alignment: 'center', bold: best || k === 'pts' || k === 'eval' || k === 'evalf', fillColor: best ? BEST_FILL : k === 'evalf' ? EVALK_FILL : undefined, fontSize: k === 'evalf' ? 9 : undefined };
          }),
        ]);
      }
      body.push([{ text: '' }, { text: 'Razem', bold: true }, ...COLS.map(([k]) => ({ text: String(cell(T, k)), alignment: 'center', bold: true, fillColor: k === 'evalf' ? EVALK_FILL : undefined }))]);
      // pionowe linie oddzielające grupy kolumn
      const sepAt = new Set([2]);
      { let i = 2; for (const [, cols] of COL_GROUPS) { sepAt.add(i); i += cols.length; } }
      content.push(
        {
          columns: [
            { width: 10, canvas: [{ type: 'rect', x: 0, y: 2, w: 10, h: 10, color: t.color, lineColor: '#888888', lineWidth: 0.5 }] },
            { text: teamName(t), style: 'h2' },
          ], columnGap: 6, margin: [0, 6, 0, 4],
        },
        {
          table: { headerRows: 2, widths: [16, '*', ...COLS.map(([k]) => (/^s(\d|fg)$/.test(k) ? 47 : k === 'eval' || k === 'evalf' ? 28 : 20))], body },
          fontSize: 8,
          layout: {
            ...thin,
            vLineWidth: (i) => (sepAt.has(i) ? 0.5 : 0),
            vLineColor: () => '#c9ced6',
            paddingLeft: () => 2, paddingRight: () => 2, paddingTop: () => 2.2, paddingBottom: () => 2.2,
            fillColor: (row) => (row <= 1 ? '#eef1f4' : row === body.length - 1 ? '#f6f7f9' : null),
          },
        },
        { text: [`Skuteczność: z gry ${pct(T.fgm, T.fga)}  ·  1 pkt ${pct(T.p1m, T.p1a)}  ·  2 pkt ${pct(T.p2m, T.p2a)}  ·  3 pkt ${pct(T.p3m, T.p3a)}  ·  `, { text: ' zielone tło ', background: BEST_FILL, color: '#1d232b' }, ' = najlepszy wynik w meczu'], style: 'meta', margin: [0, 4, 0, 10] },
      );
      // drużyna w kwartach + piątki — obok siebie
      const QT = teamQuarterRows(S, t);
      const qBody = [
        [{ text: 'Kwarta', style: 'th' }, ...QCOLS.map(([, h]) => ({ text: h, style: 'th', alignment: 'center' }))],
        ...QT.map((r) => [{ text: r.label, bold: !!r.total }, ...r.vals.map((v, i) => ({ text: String(v), alignment: 'center', noWrap: true, bold: !!r.total || i < 2 }))]),
      ];
      const U = unitRows(S, t);
      const uBody = [
        [{ text: '', style: 'th' }, { text: '+/−', style: 'th', alignment: 'center' }, { text: 'Pkt', style: 'th', alignment: 'center' }, { text: 'Piątka', style: 'th' }],
        ...U.map((u, i) => [
          { text: `${i + 1}.`, alignment: 'right', color: '#5b6573' },
          { text: fmtPm(u.pm), alignment: 'center', bold: true, color: u.pm > 0 ? '#0b7a3b' : u.pm < 0 ? '#b42318' : '#1d232b' },
          { text: `${u.pf}:${u.pa}`, alignment: 'center' },
          { text: u.names.join(', ') },
        ]),
      ];
      content.push({
        columns: [
          { width: 'auto', stack: [
            { text: `${teamName(t)} w kwartach`, style: 'h3' },
            { table: { headerRows: 1, body: qBody }, fontSize: 8, layout: { ...thin, paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 2, paddingBottom: () => 2, fillColor: (row) => (row === 0 ? '#eef1f4' : row === qBody.length - 1 ? '#f6f7f9' : null) } },
          ] },
          U.length ? { width: '*', stack: [
            { text: `Najskuteczniejsze piątki ${teamName(t)} — bilans +/−`, style: 'h3' },
            { table: { headerRows: 1, widths: [12, 24, 30, '*'], body: uBody }, fontSize: 8, layout: { ...thin, paddingTop: () => 2, paddingBottom: () => 2, fillColor: (row) => (row === 0 ? '#eef1f4' : null) } },
            { text: 'Kombinacje pięciu zawodników, które były razem na parkiecie, od najlepszego bilansu. Pkt = zdobyte : stracone, gdy dokładnie ta piątka grała razem.', style: 'meta', fontSize: 7.5, margin: [0, 3, 0, 0] },
          ] } : { width: '*', text: '' },
        ],
        columnGap: 18, margin: [0, 0, 0, 8],
      });
    }
    for (const x of oppSummaries(S)) {
      content.push({ unbreakable: true, stack: [
        {
          columns: [
            { width: 10, canvas: [{ type: 'rect', x: 0, y: 2, w: 10, h: 10, color: x.t.color, lineColor: '#888888', lineWidth: 0.5 }] },
            { text: [teamName(x.t), { text: '  — rywal', bold: false, color: '#5b6573', fontSize: 10 }], style: 'h2' },
          ], columnGap: 6, margin: [0, 6, 0, 4],
        },
        (() => {
          const li = oppItems(x).map(([l, v]) => ({ text: [l + ': ', { text: String(v), bold: true }] }));
          const half = Math.ceil(li.length / 2);
          return { columns: [{ width: 'auto', ul: li.slice(0, half) }, { width: 'auto', ul: li.slice(half) }], columnGap: 40, fontSize: 10, margin: [4, 0, 0, 12] };
        })(),
      ] });
    }
    content.push({ text: LEGEND + (oppSummaries(S).length ? '  ·  ' + OPP_NOTE : ''), style: 'legend' });

    return {
      pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [26, 22, 26, 22],
      info: { title: `${teamName(ta)} – ${teamName(tb)}` },
      content,
      defaultStyle: { font: 'Roboto', fontSize: 9, color: '#1d232b' },
      styles: {
        teamName: { fontSize: 18, bold: true, margin: [0, 6, 0, 0] },
        score: { fontSize: 28, bold: true },
        meta: { fontSize: 9, color: '#5b6573' },
        h2: { fontSize: 12, bold: true },
        th: { bold: true, fontSize: 7.5, color: '#3a4350' },
        thg: { bold: true, fontSize: 6.5, color: '#6b7480', characterSpacing: 0.6 },
        h3: { fontSize: 9.5, bold: true, margin: [0, 0, 0, 3] },
        legend: { fontSize: 7.5, color: '#6b7480' },
      },
    };
  }

  async function exportPdf(share) {
    try {
      toast('Przygotowuję PDF…');
      await ensurePdf();
      const doc = window.pdfMake.createPdf(buildDoc());
      const name = pdfFileName();
      if (share) {
        doc.getBlob(async (blob) => {
          const file = new File([blob], name, { type: 'application/pdf' });
          try {
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], title: name });
            } else {
              doc.download(name);
            }
          } catch (e) { /* użytkownik anulował udostępnianie */ }
        });
      } else {
        doc.download(name);
      }
    } catch (e) {
      toast('Nie udało się utworzyć PDF. Sprawdź połączenie i spróbuj ponownie.', 'bad');
    }
  }

  // ---------- arkusze (zmiany, menu) ----------
  function openSheet(sheet) {
    ui.sheet = sheet;
    if (onLive()) {
      // otwarcie okna w trakcie meczu czyści zaznaczenie (żeby po zamknięciu nie wisiało „zaznaczone”)
      ui.selP = ui.selA = null;
      clearFollow();
      render();
    } else renderSheet();
  }
  function closeSheet() { ui.sheet = null; closeSheetDom(); }
  function closeSheetDom() { sheetRoot.innerHTML = ''; document.body.classList.remove('sheet-open'); }

  function renderSheet() {
    const sh = ui.sheet;
    if (!sh) return;
    let inner = '';
    if (sh.kind === 'subs') {
      const t = teamById(sh.team);
      const n = sh.sel.length;
      inner = `
        <div class="sheet-h" style="${teamVars(t)}"><span class="dot"></span><b>Zmiany — ${esc(teamName(t))}</b><span class="count ${n === 5 ? 'ok' : n > 5 ? 'bad' : ''}">Na boisku: ${n}/5</span></div>
        <p class="muted small">Dotknij, kto schodzi, i kto wchodzi. Podświetleni = na boisku.</p>
        <div class="chip-grid" style="${teamVars(t)}">
          ${sortPlayers(squadOf(t)).map((p) => `
            <button class="pchip ${sh.sel.includes(p.id) ? 'on' : ''}" data-act="sub-toggle" data-pid="${p.id}">
              <span class="pc-num">${esc(p.num)}</span><span class="pc-name">${esc(p.last)}</span>
            </button>`).join('')}
        </div>
        <form class="mini-add" data-form="sub-add" autocomplete="off">
          <input class="field num" id="sa-num" inputmode="numeric" maxlength="3" placeholder="Nr">
          <input class="field" id="sa-last" placeholder="Nowy zawodnik — nazwisko" maxlength="30">
          <button class="btn" type="submit">+</button>
        </form>
        <div class="sheet-actions">
          <button class="btn" data-act="sheet-close">Anuluj</button>
          <button class="btn primary" data-act="sub-done" ${n >= 1 && n <= 5 ? '' : 'disabled'}>Gotowe</button>
        </div>`;
    } else if (sh.kind === 'qsub') {
      const t = teamById(sh.team), out = playerById(t, sh.pid);
      const S = computeAll();
      const bench = sortPlayers(squadOf(t).filter((x) => !t.onCourt.includes(x.id)));
      inner = `
        <div class="sheet-h" style="${teamVars(t)}"><span class="dot"></span><b>Schodzi #${esc(out.num)} ${esc(out.last)}</b></div>
        ${sh.reason === 'fouls' ? '<p class="note-bad">5 fauli — zawodnik musi zejść. Kto wchodzi?</p>' : '<p class="muted small">Kto wchodzi? Dotknij zawodnika z ławki.</p>'}
        <div class="chip-grid" style="${teamVars(t)}">
          ${bench.map((p) => { const pf = S.player(t.id, p.id).pf; return `
            <button class="pchip ${pf >= 5 ? 'out' : ''}" data-act="qsub-pick" data-pid="${p.id}">
              <span class="pc-num">${esc(p.num)}</span><span class="pc-name">${esc(p.last)}</span>${pf ? `<span class="pc-first">${pf} F</span>` : ''}
            </button>`; }).join('') || '<p class="muted">Brak zawodników na ławce.</p>'}
        </div>
        <div class="sheet-actions">
          <button class="btn" data-act="sheet-close">${sh.reason === 'fouls' ? 'Później' : 'Anuluj'}</button>
          <button class="btn" data-act="subs" data-team="${t.id}">Więcej zmian…</button>
        </div>`;
    } else if (sh.kind === 'edit') {
      const ev = state.events.find((e) => e.id === sh.id);
      if (!ev) { ui.sheet = null; return; }
      const t = teamById(ev.t);
      const isOpp = !ev.p;
      const acts = isOpp ? ['opp1', 'opp2', 'opp3', 'oppmiss', 'oppreb', 'opptov', 'oppf'] : EDIT_ACTIONS;
      const pls = isOpp ? [] : sortPlayers(t.players.filter((p) => t.squad.includes(p.id) || p.id === sh.p));
      const nQ = Math.max(4, state.quarter, ...state.events.map((e) => e.q));
      inner = `
        <div class="sheet-h" style="${teamVars(t)}"><span class="dot"></span><b>Popraw akcję — ${esc(teamName(t))}</b></div>
        <div class="label">Akcja</div>
        <div class="edit-grid">${acts.map((k) => `<button class="echip ${sh.a === k ? 'on' : ''}" data-act="edit-a" data-a="${k}">${A[k].label}</button>`).join('')}</div>
        ${isOpp ? '' : `<div class="label">Zawodnik</div>
        <div class="chip-grid" style="${teamVars(t)}">${pls.map((p) => `<button class="pchip ${sh.p === p.id ? 'on' : ''}" data-act="edit-p" data-pid="${p.id}"><span class="pc-num">${esc(p.num)}</span><span class="pc-name">${esc(p.last)}</span></button>`).join('')}</div>`}
        <div class="label">Kwarta</div>
        <div class="edit-q">${Array.from({ length: nQ }, (_, i) => i + 1).map((q) => `<button class="echip ${sh.q === q ? 'on' : ''}" data-act="edit-q" data-q="${q}">${qShort(q)}</button>`).join('')}</div>
        <div class="sheet-actions three">
          <button class="btn danger" data-act="edit-del">Usuń</button>
          <button class="btn" data-act="sheet-close">Anuluj</button>
          <button class="btn primary" data-act="edit-save">Zapisz</button>
        </div>`;
    } else if (sh.kind === 'quarter') {
      const nQ = Math.max(5, state.quarter + 1);
      inner = `
        <div class="sheet-h"><b>Kwarta</b></div>
        <div class="q-grid">
          ${Array.from({ length: nQ }, (_, i) => i + 1).map((q) => `<button class="qbig ${q === state.quarter ? 'on' : ''}" data-act="q" data-q="${q}">${qLabel(q)}</button>`).join('')}
        </div>
        <div class="sheet-actions"><button class="btn block" data-act="sheet-close">Zamknij</button></div>`;
    } else if (sh.kind === 'cloud') {
      const c = cloudCfg() || {};
      inner = `
        <div class="sheet-h"><b>☁️ Arkusz Google</b></div>
        <p class="muted small">Wklej adres skryptu z Arkusza Google (kończy się na <b>/exec</b>) i PIN ustawiony w skrypcie. Te dane zostają tylko na tym telefonie.</p>
        <div class="label">Adres skryptu</div>
        <input id="cl-url" class="field" value="${esc(c.url || '')}" placeholder="https://script.google.com/macros/s/…/exec" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off">
        <div class="label">PIN</div>
        <input id="cl-pin" class="field" value="${esc(c.pin || '')}" placeholder="PIN ze skryptu" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off">
        <div id="cl-status" class="cl-status muted small"></div>
        <div class="sheet-actions">
          <button class="btn" data-act="cloud-test">Sprawdź połączenie</button>
          <button class="btn primary" data-act="cloud-store">Zapisz</button>
        </div>
        ${c.url ? '<button class="linkbtn danger-link" data-act="cloud-clear">Odłącz arkusz na tym telefonie</button>' : ''}`;
    } else if (sh.kind === 'menu') {
      inner = `
        <div class="sheet-h"><b>Menu meczu</b></div>
        <div class="menu-list">
          <button class="menu-item" data-act="finish">🏁 Zakończ mecz i pokaż tabelę</button>
          <button class="menu-item" data-act="toggle-hints">💡 Podpowiedzi asyst i zbiórek: <b>${state.hints ? 'wł.' : 'wył.'}</b></button>
          <button class="menu-item" data-act="toggle-vibe">📳 Wibracja po zapisaniu akcji: <b>${vibeOn() ? 'wł.' : 'wył.'}</b></button>
          <button class="menu-item" data-act="toggle-theme">${theme === 'light' ? '🌙 Motyw: <b>jasny</b> — przełącz na ciemny' : '☀️ Motyw: <b>ciemny</b> — przełącz na jasny'}</button>
          <button class="menu-item" data-act="cloud-settings">☁️ Arkusz Google: <b>${cloudReady() ? 'połączony' : 'skonfiguruj'}</b></button>
          <button class="menu-item" data-act="same-rosters">🔁 Nowy mecz — te same drużyny i składy</button>
          <button class="menu-item danger" data-act="reset">🗑️ Nowy mecz od zera</button>
        </div>
        <div class="sheet-actions"><button class="btn block" data-act="sheet-close">Zamknij</button></div>`;
    }
    sheetRoot.innerHTML = `<div class="backdrop" data-act="sheet-close"></div><div class="sheet" role="dialog">${inner}</div>`;
    document.body.classList.add('sheet-open');
  }

  // ---------- obsługa kliknięć ----------
  function handle(el) {
    const d = el.dataset;
    switch (d.act) {
      case 'new':
        if (state && (state.events.length || state.teams.some((t) => t.squad.length)) && !confirm('Rozpocząć nowy mecz? Obecny mecz zostanie usunięty z telefonu.')) return;
        state = newMatch(); ui.lastId = null; go('teams'); break;
      case 'resume': go(state.screen); break;
      case 'back':
        if (d.to === 'home') { showHome(); return; }
        go(d.to); break;
      case 'go': go(d.to); break;
      case 'color': {
        const t = teamById(d.team); t.color = d.color; save(); render(); break;
      }
      case 'teams-next': {
        if (!tracked().length) { toast('Zaznacz co najmniej jedną drużynę do statystyk.', 'bad'); return; }
        state.setupTab = (lksTeam().tracked ? lksTeam() : tracked()[0]).id; go('players'); break;
      }
      case 'tab': state.setupTab = d.team; save(); render(); break;
      case 'lks-side': {
        if (lksTeam().id === d.side) return;
        if (state.events.length) { toast('Nie można zmienić w trakcie meczu.', 'bad'); return; }
        state.teams.reverse();
        state.teams[0].id = 'A'; state.teams[1].id = 'B';
        state.setupTab = lksTeam().id;
        save(); render(); break;
      }
      case 'squad-toggle': {
        const t = teamById(d.team);
        if (t.squad.includes(d.pid)) { t.squad = t.squad.filter((id) => id !== d.pid); t.onCourt = t.onCourt.filter((id) => id !== d.pid); }
        else t.squad.push(d.pid);
        vibrate(8); save(); render(); break;
      }
      case 'squad-last': {
        const t = teamById(d.team), ids = lastSquadFor(t);
        if (ids) { t.squad = ids.slice(); t.onCourt = t.onCourt.filter((id) => ids.includes(id)); vibrate(8); save(); render(); }
        break;
      }
      case 'five-last': {
        const t = teamById(d.team), ids = lastFiveFor(t);
        if (ids) { t.onCourt = ids.slice(); vibrate(8); save(); render(); }
        break;
      }
      case 'squad-all': { const t = teamById(d.team); t.squad = t.players.map((p) => p.id); save(); render(); break; }
      case 'squad-none': { const t = teamById(d.team); t.squad = []; t.onCourt = []; save(); render(); break; }
      case 'extra-toggle': ui.extraOpen = !ui.extraOpen; ui.focusNum = ui.extraOpen; render(); break;
      case 'del-player': {
        const t = teamById(d.team);
        t.players = t.players.filter((p) => p.id !== d.pid);
        t.squad = t.squad.filter((id) => id !== d.pid);
        t.onCourt = t.onCourt.filter((id) => id !== d.pid);
        save(); render(); break;
      }
      case 'paste-toggle': ui.pasteOpen = !ui.pasteOpen; render(); break;
      case 'paste-add': {
        const t = teamById(d.team);
        const lines = (document.getElementById('paste').value || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
        let ok = 0; const errs = [];
        for (const line of lines) {
          const m = line.match(/^#?(\d{1,3})[\s.,;:\-–]+(\S+)(?:\s+(.+))?$/);
          if (!m) { errs.push(line); continue; }
          const err = addPlayer(t, m[1], m[2], m[3]);
          if (err) errs.push(line); else ok++;
        }
        save(); ui.pasteOpen = errs.length > 0; render();
        if (errs.length) {
          const ta = document.getElementById('paste'); if (ta) ta.value = errs.join('\n');
          toast(`Dodano ${ok}. Nie rozpoznano ${errs.length} — popraw je w polu.`, 'bad');
        } else toast(`Dodano ${ok} zawodników.`);
        break;
      }
      case 'players-next': {
        const empty = tracked().find((t) => !t.squad.length);
        if (empty) { state.setupTab = empty.id; save(); render(); toast(empty.lks ? 'Wybierz skład meczowy ŁKS.' : `Dodaj zawodników: ${teamName(empty)}.`, 'bad'); return; }
        go('lineup'); break;
      }
      case 'lineup-toggle': {
        const t = teamById(d.team);
        if (t.onCourt.includes(d.pid)) t.onCourt = t.onCourt.filter((id) => id !== d.pid);
        else if (t.onCourt.length < 5) t.onCourt.push(d.pid);
        else { toast('Piątka jest pełna — najpierw odznacz kogoś.'); return; }
        save(); render(); break;
      }
      case 'start': {
        const bad = tracked().find((t) => t.onCourt.length !== Math.min(5, t.squad.length));
        if (bad) { toast(`Wybierz pierwszą piątkę: ${teamName(bad)}.`, 'bad'); return; }
        const lk = lksTeam();
        if (lk && lk.tracked && lk.squad.length) { try { localStorage.setItem(LAST_KEY, JSON.stringify({ squad: lk.squad.slice(), five: lk.onCourt.slice(), ts: Date.now() })); } catch (e) { /* brak */ } }
        go('live'); break;
      }
      case 'player': tapPlayer(d.team, d.pid); break;
      case 'action': tapAction(d.a); break;
      case 'opp': clearFollow(); ui.selP = ui.selA = null; record('opp' + d.v, d.team, null); break;
      case 'opp-oreb': {
        const f = ui.follow; if (!f || !f.oppReb) return;
        record('oppreb', f.oppReb, null, { chained: true });
        break;
      }
      case 'ft': {
        const f = ui.follow; if (!f || !f.ft) return;
        record(d.r === 'm' ? 'p1m' : 'p1x', f.ft.team, f.ft.pid);
        break;
      }
      case 'and-one': {
        const f = ui.follow; if (!f || !f.andOne) return;
        record('fd', f.andOne.team, f.andOne.pid, { andOne: true });
        break;
      }
      case 'qsub-pick': {
        const sh = ui.sheet; const t = teamById(sh.team);
        const outP = playerById(t, sh.pid), inP = playerById(t, d.pid);
        t.onCourt = t.onCourt.map((id) => (id === sh.pid ? d.pid : id));
        ui.sheet = null; save(); render();
        toast(`Zmiana: #${outP.num} ${outP.last} ⇄ #${inP.num} ${inP.last}`);
        break;
      }
      case 'edit-event': {
        const ev = state.events.find((e) => e.id === d.id); if (!ev) return;
        openSheet({ kind: 'edit', id: ev.id, a: ev.a, p: ev.p, q: ev.q });
        break;
      }
      case 'edit-a': ui.sheet.a = d.a; renderSheet(); break;
      case 'edit-p': ui.sheet.p = d.pid; renderSheet(); break;
      case 'edit-q': ui.sheet.q = +d.q; renderSheet(); break;
      case 'edit-save': {
        const sh = ui.sheet; const ev = state.events.find((e) => e.id === sh.id);
        if (ev) { ev.a = sh.a; ev.p = sh.p; ev.q = sh.q; }
        ui.sheet = null; save(); render(); toast('Poprawiono: ' + evDesc(ev));
        break;
      }
      case 'edit-del': {
        const sh = ui.sheet; const i = state.events.findIndex((e) => e.id === sh.id);
        ui.sheet = null;
        if (i >= 0) { const [e] = state.events.splice(i, 1); if (ui.lastId === e.id) ui.lastId = null; save(); render(); toast('Usunięto: ' + evDesc(e)); }
        else render();
        break;
      }
      case 'q': {
        const q = +d.q;
        ui.sheet = null;
        if (q !== state.quarter) { state.quarter = q; clearFollow(); save(); toast(qLabel(q)); }
        render();
        break;
      }
      case 'qsheet': {
        clearFollow(); ui.selP = ui.selA = null;
        openSheet({ kind: 'quarter' });
        break;
      }
      case 'undo': undo(); break;
      case 'clear-sel': ui.selP = ui.selA = null; render(); break;
      case 'follow-skip': clearFollow(); render(); break;
      case 'subs': {
        const t = teamById(d.team);
        clearFollow(); ui.selP = ui.selA = null;
        openSheet({ kind: 'subs', team: t.id, sel: t.onCourt.slice() });
        break;
      }
      case 'sub-toggle': {
        const sh = ui.sheet;
        if (sh.sel.includes(d.pid)) sh.sel = sh.sel.filter((id) => id !== d.pid); else sh.sel.push(d.pid);
        vibrate(8); renderSheet(); break;
      }
      case 'sub-done': {
        const sh = ui.sheet; const t = teamById(sh.team);
        t.onCourt = sh.sel.slice(); ui.sheet = null; save(); render(); toast('Zmiany zapisane'); break;
      }
      case 'sheet-close': closeSheet(); break;
      case 'menu': openSheet({ kind: 'menu' }); break;
      case 'finish':
        ui.sheet = null; state.finished = true; go('box');
        if (cloudReady()) saveToCloud();
        break;
      case 'cloud-save': saveToCloud(); break;
      case 'toggle-theme': {
        theme = theme === 'light' ? 'dark' : 'light';
        try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* brak */ }
        applyTheme();
        if (app.classList.contains('scr-home')) showHome(); else renderSheet();
        break;
      }
      case 'cloud-settings': openSheet({ kind: 'cloud' }); break;
      case 'cloud-test':
      case 'cloud-store': {
        const url = document.getElementById('cl-url').value.trim();
        const pin = document.getElementById('cl-pin').value.trim();
        const st = document.getElementById('cl-status');
        if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) { st.textContent = 'Adres powinien zaczynać się od https://script.google.com/ i kończyć na /exec.'; st.className = 'cl-status bad small'; return; }
        if (!pin) { st.textContent = 'Wpisz PIN.'; st.className = 'cl-status bad small'; return; }
        if (d.act === 'cloud-store') {
          lsSet(CLOUD_KEY, { url, pin });
          closeSheet(); toast('Arkusz Google połączony ✓');
          if (app.className === 'scr-home') showHome(); else render();
          flushQueue(true);
          return;
        }
        st.textContent = 'Sprawdzam…'; st.className = 'cl-status muted small';
        postCloud(url, { pin, test: true })
          .then((r) => { st.textContent = r.ok ? '✓ Połączenie działa, PIN poprawny.' : '✕ ' + (r.error || 'Błąd'); st.className = 'cl-status small ' + (r.ok ? 'ok' : 'bad'); })
          .catch(() => { st.textContent = '✕ Brak połączenia. Sprawdź internet i adres.'; st.className = 'cl-status bad small'; });
        return;
      }
      case 'cloud-clear': {
        if (!confirm('Odłączyć Arkusz Google na tym telefonie? Dane w arkuszu zostaną.')) return;
        try { localStorage.removeItem(CLOUD_KEY); } catch (e) { /* brak */ }
        closeSheet(); toast('Odłączono');
        if (app.className === 'scr-home') showHome(); else render();
        return;
      }
      case 'toggle-vibe': {
        try { localStorage.setItem(VIBE_KEY, vibeOn() ? 'off' : 'on'); } catch (e) { /* brak */ }
        vibrate(20); renderSheet(); break;
      }
      case 'toggle-hints': state.hints = !state.hints; clearFollow(); save(); renderSheet(); break;
      case 'same-rosters': {
        if (!confirm('Nowy mecz z tymi samymi drużynami i składami? Statystyki obecnego meczu zostaną usunięte.')) return;
        ui.sheet = null;
        state.events = []; state.quarter = 1; state.finished = false; state.created = Date.now(); state.id = uid(); ui.lastId = null;
        state.teams.forEach((t) => { t.onCourt = []; });
        go('teams'); break;
      }
      case 'reset': {
        if (!confirm('Usunąć cały mecz i zacząć od zera?')) return;
        ui.sheet = null; state = newMatch(); ui.lastId = null; go('teams'); break;
      }
      case 'del-event': {
        const i = state.events.findIndex((e) => e.id === d.id);
        if (i >= 0) { const [e] = state.events.splice(i, 1); if (ui.lastId === e.id) ui.lastId = null; save(); render(); toast('Usunięto: ' + evDesc(e)); }
        break;
      }
      case 'pdf': exportPdf(false); break;
      case 'share': exportPdf(true); break;
      default: break;
    }
  }

  // ---------- przytrzymanie kafelka = szybka zmiana ----------
  let lp = null, suppressUntil = 0, lpFired = false;
  const cancelLp = () => { if (lp) { clearTimeout(lp.timer); lp = null; } };
  document.addEventListener('pointerdown', (e) => {
    const tile = e.target.closest('.tile[data-act=player]');
    if (!tile || ui.sheet) return;
    cancelLp();
    lp = {
      x: e.clientX, y: e.clientY,
      timer: setTimeout(() => {
        lp = null; lpFired = true;
        vibrate(30);
        openQuickSub(tile.dataset.team, tile.dataset.pid, 'manual');
      }, LONG_PRESS_MS),
    };
  });
  document.addEventListener('pointermove', (e) => {
    if (lp && (Math.abs(e.clientX - lp.x) > 12 || Math.abs(e.clientY - lp.y) > 12)) cancelLp();
  });
  const endPress = () => {
    cancelLp();
    // po przytrzymaniu ignorujemy „kliknięcie”, które przeglądarka wysyła przy puszczeniu palca
    if (lpFired) { lpFired = false; suppressUntil = Date.now() + 600; }
  };
  document.addEventListener('pointerup', endPress);
  document.addEventListener('pointercancel', endPress);
  document.addEventListener('contextmenu', (e) => { if (e.target.closest('.tile')) e.preventDefault(); });

  document.addEventListener('click', (e) => {
    // tuż po przytrzymaniu ignorujemy „kliknięcie-widmo” poza oknem (np. w tło, które zamknęłoby okno)
    if (Date.now() < suppressUntil) {
      if (!e.target.closest('.sheet')) { e.preventDefault(); e.stopPropagation(); return; }
      suppressUntil = 0; // świadome dotknięcie w oknie — dalej wszystko działa normalnie
    }
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    if (el.tagName === 'LABEL') return;
    e.preventDefault();
    handle(el);
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    const kind = el.dataset && el.dataset.input;
    if (!kind) return;
    const t = teamById(el.dataset.team);
    if (kind === 'tname') { t.name = el.value; save(); }
    if (kind === 'tcolor') { t.color = el.value; save(); }
    if (kind === 'ttrack') { t.tracked = el.checked; save(); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.dataset) return;
    if (el.dataset.input === 'ttrack') { teamById(el.dataset.team).tracked = el.checked; save(); }
    if (el.dataset.input === 'tcolor') { teamById(el.dataset.team).color = el.value; save(); render(); }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target;
    e.preventDefault();
    if (form.dataset.form === 'add-player') {
      const t = teamById(form.dataset.team);
      const num = document.getElementById('in-num'), last = document.getElementById('in-last'), first = document.getElementById('in-first');
      const err = addPlayer(t, num.value, last.value, first.value);
      if (err) { toast(err, 'bad'); (num.value.trim() ? last : num).focus(); return; }
      save(); vibrate(); ui.focusNum = true; render();
    } else if (form.dataset.form === 'sub-add') {
      const sh = ui.sheet; const t = teamById(sh.team);
      const num = document.getElementById('sa-num'), last = document.getElementById('sa-last');
      const err = addPlayer(t, num.value, last.value, '');
      if (err) { toast(err, 'bad'); return; }
      save(); renderSheet(); toast('Dodano zawodnika na ławkę');
    }
  });

  // Enter w polu numeru przechodzi do nazwiska
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'in-num') { e.preventDefault(); document.getElementById('in-last').focus(); }
  });

  // ---------- przycisk „wstecz” w telefonie ----------
  try {
    history.replaceState({ s: 0 }, '');
    history.pushState({ s: 1 }, '');
  } catch (e) { /* brak */ }
  window.addEventListener('popstate', () => {
    try { history.pushState({ s: 1 }, ''); } catch (e) { /* brak */ }
    if (ui.sheet) { closeSheet(); return; }
    const s = state ? state.screen : 'home';
    const back = { log: 'live', box: 'live', lineup: 'players', players: 'teams', teams: 'home' }[s];
    if (app.className === 'scr-home') return;
    if (back === 'home') showHome();
    else if (back) go(back);
    else if (s === 'live') toast('Mecz jest zapisany na telefonie. Wyjście: Menu.');
  });

  // ---------- ekran nie gaśnie w trakcie meczu ----------
  let wakeLock = null;
  async function keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { /* brak wsparcia */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state && state.screen === 'live') keepAwake(true);
  });

  // ---------- start: zawsze ekran startowy (z „Wróć do meczu”, jeśli jest mecz w pamięci) ----------
  showHome();
  setTimeout(() => flushQueue(false), 1500);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then((reg) => { reg.update().catch(() => {}); })
      .catch(() => {});
    // Gdy pobierze się nowa wersja aplikacji: na ekranie startowym odśwież od razu,
    // w trakcie meczu nie przeszkadzaj (nowa wersja włączy się przy następnym otwarciu).
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !app.classList.contains('scr-home')) return;
      reloading = true;
      location.reload();
    });
  }
})();
