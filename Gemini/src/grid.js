/* ==========================================================================
   STYX // Playfield Grid & Flood-Fill Territory Engine
   320x200 logical playfield (2x homage to 1983 Styx 160x100) with:
   - Zero-allocation O(N) BFS territory flood fill
   - 8-directional diagonal trail sealing (4-connected flood fill)
   - Stained-glass seam preservation & radial crystallization wave animation
   - Moore-Neighbor contour walking for dynamic border caterpillars
   ========================================================================== */

(function (global) {
  'use strict';

  const STYX = (global.STYX = global.STYX || {});

  const CELL = {
    EMPTY: 0,
    BORDER: 1,
    CLAIMED_1: 2,
    CLAIMED_5: 3,
    CLAIMED_10: 4,
    TRAIL: 5
  };

  // 8-way clockwise directions: E, SE, S, SW, W, NW, N, NE
  const DIR8_X = [1, 1, 0, -1, -1, -1, 0, 1];
  const DIR8_Y = [0, 1, 1, 1, 0, -1, -1, -1];

  class PlayfieldGrid {
    constructor(width = 320, height = 200) {
      this.W = width;
      this.H = height;
      this.size = width * height;
      this.totalInterior = (width - 2) * (height - 2);

      this.cells = new Uint8Array(this.size);
      this.seam = new Uint8Array(this.size);       // Preserved geometric cut lines
      this.seamMult = new Uint8Array(this.size);   // 1, 2, or 3 for tinting seams
      this.flash = new Float32Array(this.size);    // Radial crystallization flash (0..1.5)
      this.flashDelay = new Float32Array(this.size);
      this.borderGlow = new Uint8Array(this.size); // Distance halo from active border

      // Pre-allocated BFS buffers (zero GC pressure)
      this.visited = new Uint8Array(this.size);
      this.queue = new Int32Array(this.size);
      this.activeFlashIndices = [];

      // RGBA8 texture buffer uploaded directly to WebGL2
      this.texData = new Uint8Array(this.size * 4);
      this.dirtyTexture = true;

      this.emptyCount = this.totalInterior;
      this.claimedPercent = 0;

      this.reset();
    }

    reset() {
      const { W, H, cells, seam, seamMult, flash, flashDelay } = this;
      cells.fill(CELL.EMPTY);
      seam.fill(0);
      seamMult.fill(1);
      flash.fill(0);
      flashDelay.fill(0);
      this.activeFlashIndices.length = 0;

      // Perimeter outer border
      for (let x = 0; x < W; x++) {
        cells[x] = CELL.BORDER;
        cells[(H - 1) * W + x] = CELL.BORDER;
        seam[x] = 255;
        seam[(H - 1) * W + x] = 255;
      }
      for (let y = 0; y < H; y++) {
        cells[y * W] = CELL.BORDER;
        cells[y * W + (W - 1)] = CELL.BORDER;
        seam[y * W] = 255;
        seam[y * W + (W - 1)] = 255;
      }

      this.emptyCount = this.totalInterior;
      this.claimedPercent = 0;
      this._rebuildBorderGlow();
      this._rebuildTextureFull();
    }

    idx(x, y) {
      return y * this.W + x;
    }

    inBounds(x, y) {
      return x >= 0 && x < this.W && y >= 0 && y < this.H;
    }

    get(x, y) {
      if (x < 0 || x >= this.W || y < 0 || y >= this.H) return CELL.CLAIMED_1;
      return this.cells[y * this.W + x];
    }

    isClaimedOrBorder(x, y) {
      const c = this.get(x, y);
      return c === CELL.BORDER || c === CELL.CLAIMED_1 || c === CELL.CLAIMED_5 || c === CELL.CLAIMED_10;
    }

    isEmpty(x, y) {
      if (x <= 0 || x >= this.W - 1 || y <= 0 || y >= this.H - 1) return false;
      return this.cells[y * this.W + x] === CELL.EMPTY;
    }

    isBorder(x, y) {
      if (x < 0 || x >= this.W || y < 0 || y >= this.H) return false;
      return this.cells[y * this.W + x] === CELL.BORDER;
    }

    isTrail(x, y) {
      if (x < 0 || x >= this.W || y < 0 || y >= this.H) return false;
      return this.cells[y * this.W + x] === CELL.TRAIL;
    }

    setTrail(x, y) {
      if (x > 0 && x < this.W - 1 && y > 0 && y < this.H - 1) {
        this.cells[y * this.W + x] = CELL.TRAIL;
      }
    }

    clearTrail(trailPoints) {
      if (trailPoints && trailPoints.length) {
        for (let i = 0; i < trailPoints.length; i++) {
          const p = trailPoints[i];
          const index = p.y * this.W + p.x;
          if (this.cells[index] === CELL.TRAIL) {
            this.cells[index] = CELL.EMPTY;
          }
        }
      } else {
        for (let i = 0; i < this.size; i++) {
          if (this.cells[i] === CELL.TRAIL) this.cells[i] = CELL.EMPTY;
        }
      }
    }

    hasEmptyNeighbor8(x, y) {
      const { W, H, cells } = this;
      for (let d = 0; d < 8; d++) {
        const nx = x + DIR8_X[d];
        const ny = y + DIR8_Y[d];
        if (nx > 0 && nx < W - 1 && ny > 0 && ny < H - 1) {
          if (cells[ny * W + nx] === CELL.EMPTY) return true;
        }
      }
      return false;
    }

    // Find nearest EMPTY cell to a floating-point position (for BFS seeding)
    findNearestEmpty(fx, fy, maxRadius = 24) {
      const sx = Math.max(1, Math.min(this.W - 2, Math.round(fx)));
      const sy = Math.max(1, Math.min(this.H - 2, Math.round(fy)));
      if (this.cells[sy * this.W + sx] === CELL.EMPTY) return { x: sx, y: sy };

      for (let r = 1; r <= maxRadius; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const nx = sx + dx;
            const ny = sy + dy;
            if (nx > 0 && nx < this.W - 1 && ny > 0 && ny < this.H - 1) {
              if (this.cells[ny * this.W + nx] === CELL.EMPTY) {
                return { x: nx, y: ny };
              }
            }
          }
        }
      }
      return null;
    }

    // Find nearest active BORDER cell to keep player/caterpillar anchored
    findNearestBorder(fx, fy, maxRadius = 40) {
      const sx = Math.max(0, Math.min(this.W - 1, Math.round(fx)));
      const sy = Math.max(0, Math.min(this.H - 1, Math.round(fy)));
      if (this.cells[sy * this.W + sx] === CELL.BORDER) return { x: sx, y: sy };

      for (let r = 1; r <= maxRadius; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const nx = sx + dx;
            const ny = sy + dy;
            if (nx >= 0 && nx < this.W && ny >= 0 && ny < this.H) {
              if (this.cells[ny * this.W + nx] === CELL.BORDER) {
                return { x: nx, y: ny };
              }
            }
          }
        }
      }
      return { x: 0, y: 0 };
    }

    // Check if an empty cell is reachable from a given Styx seed
    /**
     * Commits the active player trail, runs flood fill around all Styx entities,
     * claims all non-Styx pockets, preserves stained-glass seams, and triggers
     * an expanding radial crystallization wave!
     */
    commitTrail(trailPoints, styxList, multiplier, closeX, closeY) {
      const { W, H, cells, seam, seamMult, visited, queue } = this;
      const multCode = multiplier === 10 ? 3 : multiplier === 5 ? 2 : 1;
      const claimCell = multiplier === 10
        ? CELL.CLAIMED_10
        : multiplier === 5
          ? CELL.CLAIMED_5
          : CELL.CLAIMED_1;

      // 1. Convert trail cells into permanent BORDER + glowing seam
      let trailConverted = 0;
      for (let i = 0; i < trailPoints.length; i++) {
        const p = trailPoints[i];
        const index = p.y * W + p.x;
        if (cells[index] === CELL.TRAIL || cells[index] === CELL.EMPTY) {
          cells[index] = CELL.BORDER;
          seam[index] = 255;
          seamMult[index] = multCode;
          trailConverted++;
        }
      }

      // 2. Flood-fill from each Styx core (4-connected so 8-way diagonals seal tightly!)
      visited.fill(0);
      let splitDetected = false;
      let styxRegions = 0;

      for (let s = 0; s < styxList.length; s++) {
        const styx = styxList[s];
        const seed = this.findNearestEmpty(styx.cx, styx.cy, 36);
        if (!seed) continue;

        const seedIdx = seed.y * W + seed.x;
        if (visited[seedIdx]) continue; // Already in same chamber as another Styx

        styxRegions++;
        let head = 0;
        let tail = 0;
        visited[seedIdx] = styxRegions;
        queue[tail++] = seedIdx;

        while (head < tail) {
          const cur = queue[head++];
          const cx = cur % W;
          const cy = (cur - cx) / W;

          // 4-connected neighbors
          if (cx > 1) {
            const ni = cur - 1;
            if (!visited[ni] && cells[ni] === CELL.EMPTY) {
              visited[ni] = styxRegions;
              queue[tail++] = ni;
            }
          }
          if (cx < W - 2) {
            const ni = cur + 1;
            if (!visited[ni] && cells[ni] === CELL.EMPTY) {
              visited[ni] = styxRegions;
              queue[tail++] = ni;
            }
          }
          if (cy > 1) {
            const ni = cur - W;
            if (!visited[ni] && cells[ni] === CELL.EMPTY) {
              visited[ni] = styxRegions;
              queue[tail++] = ni;
            }
          }
          if (cy < H - 2) {
            const ni = cur + W;
            if (!visited[ni] && cells[ni] === CELL.EMPTY) {
              visited[ni] = styxRegions;
              queue[tail++] = ni;
            }
          }
        }
      }

      if (styxList.length > 1 && styxRegions > 1) {
        splitDetected = true;
      }

      // 3. Claim every unvisited EMPTY cell
      let claimedCells = 0;
      let sumX = 0;
      let sumY = 0;
      let remainingEmpty = 0;

      // Temporary list for radial crystallization wave
      const waveOriginX = closeX;
      const waveOriginY = closeY;

      for (let y = 1; y < H - 1; y++) {
        const rowOffset = y * W;
        for (let x = 1; x < W - 1; x++) {
          const index = rowOffset + x;
          if (cells[index] === CELL.EMPTY) {
            if (visited[index] === 0) {
              cells[index] = claimCell;
              claimedCells++;
              sumX += x;
              sumY += y;

              // Staggered radial flash wave
              const dist = Math.hypot(x - waveOriginX, y - waveOriginY);
              this.flashDelay[index] = Math.min(0.42, dist * 0.0028);
              this.flash[index] = 1.35;
              this.activeFlashIndices.push(index);
            } else {
              remainingEmpty++;
            }
          }
        }
      }

      // 4. Clean up interior BORDER cells that are no longer adjacent to any EMPTY cell
      for (let y = 0; y < H; y++) {
        const rowOffset = y * W;
        for (let x = 0; x < W; x++) {
          const index = rowOffset + x;
          if (cells[index] === CELL.BORDER) {
            if (!this.hasEmptyNeighbor8(x, y)) {
              cells[index] = claimCell;
              // Keep seam[index] = 255 so the stained-glass cut line remains radiant!
              this.flashDelay[index] = 0;
              this.flash[index] = 1.0;
              this.activeFlashIndices.push(index);
            }
          }
        }
      }

      // Also flash the newly created trail border slightly
      for (let i = 0; i < trailPoints.length; i++) {
        const p = trailPoints[i];
        const index = p.y * W + p.x;
        this.flashDelay[index] = 0;
        this.flash[index] = 1.45;
        this.activeFlashIndices.push(index);
      }

      this.emptyCount = remainingEmpty;
      const totalClaimedArea = this.totalInterior - remainingEmpty;
      const newPercent = Math.min(100, (totalClaimedArea / this.totalInterior) * 100);
      const deltaPercent = Math.max(0, newPercent - this.claimedPercent);
      this.claimedPercent = newPercent;

      // Rebuild border distance halo & GPU texture
      this._rebuildBorderGlow();
      this._rebuildTextureFull();

      const centroidX = claimedCells > 0 ? sumX / claimedCells : closeX;
      const centroidY = claimedCells > 0 ? sumY / claimedCells : closeY;

      return {
        claimedCells: claimedCells + trailConverted,
        deltaPercent,
        totalPercent: this.claimedPercent,
        centroidX,
        centroidY,
        splitDetected
      };
    }

    // Update radial crystallization wave animation each frame
    updateFlash(dt) {
      const list = this.activeFlashIndices;
      if (list.length === 0) return;

      const { flash, flashDelay, texData } = this;
      let writeIdx = 0;

      for (let i = 0; i < list.length; i++) {
        const index = list[i];
        if (flashDelay[index] > 0) {
          flashDelay[index] -= dt;
          list[writeIdx++] = index;
          continue;
        }
        const f = flash[index] - dt * 2.15;
        if (f > 0.01) {
          flash[index] = f;
          texData[index * 4 + 2] = Math.min(255, (f * 185) | 0);
          list[writeIdx++] = index;
        } else {
          flash[index] = 0;
          texData[index * 4 + 2] = 0;
        }
      }

      list.length = writeIdx;
      this.dirtyTexture = true;
    }

    // Compute a crisp 2-ring border glow halo for the GPU shader
    _rebuildBorderGlow() {
      const { W, H, cells, borderGlow } = this;
      borderGlow.fill(0);

      for (let y = 0; y < H; y++) {
        const row = y * W;
        for (let x = 0; x < W; x++) {
          const i = row + x;
          if (cells[i] === CELL.BORDER) {
            borderGlow[i] = 255;
            // Ring 1
            if (x > 0 && borderGlow[i - 1] < 150) borderGlow[i - 1] = 150;
            if (x < W - 1 && borderGlow[i + 1] < 150) borderGlow[i + 1] = 150;
            if (y > 0 && borderGlow[i - W] < 150) borderGlow[i - W] = 150;
            if (y < H - 1 && borderGlow[i + W] < 150) borderGlow[i + W] = 150;
            // Diagonals
            if (x > 0 && y > 0 && borderGlow[i - W - 1] < 110) borderGlow[i - W - 1] = 110;
            if (x < W - 1 && y > 0 && borderGlow[i - W + 1] < 110) borderGlow[i - W + 1] = 110;
            if (x > 0 && y < H - 1 && borderGlow[i + W - 1] < 110) borderGlow[i + W - 1] = 110;
            if (x < W - 1 && y < H - 1 && borderGlow[i + W + 1] < 110) borderGlow[i + W + 1] = 110;
          }
        }
      }
    }

    _rebuildTextureFull() {
      const { size, cells, seam, seamMult, flash, flashDelay, borderGlow, texData } = this;
      for (let i = 0; i < size; i++) {
        const o = i * 4;
        const c = cells[i];
        // R: Cell type encoded cleanly in steps
        if (c === CELL.EMPTY || c === CELL.TRAIL) texData[o] = 0;
        else if (c === CELL.BORDER) texData[o] = 64;
        else if (c === CELL.CLAIMED_1) texData[o] = 128;
        else if (c === CELL.CLAIMED_5) texData[o] = 192;
        else texData[o] = 255;

        // G: Stained-glass seam encoded with multiplier tint (0=none, 85=x1, 170=x5, 255=x10)
        texData[o + 1] = seam[i] ? (seamMult[i] === 3 ? 255 : seamMult[i] === 2 ? 170 : 85) : 0;

        // B: Active crystallization flash
        texData[o + 2] = (flashDelay[i] <= 0 && flash[i] > 0) ? Math.min(255, (flash[i] * 185) | 0) : 0;

        // A: Border halo glow
        texData[o + 3] = borderGlow[i];
      }
      this.dirtyTexture = true;
    }

    /**
     * Moore-Neighbor contour step along active BORDER cells.
     * Guarantees caterpillars smoothly trace arbitrary shapes & sharp spikes.
     */
    stepAlongBorder(x, y, dir, turnSign) {
      // Backtrack direction is (dir + 4) % 8; scan sweeping by turnSign (+1 CW, -1 CCW)
      const startOffset = turnSign > 0 ? -2 : 2;
      for (let step = 0; step < 8; step++) {
        const d = (dir + startOffset + step * turnSign + 16) & 7;
        const nx = x + DIR8_X[d];
        const ny = y + DIR8_Y[d];
        if (this.isBorder(nx, ny)) {
          return { x: nx, y: ny, dir: d };
        }
      }
      return { x, y, dir };
    }
  }

  STYX.CELL = CELL;
  STYX.DIR8_X = DIR8_X;
  STYX.DIR8_Y = DIR8_Y;
  STYX.PlayfieldGrid = PlayfieldGrid;
})(window);
