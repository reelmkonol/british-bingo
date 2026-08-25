/* ==================================================================
   England Bingo — front end
   Local cache first, server second. Marking a square updates the
   screen and localStorage immediately, then syncs; if the sync fails
   it retries until it lands. Reloading, closing the tab, losing
   signal in a Cornish lane — none of it loses a tick.
   ================================================================== */

const CELLS = 25;
const FREE_INDEX = 12;
const POLL_MS = 7000;

const LINES = (() => {
  const lines = [];
  for (let r = 0; r < 5; r++) lines.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
  for (let c = 0; c < 5; c++) lines.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
  lines.push([0, 6, 12, 18, 24]);
  lines.push([4, 8, 12, 16, 20]);
  return lines;
})();

const DEFAULT_POOL = [
  // --- Tier 1: near-certain. These keep the game moving. ---
  "Someone says 'cheers' instead of 'thanks'",
  "Someone apologises when you were the one in the way",
  "'See it. Say it. Sorted.' over a station PA",
  "A rail replacement bus, or a sign warning of one",
  "An apology for a delay of oddly precise length",
  "A pigeon inside a railway station",
  "A charity shop on the high street",
  "A bank branch that is now a cafe or a barber",
  "A pub named after a non-mammalian animal",
  "A crooked hanging pub sign",
  "A dog inside a pub",
  "A doorway many people have to duck under",
  "A pint drunk outside in unsuitable weather",
  "A Sunday roast on a menu",
  "A Greggs",
  "A Pret a Manger",
  "Scaffolding on something several centuries old",
  "A red post box used for non-mail purposes",
  "A church with a square tower",
  "A brown tourist-attraction road sign",
  "A public footpath sign or a stile",
  "Roadworks with temporary traffic lights",
  "A pothole with a spray-painted ring round it",
  "Someone mentions the weather within a minute of meeting",
  "Someone says 'Bob's your uncle'",
  "Someone says 'knackered'",
  "Someone says 'you alright?' as a greeting",
  "Someone says 'chuffed'", 
  "A queue that formed with no visible instruction",

  // --- London ---
  "A ULEZ or number-plate camera",
  "Hire bikes abandoned in a heap on the pavement",
  "A delivery rider on an e-bike going the wrong way",
  "A Palestinian flag in a window",
  "A protest or picket",
  "A blue plaque for someone you have never heard of",
  "A busker mid-song underground",
  "A cycle lane that ends without explanation",
  "A crane over a 'luxury apartments' hoarding",
  "A render of impossibly happy people on a building site",
  "A food bank collection point in a supermarket",
  "Someone stands on the left and is silently judged",

  // --- Oxford ---
  "An Oxford congestion-charge camera",
  "The Botley Road roadworks, still shut down",
  "An LTN planter with something written on it",
  "A bike chained up that is never coming back",
  "A tour group being told a Harry Potter fact",
  "A college gate with a sign turning visitors away",
  "A porter's lodge with a pigeonhole wall",
  "Punting, done badly",
  "Someone mentions the Bodleian's oath about naked flames",
  "A plaque naming a controversial donor",

  // --- Cotswolds ---
  "A drystone wall",
  "A thatched roof",
  "Sheep on the road",
  "A single-track road with passing places",
  "A red kite overhead",
  "A 'road liable to flooding' sign",
  "A village shop run by volunteers",
  "A key safe on a cottage wall",
  "A Range Rover that has never seen mud",
  "A Clarkson's Farm reference, sign or tour bus",
  "Solar panels on a barn roof",
  "A National Trust car park that is full",
  "A war memorial with the same surname more than once",
  "A hand-painted banner objecting to a local development",
  "A withdrawn bus route, still on the timetable",

  // --- Stratford and the theatre ---
  "A swan on the Avon",
  "Someone loudly explaining the plot during the interval",
  "Ice cream sold in the interval",
  "A standing ovation",
  "A non-actor dressed up as a GoT character",
  "A Shakespeare line used as a shop or pub name",
  "A reference to Hamnet, the film",
   
  // --- Water, councils and the state of things ---
  "A sewage warning or 'do not swim' notice by water",
  "Someone complains about their water bill",
  "A library with reduced hours or run by volunteers",
  "A closed public toilet",
  "A 'warm space' or community fridge sign",
  "A local paper front page about a hospital or bins",
  "A Green Party poster in a window",
  "A Reform UK poster or council branding",
  "A lone EU flag or a 'Rejoin' sticker",
  "A trade union banner",
  "Someone begins a sentence 'I'm not political, but'",
  "Someone assumes you have views on Trump, correctly",

  // --- Tier 3: rare. Worth chasing, will not win you the game. ---
  "A Morris team, mid-dance",
  "A cricket match on a village green",
  "Someone in full academic dress",
  "A community-owned pub",
  "A thatcher or a waller actually at work",
  "A 'right to roam' sign",
  "A pub quiz in progress",
  "A cow or horse holding up traffic",
   "A brass band",
  "A rainbow over a field",
  "A statue wearing a traffic cone",
  "A ghost sign fading on brickwork",
  "Comic Sans",
   "A shoe on a telephone wire",
   "A cat asleep in a shop window",
   "Someone running for a bus and missing it",
   "Wonderwall",
   "Pikachu",
   "A reference to Meghan Markle",
   "Someone expressing regret about Brexit",
   "Someone eats haggis",
];

