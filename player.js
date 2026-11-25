/**
 * SPOTLITE • Core Audio Engine & State Manager
 * Implements:
 * - Web Audio API Synthesis with real AnalyserNode & Frequency extraction
 * - F1: Playlist Switcher & 0:00 reset
 * - F2: Like Counter (♥ Toggle)
 * - F3: VIP Song Lock Gate (Shake & toast on < 2 likes, unlock on >= 2, fallback on unlike)
 * - Smart Mute Memory & Canvas Audio Level
 */

class SpotliteAudioEngine {
  constructor() {
    this.audioCtx = null;
    this.analyser = null;
    this.masterGain = null;
    this.filterNode = null;
    this.frequencyData = null;

    this.isPlaying = false;
    this.isMuted = false;
    this.volume = 0.70;              // Default 70%
    this.previousNonZeroVolume = 0.70; // Memory for smart unmute (restores exact volume, not 100%)
    
    this.currentTrackIndex = 0;
    this.currentTime = 0;
    this.clockInterval = null;
    this.synthInterval = null;
    this.synthStep = 0;

    // Track definition
    this.tracks = [
      {
        id: 1,
        title: 'Midnight Telemetry',
        artist: 'Apex Synth',
        genre: 'SYNTHWAVE',
        duration: 150, // 2:30
        art: 'assets/art-midnight.svg',
        liked: false,
        isVIP: false,
        isLocked: false,
        bpm: 112,
        baseFreq: 220, // A3
        notes: [220, 261.63, 329.63, 293.66, 220, 329.63, 392.00, 329.63]
      },
      {
        id: 2,
        title: 'Neon Velocity',
        artist: 'Hyperwave & Byte',
        genre: 'CYBERPUNK',
        duration: 134, // 2:14
        art: 'assets/art-neon.svg',
        liked: false,
        isVIP: false,
        isLocked: false,
        bpm: 128,
        baseFreq: 146.83, // D3
        notes: [146.83, 174.61, 220.00, 261.63, 293.66, 261.63, 220.00, 174.61]
      },
      {
        id: 3,
        title: 'Solar Eclipse',
        artist: 'Pulse Matrix',
        genre: 'ELECTRO',
        duration: 192, // 3:12
        art: 'assets/art-solar.svg',
        liked: false,
        isVIP: false,
        isLocked: false,
        bpm: 118,
        baseFreq: 196.00, // G3
        notes: [196.00, 246.94, 293.66, 329.63, 392.00, 329.63, 293.66, 246.94]
      },
      {
        id: 4,
        title: 'Quantum Mirage [VIP]',
        artist: 'Aether Void (ft. Glitch)',
        genre: 'VIP EXCLUSIVE',
        duration: 225, // 3:45
        art: 'assets/art-vip.svg',
        liked: false,
        isVIP: true,
        isLocked: true, // STARTS LOCKED (VIP Gate)
        bpm: 140,
        baseFreq: 185.00, // F#3
        notes: [185.00, 220.00, 277.18, 329.63, 369.99, 440.00, 369.99, 277.18]
      }
    ];

    // Event listeners
    this.listeners = [];
  }

