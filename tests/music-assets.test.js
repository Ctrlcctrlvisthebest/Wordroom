import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PLAYLIST } from '../wordroom-playlist.js';

function boxes(buffer, start = 0, end = buffer.length) {
  const result = [];
  for (let offset = start; offset < end;) {
    assert(offset + 8 <= end, 'MP4 box has a complete header');
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      assert(offset + 16 <= end, 'large MP4 box has a complete header');
      size = Number(buffer.readBigUInt64BE(offset + 8));
      header = 16;
    } else if (size === 0) size = end - offset;
    assert(
      Number.isSafeInteger(size) && size >= header && offset + size <= end,
    );
    result.push({
      type,
      start: offset,
      payload: offset + header,
      end: offset + size,
    });
    offset += size;
  }
  return result;
}

void test('音乐使用可校验的轻量 AAC，元数据可先于整首音频加载', () => {
  assert.match(PLAYLIST.src, /^\.\/audio\/study-continuous-[a-f0-9]{12}\.m4a$/);
  const audio = readFileSync(
    new URL(`../${PLAYLIST.src.slice(2)}`, import.meta.url),
  );
  assert.equal(PLAYLIST.delivery.codec, 'aac');
  assert([96, 112, 160].includes(PLAYLIST.delivery.bitrateKbps));
  assert.equal(PLAYLIST.delivery.sampleRate, 32000);
  assert.equal(audio.length, PLAYLIST.delivery.bytes);
  assert.equal(
    createHash('sha256').update(audio).digest('hex'),
    PLAYLIST.delivery.sha256,
  );
  assert(audio.length < 95_000_000);
  const budget = (PLAYLIST.duration * PLAYLIST.delivery.bitrateKbps * 1000) / 8;
  assert(
    audio.length <= budget * 1.07 + 1024,
    'container overhead stays below 7%',
  );

  const root = boxes(audio);
  const metadata = root.find((box) => box.type === 'moov');
  const media = root.find((box) => box.type === 'mdat');
  assert(
    metadata && media && metadata.start < media.start,
    'faststart metadata comes first',
  );
  const header = boxes(audio, metadata.payload, metadata.end).find(
    (box) => box.type === 'mvhd',
  );
  assert(header, 'MP4 has a movie duration');
  const version = audio[header.payload];
  const scale = audio.readUInt32BE(header.payload + (version === 1 ? 20 : 12));
  const duration =
    version === 1
      ? Number(audio.readBigUInt64BE(header.payload + 24))
      : audio.readUInt32BE(header.payload + 16);
  assert(
    Math.abs(duration / scale - PLAYLIST.duration) < 0.1,
    'chapter timing matches encoded duration',
  );
});

void test('音乐仍按需加载、不自动播放，页面和播放列表引用同一版本', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const audio = html.match(/<audio\b[^>]*id="studyMusic"[^>]*>/)?.[0];
  assert(audio, 'music audio element exists');
  assert.match(audio, /preload="none"/);
  assert(!/\bautoplay\b/.test(audio));
  assert(audio.includes(`src="${PLAYLIST.src}"`));
});