/* ---------------------------- elements ---------------------------- */

const $ = (sel, root = document) => root.querySelector(sel);

const el = {
  screens: {
    home: $("#screen-home"),
    create: $("#screen-create"),
    game: $("#screen-game"),
  },
  homeResume: $("#home-resume"),
  resumeBtn: $("#resume-btn"),
  forgetBtn: $("#forget-btn"),
  joinForm: $("#join-form"),
  joinCode: $("#join-code"),
  joinError: $("#join-error"),
  goCreate: $("#go-create"),
  createBack: $("#create-back"),
  createForm: $("#create-form"),
  createTitle: $("#create-title"),
  createFree: $("#create-free"),
  createPool: $("#create-pool"),
  poolCount: $("#pool-count"),
  createError: $("#create-error"),
  bar: $("#bar"),
  barShout: $("#bar-shout"),
  gameTitle: $("#game-title"),
  gameCode: $("#game-code"),
  copyLink: $("#copy-link"),
  copyLabel: $("#copy-label"),
  goHome: $("#go-home"),
  menuBtn: $("#menu-btn"),
  menuSheet: $("#menu-sheet"),
  roster: $("#roster"),
  viewing: $("#viewing"),
  boardFrame: $("#board-frame"),
  board: $("#board"),
  strikes: $("#strikes"),
  checklist: $("#checklist"),
  viewGrid: $("#view-grid"),
  viewList: $("#view-list"),
  sync: $("#sync"),
  gate: $("#gate"),
  gateTitle: $("#gate-title"),
  gateExisting: $("#gate-existing"),
  gateForm: $("#gate-form"),
  gateName: $("#gate-name"),
  gateNameLabel: $("#gate-name-label"),
  gateError: $("#gate-error"),
  toast: $("#toast"),
};

/* ----------------------------- storage ---------------------------- */

const store = {
  read(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* private mode / quota — the server still has it */ }
  },
  drop(key) {
    try { localStorage.removeItem(key); } catch { /* no-op */ }
  },
};

const sessionKey = "eb:session";
const cacheKey = (code) => `eb:cache:${code}`;
const pendingKey = (code, id) => `eb:pending:${code}:${id}`;

/* ------------------------------- api ------------------------------ */

