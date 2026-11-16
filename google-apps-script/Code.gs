/**
 * Statystyki meczu — zapis do Arkusza Google
 * ------------------------------------------
 * Ten skrypt wklejasz w Arkuszu Google (Rozszerzenia → Apps Script).
 * Aplikacja na telefonie wysyła do niego statystyki meczu, a skrypt zapisuje je w arkuszach:
 *   • Mecze       — jeden wiersz na mecz
 *   • Statystyki  — jeden wiersz na zawodnika w meczu
 *   • Sezon       — sumy i średnie zawodników ŁKS U15 (liczą się same, formułą)
 *   • Przebieg    — pełna lista akcji meczu (do ewentualnego ponownego otwarcia w aplikacji)
 * Ponowne wysłanie tego samego meczu nadpisuje jego dane (bez duplikatów).
 */

// ▼▼▼ USTAW SWÓJ PIN (ten sam wpiszesz w aplikacji na telefonie). Litery i cyfry, bez spacji. ▼▼▼
const PIN = 'ZMIEN-MNIE';
// ▲▲▲

const LKS_NAME = 'ŁKS U15';

const SHEETS = {
  mecze: {
    name: 'Mecze',
    head: ['ID meczu', 'Data', 'Gospodarze', 'Goście', 'Pkt gosp.', 'Pkt gości', 'ŁKS jako', 'Wynik ŁKS', 'Kwarty', 'Status', 'Zapisano', 'ZA rywala', 'Faule rywala', 'Straty rywala', 'Niecelne rywala'],
  },
  stat: {
    name: 'Statystyki',
    head: ['ID meczu', 'Data', 'Rywal', 'Drużyna', 'Nr', 'Nazwisko', 'Imię', 'PKT',
      '1 pkt celne', '1 pkt wyk.', '2 pkt celne', '2 pkt wyk.', '3 pkt celne', '3 pkt wyk.',
      'ZA', 'ZO', 'ZB', 'AS', 'PRZ', 'STR', 'BL', 'FP', 'FW', 'EVAL', '+/−', 'P1×1', 'DO', 'DP', 'ZR', 'EVAL K'],
  },
  przebieg: {
    name: 'Przebieg',
    head: ['ID meczu', 'Data', 'Mecz', 'Dane (JSON)'],
  },
};

