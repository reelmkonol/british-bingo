import { getStore } from "@netlify/blobs";

/* ------------------------------------------------------------------ *
 * Storage layout (Netlify Blobs, store name "bingo")
 *
 *   games/<CODE>/config              -> { code, title, freeSpace, pool, ... }
 *   games/<CODE>/players/<PLAYER_ID> -> { id, name, color, board, marks, ... }
 *
 * Each player only ever writes their own blob, so two people marking
 * squares at the same time can never clobber each other.
 * ------------------------------------------------------------------ */

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I, L, O, 0, 1
const CODE_LENGTH = 5;
const MAX_PLAYERS = 12;
const CELLS = 25;
const FREE_INDEX = 12;
const NEEDED = CELLS - 1; // 24 real squares + 1 centre square

const COLORS = [
  "#C8102E", "#0B6E4F", "#1D5C9E", "#B87503",
  "#6B3FA0", "#0F7A82", "#A34700", "#3F4E49",
  "#8C1D5B", "#2E6B1F", "#7A4A2A", "#455A9E",
];

const store = () => getStore({ name: "bingo", consistency: "strong" });

const cfgKey = (code) => `games/${code}/config`;
const playerKey = (code, id) => `games/${code}/players/${id}`;
const playerPrefix = (code) => `games/${code}/players/`;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

const fail = (message, status = 400) => json({ error: message }, status);

function normaliseCode(input) {
  return String(input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function randomCode() {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

function cleanText(value, max) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanPool(pool) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(pool) ? pool : []) {
    const line = cleanText(raw, 160);
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= 500) break;
  }
  return out;
}

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Board is 25 entries; index 12 is null and renders as the centre square. */
function makeBoard(pool) {
  const picks = shuffle(pool).slice(0, NEEDED);
  const board = new Array(CELLS).fill(null);
  let p = 0;
  for (let i = 0; i < CELLS; i++) {
    if (i === FREE_INDEX) continue;
    board[i] = picks[p++];
  }
  return board;
}

function freshMarks() {
  const marks = new Array(CELLS).fill(false);
  marks[FREE_INDEX] = true;
  return marks;
}

function coerceMarks(input) {
  const marks = new Array(CELLS).fill(false);
  if (!Array.isArray(input)) return freshMarks();
  for (let i = 0; i < CELLS; i++) marks[i] = Boolean(input[i]);
  return marks;
}

