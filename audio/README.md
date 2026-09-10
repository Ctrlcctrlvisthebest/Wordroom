# Study playlist

The eight original `.m4a` files are preserved unchanged. The UUID-named files
contain Opus audio; `blue-hour-notes-v2.m4a` contains AAC audio.

The website streams `study-continuous-v1.m4a`: a 22:28 stereo AAC mix (32 kHz,
160 kbps, fast-start metadata). Original tracks were loudness-matched to about
-22 LUFS with extra endpoint silence trimmed. Adjacent tracks overlap for three
seconds using equal-power fades, including the last-to-first transition.

Chapter positions and translated labels are in `../wordroom-playlist.js`.
Automatic transitions are rendered into the mix, so background-tab timers do
not control them. Manual chapter changes use a short Web Audio fade when
available. Older browsers without Web Audio still play the continuous mix.

Playback is opt-in, uses native controls, and does not preload the mix on page
load. No audio is uploaded to the cloud-sync service. When adding or changing
tracks, regenerate the continuous mix and its chapter positions together, and
give the new asset a versioned filename to avoid stale browser caches.
