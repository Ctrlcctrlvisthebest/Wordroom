import { studyApp, escapeHTML } from './wordroom.js?v=multi1';
import { PLAYLIST } from './wordroom-playlist.js?v=832ab2edad3d';

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

  // iOS can reserve volume for hardware controls. Keep the native player
  // usable there instead of showing a custom slider that has no effect.
  try {
    audio.volume = 0.35;
    deviceVolume = Math.abs(audio.volume - 0.35) > 0.01;
  } catch {
    deviceVolume = true;
  }

  const title = (track) => track.title[app.getLocale()] || track.title.zh;
  function renderCurrent() {
    $('musicTrack').textContent = title(PLAYLIST.tracks[selected]);
    $('musicSelect').value = String(selected);
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
  // Never call load/play on initialization or language/theme/view changes.
  renderLabels();
}

startMusic(studyApp);