async function api(action, { body, query } = {}) {
  const qs = query ? `?${new URLSearchParams(query)}` : "";
  const res = await fetch(`/api/${action}${qs}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("The server sent something unreadable. Try again.");
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

/* ------------------------------ state ----------------------------- */

const S = {
  code: null,
  playerId: null,
  config: null,
  players: [],
  viewing: null,
  layout: "grid",
  boardSig: null,
  strikeSig: "",
  needFit: true,
  pushing: false,
  pollId: null,
};

const me = () => S.players.find((p) => p.id === S.playerId) || null;
const viewed = () => S.players.find((p) => p.id === S.viewing) || null;

function cellText(player, i) {
  if (i === FREE_INDEX) return S.config?.freeSpace || "Free square";
  return player.board?.[i] ?? "";
}

function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function completedLines(marks) {
  return LINES.filter((line) => line.every((i) => marks[i]));
}

const countMarks = (marks) => marks.reduce((n, m) => n + (m ? 1 : 0), 0);

/* ---------------------------- screens ----------------------------- */

function show(name) {
  for (const [key, node] of Object.entries(el.screens)) node.hidden = key !== name;
  window.scrollTo(0, 0);
}

let toastTimer;
function toast(message) {
  el.toast.textContent = message;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2400);
}

/* ------------------------- text prompt sheet ----------------------- */

function askText({ title, label, value = "", cta = "Save" }) {
  return new Promise((resolve) => {
    const sheet = document.createElement("div");
    sheet.className = "sheet sheet--gate";
    sheet.innerHTML = `
      <div class="sheet__panel">
        <h3 class="sheet__title"></h3>
        <label class="field">
          <span class="field__label"></span>
          <input class="input" maxlength="160">
        </label>
        <div class="stack stack--tight">
          <button class="btn btn--primary" data-act="ok" type="button"></button>
          <button class="btn btn--ghost" data-act="cancel" type="button">Cancel</button>
        </div>
      </div>`;
    $(".sheet__title", sheet).textContent = title;
    $(".field__label", sheet).textContent = label;
    $("[data-act='ok']", sheet).textContent = cta;
    const input = $("input", sheet);
    input.value = value;

    const finish = (result) => { sheet.remove(); resolve(result); };
    sheet.addEventListener("click", (e) => {
      if (e.target === sheet || e.target.dataset.act === "cancel") finish(null);
      if (e.target.dataset.act === "ok") finish(input.value.trim());
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") finish(input.value.trim());
      if (e.key === "Escape") finish(null);
    });

    document.body.append(sheet);
    input.focus();
    input.select();
  });
}

/* ----------------------------- rendering -------------------------- */

function render() {
  if (!S.config) return;
  el.gameTitle.textContent = S.config.title;
  el.gameCode.textContent = S.config.code;
  renderRoster();
  renderViewing();
  renderBoard();
}

function renderRoster() {
  el.roster.innerHTML = "";
  for (const p of S.players) {
    const done = countMarks(p.marks);
    const hasBingo = completedLines(p.marks).length > 0;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.style.setProperty("--chip", p.color);
    chip.classList.toggle("is-active", p.id === S.viewing);
    chip.classList.toggle("is-bingo", hasBingo);
    chip.dataset.player = p.id;
    chip.innerHTML = `
      <span class="chip__roundel"></span>
      <span class="chip__name"></span>
      <span class="chip__count"></span>`;
    $(".chip__roundel", chip).textContent = initials(p.name);
    $(".chip__name", chip).textContent = p.id === S.playerId ? `${p.name} (you)` : p.name;
    $(".chip__count", chip).textContent = hasBingo ? "BINGO" : `${done}/25`;
    el.roster.append(chip);
  }
}

function renderViewing() {
  const p = viewed();
  el.viewing.innerHTML = "";
  if (!p) return;

  const isMine = p.id === S.playerId;
  const lines = completedLines(p.marks).length;
  const strong = document.createElement("strong");
  strong.textContent = isMine ? "Your board" : `${p.name}'s board`;
  el.viewing.append(strong);

  const tag = document.createElement("span");
  tag.className = "tag";
  tag.style.color = isMine ? p.color : "var(--slate)";
  tag.textContent = isMine ? "Tap to tick" : "Read only";
  el.viewing.append(tag);

  const meta = document.createElement("span");
  meta.textContent = lines
    ? `${lines} line${lines > 1 ? "s" : ""} complete`
    : `${countMarks(p.marks)} of 25 ticked`;
  el.viewing.append(meta);

  el.bar.classList.toggle("is-bingo", lines > 0);
  el.barShout.hidden = lines === 0;
}

function renderBoard() {
  const p = viewed();
  if (!p) return;

  const isMine = p.id === S.playerId;
  el.board.classList.toggle("is-readonly", !isMine);
  el.boardFrame.style.setProperty("--who", p.color);
  el.checklist.style.setProperty("--who", p.color);

  const prev = S.boardSig;
  const sig = {
    id: p.id,
    layout: S.layout,
    free: S.config.freeSpace,
    board: p.board.join("\u0000"),
    marks: p.marks.join(""),
  };
  if (prev && Object.keys(sig).every((k) => sig[k] === prev[k])) return;

  const structureChanged = !prev
    || prev.id !== sig.id
    || prev.board !== sig.board
    || prev.free !== sig.free;

  el.boardFrame.hidden = S.layout !== "grid";
  el.checklist.hidden = S.layout !== "list";

  if (structureChanged || el.board.children.length !== CELLS) {
    buildGrid(p, isMine);
    S.needFit = true;
  }
  if (structureChanged || el.checklist.children.length !== CELLS) buildList(p, isMine);

  for (let i = 0; i < CELLS; i++) {
    el.board.children[i].classList.toggle("is-marked", Boolean(p.marks[i]));
    el.board.children[i].disabled = !isMine;
    const row = el.checklist.children[i].firstElementChild;
    row.classList.toggle("is-marked", Boolean(p.marks[i]));
    row.disabled = !isMine;
  }

  renderStrikes(p);
  if (S.needFit && S.layout === "grid") {
    S.needFit = false;
    scheduleFit();
  }
  S.boardSig = sig;
}

function buildGrid(p, isMine) {
  el.board.innerHTML = "";
  for (let i = 0; i < CELLS; i++) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.dataset.index = String(i);
    cell.setAttribute("role", "gridcell");
    if (i === FREE_INDEX) cell.classList.add("is-free");
    const text = document.createElement("span");
    text.className = "cell__text";
    text.textContent = cellText(p, i);
    cell.append(text);
    cell.disabled = !isMine;
    el.board.append(cell);
  }
}

