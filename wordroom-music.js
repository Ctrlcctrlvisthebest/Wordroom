import { studyApp, escapeHTML } from './wordroom.js?v=optimization1';
import { PLAYLIST } from './wordroom-playlist.js?v=af63d3da0184';

const MUSIC_TEXT = {
  zh: {
    toggle: '音乐',
    close: '收起音乐面板',
    title: '学习音乐',
    select: '曲目',
    prev: '上一首',
    next: '下一首',
    blend: `${PLAYLIST.tracks.length} 首 · 顺序循环 · 柔和衔接`,
    fallback: '你的浏览器不支持音频播放。',
    volume: '请用设备的音量键调整音量。',
    error: '暂时无法播放，请检查网络后重试。',
    retry: '重试播放',
    play: '播放音乐',
    pause: '暂停音乐',
    mute: '静音',
    unmute: '取消静音',
    seek: '播放进度',
    level: '音量',
  },
  en: {
    toggle: 'Music',
    close: 'Close music panel',
    title: 'Study music',
    select: 'Track',
    prev: 'Previous',
    next: 'Next',
    blend: `${PLAYLIST.tracks.length} tracks · Repeat playlist · Smooth transitions`,
    fallback: 'Your browser does not support audio playback.',
    volume: 'Use your device’s volume buttons to adjust the sound.',
    error: 'Audio could not play. Check your connection and try again.',
    retry: 'Retry playback',
    play: 'Play music',
    pause: 'Pause music',
    mute: 'Mute',
    unmute: 'Unmute',
    seek: 'Playback position',
    level: 'Volume',
  },
  es: {
    toggle: 'Música',
    close: 'Cerrar el panel de música',
    title: 'Música de estudio',
    select: 'Pista',
    prev: 'Anterior',
    next: 'Siguiente',
    blend: `${PLAYLIST.tracks.length} pistas · Repetir lista · Transiciones suaves`,
    fallback: 'Tu navegador no admite la reproducción de audio.',
    volume: 'Ajusta el volumen con los botones de tu dispositivo.',
    error:
      'No se pudo reproducir el audio. Revisa tu conexión e inténtalo de nuevo.',
    retry: 'Reintentar',
    play: 'Reproducir música',
    pause: 'Pausar música',
    mute: 'Silenciar',
    unmute: 'Activar sonido',
    seek: 'Posición de reproducción',
    level: 'Volumen',
  },
};

export function trackAtTime(time) {
  if (!Number.isFinite(time) || time < 0) return 0;
  const position = time % PLAYLIST.duration;
  if (position >= PLAYLIST.loopSwitchAt) return 0;
  for (let i = PLAYLIST.tracks.length - 1; i > 0; i--)
    if (position >= PLAYLIST.tracks[i].switchAt) return i;
  return 0;
}

