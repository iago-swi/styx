/* ==========================================================================
   STYX // Neon Abyss — Device & Shared High-Score Store
   Maintains the top 10 local runs in localStorage (migrating legacy best
   score automatically) and syncs with the dedicated Cloudflare Worker + D1
   shared leaderboard using CORS simple requests.
   ========================================================================== */

(function (global) {
  'use strict';

  const STYX = (global.STYX = global.STYX || {});

  // Address of the dedicated STYX // NEON ABYSS shared score service.
  // While empty, there are no tabs and no network requests (device-only mode).
  const SHARED = 'https://neon-abyss-scores.iago-swi.workers.dev/';

  const SCORES_KEY = 'styx_neon_abyss_scores';
  const INITIALS_KEY = 'styx_neon_abyss_initials';
  const BEST_KEY = 'styx_neon_abyss_highscore_v1';
  const LIST_TAB_KEY = 'styx_neon_abyss_list';
  const MAX_ROWS = 10;
  const REQUEST_TIMEOUT_MS = 8000;

  let sharedReqSeq = 0;

  function safeGet(key) {
    try {
      return typeof global.localStorage !== 'undefined' ? global.localStorage.getItem(key) : null;
    } catch (_) {
      return null;
    }
  }

  function safeSet(key, val) {
    try {
      if (typeof global.localStorage !== 'undefined') global.localStorage.setItem(key, String(val));
    } catch (_) {}
  }

  function sanitizeInitials(v) {
    return (String(v ?? '').toUpperCase().match(/[\p{L}\p{N}]/gu) || []).slice(0, 3).join('');
  }

  function isValidDateISO(d) {
    return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  }

  function todayLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatDateDisplay(iso) {
    if (!isValidDateISO(iso)) return '\u2014';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }

  function generateRunKey() {
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  function sanitizeEntry(raw, allowMe) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const s = Math.round(Number(raw.s));
    const w = Math.round(Number(raw.w));
    if (!Number.isFinite(s) || s <= 0) return null;
    if (!Number.isFinite(w) || w < 1 || w > 99) return null;
    const n = sanitizeInitials(raw.n);
    const d = isValidDateISO(raw.d) ? raw.d : '';
    const entry = { n, s, w, d };
    if (allowMe && raw.me === true) entry.me = true;
    return entry;
  }

  function saveDeviceScores(list) {
    const clean = list.slice(0, MAX_ROWS).map((e) => ({
      n: sanitizeInitials(e.n),
      s: Math.round(e.s),
      w: Math.round(e.w),
      d: isValidDateISO(e.d) ? e.d : ''
    }));
    safeSet(SCORES_KEY, JSON.stringify(clean));
    safeSet(BEST_KEY, clean.length ? String(clean[0].s) : '0');
    return clean;
  }

  function loadDeviceScores() {
    let list = [];
    const rawStr = safeGet(SCORES_KEY);
    if (rawStr) {
      try {
        const parsed = JSON.parse(rawStr);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const clean = sanitizeEntry(item, false);
            if (clean) list.push(clean);
          }
          // Stable sort best-first so equal scores preserve older-first order
          list = list
            .map((e, i) => ({ e, i }))
            .sort((a, b) => (b.e.s - a.e.s) || (a.i - b.i))
            .map((x) => x.e)
            .slice(0, MAX_ROWS);
        }
      } catch (_) {
        list = [];
      }
    }

    // Migrate legacy single high score if the list is empty
    if (list.length === 0) {
      const legacyBest = Math.round(Number(safeGet(BEST_KEY) || 0));
      if (Number.isFinite(legacyBest) && legacyBest > 0) {
        list = [{ n: '', s: legacyBest, w: 1, d: '' }];
        saveDeviceScores(list);
      }
    } else {
      const topScore = list[0].s;
      if (Number(safeGet(BEST_KEY) || 0) !== topScore) {
        safeSet(BEST_KEY, String(topScore));
      }
    }

    return list;
  }

  function getDeviceBest() {
    const list = loadDeviceScores();
    return list.length ? list[0].s : 0;
  }

  function getStoredInitials() {
    return sanitizeInitials(safeGet(INITIALS_KEY) || '');
  }

  function saveStoredInitials(raw) {
    const clean = sanitizeInitials(raw);
    safeSet(INITIALS_KEY, clean);
    return clean;
  }

  function recordDeviceScore(score, levelReached, rawInitials) {
    const list = loadDeviceScores();
    const s = Math.round(Number(score));
    const w = Math.max(1, Math.min(99, Math.round(Number(levelReached) || 1)));

    if (!Number.isFinite(s) || s <= 0) {
      return {
        listed: false,
        rank: 0,
        entryIndex: -1,
        isNewBest: false,
        best: list.length ? list[0].s : 0,
        list
      };
    }

    // Equal score ranks BELOW older ones -> insert before first strictly lower entry
    let insertIdx = list.findIndex((e) => e.s < s);
    if (insertIdx === -1) insertIdx = list.length;

    if (insertIdx >= MAX_ROWS) {
      return {
        listed: false,
        rank: 0,
        entryIndex: -1,
        isNewBest: false,
        best: list[0].s,
        list
      };
    }

    const entry = {
      n: sanitizeInitials(rawInitials),
      s,
      w,
      d: todayLocalISO()
    };

    const next = list.slice();
    next.splice(insertIdx, 0, entry);
    const saved = saveDeviceScores(next);

    return {
      listed: true,
      rank: insertIdx + 1,
      entryIndex: insertIdx,
      isNewBest: insertIdx === 0,
      best: saved[0].s,
      list: saved
    };
  }

  function updateDeviceEntryInitials(entryIndex, rawInitials) {
    const clean = saveStoredInitials(rawInitials);
    const list = loadDeviceScores();
    if (entryIndex >= 0 && entryIndex < list.length) {
      list[entryIndex].n = clean;
      return { initials: clean, list: saveDeviceScores(list) };
    }
    return { initials: clean, list };
  }

  function getSharedUrl() {
    return typeof SHARED === 'string' ? SHARED.trim() : '';
  }

  function isSharedEnabled() {
    return getSharedUrl().length > 0;
  }

  function getActiveTab() {
    if (!isSharedEnabled()) return 'device';
    return safeGet(LIST_TAB_KEY) === 'shared' ? 'shared' : 'device';
  }

  function saveActiveTab(tab) {
    const val = (tab === 'shared' && isSharedEnabled()) ? 'shared' : 'device';
    safeSet(LIST_TAB_KEY, val);
    return val;
  }

  function sanitizeSharedResponse(json) {
    if (!json || typeof json !== 'object' || !Array.isArray(json.top)) return null;
    const top = [];
    for (const item of json.top) {
      const clean = sanitizeEntry(item, true);
      if (clean) top.push(clean);
      if (top.length >= MAX_ROWS) break;
    }
    const rankNum = Math.round(Number(json.rank));
    const rank = Number.isFinite(rankNum) && rankNum >= 1 ? rankNum : 0;
    return { top, rank };
  }

  async function requestShared(options) {
    const url = getSharedUrl();
    if (!url) return { disabled: true };

    const seq = ++sharedReqSeq;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS) : null;

    try {
      const fetchOpts = {
        method: options.method || 'GET',
        cache: 'no-store'
      };
      if (ctrl) fetchOpts.signal = ctrl.signal;
      // Plain-text body with NO Content-Type header -> CORS simple request (no preflight)
      if (options.body !== undefined) {
        fetchOpts.body = options.body;
      }

      const res = await fetch(url, fetchOpts);
      if (seq !== sharedReqSeq) return { stale: true };
      if (!res.ok) return { ok: false, status: res.status };

      const data = await res.json();
      if (seq !== sharedReqSeq) return { stale: true };

      const clean = sanitizeSharedResponse(data);
      if (!clean) return { ok: false };
      return { ok: true, top: clean.top, rank: clean.rank };
    } catch (_) {
      if (seq !== sharedReqSeq) return { stale: true };
      return { ok: false };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function fetchSharedTop() {
    return requestShared({ method: 'GET' });
  }

  function submitSharedScore(payload) {
    const body = JSON.stringify({
      k: String(payload.k || ''),
      n: sanitizeInitials(payload.n),
      s: Math.round(Number(payload.s) || 0),
      w: Math.round(Number(payload.w) || 1)
    });
    return requestShared({ method: 'POST', body });
  }

  function cancelPendingSharedRequests() {
    sharedReqSeq++;
  }

  STYX.Scores = {
    get SHARED() { return getSharedUrl(); },
    SCORES_KEY,
    INITIALS_KEY,
    BEST_KEY,
    LIST_TAB_KEY,
    sanitizeInitials,
    formatDateDisplay,
    todayLocalISO,
    generateRunKey,
    loadDeviceScores,
    saveDeviceScores,
    getDeviceBest,
    getStoredInitials,
    saveStoredInitials,
    recordDeviceScore,
    updateDeviceEntryInitials,
    isSharedEnabled,
    getActiveTab,
    saveActiveTab,
    fetchSharedTop,
    submitSharedScore,
    cancelPendingSharedRequests
  };
})(window);