function buildList(p, isMine) {
  el.checklist.innerHTML = "";
  for (let i = 0; i < CELLS; i++) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "check";
    btn.dataset.index = String(i);
    btn.disabled = !isMine;
    btn.innerHTML = `
      <span class="check__box"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M2 8.5 6 12.5 14 3.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <span class="check__text"></span>`;
    const text = $(".check__text", btn);
    text.textContent = cellText(p, i);
    if (i === FREE_INDEX) text.classList.add("check__free");
    li.append(btn);
    el.checklist.append(li);
  }
}

/**
 * Size each clue to its square. A length-based first guess gets almost
 * everything right in one pass; the measuring loop then rescues the few
 * that still overflow (long words, narrow phones, big system font sizes).
 */
function fitCells() {
  const cells = Array.from(el.board.children);
  if (!cells.length || !cells[0].clientHeight) return;

  for (const cell of cells) {
    const len = cell.textContent.trim().length;
    const guess = len <= 16 ? 1.2
      : len <= 24 ? 1.08
      : len <= 32 ? 0.98
      : len <= 40 ? 0.9
      : len <= 48 ? 0.83
      : 0.77;
    cell.style.setProperty("--fit", guess.toFixed(2));
  }

  const padding = parseFloat(getComputedStyle(cells[0]).paddingTop) * 2;
  for (const cell of cells) {
    const text = cell.firstElementChild;
    if (!text) continue;
    const room = cell.clientHeight - padding;
    let fit = parseFloat(cell.style.getPropertyValue("--fit")) || 1;
    let guard = 10;
    while (guard-- > 0 && fit > 0.5 && text.offsetHeight > room + 0.5) {
      fit -= 0.07;
      cell.style.setProperty("--fit", fit.toFixed(2));
    }
  }
}

const scheduleFit = () => requestAnimationFrame(fitCells);

function renderStrikes(p) {
  const lines = completedLines(p.marks);
  // Only redraw when the set of finished lines actually changes, so an
  // unrelated tick doesn't replay the animation on lines already struck.
  const sig = `${p.id}:${lines.map((l) => l[0]).join(",")}`;
  if (sig === S.strikeSig) return;
  S.strikeSig = sig;
  el.strikes.innerHTML = "";
  const centre = (i) => ({
    x: ((i % 5) + 0.5) * 20,
    y: (Math.floor(i / 5) + 0.5) * 20,
  });
  for (const line of lines) {
    const a = centre(line[0]);
    const b = centre(line[4]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const pad = 6;
    const x1 = a.x - (dx / len) * pad;
    const y1 = a.y - (dy / len) * pad;
    const x2 = b.x + (dx / len) * pad;
    const y2 = b.y + (dy / len) * pad;
    for (const cls of ["under", "over"]) {
      const node = document.createElementNS("http://www.w3.org/2000/svg", "line");
      node.setAttribute("class", cls);
      node.setAttribute("x1", x1);
      node.setAttribute("y1", y1);
      node.setAttribute("x2", x2);
      node.setAttribute("y2", y2);
      el.strikes.append(node);
    }
  }
}

/* ------------------------- marking and sync ------------------------ */

let syncTimer = null;
let syncClear = null;

function setSync(text, tone) {
  el.sync.textContent = text;
  el.sync.classList.toggle("is-warn", tone === "warn");
  clearTimeout(syncClear);
  if (tone === "fade") syncClear = setTimeout(() => { el.sync.textContent = ""; }, 1600);
}

function toggle(index) {
  const player = me();
  if (!player || S.viewing !== S.playerId) return;

  const before = completedLines(player.marks).length;
  player.marks = player.marks.map((m, i) => (i === index ? !m : m));
  store.write(pendingKey(S.code, S.playerId), player.marks);
  cacheState();
  render();

  if (completedLines(player.marks).length > before) toast("Bingo! Go on then, shout it.");

  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushMarks, 300);
  setSync("Saving…");
}

