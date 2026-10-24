// Checks every built page at phone/tablet/desktop widths.
//   npm run build && npm test
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SHOTS = process.env.SHOTS_DIR || path.join(ROOT, 'test-screens');
const WIDTHS = [360, 390, 430, 768, 1440];
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.txt': 'text/plain' };

const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const body = await fs.readFile(path.join(DIST, p));
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/html' });
    res.end(await fs.readFile(path.join(DIST, '404.html')));
  }
}).listen(0);
const base = `http://localhost:${server.address().port}`;

async function walk(dir, out = []) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (e.name === 'index.html') out.push('/' + path.relative(DIST, path.dirname(p)).replace(/\\/g, '/') + (path.dirname(p) === DIST ? '' : '/'));
  }
  return out;
}
const routes = (await walk(DIST)).map((r) => r.replace('//', '/')).sort();
await fs.mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch();
const problems = [];
const seenLinks = new Set();
for (const w of WIDTHS) {
  const page = await browser.newPage({ viewport: { width: w, height: w < 800 ? 820 : 900 } });
  page.on('pageerror', (e) => problems.push(`[${w}] JS error: ${e.message}`));
  for (const r of routes) {
    const resp = await page.goto(base + r, { waitUntil: 'networkidle' });
    if (resp.status() !== 200) problems.push(`[${w}] ${r} → HTTP ${resp.status()}`);
    // Load lazy images
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } window.scrollTo(0, 0); });
    await page.waitForLoadState('networkidle');
    const info = await page.evaluate(() => {
      const doc = document.documentElement;
      const over = [...document.querySelectorAll('body *')].filter((el) => { const b = el.getBoundingClientRect(); return b.width && (b.right > doc.clientWidth + 1 || b.left < -1) && getComputedStyle(el).position !== 'fixed' && !el.closest('dialog,.skip'); }).slice(0, 5).map((el) => el.className || el.tagName);
      const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src);
      const smallTargets = [...document.querySelectorAll('main a, header a, header button, footer a, main button')].filter((a) => { const b = a.getBoundingClientRect(); return b.width > 0 && b.height > 0 && (b.height < 24 || b.width < 24) && getComputedStyle(a).display !== 'inline'; }).map((a) => a.textContent.trim().slice(0, 30));
      const noAlt = [...document.images].filter((i) => !i.hasAttribute('alt')).length;
      const h1 = document.querySelectorAll('h1').length;
      const links = [...document.querySelectorAll('a[href]')].map((a) => a.href).filter((h) => h.startsWith(location.origin));
      return { scrollW: doc.scrollWidth, clientW: doc.clientWidth, over, broken, smallTargets, noAlt, h1, links, title: document.title, desc: document.querySelector('meta[name=description]')?.content, canonical: document.querySelector('link[rel=canonical]')?.href, ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { JSON.parse(s.textContent); return true; } catch { return false; } }) };
    });
    if (info.scrollW > info.clientW) problems.push(`[${w}] ${r} horizontal scroll ${info.scrollW}>${info.clientW} (${info.over.join(', ')})`);
    if (info.broken.length) problems.push(`[${w}] ${r} broken images: ${info.broken.join(', ')}`);
    if (info.smallTargets.length) problems.push(`[${w}] ${r} small tap targets: ${info.smallTargets.join(' | ')}`);
    if (info.noAlt) problems.push(`[${w}] ${r} ${info.noAlt} images missing alt`);
    if (info.h1 !== 1) problems.push(`[${w}] ${r} has ${info.h1} <h1>`);
    if (!info.title || !info.desc || !info.canonical) problems.push(`[${w}] ${r} missing title/description/canonical`);
    if (info.ld.includes(false)) problems.push(`[${w}] ${r} invalid JSON-LD`);
    info.links.forEach((l) => seenLinks.add(l.split('#')[0]));
    const name = (r === '/' ? 'home' : r.replace(/^\/|\/$/g, '').replace(/\//g, '_')) + `-${w}.png`;
    if (w !== 1440 || !r.startsWith('/gallery/a')) await page.screenshot({ path: path.join(SHOTS, name), fullPage: true });
  }
  await page.close();
}

// Internal links resolve
const page = await browser.newPage();
for (const l of seenLinks) {
  const r = await page.goto(l);
  if (r.status() !== 200) problems.push(`Broken internal link: ${l}`);
}

// Photo viewer: keyboard + swipe
for (const w of [390, 1440]) {
  const p = await browser.newPage({ viewport: { width: w, height: 844 }, hasTouch: w < 800 });
  await p.goto(base + '/gallery/', { waitUntil: 'networkidle' });
  await p.locator('[data-lightbox]').first().click();
  const open = await p.locator('dialog[open]').count();
  const t1 = await p.locator('.viewer-title').textContent();
  await p.keyboard.press('ArrowRight');
  const t2 = await p.locator('.viewer-title').textContent();
  await p.keyboard.press('ArrowLeft');
  const t3 = await p.locator('.viewer-title').textContent();
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(SHOTS, `viewer-${w}.png`) });
  // swipe left
  const box = await p.locator('[data-stage]').boundingBox();
  await p.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 5 });
  await p.mouse.up();
  const t4 = await p.locator('.viewer-title').textContent();
  const focused = await p.evaluate(() => document.activeElement?.closest('dialog') !== null);
  await p.keyboard.press('Escape');
  const closed = (await p.locator('dialog[open]').count()) === 0;
  const refocus = await p.evaluate(() => document.activeElement?.hasAttribute('data-lightbox'));
  const ok = open === 1 && t1 !== t2 && t1 === t3 && t4 === t2 && focused && closed && refocus;
  if (!ok) problems.push(`[${w}] viewer: open=${open} next=${t1 !== t2} prev=${t1 === t3} swipe=${t4 === t2} focusInside=${focused} escClose=${closed} refocus=${refocus}`);
  else console.log(`✓ viewer ${w}px: open, ←/→ keys, swipe, Esc, focus return`);
  await p.close();
}

// Mobile menu
{
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  const hiddenBefore = !(await p.locator('#site-nav').isVisible());
  await p.locator('.menu-btn').click();
  const visibleAfter = await p.locator('#site-nav').isVisible();
  await p.screenshot({ path: path.join(SHOTS, 'menu-open-390.png') });
  if (!hiddenBefore || !visibleAfter) problems.push('mobile menu toggle failed');
  else console.log('✓ mobile menu toggles');
}

// No-JS: gallery links go to photo pages
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(base + '/gallery/');
  await p.locator('[data-lightbox]').first().click();
  if (!p.url().includes('/gallery/ajlan-')) problems.push('no-JS gallery link did not open photo page');
  else console.log('✓ no-JS: gallery photo opens its own page');
  const navVisible = await (await ctx.newPage()).goto(base + '/').then(() => true);
  await ctx.close();
}

await browser.close();
server.close();
console.log(`Checked ${routes.length} routes × ${WIDTHS.length} widths, ${seenLinks.size} internal links.`);
if (problems.length) { console.log('\n✖ Problems:\n' + [...new Set(problems)].join('\n')); process.exit(1); }
console.log('✓ No horizontal scroll, broken images, small tap targets, or missing metadata.');
