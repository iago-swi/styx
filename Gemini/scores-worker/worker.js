// Shared high-score list for STYX // NEON ABYSS: a Cloudflare Worker in front of a D1 (SQLite) database.
//
//   GET  /                     ->  { top: [{ n, s, w, d }] }
//   POST /  body { k, n, s, w } ->  { top: [{ n, s, w, d, me? }], rank }
//
// n = initials (up to 3 uppercase letters/digits), s = score, w = level reached (1..99),
// d = UTC date (YYYY-MM-DD), k = 32-char lowercase hex key generated per finished run.
// Sending the same k again updates only the initials of that row, never adding a duplicate.
// k is never returned in responses.
//
// Stored per run: key, initials, score, level, UTC date, timestamp. Nothing else:
// no IP address and no browser details.

const TOP = 10;         // rows returned in top list
const KEEP = 200;       // best rows retained in database
const PER_MINUTE = 30;  // max new entries accepted per minute across all players
const MAX_LEVEL = 99;

// Score bounds derived directly from src/themes.js, src/grid.js, and src/game.js:
// - Playfield interior: 318 x 198 = 62,964 cells. Target to clear every level: 80%.
// - Scoring events in STYX // NEON ABYSS:
//     * Area capture:        max(10 * mult, round(deltaPercent * 100) * mult)   (mult in {1, 5, 10})
//     * Caterpillar crush:   2,500 * mult                                        (up to min(4, 1 + floor(lvl/2)) crawlers)
//     * Styx split bonus:    5,000                                               (once per level when lvl === 3 || lvl >= 5)
//     * Overclaim bonus:     floor(finalPct - 80) * 1,000                        (up to 20,000 on cleared levels)
// - Minimum positive score ending on level w:
//     * Level 1: at least one claim -> >= 10
//     * Level w > 1: levels 1..(w-1) each cleared >= 80% on at least x1 -> >= (w - 1) * 7,900
// - Maximum plausible score ending on level w:
//     * Per level lvl in 1..w:
//         105,000 (100% area on x10 + small-slice rounding headroom)
//       + (lvl < w ? 20,000 : 0) (max overclaim bonus on cleared levels)
//       + min(4, 1 + floor(lvl / 2)) * 25,000 (all crawlers crushed on x10)
//       + ((lvl === 3 || lvl >= 5) ? 5,000 : 0) (Styx split bonus)
function neonAbyssScoreRange(w) {
  const min = w === 1 ? 10 : (w - 1) * 7900;
  let max = 0;
  for (let lvl = 1; lvl <= w; lvl++) {
    const crawlers = Math.min(4, 1 + Math.floor(lvl / 2));
    const overclaim = lvl < w ? 20000 : 0;
    const split = (lvl === 3 || lvl >= 5) ? 5000 : 0;
    max += 105000 + overclaim + crawlers * 25000 + split;
  }
  return [min, max];
}

function isValidNeonAbyssRun(s, w) {
  if (!Number.isInteger(w) || w < 1 || w > MAX_LEVEL) return false;
  if (!Number.isInteger(s) || s <= 0) return false;
  const [min, max] = neonAbyssScoreRange(w);
  return s >= min && s <= max;
}

const HEAD = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEAD });
const cleanInitials = (v) => (String(v ?? '').toUpperCase().match(/[\p{L}\p{N}]/gu) || []).slice(0, 3).join('');

async function getTop(db, meId) {
  const { results } = await db
    .prepare('SELECT id, n, s, w, d FROM scores ORDER BY s DESC, id ASC LIMIT ?1')
    .bind(TOP)
    .all();
  return results.map((r) =>
    r.id === meId
      ? { n: r.n, s: r.s, w: r.w, d: r.d, me: true }
      : { n: r.n, s: r.s, w: r.w, d: r.d }
  );
}

async function handle(req, db) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...HEAD,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  if (req.method === 'GET') {
    return reply({ top: await getTop(db, -1) });
  }

  if (req.method !== 'POST') {
    return reply({ error: 'method not allowed' }, 405);
  }

  const text = await req.text();
  if (text.length > 400) return reply({ error: 'too long' }, 413);

  let b;
  try {
    b = JSON.parse(text);
  } catch (_) {
    return reply({ error: 'not JSON' }, 400);
  }

  const valid =
    b &&
    typeof b === 'object' &&
    typeof b.k === 'string' &&
    /^[0-9a-f]{32}$/.test(b.k) &&
    isValidNeonAbyssRun(b.s, b.w);

  if (!valid) return reply({ error: 'not a valid run' }, 422);

  const n = cleanInitials(b.n);
  const now = Date.now();
  let row = await db.prepare('SELECT id, s FROM scores WHERE k = ?1').bind(b.k).first();

  if (row) {
    // Same key updates initials only; never creates a duplicate or hits rate limit
    await db.prepare('UPDATE scores SET n = ?1 WHERE id = ?2').bind(n, row.id).run();
  } else {
    const recent = await db
      .prepare('SELECT COUNT(*) AS c FROM scores WHERE t > ?1')
      .bind(now - 60000)
      .first();
    if (recent && recent.c >= PER_MINUTE) {
      return reply({ error: 'too many new scores, try again in a minute' }, 429);
    }

    const day = new Date(now).toISOString().slice(0, 10);
    await db
      .prepare('INSERT INTO scores (k, n, s, w, d, t) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT (k) DO NOTHING')
      .bind(b.k, n, b.s, b.w, day, now)
      .run();

    row = await db.prepare('SELECT id, s FROM scores WHERE k = ?1').bind(b.k).first();
    if (!row) return reply({ error: 'could not store run' }, 500);

    await db
      .prepare('DELETE FROM scores WHERE id NOT IN (SELECT id FROM scores ORDER BY s DESC, id ASC LIMIT ?1)')
      .bind(KEEP)
      .run();
  }

  // Equal scores rank in the order they arrived (lower id ranks ahead)
  const ahead = await db
    .prepare('SELECT COUNT(*) AS c FROM scores WHERE s > ?1 OR (s = ?1 AND id < ?2)')
    .bind(row.s, row.id)
    .first();

  return reply({
    top: await getTop(db, row.id),
    rank: (ahead ? ahead.c : 0) + 1
  });
}

export default {
  async fetch(req, env) {
    try {
      return await handle(req, env.DB);
    } catch (err) {
      console.error(err);
      return reply({ error: 'server error' }, 500);
    }
  }
};