async function pushMarks() {
  if (S.pushing || !S.code || !S.playerId) return;
  const pending = store.read(pendingKey(S.code, S.playerId));
  if (!pending) return;

  S.pushing = true;
  try {
    await api("marks", { body: { code: S.code, playerId: S.playerId, marks: pending } });
    const now = store.read(pendingKey(S.code, S.playerId));
    if (now && now.join("") === pending.join("")) {
      store.drop(pendingKey(S.code, S.playerId));
      setSync("Saved", "fade");
    }
  } catch {
    setSync("Not saved yet — will keep trying", "warn");
    setTimeout(pushMarks, 5000);
  } finally {
    S.pushing = false;
    if (store.read(pendingKey(S.code, S.playerId))) {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(pushMarks, 1200);
    }
  }
}

/* ------------------------- loading game state ---------------------- */

function cacheState() {
  store.write(cacheKey(S.code), { config: S.config, players: S.players });
}

function adoptState(data) {
  S.config = data.config;
  S.players = data.players || [];

  // Local unsynced ticks always win over whatever the server last saw.
  const pending = S.playerId ? store.read(pendingKey(S.code, S.playerId)) : null;
  if (pending) {
    const mine = S.players.find((p) => p.id === S.playerId);
    if (mine) mine.marks = pending;
  }

  if (!S.players.some((p) => p.id === S.viewing)) {
    S.viewing = S.playerId || S.players[0]?.id || null;
  }
  cacheState();
  render();
}

async function refresh() {
  try {
    const data = await api("state", { query: { code: S.code } });
    adoptState(data);
    if (!S.players.some((p) => p.id === S.playerId)) openGate();
    return true;
  } catch (err) {
    if (String(err.message).includes("No game")) {
      stopPolling();
      forgetGame(S.code);
      show("home");
      el.joinError.textContent = "That game has been deleted.";
    }
    return false;
  }
}

function startPolling() {
  stopPolling();
  S.pollId = setInterval(() => {
    if (document.visibilityState === "visible") refresh();
  }, POLL_MS);
}

function stopPolling() {
  if (S.pollId) clearInterval(S.pollId);
  S.pollId = null;
}

async function enterGame(code, playerId) {
  S.code = code;
  S.playerId = playerId || null;
  S.viewing = playerId || null;
  S.boardSig = null;
  S.strikeSig = "";
  store.write(sessionKey, { code, playerId: S.playerId });

  const cached = store.read(cacheKey(code));
  if (cached?.config) {
    adoptState(cached);
    show("game");
  } else {
    show("game");
    el.viewing.textContent = "Loading the game…";
  }

  const ok = await refresh();
  if (ok) {
    show("game");
    pushMarks();
    startPolling();
  }
}

function paintResume() {
  const saved = store.read(sessionKey);
  if (!saved?.code) {
    el.homeResume.hidden = true;
    return;
  }
  const cached = store.read(cacheKey(saved.code));
  const who = cached?.players?.find((p) => p.id === saved.playerId);
  el.resumeBtn.textContent = who
    ? `Back to your board (${who.name})`
    : `Back to game ${saved.code}`;
  el.homeResume.hidden = false;
}

/** Leaves the game on screen but keeps it resumable. */
function goHome() {
  stopPolling();
  closeMenu();
  paintResume();
  el.joinError.textContent = "";
  el.joinCode.value = "";
  history.replaceState(null, "", location.pathname);
  show("home");
}

