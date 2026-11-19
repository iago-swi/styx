/* ==========================================================================
   STYX // Core Game Controller & State Machine
   Manages 120Hz fixed-timestep simulation, multiplier timing, scoring,
   level progression, high scores, and HUD synchronization.
   ========================================================================== */

(function (global) {
  'use strict';

  const STYX = (global.STYX = global.STYX || {});

  const STORAGE_KEY_HI = 'styx_neon_abyss_highscore_v1';

  const MULT_STAGES = [
    { value: 1, name: 'PRISM', duration: 5.5, cssClass: 'mult-1', color: '#2cf6ff' },
    { value: 5, name: 'PLASMA', duration: 3.6, cssClass: 'mult-5', color: '#ff36c8' },
    { value: 10, name: 'SOLAR', duration: 2.4, cssClass: 'mult-10', color: '#ffcc33' }
  ];

  class StyxGame {
    constructor(ui) {
      this.ui = ui;
      this.grid = new STYX.PlayfieldGrid(320, 200);
      this.fx = new STYX.FXSystem(this.grid.W, this.grid.H);
      this.audio = new STYX.SoundEngine();
      this.renderer = new STYX.StyxRenderer(ui.glCanvas, ui.uiCanvas, this.grid.W, this.grid.H);

      this.player = new STYX.Player(this.grid);
      this.styxList = [];
      this.caterpillars = [];

      // State: 'TITLE' | 'PLAYING' | 'PAUSED' | 'DYING' | 'LEVEL_CLEAR' | 'GAME_OVER'
      this.mode = 'TITLE';
      this.level = 1;
      this.theme = STYX.getTheme(1);
      this.config = STYX.getLevelConfig(1);

      this.score = 0;
      this.displayScore = 0;
      this.highScore = this._loadHighScore();
      this.nextExtraLifeScore = 50000;
      this.lives = 3;
      this.maxLives = 5;
      this.crushedThisLevel = 0;
      this.splitAwarded = false;

      // Multiplier cycle state
      this.multIdx = 0;
      this.multTimer = MULT_STAGES[0].duration;

      // Timers
      this.deathTimer = 0;
      this.toastTimer = 0;
      this.fuseToastShown = false;

      // Input state
      this.keys = new Set();

      // Fixed-step loop accumulator
      this.lastFrameTime = 0;
      this.accum = 0;
      this.fixedDt = 1 / 120;

      // Initialize title attract scene
      this._setupAttractScene();
      this._syncHUD(true);
      this._updateStatusBadge();
    }

    _loadHighScore() {
      try {
        const val = parseInt(global.localStorage.getItem(STORAGE_KEY_HI) || '0', 10);
        return Number.isFinite(val) ? val : 0;
      } catch (e) {
        return 0;
      }
    }

    _saveHighScore(val) {
      try {
        global.localStorage.setItem(STORAGE_KEY_HI, String(val));
      } catch (e) {
        // Ignore storage errors
      }
    }

    _updateStatusBadge() {
      if (this.ui.fpsBadge) {
        this.ui.fpsBadge.textContent = this.renderer.useWebGL ? 'WEBGL2 HDR BLOOM' : 'CANVAS2D HD';
      }
    }

    _setupAttractScene() {
      this.theme = STYX.getTheme(1);
      this.grid.reset();
      this.styxList = [
        new STYX.StyxEntity(this.grid, 160, 100, 0.95, 0, false)
      ];
      this.caterpillars = [
        new STYX.Caterpillar(this.grid, 40, 0, 0, 1, 14, 0.85),
        new STYX.Caterpillar(this.grid, 280, 199, 4, 1, 14, 0.85)
      ];
    }

    startNewGame() {
      this.audio.init();
      this.score = 0;
      this.displayScore = 0;
      this.lives = 3;
      this.nextExtraLifeScore = 50000;
      this.level = 1;
      this._startLevel(1);
    }

    _startLevel(levelNum) {
      this.level = levelNum;
      this.config = STYX.getLevelConfig(levelNum);
      this.theme = this.config.theme;
      this.audio.setTheme(this.theme);

      this.grid.reset();
      this.fx.particles.length = 0;
      this.fx.rings.length = 0;
      this.fx.texts.length = 0;
      this.crushedThisLevel = 0;
      this.splitAwarded = false;
      this.fuseToastShown = false;

      // Reset multiplier cycle
      this.multIdx = 0;
      this.multTimer = MULT_STAGES[0].duration;

      // Place player at bottom-center border
      this.player.resetToSafeBorder();

      // Spawn Styx creature(s) in center open arena
      this.styxList = [];
      if (this.config.styxCount === 1) {
        this.styxList.push(
          new STYX.StyxEntity(this.grid, 160, 92, this.config.styxSpeed, 0, false)
        );
      } else {
        this.styxList.push(
          new STYX.StyxEntity(this.grid, 105, 88, this.config.styxSpeed * 0.96, 0, true),
          new STYX.StyxEntity(this.grid, 215, 108, this.config.styxSpeed * 0.96, 2.4, true)
        );
      }

      // Spawn edge-crawling caterpillars distributed along top & side borders (far from player!)
      this.caterpillars = [];
      const spawns = [
        { x: 160, y: 0, dir: 0, sign: 1 },
        { x: 160, y: 0, dir: 4, sign: -1 },
        { x: 0, y: 65, dir: 6, sign: 1 },
        { x: 319, y: 65, dir: 6, sign: -1 }
      ];
      for (let i = 0; i < this.config.caterpillarCount; i++) {
        const sp = spawns[i % spawns.length];
        this.caterpillars.push(
          new STYX.Caterpillar(
            this.grid,
            sp.x,
            sp.y,
            sp.dir,
            sp.sign,
            this.config.caterpillarLength,
            this.config.caterpillarSpeed
          )
        );
      }

      this.mode = 'PLAYING';
      this._hideAllOverlays();
      this._syncHUD(true);
      this._showToast(`LVL ${String(levelNum).padStart(2, '0')} // ${this.theme.name}`, false, 2.0);
      this.fx.emitRing(160, 100, 95, this.theme.playerColor, 0.75);
    }

    nextLevel() {
      if (this.mode !== 'LEVEL_CLEAR') return;
      this.audio.init();
      this._startLevel(this.level + 1);
    }

    togglePause() {
      if (this.mode === 'PLAYING') {
        this.mode = 'PAUSED';
        this.ui.overlayPause.classList.remove('hidden');
      } else if (this.mode === 'PAUSED') {
        this.mode = 'PLAYING';
        this.ui.overlayPause.classList.add('hidden');
      }
    }

    toggleCRT() {
      this.renderer.crtEnabled = !this.renderer.crtEnabled;
      this.ui.btnCrt.classList.toggle('active', this.renderer.crtEnabled);
      this._showToast(this.renderer.crtEnabled ? '1983 CRT PHOSPHOR ON' : 'CRT PHOSPHOR OFF', false, 1.2);
    }

    toggleSound() {
      this.audio.init();
      const muted = this.audio.toggleMute();
      this.ui.iconSoundOn.classList.toggle('hidden', muted);
      this.ui.iconSoundOff.classList.toggle('hidden', !muted);
    }

    _hideAllOverlays() {
      this.ui.overlayTitle.classList.add('hidden');
      this.ui.overlayPause.classList.add('hidden');
      this.ui.overlayClear.classList.add('hidden');
      this.ui.overlayGameOver.classList.add('hidden');
    }

    _showToast(message, isDanger = false, duration = 1.6) {
      const el = this.ui.toast;
      el.textContent = message;
      el.classList.toggle('danger', isDanger);
      el.classList.remove('hidden');
      this.toastTimer = duration;
    }

    _getInputVector() {
      let x = 0;
      let y = 0;
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) x -= 1;
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) x += 1;
      if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) y -= 1;
      if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) y += 1;
      const precision = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
      return { x, y, precision };
    }

    _addScore(points) {
      if (points <= 0) return;
      this.score += points;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        this._saveHighScore(this.highScore);
      }
      // Extra life milestone
      if (this.score >= this.nextExtraLifeScore) {
        this.nextExtraLifeScore += 50000;
        if (this.lives < this.maxLives) {
          this.lives++;
          this._showToast('EXTRA LIFE AWARDED!', false, 2.0);
          this._renderLives();
        }
      }
    }

    // ------------------------------------------------------------------------
    // MAIN ANIMATION LOOP
    // ------------------------------------------------------------------------
    startLoop() {
      this.lastFrameTime = performance.now();
      const tick = (now) => {
        const rawDt = Math.min(0.05, Math.max(0, (now - this.lastFrameTime) / 1000));
        this.lastFrameTime = now;

        this._update(rawDt);
        this._render(rawDt);

        global.requestAnimationFrame(tick);
      };
      global.requestAnimationFrame(tick);
    }

    _update(dt) {
      // Toast expiration
      if (this.toastTimer > 0) {
        this.toastTimer -= dt;
        if (this.toastTimer <= 0) {
          this.ui.toast.classList.add('hidden');
        }
      }

      // Smooth rolling score odometer
      if (this.displayScore < this.score) {
        const diff = this.score - this.displayScore;
        this.displayScore += Math.max(1, Math.ceil(diff * Math.min(1, dt * 14)));
        if (this.displayScore > this.score) this.displayScore = this.score;
        this.ui.hudScore.textContent = String(this.displayScore).padStart(6, '0');
        this.ui.hudHigh.textContent = String(this.highScore).padStart(6, '0');
      }

      if (this.mode === 'PAUSED') {
        this.audio.update(dt, false, false, 0, false);
        return;
      }

      // Title screen & end screens keep background creatures gliding hypnotically
      if (this.mode === 'TITLE' || this.mode === 'LEVEL_CLEAR' || this.mode === 'GAME_OVER') {
        for (let i = 0; i < this.styxList.length; i++) {
          this.styxList[i].update(dt, null, this.fx);
        }
        for (let i = 0; i < this.caterpillars.length; i++) {
          this.caterpillars[i].update(dt);
        }
        this.grid.updateFlash(dt);
        this.fx.update(dt, this.styxList);
        this.audio.update(dt, false, false, 0, false);
        return;
      }

      if (this.mode === 'DYING') {
        this.deathTimer -= dt;
        for (let i = 0; i < this.styxList.length; i++) {
          this.styxList[i].update(dt * 0.35, null, this.fx);
        }
        this.grid.updateFlash(dt);
        this.fx.update(dt, this.styxList);
        this.audio.update(dt, false, false, 0, false);

        if (this.deathTimer <= 0) {
          this._finishDeathSequence();
        }
        return;
      }

      // === MODE: PLAYING (120Hz Fixed-Timestep Simulation) ===
      this.accum += dt;
      while (this.accum >= this.fixedDt) {
        this._fixedUpdate(this.fixedDt);
        this.accum -= this.fixedDt;
        if (this.mode !== 'PLAYING') break;
      }

      this.grid.updateFlash(dt);
      this.fx.update(dt, this.styxList);
      this.audio.update(
        dt,
        true,
        this.player.state === 'DRAWING',
        this.player.trail.length,
        this.player.fuseActive
      );

      // Update live multiplier countdown ring
      this._updateMultiplierUI();
    }

    _fixedUpdate(dt) {
      // 1. Cycle multiplier timer (x1 -> x5 -> x10)
      this.multTimer -= dt;
      if (this.multTimer <= 0) {
        this.multIdx = (this.multIdx + 1) % MULT_STAGES.length;
        const stage = MULT_STAGES[this.multIdx];
        this.multTimer = stage.duration;
        this._applyMultiplierStyle(stage);
        this.audio.playMultiplierShift(stage.value);
      }

      // 2. Player movement & loop closure check
      const input = this._getInputVector();
      const playerEvt = this.player.update(dt, input.x, input.y, input.precision, this.fx);

      if (this.player.fuseActive && !this.fuseToastShown) {
        this.fuseToastShown = true;
        this._showToast('⚡ PLASMA FUSE LIT — MOVE!', true, 1.4);
      } else if (!this.player.fuseActive) {
        this.fuseToastShown = false;
      }

      if (playerEvt) {
        if (playerEvt.type === 'FUSE_KILL') {
          this._triggerDeath('PLASMA FUSE');
          return;
        }
        if (playerEvt.type === 'CLAIM') {
          this._handleTerritoryClaim(playerEvt);
          if (this.mode !== 'PLAYING') return;
        }
      }

      // 3. Update Styx creatures & test trail/player collisions
      for (let i = 0; i < this.styxList.length; i++) {
        const styx = this.styxList[i];
        styx.update(dt, this.player, this.fx);
        if (styx.hitsPlayerOrTrail(this.player)) {
          this._triggerDeath('STYX STRIKE');
          return;
        }
      }

      // 4. Update edge-crawling caterpillars & test border collisions
      for (let i = 0; i < this.caterpillars.length; i++) {
        const cat = this.caterpillars[i];
        cat.update(dt);
        if (cat.hitsPlayer(this.player)) {
          this._triggerDeath('CATERPILLAR');
          return;
        }
      }
    }

    _handleTerritoryClaim(evt) {
      const stage = MULT_STAGES[this.multIdx];
      const mult = stage.value;

      const result = this.grid.commitTrail(
        evt.trail,
        this.styxList,
        mult,
        evt.closeX,
        evt.closeY
      );

      // Ensure player stands on a valid active border cell after interior cleanup
      const safeP = this.grid.findNearestBorder(this.player.x, this.player.y, 24);
      this.player.x = safeP.x;
      this.player.y = safeP.y;

      // Keep all Styx nodes cleanly inside empty arena
      for (let i = 0; i < this.styxList.length; i++) {
        this.styxList[i].keepInsideEmpty();
      }

      // Score calculation: classic 100 pts per 1% * multiplier (0.1% granularity)
      const areaPoints = Math.max(10 * mult, Math.round(result.deltaPercent * 100) * mult);
      this._addScore(areaPoints);

      // Visual & Audio Spectacle scaled to claim size & multiplier!
      this.audio.playClaim(result.deltaPercent, mult);

      const burstCount = Math.min(95, Math.round(18 + result.deltaPercent * 3.8));
      this.fx.emitBurst(result.centroidX, result.centroidY, burstCount, stage.color, 95, true);
      this.fx.emitRing(result.centroidX, result.centroidY, 22 + result.deltaPercent * 2.4, stage.color, 0.62);

      if (result.deltaPercent >= 6 || mult === 10) {
        const shockStr = Math.min(1.4, 0.55 + result.deltaPercent * 0.045 + (mult === 10 ? 0.3 : 0));
        this.fx.triggerShockwave(result.centroidX, result.centroidY, shockStr);
      }

      // Floating holographic score popup
      if (result.deltaPercent >= 0.4) {
        const pctLabel = `+${result.deltaPercent.toFixed(1)}%${mult > 1 ? ` · ×${mult}` : ''}`;
        this.fx.addFloatingText(
          result.centroidX,
          result.centroidY,
          `+${areaPoints.toLocaleString()}`,
          pctLabel,
          stage.color,
          mult === 10 ? 1.25 : mult === 5 ? 1.12 : 0.96
        );
      }

      // Check if any caterpillars got trapped & crushed inside newly claimed territory!
      for (let i = 0; i < this.caterpillars.length; i++) {
        const cat = this.caterpillars[i];
        if (cat.checkTrappedAfterClaim()) {
          this.crushedThisLevel++;
          const crushBonus = 2500 * mult;
          this._addScore(crushBonus);
          this.audio.playCaterpillarCrush();
          this.fx.emitBurst(cat.x, cat.y, 75, '#ffcc33', 120, true);
          this.fx.emitRing(cat.x, cat.y, 45, '#ffaa22', 0.7);
          this.fx.triggerShockwave(cat.x, cat.y, 1.0);
          this.fx.addFloatingText(cat.x, cat.y, `+${crushBonus.toLocaleString()}`, 'CRAWLER CRUSHED!', '#ffcc33', 1.2);
          this._showToast(`CATERPILLAR CRUSHED! +${crushBonus.toLocaleString()}`, false, 1.8);
        }
      }

      // Check Styx Split bonus on multi-Styx levels
      if (result.splitDetected && !this.splitAwarded) {
        this.splitAwarded = true;
        const splitBonus = 5000;
        this._addScore(splitBonus);
        this._showToast('STYX SPLIT BONUS! +5,000', false, 2.2);
        this.fx.triggerShockwave(evt.closeX, evt.closeY, 1.25);
      }

      this._syncHUD(false);

      // Check Level Clear (>= 80% claimed!)
      if (result.totalPercent >= this.config.targetPct) {
        this._triggerLevelClear(result.totalPercent);
      }
    }

    _triggerDeath(reason) {
      this.mode = 'DYING';
      this.deathTimer = 1.05;
      this.player.alive = false;
      this.audio.playDeath();

      // Shatter explosion along player & active trail
      this.fx.emitBurst(this.player.x, this.player.y, 85, '#ff3366', 125, true);
      this.fx.emitBurst(this.player.x, this.player.y, 35, '#ffffff', 75, false);
      this.fx.emitRing(this.player.x, this.player.y, 58, '#ff3366', 0.65);
      this.fx.triggerShockwave(this.player.x, this.player.y, 1.35);

      if (this.player.trail.length > 0) {
        const step = Math.max(1, Math.floor(this.player.trail.length / 26));
        for (let i = 0; i < this.player.trail.length; i += step) {
          const p = this.player.trail[i];
          this.fx.emitBurst(p.x, p.y, 4, '#ff6644', 55, false);
        }
      }

      this._showToast(reason + '!', true, 1.0);
    }

    _finishDeathSequence() {
      this.lives--;
      this.player.abortTrail();
      this._renderLives();

      if (this.lives <= 0) {
        this.mode = 'GAME_OVER';
        this.ui.goScore.textContent = this.score.toLocaleString();
        this.ui.goHigh.textContent = this.highScore.toLocaleString();
        this.ui.goLevel.textContent = `LVL ${String(this.level).padStart(2, '0')} · ${this.theme.name}`;
        this.ui.goBadge.textContent = (this.score >= this.highScore && this.score > 0)
          ? '★ NEW HIGH SCORE ★'
          : 'SIGNAL LOST';
        this.ui.overlayGameOver.classList.remove('hidden');
      } else {
        // Respawn cleanly on safe border with protective shield
        this.player.alive = true;
        this.player.shieldTimer = 2.2;
        this.mode = 'PLAYING';
        this.fx.emitRing(this.player.x, this.player.y, 26, '#2cf6ff', 0.45);
      }
    }

    _triggerLevelClear(finalPct) {
      this.mode = 'LEVEL_CLEAR';
      this.audio.playLevelClear();

      // Classic 1983 Styx rule: +1,000 bonus per full percentage point over 80%!
      const extraPointsPct = Math.max(0, Math.floor(finalPct - this.config.targetPct));
      const overBonus = extraPointsPct * 1000;
      this._addScore(overBonus);

      // Celebratory fireworks across the board
      this.fx.triggerShockwave(160, 100, 1.3);
      for (let i = 0; i < 4; i++) {
        const bx = 60 + i * 66;
        const by = 60 + (i % 2) * 75;
        this.fx.emitBurst(bx, by, 45, i % 2 === 0 ? '#ffcc33' : '#2cf6ff', 100, true);
        this.fx.emitRing(bx, by, 42, '#ffffff', 0.75);
      }

      this.ui.clearHeading.textContent = `LEVEL ${String(this.level).padStart(2, '0')} COMPLETE`;
      this.ui.clearPct.textContent = `${finalPct.toFixed(1)}%`;
      this.ui.clearOverBonus.textContent = `+${overBonus.toLocaleString()}`;
      this.ui.clearCrushed.textContent = String(this.crushedThisLevel);
      this.ui.clearTotal.textContent = this.score.toLocaleString();
      this.ui.overlayClear.classList.remove('hidden');
      this._syncHUD(true);
    }

    // ------------------------------------------------------------------------
    // HUD SYNCHRONIZATION
    // ------------------------------------------------------------------------
    _syncHUD(full = false) {
      const pct = this.grid.claimedPercent;
      this.ui.hudClaimed.textContent = `${pct.toFixed(1)}%`;
      this.ui.hudProgressFill.style.width = `${Math.min(100, pct).toFixed(2)}%`;
      this.ui.hudProgressFill.classList.toggle('near-goal', pct >= 65);

      this.ui.hudScore.textContent = String(this.displayScore).padStart(6, '0');
      this.ui.hudHigh.textContent = String(this.highScore).padStart(6, '0');

      if (full) {
        this.ui.hudLevel.textContent = String(this.level).padStart(2, '0');
        this.ui.hudRealm.textContent = this.theme.name;
        this._applyMultiplierStyle(MULT_STAGES[this.multIdx]);
        this._renderLives();
      }
    }

    _applyMultiplierStyle(stage) {
      const badge = this.ui.multBadge;
      badge.classList.remove('mult-1', 'mult-5', 'mult-10', 'pulse');
      badge.classList.add(stage.cssClass);
      void badge.offsetWidth; // trigger smooth pulse transition
      badge.classList.add('pulse');
      setTimeout(() => badge.classList.remove('pulse'), 220);

      this.ui.hudMult.textContent = `×${stage.value}`;
      this.ui.hudMultName.textContent = stage.name;
      this.ui.hudMultName.style.color = stage.color;
    }

    _updateMultiplierUI() {
      const stage = MULT_STAGES[this.multIdx];
      const frac = Math.max(0, Math.min(1, this.multTimer / stage.duration));
      const circumference = 119.38;
      this.ui.multRingArc.style.strokeDashoffset = (circumference * (1 - frac)).toFixed(2);
    }

    _renderLives() {
      const tray = this.ui.hudLives;
      tray.innerHTML = '';
      const totalIcons = Math.max(3, this.lives);
      for (let i = 0; i < totalIcons; i++) {
        const gem = document.createElement('span');
        gem.className = 'life-gem' + (i >= this.lives ? ' lost' : '');
        tray.appendChild(gem);
      }
    }

    _render(dt) {
      this.renderer.render(dt, {
        grid: this.grid,
        player: this.player,
        styxList: this.styxList,
        caterpillars: this.caterpillars,
        fx: this.fx,
        theme: this.theme,
        multiplier: MULT_STAGES[this.multIdx].value,
        demoMode: this.mode === 'TITLE'
      });
    }
  }

  STYX.StyxGame = StyxGame;
})(window);
