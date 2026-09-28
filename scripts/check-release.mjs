// Read-only checks of the GitHub Pages entry point. No network or deployment.
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

function references(source, extension) {
  if (extension === '.html') {
    return Array.from(
      source.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g),
      (match) => match[1],
    );
  }
  if (extension === '.css') {
    return Array.from(
      source.matchAll(
        /(?:url\(\s*["']?|@import\s+["'])([^\s"')]+)["']?\s*\)?/g,
      ),
      (match) => match[1],
    );
  }
  // Imports, new URL() stylesheets and playlist paths currently use literal
  // relative strings. This is intentionally not a general JS/HTML parser.
  return Array.from(
    source.matchAll(
      /["']((?:\.\.?\/|\/)[^\s"']+\.(?:m?js|css|svg|png|webp|ico|mp3|m4a|ogg|wav)(?:[?#][^"']*)?)["']/g,
    ),
    (match) => match[1],
  );
}

export async function checkStaticRelease(root = projectRoot) {
  const errors = [];
  const visited = new Set();
  const moduleVersions = new Map();
  const queue = ['index.html'];
  while (queue.length) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    const absolute = path.resolve(root, file);
    let info;
    try {
      info = await stat(absolute);
      if (!info.isFile()) throw new Error('not a file');
    } catch {
      errors.push(`Missing local asset: ${file}`);
      continue;
    }
    const extension = path.extname(file);
    if (!['.html', '.css', '.js', '.mjs'].includes(extension)) continue;
    const source = await readFile(absolute, 'utf8');
    for (const reference of references(source, extension)) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) continue;
      if (reference.startsWith('/')) {
        errors.push(
          `${file}: root-relative URL breaks project Pages: ${reference}`,
        );
        continue;
      }
      const url = new URL(reference, pathToFileURL(absolute));
      const target = path.relative(root, fileURLToPath(url));
      if (
        target.startsWith('..' + path.sep) ||
        target === '..' ||
        path.isAbsolute(target)
      ) {
        errors.push(`${file}: asset escapes the site root: ${reference}`);
        continue;
      }
      if (/\.m?js$/.test(target)) {
        const versions = moduleVersions.get(target) ?? new Set();
        versions.add(url.search + url.hash);
        moduleVersions.set(target, versions);
      }
      queue.push(target);
    }
  }
  for (const [file, versions] of moduleVersions) {
    if (versions.size > 1) {
      errors.push(
        `Inconsistent module URLs for ${file}: ${Array.from(versions, (v) => v || '(unversioned)').join(', ')}`,
      );
    }
  }
  return {
    ok: errors.length === 0,
    filesChecked: visited.size,
    modulesChecked: moduleVersions.size,
    errors,
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await checkStaticRelease();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