/** Removes the game from this device only. Other players are untouched. */
function forgetGame(code) {
  if (!code) return;
  store.drop(sessionKey);
  store.drop(cacheKey(code));
  if (S.playerId) store.drop(pendingKey(code, S.playerId));
  if (S.code === code) {
    S.code = null;
    S.playerId = null;
    S.config = null;
    S.players = [];
    S.viewing = null;
    S.boardSig = null;
  }
  paintResume();
}

/* --------------------------- the join gate ------------------------- */

function openGate() {
  el.gateError.textContent = "";
  el.gateExisting.innerHTML = "";

  if (S.players.length) {
    const hint = document.createElement("p");
    hint.className = "gate__hint";
    hint.textContent = "Already dealt in?";
    el.gateExisting.append(hint);
    for (const p of S.players) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gate__who";
      btn.style.setProperty("--chip", p.color);
      btn.dataset.resume = p.id;
      btn.innerHTML = `<span class="chip__roundel"></span><span class="chip__name"></span>`;
      $(".chip__roundel", btn).textContent = initials(p.name);
      $(".chip__name", btn).textContent = `Continue as ${p.name}`;
      el.gateExisting.append(btn);
    }
  }
  el.gate.hidden = false;
  el.gateName.focus();
}

function closeGate() { el.gate.hidden = true; }

function setPlayer(playerId) {
  S.playerId = playerId;
  S.viewing = playerId;
  S.boardSig = null;
  S.strikeSig = "";
  store.write(sessionKey, { code: S.code, playerId });
  closeGate();
  render();
}

/* ----------------------------- events ------------------------------ */

el.goCreate.addEventListener("click", () => {
  el.createPool.value = DEFAULT_POOL.join("\n");
  el.createFree.value = "Wheels down. Let the spotting begin.";
  updatePoolCount();
  show("create");
});

el.createBack.addEventListener("click", () => show("home"));

el.createPool.addEventListener("input", updatePoolCount);

function updatePoolCount() {
  const n = el.createPool.value.split("\n").map((s) => s.trim()).filter(Boolean).length;
  el.poolCount.textContent = String(n);
}

el.createForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  el.createError.textContent = "";
  const pool = el.createPool.value.split("\n").map((s) => s.trim()).filter(Boolean);
  try {
    const data = await api("create", {
      body: {
        title: el.createTitle.value.trim() || "England Bingo",
        freeSpace: el.createFree.value.trim() || "Free square",
        pool,
      },
    });
    S.viewing = null;
    await enterGame(data.config.code, null);
    openGate();
  } catch (err) {
    el.createError.textContent = err.message;
  }
});

el.joinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  el.joinError.textContent = "";
  const code = el.joinCode.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!code) {
    el.joinError.textContent = "Enter the code the others were given.";
    return;
  }
  const saved = store.read(sessionKey);
  await enterGame(code, saved?.code === code ? saved.playerId : null);
});

el.resumeBtn.addEventListener("click", () => {
  const saved = store.read(sessionKey);
  if (saved?.code) enterGame(saved.code, saved.playerId);
});

el.gateForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  el.gateError.textContent = "";
  const name = el.gateName.value.trim();
  if (!name) {
    el.gateError.textContent = "A name, so the others know whose board is whose.";
    return;
  }
  try {
    const data = await api("join", { body: { code: S.code, name } });
    S.playerId = data.player.id;
    adoptState(data);
    setPlayer(data.player.id);
    el.gateName.value = "";
    toast("Board dealt. Good luck.");
  } catch (err) {
    el.gateError.textContent = err.message;
  }
});

el.gateExisting.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-resume]");
  if (btn) setPlayer(btn.dataset.resume);
});

el.roster.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-player]");
  if (!chip) return;
  S.viewing = chip.dataset.player;
  S.boardSig = null;
  S.strikeSig = "";
  render();
});

el.board.addEventListener("click", (e) => {
  const cell = e.target.closest(".cell");
  if (cell && !cell.disabled) toggle(Number(cell.dataset.index));
});

el.checklist.addEventListener("click", (e) => {
  const row = e.target.closest(".check");
  if (row && !row.disabled) toggle(Number(row.dataset.index));
});

el.viewGrid.addEventListener("click", () => setLayout("grid"));
el.viewList.addEventListener("click", () => setLayout("list"));

