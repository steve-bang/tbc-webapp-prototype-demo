// Chụp screenshot mockup (light + dark).
// Dùng:  node design/staff-app/tools/screenshot.mjs screens/S-001-*.html [file2 ...] [--width=1440] [--theme=light|dark] [--out=dir]
// Chạy từ bất kỳ thư mục nào; đường dẫn tương đối được tính theo cwd, nếu không thấy thì theo design/staff-app/.
// Không tham số: chụp mọi screens/S-*.html. Kết quả: screenshots/<tên>.light.png và <tên>.dark.png (full page, DPR 2).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const inputs = args.filter(a => !a.startsWith('--'));
const width = parseInt(opt.width || '1440', 10);
const themes = opt.theme ? [opt.theme] : ['light', 'dark'];
const outDir = path.resolve(opt.out || path.join(ROOT, 'screenshots'));

function expand(p) {
  const cands = [path.resolve(p), path.resolve(ROOT, p)];
  for (const c of cands) {
    const dir = path.dirname(c), base = path.basename(c);
    if (!base.includes('*')) { if (fs.existsSync(c)) return [c]; continue; }
    if (!fs.existsSync(dir)) continue;
    const re = new RegExp('^' + base.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    const hit = fs.readdirSync(dir).filter(f => re.test(f)).sort().map(f => path.join(dir, f));
    if (hit.length) return hit;
  }
  return [];
}
let files = (inputs.length ? inputs : ['screens/S-*.html']).flatMap(expand);
files = [...new Set(files)];
if (!files.length) { console.error('Không có file nào khớp.'); process.exit(1); }

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const f of files) {
    const name = path.basename(f).replace(/\.html$/, '');
    for (const theme of themes) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2, colorScheme: theme });
      const page = await ctx.newPage();
      await page.goto(pathToFileURL(f).href + '?theme=' + theme, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await page.waitForTimeout(150);
      const out = path.join(outDir, `${name}.${theme}.png`);
      await page.screenshot({ path: out, fullPage: true });
      console.log('OK', path.relative(process.cwd(), out));
      await ctx.close();
    }
  }
} finally { await browser.close(); }
