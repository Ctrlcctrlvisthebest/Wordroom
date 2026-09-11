#!/usr/bin/env python3
"""Rebuild Wordroom's playlist locally. Requires Python 3 and FFmpeg, no pip packages.

Originals are read-only. Cached normalization is keyed by content and recipe.
Website references are updated only after the new continuous mix passes checks.
This command never commits, pushes, deploys, or deletes old audio versions.
"""
import concurrent.futures
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import wave

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'audio'
CACHE = ROOT / 'work/music-cache'
RATE, FADE = 32000, 3
RECIPE = 'pcm-loudnorm-22-tp4-trim48-qsin3-v1'
EXTENSIONS = {'.m4a', '.mp3', '.wav', '.ogg', '.opus', '.flac', '.aac'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_changed(path, text):
    if path.exists() and path.read_text() == text:
        return
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent,
                                     prefix='.music-', delete=False) as temp:
        temp.write(text)
        temporary = Path(temp.name)
    temporary.replace(path)


def run(ffmpeg, args):
    result = subprocess.run([ffmpeg, '-hide_banner', '-nostdin', '-nostats', *args],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-3000:])
    return result.stderr


def loudness(log):
    stats = json.loads(log[log.rfind('{'):log.rfind('}') + 1])
    if not all(math.isfinite(float(stats[key])) for key in
               ('input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset')):
        raise ValueError('Silent or invalid audio; the website was not changed.')
    return stats


def discover():
    tracks = json.loads((AUDIO / 'tracks.json').read_text())
    files = {p.name: p for p in AUDIO.iterdir() if p.is_file()
             and p.suffix.lower() in EXTENSIONS and not p.name.startswith('study-continuous-')}
    known = set()
    ids = set()
    for track in tracks:
        name = track['original']
        if name not in files or name in known or track['id'] in ids:
            raise ValueError('Missing or duplicate catalog entry: ' + name)
        if not all(isinstance(track['title'].get(lang), str) and track['title'][lang].strip()
                   for lang in ('zh', 'en', 'es')):
            raise ValueError('Missing translated title: ' + name)
        known.add(name)
        ids.add(track['id'])
    for name in sorted(files.keys() - known):
        stem = files[name].stem
        number = len(tracks) + 1
        uuid = re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', stem)
        titles = dict(zh=f'曲目 {number:02}', en=f'Track {number:02}', es=f'Pista {number:02}')
        if not uuid:
            titles = {lang: stem for lang in ('zh', 'en', 'es')}
        identifier = stem if stem not in ids else digest(name.encode())[:16]
        tracks.append(dict(id=identifier, original=name, title=titles))
        ids.add(identifier)
    if len(tracks) < 2:
        raise ValueError('The continuous playlist needs at least two tracks.')
    for track in tracks:
        if files[track['original']].stat().st_size >= 95_000_000:
            raise ValueError('Original is too large for this GitHub workflow: ' + track['original'])
    return tracks


