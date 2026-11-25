/**
 * SPOTLITE • Application UI Controller
 * - Dynamic Canvas Audio Visualizer
 * - F1: Playlist Switcher & Canvas Visualizer
 * - F2: Like Counter (♥ Toggle)
 * - F3: VIP Song Lock Gate & Fallback
 * - Smart Mute Memory & Audio Level Amplitude Scaling
 * - Interactive Specs Modal & Customize Songs Modal
 */

document.addEventListener('DOMContentLoaded', () => {
  const engine = window.spotliteEngine;

  // DOM Elements - Human Verification Screen
  const verificationOverlay = document.getElementById('verification-overlay');
  const btnVerifyHuman = document.getElementById('btn-verify-human');
  const verifyBtnText = document.getElementById('verify-btn-text');

  // DOM Elements - Header
  const btnSpecs = document.getElementById('btn-header-specs');
  const btnReset = document.getElementById('btn-header-reset');
  const badgeLikedSongs = document.getElementById('badge-liked-songs');
  const likedCountText = document.getElementById('liked-count-text');

  // DOM Elements - Now Playing Hero
  const artworkWrapper = document.getElementById('artwork-wrapper');
  const artworkImg = document.getElementById('artwork-img');
  const trackHeroTitle = document.getElementById('track-hero-title');
  const trackHeroArtist = document.getElementById('track-hero-artist');
  const trackHeroGenre = document.getElementById('track-hero-genre');

  // DOM Elements - Visualizer
  const visualizerCanvas = document.getElementById('visualizer-canvas');
  const ctx = visualizerCanvas ? visualizerCanvas.getContext('2d') : null;

  // DOM Elements - Progress
  const timeCurrent = document.getElementById('time-current');
  const timeDuration = document.getElementById('time-duration');
  const progressBar = document.getElementById('progress-bar-interactive');
  const progressFill = document.getElementById('progress-fill');
  const progressThumb = document.getElementById('progress-thumb-handle');

  // DOM Elements - Playback Controls
  const btnPrev = document.getElementById('btn-prev');
  const btnPlayHero = document.getElementById('btn-play-hero');
  const iconPlayHero = document.getElementById('icon-play-hero');
  const btnNext = document.getElementById('btn-next');

  // DOM Elements - Volume & Smart Mute
  const btnSpeakerMute = document.getElementById('btn-speaker-mute');
  const volumeSliderTrack = document.getElementById('volume-slider-track');
  const volumeSliderFill = document.getElementById('volume-slider-fill');
  const volumePercentLabel = document.getElementById('volume-percent-label');

  // DOM Elements - Playlist
  const tracksContainer = document.getElementById('tracks-container');
  const btnCustomizeSongs = document.getElementById('btn-customize-songs');
  const labelPlaylistCount = document.getElementById('label-playlist-count');

  // DOM Elements - Modals & Toasts
  const modalSpecs = document.getElementById('modal-specs');
  const btnCloseSpecs = document.getElementById('btn-close-specs');
  const btnDismissSpecs = document.getElementById('btn-dismiss-specs');

  const modalCustomize = document.getElementById('modal-customize');
  const btnCloseCustomize = document.getElementById('btn-close-customize');
  const btnCancelCustomize = document.getElementById('btn-cancel-customize');
  const btnSaveCustomize = document.getElementById('btn-save-customize');
  const editSongsFormContainer = document.getElementById('edit-songs-form-container');

  const toastContainer = document.getElementById('toast-container');

  // High-DPI canvas resizing
  function setupCanvas() {
    if (!visualizerCanvas || !ctx) return;
    const rect = visualizerCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    visualizerCanvas.width = (rect.width || 460) * dpr;
    visualizerCanvas.height = (rect.height || 52) * dpr;
    ctx.scale(dpr, dpr);
  }
  setupCanvas();
  window.addEventListener('resize', setupCanvas);

  // ===================================================
  // DYNAMIC CANVAS AUDIO VISUALIZER
  // ===================================================
  let animFrameId = null;
  let wavePhase = 0;

  function renderVisualizer() {
    if (!visualizerCanvas || !ctx) return;

    const width = visualizerCanvas.getBoundingClientRect().width || 460;
    const height = visualizerCanvas.getBoundingClientRect().height || 52;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    const isPlaying = engine.isPlaying;
    const isMuted = engine.isMuted || engine.volume <= 0;
    const volumeLevel = isMuted ? 0 : engine.volume; // Proportional amplitude scaling

    // Number of segments/dots matching screenshot dotted green equalizer
    const numPoints = 48;
    const spacing = width / (numPoints - 1);

    wavePhase += isPlaying ? 0.08 : 0.02;

    // Retrieve real audio frequency data from Web Audio Analyser
    const freqData = engine.getAudioVisualizerData();

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // Draw dotted equalizer / waveform
    for (let i = 0; i < numPoints; i++) {
      const x = i * spacing;
      let amplitude = 0;

      if (isPlaying && !isMuted) {
        // Sample frequency data
        let freqFactor = 1;
        if (freqData && freqData.length > 0) {
          const binIndex = Math.floor((i / numPoints) * (freqData.length / 2));
          freqFactor = 0.5 + (freqData[binIndex] / 255) * 1.2;
        }

        // Multi-frequency harmonic synthesis
        const wave1 = Math.sin(wavePhase + i * 0.35);
        const wave2 = Math.cos(wavePhase * 1.3 + i * 0.5) * 0.5;
        const wave3 = Math.sin(wavePhase * 0.7 - i * 0.2) * 0.3;

        // Peak height scaled strictly by volume
        const maxDisplacement = (height * 0.42) * volumeLevel;
        amplitude = (wave1 + wave2 + wave3) * maxDisplacement * freqFactor;
      } else {
        // Flattened baseline when muted or paused
        amplitude = 0;
      }

      const y = centerY + amplitude;

      // Small segment / dot styling matching screenshot
      const segmentWidth = 4;
      const xStart = Math.max(2, x - segmentWidth / 2);
      const xEnd = Math.min(width - 2, x + segmentWidth / 2);

      // Gradient color based on playing/muted state
      if (isMuted) {
        ctx.strokeStyle = 'rgba(233, 20, 41, 0.4)'; // Subtle muted red resting line
      } else {
        ctx.strokeStyle = isPlaying ? '#1DB954' : 'rgba(29, 185, 84, 0.45)';
      }

      ctx.beginPath();
      ctx.moveTo(xStart, y);
      ctx.lineTo(xEnd, y);
      ctx.stroke();

      // Additional small vertical glow tick when playing with high volume
      if (isPlaying && !isMuted && Math.abs(amplitude) > 4 && i % 2 === 0) {
        ctx.strokeStyle = 'rgba(29, 185, 84, 0.35)';
        ctx.beginPath();
        ctx.moveTo(x, centerY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }

    animFrameId = requestAnimationFrame(renderVisualizer);
  }

  renderVisualizer();

  // ===================================================
  // TOAST NOTIFICATIONS
  // ===================================================
  function showToast(message, type = 'info', duration = 3200) {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `spotlite-toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'warning') icon = '🔒';
    if (type === 'success') icon = '✨';
    if (type === 'vip') icon = '👑';

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  // ===================================================
  // RENDER PLAYLIST TRACK ROWS
  // ===================================================
  function renderTracks(state) {
    if (!tracksContainer) return;
    tracksContainer.innerHTML = '';

    state.tracks.forEach((track, index) => {
      const isActive = index === state.trackIndex;
      const isLocked = track.isVIP && track.isLocked;

      const row = document.createElement('div');
      row.className = `track-row ${isActive ? 'is-active' : ''} ${isLocked ? 'is-locked-row' : ''}`;
      row.dataset.trackIndex = index;
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.setAttribute('aria-label', `${track.title} by ${track.artist}${isLocked ? ' (Locked VIP track)' : ''}`);

      // Left metadata
      const leftCol = document.createElement('div');
      leftCol.className = 'track-left-meta';

      const numSpan = document.createElement('span');
      numSpan.className = 'track-number';
      numSpan.textContent = index + 1;

      const titleCol = document.createElement('div');
      titleCol.className = 'track-titles-col';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'track-row-title';
      titleSpan.textContent = track.title;

      if (track.isVIP) {
        const vipTag = document.createElement('span');
        vipTag.className = 'badge-vip-tag';
        vipTag.textContent = 'VIP';
        titleSpan.appendChild(vipTag);
      }

      const artistSpan = document.createElement('span');
      artistSpan.className = 'track-row-artist';
      artistSpan.textContent = track.artist;

      titleCol.appendChild(titleSpan);
      titleCol.appendChild(artistSpan);
      leftCol.appendChild(numSpan);
      leftCol.appendChild(titleCol);

      // Right metadata
      const rightCol = document.createElement('div');
      rightCol.className = 'track-right-meta';

      const durSpan = document.createElement('span');
      durSpan.className = 'track-duration';
      durSpan.textContent = engine.formatTime(track.duration);

      // Heart / Lock Button
      const btnLike = document.createElement('button');
      btnLike.type = 'button';
      btnLike.className = `btn-track-like ${track.liked ? 'is-liked' : ''} ${isLocked ? 'is-locked-icon' : ''}`;
      btnLike.setAttribute('aria-label', isLocked ? 'Locked VIP Track' : (track.liked ? 'Unlike Track' : 'Like Track'));

      // If locked, show 🔒; once unlocked or normal track, show ♥
      btnLike.innerHTML = isLocked ? '🔒' : '♥';

      // Like click handler
      btnLike.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent row click
        if (isLocked) {
          triggerShake(row);
          showToast(`🔒 VIP Song Locked! You need to like at least 2 songs to unlock this track. (Current likes: ${state.likedCount}/2)`, 'warning');
        } else {
          engine.toggleLike(index);
        }
      });

      rightCol.appendChild(durSpan);
      rightCol.appendChild(btnLike);

      row.appendChild(leftCol);
      row.appendChild(rightCol);

      // Track row click (Playlist Switcher)
      row.addEventListener('click', () => {
        if (isLocked) {
          triggerShake(row);
          showToast(`🔒 VIP Song Locked! You need to like at least 2 songs to unlock this track. (Current likes: ${state.likedCount}/2)`, 'warning');
          return;
        }

        // F1 Requirement: Clicking any unlocked track row highlights it in Spotify green (#1DB954),
        // updates Now Playing artwork, title, artist, duration, resets playback to 0:00, and animates canvas
        engine.selectTrack(index, { autoPlay: true, resetTime: true });
      });

      tracksContainer.appendChild(row);
    });

    // Update playlist count header
    if (labelPlaylistCount) {
      const vipCount = state.tracks.filter(t => t.isVIP).length;
      labelPlaylistCount.textContent = `PLAYLIST ${state.tracks.length} TRACKS • ${vipCount} VIP`;
    }
  }

  function triggerShake(element) {
    if (!element) return;
    element.classList.remove('shake-row');
    void element.offsetWidth; // Force CSS reflow
    element.classList.add('shake-row');
    setTimeout(() => {
      element.classList.remove('shake-row');
    }, 600);
  }

  // ===================================================
  // ENGINE OBSERVER / UI SYNC
  // ===================================================
  engine.subscribe((state, eventMeta = {}) => {
    // 1. Liked Songs Badge
    if (likedCountText) {
      likedCountText.textContent = `Liked Songs: ${state.likedCount}`;
    }
    if (badgeLikedSongs) {
      badgeLikedSongs.classList.toggle('has-likes', state.likedCount > 0);
      if (eventMeta && eventMeta.type === 'like_toggle') {
        badgeLikedSongs.classList.add('pulse-badge');
        setTimeout(() => badgeLikedSongs.classList.remove('pulse-badge'), 450);
      }
    }

    // 2. Now Playing Hero Meta
    if (trackHeroTitle) trackHeroTitle.textContent = state.track.title;
    if (trackHeroArtist) trackHeroArtist.textContent = state.track.artist;
    if (trackHeroGenre) trackHeroGenre.textContent = state.track.genre;
    if (artworkImg) {
      artworkImg.src = state.track.art;
      artworkImg.alt = `${state.track.title} Artwork`;
    }
    if (artworkWrapper) {
      artworkWrapper.classList.toggle('is-playing', state.isPlaying);
    }

    // 3. Playback Controls
    if (iconPlayHero) {
      iconPlayHero.textContent = state.isPlaying ? '❚❚' : '▶';
      iconPlayHero.classList.toggle('is-paused', !state.isPlaying);
    }
    if (btnPlayHero) {
      btnPlayHero.setAttribute('aria-label', state.isPlaying ? 'Pause Track' : 'Play Track');
    }

    // 4. Progress bar & Time
    if (timeCurrent) timeCurrent.textContent = state.formattedCurrent;
    if (timeDuration) timeDuration.textContent = state.formattedDuration;
    if (progressFill) progressFill.style.width = `${state.progressPct}%`;
    if (progressThumb) progressThumb.style.left = `${state.progressPct}%`;

    // 5. Smart Mute & Volume
    if (btnSpeakerMute) {
      if (state.isMuted || state.volume === 0) {
        btnSpeakerMute.textContent = '🔇';
        btnSpeakerMute.classList.add('is-muted');
        btnSpeakerMute.setAttribute('aria-label', 'Unmute audio (restores previous volume)');
      } else {
        btnSpeakerMute.textContent = '🔊';
        btnSpeakerMute.classList.remove('is-muted');
        btnSpeakerMute.setAttribute('aria-label', 'Mute audio');
      }
    }

    if (volumeSliderFill) {
      volumeSliderFill.style.width = `${state.volumePercent}%`;
    }
    if (volumePercentLabel) {
      volumePercentLabel.textContent = `${state.volumePercent}%`;
    }

    // 6. Re-render Tracks List
    renderTracks(state);

    // 7. Update Live Specs Status
    updateSpecsLiveStatus(state);

    // 8. Event Toasts
    if (eventMeta && eventMeta.type === 'vip_locked_attempt') {
      const row = tracksContainer.querySelector(`[data-track-index="${eventMeta.trackIndex}"]`);
      if (row) triggerShake(row);
      showToast(`🔒 VIP Song Locked! You need to like at least 2 songs to unlock this track. (Current likes: ${eventMeta.likedCount}/2)`, 'warning');
    } else if (eventMeta && eventMeta.type === 'like_toggle') {
      if (eventMeta.vipStatusChanged && state.isVIPUnlocked) {
        showToast(`✨ VIP Song Unlocked! "Quantum Mirage" is now unlocked and playable!`, 'vip');
      }
      if (eventMeta.fallbackTriggered) {
        showToast(`⚠️ Liked songs fell below 2! VIP Track re-locked. Falling back to Track 1.`, 'warning', 4000);
      }
    } else if (eventMeta && eventMeta.type === 'reset') {
      showToast(`↺ Player reset to default initial state.`, 'info');
    }
  });

  // ===================================================
  // INTERACTION BINDINGS
  // ===================================================

  // Play / Pause Hero Button
  if (btnPlayHero) {
    btnPlayHero.addEventListener('click', () => engine.togglePlay());
  }

  // Prev / Next Buttons
  if (btnPrev) {
    btnPrev.addEventListener('click', () => engine.prevTrack());
  }
  if (btnNext) {
    btnNext.addEventListener('click', () => engine.nextTrack(false));
  }

  // Smart Mute Toggle
  if (btnSpeakerMute) {
    btnSpeakerMute.addEventListener('click', () => {
      engine.toggleMute();
    });
  }

  // Volume Slider Drag & Click
  function handleVolumeEvent(e) {
    if (!volumeSliderTrack) return;
    const rect = volumeSliderTrack.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    engine.setVolume(pct);
  }

  let isDraggingVolume = false;
  if (volumeSliderTrack) {
    volumeSliderTrack.addEventListener('mousedown', (e) => {
      isDraggingVolume = true;
      handleVolumeEvent(e);
    });

    volumeSliderTrack.addEventListener('touchstart', (e) => {
      isDraggingVolume = true;
      handleVolumeEvent(e);
    }, { passive: true });
  }

  window.addEventListener('mousemove', (e) => {
    if (isDraggingVolume) handleVolumeEvent(e);
  });

  window.addEventListener('touchmove', (e) => {
    if (isDraggingVolume) handleVolumeEvent(e);
  }, { passive: true });

  window.addEventListener('mouseup', () => { isDraggingVolume = false; });
  window.addEventListener('touchend', () => { isDraggingVolume = false; });

  // Progress Bar Seek
  function handleSeekEvent(e) {
    if (!progressBar) return;
    const rect = progressBar.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = pct * engine.tracks[engine.currentTrackIndex].duration;
    engine.seek(targetTime);
  }

  let isSeekingProgress = false;
  if (progressBar) {
    progressBar.addEventListener('mousedown', (e) => {
      isSeekingProgress = true;
      handleSeekEvent(e);
    });

    progressBar.addEventListener('touchstart', (e) => {
      isSeekingProgress = true;
      handleSeekEvent(e);
    }, { passive: true });
  }

  window.addEventListener('mousemove', (e) => {
    if (isSeekingProgress) handleSeekEvent(e);
  });

  window.addEventListener('mouseup', () => { isSeekingProgress = false; });
  window.addEventListener('touchend', () => { isSeekingProgress = false; });

  // Header Reset Button
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      engine.resetAll();
    });
  }

  // ===================================================
  // MODAL CONTROLLERS (Specs & Customize Songs)
  // ===================================================

  // 1. Specs Modal
  function openSpecsModal() {
    if (modalSpecs) modalSpecs.classList.add('is-open');
  }
  function closeSpecsModal() {
    if (modalSpecs) modalSpecs.classList.remove('is-open');
  }

  if (btnSpecs) btnSpecs.addEventListener('click', openSpecsModal);
  if (btnCloseSpecs) btnCloseSpecs.addEventListener('click', closeSpecsModal);
  if (btnDismissSpecs) btnDismissSpecs.addEventListener('click', closeSpecsModal);
  if (modalSpecs) {
    modalSpecs.addEventListener('click', (e) => {
      if (e.target === modalSpecs) closeSpecsModal();
    });
  }

  // Live status updater inside Specs Modal
  function updateSpecsLiveStatus(state) {
    const statusF1 = document.getElementById('status-f1');
    const statusF2 = document.getElementById('status-f2');
    const statusF3 = document.getElementById('status-f3');
    const statusMute = document.getElementById('status-mute');

    if (statusF1) {
      statusF1.innerHTML = `Active: Track ${state.trackIndex + 1} ("${state.track.title}") • Time: ${state.formattedCurrent} • Canvas: ${state.isPlaying && !state.isMuted ? 'Active Waveform' : 'Flatline'}`;
    }
    if (statusF2) {
      statusF2.innerHTML = `Liked Songs Count: ${state.likedCount} • Badge synced`;
    }
    if (statusF3) {
      const vipTrack = state.tracks.find(t => t.isVIP);
      statusF3.innerHTML = vipTrack && vipTrack.isLocked
        ? `🔒 VIP Track LOCKED (${state.likedCount}/2 likes). Shake & Toast active.`
        : `✨ VIP Track UNLOCKED! Playable like standard track.`;
    }
    if (statusMute) {
      statusMute.innerHTML = state.isMuted
        ? `🔇 MUTED (0%). Exact restore target memory: ${Math.round(state.previousNonZeroVolume * 100)}%`
        : `🔊 UNMUTED (${state.volumePercent}%). Memory set to: ${Math.round(state.previousNonZeroVolume * 100)}%`;
    }
  }

  // 2. Customize Songs Modal
  function openCustomizeModal() {
    if (!modalCustomize || !editSongsFormContainer) return;
    editSongsFormContainer.innerHTML = '';

    engine.tracks.forEach((track, idx) => {
      const itemBox = document.createElement('div');
      itemBox.className = 'edit-track-item';

      itemBox.innerHTML = `
        <div style="font-weight: 700; font-size: 11px; color: var(--spotify-green);">Track ${idx + 1} ${track.isVIP ? '[VIP]' : ''}</div>
        <div class="edit-input-row">
          <div class="edit-field-col">
            <span class="edit-label">Title</span>
            <input type="text" class="edit-input" id="edit-title-${idx}" value="${track.title}">
          </div>
          <div class="edit-field-col">
            <span class="edit-label">Artist</span>
            <input type="text" class="edit-input" id="edit-artist-${idx}" value="${track.artist}">
          </div>
        </div>
        <div class="edit-input-row">
          <div class="edit-field-col">
            <span class="edit-label">Genre</span>
            <input type="text" class="edit-input" id="edit-genre-${idx}" value="${track.genre}">
          </div>
          <div class="edit-field-col">
            <span class="edit-label">Duration (Sec)</span>
            <input type="number" class="edit-input" id="edit-duration-${idx}" value="${track.duration}" min="30" max="600">
          </div>
        </div>
      `;
      editSongsFormContainer.appendChild(itemBox);
    });

    modalCustomize.classList.add('is-open');
  }

  function closeCustomizeModal() {
    if (modalCustomize) modalCustomize.classList.remove('is-open');
  }

  if (btnCustomizeSongs) btnCustomizeSongs.addEventListener('click', openCustomizeModal);
  if (btnCloseCustomize) btnCloseCustomize.addEventListener('click', closeCustomizeModal);
  if (btnCancelCustomize) btnCancelCustomize.addEventListener('click', closeCustomizeModal);
  if (modalCustomize) {
    modalCustomize.addEventListener('click', (e) => {
      if (e.target === modalCustomize) closeCustomizeModal();
    });
  }

  if (btnSaveCustomize) {
    btnSaveCustomize.addEventListener('click', () => {
      engine.tracks.forEach((track, idx) => {
        const titleInput = document.getElementById(`edit-title-${idx}`);
        const artistInput = document.getElementById(`edit-artist-${idx}`);
        const genreInput = document.getElementById(`edit-genre-${idx}`);
        const durInput = document.getElementById(`edit-duration-${idx}`);

        if (titleInput && titleInput.value.trim()) track.title = titleInput.value.trim();
        if (artistInput && artistInput.value.trim()) track.artist = artistInput.value.trim();
        if (genreInput && genreInput.value.trim()) track.genre = genreInput.value.trim().toUpperCase();
        if (durInput && Number(durInput.value) > 0) track.duration = Number(durInput.value);
      });

      engine.notifyUpdate({ type: 'customized' });
      closeCustomizeModal();
      showToast('Track details updated successfully.', 'success');
    });
  }

  // ===================================================
  // HUMAN VERIFICATION SCREEN CONTROLLER
  // ===================================================
  if (btnVerifyHuman && verificationOverlay) {
    btnVerifyHuman.addEventListener('click', () => {
      // Initialize audio context smoothly on genuine user gesture
      engine.initAudioContext();

      // Visual feedback
      btnVerifyHuman.classList.add('is-verified');
      if (verifyBtnText) {
        verifyBtnText.innerHTML = 'VERIFIED ✓ &nbsp;ENTERING ARENA...';
      }

      // Smooth transition into the Spotlite website
      setTimeout(() => {
        verificationOverlay.classList.add('is-hidden');
        showToast('🛡️ Human Verified. Welcome to SPOTLITE!', 'success', 3500);

        setTimeout(() => {
          verificationOverlay.style.display = 'none';
        }, 520);
      }, 280);
    });
  }

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // If verification screen is active, disable shortcuts
    if (verificationOverlay && !verificationOverlay.classList.contains('is-hidden')) return;

    // If typing in an input, do not trigger shortcuts
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.code === 'Space') {
      e.preventDefault();
      engine.togglePlay();
    } else if (e.code === 'KeyM') {
      engine.toggleMute();
    } else if (e.code === 'ArrowLeft') {
      engine.seek(engine.currentTime - 5);
    } else if (e.code === 'ArrowRight') {
      engine.seek(engine.currentTime + 5);
    } else if (e.code === 'ArrowUp') {
      e.preventDefault();
      engine.setVolume(engine.volume + 0.05);
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      engine.setVolume(engine.volume - 0.05);
    } else if (e.code === 'Escape') {
      closeSpecsModal();
      closeCustomizeModal();
    }
  });
});
