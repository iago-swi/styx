// Shared high-score list for Vitrail: a Cloudflare Worker in front of a D1 (SQLite) database.
//
//   GET  /?game=vitrail                          ->  { top: [{ n, s, w, d }] }
//   POST /?game=vitrail     body { k, n, s, w }  ->  { top: [{ n, s, w, d, me? }], rank }
//
// n = initials, s = score, w = window reached, d = day (UTC), k = a random key the game makes up for each run.
// Sending the same key again changes the initials of that run and nothing else, so a retry or an edit
// never adds a second entry. The key is never sent back out.
//
// Stored per run: the game, the key, the initials, the score, the window and the time. Nothing else:
// no address, no browser details.

const TOP = 10;          // rows sent to the game
const KEEP = 200;        // rows kept per game
const PER_MINUTE = 30;   // new entries accepted per minute, all players together

// A browser game cannot prove its score, so the list only refuses what the rules make impossible.
// These figures mirror ../index.html. A pane that lights g percent of window n scores
// (80 g + 6 g²) × (1 + 0.25 (n − 1)), rounded to ten. Finishing window n adds 1000 n, plus 500 for each
// percentage point above the target (75, then 78 from window 3 and 80 from window 5), rounded to ten as well.
//   Highest: one pane of the whole window (68,000 × the window factor; several panes always score less)
//            with every bonus, and 2,000 of slack for the rounding of many small panes.
//   Lowest:  a run that ended in window w finished the w − 1 windows before it, and each of those paid
//            at least its 1000 n. Panes can round down to nothing, so they add nothing to the minimum.
function vitrailRange(w) {
  let min = 0, max = 0;
  for (let n = 1; n <= w; n++) {
    const goal = n < 3 ? 75 : n < 5 ? 78 : 80;
    max += 68000 * (1 + 0.25 * (n - 1)) + 2000 + 1000 * n + 500 * (100 - goal);
    if (n < w) min += 1000 * n;
  }
  return [min, max];
}
const GAMES = {
  vitrail(s, w) { const [min, max] = vitrailRange(w); return s % 10 === 0 && s >= min && s <= max; }
};

const HEAD = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEAD });
const clean = v => (String(v ?? '').toUpperCase().match(/[\p{L}\p{N}]/gu) || []).slice(0, 3).join('');

async function top(db, game, id) {
  const { results } = await db.prepare('SELECT id, n, s, w, d FROM scores WHERE game = ?1 ORDER BY s DESC, id LIMIT ?2').bind(game, TOP).all();
  return results.map(r => r.id === id ? { n: r.n, s: r.s, w: r.w, d: r.d, me: true } : { n: r.n, s: r.s, w: r.w, d: r.d });
}

async function handle(req, db) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...HEAD, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } });
  }
  const game = new URL(req.url).searchParams.get('game');
  if (!game || !Object.hasOwn(GAMES, game)) return reply({ error: 'unknown game' }, 400);
  if (req.method === 'GET') return reply({ top: await top(db, game) });
  if (req.method !== 'POST') return reply({ error: 'method not allowed' }, 405);

  const text = await req.text();
  if (text.length > 400) return reply({ error: 'too long' }, 413);
  let b; try { b = JSON.parse(text); } catch (e) { return reply({ error: 'not JSON' }, 400); }
  const valid = b && typeof b.k === 'string' && /^[0-9a-f]{32}$/.test(b.k)
    && Number.isInteger(b.s) && b.s > 0 && Number.isInteger(b.w) && b.w >= 1 && b.w <= 99 && GAMES[game](b.s, b.w);
  if (!valid) return reply({ error: 'not a valid run' }, 422);

  const n = clean(b.n), now = Date.now();
  let row = await db.prepare('SELECT id, s FROM scores WHERE k = ?1 AND game = ?2').bind(b.k, game).first();
  if (row) await db.prepare('UPDATE scores SET n = ?1 WHERE id = ?2').bind(n, row.id).run();
  else {
    const recent = await db.prepare('SELECT COUNT(*) AS c FROM scores WHERE t > ?1').bind(now - 60000).first();
    if (recent.c >= PER_MINUTE) return reply({ error: 'too many new scores, try again in a minute' }, 429);
    await db.prepare('INSERT INTO scores (game, k, n, s, w, d, t) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT (k) DO NOTHING')
      .bind(game, b.k, n, b.s, b.w, new Date(now).toISOString().slice(0, 10), now).run();
    row = await db.prepare('SELECT id, s FROM scores WHERE k = ?1 AND game = ?2').bind(b.k, game).first();
    if (!row) return reply({ error: 'not a valid run' }, 422);          // the key belongs to a run of another game
    await db.prepare('DELETE FROM scores WHERE game = ?1 AND id NOT IN (SELECT id FROM scores WHERE game = ?1 ORDER BY s DESC, id LIMIT ?2)').bind(game, KEEP).run();
  }
  // equal scores rank in the order they arrived
  const ahead = await db.prepare('SELECT COUNT(*) AS c FROM scores WHERE game = ?1 AND (s > ?2 OR (s = ?2 AND id < ?3))').bind(game, row.s, row.id).first();
  return reply({ top: await top(db, game, row.id), rank: ahead.c + 1 });
}

export default {
  async fetch(req, env) {
    try { return await handle(req, env.DB); }
    catch (e) { console.error(e); return reply({ error: 'server error' }, 500); }
  }
};
