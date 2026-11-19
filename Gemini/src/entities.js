/* ==========================================================================
   STYX // Entities: Player, Multi-Ribbon Styx Creature, Border Caterpillars,
   and High-Density Additive Particle & Floating Text FX System
   ========================================================================== */

(function (global) {
  'use strict';

  const STYX = (global.STYX = global.STYX || {});

  // --------------------------------------------------------------------------
  // PLAYER
  // --------------------------------------------------------------------------
  class Player {
    constructor(grid) {
      this.grid = grid;
      this.x = Math.floor(grid.W / 2);
      this.y = grid.H - 1;
      this.vx = this.x;
      this.vy = this.y;
      this.state = 'BORDER'; // 'BORDER' | 'DRAWING'
      this.trail = [];       // Array of {x, y} grid cells
      this.moveAccum = 0;
      this.lastDirX = 0;
      this.lastDirY = 0;
      this.ledgeGrace = 0;

      // Idle Fuse mechanic
      this.idleTime = 0;
      this.fuseActive = false;
      this.fuseProgress = 0; // Floating index into trail[]

      // Respawn invulnerability shield
      this.shieldTimer = 1.8;
      this.orbitAngle = 0;
      this.alive = true;
    }

    resetToSafeBorder() {
      const safe = this.grid.findNearestBorder(Math.floor(this.grid.W / 2), this.grid.H - 1, 160);
      this.x = safe.x;
      this.y = safe.y;
      this.vx = safe.x;
      this.vy = safe.y;
      this.state = 'BORDER';
      this.trail.length = 0;
      this.moveAccum = 0;
      this.ledgeGrace = 0;
      this.idleTime = 0;
      this.fuseActive = false;
      this.fuseProgress = 0;
      this.shieldTimer = 2.0;
      this.alive = true;
    }

    abortTrail() {
      if (this.trail.length > 0) {
        const origin = this.trail[0];
        this.grid.clearTrail(this.trail);
        this.trail.length = 0;
        const safe = this.grid.findNearestBorder(origin.x, origin.y, 40);
        this.x = safe.x;
        this.y = safe.y;
        this.vx = safe.x;
        this.vy = safe.y;
      }
      this.state = 'BORDER';
      this.idleTime = 0;
      this.fuseActive = false;
      this.fuseProgress = 0;
      this.ledgeGrace = 0;
    }

    /**
     * Fixed-timestep update.
     * Returns an event object if a loop was closed or fuse caught the player:
     *   { type: 'CLAIM', closeX, closeY, trail } | { type: 'FUSE_KILL' } | null
     */
    update(dt, inputX, inputY, precisionHeld, fx) {
      this.orbitAngle += dt * (this.state === 'DRAWING' ? 7.5 : 3.8);
      if (this.shieldTimer > 0) this.shieldTimer = Math.max(0, this.shieldTimer - dt);

      const hasInput = inputX !== 0 || inputY !== 0;

      // Update Fuse when drawing
      if (this.state === 'DRAWING') {
        if (!hasInput) {
          this.idleTime += dt;
          if (this.idleTime >= 0.40 && !this.fuseActive && this.trail.length > 2) {
            this.fuseActive = true;
            this.fuseProgress = 0;
          }
        } else {
          this.idleTime = Math.max(0, this.idleTime - dt * 2.5);
        }

        if (this.fuseActive) {
          // Moves swiftly when stalled, slower when player resumes moving
          const fuseSpeed = hasInput ? 42 : 76;
          this.fuseProgress += fuseSpeed * dt;

          // Emit sizzling sparks at fuse tip
          const fi = Math.min(this.trail.length - 1, Math.floor(this.fuseProgress));
          const fp = this.trail[fi];
          if (fp && Math.random() < 0.75) {
            fx.emitSpark(fp.x, fp.y, (Math.random() - 0.5) * 90, (Math.random() - 0.5) * 90, '#ffaa22', 0.28);
          }

          if (this.fuseProgress >= this.trail.length - 1) {
            return { type: 'FUSE_KILL' };
          }
        }
      } else {
        this.idleTime = 0;
        this.fuseActive = false;
        this.fuseProgress = 0;
      }

      if (!hasInput) {
        this.ledgeGrace = 0;
        this.moveAccum = Math.min(this.moveAccum, 0.2);
        this.vx += (this.x - this.vx) * Math.min(1, dt * 28);
        this.vy += (this.y - this.vy) * Math.min(1, dt * 28);
        return null;
      }

      const isDiag = inputX !== 0 && inputY !== 0;
      const baseSpeed = this.state === 'BORDER' ? 92 : 80;
      const speedMult = precisionHeld ? 0.52 : 1.0;
      const stepRate = (baseSpeed * speedMult) / (isDiag ? Math.SQRT2 : 1.0);

      this.moveAccum += stepRate * dt;
      // Cap steps per tick
      const maxSteps = 4;
      let steps = 0;

      while (this.moveAccum >= 1.0 && steps < maxSteps) {
        const res = this._tryStep(inputX, inputY, dt, fx);
        if (res) {
          this.moveAccum = 0;
          this.vx = this.x;
          this.vy = this.y;
          return res;
        }
        this.moveAccum -= 1.0;
        steps++;
      }

      // Smooth visual interpolation
      this.vx += (this.x - this.vx) * Math.min(1, dt * 36);
      this.vy += (this.y - this.vy) * Math.min(1, dt * 36);
      return null;
    }

    _tryStep(dx, dy, dt, fx) {
      const grid = this.grid;
      let nx = this.x + dx;
      let ny = this.y + dy;

      if (!grid.inBounds(nx, ny)) {
        this.ledgeGrace = 0;
        return null;
      }

      if (this.state === 'BORDER') {
        const targetCell = grid.get(nx, ny);

        // 1. Direct step onto another BORDER cell
        if (targetCell === STYX.CELL.BORDER) {
          this.x = nx;
          this.y = ny;
          this.lastDirX = dx;
          this.lastDirY = dy;
          this.ledgeGrace = 0;
          return null;
        }

        // 2. Smart border-hugging: if pressing cardinal along a diagonal/stepped border
        if (dx === 0 || dy === 0) {
          const alt1X = this.x + dx + (dy !== 0 ? 1 : 0);
          const alt1Y = this.y + dy + (dx !== 0 ? 1 : 0);
          const alt2X = this.x + dx - (dy !== 0 ? 1 : 0);
          const alt2Y = this.y + dy - (dx !== 0 ? 1 : 0);
          const b1 = grid.isBorder(alt1X, alt1Y);
          const b2 = grid.isBorder(alt2X, alt2Y);

          // If target isn't empty (it's claimed wall), slide along diagonal border if available
          if (targetCell !== STYX.CELL.EMPTY) {
            if (b1 && !b2) {
              this.x = alt1X;
              this.y = alt1Y;
              this.ledgeGrace = 0;
              return null;
            }
            if (b2 && !b1) {
              this.x = alt2X;
              this.y = alt2Y;
              this.ledgeGrace = 0;
              return null;
            }
            return null;
          }
        } else {
          // Pressing diagonal into claimed interior? Slide along whichever orthogonal neighbor is BORDER
          if (targetCell !== STYX.CELL.EMPTY) {
            const bx = grid.isBorder(this.x + dx, this.y);
            const by = grid.isBorder(this.x, this.y + dy);
            if (bx && !by) {
              this.x += dx;
              return null;
            }
            if (by && !bx) {
              this.y += dy;
              return null;
            }
            return null;
          }
        }

        // 3. Stepping from BORDER into EMPTY -> Launch active trail!
        if (targetCell === STYX.CELL.EMPTY) {
          // Ledge-grace: if sliding straight along an edge and hitting a sudden drop-off
          // while holding the EXACT same parallel key, pause briefly so player doesn't accidentally fly off
          const sameHeading = (dx === this.lastDirX && dy === this.lastDirY);
          const hasPerpBorder = (dx !== 0 && dy === 0 && (grid.isBorder(this.x, this.y - 1) || grid.isBorder(this.x, this.y + 1)))
            || (dy !== 0 && dx === 0 && (grid.isBorder(this.x - 1, this.y) || grid.isBorder(this.x + 1, this.y)));

          if (sameHeading && hasPerpBorder && this.ledgeGrace < 0.09) {
            this.ledgeGrace += dt * 1.4;
            return null;
          }

          this.ledgeGrace = 0;
          this.state = 'DRAWING';
          this.trail.length = 0;
          this.trail.push({ x: this.x, y: this.y }); // Anchor on border
          this.x = nx;
          this.y = ny;
          grid.setTrail(nx, ny);
          this.trail.push({ x: nx, y: ny });
          this.lastDirX = dx;
          this.lastDirY = dy;
          fx.emitBurst(nx, ny, 8, '#2cf6ff', 55);
          return null;
        }

        return null;
      }

      // === STATE: DRAWING ===
      const targetCell = grid.get(nx, ny);

      // Cannot cross own trail or enter already-claimed interior directly
      if (targetCell === STYX.CELL.TRAIL) {
        return null;
      }

      // Prevent diagonal squeezing cleanly across own trail or tight corners
      if (dx !== 0 && dy !== 0) {
        const c1 = grid.get(this.x + dx, this.y);
        const c2 = grid.get(this.x, this.y + dy);
        if (c1 === STYX.CELL.TRAIL && c2 === STYX.CELL.TRAIL) {
          return null;
        }
        // If one side of a diagonal step touches BORDER, snap directly to that BORDER to close cleanly!
        if (targetCell !== STYX.CELL.BORDER && (c1 === STYX.CELL.BORDER || c2 === STYX.CELL.BORDER) && this.trail.length > 3) {
          if (c1 === STYX.CELL.BORDER && c2 !== STYX.CELL.EMPTY) {
            nx = this.x + dx;
            ny = this.y;
          } else if (c2 === STYX.CELL.BORDER && c1 !== STYX.CELL.EMPTY) {
            nx = this.x;
            ny = this.y + dy;
          }
        }
      }

      const resolvedCell = grid.get(nx, ny);

      if (resolvedCell === STYX.CELL.EMPTY) {
        this.x = nx;
        this.y = ny;
        grid.setTrail(nx, ny);
        this.trail.push({ x: nx, y: ny });
        this.lastDirX = dx;
        this.lastDirY = dy;

        if (Math.random() < 0.35) {
          fx.emitSpark(nx, ny, -dx * 22 + (Math.random() - 0.5) * 18, -dy * 22 + (Math.random() - 0.5) * 18, '#66f9ff', 0.22);
        }
        return null;
      }

      if (resolvedCell === STYX.CELL.BORDER) {
        // Ignore re-touching immediate launch point if trail is only 1 cell long
        if (this.trail.length <= 2 && nx === this.trail[0].x && ny === this.trail[0].y) {
          return null;
        }

        // LOOP CLOSED!
        this.x = nx;
        this.y = ny;
        this.trail.push({ x: nx, y: ny });
        const completedTrail = this.trail.slice();
        this.trail.length = 0;
        this.state = 'BORDER';
        this.fuseActive = false;
        this.fuseProgress = 0;
        this.idleTime = 0;
        return {
          type: 'CLAIM',
          closeX: nx,
          closeY: ny,
          trail: completedTrail
        };
      }

      // If somehow hitting CLAIMED directly (rare diagonal corner), snap to nearest BORDER
      if (resolvedCell === STYX.CELL.CLAIMED_1 || resolvedCell === STYX.CELL.CLAIMED_5 || resolvedCell === STYX.CELL.CLAIMED_10) {
        const snap = grid.findNearestBorder(nx, ny, 4);
        this.x = snap.x;
        this.y = snap.y;
        this.trail.push({ x: snap.x, y: snap.y });
        const completedTrail = this.trail.slice();
        this.trail.length = 0;
        this.state = 'BORDER';
        this.fuseActive = false;
        this.fuseProgress = 0;
        this.idleTime = 0;
        return {
          type: 'CLAIM',
          closeX: snap.x,
          closeY: snap.y,
          trail: completedTrail
        };
      }

      return null;
    }

    getFusePosition() {
      if (!this.fuseActive || this.trail.length === 0) return null;
      const idx = Math.min(this.trail.length - 1, Math.floor(this.fuseProgress));
      return this.trail[idx];
    }
  }

  // --------------------------------------------------------------------------
  // THE STYX CREATURE (Multi-Node Swirling Plasma Ribbon Entity)
  // --------------------------------------------------------------------------
  class StyxEntity {
    constructor(grid, startX, startY, speedScale = 1.0, phaseOffset = 0, compact = false) {
      this.grid = grid;
      this.speedScale = speedScale;
      this.time = phaseOffset;
      this.compact = compact;
      this.agitation = 0; // Rises when close to player's active trail

      // Core anchor position + velocity
      this.cx = startX;
      this.cy = startY;
      const angle = Math.random() * Math.PI * 2;
      const baseV = (compact ? 42 : 48) * speedScale;
      this.cvx = Math.cos(angle) * baseV;
      this.cvy = Math.sin(angle) * baseV;

      // 4 coupled plasma ribbon nodes that dance around the core and bounce off walls
      const spread = compact ? 15 : 22;
      this.nodes = [];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + phaseOffset;
        this.nodes.push({
          x: startX + Math.cos(a) * spread,
          y: startY + Math.sin(a) * spread,
          vx: Math.cos(a + 1.3) * 40 * speedScale,
          vy: Math.sin(a + 1.3) * 40 * speedScale,
          freq: 1.4 + i * 0.55,
          phase: i * 1.7 + phaseOffset
        });
      }

      // History of ribbons for the iconic luminous swirling Styx afterimages
      this.history = [];
      this.maxHistory = compact ? 22 : 28;
      this.historyAccum = 0;
      this.arcs = []; // Dynamic lightning arcs
    }

    update(dt, player, fx) {
      this.time += dt;
      const grid = this.grid;

      // Subtle harmonic curl steering on core so motion feels hypnotic & organic
      const curlAngle = Math.sin(this.time * 0.9) * 1.65 + Math.cos(this.time * 0.43) * 0.9;
      const turnRate = (1.15 + this.agitation * 0.5) * dt;
      const cosA = Math.cos(curlAngle * turnRate);
      const sinA = Math.sin(curlAngle * turnRate);
      const nvx = this.cvx * cosA - this.cvy * sinA;
      const nvy = this.cvx * sinA + this.cvy * cosA;
      this.cvx = nvx;
      this.cvy = nvy;

      // Maintain healthy kinetic speed
      const targetSpeed = (this.compact ? 42 : 48) * this.speedScale * (1 + this.agitation * 0.18);
      const curSpeed = Math.hypot(this.cvx, this.cvy) || 1;
      this.cvx = (this.cvx / curSpeed) * targetSpeed;
      this.cvy = (this.cvy / curSpeed) * targetSpeed;

      // Move core with sub-stepping for exact wall bounces
      this._moveAndBounce(this, 'cx', 'cy', 'cvx', 'cvy', dt, 3, fx, true);

      // Move each ribbon node with spring-tether toward core + swirling orbit + wall bounce
      const maxRadius = this.compact ? 22 : 31;
      for (let i = 0; i < this.nodes.length; i++) {
        const n = this.nodes[i];
        const dx = this.cx - n.x;
        const dy = this.cy - n.y;
        const dist = Math.hypot(dx, dy) || 1;

        // Elastic tether keeps creature cohesive while allowing wild twisting arcs
        const pull = dist > maxRadius ? (dist - maxRadius) * 14.0 : 1.8;
        const swirl = Math.sin(this.time * n.freq + n.phase) * 75 * this.speedScale;

        n.vx += ((dx / dist) * pull - (dy / dist) * swirl * 0.35 + Math.cos(this.time * 2.3 + n.phase) * 55) * dt;
        n.vy += ((dy / dist) * pull + (dx / dist) * swirl * 0.35 + Math.sin(this.time * 2.1 + n.phase) * 55) * dt;

        // Clamp node speed
        const nSpeed = Math.hypot(n.vx, n.vy);
        const maxNSpeed = 92 * this.speedScale;
        if (nSpeed > maxNSpeed) {
          n.vx = (n.vx / nSpeed) * maxNSpeed;
          n.vy = (n.vy / nSpeed) * maxNSpeed;
        }

        this._moveAndBounce(n, 'x', 'y', 'vx', 'vy', dt, 2, fx, false);
      }

      // Compute agitation based on proximity to player while drawing
      let minDist = 999;
      if (player && player.state === 'DRAWING') {
        minDist = Math.hypot(this.cx - player.x, this.cy - player.y);
      }
      const targetAgitation = minDist < 42 ? Math.max(0, 1 - minDist / 42) : 0;
      this.agitation += (targetAgitation - this.agitation) * Math.min(1, dt * 6);

      // Record ribbon snapshot at smooth cadence (~45 snapshots/sec)
      this.historyAccum += dt;
      if (this.historyAccum >= 0.022) {
        this.historyAccum = 0;
        this.history.unshift({
          pts: this.nodes.map(n => ({ x: n.x, y: n.y })),
          cx: this.cx,
          cy: this.cy,
          t: this.time
        });
        if (this.history.length > this.maxHistory) {
          this.history.pop();
        }
      }

      // Occasionally generate crackling micro-lightning arcs between nodes
      if (Math.random() < (0.22 + this.agitation * 0.45)) {
        const a = this.nodes[(Math.random() * 4) | 0];
        const b = this.nodes[(Math.random() * 4) | 0];
        if (a !== b) {
          this.arcs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, life: 0.11 });
        }
      }
      for (let i = this.arcs.length - 1; i >= 0; i--) {
        this.arcs[i].life -= dt;
        if (this.arcs[i].life <= 0) this.arcs.splice(i, 1);
      }
    }

    _moveAndBounce(obj, xKey, yKey, vxKey, vyKey, dt, margin, fx, emitBounceSparks) {
      const grid = this.grid;
      const subSteps = 3;
      const sdt = dt / subSteps;

      for (let s = 0; s < subSteps; s++) {
        const nx = obj[xKey] + obj[vxKey] * sdt;
        const ny = obj[yKey] + obj[vyKey] * sdt;

        const ix = Math.round(nx);
        const iy = Math.round(ny);

        if (this._isSolidForStyx(ix, iy, margin)) {
          // Test X-only and Y-only reflection
          const solidX = this._isSolidForStyx(Math.round(nx), Math.round(obj[yKey]), margin);
          const solidY = this._isSolidForStyx(Math.round(obj[xKey]), Math.round(ny), margin);

          if (solidX) obj[vxKey] = -obj[vxKey] * (0.94 + Math.random() * 0.12);
          if (solidY) obj[vyKey] = -obj[vyKey] * (0.94 + Math.random() * 0.12);
          if (!solidX && !solidY) {
            obj[vxKey] = -obj[vxKey];
            obj[vyKey] = -obj[vyKey];
          }

          // Subtle random jitter so it never gets locked in a periodic loop
          const jitter = (Math.random() - 0.5) * 0.22;
          const ca = Math.cos(jitter);
          const sa = Math.sin(jitter);
          const tvx = obj[vxKey] * ca - obj[vyKey] * sa;
          const tvy = obj[vxKey] * sa + obj[vyKey] * ca;
          obj[vxKey] = tvx;
          obj[vyKey] = tvy;

          if (emitBounceSparks && Math.random() < 0.55) {
            fx.emitBurst(obj[xKey], obj[yKey], 5, '#ff48d8', 42);
          }
        } else {
          obj[xKey] = nx;
          obj[yKey] = ny;
        }
      }
    }

    _isSolidForStyx(ix, iy, margin) {
      const grid = this.grid;
      if (ix <= margin || ix >= grid.W - 1 - margin || iy <= margin || iy >= grid.H - 1 - margin) {
        return true;
      }
      const c = grid.cells[iy * grid.W + ix];
      // Styx bounces off BORDER and CLAIMED, passes through EMPTY and TRAIL (touching TRAIL kills player!)
      return c !== STYX.CELL.EMPTY && c !== STYX.CELL.TRAIL;
    }

    /**
     * After a territory claim, ensure core & all nodes sit inside valid EMPTY space.
     */
    keepInsideEmpty() {
      const grid = this.grid;
      const coreEmpty = grid.findNearestEmpty(this.cx, this.cy, 48);
      if (coreEmpty) {
        this.cx = coreEmpty.x;
        this.cy = coreEmpty.y;
      }
      for (let i = 0; i < this.nodes.length; i++) {
        const n = this.nodes[i];
        const ix = Math.round(n.x);
        const iy = Math.round(n.y);
        if (!grid.isEmpty(ix, iy)) {
          // Pull gently back toward core
          n.x = this.cx + (Math.random() - 0.5) * 6;
          n.y = this.cy + (Math.random() - 0.5) * 6;
        }
      }
    }

    /**
     * Checks if the active Styx ribbon or core touches the player's TRAIL or active DRAWING player.
     */
    hitsPlayerOrTrail(player) {
      if (!player || player.state !== 'DRAWING') return false;
      const grid = this.grid;

      // 1. Check direct proximity to player head
      if (Math.hypot(this.cx - player.x, this.cy - player.y) < 4.5) return true;
      for (let i = 0; i < this.nodes.length; i++) {
        if (Math.hypot(this.nodes[i].x - player.x, this.nodes[i].y - player.y) < 3.6) return true;
      }

      // 2. Check ribbon segments (0-1, 1-2, 2-3, 3-0) against TRAIL cells
      for (let i = 0; i < this.nodes.length; i++) {
        const a = this.nodes[i];
        const b = this.nodes[(i + 1) % this.nodes.length];
        if (this._segmentHitsTrail(a.x, a.y, b.x, b.y, grid)) return true;
      }
      return false;
    }

    _segmentHitsTrail(x0, y0, x1, y1, grid) {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const steps = Math.max(4, Math.ceil(Math.hypot(dx, dy) * 1.25));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const ix = Math.round(x0 + dx * t);
        const iy = Math.round(y0 + dy * t);
        if (grid.isTrail(ix, iy)) return true;
      }
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // EDGE-CRAWLING CATERPILLAR (Articulated Cyber-Centipede)
  // --------------------------------------------------------------------------
  class Caterpillar {
    constructor(grid, startX, startY, dir, turnSign, segmentCount = 13, speedScale = 1.0) {
      this.grid = grid;
      const safe = grid.findNearestBorder(startX, startY, 30);
      this.x = safe.x;
      this.y = safe.y;
      this.dir = dir & 7;
      this.turnSign = turnSign >= 0 ? 1 : -1;
      this.segmentCount = segmentCount;
      this.speed = 46 * speedScale;
      this.stepAccum = 0;
      this.alive = true;
      this.wigglePhase = Math.random() * Math.PI * 2;

      // Path history so every glowing body segment hugs the exact border contour
      this.spacing = 2; // Grid steps per segment
      this.maxPath = segmentCount * this.spacing + 4;
      this.path = [];
      for (let i = 0; i < this.maxPath; i++) {
        this.path.push({ x: this.x, y: this.y });
      }
    }

    update(dt) {
      if (!this.alive) return;
      this.wigglePhase += dt * 11;
      this.stepAccum += this.speed * dt;

      let guard = 0;
      while (this.stepAccum >= 1.0 && guard < 4) {
        const next = this.grid.stepAlongBorder(this.x, this.y, this.dir, this.turnSign);
        this.x = next.x;
        this.y = next.y;
        this.dir = next.dir;
        this.path.unshift({ x: this.x, y: this.y });
        if (this.path.length > this.maxPath) this.path.pop();
        this.stepAccum -= 1.0;
        guard++;
      }
    }

    /**
     * Called after territory claim: checks if caterpillar's head was sealed inside
     * claimed territory (i.e. no longer on an active BORDER cell).
     * Returns true if trapped & crushed!
     */
    checkTrappedAfterClaim() {
      if (!this.alive) return false;
      if (!this.grid.isBorder(this.x, this.y)) {
        this.alive = false;
        return true;
      }
      return false;
    }

    hitsPlayer(player) {
      if (!this.alive || !player || player.shieldTimer > 0) return false;
      // Head collision
      if (Math.hypot(this.x - player.x, this.y - player.y) < 3.4) return true;
      // Body segment collision (when player is on the border)
      if (player.state === 'BORDER') {
        for (let i = 1; i < this.segmentCount; i++) {
          const idx = Math.min(this.path.length - 1, i * this.spacing);
          const p = this.path[idx];
          if (Math.hypot(p.x - player.x, p.y - player.y) < 2.3) return true;
        }
      }
      return false;
    }

    getSegments() {
      const segs = [];
      for (let i = 0; i < this.segmentCount; i++) {
        const idx = Math.min(this.path.length - 1, i * this.spacing);
        segs.push(this.path[idx]);
      }
      return segs;
    }
  }

  // --------------------------------------------------------------------------
  // PARTICLE, SHOCKWAVE & FLOATING CALLOUT FX SYSTEM
  // --------------------------------------------------------------------------
  class FXSystem {
    constructor(gridW, gridH) {
      this.W = gridW;
      this.H = gridH;
      this.particles = [];
      this.maxParticles = 950;
      this.rings = [];
      this.texts = [];
      this.motes = [];

      // Floating ambient bioluminescent motes in the void
      for (let i = 0; i < 65; i++) {
        this.motes.push({
          x: Math.random() * gridW,
          y: Math.random() * gridH,
          vx: (Math.random() - 0.5) * 4.5,
          vy: (Math.random() - 0.5) * 4.5,
          size: 0.8 + Math.random() * 1.6,
          phase: Math.random() * Math.PI * 2
        });
      }

      // GPU shockwave uniform state (screen-space refraction ripple)
      this.shockwave = {
        active: false,
        x: 0.5,
        y: 0.5,
        time: 0,
        strength: 0
      };
      this.screenShake = 0;
    }

    triggerShockwave(gx, gy, strength = 1.0) {
      this.shockwave.active = true;
      this.shockwave.x = gx / this.W;
      this.shockwave.y = gy / this.H;
      this.shockwave.time = 0.001;
      this.shockwave.strength = strength;
      this.screenShake = Math.max(this.screenShake, strength * 8.5);
    }

    emitSpark(x, y, vx, vy, color, life = 0.45, size = 1.6) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }
      this.particles.push({
        x, y, vx, vy, color,
        life, maxLife: life,
        size,
        kind: 'spark'
      });
    }

    emitShard(x, y, vx, vy, color, life = 0.75, size = 2.6) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }
      this.particles.push({
        x, y, vx, vy, color,
        life, maxLife: life,
        size,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 14,
        kind: 'shard'
      });
    }

    emitBurst(x, y, count, color, speed = 75, includeShards = false) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = speed * (0.25 + Math.random() * 0.95);
        if (includeShards && i % 3 === 0) {
          this.emitShard(x, y, Math.cos(a) * spd, Math.sin(a) * spd, color, 0.5 + Math.random() * 0.45, 2.0 + Math.random() * 2.0);
        } else {
          this.emitSpark(x, y, Math.cos(a) * spd, Math.sin(a) * spd, color, 0.3 + Math.random() * 0.45, 1.2 + Math.random() * 1.4);
        }
      }
    }

    emitRing(x, y, maxRadius, color, duration = 0.55) {
      this.rings.push({ x, y, r: 2, maxRadius, color, life: duration, maxLife: duration });
    }

    addFloatingText(x, y, text, subtext, color = '#ffffff', scale = 1.0) {
      this.texts.push({
        x: Math.max(26, Math.min(this.W - 26, x)),
        y: Math.max(18, Math.min(this.H - 18, y)),
        vy: -15,
        text,
        subtext,
        color,
        scale,
        life: 1.45,
        maxLife: 1.45
      });
    }

    update(dt, styxList) {
      // Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.08, dt);
        p.vy *= Math.pow(0.08, dt);
        if (p.kind === 'shard') p.rot += p.vrot * dt;
        p.life -= dt;
        if (p.life <= 0) this.particles.splice(i, 1);
      }

      // Rings
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.life -= dt;
        const progress = 1 - Math.max(0, r.life / r.maxLife);
        r.r = 2 + (r.maxRadius - 2) * (1 - Math.pow(1 - progress, 3));
        if (r.life <= 0) this.rings.splice(i, 1);
      }

      // Floating texts
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.y += t.vy * dt;
        t.vy *= Math.pow(0.25, dt);
        t.life -= dt;
        if (t.life <= 0) this.texts.splice(i, 1);
      }

      // Ambient motes pushed gently by Styx wakes
      for (let i = 0; i < this.motes.length; i++) {
        const m = this.motes[i];
        m.phase += dt * 2.2;
        if (styxList) {
          for (let s = 0; s < styxList.length; s++) {
            const st = styxList[s];
            const dx = m.x - st.cx;
            const dy = m.y - st.cy;
            const d2 = dx * dx + dy * dy;
            if (d2 < 900 && d2 > 4) {
              const d = Math.sqrt(d2);
              const push = (1 - d / 30) * 48 * dt;
              m.vx += (dx / d) * push;
              m.vy += (dy / d) * push;
            }
          }
        }
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.vx *= Math.pow(0.45, dt);
        m.vy *= Math.pow(0.45, dt);
        // Gentle baseline drift
        m.x += Math.cos(m.phase * 0.5) * 1.4 * dt;
        m.y += Math.sin(m.phase * 0.6) * 1.4 * dt;
        if (m.x < 0) m.x += this.W;
        if (m.x >= this.W) m.x -= this.W;
        if (m.y < 0) m.y += this.H;
        if (m.y >= this.H) m.y -= this.H;
      }

      // GPU shockwave decay
      if (this.shockwave.active) {
        this.shockwave.time += dt * 1.35;
        if (this.shockwave.time > 1.25) {
          this.shockwave.active = false;
          this.shockwave.strength = 0;
        }
      }

      // Screen shake decay
      if (this.screenShake > 0.05) {
        this.screenShake *= Math.pow(0.001, dt);
      } else {
        this.screenShake = 0;
      }
    }
  }

  STYX.Player = Player;
  STYX.StyxEntity = StyxEntity;
  STYX.Caterpillar = Caterpillar;
  STYX.FXSystem = FXSystem;
})(window);
