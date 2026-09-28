"""Dependency-free safety tests for the local audio delivery generator."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location(
    'music_update', Path(__file__).resolve().parents[1] / 'scripts/update-music.py')
MUSIC = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MUSIC)


class MusicDeliveryTests(unittest.TestCase):
    def test_bitrate_and_track_order_have_different_immutable_keys(self):
        tracks = [dict(sourceHash='a' * 64), dict(sourceHash='b' * 64)]
        keys = {MUSIC.mix_fingerprint(tracks, rate) for rate in MUSIC.SUPPORTED_BITRATES}
        self.assertEqual(len(keys), len(MUSIC.SUPPORTED_BITRATES))
        self.assertNotEqual(MUSIC.mix_fingerprint(tracks, 112),
                            MUSIC.mix_fingerprint(tracks[::-1], 112))
        with self.assertRaises(ValueError):
            MUSIC.mix_fingerprint(tracks, 320)

    def test_existing_delivery_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            output, partial = Path(directory) / 'old.m4a', Path(directory) / 'new.m4a'
            output.write_bytes(b'original audio')
            partial.write_bytes(b'new audio')
            with self.assertRaisesRegex(ValueError, 'Refusing to overwrite'):
                MUSIC.publish_immutable(partial, output, MUSIC.digest(b'new audio'))
            self.assertEqual(output.read_bytes(), b'original audio')
            self.assertEqual(partial.read_bytes(), b'new audio')

    def test_identical_delivery_is_reusable_after_cache_loss(self):
        with tempfile.TemporaryDirectory() as directory:
            output, partial = Path(directory) / 'old.m4a', Path(directory) / 'new.m4a'
            output.write_bytes(b'same audio')
            partial.write_bytes(b'same audio')
            MUSIC.publish_immutable(partial, output, MUSIC.digest(b'same audio'))
            self.assertEqual(output.read_bytes(), b'same audio')
            self.assertFalse(partial.exists())

    def test_new_delivery_publishes_without_modifying_other_files(self):
        with tempfile.TemporaryDirectory() as directory:
            output, partial = Path(directory) / 'version.m4a', Path(directory) / 'partial.m4a'
            original = Path(directory) / 'original.m4a'
            original.write_bytes(b'original recording')
            partial.write_bytes(b'delivery')
            MUSIC.publish_immutable(partial, output, MUSIC.digest(b'delivery'))
            self.assertEqual(output.read_bytes(), b'delivery')
            self.assertEqual(original.read_bytes(), b'original recording')
            self.assertFalse(partial.exists())

    def test_lower_bandwidth_build_retains_timing_and_validates_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            audio, cache = root / 'audio', root / 'cache'
            audio.mkdir()
            cache.mkdir()
            tracks = [dict(id='one', original='one.wav'), dict(id='two', original='two.wav')]
            prepared = [dict(sourceHash='a' * 64, frames=MUSIC.RATE * 30, pcm='one.wav'),
                        dict(sourceHash='b' * 64, frames=MUSIC.RATE * 40, pcm='two.wav')]
            commands = []

            def fake_run(_ffmpeg, args):
                commands.append(args)
                if '-filter_complex' in args:
                    Path(args[-1]).write_bytes(b'validated aac delivery')
                    return ''
                return json.dumps(dict(input_i='-22', input_tp='-3', input_lra='8',
                                       input_thresh='-32', target_offset='0'))

            with patch.object(MUSIC, 'AUDIO', audio), patch.object(MUSIC, 'CACHE', cache), \
                    patch.object(MUSIC, 'run', fake_run):
                playlist, report = MUSIC.build('ffmpeg', tracks, prepared, 112)
                self.assertEqual(playlist['duration'], 64)
                self.assertEqual(playlist['crossfade'], 3)
                self.assertEqual(playlist['loopSwitchAt'], 62.5)
                self.assertEqual(playlist['tracks'][1]['cue'], 27)
                self.assertEqual(report['bitrateKbps'], 112)
                self.assertIn('112k', commands[0])
                self.assertIn('+faststart', commands[0])
                again, _ = MUSIC.build('ffmpeg', tracks, prepared, 112)
                self.assertEqual(again, playlist)
                self.assertEqual(len(commands), 2, 'valid cache must avoid encoding/measurement')
                (root / playlist['src'][2:]).write_bytes(b'modified delivery')
                with self.assertRaisesRegex(ValueError, 'changed unexpectedly'):
                    MUSIC.build('ffmpeg', tracks, prepared, 112)
                self.assertEqual((root / playlist['src'][2:]).read_bytes(), b'modified delivery')


if __name__ == '__main__':
    unittest.main()