export function startMusic(
  app,
  doc = globalThis.document,
  {
    createContext = () => {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      return Context ? new Context() : null;
    },
    schedule = globalThis.setTimeout,
    cancel = globalThis.clearTimeout,
  } = {},
) {
  const $ = (id) => doc?.querySelector(`#${id}`);
  const audio = $('studyMusic');
  if (!audio || !app) return;
  const widget = $('musicWidget');
  const controls = $('musicControls');
  const seekControl = $('musicSeek');
  const volumeControl = $('musicVolume');
  function closePanel(returnFocus = false) {
    widget.open = false;
    if (returnFocus) $('musicToggle').focus();
  }
  // Hiding the controls never recreates, pauses or reloads the audio element.
  $('musicClose').addEventListener('click', () => closePanel(true));
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && widget.open) {
      event.preventDefault();
      closePanel(true);
    }
  });
  doc.addEventListener('click', (event) => {
    if (widget.open && !widget.contains(event.target)) closePanel();
  });
  let failed = false;
  let retrying = false;
  let deviceVolume = false;
  let selected = 0;
  let pendingSeek = null;
  let jumping = false;
  let jumpId = 0;
  let jumpTimer = null;
  let fader = null;
  let faderPromise = null;
  let playPending = false;
  let playbackId = 0;
  let previewingSeek = false;

  // Some devices reserve volume for hardware controls; hide an ineffective slider.
  try {
    audio.volume = 0.35;
    deviceVolume = Math.abs(audio.volume - 0.35) > 0.01;
  } catch {
    deviceVolume = true;
  }

  const title = (track) => track.title[app.getLocale()] || track.title.zh;
  function renderCurrent() {
    $('musicTrack').textContent = title(PLAYLIST.tracks[selected]);
    if ($('musicTrackIndex'))
      $('musicTrackIndex').textContent =
        `${String(selected + 1).padStart(2, '0')} / ${PLAYLIST.tracks.length}`;
    $('musicSelect').value = String(selected);
  }
  function timestamp(seconds) {
    const time = Math.floor(Math.max(0, seconds));
    return `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`;
  }
  function renderTimeline() {
    if (!controls || previewingSeek) return;
    const duration = audio.duration;
    const ready =
      audio.readyState > 0 && Number.isFinite(duration) && duration > 0;
    const position = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    seekControl.disabled = !ready;
    seekControl.max = ready ? String(duration) : '1';
    seekControl.value = ready ? String(Math.min(position, duration)) : '0';
    seekControl.style.backgroundSize = `${ready ? Math.min(100, (position / duration) * 100) : 0}% 3px, 100% 3px`;
    $('musicElapsed').textContent = timestamp(position);
    $('musicDuration').textContent = ready ? timestamp(duration) : '—:—';
    seekControl.setAttribute(
      'aria-valuetext',
      ready ? `${timestamp(position)} / ${timestamp(duration)}` : '—:—',
    );
  }
  function renderPlayback() {
    if (!controls) return;
    const text = MUSIC_TEXT[app.getLocale()] || MUSIC_TEXT.zh;
    const playing = !audio.paused && !audio.ended;
    const muted = Boolean(audio.muted || audio.volume === 0);
    widget.dataset.playing = String(playing);
    widget.dataset.muted = String(muted);
    $('musicPlay').setAttribute('aria-label', playing ? text.pause : text.play);
    $('musicPlay').setAttribute('aria-busy', String(playPending));
    $('musicPlay').disabled = retrying;
    $('musicPlaybackLabel').textContent = playing ? text.pause : text.play;
    $('musicMute').setAttribute('aria-label', muted ? text.unmute : text.mute);
    $('musicMute').setAttribute('aria-pressed', String(muted));
    $('musicVolumeControls').hidden = deviceVolume;
    volumeControl.value = String(Math.round(audio.volume * 100));
    volumeControl.style.backgroundSize = `${muted ? 0 : audio.volume * 100}% 3px, 100% 3px`;
    volumeControl.setAttribute('aria-label', text.level);
    seekControl.setAttribute('aria-label', text.seek);
  }
  function renderLabels() {
    const text = MUSIC_TEXT[app.getLocale()] || MUSIC_TEXT.zh;
    $('musicToggleLabel').textContent = text.toggle;
    $('musicClose').setAttribute('aria-label', text.close);
    $('musicTitle').textContent = text.title;
    $('musicSelectLabel').textContent = text.select;
    $('musicSelect').innerHTML = PLAYLIST.tracks
      .map(
        (track, index) =>
          `<option value="${index}">${escapeHTML(title(track))}</option>`,
      )
      .join('');
    $('musicPrev').textContent = text.prev;
    $('musicNext').textContent = text.next;
    $('musicBlendHint').textContent = text.blend;
    renderCurrent();
    $('musicFallback').textContent = text.fallback;
    $('musicVolumeHint').textContent = text.volume;
    $('musicVolumeHint').hidden = !deviceVolume;
    $('musicStatus').textContent = failed ? text.error : '';
    $('musicError').hidden = !failed;
    $('musicRetry').textContent = text.retry;
    $('musicRetry').disabled = retrying;
    renderPlayback();
  }

  // Automatic crossfades are baked into one streaming AAC file, including
  // the last -> first transition. No second stream, timer drift or large
  // decoded album buffer can interrupt those transitions in background tabs.
  // Web Audio is needed only for a short fade when explicitly skipping songs.
  async function ensureFader() {
    if (fader) {
      await fader.context.resume();
      return fader;
    }
    if (!faderPromise) {
      faderPromise = (async () => {
        const context = createContext();
        if (!context) return null;
        // Do not reroute native audio until the user-initiated resume succeeds.
        await context.resume();
        const gain = context.createGain();
        gain.connect(context.destination);
        const source = context.createMediaElementSource(audio);
        source.connect(gain);
        fader = { context, gain };
        return fader;
      })().catch(() => null);
    }
    return faderPromise;
  }
  function ramp(value, duration) {
    if (!fader) return;
    const now = fader.context.currentTime;
    const param = fader.gain.gain;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else {
      const held = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(held, now);
    }
    param.linearRampToValueAtTime(value, now + duration);
  }
  function restoreSound() {
    ramp(1, 0.35);
  }
  function applySeek() {
    if (pendingSeek === null || audio.readyState === 0) return;
    try {
      const limit = Number.isFinite(audio.duration)
        ? audio.duration
        : PLAYLIST.duration;
      audio.currentTime = Math.max(0, Math.min(pendingSeek, limit - 0.05));
      pendingSeek = null;
      jumping = false;
    } catch {
      // Metadata can arrive before the seekable range; retry on canplay.
    }
  }
  async function choose(index) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= PLAYLIST.tracks.length
    ) {
      renderCurrent();
      return;
    }
    selected = index;
    jumping = true;
    const ticket = ++jumpId;
    cancel(jumpTimer);
    renderCurrent();
    const seek = () => {
      if (ticket !== jumpId) return;
      pendingSeek = PLAYLIST.tracks[index].cue;
      applySeek();
      if (audio.readyState === 0) {
        audio.preload = 'metadata';
        if (audio.networkState !== 2) audio.load();
      }
      if (audio.paused) restoreSound();
    };
    if (audio.paused || audio.ended) {
      seek();
      restoreSound();
      return;
    }
    const activeFader = await ensureFader().catch(() => null);
    if (ticket !== jumpId) return;
    if (!activeFader || audio.paused) {
      // Very old browsers still get the rendered automatic transitions.
      seek();
      restoreSound();
      return;
    }
    ramp(0, 0.18);
    jumpTimer = schedule(seek, 200);
  }

  $('musicSelect').addEventListener('change', () =>
    choose(Number($('musicSelect').value)),
  );
  $('musicPrev').addEventListener('click', () =>
    choose((selected + PLAYLIST.tracks.length - 1) % PLAYLIST.tracks.length),
  );
  $('musicNext').addEventListener('click', () =>
    choose((selected + 1) % PLAYLIST.tracks.length),
  );
  audio.addEventListener('timeupdate', () => {
    if (jumping) return;
    const index = trackAtTime(audio.currentTime);
    if (index !== selected) {
      selected = index;
      renderCurrent();
    }
  });
  audio.addEventListener('loadedmetadata', applySeek);
  audio.addEventListener('canplay', applySeek);
  audio.addEventListener('seeking', () => {
    // A native timeline drag takes precedence over a skip still fading out.
    // Our own seeks clear `jumping` before the browser dispatches this event.
    if (!jumping) return;
    ++jumpId;
    cancel(jumpTimer);
    pendingSeek = null;
    jumping = false;
    selected = trackAtTime(audio.currentTime);
    renderCurrent();
    restoreSound();
  });
  audio.addEventListener('seeked', () => {
    if (!jumping) restoreSound();
  });
  audio.addEventListener('pause', restoreSound);
  audio.addEventListener('play', () => {
    if (fader)
      fader.context.resume().catch(() => {
        failed = true;
        renderLabels();
      });
  });

  audio.addEventListener('error', () => {
    ++jumpId;
    cancel(jumpTimer);
    jumping = false;
    restoreSound();
    failed = true;
    renderLabels();
  });
  audio.addEventListener('playing', () => {
    if (!jumping) restoreSound();
    failed = false;
    renderLabels();
  });
  $('musicRetry').addEventListener('click', async () => {
    if (retrying) return;
    retrying = true;
    failed = false;
    renderLabels();
    try {
      if (fader) await fader.context.resume();
      pendingSeek ??= Number.isFinite(audio.currentTime)
        ? audio.currentTime
        : PLAYLIST.tracks[selected].cue;
      audio.load();
      await audio.play();
    } catch (error) {
      // Pausing while loading is an intentional cancellation, not a failure.
      failed = error?.name !== 'AbortError';
    } finally {
      retrying = false;
      renderLabels();
    }
  });
  $('languageSelect').addEventListener('change', renderLabels);
  if (controls && seekControl && volumeControl) {
    $('musicPlay').addEventListener('click', async () => {
      if (playPending || !audio.paused) {
        ++playbackId;
        playPending = false;
        audio.pause();
        renderPlayback();
        return;
      }
      playPending = true;
      const ticket = ++playbackId;
      renderPlayback();
      try {
        if (fader) await fader.context.resume();
        if (ticket !== playbackId) return;
        await audio.play();
      } catch (error) {
        if (ticket === playbackId) failed = error?.name !== 'AbortError';
      } finally {
        if (ticket === playbackId) {
          playPending = false;
          renderLabels();
        }
      }
    });
    seekControl.addEventListener('input', () => {
      previewingSeek = true;
      const value = Number(seekControl.value);
      if (!Number.isFinite(value)) return;
      $('musicElapsed').textContent = timestamp(value);
      seekControl.setAttribute('aria-valuetext', timestamp(value));
      seekControl.style.backgroundSize = `${(value / Number(seekControl.max)) * 100}% 3px, 100% 3px`;
    });
    seekControl.addEventListener('change', () => {
      previewingSeek = false;
      const value = Number(seekControl.value);
      if (
        !seekControl.disabled &&
        Number.isFinite(value) &&
        Number.isFinite(audio.duration)
      ) {
        // A direct user seek wins over a delayed crossfade jump.
        ++jumpId;
        cancel(jumpTimer);
        pendingSeek = null;
        jumping = false;
        try {
          audio.currentTime = Math.max(
            0,
            Math.min(value, audio.duration - 0.05),
          );
          selected = trackAtTime(audio.currentTime);
          renderCurrent();
          restoreSound();
        } catch {
          /* Keep the last valid position until the media is seekable. */
        }
      }
      renderTimeline();
    });
    seekControl.addEventListener('blur', () => {
      previewingSeek = false;
      renderTimeline();
    });
    volumeControl.addEventListener('input', () => {
      const value = Number(volumeControl.value);
      if (!Number.isFinite(value) || deviceVolume) return;
      try {
        audio.volume = Math.max(0, Math.min(1, value / 100));
        audio.muted = false;
      } catch {
        deviceVolume = true;
        renderLabels();
      }
      renderPlayback();
    });
    $('musicMute').addEventListener('click', () => {
      const muted = audio.muted || audio.volume === 0;
      if (muted && audio.volume === 0 && !deviceVolume) audio.volume = 0.35;
      audio.muted = !muted;
      renderPlayback();
    });
    for (const name of ['play', 'pause', 'playing', 'ended', 'volumechange'])
      audio.addEventListener(name, renderPlayback);
    for (const name of [
      'timeupdate',
      'loadedmetadata',
      'durationchange',
      'emptied',
      'seeked',
    ])
      audio.addEventListener(name, renderTimeline);
    // Progressive enhancement: the original controls survive missing JavaScript.
    audio.controls = false;
    audio.hidden = true;
    controls.hidden = false;
    renderTimeline();
  }
  // Never call load/play on initialization or language/theme/view changes.
  renderLabels();
}

startMusic(studyApp);