function setLayout(mode) {
  S.layout = mode;
  S.needFit = true;
  S.boardSig = null;
  S.strikeSig = "";
  el.viewGrid.classList.toggle("is-on", mode === "grid");
  el.viewList.classList.toggle("is-on", mode === "list");
  el.viewGrid.setAttribute("aria-selected", String(mode === "grid"));
  el.viewList.setAttribute("aria-selected", String(mode === "list"));
  render();
}

let fitTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(fitCells, 150);
});
if (document.fonts?.ready) document.fonts.ready.then(fitCells).catch(() => {});

el.copyLink.addEventListener("click", copyInvite);

async function copyInvite() {
  const url = `${location.origin}${location.pathname}?g=${S.code}`;
  try {
    await navigator.clipboard.writeText(url);
    el.copyLabel.textContent = "Copied";
    setTimeout(() => { el.copyLabel.textContent = "Copy link"; }, 1800);
  } catch {
    toast(url);
  }
}

el.goHome.addEventListener("click", goHome);

el.forgetBtn.addEventListener("click", () => {
  const saved = store.read(sessionKey);
  if (!saved?.code) return;
  if (!confirm(`Remove game ${saved.code} from this device? Your board stays in the game — you can rejoin with the code.`)) return;
  forgetGame(saved.code);
  toast("Removed from this device.");
});

el.menuBtn.addEventListener("click", () => {
  el.menuSheet.hidden = false;
  el.menuBtn.setAttribute("aria-expanded", "true");
});

el.menuSheet.addEventListener("click", async (e) => {
  if (e.target === el.menuSheet || e.target.dataset.menu === "close") return closeMenu();
  const action = e.target.dataset?.menu;
  if (!action) return;
  closeMenu();

  if (action === "copy") return copyInvite();

  if (action === "free") {
    const next = await askText({
      title: "Centre square",
      label: "Shown in the middle of every board",
      value: S.config.freeSpace,
      cta: "Update for everyone",
    });
    if (!next) return;
    try {
      adoptState(await api("config", { body: { code: S.code, freeSpace: next } }));
      toast("Centre square updated for everyone.");
    } catch (err) { toast(err.message); }
    return;
  }

  if (action === "shuffle") {
    const player = me();
    if (!player) return;
    const marked = countMarks(player.marks) - 1;
    if (marked > 0 && !confirm(`Shuffling deals you 24 new squares and clears ${marked} tick${marked > 1 ? "s" : ""}. Carry on?`)) return;
    try {
      store.drop(pendingKey(S.code, S.playerId));
      await api("shuffle", { body: { code: S.code, playerId: S.playerId } });
      S.boardSig = null;
      S.strikeSig = "";
      await refresh();
      toast("New board dealt.");
    } catch (err) { toast(err.message); }
    return;
  }

  if (action === "home") return goHome();

  if (action === "delete") {
    const typed = await askText({
      title: "Delete this game",
      label: `This wipes the game and every player's board, for everyone. Type ${S.code} to confirm.`,
      value: "",
      cta: "Delete permanently",
    });
    if (!typed || typed.toUpperCase() !== S.code) {
      if (typed) toast("Code didn't match — nothing deleted.");
      return;
    }
    try {
      const code = S.code;
      await api("delete", { body: { code } });
      forgetGame(code);
      stopPolling();
      history.replaceState(null, "", location.pathname);
      show("home");
      toast("Game deleted.");
    } catch (err) { toast(err.message); }
    return;
  }

  if (action === "switch") {
    store.write(sessionKey, { code: S.code, playerId: null });
    S.playerId = null;
    S.boardSig = null;
    S.strikeSig = "";
    render();
    openGate();
  }
});

function closeMenu() {
  el.menuSheet.hidden = true;
  el.menuBtn.setAttribute("aria-expanded", "false");
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  closeMenu();
  if (!el.gate.hidden && S.playerId) closeGate();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && S.code) {
    pushMarks();
    refresh();
  }
});

window.addEventListener("online", () => { pushMarks(); refresh(); });

/* ------------------------------- boot ------------------------------ */

(function boot() {
  updatePoolCount();

  const urlCode = new URLSearchParams(location.search).get("g");
  const saved = store.read(sessionKey);

  if (urlCode) {
    const code = urlCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    enterGame(code, saved?.code === code ? saved.playerId : null);
    return;
  }

  paintResume();
  show("home");
})();
