// GitHub Pages preview only: do not load vite.config.ts (the older React app).
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const port = Number(process.argv[2] ?? 4174);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('Choose a local preview port between 1024 and 65535.');
}
const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('..', import.meta.url)),
  server: { host: '127.0.0.1', port, strictPort: true },
  appType: 'mpa',
});
await server.listen();
server.printUrls();
