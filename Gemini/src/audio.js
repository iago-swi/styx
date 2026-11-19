/* ==========================================================================
   STYX // Procedural Web Audio Synthesizer
   Dynamic ambient drone, reactive carving hum, crystalline claim chords,
   fuse crackle, caterpillar crush, and level fanfares — zero external files.
   ========================================================================== */

(function (global) {
  'use strict';

  const STYX = (global.STYX = global.STYX || {});

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
      this.initialized = false;
      this.theme = STYX.THEMES[0];

      // Continuous synth nodes
      this.droneGain = null;
      this.droneFilter = null;
      this.droneOsc1 = null;
      this.droneOsc2 = null;

      this.drawGain = null;
      this.drawOsc = null;
      this.drawFilter = null;

      this.fuseTimer = 0;
      this.arpTimer = 0;
      this.arpStep = 0;
      this.isDrawing = false;
      this.isPlaying = false;
    }

    init() {
      if (this.initialized) {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return;
      }

      const AudioCtx = global.AudioContext || global.webkitAudioContext;
      if (!AudioCtx) return;

      try {
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.32;
        this.master.connect(this.ctx.destination);

        // Warm ambient stereo-detuned drone
        this.droneFilter = this.ctx.createBiquadFilter();
        this.droneFilter.type = 'lowpass';
        this.droneFilter.frequency.value = 260;
        this.droneFilter.Q.value = 2.4;

        this.droneGain = this.ctx.createGain();
        this.droneGain.gain.value = 0.0;

        this.droneOsc1 = this.ctx.createOscillator();
        this.droneOsc1.type = 'sawtooth';
        this.droneOsc1.frequency.value = this.theme.rootHz;

        this.droneOsc2 = this.ctx.createOscillator();
        this.droneOsc2.type = 'triangle';
        this.droneOsc2.frequency.value = this.theme.rootHz * 1.502;

        this.droneOsc1.connect(this.droneFilter);
        this.droneOsc2.connect(this.droneFilter);
        this.droneFilter.connect(this.droneGain);
        this.droneGain.connect(this.master);

        this.droneOsc1.start();
        this.droneOsc2.start();

        // Active carving plasma hum
        this.drawFilter = this.ctx.createBiquadFilter();
        this.drawFilter.type = 'bandpass';
        this.drawFilter.frequency.value = 420;
        this.drawFilter.Q.value = 3.5;

        this.drawGain = this.ctx.createGain();
        this.drawGain.gain.value = 0.0;

        this.drawOsc = this.ctx.createOscillator();
        this.drawOsc.type = 'sawtooth';
        this.drawOsc.frequency.value = 180;
        this.drawOsc.connect(this.drawFilter);
        this.drawFilter.connect(this.drawGain);
        this.drawGain.connect(this.master);
        this.drawOsc.start();

        this.initialized = true;
      } catch (e) {
        // Audio gracefully disabled if blocked
      }
    }

    setTheme(theme) {
      this.theme = theme;
      if (!this.initialized || !this.ctx) return;
      const now = this.ctx.currentTime;
      this.droneOsc1.frequency.setTargetAtTime(theme.rootHz, now, 0.35);
      this.droneOsc2.frequency.setTargetAtTime(theme.rootHz * 1.502, now, 0.35);
    }

    setMuted(muted) {
      this.muted = muted;
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(muted ? 0 : 0.32, this.ctx.currentTime, 0.04);
      }
    }

    toggleMute() {
      this.setMuted(!this.muted);
      return this.muted;
    }

    update(dt, isPlaying, isDrawing, trailLen, fuseActive) {
      this.isPlaying = isPlaying;
      this.isDrawing = isDrawing;
      if (!this.initialized || !this.ctx || this.muted) return;

      const now = this.ctx.currentTime;

      // Ambient pad swells softly while playing
      const targetDroneGain = isPlaying ? 0.14 : 0.04;
      const targetDroneCutoff = isDrawing ? 620 + Math.min(trailLen * 2.2, 700) : 230;
      this.droneGain.gain.setTargetAtTime(targetDroneGain, now, 0.25);
      this.droneFilter.frequency.setTargetAtTime(targetDroneCutoff, now, 0.12);

      // Carving hum
      const targetDrawGain = (isPlaying && isDrawing) ? 0.095 : 0.0;
      const targetDrawFreq = 165 + Math.min(trailLen * 1.6, 320);
      this.drawGain.gain.setTargetAtTime(targetDrawGain, now, 0.05);
      this.drawOsc.frequency.setTargetAtTime(targetDrawFreq, now, 0.06);
      this.drawFilter.frequency.setTargetAtTime(targetDrawFreq * 2.2, now, 0.06);

      // Subtle atmospheric arpeggio pulse during active gameplay
      if (isPlaying) {
        this.arpTimer -= dt;
        if (this.arpTimer <= 0) {
          this.arpTimer = isDrawing ? 0.19 : 0.32;
          this._playArpNote(isDrawing);
        }
      }

      // Fuse crackle ticks
      if (isPlaying && fuseActive) {
        this.fuseTimer -= dt;
        if (this.fuseTimer <= 0) {
          this.fuseTimer = 0.075;
          this.playFuseTick();
        }
      }
    }

    _playArpNote(intense) {
      if (!this.ctx || this.muted) return;
      const now = this.ctx.currentTime;
      const scale = this.theme.scale;
      const pattern = [0, 2, 4, 3, 5, 4, 2, 1];
      const idx = pattern[this.arpStep % pattern.length];
      this.arpStep++;

      const freq = scale[idx] * (intense ? 1.0 : 0.5);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = intense ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const peak = intense ? 0.055 : 0.032;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (intense ? 0.18 : 0.28));

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.32);
    }

    playClaim(areaPct, multiplier) {
      if (!this.initialized || !this.ctx || this.muted) return;
      const now = this.ctx.currentTime;
      const scale = this.theme.scale;

      // Chord complexity scales with multiplier & area size
      const baseIdx = multiplier === 10 ? 4 : multiplier === 5 ? 2 : 0;
      const notes = [
        scale[baseIdx],
        scale[Math.min(scale.length - 1, baseIdx + 2)],
        scale[Math.min(scale.length - 1, baseIdx + 4)]
      ];
      if (areaPct > 10 || multiplier === 10) {
        notes.push(scale[Math.min(scale.length - 1, baseIdx + 4)] * 2);
      }

      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = i === notes.length - 1 ? 'sine' : 'triangle';
        const start = now + i * 0.032;
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.005, start + 0.35);

        const vol = (0.14 + Math.min(areaPct * 0.005, 0.08)) / notes.length;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(vol, start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45 + areaPct * 0.015);

        osc.connect(gain);
        gain.connect(this.master);
        osc.start(start);
        osc.stop(start + 0.85);
      });

      // Resonant sub-bass thump for big claims
      if (areaPct >= 5) {
        const sub = this.ctx.createOscillator();
        const sg = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(115, now);
        sub.frequency.exponentialRampToValueAtTime(42, now + 0.22);
        sg.gain.setValueAtTime(0.22, now);
        sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        sub.connect(sg);
        sg.connect(this.master);
        sub.start(now);
        sub.stop(now + 0.3);
      }
    }

    playCaterpillarCrush() {
      if (!this.initialized || !this.ctx || this.muted) return;
      const now = this.ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      freqs.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        const t = now + i * 0.04;
        osc.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.exponentialRampToValueAtTime(0.11, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.32);
      });
    }

    playFuseTick() {
      if (!this.initialized || !this.ctx || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(920 + Math.random() * 540, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.045);
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.055);
    }

    playMultiplierShift(mult) {
      if (!this.initialized || !this.ctx || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      const freq = mult === 10 ? 880 : mult === 5 ? 660 : 440;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.12, now + 0.09);
      g.gain.setValueAtTime(0.001, now);
      g.gain.exponentialRampToValueAtTime(mult === 10 ? 0.075 : 0.04, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.14);
    }

    playDeath() {
      if (!this.initialized || !this.ctx || this.muted) return;
      const now = this.ctx.currentTime;

      // Dramatic descending plasma drop
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.65);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.65);

      g.gain.setValueAtTime(0.26, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.75);

      // Filtered noise shatter burst
      const bufSize = Math.floor(this.ctx.sampleRate * 0.35);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.28));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      const nf = this.ctx.createBiquadFilter();
      nf.type = 'bandpass';
      nf.frequency.value = 1100;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.24, now);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      noise.connect(nf);
      nf.connect(ng);
      ng.connect(this.master);
      noise.start(now);
    }

    playLevelClear() {
      if (!this.initialized || !this.ctx || this.muted) return;
      const now = this.ctx.currentTime;
      const scale = this.theme.scale;
      const fanfare = [scale[0], scale[2], scale[4], scale[5], scale[7], scale[8]];
      fanfare.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        const t = now + i * 0.085;
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.7);
      });
    }
  }

  STYX.SoundEngine = SoundEngine;
})(window);