def prepare(ffmpeg, track):
    source = AUDIO / track['original']
    source_hash = digest(source.read_bytes())
    key = digest((RECIPE + source_hash).encode())
    target, report = CACHE / (key + '.wav'), CACHE / (key + '.json')
    if target.exists() and report.exists():
        try:
            data = json.loads(report.read_text())
            with wave.open(str(target), 'rb') as pcm:
                valid = (pcm.getframerate() == RATE and pcm.getnchannels() == 2
                         and pcm.getnframes() == data['frames'])
            if valid:
                print('Cached: ' + source.name, flush=True)
                return dict(data, pcm=str(target), sourceHash=source_hash)
        except (ValueError, KeyError, EOFError, wave.Error):
            pass
    measure = 'loudnorm=I=-22:TP=-4:LRA=20:print_format=json'
    log = run(ffmpeg, ['-i', str(source), '-map', '0:a:0', '-af',
                      'silencedetect=noise=-48dB:d=0.2,' + measure, '-f', 'null', '-'])
    stats = loudness(log)
    duration_match = re.search(r'Duration: (\d+):(\d+):([\d.]+)', log)
    if not duration_match:
        raise ValueError('Cannot determine duration: ' + source.name)
    hours, minutes, seconds = map(float, duration_match.groups())
    duration = hours * 3600 + minutes * 60 + seconds
    leading, trailing = 0.0, duration
    starts = list(map(float, re.findall(r'silence_start: ([\d.]+)', log)))
    ends = list(map(float, re.findall(r'silence_end: ([\d.]+)', log)))
    if starts and ends and starts[0] < .05:
        leading = max(0, ends[0] - .06)
    if starts and ends and ends[-1] >= duration - .1:
        trailing = min(duration, starts[-1] + .08)
    length = trailing - leading
    if length <= FADE * 2 + 2 or float(stats['input_i']) < -70:
        raise ValueError('Track is silent or too short: ' + source.name)
    norm = ('loudnorm=I=-22:TP=-4:LRA=20:linear=true:'
            f'measured_I={stats["input_i"]}:measured_TP={stats["input_tp"]}:'
            f'measured_LRA={stats["input_lra"]}:measured_thresh={stats["input_thresh"]}:'
            f'offset={stats["target_offset"]}')
    filters = (f'atrim=start={leading}:end={trailing},asetpts=PTS-STARTPTS,{norm},'
               f'afade=t=in:st=0:d=0.02,afade=t=out:st={length-.03}:d=0.03')
    partial = CACHE / (key + '.partial.wav')
    run(ffmpeg, ['-y', '-i', str(source), '-map', '0:a:0', '-vn', '-af', filters,
                 '-ar', str(RATE), '-ac', '2', '-c:a', 'pcm_s16le', '-map_metadata', '-1', str(partial)])
    measured = loudness(run(ffmpeg, ['-i', str(partial), '-af', measure, '-f', 'null', '-']))
    if abs(float(measured['input_i']) + 22) > 1 or float(measured['input_tp']) > -2.9:
        raise ValueError('Loudness validation failed: ' + source.name)
    with wave.open(str(partial), 'rb') as pcm:
        frames = pcm.getnframes()
    data = dict(frames=frames, loudness=float(measured['input_i']),
                truePeak=float(measured['input_tp']), trimStart=leading, trimEnd=duration-trailing)
    partial.replace(target)
    write_changed(report, json.dumps(data, indent=2) + '\n')
    print('Normalized: ' + source.name, flush=True)
    return dict(data, pcm=str(target), sourceHash=source_hash)


def build(ffmpeg, tracks, prepared):
    fingerprint = digest((RECIPE + ''.join(track['sourceHash'] for track in prepared)).encode())[:12]
    output = AUDIO / f'study-continuous-{fingerprint}.m4a'
    total_frames = sum(track['frames'] for track in prepared) - len(tracks) * FADE * RATE
    duration = total_frames / RATE
    if duration * 21000 >= 95_000_000:
        raise ValueError('Mix would approach GitHub file limits; split the playlist or use audio hosting.')
    mix_report = CACHE / (fingerprint + '-mix.json')
    if output.exists() and mix_report.exists():
        report = json.loads(mix_report.read_text())
        if report.get('sha256') != digest(output.read_bytes()):
            raise ValueError('Existing generated mix changed unexpectedly: ' + output.name)
        print('Reusing validated continuous mix.', flush=True)
    else:
        # Append the first track again, then take exactly one rotated cycle.
        # This includes the last-to-first crossfade without a silent file tail.
        inputs = prepared + prepared[:1]
        args = ['-y']
        for track in inputs:
            args += ['-i', track['pcm']]
        graph, previous = [], '[0:a]'
        for index in range(1, len(inputs)):
            label = f'[mix{index}]'
            graph.append(f'{previous}[{index}:a]acrossfade=d={FADE}:c1=qsin:c2=qsin{label}')
            previous = label
        graph.append(f'{previous}atrim=start_sample={FADE*RATE}:end_sample={FADE*RATE+total_frames},asetpts=PTS-STARTPTS[out]')
        partial = CACHE / (fingerprint + '.partial.m4a')
        print(f'Rendering {len(tracks)} tracks with {FADE}s circular crossfades…', flush=True)
        run(ffmpeg, args + ['-filter_complex', ';'.join(graph), '-map', '[out]',
                           '-ar', str(RATE), '-ac', '2', '-c:a', 'aac', '-b:a', '160k',
                           '-map_metadata', '-1', '-movflags', '+faststart', str(partial)])
        stats = loudness(run(ffmpeg, ['-i', str(partial), '-af',
                         'loudnorm=I=-22:TP=-1:LRA=20:print_format=json', '-f', 'null', '-']))
        if abs(float(stats['input_i']) + 22) > 1 or float(stats['input_tp']) >= -1:
            raise ValueError('Final mix failed loudness/peak checks; website references unchanged.')
        if partial.stat().st_size >= 95_000_000:
            raise ValueError('Final mix exceeds the safe GitHub file-size limit.')
        report = dict(duration=duration, tracks=len(tracks), loudness=stats['input_i'],
                      truePeak=stats['input_tp'], sha256=digest(partial.read_bytes()))
        partial.replace(output)
        write_changed(mix_report, json.dumps(report, indent=2) + '\n')
    chapters, cursor = [], 0
    for track, data in zip(tracks, prepared):
        start = max(0, (cursor - FADE * RATE) / RATE)
        chapters.append(dict(track, start=round(start, 5),
                             switchAt=round(start + (FADE / 2 if cursor else 0), 5),
                             cue=round(start + (FADE if cursor else 0), 5)))
        cursor += data['frames'] - FADE * RATE
    return dict(src='./audio/' + output.name, duration=round(duration, 5), crossfade=FADE,
                loopSwitchAt=round(duration - FADE / 2, 5), tracks=chapters), report


