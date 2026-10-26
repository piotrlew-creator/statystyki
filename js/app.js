/* Statystyki meczu koszykówki — v1
 * Aplikacja działa w całości w przeglądarce telefonu.
 * Stan meczu jest trzymany tylko lokalnie na tym urządzeniu (ochrona przed
 * przypadkowym odświeżeniem strony). Nic nie jest wysyłane na żaden serwer.
 */
'use strict';
(() => {
  const STORE_KEY = 'statystyki:v1';
  const HINT_MS = 5000; // jak długo czeka podpowiedź asysty/zbiórki

  const PALETTE = [
    '#ffffff', '#1a1a1a', '#d0202e', '#7a1f2b', '#ee7a1a', '#f2c230',
    '#1e8c45', '#4fb3e8', '#1f5fbf', '#1b2a55', '#6a3bb5', '#8a8f98',
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
  };
  const OTHER_ACTIONS = [
    ['oreb', 'ZB atak', 'reb'], ['dreb', 'ZB obrona', 'reb'], ['ast', 'Asysta', 'pos'], ['stl', 'Przechwyt', 'pos'],
    ['tov', 'Strata', 'neg'], ['blk', 'Blok', 'pos'], ['pf', 'Faul', 'neg'], ['fd', 'Faul wym.', 'neu'],
  ];

  const app = document.getElementById('app');
  const sheetRoot = document.getElementById('sheet-root');
  const toastEl = document.getElementById('toast');

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
  const sortPlayers = (arr) => arr.slice().sort((a, b) => (parseInt(a.num, 10) - parseInt(b.num, 10)) || String(a.num).localeCompare(String(b.num)));
  const qLabel = (q) => (q <= 4 ? `${q}. kw.` : `Dogr. ${q - 4}`);
  const qShort = (q) => (q <= 4 ? String(q) : `D${q - 4}`);
  const vibrate = (ms = 12) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* brak */ } };

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
      v: 1, screen: 'teams', created: Date.now(), finished: false, quarter: 1, hints: true, setupTab: 'A',
      teams: [
        { id: 'A', name: '', color: '#d0202e', tracked: true, players: [], onCourt: [] },
        { id: 'B', name: '', color: '#ffffff', tracked: false, players: [], onCourt: [] },
      ],
      events: [],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.v === 1 && Array.isArray(s.teams)) return s;
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

  let toastTimer = null;
  function toast(msg, kind = '') {
    toastEl.textContent = msg;
    toastEl.className = 'show ' + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.className = ''; }, 2200);
  }

  // ---------- statystyki ----------
  const emptyStats = () => ({ p1m: 0, p1x: 0, p2m: 0, p2x: 0, p3m: 0, p3x: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, tov: 0, blk: 0, pf: 0, fd: 0 });

  function derive(s) {
    const pts = s.p1m + 2 * s.p2m + 3 * s.p3m;
    const missed = s.p1x + s.p2x + s.p3x;
    const reb = s.oreb + s.dreb;
    // EVAL = punkty − wszystkie niecelne rzuty + asysty + przechwyty + zbiórki (A+O) + bloki − straty
    const ev = pts - missed + s.ast + s.stl + s.oreb + s.dreb + s.blk - s.tov;
    return { ...s, pts, missed, reb, eval: ev, p1a: s.p1m + s.p1x, p2a: s.p2m + s.p2x, p3a: s.p3m + s.p3x };
  }

  function computeAll() {
    const players = new Map();
    const teamTot = { A: emptyStats(), B: emptyStats() };
    const qPts = { A: {}, B: {} };
    const qFouls = { A: {}, B: {} };
    const extra = { A: 0, B: 0 }; // punkty drużyny bez zawodnika (nieśledzona drużyna)
    for (const e of state.events) {
      const pts = { p1m: 1, p2m: 2, p3m: 3, opp1: 1, opp2: 2, opp3: 3 }[e.a] || 0;
      if (pts) qPts[e.t][e.q] = (qPts[e.t][e.q] || 0) + pts;
      if (e.a.startsWith('opp')) { extra[e.t] += pts; continue; }
      const key = e.t + ':' + e.p;
      if (!players.has(key)) players.set(key, emptyStats());
      players.get(key)[e.a]++;
      teamTot[e.t][e.a]++;
      if (e.a === 'pf') {
        const fq = Math.min(e.q, 4); // faule w dogrywce liczą się do 4. kwarty (FIBA)
        qFouls[e.t][fq] = (qFouls[e.t][fq] || 0) + 1;
      }
    }
    const score = {};
    for (const id of ['A', 'B']) score[id] = Object.values(qPts[id]).reduce((a, b) => a + b, 0);
    return {
      player: (t, pid) => derive(players.get(t + ':' + pid) || emptyStats()),
      team: (t) => derive(teamTot[t]),
      score, qPts, qFouls, extra,
      maxQ: Math.max(4, state.quarter, ...state.events.map((e) => e.q)),
    };
  }

  // ---------- nawigacja ----------
  function go(screen) {
    state.screen = screen;
    toastEl.className = '';
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
    app.className = 'scr-' + s;
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
        <p class="muted small center">Dane meczu zostają wyłącznie na tym telefonie.</p>
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
        <input class="field" data-input="tname" data-team="${t.id}" value="${esc(t.name)}" placeholder="Nazwa drużyny" maxlength="40" autocomplete="off">
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
        ${tr.map((x) => `<button class="tab ${x.id === t.id ? 'on' : ''}" style="${teamVars(x)}" data-act="tab" data-team="${x.id}"><span class="dot"></span>${esc(teamName(x))} <span class="cnt">${x.players.length}</span></button>`).join('')}
      </div>` : '';
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

  function addPlayer(t, num, last, first) {
    num = String(num || '').trim().replace(/^#/, '');
    last = String(last || '').trim();
    first = String(first || '').trim();
    if (!num || !/^\d{1,3}$/.test(num)) return 'Podaj numer (cyfry).';
    if (!last) return 'Podaj nazwisko.';
    if (t.players.some((p) => p.num === num)) return `Numer ${num} już jest w składzie.`;
    t.players.push({ id: uid(), num, last, first });
    return null;
  }

  // ---------- krok 3: pierwsza piątka ----------
  function renderLineup() {
    const blocks = tracked().map((t) => {
      const need = Math.min(5, t.players.length);
      if (t.players.length <= 5 && t.onCourt.length !== t.players.length) t.onCourt = t.players.map((p) => p.id);
      return `
        <section class="card lineup" style="${teamVars(t)}">
          <div class="list-head"><span><span class="dot"></span>${esc(teamName(t))}</span><span class="count ${t.onCourt.length === need ? 'ok' : ''}">${t.onCourt.length}/${need}</span></div>
          <div class="chip-grid">
            ${sortPlayers(t.players).map((p) => `
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
      const sub = t.tracked
        ? `<div class="sc-sub ${fouls >= 5 ? 'bad' : fouls >= 4 ? 'warn' : ''}">Faule zesp.: ${fouls}</div>`
        : `<div class="opp-btns">${[1, 2, 3].map((v) => `<button data-act="opp" data-team="${t.id}" data-v="${v}">+${v}</button>`).join('')}</div>`;
      return `
        <div class="sc-team ${right ? 'right' : ''}" style="${teamVars(t)}">
          <div class="sc-name"><span class="dot"></span><span class="nm">${esc(teamName(t))}</span></div>
          <div class="sc-pts">${S.score[t.id]}</div>
          ${sub}
        </div>`;
    };
    const f = ui.follow;
    const teamBlocks = tracked().map((t) => {
      const court = sortPlayers(t.onCourt.map((id) => playerById(t, id)).filter(Boolean));
      const tiles = court.map((p) => {
        const st = S.player(t.id, p.id);
        const key = t.id + ':' + p.id;
        const sel = ui.selP && ui.selP.team === t.id && ui.selP.pid === p.id;
        const elig = f && f.elig.has(key);
        const fcls = st.pf >= 5 ? 'f5' : st.pf >= 4 ? 'f4' : '';
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
          <div class="tb-head">
            <span class="tb-name"><span class="dot"></span>${esc(teamName(t))}</span>
            <button class="subs-btn" data-act="subs" data-team="${t.id}">⇄ Zmiany</button>
          </div>
          <div class="tiles">${tiles.join('')}</div>
        </section>`;
    }).join('');

    const shotCol = (n) => `
      <div class="shot-col">
        <div class="shot-h">${n} PKT</div>
        <button class="a made ${ui.selA === 'p' + n + 'm' ? 'on' : ''}" data-act="action" data-a="p${n}m"><b>+${n}</b><small>celny</small></button>
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
      <div class="teams-area">${teamBlocks}</div>
      ${renderCtx()}
      <div class="pad">
        <div class="shots">${shotCol(1)}${shotCol(2)}${shotCol(3)}</div>
        <div class="others">${others}</div>
      </div>
      <nav class="bnav">
        <button data-act="undo" ${state.events.length ? '' : 'disabled'}><span>↶</span>Cofnij</button>
        <button data-act="go" data-to="log"><span>☰</span>Akcje</button>
        <button data-act="go" data-to="box"><span>▦</span>Tabela</button>
        <button data-act="menu"><span>⋯</span>Menu</button>
      </nav>`;
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
      const q = { ast: 'Asysta?', reb: 'Zbiórka?', tov: 'Kto stracił piłkę?', fd: 'Kto wymusił faul?', pf: 'Kto faulował?' }[f.type];
      const sub = f.type === 'reb' ? 'dotknij zbierającego' : 'dotknij zawodnika';
      const left = Math.max(0, f.expires - Date.now());
      return `<div class="ctx follow"><span><b>${q}</b> <span class="muted">${sub}</span></span>
        <button class="ctx-btn" data-act="follow-skip">Pomiń</button>
        <i class="timer" style="animation-duration:${HINT_MS}ms;animation-delay:-${HINT_MS - left}ms"></i></div>`;
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
    const last = ui.lastId && state.events.find((e) => e.id === ui.lastId);
    if (last) {
      return `<div class="ctx done"><span class="ok">✓</span><span class="ctx-txt">${esc(evDesc(last))}</span>
        <button class="ctx-btn" data-act="undo">Cofnij</button></div>`;
    }
    return `<div class="ctx hint muted">Dotknij zawodnika, potem akcję — albo odwrotnie.</div>`;
  }

  // ---------- zapis zdarzeń ----------
  function record(a, team, pid, chained = false) {
    const ev = { id: uid(), t: team, p: pid, a, q: state.quarter, ts: Date.now() };
    state.events.push(ev);
    ui.lastId = ev.id;
    save();
    vibrate();
    clearFollow();
    if (!chained) setFollow(ev);
    render();
  }

  function setFollow(ev) {
    if (!state.hints || !ev.p) return;
    const t = teamById(ev.t), o = otherTeam(ev.t);
    const keys = (team, exclude) => team.onCourt.filter((id) => id !== exclude).map((id) => team.id + ':' + id);
    let type = null, elig = [];
    if (ev.a === 'p2m' || ev.a === 'p3m') { type = 'ast'; elig = keys(t, ev.p); }
    else if (['p1x', 'p2x', 'p3x'].includes(ev.a)) { type = 'reb'; elig = keys(t).concat(o.tracked ? keys(o) : []); }
    else if (ev.a === 'stl' && o.tracked) { type = 'tov'; elig = keys(o); }
    else if (ev.a === 'pf' && o.tracked) { type = 'fd'; elig = keys(o); }
    else if (ev.a === 'fd' && o.tracked) { type = 'pf'; elig = keys(o); }
    if (!type || !elig.length) return;
    ui.follow = { type, elig: new Set(elig), src: ev.t, expires: Date.now() + HINT_MS };
    followTimer = setTimeout(() => { ui.follow = null; if (state.screen === 'live') render(); }, HINT_MS);
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
      record(a, team, pid, true);
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

  function undo() {
    const e = state.events.pop();
    if (!e) return;
    clearFollow();
    ui.lastId = null;
    save();
    vibrate(25);
    toast('Cofnięto: ' + evDesc(e));
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
      return `${head}<li class="log-row" style="${teamVars(t)}"><span class="dot"></span><span class="log-txt">${esc(evDesc(e))}</span>
        <button class="icon-btn del" data-act="del-event" data-id="${e.id}" aria-label="Usuń">✕</button></li>`;
    }).join('');
    return `
      <header class="topbar">
        <button class="icon-btn" data-act="go" data-to="live" aria-label="Wstecz">‹</button>
        <div class="tb-title">Akcje (${state.events.length})</div><div></div>
      </header>
      <div class="wrap"><ul class="log">${rows || '<li class="empty muted">Brak zapisanych akcji.</li>'}</ul></div>`;
  }

  // ---------- tabela ----------
  const COLS = [
    ['pts', 'PKT'], ['s1', '1 PKT'], ['s2', '2 PKT'], ['s3', '3 PKT'], ['oreb', 'ZA'], ['dreb', 'ZO'], ['reb', 'ZB'],
    ['ast', 'AS'], ['stl', 'PRZ'], ['tov', 'STR'], ['blk', 'BL'], ['pf', 'FP'], ['fd', 'FW'], ['eval', 'EVAL'],
  ];
  const cell = (s, k) => (k === 's1' ? `${s.p1m}/${s.p1a}` : k === 's2' ? `${s.p2m}/${s.p2a}` : k === 's3' ? `${s.p3m}/${s.p3a}` : s[k]);
  const pct = (m, a) => (a ? Math.round((100 * m) / a) + '%' : '–');
  const LEGEND = 'c/w – celne/wykonane · ZA – zbiórki w ataku · ZO – zbiórki w obronie · ZB – zbiórki razem · AS – asysty · PRZ – przechwyty · STR – straty · BL – bloki · FP – faule popełnione · FW – faule wymuszone · EVAL = punkty − niecelne rzuty + asysty + przechwyty + zbiórki + bloki − straty';

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
    const tables = tracked().map((t) => {
      const rows = sortPlayers(t.players).map((p) => {
        const s = S.player(t.id, p.id);
        return `<tr class="${t.onCourt.includes(p.id) ? '' : ''}"><td class="stk nr">${esc(p.num)}</td><td class="stk nm">${esc(p.last)}${p.first ? ' ' + esc(p.first.charAt(0)) + '.' : ''}</td>${COLS.map(([k]) => `<td class="${k === 'pts' || k === 'eval' ? 'em' : ''}">${cell(s, k)}</td>`).join('')}</tr>`;
      }).join('');
      const T = S.team(t.id);
      return `
        <section class="box-team" style="${teamVars(t)}">
          <h2><span class="dot"></span>${esc(teamName(t))}</h2>
          <div class="tscroll"><table class="stats">
            <thead><tr><th class="stk nr">Nr</th><th class="stk nm">Zawodnik</th>${COLS.map(([, h]) => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td class="stk nr"></td><td class="stk nm">Razem</td>${COLS.map(([k]) => `<td>${cell(T, k)}</td>`).join('')}</tr></tfoot>
          </table></div>
          <p class="muted small">Skuteczność: 1 pkt ${pct(T.p1m, T.p1a)} · 2 pkt ${pct(T.p2m, T.p2a)} · 3 pkt ${pct(T.p3m, T.p3a)}</p>
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
        <p class="legend muted small">${LEGEND}</p>
      </div>
      <div class="footbar two">
        <button class="btn primary" data-act="pdf">Pobierz PDF</button>
        ${canShare ? '<button class="btn" data-act="share">Udostępnij PDF</button>' : '<button class="btn" data-act="go" data-to="live">Wróć do meczu</button>'}
      </div>`;
  }

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

    for (const t of tracked()) {
      const T = S.team(t.id);
      const head = [{ text: 'Nr', style: 'th' }, { text: 'Zawodnik', style: 'th' }, ...COLS.map(([, h]) => ({ text: h, style: 'th', alignment: 'center' }))];
      const body = [head];
      for (const p of sortPlayers(t.players)) {
        const s = S.player(t.id, p.id);
        body.push([
          { text: p.num, alignment: 'center' },
          { text: [{ text: p.last, bold: true }, p.first ? ' ' + p.first : ''] },
          ...COLS.map(([k]) => ({ text: String(cell(s, k)), alignment: 'center', bold: k === 'pts' || k === 'eval' })),
        ]);
      }
      body.push([{ text: '' }, { text: 'Razem', bold: true }, ...COLS.map(([k]) => ({ text: String(cell(T, k)), alignment: 'center', bold: true }))]);
      content.push(
        {
          columns: [
            { width: 10, canvas: [{ type: 'rect', x: 0, y: 2, w: 10, h: 10, color: t.color, lineColor: '#888888', lineWidth: 0.5 }] },
            { text: teamName(t), style: 'h2' },
          ], columnGap: 6, margin: [0, 6, 0, 4],
        },
        {
          table: { headerRows: 1, widths: [22, '*', ...COLS.map(([k]) => (k.startsWith('s') ? 40 : 32))], body },
          layout: {
            ...thin,
            fillColor: (row) => (row === 0 ? '#eef1f4' : row === body.length - 1 ? '#f6f7f9' : null),
          },
        },
        { text: `Skuteczność: 1 pkt ${pct(T.p1m, T.p1a)}  ·  2 pkt ${pct(T.p2m, T.p2a)}  ·  3 pkt ${pct(T.p3m, T.p3a)}`, style: 'meta', margin: [0, 4, 0, 12] },
      );
    }
    content.push({ text: LEGEND, style: 'legend' });

    return {
      pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [28, 28, 28, 28],
      info: { title: `${teamName(ta)} – ${teamName(tb)}` },
      content,
      defaultStyle: { font: 'Roboto', fontSize: 9, color: '#1d232b' },
      styles: {
        teamName: { fontSize: 18, bold: true, margin: [0, 6, 0, 0] },
        score: { fontSize: 28, bold: true },
        meta: { fontSize: 9, color: '#5b6573' },
        h2: { fontSize: 12, bold: true },
        th: { bold: true, fontSize: 8.5, color: '#3a4350' },
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
  function openSheet(sheet) { ui.sheet = sheet; renderSheet(); }
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
          ${sortPlayers(t.players).map((p) => `
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
    } else if (sh.kind === 'quarter') {
      const nQ = Math.max(5, state.quarter + 1);
      inner = `
        <div class="sheet-h"><b>Kwarta</b></div>
        <div class="q-grid">
          ${Array.from({ length: nQ }, (_, i) => i + 1).map((q) => `<button class="qbig ${q === state.quarter ? 'on' : ''}" data-act="q" data-q="${q}">${qLabel(q)}</button>`).join('')}
        </div>
        <div class="sheet-actions"><button class="btn block" data-act="sheet-close">Zamknij</button></div>`;
    } else if (sh.kind === 'menu') {
      inner = `
        <div class="sheet-h"><b>Menu meczu</b></div>
        <div class="menu-list">
          <button class="menu-item" data-act="finish">🏁 Zakończ mecz i pokaż tabelę</button>
          <button class="menu-item" data-act="toggle-hints">💡 Podpowiedzi asyst i zbiórek: <b>${state.hints ? 'wł.' : 'wył.'}</b></button>
          <button class="menu-item" data-act="same-rosters">🔁 Nowy mecz — te same składy</button>
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
        if (state && (state.events.length || state.teams.some((t) => t.players.length)) && !confirm('Rozpocząć nowy mecz? Obecny mecz zostanie usunięty z telefonu.')) return;
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
        state.setupTab = tracked()[0].id; go('players'); break;
      }
      case 'tab': state.setupTab = d.team; save(); render(); break;
      case 'del-player': {
        const t = teamById(d.team);
        t.players = t.players.filter((p) => p.id !== d.pid);
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
        const empty = tracked().find((t) => !t.players.length);
        if (empty) { state.setupTab = empty.id; save(); render(); toast(`Dodaj zawodników: ${teamName(empty)}.`, 'bad'); return; }
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
        const bad = tracked().find((t) => t.onCourt.length !== Math.min(5, t.players.length));
        if (bad) { toast(`Wybierz pierwszą piątkę: ${teamName(bad)}.`, 'bad'); return; }
        go('live'); break;
      }
      case 'player': tapPlayer(d.team, d.pid); break;
      case 'action': tapAction(d.a); break;
      case 'opp': clearFollow(); ui.selP = ui.selA = null; record('opp' + d.v, d.team, null, true); break;
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
      case 'finish': ui.sheet = null; state.finished = true; go('box'); break;
      case 'toggle-hints': state.hints = !state.hints; clearFollow(); save(); renderSheet(); break;
      case 'same-rosters': {
        if (!confirm('Nowy mecz z tymi samymi drużynami i zawodnikami? Statystyki obecnego meczu zostaną usunięte.')) return;
        ui.sheet = null;
        state.events = []; state.quarter = 1; state.finished = false; state.created = Date.now(); ui.lastId = null;
        state.teams.forEach((t) => { t.onCourt = []; });
        go('lineup'); break;
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

  document.addEventListener('click', (e) => {
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

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
