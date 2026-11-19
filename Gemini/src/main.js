/* ==========================================================================
   STYX // Bootstrapper, Responsive Stage Sizing & Input Bindings
   ========================================================================== */

(function (global) {
  'use strict';

  const STYX = (global.STYX = global.STYX || {});

  document.addEventListener('DOMContentLoaded', () => {
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
      overlayPause: document.getElementById('overlay-pause'),
      overlayClear: document.getElementById('overlay-clear'),
      overlayGameOver: document.getElementById('overlay-gameover'),

      btnStart: document.getElementById('btn-start'),
      btnResume: document.getElementById('btn-resume'),
      btnRestartPause: document.getElementById('btn-restart-pause'),
      btnNextLevel: document.getElementById('btn-next-level'),
      btnRetry: document.getElementById('btn-retry'),

      clearHeading: document.getElementById('clear-heading'),
      clearPct: document.getElementById('clear-pct'),
      clearOverBonus: document.getElementById('clear-over-bonus'),
      clearCrushed: document.getElementById('clear-crushed'),
      clearTotal: document.getElementById('clear-total'),

      goBadge: document.getElementById('gameover-badge'),
      goScore: document.getElementById('go-score'),
      goHigh: document.getElementById('go-high'),
      goLevel: document.getElementById('go-level')
    };

    const game = new STYX.StyxGame(ui);
    global.__STYX_GAME__ = game;

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

    // UI Buttons
    ui.btnStart.addEventListener('click', () => game.startNewGame());
    ui.btnResume.addEventListener('click', () => game.togglePause());
    ui.btnRestartPause.addEventListener('click', () => game.startNewGame());
    ui.btnNextLevel.addEventListener('click', () => game.nextLevel());
    ui.btnRetry.addEventListener('click', () => game.startNewGame());
    ui.btnSound.addEventListener('click', () => game.toggleSound());
    ui.btnCrt.addEventListener('click', () => game.toggleCRT());
    ui.btnPause.addEventListener('click', () => game.togglePause());

    // Keyboard controls
    const PREVENT_KEYS = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'
    ]);

    global.addEventListener('keydown', (e) => {
      if (PREVENT_KEYS.has(e.code)) {
        e.preventDefault();
      }
      game.keys.add(e.code);

      if (e.repeat) return;

      // Global shortcuts
      if (e.code === 'KeyM') {
        game.toggleSound();
        return;
      }
      if (e.code === 'KeyC') {
        game.toggleCRT();
        return;
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (game.mode === 'PLAYING' || game.mode === 'PAUSED') {
          game.togglePause();
        }
        return;
      }

      // Confirm / Start / Advance shortcuts
      if (e.code === 'Space' || e.code === 'Enter') {
        if (game.mode === 'TITLE' || game.mode === 'GAME_OVER') {
          game.startNewGame();
        } else if (game.mode === 'LEVEL_CLEAR') {
          game.nextLevel();
        }
      }
    });

    global.addEventListener('keyup', (e) => {
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