def replace_one(pattern, replacement, text):
    result, count = re.subn(pattern, lambda _: replacement, text)
    if count != 1:
        raise ValueError('Expected one website reference matching: ' + pattern)
    return result


def main():
    ffmpeg = os.environ.get('FFMPEG_BIN') or shutil.which('ffmpeg')
    if not ffmpeg:
        bundled = ROOT / 'work/music-tools/ffmpeg'
        if bundled.is_file():
            ffmpeg = str(bundled)
    if not ffmpeg:
        raise ValueError('Install FFmpeg or set FFMPEG_BIN to its executable path, then retry.')
    CACHE.mkdir(parents=True, exist_ok=True)
    # Atomic mkdir also prevents two local update commands from racing.
    lock = CACHE / 'update.lock'
    try:
        lock.mkdir()
    except FileExistsError:
        raise ValueError('An update is already running. If it crashed, remove work/music-cache/update.lock and retry.')
    try:
        tracks = discover()
        print(f'Found {len(tracks)} tracks. Original files remain unchanged.', flush=True)
        source_hashes = [digest((AUDIO / track['original']).read_bytes()) for track in tracks]
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            # Two differently named copies share one job, not two writers to
            # the same cache file. Their playlist entries remain independent.
            jobs = {}
            for track, source_hash in zip(tracks, source_hashes):
                if source_hash not in jobs:
                    jobs[source_hash] = pool.submit(prepare, ffmpeg, track)
            prepared = [jobs[source_hash].result() for source_hash in source_hashes]
        for track, data in zip(tracks, prepared):
            if digest((AUDIO / track['original']).read_bytes()) != data['sourceHash']:
                raise ValueError('Audio changed during processing; finish copying it and retry: ' + track['original'])
        playlist, report = build(ffmpeg, tracks, prepared)
        catalog = json.dumps(tracks, ensure_ascii=False, indent=2) + '\n'
        manifest = '// Generated by npm run music:update. Edit audio/tracks.json for names/order.\n'
        manifest += 'export const PLAYLIST = ' + json.dumps(playlist, ensure_ascii=False, indent=2) + ';\n'
        version = digest(manifest.encode())[:12]
        music = replace_one(r'\./wordroom-playlist\.js\?v=[^\x27\x22]+',
                            './wordroom-playlist.js?v=' + version, (ROOT / 'wordroom-music.js').read_text())
        html = replace_one(r'src="\./audio/study-continuous-[^"]+"',
                           'src="' + playlist['src'] + '"', (ROOT / 'index.html').read_text())
        html = replace_one(r'src="\./wordroom-music\.js\?v=[^"]+"',
                           'src="./wordroom-music.js?v=' + digest(music.encode())[:12] + '"', html)
        html = replace_one(r'(<p id="musicBlendHint">)[\s\S]*?(</p>)',
                           f'<p id="musicBlendHint">{len(tracks)} 首 · 顺序循环 · 柔和衔接</p>', html)
        # Preflight all replacements before touching any website text.
        for path, content in [(AUDIO / 'tracks.json', catalog), (ROOT / 'wordroom-playlist.js', manifest),
                              (ROOT / 'wordroom-music.js', music), (ROOT / 'index.html', html)]:
            write_changed(path, content)
        print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
        print('Ready locally. Review/test, then commit and publish separately.', flush=True)
    finally:
        lock.rmdir()


if __name__ == '__main__':
    try:
        main()
    except (ValueError, RuntimeError, OSError, KeyError) as error:
        print('Music update failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