  // Subscribe to engine state changes
  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.getState());
  }

  notifyUpdate(eventMeta = {}) {
    const state = this.getState();
    this.listeners.forEach(cb => {
      try {
        cb(state, eventMeta);
      } catch (err) {
        console.error('Listener error:', err);
      }
    });
  }

  getState() {
    const currentTrack = this.tracks[this.currentTrackIndex] || this.tracks[0];
    const likedCount = this.getLikedCount();
    return {
      track: currentTrack,
      trackIndex: this.currentTrackIndex,
      tracks: this.tracks.map(t => ({ ...t })),
      isPlaying: this.isPlaying,
      isMuted: this.isMuted,
      volume: this.volume,
      previousNonZeroVolume: this.previousNonZeroVolume,
      volumePercent: Math.round(this.volume * 100),
      currentTime: this.currentTime,
      duration: currentTrack.duration,
      progressPct: currentTrack.duration ? (this.currentTime / currentTrack.duration) * 100 : 0,
      formattedCurrent: this.formatTime(this.currentTime),
      formattedDuration: this.formatTime(currentTrack.duration),
      likedCount: likedCount,
      isVIPUnlocked: likedCount >= 2
    };
  }

  getLikedCount() {
    return this.tracks.filter(t => t.liked).length;
  }

  formatTime(seconds) {
    const secs = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // Initialize Web Audio API on first user interaction
  initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
        
        // Analyser node for live Canvas visualizer
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 64;
        this.analyser.smoothingTimeConstant = 0.8;
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);

        // Lowpass filter for warm analog feel
        this.filterNode = this.audioCtx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.value = 2400;

        // Master Gain
        this.masterGain = this.audioCtx.createGain();
        const initialGain = this.isMuted ? 0 : this.volume * 0.22;
        this.masterGain.gain.setValueAtTime(initialGain, this.audioCtx.currentTime);

        // Topology: Filter -> MasterGain -> Analyser -> Speakers
        this.filterNode.connect(this.masterGain);
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  updateMasterGain() {
    if (!this.audioCtx || !this.masterGain) return;
    const targetGain = this.isMuted ? 0 : this.volume * 0.22;
    this.masterGain.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.03);
  }

  // Synthesize musical note
  playSynthStep(freq, isBass = false) {
    if (!this.audioCtx || !this.filterNode || this.isMuted || this.volume <= 0) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const noteGain = this.audioCtx.createGain();

      if (isBass) {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq * 0.5, now);
        noteGain.gain.setValueAtTime(0.35, now);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        osc.connect(noteGain);
        noteGain.connect(this.filterNode);
        osc.start(now);
        osc.stop(now + 0.28);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        // Vibrato / subtle detune
        osc.frequency.exponentialRampToValueAtTime(freq * 1.01, now + 0.15);
        noteGain.gain.setValueAtTime(0.25, now);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        osc.connect(noteGain);
        noteGain.connect(this.filterNode);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (e) {
      // Audio note failed gracefully
    }
  }

  // Play / Pause toggle
  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    this.initAudioContext();
    this.isPlaying = true;
    this.updateMasterGain();

    // Progression timer
    if (this.clockInterval) clearInterval(this.clockInterval);
    this.clockInterval = setInterval(() => {
      if (!this.isPlaying) return;
      this.currentTime += 1;
      const currentTrack = this.tracks[this.currentTrackIndex];
      if (this.currentTime >= currentTrack.duration) {
        this.nextTrack(true);
      } else {
        this.notifyUpdate({ type: 'timeupdate' });
      }
    }, 1000);

    // Synth music loop
    if (this.synthInterval) clearInterval(this.synthInterval);
    const curTrack = this.tracks[this.currentTrackIndex];
    const stepInterval = Math.round((60000 / (curTrack.bpm || 120)) / 2); // 16th notes
    
    this.synthInterval = setInterval(() => {
      if (!this.isPlaying) return;
      const track = this.tracks[this.currentTrackIndex];
      const note = track.notes[this.synthStep % track.notes.length];
      const isBass = this.synthStep % 2 === 0;
      this.playSynthStep(note, isBass);
      this.synthStep++;
    }, Math.max(120, stepInterval));

    this.notifyUpdate({ type: 'play' });
  }

  pause() {
    this.isPlaying = false;
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    this.notifyUpdate({ type: 'pause' });
  }

  seek(seconds) {
    const curTrack = this.tracks[this.currentTrackIndex];
    this.currentTime = Math.max(0, Math.min(seconds, curTrack.duration));
    this.notifyUpdate({ type: 'seek' });
  }

  // ==========================================
  // F1: Playlist Switcher & Canvas Visualizer
  // ==========================================
  selectTrack(index, options = { autoPlay: true, resetTime: true }) {
    if (index < 0 || index >= this.tracks.length) return false;
    const targetTrack = this.tracks[index];

    // F3 Gate Check: if VIP song is locked
    if (targetTrack.isVIP && targetTrack.isLocked) {
      this.notifyUpdate({
        type: 'vip_locked_attempt',
        trackIndex: index,
        likedCount: this.getLikedCount()
      });
      return false; // Rejected
    }

    this.currentTrackIndex = index;
    this.synthStep = 0;

    // Requirement F1: resets playback to 0:00
    if (options.resetTime !== false) {
      this.currentTime = 0;
    }

    // Restart synth loop with new track tempo
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }

    if (options.autoPlay !== false) {
      this.play();
    } else {
      this.notifyUpdate({ type: 'trackchange' });
    }

    return true;
  }

  prevTrack() {
    let nextIdx = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    // Skip locked tracks if any
    if (this.tracks[nextIdx].isLocked) {
      nextIdx = (nextIdx - 1 + this.tracks.length) % this.tracks.length;
    }
    this.selectTrack(nextIdx, { autoPlay: this.isPlaying, resetTime: true });
  }

  nextTrack(loop = false) {
    let nextIdx = (this.currentTrackIndex + 1) % this.tracks.length;
    // If next track is locked VIP, loop to 0 or notify
    if (this.tracks[nextIdx].isLocked) {
      if (loop) {
        nextIdx = 0;
      } else {
        this.notifyUpdate({
          type: 'vip_locked_attempt',
          trackIndex: nextIdx,
          likedCount: this.getLikedCount()
        });
        return;
      }
    }
    this.selectTrack(nextIdx, { autoPlay: this.isPlaying, resetTime: true });
  }

  // ==========================================
  // F2: Like Counter (♥ Toggle)
  // ==========================================
  toggleLike(trackIndex) {
    if (trackIndex < 0 || trackIndex >= this.tracks.length) return;
    const track = this.tracks[trackIndex];

    // Cannot like an actively locked track before unlocking
    if (track.isLocked) {
      this.notifyUpdate({
        type: 'vip_locked_attempt',
        trackIndex: trackIndex,
        likedCount: this.getLikedCount()
      });
      return;
    }

    track.liked = !track.liked;
    const newLikedCount = this.getLikedCount();

    // ==========================================
    // F3: VIP Song Lock Gate Logic
    // ==========================================
    const vipTrack = this.tracks.find(t => t.isVIP);
    let vipStatusChanged = false;
    let fallbackTriggered = false;

    if (vipTrack) {
      if (newLikedCount >= 2) {
        // Unlock VIP
        if (vipTrack.isLocked) {
          vipTrack.isLocked = false;
          vipStatusChanged = true;
        }
      } else {
        // Relock VIP if likes drop below 2
        if (!vipTrack.isLocked) {
          vipTrack.isLocked = true;
          vipStatusChanged = true;

          // Requirement F3: If unliked below 2 while playing, it pauses and falls back to Track 1
          if (this.currentTrackIndex === this.tracks.indexOf(vipTrack)) {
            fallbackTriggered = true;
            this.pause();
            this.currentTrackIndex = 0;
            this.currentTime = 0;
          }
        }
      }
    }

    this.notifyUpdate({
      type: 'like_toggle',
      trackIndex: trackIndex,
      isLiked: track.liked,
      likedCount: newLikedCount,
      vipStatusChanged: vipStatusChanged,
      fallbackTriggered: fallbackTriggered
    });
  }

  // ==========================================
  // Smart Mute Memory & Canvas Audio Level
  // ==========================================
  toggleMute() {
    this.initAudioContext();

    if (!this.isMuted) {
      // Store current non-zero volume in memory
      if (this.volume > 0) {
        this.previousNonZeroVolume = this.volume;
      } else if (!this.previousNonZeroVolume) {
        this.previousNonZeroVolume = 0.70;
      }
      this.volume = 0;
      this.isMuted = true;
    } else {
      // Restore the exact previous non-zero volume (e.g. 70%), not 100%!
      this.volume = this.previousNonZeroVolume > 0 ? this.previousNonZeroVolume : 0.70;
      this.isMuted = false;
    }

    this.updateMasterGain();
    this.notifyUpdate({ type: 'volume_change', isMuted: this.isMuted, volume: this.volume });
  }

  setVolume(newVolume) {
    this.initAudioContext();
    const clamped = Math.max(0, Math.min(1, newVolume));

    if (clamped === 0) {
      // Dragging to 0% mutes and saves previous non-zero volume if we had one
      if (this.volume > 0) {
        this.previousNonZeroVolume = this.volume;
      }
      this.volume = 0;
      this.isMuted = true;
    } else {
      this.volume = clamped;
      this.previousNonZeroVolume = clamped;
      this.isMuted = false;
    }

    this.updateMasterGain();
    this.notifyUpdate({ type: 'volume_change', isMuted: this.isMuted, volume: this.volume });
  }

  // Reset to default initial state
  resetAll() {
    this.pause();
    this.currentTrackIndex = 0;
    this.currentTime = 0;
    this.volume = 0.70;
    this.previousNonZeroVolume = 0.70;
    this.isMuted = false;
    this.synthStep = 0;

    // Reset tracks: unliked, VIP locked
    this.tracks.forEach((track, idx) => {
      track.liked = false;
      if (track.isVIP) {
        track.isLocked = true;
      }
    });

    this.updateMasterGain();
    this.notifyUpdate({ type: 'reset' });
  }

  // Get frequency data for dynamic canvas visualizer
  getAudioVisualizerData() {
    if (!this.analyser || this.isMuted || this.volume <= 0) {
      return null;
    }
    this.analyser.getByteFrequencyData(this.frequencyData);
    return this.frequencyData;
  }
}

// Make globally accessible
window.SpotliteAudioEngine = SpotliteAudioEngine;
window.spotliteEngine = new SpotliteAudioEngine();
