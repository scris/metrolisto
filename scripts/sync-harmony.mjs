import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
// Cloak serves this directory as http://localhost/ (see rawfile/config.json).
const www = path.join(root, 'harmony/entry/src/main/resources/rawfile/www');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html 不存在，请先运行 pnpm build。');
  process.exit(1);
}
fs.rmSync(www, { recursive: true, force: true });
fs.cpSync(dist, www, {
  recursive: true,
  filter: (source) => !path.basename(source).startsWith('.'),
});
console.log(`Harmony web assets: dist → ${path.relative(root, www)}`);
