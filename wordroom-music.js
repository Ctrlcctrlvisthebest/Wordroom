import { studyApp } from './wordroom.js?v=multi1';

const MUSIC_TEXT = {
  zh: {
    title: '学习音乐',
    track: '蓝时笔记 · 第二版',
    fallback: '你的浏览器不支持音频播放。',
    volume: '请用设备的音量键调整音量。',
    error: '暂时无法播放，请检查网络后重试。',
    retry: '重试播放',
  },
  en: {
    title: 'Study music',
    track: 'Blue Hour Notes · v2',
    fallback: 'Your browser does not support audio playback.',
    volume: 'Use your device’s volume buttons to adjust the sound.',
    error: 'Audio could not play. Check your connection and try again.',
    retry: 'Retry playback',
  },
  es: {
    title: 'Música de estudio',
    track: 'Blue Hour Notes · v2',
    fallback: 'Tu navegador no admite la reproducción de audio.',
    volume: 'Ajusta el volumen con los botones de tu dispositivo.',
    error:
      'No se pudo reproducir el audio. Revisa tu conexión e inténtalo de nuevo.',
    retry: 'Reintentar',
  },
};

export function startMusic(app, doc = globalThis.document) {
  const $ = (id) => doc?.querySelector(`#${id}`);
  const audio = $('studyMusic');
  if (!audio || !app) return;
  let failed = false;
  let retrying = false;
  let deviceVolume = false;

  // iOS can reserve volume for hardware controls. Keep the native player
  // usable there instead of showing a custom slider that has no effect.
  try {
    audio.volume = 0.35;
    deviceVolume = Math.abs(audio.volume - 0.35) > 0.01;
  } catch {
    deviceVolume = true;
  }

  function renderLabels() {
    const text = MUSIC_TEXT[app.getLocale()] || MUSIC_TEXT.zh;
    $('musicTitle').textContent = text.title;
    $('musicTrack').textContent = text.track;
    $('musicFallback').textContent = text.fallback;
    $('musicVolumeHint').textContent = text.volume;
    $('musicVolumeHint').hidden = !deviceVolume;
    $('musicStatus').textContent = failed ? text.error : '';
    $('musicError').hidden = !failed;
    $('musicRetry').textContent = text.retry;
    $('musicRetry').disabled = retrying;
  }

  audio.addEventListener('error', () => {
    failed = true;
    renderLabels();
  });
  audio.addEventListener('playing', () => {
    failed = false;
    renderLabels();
  });
  $('musicRetry').addEventListener('click', async () => {
    if (retrying) return;
    retrying = true;
    failed = false;
    renderLabels();
    try {
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