function doGet() {
  return out({ ok: true, info: 'Skrypt statystyk działa. Teraz wpisz ten adres w aplikacji na telefonie.' });
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return out({ ok: false, error: 'Nieprawidłowe dane' });
  }
  if (String(data.pin || '') !== PIN) return out({ ok: false, error: 'Nieprawidłowy PIN' });
  if (data.test) return out({ ok: true, info: 'Połączenie działa' });

  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    saveMatch(data.match);
    return out({ ok: true, id: data.match.id });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function saveMatch(m) {
  if (!m || !m.id) throw new Error('Brak identyfikatora meczu');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const date = new Date(m.created);

  // Mecze
  const shM = sheet(ss, SHEETS.mecze);
  removeRows(shM, m.id);
  shM.appendRow([
    m.id, date, m.home, m.away, m.scoreHome, m.scoreAway, m.lksSide || '', m.lksResult || '',
    m.quarters, m.finished ? 'zakończony' : 'w trakcie', new Date(),
    m.oppOreb === undefined ? '' : m.oppOreb, m.oppFouls === undefined ? '' : m.oppFouls,
    m.oppTov === undefined ? '' : m.oppTov, m.oppMiss === undefined ? '' : m.oppMiss,
  ]);

  // Statystyki
  const shS = sheet(ss, SHEETS.stat);
  removeRows(shS, m.id);
  const rows = (m.rows || []).map((r) => [
    m.id, date, r.opponent, r.team, r.num, r.last, r.first || '', r.pts,
    r.p1m, r.p1a, r.p2m, r.p2a, r.p3m, r.p3a,
    r.oreb, r.dreb, r.reb, r.ast, r.stl, r.tov, r.blk, r.pf, r.fd, r.eval, r.pm === undefined ? '' : r.pm,
    r.l1v1 === undefined ? '' : r.l1v1, r.gdef === undefined ? '' : r.gdef, r.ghelp === undefined ? '' : r.ghelp,
    r.brot === undefined ? '' : r.brot, r.evalf === undefined ? '' : r.evalf,
  ]);
  if (rows.length) shS.getRange(shS.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

  // Przebieg (dzielony na kawałki — komórka mieści maks. 50 000 znaków)
  const shP = sheet(ss, SHEETS.przebieg);
  removeRows(shP, m.id);
  const json = JSON.stringify(m.replay || {});
  const parts = [];
  for (let i = 0; i < json.length; i += 45000) parts.push(json.slice(i, i + 45000));
  shP.appendRow([m.id, date, m.home + ' – ' + m.away].concat(parts));

  // Formaty dat
  [shM, shS, shP].forEach((sh) => sh.getRange('B2:B').setNumberFormat('yyyy-mm-dd hh:mm'));
  shM.getRange('K2:K').setNumberFormat('yyyy-mm-dd hh:mm');

  ensureSeason(ss);
}

function sheet(ss, def) {
  let sh = ss.getSheetByName(def.name);
  if (!sh) {
    sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.head.length).setValues([def.head]).setFontWeight('bold').setBackground('#eef1f4');
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < def.head.length) {
    // nowa wersja skryptu dodała kolumny — uzupełnij nagłówek
    sh.getRange(1, 1, 1, def.head.length).setValues([def.head]).setFontWeight('bold').setBackground('#eef1f4');
  }
  // usuń pusty domyślny „Arkusz1”, jeśli nic w nim nie ma
  const def1 = ss.getSheetByName('Arkusz1') || ss.getSheetByName('Sheet1');
  if (def1 && ss.getSheets().length > 1 && def1.getLastRow() === 0) ss.deleteSheet(def1);
  return sh;
}

function removeRows(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === String(id)) sh.deleteRow(i + 2);
  }
}

function ensureSeason(ss) {
  if (ss.getSheetByName('Sezon')) return;
  const sh = ss.insertSheet('Sezon');
  sh.getRange('A1').setValue('Sezon — ' + LKS_NAME + ' (liczy się automatycznie z arkusza „Statystyki”)').setFontWeight('bold');
  // Kolumny w „Statystyki”: D drużyna, E nr, F nazwisko, G imię, H PKT, I–N rzuty, Q ZB, R AS, S PRZ, T STR, U BL, X EVAL
  const q = "select E, F, G, count(A), sum(H), avg(H), sum(I), sum(J), sum(K), sum(L), sum(M), sum(N), " +
    "sum(Q), avg(Q), sum(R), avg(R), sum(S), sum(T), sum(U), sum(X), avg(X) " +
    "where D = '" + LKS_NAME + "' group by E, F, G order by sum(H) desc " +
    "label E 'Nr', F 'Nazwisko', G 'Imię', count(A) 'Mecze', sum(H) 'PKT', avg(H) 'PKT/mecz', " +
    "sum(I) '1 c', sum(J) '1 w', sum(K) '2 c', sum(L) '2 w', sum(M) '3 c', sum(N) '3 w', " +
    "sum(Q) 'ZB', avg(Q) 'ZB/mecz', sum(R) 'AS', avg(R) 'AS/mecz', sum(S) 'PRZ', sum(T) 'STR', sum(U) 'BL', " +
    "sum(X) 'EVAL', avg(X) 'EVAL/mecz'";
  sh.getRange('A3').setFormula('=QUERY(Statystyki!A:X, "' + q + '", 1)');
  sh.getRange('A3:U3').setFontWeight('bold').setBackground('#eef1f4');
  sh.setFrozenRows(3);
  ['F', 'N', 'P', 'U'].forEach((c) => sh.getRange(c + '4:' + c).setNumberFormat('0.0'));
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