async function readBody(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function loadConfig(code) {
  if (!code) return null;
  return await store().get(cfgKey(code), { type: "json" });
}

async function loadPlayers(code) {
  const s = store();
  const { blobs } = await s.list({ prefix: playerPrefix(code) });
  const players = await Promise.all(
    blobs.map((b) => s.get(b.key, { type: "json" }).catch(() => null))
  );
  return players
    .filter(Boolean)
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
}

/* ----------------------------- handlers ---------------------------- */

async function handleCreate(req) {
  const body = await readBody(req);
  const title = cleanText(body.title, 60) || "England Bingo";
  const freeSpace = cleanText(body.freeSpace, 160) || "Free square";
  const pool = cleanPool(body.pool);

  if (pool.length < NEEDED) {
    return fail(
      `You need at least ${NEEDED} different things to spot. There are ${pool.length} so far.`
    );
  }

  const s = store();
  let code = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = randomCode();
    const existing = await s.get(cfgKey(candidate), { type: "json" });
    if (!existing) {
      code = candidate;
      break;
    }
  }
  if (!code) return fail("Could not reserve a game code. Try again.", 503);

  const config = {
    code,
    title,
    freeSpace,
    pool,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await s.setJSON(cfgKey(code), config);
  return json({ config, players: [] });
}

async function handleState(req) {
  const url = new URL(req.url);
  const code = normaliseCode(url.searchParams.get("code"));
  const config = await loadConfig(code);
  if (!config) return fail("No game with that code.", 404);
  const players = await loadPlayers(code);
  return json({ config, players });
}

async function handleJoin(req) {
  const body = await readBody(req);
  const code = normaliseCode(body.code);
  const config = await loadConfig(code);
  if (!config) return fail("No game with that code.", 404);

  const s = store();
  const players = await loadPlayers(code);
  const playerId = String(body.playerId ?? "").slice(0, 64);

  // Rejoining an existing player (same device, or "continue as" from the list).
  if (playerId) {
    const existing = players.find((p) => p.id === playerId);
    if (existing) {
      const name = cleanText(body.name, 24);
      if (name && name !== existing.name) {
        existing.name = name;
        existing.updatedAt = Date.now();
        await s.setJSON(playerKey(code, existing.id), existing);
      }
      return json({ config, players, player: existing });
    }
  }

  if (players.length >= MAX_PLAYERS) {
    return fail(`This game is full (${MAX_PLAYERS} players).`, 409);
  }

  const name = cleanText(body.name, 24);
  if (!name) return fail("Add a name so the others know whose board this is.");

  const used = new Set(players.map((p) => p.color));
  const color = COLORS.find((c) => !used.has(c)) || COLORS[players.length % COLORS.length];

  const player = {
    id: crypto.randomUUID(),
    name,
    color,
    board: makeBoard(config.pool),
    marks: freshMarks(),
    joinedAt: Date.now(),
    updatedAt: Date.now(),
  };
  await s.setJSON(playerKey(code, player.id), player);
  return json({ config, players: [...players, player], player });
}

async function handleMarks(req) {
  const body = await readBody(req);
  const code = normaliseCode(body.code);
  const playerId = String(body.playerId ?? "").slice(0, 64);
  if (!code || !playerId) return fail("Missing game code or player.");

  const s = store();
  const player = await s.get(playerKey(code, playerId), { type: "json" });
  if (!player) return fail("That player is not in this game.", 404);

  player.marks = coerceMarks(body.marks);
  player.updatedAt = Date.now();
  await s.setJSON(playerKey(code, playerId), player);
  return json({ player });
}

async function handleShuffle(req) {
  const body = await readBody(req);
  const code = normaliseCode(body.code);
  const playerId = String(body.playerId ?? "").slice(0, 64);
  const config = await loadConfig(code);
  if (!config) return fail("No game with that code.", 404);

  const s = store();
  const player = await s.get(playerKey(code, playerId), { type: "json" });
  if (!player) return fail("That player is not in this game.", 404);

  player.board = makeBoard(config.pool);
  player.marks = freshMarks();
  player.updatedAt = Date.now();
  await s.setJSON(playerKey(code, playerId), player);
  return json({ player });
}

async function handleConfig(req) {
  const body = await readBody(req);
  const code = normaliseCode(body.code);
  const config = await loadConfig(code);
  if (!config) return fail("No game with that code.", 404);

  if (body.freeSpace !== undefined) {
    const freeSpace = cleanText(body.freeSpace, 160);
    if (!freeSpace) return fail("The centre square needs some text.");
    config.freeSpace = freeSpace;
  }
  if (body.title !== undefined) {
    config.title = cleanText(body.title, 60) || config.title;
  }
  if (body.pool !== undefined) {
    const pool = cleanPool(body.pool);
    if (pool.length < NEEDED) {
      return fail(`Keep at least ${NEEDED} things in the list. There are ${pool.length}.`);
    }
    config.pool = pool;
  }
  config.updatedAt = Date.now();
  await store().setJSON(cfgKey(code), config);
  const players = await loadPlayers(code);
  return json({ config, players });
}

async function handleDelete(req) {
  const body = await readBody(req);
  const code = normaliseCode(body.code);
  if (!code) return fail("Missing game code.");

  const s = store();
  const { blobs } = await s.list({ prefix: playerPrefix(code) });
  await Promise.all(blobs.map((b) => s.delete(b.key).catch(() => null)));
  await s.delete(cfgKey(code)).catch(() => null);
  return json({ ok: true });
}

/* ------------------------------ router ----------------------------- */

const ROUTES = {
  create: { method: "POST", run: handleCreate },
  state: { method: "GET", run: handleState },
  join: { method: "POST", run: handleJoin },
  marks: { method: "POST", run: handleMarks },
  shuffle: { method: "POST", run: handleShuffle },
  config: { method: "POST", run: handleConfig },
  delete: { method: "POST", run: handleDelete },
};

export default async (req) => {
  const { pathname } = new URL(req.url);
  const action = pathname.split("/").filter(Boolean).pop();
  const route = ROUTES[action];

  if (!route) return fail(`Unknown endpoint: ${action}`, 404);
  if (req.method !== route.method) return fail("Wrong method for this endpoint.", 405);

  try {
    return await route.run(req);
  } catch (err) {
    console.error(`[bingo:${action}]`, err);
    return fail("Something went wrong on the server. Your board is safe — try again.", 500);
  }
};
