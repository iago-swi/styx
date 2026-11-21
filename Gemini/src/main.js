/* ==========================================================================
   STYX // Bootstrapper, Responsive Stage Sizing, High-Score UI & Input Bindings
   ========================================================================== */

(function (global) {
  'use strict';

  const STYX = (global.STYX = global.STYX || {});
  const RENAME_DEBOUNCE_MS = 700;

  function formatScore(n) {
    return Math.round(Number(n) || 0).toLocaleString('en-US');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const Scores = STYX.Scores;

    const ui = {
      stageFrame: document.getElementById('stage-frame'),
      glCanvas: document.getElementById('gl-canvas'),
      uiCanvas: document.getElementById('ui-canvas'),
      toast: document.getElementById('toast-banner'),
      fpsBadge: document.getElementById('fps-badge'),

      hudLevel: document.getElementById('hud-level'),
      hudRealm: document.getElementById('hud-realm'),
      hudClaimed: document.getElementById('hud-claimed'),
      hudProgressFill: document.getElementById('hud-progress-fill'),
      multBadge: document.getElementById('multiplier-badge'),
      multRingArc: document.getElementById('mult-ring-arc'),
      hudMult: document.getElementById('hud-mult'),
      hudMultName: document.getElementById('hud-mult-name'),
      hudScore: document.getElementById('hud-score'),
      hudHigh: document.getElementById('hud-high'),
      hudLives: document.getElementById('hud-lives'),

      btnSound: document.getElementById('btn-sound'),
      iconSoundOn: document.getElementById('icon-sound-on'),
      iconSoundOff: document.getElementById('icon-sound-off'),
      btnCrt: document.getElementById('btn-crt'),
      btnPause: document.getElementById('btn-pause'),

      overlayTitle: document.getElementById('overlay-title'),
      overlayHighScores: document.getElementById('overlay-highscores'),
      overlayPause: document.getElementById('overlay-pause'),
      overlayClear: document.getElementById('overlay-clear'),
      overlayGameOver: document.getElementById('overlay-gameover'),

      btnStart: document.getElementById('btn-start'),
      btnHighScores: document.getElementById('btn-highscores'),
      btnHsBack: document.getElementById('btn-hs-back'),
      btnResume: document.getElementById('btn-resume'),
      btnRestartPause: document.getElementById('btn-restart-pause'),
      btnEndRun: document.getElementById('btn-end-run'),
      btnNextLevel: document.getElementById('btn-next-level'),
      btnRetry: document.getElementById('btn-retry'),
      btnGoTitle: document.getElementById('btn-go-title'),

      hsTabs: document.getElementById('hs-tabs'),
      hsList: document.getElementById('hs-list'),
      hsMsg: document.getElementById('hs-msg'),

      clearHeading: document.getElementById('clear-heading'),
      clearPct: document.getElementById('clear-pct'),
      clearOverBonus: document.getElementById('clear-over-bonus'),
      clearCrushed: document.getElementById('clear-crushed'),
      clearTotal: document.getElementById('clear-total'),

      goBadge: document.getElementById('gameover-badge'),
      goScore: document.getElementById('go-score'),
      goLevel: document.getElementById('go-level'),
      goStatusLine: document.getElementById('go-status-line'),
      goInitialsWrap: document.getElementById('go-initials-wrap'),
      goInitials: document.getElementById('go-initials'),
      goTabs: document.getElementById('go-tabs'),
      goList: document.getElementById('go-list'),
      goSharedMsg: document.getElementById('go-shared-msg')
    };

    const game = new STYX.StyxGame(ui);
    global.__STYX_GAME__ = game;

    let highScoresOpen = false;
    let renameTimer = null;

    let currentRun = {
      deviceListed: false,
      deviceIndex: -1,
      sharedSent: false,
      sharedKey: null,
      score: 0,
      level: 1
    };

    let goSharedState = { loading: false, error: false, top: [], rank: 0, fetched: false };
    let hsSharedState = { loading: false, error: false, top: [], rank: 0 };

    // ------------------------------------------------------------------------
    // HIGH SCORE LIST RENDERING & SHARED SYNC
    // ------------------------------------------------------------------------
    function renderScoresList(containerEl, rows, highlightIndex) {
      containerEl.textContent = '';
      containerEl.classList.toggle('two-col-wide', rows.length > 5);

      for (let i = 0; i < rows.length; i++) {
        const entry = rows[i];
        const rowEl = document.createElement('div');
        rowEl.className = 'score-row-item';
        rowEl.setAttribute('role', 'listitem');
        if (i === 0) rowEl.classList.add('is-top1');
        if (i === highlightIndex || entry.me === true) {
          rowEl.classList.add('is-current');
        }

        const rankEl = document.createElement('span');
        rankEl.className = 'sc-rank';
        rankEl.textContent = '#' + (i + 1);

        const nameEl = document.createElement('span');
        nameEl.className = 'sc-name';
        nameEl.textContent = entry.n ? entry.n : '\u2014';

        const scoreEl = document.createElement('span');
        scoreEl.className = 'sc-score';
        scoreEl.textContent = formatScore(entry.s);

        const levelEl = document.createElement('span');
        levelEl.className = 'sc-level';
        levelEl.textContent = 'Lvl ' + String(entry.w).padStart(2, '0');

        const dateEl = document.createElement('span');
        dateEl.className = 'sc-date';
        dateEl.textContent = Scores.formatDateDisplay(entry.d);

        rowEl.appendChild(rankEl);
        rowEl.appendChild(nameEl);
        rowEl.appendChild(scoreEl);
        rowEl.appendChild(levelEl);
        rowEl.appendChild(dateEl);
        containerEl.appendChild(rowEl);
      }
    }

    function setMsg(el, text) {
      if (text) {
        el.textContent = text;
        el.classList.remove('hidden');
      } else {
        el.textContent = '';
        el.classList.add('hidden');
      }
    }

    function syncTabButtons() {
      const enabled = Scores.isSharedEnabled();
      const activeTab = Scores.getActiveTab();
      ui.hsTabs.classList.toggle('hidden', !enabled);
      ui.goTabs.classList.toggle('hidden', !enabled);

      document.querySelectorAll('[data-score-tab]').forEach((btn) => {
        const isActive = btn.dataset.scoreTab === activeTab;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    }

    function renderHighScoresView() {
      syncTabButtons();
      const tab = Scores.getActiveTab();
      if (tab === 'device' || !Scores.isSharedEnabled()) {
        const list = Scores.loadDeviceScores();
        renderScoresList(ui.hsList, list, -1);
        setMsg(ui.hsMsg, list.length === 0 ? 'No scores yet.' : '');
        return;
      }

      renderScoresList(ui.hsList, hsSharedState.top, -1);
      if (hsSharedState.loading && hsSharedState.top.length === 0) {
        setMsg(ui.hsMsg, 'Fetching the shared list\u2026');
      } else if (hsSharedState.error) {
        setMsg(ui.hsMsg, 'The shared list cannot be reached right now.');
      } else if (hsSharedState.top.length === 0) {
        setMsg(ui.hsMsg, 'No scores yet.');
      } else {
        setMsg(ui.hsMsg, '');
      }
    }

    function renderGameOverView() {
      syncTabButtons();
      const tab = Scores.getActiveTab();
      if (tab === 'device' || !Scores.isSharedEnabled()) {
        const list = Scores.loadDeviceScores();
        const hl = currentRun.deviceListed ? currentRun.deviceIndex : -1;
        renderScoresList(ui.goList, list, hl);
        setMsg(ui.goSharedMsg, list.length === 0 ? 'No scores yet.' : '');
        return;
      }

      renderScoresList(ui.goList, goSharedState.top, -1);
      if (goSharedState.loading && goSharedState.top.length === 0) {
        setMsg(ui.goSharedMsg, 'Fetching the shared list\u2026');
      } else if (goSharedState.error) {
        const suffix = currentRun.deviceListed ? ' Your score is kept on this device.' : '';
        setMsg(ui.goSharedMsg, 'The shared list cannot be reached right now.' + suffix);
      } else if (goSharedState.top.length === 0) {
        setMsg(ui.goSharedMsg, 'No scores yet.');
      } else if (goSharedState.rank > goSharedState.top.length) {
        setMsg(ui.goSharedMsg, `Your score is number ${goSharedState.rank} on the shared list.`);
      } else {
        setMsg(ui.goSharedMsg, '');
      }
    }

    async function fetchSharedForHighScores() {
      if (!Scores.isSharedEnabled()) return;
      hsSharedState = { loading: true, error: false, top: [], rank: 0 };
      renderHighScoresView();
      const res = await Scores.fetchSharedTop();
      if (res.stale || !highScoresOpen) return;
      if (res.ok) {
        hsSharedState = { loading: false, error: false, top: res.top, rank: res.rank };
      } else {
        hsSharedState = { loading: false, error: true, top: [], rank: 0 };
      }
      renderHighScoresView();
    }

    async function fetchSharedForGameOverReadOnly() {
      if (!Scores.isSharedEnabled()) return;
      goSharedState = { loading: true, error: false, top: [], rank: 0, fetched: true };
      renderGameOverView();
      const res = await Scores.fetchSharedTop();
      if (res.stale || game.mode !== 'GAME_OVER') return;
      if (res.ok) {
        goSharedState = { loading: false, error: false, top: res.top, rank: 0, fetched: true };
      } else {
        goSharedState = { loading: false, error: true, top: [], rank: 0, fetched: true };
      }
      renderGameOverView();
    }

    function openHighScores() {
      highScoresOpen = true;
      ui.overlayTitle.classList.add('hidden');
      ui.overlayHighScores.classList.remove('hidden');
      renderHighScoresView();
      if (Scores.isSharedEnabled() && Scores.getActiveTab() === 'shared') {
        fetchSharedForHighScores();
      }
      ui.btnHsBack.focus();
    }

    function closeHighScores() {
      if (!highScoresOpen) return;
      highScoresOpen = false;
      Scores.cancelPendingSharedRequests();
      ui.overlayHighScores.classList.add('hidden');
      if (game.mode === 'TITLE') {
        game.syncBestScore();
        ui.overlayTitle.classList.remove('hidden');
      }
    }

    function handleTabSwitch(tab) {
      Scores.saveActiveTab(tab);
      syncTabButtons();
      if (highScoresOpen) {
        renderHighScoresView();
        if (tab === 'shared') {
          fetchSharedForHighScores();
        }
      } else if (game.mode === 'GAME_OVER') {
        renderGameOverView();
        if (tab === 'shared' && !currentRun.sharedSent && !goSharedState.fetched && !goSharedState.loading) {
          fetchSharedForGameOverReadOnly();
        }
      }
    }

    function handleGameOver(payload) {
      if (renameTimer) {
        clearTimeout(renameTimer);
        renameTimer = null;
      }
      Scores.cancelPendingSharedRequests();

      goSharedState = { loading: false, error: false, top: [], rank: 0, fetched: false };

      const storedInitials = Scores.getStoredInitials();
      const score = Math.round(Number(payload.score) || 0);
      const level = Math.max(1, Math.round(Number(payload.level) || 1));

      const deviceRes = Scores.recordDeviceScore(score, level, storedInitials);
      game.syncBestScore();

      ui.goScore.textContent = formatScore(score);
      ui.goLevel.textContent = `LVL ${String(level).padStart(2, '0')} · ${payload.themeName}`;
      ui.goBadge.textContent = deviceRes.isNewBest ? '\u2605 NEW HIGH SCORE \u2605' : 'SIGNAL LOST';

      ui.goStatusLine.className = 'go-status-line';
      if (deviceRes.isNewBest) {
        ui.goStatusLine.textContent = 'That is your best yet.';
      } else if (deviceRes.listed) {
        ui.goStatusLine.textContent = `That is number ${deviceRes.rank} on this device.`;
      } else if (deviceRes.best > 0) {
        ui.goStatusLine.textContent = `Your best is ${formatScore(deviceRes.best)}.`;
        ui.goStatusLine.classList.add('is-muted');
      } else {
        ui.goStatusLine.textContent = 'Claim territory to set your first score.';
        ui.goStatusLine.classList.add('is-muted');
      }

      const shouldSendShared = Scores.isSharedEnabled() && score > 0;
      const runKey = shouldSendShared ? Scores.generateRunKey() : null;

      currentRun = {
        deviceListed: deviceRes.listed,
        deviceIndex: deviceRes.entryIndex,
        sharedSent: shouldSendShared,
        sharedKey: runKey,
        score,
        level
      };

      const showInitials = deviceRes.listed || shouldSendShared;
      ui.goInitialsWrap.classList.toggle('hidden', !showInitials);
      ui.goInitials.value = storedInitials;

      ui.overlayGameOver.classList.remove('hidden');

      if (shouldSendShared) {
        goSharedState = { loading: true, error: false, top: [], rank: 0, fetched: true };
        renderGameOverView();
        Scores.submitSharedScore({ k: runKey, n: storedInitials, s: score, w: level }).then((res) => {
          if (res.stale || currentRun.sharedKey !== runKey || game.mode !== 'GAME_OVER') return;
          if (res.ok) {
            goSharedState = { loading: false, error: false, top: res.top, rank: res.rank, fetched: true };
          } else {
            goSharedState = { loading: false, error: true, top: [], rank: 0, fetched: true };
          }
          renderGameOverView();
        });
      } else {
        renderGameOverView();
        if (Scores.isSharedEnabled() && Scores.getActiveTab() === 'shared') {
          fetchSharedForGameOverReadOnly();
        }
      }

      if (showInitials && storedInitials === '') {
        ui.goInitials.focus();
      } else {
        ui.btnRetry.focus();
      }
    }

    function startRunClean() {
      highScoresOpen = false;
      if (renameTimer) {
        clearTimeout(renameTimer);
        renameTimer = null;
      }
      Scores.cancelPendingSharedRequests();
      game.startNewGame();
    }

    function leaveToTitle() {
      highScoresOpen = false;
      if (renameTimer) {
        clearTimeout(renameTimer);
        renameTimer = null;
      }
      game.returnToTitle();
    }

    game.onGameOver = handleGameOver;
    syncTabButtons();

    // Responsive canvas sizing locked cleanly to stageFrame
    const handleResize = () => {
      const rect = ui.stageFrame.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        game.renderer.resize(rect.width, rect.height);
      }
    };
    handleResize();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(handleResize);
      ro.observe(ui.stageFrame);
    }
    global.addEventListener('resize', handleResize);

    // Tab buttons ("This device" / "Everyone")
    document.querySelectorAll('[data-score-tab]').forEach((btn) => {
      btn.addEventListener('click', () => handleTabSwitch(btn.dataset.scoreTab));
    });

    // Initials input: strict key isolation, auto-repeat ignored, immediate local save, 700ms shared rename
    ui.goInitials.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.repeat) {
        e.preventDefault();
        return;
      }
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        ui.btnRetry.focus();
      }
    });

    ui.goInitials.addEventListener('input', () => {
      const clean = Scores.sanitizeInitials(ui.goInitials.value);
      if (ui.goInitials.value !== clean) {
        ui.goInitials.value = clean;
      }

      if (currentRun.deviceListed) {
        Scores.updateDeviceEntryInitials(currentRun.deviceIndex, clean);
      } else {
        Scores.saveStoredInitials(clean);
      }

      for (const row of goSharedState.top) {
        if (row.me === true) row.n = clean;
      }
      renderGameOverView();

      if (currentRun.sharedSent && currentRun.sharedKey && Scores.isSharedEnabled()) {
        if (renameTimer) clearTimeout(renameTimer);
        const keyForRename = currentRun.sharedKey;
        const scoreForRename = currentRun.score;
        const levelForRename = currentRun.level;
        renameTimer = setTimeout(() => {
          renameTimer = null;
          if (currentRun.sharedKey !== keyForRename) return;
          Scores.submitSharedScore({
            k: keyForRename,
            n: Scores.getStoredInitials(),
            s: scoreForRename,
            w: levelForRename
          }).then((res) => {
            if (res.stale || currentRun.sharedKey !== keyForRename || game.mode !== 'GAME_OVER') return;
            if (res.ok) {
              goSharedState = { loading: false, error: false, top: res.top, rank: res.rank, fetched: true };
            } else {
              goSharedState = { loading: false, error: true, top: goSharedState.top, rank: goSharedState.rank, fetched: true };
            }
            renderGameOverView();
          });
        }, RENAME_DEBOUNCE_MS);
      }
    });

    // UI Buttons
    ui.btnStart.addEventListener('click', startRunClean);
    ui.btnHighScores.addEventListener('click', openHighScores);
    ui.btnHsBack.addEventListener('click', closeHighScores);
    ui.btnResume.addEventListener('click', () => game.togglePause());
    ui.btnRestartPause.addEventListener('click', startRunClean);
    ui.btnEndRun.addEventListener('click', leaveToTitle);
    ui.btnNextLevel.addEventListener('click', () => game.nextLevel());
    ui.btnRetry.addEventListener('click', startRunClean);
    ui.btnGoTitle.addEventListener('click', leaveToTitle);
    ui.btnSound.addEventListener('click', () => game.toggleSound());
    ui.btnCrt.addEventListener('click', () => game.toggleCRT());
    ui.btnPause.addEventListener('click', () => game.togglePause());

    // Keyboard controls
    const PREVENT_KEYS = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'
    ]);

    global.addEventListener('keydown', (e) => {
      // While typing initials, isolate all game shortcuts completely
      if (document.activeElement === ui.goInitials) {
        if (e.repeat) {
          e.preventDefault();
          return;
        }
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          ui.btnRetry.focus();
        }
        return;
      }

      if (PREVENT_KEYS.has(e.code)) {
        e.preventDefault();
      }
      game.keys.add(e.code);

      if (e.repeat) return;

      // High-scores overlay: Escape or Enter closes it and must NOT start a game
      if (highScoresOpen) {
        if (e.code === 'Escape' || e.code === 'Enter') {
          e.preventDefault();
          closeHighScores();
        }
        return;
      }

      // Global shortcuts
      if (e.code === 'KeyM') {
        game.toggleSound();
        return;
      }
      if (e.code === 'KeyC') {
        game.toggleCRT();
        return;
      }
      if (e.code === 'Escape') {
        if (game.mode === 'PLAYING' || game.mode === 'PAUSED') {
          game.togglePause();
        } else if (game.mode === 'GAME_OVER') {
          e.preventDefault();
          leaveToTitle();
        }
        return;
      }
      if (e.code === 'KeyP') {
        if (game.mode === 'PLAYING' || game.mode === 'PAUSED') {
          game.togglePause();
        }
        return;
      }

      // Confirm / Start / Advance shortcuts
      if (e.code === 'Space' || e.code === 'Enter') {
        if (game.mode === 'TITLE') {
          if (e.code === 'Enter' && document.activeElement && document.activeElement.tagName === 'BUTTON' && document.activeElement !== ui.btnStart) {
            return;
          }
          startRunClean();
        } else if (game.mode === 'GAME_OVER') {
          if (e.code === 'Enter' && document.activeElement && document.activeElement.tagName === 'BUTTON' && document.activeElement !== ui.btnRetry) {
            return;
          }
          startRunClean();
        } else if (game.mode === 'LEVEL_CLEAR') {
          game.nextLevel();
        }
      }
    });

    global.addEventListener('keyup', (e) => {
      if (document.activeElement === ui.goInitials) return;
      game.keys.delete(e.code);
    });

    // Clear stuck keys when window loses focus
    global.addEventListener('blur', () => {
      game.keys.clear();
    });

    // Start the high-FPS render & simulation loop!
    game.startLoop();
  });
})(window);
