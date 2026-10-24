// Static site builder for Ajlan's founder site.
//   npm run build        → preview build (noindex, TODO boxes visible)
//   npm run build:prod   → production build (indexable, TODOs hidden)
// Output: dist/

import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { marked } from 'marked';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');
const PROD = process.env.SITE_ENV === 'production';
// Preview hosts that don't map "folder/" → "folder/index.html" set this.
const EXPLICIT_INDEX = process.env.EXPLICIT_INDEX === '1';

const bust = `?v=${Date.now()}`;
const site = (await import(pathToFileURL(path.join(ROOT, 'content/site.mjs')).href + bust)).default;
const gallery = (await import(pathToFileURL(path.join(ROOT, 'content/gallery.mjs')).href + bust)).default;

if (PROD && !site.siteUrl) {
  console.error('\n✖ Set `siteUrl` in content/site.mjs before a production build.\n');
  process.exit(1);
}
const SITE = (site.siteUrl || 'https://preview.invalid').replace(/\/$/, '');
// Path prefix when hosted in a sub-folder (e.g. GitHub Pages project site → "/website").
const BASE = new URL(SITE).pathname.replace(/\/$/, '');
const todos = [];

// ── helpers ────────────────────────────────────────────────────────────────
const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = (p) => SITE + p;
const fmtDate = (d) => {
  if (/^\d{4}$/.test(d)) return d;
  const dt = new Date(d + 'T00:00:00Z');
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
function relFrom(fromPath) {
  const depth = fromPath.split('/').filter(Boolean).length;
  const prefix = '../'.repeat(depth);
  return (to) => {
    if (/^(https?:|mailto:|#)/.test(to)) return to;
    let t = to.replace(/^\//, '');
    if ((t === '' || t.endsWith('/')) && EXPLICIT_INDEX) t += 'index.html';
    return prefix + t || './';
  };
}
function todo(label) {
  return PROD ? '' : `<div class="todo" role="note"><strong>TODO</strong> ${esc(label)}</div>`;
}

// ── images ─────────────────────────────────────────────────────────────────
const IMG_OUT = path.join(OUT, 'images');
await fs.mkdir(IMG_OUT, { recursive: true });

async function fresh(target, src) {
  try {
    return (await fs.stat(target)).mtimeMs >= (await fs.stat(src)).mtimeMs;
  } catch {
    return false;
  }
}

/** Resize without cropping; never upscale. Returns metadata for <picture>. */
async function processImage(src, slug, { widths, jpg = true }) {
  const meta = await sharp(src).rotate().metadata();
  const W = meta.autoOrient?.width ?? meta.width;
  const H = meta.autoOrient?.height ?? meta.height;
  const ws = [...new Set([...widths.filter((w) => w < W), W])].sort((a, b) => a - b);
  const fmts = jpg ? ['avif', 'webp', 'jpg'] : ['avif', 'webp'];
  const out = { slug, width: W, height: H, sets: {}, original: null };
  for (const f of fmts) out.sets[f] = [];
  const jobs = [];
  for (const w of ws) {
    for (const f of fmts) {
      const name = `${slug}-${w}.${f}`;
      out.sets[f].push({ w, url: `/images/${name}` });
      const target = path.join(IMG_OUT, name);
      if (await fresh(target, src)) continue;
      let p = sharp(src).rotate().resize({ width: w, withoutEnlargement: true });
      if (f === 'avif') p = p.avif({ quality: 58, effort: 5 });
      if (f === 'webp') p = p.webp({ quality: 78 });
      if (f === 'jpg') p = p.jpeg({ quality: 82, mozjpeg: true, progressive: true });
      jobs.push(p.toFile(target));
    }
  }
  if (jpg) {
    // Stable, full-size URL used for Google Images, sitemaps and sharing.
    const name = `${slug}.jpg`;
    out.original = `/images/${name}`;
    const target = path.join(IMG_OUT, name);
    if (!(await fresh(target, src)))
      jobs.push(sharp(src).rotate().jpeg({ quality: 88, mozjpeg: true, progressive: true }).toFile(target));
  }
  await Promise.all(jobs);
  return out;
}

const srcset = (rel, list) => list.map((v) => `${rel(v.url)} ${v.w}w`).join(', ');

function picture(rel, img, { alt, sizes, eager = false, cls = '' }) {
  const fallbackList = img.sets.jpg || img.sets.webp;
  const mid = fallbackList.find((v) => v.w >= 720) || fallbackList[fallbackList.length - 1];
  const fallbackFmt = img.sets.jpg ? 'jpg' : 'webp';
  const sources = Object.entries(img.sets)
    .filter(([f]) => f !== fallbackFmt)
    .map(([f, list]) => `<source type="image/${f}" srcset="${srcset(rel, list)}" sizes="${sizes}">`)
    .join('');
  return `<picture${cls ? ` class="${cls}"` : ''}>${sources}<img src="${rel(mid.url)}" srcset="${srcset(rel, fallbackList)}" sizes="${sizes}" width="${img.width}" height="${img.height}" alt="${esc(alt)}"${eager ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"'}></picture>`;
}

// Process photos
const photos = [];
for (const p of gallery) {
  const src = path.join(ROOT, 'content/photos', `${p.slug}.jpg`);
  if (!fss.existsSync(src)) {
    console.warn(`! Missing photo file content/photos/${p.slug}.jpg — skipped`);
    continue;
  }
  const img = await processImage(src, p.slug, { widths: [360, 540, 720, 1024, 1440] });
  photos.push({ ...p, img, path: `/gallery/${p.slug}/` });
  if (!p.credit) todos.push(`Photographer credit for "${p.title}"`);
  if (!p.date) todos.push(`Date taken for "${p.title}" (optional)`);
}
const bySlug = Object.fromEntries(photos.map((p) => [p.slug, p]));
const portrait = bySlug[site.portraitSlug] || photos[0];

const projects = [];
for (const pr of site.projects || []) {
  const src = path.join(ROOT, 'content/projects', pr.image);
  if (!fss.existsSync(src)) continue;
  const slug = pr.image.replace(/\.[a-z]+$/, '');
  projects.push({ ...pr, img: await processImage(src, slug, { widths: [400, 700, 1024], jpg: false }) });
}

// ── journal ────────────────────────────────────────────────────────────────
function frontMatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim().replace(/^["']|["']$/g, '');
    if (v === 'true') v = true;
    else if (v === 'false') v = false;
    data[kv[1]] = v;
  }
  return { data, body: m[2] };
}
const posts = [];
const jdir = path.join(ROOT, 'content/journal');
for (const f of fss.existsSync(jdir) ? await fs.readdir(jdir) : []) {
  const m = f.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
  if (!m) continue;
  const { data, body } = frontMatter(await fs.readFile(path.join(jdir, f), 'utf8'));
  if (data.draft === true) continue;
  if (!data.title || !data.description) {
    console.warn(`! ${f}: needs title and description — skipped`);
    continue;
  }
  posts.push({ ...data, date: data.date || m[1], slug: m[2], path: `/journal/${m[2]}/`, body });
}
posts.sort((a, b) => (a.date < b.date ? 1 : -1));

// ── layout ─────────────────────────────────────────────────────────────────
const NAV = [
  ['/', 'Home'],
  ['/about/', 'About'],
  ['/navora/', 'Navora'],
  ['/gallery/', 'Gallery'],
  ['/journal/', 'Journal'],
  ['/contact/', 'Contact'],
];
const FONTS =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Caveat:wght@600&family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400&family=JetBrains+Mono:wght@500&display=swap';

const pages = [];

function layout(pg) {
  const rel = relFrom(pg.path);
  const canonical = abs(pg.path);
  const og = pg.ogImage || portrait;
  const ogUrl = abs(og.img.original);
  const navHtml = NAV.map(([href, label]) => {
    const cur = href === '/' ? pg.path === '/' : pg.path.startsWith(href);
    return `<li><a href="${rel(href)}"${cur ? ' aria-current="page"' : ''}>${label}</a></li>`;
  }).join('');
  const ld = (pg.jsonld || []).map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n');
  const robots = PROD ? 'index, follow, max-image-preview:large' : 'noindex, nofollow';
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>document.documentElement.classList.add('js')</script>
<title>${esc(pg.title)}</title>
<meta name="description" content="${esc(pg.description)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="${robots}">
<meta name="author" content="${esc(site.name)}">
<meta name="google-site-verification" content="Qxwxf12pT1KCfuWjzEjx7NPN6ptTuyLMgBP0CEC1IKo">
<meta name="theme-color" content="#F6F2EA">
<meta property="og:type" content="${pg.ogType || 'website'}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(pg.ogTitle || pg.title)}">
<meta property="og:description" content="${esc(pg.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogUrl}">
<meta property="og:image:width" content="${og.img.width}">
<meta property="og:image:height" content="${og.img.height}">
<meta property="og:image:alt" content="${esc(og.alt)}">
<meta property="og:locale" content="en_IN">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(pg.ogTitle || pg.title)}">
<meta name="twitter:description" content="${esc(pg.description)}">
<meta name="twitter:image" content="${ogUrl}">
<link rel="icon" href="${rel('/favicon.svg')}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="${rel('/assets/site.css')}">
${pg.head ? pg.head(rel) : ''}
${ld}
</head>
<body class="${pg.bodyClass || ''}">
<a class="skip" href="#main">Skip to content</a>
${PROD ? '' : '<div class="preview-bar" role="note">Private preview — hidden from search engines. Dashed boxes mark details still needed.</div>'}
<header class="site-header">
  <a class="brand" href="${rel('/')}"><span class="brand-dot" aria-hidden="true"></span>${esc(site.name)}</a>
  <button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
  <nav id="site-nav" class="site-nav" aria-label="Main"><ul>${navHtml}</ul></nav>
</header>
<main id="main">
${pg.body(rel)}
</main>
<footer class="site-footer">
  <div class="footer-inner">
    <p class="footer-name">${esc(site.name)} <span>— ${esc(site.role)}</span></p>
    <ul class="footer-links">${socialList(rel, { compact: true })}</ul>
    <p class="footer-small">© ${new Date().getFullYear()} ${esc(site.name)}. ${esc(site.location.locality ? site.location.locality + ', ' : '')}${esc(site.location.region)}, ${esc(site.location.country)}.</p>
  </div>
</footer>
<script src="${rel('/assets/site.js')}" defer></script>
</body>
</html>`;
}

function socialList(rel, { compact = false } = {}) {
  const L = site.links;
  const items = [
    L.email && [`mailto:${L.email}`, compact ? 'Email' : L.email, 'Email'],
    L.linkedin && [L.linkedin, 'LinkedIn', 'LinkedIn'],
    L.instagram && [L.instagram, 'Instagram', 'Instagram'],
    L.x && [L.x, 'X', 'X'],
    L.github && [L.github, 'GitHub', 'GitHub'],
  ].filter(Boolean);
  return items
    .map(([href, label, kind]) =>
      compact
        ? `<li><a href="${href}"${href.startsWith('http') ? ' rel="me noopener" target="_blank"' : ''}>${esc(label)}</a></li>`
        : `<li><a class="link-card" href="${href}"${href.startsWith('http') ? ' rel="me noopener" target="_blank"' : ''}><span class="link-kind">${kind}</span><span class="link-val">${esc(href.startsWith('mailto:') ? label : href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</span><span aria-hidden="true" class="arrow">↗</span></a></li>`,
    )
    .join('');
}

// ── structured data ────────────────────────────────────────────────────────
const sameAs = [site.links.linkedin, site.links.instagram, site.links.x, site.links.github, site.links.portfolio].filter(Boolean);
const personLd = {
  '@type': 'Person',
  '@id': abs('/#person'),
  name: site.name,
  ...(site.fullName ? { alternateName: site.fullName } : {}),
  url: abs('/'),
  image: { '@type': 'ImageObject', url: abs(portrait.img.original), width: portrait.img.width, height: portrait.img.height, caption: portrait.alt },
  jobTitle: site.role.replace(/ of Navora$/i, ''),
  description: site.intro,
  worksFor: { '@type': 'Organization', '@id': abs('/#navora'), name: 'Navora', url: site.navora.url },
  address: {
    '@type': 'PostalAddress',
    ...(site.location.locality ? { addressLocality: site.location.locality } : {}),
    addressRegion: site.location.region,
    addressCountry: site.location.countryCode,
  },
  knowsAbout: ['UI/UX design', 'Web development', 'Flutter', 'Mobile app development', 'Brand identity', 'Quick commerce', 'Local commerce'],
  ...(sameAs.length ? { sameAs } : {}),
};
const websiteLd = { '@type': 'WebSite', '@id': abs('/#website'), url: abs('/'), name: site.name, inLanguage: 'en-IN', publisher: { '@id': abs('/#person') } };
const crumbs = (list) => ({
  '@type': 'BreadcrumbList',
  itemListElement: list.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(p) })),
});
const ctx = (...items) => [{ '@context': 'https://schema.org', '@graph': items }];

function imageLd(p) {
  return {
    '@type': 'ImageObject',
    '@id': abs(p.path) + '#image',
    contentUrl: abs(p.img.original),
    url: abs(p.path),
    name: p.title,
    caption: p.caption,
    description: p.description,
    width: p.img.width,
    height: p.img.height,
    encodingFormat: 'image/jpeg',
    representativeOfPage: true,
    about: { '@id': abs('/#person') },
    ...(p.date ? { dateCreated: p.date } : {}),
    ...(p.credit ? { creator: { '@type': 'Person', name: p.credit, ...(p.creditUrl ? { url: p.creditUrl } : {}) }, creditText: p.credit } : {}),
    ...(p.copyright ? { copyrightNotice: p.copyright } : {}),
    ...(p.license ? { license: p.license, acquireLicensePage: abs('/contact/') } : {}),
  };
}

// ── shared fragments ───────────────────────────────────────────────────────
const tape = (cls = '') => `<span class="tape ${cls}" aria-hidden="true"></span>`;
const arrowSvg = `<svg class="scribble-arrow" viewBox="0 0 60 40" aria-hidden="true"><path d="M4 6c14 2 30 10 40 26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M36 30l8 4 1-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function polaroid(rel, p, { sizes, eager = false, cls = '', note = '', link = true, tapeCls = '' }) {
  const pic = picture(rel, p.img, { alt: p.alt, sizes, eager });
  const inner = link ? `<a href="${rel(p.path)}" class="snap-link">${pic}</a>` : pic;
  return `<figure class="snap ${cls}">${tape(tapeCls)}${inner}<figcaption>${note ? `<span class="hand">${esc(note)}</span>` : esc(p.caption)}</figcaption></figure>`;
}

const statusLabel = { done: 'Done', 'in-progress': 'In progress', planned: 'Planned' };

// ── pages ──────────────────────────────────────────────────────────────────
const sideL = bySlug['ajlan-portrait-black-t-shirt-neon-sign'];
const sideR = bySlug['ajlan-portrait-white-t-shirt-window-light'];

// Home
pages.push({
  path: '/',
  title: `${site.name} — ${site.role}`,
  description: `${site.name} (Muhammad Ajlan) is a founder, UI/UX designer and Flutter developer from ${site.location.region}, India, building Navora, a quick-commerce app for local shops starting in Manjeri. Work, photos and founder updates.`,
  bodyClass: 'home',
  ogImage: portrait,
  jsonld: ctx(websiteLd, personLd, { '@type': 'ProfilePage', '@id': abs('/#webpage'), url: abs('/'), name: `${site.name} — ${site.role}`, mainEntity: { '@id': abs('/#person') }, isPartOf: { '@id': abs('/#website') } }),
  head: (rel) => {
    const l = portrait.img.sets.avif;
    return `<link rel="preload" as="image" type="image/avif" imagesrcset="${srcset(rel, l)}" imagesizes="(min-width: 960px) 360px, 72vw" fetchpriority="high">`;
  },
  body: (rel) => `
<section class="hero" aria-labelledby="hero-title">
  <div class="hero-grid">
    <div class="hero-center">
      <p class="hand hello">${esc(site.notes.heroHello)}</p>
      <h1 id="hero-title" class="hero-title">
        <span class="name-stamp">${esc(site.name)}</span>
        <span class="sticker sticker--green role-sticker" data-role>${esc(site.role)}</span>
      </h1>
      <span class="sticker sticker--paper loc-sticker" aria-hidden="true">${esc(site.location.region)}, India</span>
      <div class="hero-portrait">
        ${polaroid(rel, portrait, { sizes: '(min-width: 960px) 360px, 72vw', eager: true, cls: 'snap--hero', note: site.notes.portrait })}
        <span class="note-arrow" aria-hidden="true">${arrowSvg}</span>
      </div>
      <p class="headline">${site.headline.split(/(?<=\.)\s+/).map((t) => `<span>${esc(t)}</span>`).join(' ')}</p>
      <p class="intro">${esc(site.intro)}</p>
      <div class="btn-row">
        <a class="btn btn--ink" href="${rel('/about/')}">Explore my journey</a>
        <a class="btn btn--line" href="${rel('/contact/')}">Get in touch</a>
      </div>
    </div>
    ${sideL ? `<div class="hero-side hero-side--l">${polaroid(rel, sideL, { sizes: '(min-width: 960px) 220px, 44vw', cls: 'snap--side tilt-l' })}</div>` : ''}
    ${sideR ? `<div class="hero-side hero-side--r">${polaroid(rel, sideR, { sizes: '(min-width: 960px) 220px, 44vw', cls: 'snap--side tilt-r', tapeCls: 'tape--r' })}</div>` : ''}
  </div>
  <p class="hero-more"><a href="${rel('/gallery/')}">See all photos <span aria-hidden="true">→</span></a></p>
</section>

<section class="desk" aria-labelledby="desk-title">
  <div class="wrap">
    <p class="kicker">open the locker</p>
    <h2 id="desk-title" class="h2">My founder desk</h2>
    <p class="lede">A few things that say more about me than a bio does.</p>
    <div class="locker">
      <div class="locker-light" aria-hidden="true"></div>
      <div class="locker-board">
        <article class="item item--note">
          ${tape()}
          <p class="item-label">Right now</p>
          <p class="item-text">Building Navora: the customer, store and rider apps, the backend and the admin panel. Solo, for now.</p>
        </article>
        <article class="item item--ticket">
          <p class="item-label">The route</p>
          <p class="route"><span>Manjeri</span><span aria-hidden="true">→</span><span>Malabar</span><span aria-hidden="true">→</span><span>Kerala</span></p>
          <p class="item-small">Town by town, with shops people already trust.</p>
        </article>
        <article class="item item--card">
          <p class="item-label">Before Navora</p>
          <p class="item-text">Freelance graphic &amp; web designer since 2024.</p>
          <a class="item-link" href="${rel('/about/')}#work">See my design work <span aria-hidden="true">→</span></a>
        </article>
        <article class="item item--tools">
          <p class="item-label">On the desk</p>
          <ul class="chips">${(site.about.tools || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        </article>
        <a class="item item--link" href="${site.navora.url}" target="_blank" rel="noopener"><span class="item-label">Official site</span><span class="big">navoranow.com <span aria-hidden="true">↗</span></span></a>
      </div>
    </div>
  </div>
</section>

<section class="teaser" aria-labelledby="navora-teaser">
  <div class="wrap teaser-card">
    <div>
      <p class="kicker">main venture</p>
      <h2 id="navora-teaser" class="h2">Building Navora</h2>
      <p>${esc(site.navora.summary)}</p>
    </div>
    <div class="btn-row">
      <a class="btn btn--ink" href="${rel('/navora/')}">Follow the build</a>
      <a class="btn btn--line" href="${site.navora.url}" target="_blank" rel="noopener">navoranow.com ↗</a>
    </div>
  </div>
</section>

${
  posts.length
    ? `<section class="wrap section" aria-labelledby="latest"><h2 id="latest" class="h2">Latest from the journal</h2><ul class="post-list">${posts
        .slice(0, 3)
        .map((p) => `<li><a href="${rel(p.path)}"><time datetime="${p.date}">${fmtDate(p.date)}</time><span>${esc(p.title)}</span></a></li>`)
        .join('')}</ul></section>`
    : ''
}

<section class="talk" aria-labelledby="talk-title">
  <div class="wrap center">
    <p class="hand">say hi</p>
    <h2 id="talk-title" class="display">Let’s talk</h2>
    <p class="lede">Shop owners, builders, or anyone curious about Navora. I read every message.</p>
    <a class="btn btn--green" href="${rel('/contact/')}">Get in touch</a>
  </div>
</section>`,
});

// About
const timelineItems = site.timeline
  .filter((t) => t.confirmed || !PROD)
  .sort((a, b) => (a.date < b.date ? -1 : 1));
for (const t of site.timeline) if (!t.confirmed) todos.push(`Confirm timeline entry: "${t.title}" (${t.date})`);
if (!site.about.motivation) todos.push('About: why you decided to build Navora, in your words');

const aboutPhoto = sideR || portrait;
pages.push({
  path: '/about/',
  title: `About ${site.name} — ${site.role}`,
  description: `The story of ${site.name}: a designer and founder from ${site.location.locality || site.location.region}, Kerala, building Navora to connect people with their local shops.`,
  ogImage: aboutPhoto,
  jsonld: ctx(personLd, { '@type': 'ProfilePage', url: abs('/about/'), name: `About ${site.name}`, mainEntity: { '@id': abs('/#person') } }, crumbs([['Home', '/'], ['About', '/about/']])),
  body: (rel) => `
<article class="wrap page">
  <header class="page-head">
    <p class="kicker">who I am</p>
    <h1 class="display">About</h1>
  </header>
  <div class="about-grid">
    <div class="about-photo">${polaroid(rel, aboutPhoto, { sizes: '(min-width: 960px) 320px, 80vw', cls: 'tilt-r', note: site.name.toLowerCase() })}</div>
    <div class="prose">
      <span class="sticker sticker--green">My story</span>
      ${site.about.story.map((p) => `<p>${esc(p)}</p>`).join('\n')}
      <h2 class="h3">Kerala, and where Navora starts</h2>
      <p>${esc(site.about.kerala)}</p>
      ${site.about.motivation ? `<h2 class="h3">Why I’m building Navora</h2><p>${esc(site.about.motivation)}</p>` : PROD ? '' : `<h2 class="h3">Why I’m building Navora</h2>` + todo('Add, in your own words, why you started Navora (content/site.mjs → about.motivation). This heading is hidden on the live site until then.')}
      <h2 class="h3">Things I care about</h2>
      <ul class="chips chips--light">${site.about.interests.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    </div>
  </div>

  <section class="section" aria-labelledby="timeline-title">
    <h2 id="timeline-title" class="h2">Founder timeline</h2>
    <ol class="timeline">
      ${timelineItems
        .map(
          (t) => `<li class="tl-item tl-${t.status}${t.confirmed ? '' : ' tl-unconfirmed'}">
        <time datetime="${t.date}">${fmtDate(t.date)}</time>
        <div><h3>${esc(t.title)} <span class="badge badge--${t.status}">${t.status === 'planned' ? 'Planned' : 'Done'}</span>${t.confirmed ? '' : ' <span class="badge badge--todo">TODO: confirm</span>'}</h3><p>${esc(t.text)}</p></div>
      </li>`,
        )
        .join('')}
    </ol>
  </section>

  <section class="section" id="work" aria-labelledby="work-title">
    <h2 id="work-title" class="h2">Design work</h2>
    <p class="lede">Selected projects from my freelance work.</p>
    <ul class="projects">
      ${projects
        .map(
          (p) => `<li class="project">
        <div class="project-img">${picture(rel, p.img, { alt: p.alt, sizes: '(min-width: 960px) 460px, 92vw' })}</div>
        <div class="project-body">
          <p class="mono">${esc(p.type)}</p>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.text)}</p>
          ${p.url ? `<a class="text-link" href="${p.url}" target="_blank" rel="noopener">Visit ${esc(p.title)} <span aria-hidden="true">↗</span></a>` : ''}
        </div>
      </li>`,
        )
        .join('')}
    </ul>
  </section>

  <section class="section" aria-labelledby="tools-title">
    <h2 id="tools-title" class="h2">Tools I use</h2>
    <ul class="chips chips--light">${(site.about.tools || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
  </section>
</article>`,
});

// Building Navora
const navoraShots = photos.filter((p) => p.category === 'Building Navora');
if (!navoraShots.length) todos.push('Approved Navora screenshots or build photos (gallery category "Building Navora")');
pages.push({
  path: '/navora/',
  title: `Building Navora — ${site.name}`,
  description: `How ${site.name} is building Navora, a marketplace app connecting local shops and customers in Manjeri, Kerala: what it is, his role, and progress so far.`,
  jsonld: ctx(
    { '@type': 'Organization', '@id': abs('/#navora'), name: 'Navora', url: site.navora.url, founder: { '@id': abs('/#person') }, sameAs: [site.navoraLinks.instagram].filter(Boolean) },
    personLd,
    crumbs([['Home', '/'], ['Building Navora', '/navora/']]),
  ),
  body: (rel) => {
    const col = (st) =>
      site.navora.milestones
        .filter((m) => m.status === st)
        .map((m) => `<li>${esc(m.title)}</li>`)
        .join('');
    return `
<article class="wrap page">
  <header class="page-head">
    <p class="kicker">my main venture</p>
    <h1 class="display">Building Navora</h1>
    <p class="lede">${esc(site.navora.summary)}</p>
    <div class="btn-row">
      <a class="btn btn--green" href="${site.navora.url}" target="_blank" rel="noopener">Visit navoranow.com <span aria-hidden="true">↗</span></a>
      ${site.navoraLinks.instagram ? `<a class="btn btn--line" href="${site.navoraLinks.instagram}" target="_blank" rel="noopener">@navoranow on Instagram</a>` : ''}
    </div>
  </header>

  <div class="two-col">
    <section aria-labelledby="how">
      <h2 id="how" class="h3">How it works</h2>
      <ol class="steps">${site.navora.howItWorks.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    </section>
    <section aria-labelledby="myrole" class="paper-card">
      ${tape()}
      <h2 id="myrole" class="h3">My role</h2>
      <p>${esc(site.navora.role)}</p>
    </section>
  </div>

  <section class="section" aria-labelledby="progress">
    <h2 id="progress" class="h2">Progress</h2>
    <p class="muted">Last updated <time datetime="${site.navora.statusUpdated}">${fmtDate(site.navora.statusUpdated)}</time>. Planned items are plans, not finished work.</p>
    <div class="board">
      <section class="board-col board-col--done" aria-labelledby="c-done"><h3 id="c-done"><span class="dot" aria-hidden="true">✓</span> Done</h3><ul>${col('done')}</ul></section>
      <section class="board-col board-col--progress" aria-labelledby="c-prog"><h3 id="c-prog"><span class="dot" aria-hidden="true">◐</span> In progress</h3><ul>${col('in-progress')}</ul></section>
      <section class="board-col board-col--planned" aria-labelledby="c-plan"><h3 id="c-plan"><span class="dot" aria-hidden="true">○</span> Planned</h3><ul>${col('planned')}</ul></section>
    </div>
  </section>

  ${
    navoraShots.length
      ? `<section class="section" aria-labelledby="shots"><h2 id="shots" class="h2">From the build</h2><ul class="grid">${navoraShots
          .map((p) => `<li>${polaroid(rel, p, { sizes: '(min-width: 960px) 300px, 46vw' })}</li>`)
          .join('')}</ul></section>`
      : PROD ? '' : `<section class="section">${todo('Add approved app screenshots and build photos (gallery category "Building Navora"). This section stays hidden on the live site until there are some.')}</section>`
  }

  <section class="section center">
    <p class="hand">updates as it happens</p>
    <a class="btn btn--line" href="${rel('/journal/')}">Read the journal</a>
  </section>
</article>`;
  },
});

// Gallery index
const cats = [...new Set(photos.map((p) => p.category))];
pages.push({
  path: '/gallery/',
  title: `Photos of ${site.name} — Gallery`,
  description: `Photo gallery of ${site.name}, ${site.role.toLowerCase()}: portraits and moments from building Navora in Kerala. Each photo has its own page with a caption.`,
  ogImage: portrait,
  jsonld: ctx(
    {
      '@type': 'CollectionPage',
      url: abs('/gallery/'),
      name: `Photos of ${site.name}`,
      about: { '@id': abs('/#person') },
      hasPart: photos.map((p) => ({ '@id': abs(p.path) + '#image' })),
    },
    crumbs([['Home', '/'], ['Gallery', '/gallery/']]),
  ),
  body: (rel) => `
<section class="wrap page">
  <header class="page-head">
    <p class="kicker">just photos</p>
    <h1 class="display">Gallery</h1>
    <p class="lede">Photos of me and of the work behind Navora. Tap a photo to view it larger; every photo also has its own page.</p>
  </header>
  ${
    cats.length > 1
      ? `<div class="filters" role="group" aria-label="Filter photos"><button type="button" class="chip-btn" aria-pressed="true" data-filter="all">All</button>${cats
          .map((c) => `<button type="button" class="chip-btn" aria-pressed="false" data-filter="${esc(c)}">${esc(c)}</button>`)
          .join('')}</div>`
      : ''
  }
  <ul class="gallery-grid" data-gallery>
    ${photos
      .map((p, i) => {
        const big = (p.img.sets.jpg || p.img.sets.webp).at(-1);
        return `<li data-cat="${esc(p.category)}">
      <figure class="g-item">
        <a href="${rel(p.path)}" data-lightbox data-index="${i}"
           data-avif="${srcset(rel, p.img.sets.avif)}" data-webp="${srcset(rel, p.img.sets.webp)}" data-jpg="${srcset(rel, p.img.sets.jpg)}"
           data-src="${rel(big.url)}" data-w="${p.img.width}" data-h="${p.img.height}"
           data-title="${esc(p.title)}" data-caption="${esc(p.caption)}" data-alt="${esc(p.alt)}">
          ${picture(rel, p.img, { alt: p.alt, sizes: '(min-width: 1100px) 340px, (min-width: 640px) 30vw, 46vw', eager: i < 2 })}
        </a>
        <figcaption><a href="${rel(p.path)}">${esc(p.title)}</a></figcaption>
      </figure>
    </li>`;
      })
      .join('')}
  </ul>
</section>

<dialog class="viewer" aria-label="Photo viewer" data-viewer>
  <div class="viewer-inner">
    <div class="viewer-top">
      <p class="viewer-count" aria-live="polite"></p>
      <button type="button" class="viewer-btn" data-close aria-label="Close viewer">✕</button>
    </div>
    <div class="viewer-stage" data-stage></div>
    <div class="viewer-bottom">
      <button type="button" class="viewer-btn" data-prev aria-label="Previous photo">←</button>
      <div class="viewer-text"><p class="viewer-title"></p><p class="viewer-caption"></p><a class="viewer-link" href="#">Open photo page</a></div>
      <button type="button" class="viewer-btn" data-next aria-label="Next photo">→</button>
    </div>
  </div>
</dialog>`,
});

// Gallery detail pages
photos.forEach((p, i) => {
  const prev = photos[(i - 1 + photos.length) % photos.length];
  const next = photos[(i + 1) % photos.length];
  pages.push({
    path: p.path,
    title: `${p.title} — Photo | ${site.name}`,
    ogTitle: p.title,
    description: p.description,
    ogImage: p,
    images: [p],
    jsonld: ctx(imageLd(p), crumbs([['Home', '/'], ['Gallery', '/gallery/'], [p.title, p.path]])),
    head: (rel) => `<link rel="preload" as="image" type="image/avif" imagesrcset="${srcset(rel, p.img.sets.avif)}" imagesizes="(min-width: 960px) 640px, 92vw" fetchpriority="high">`,
    body: (rel) => `
<article class="wrap page photo-page">
  <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="${rel('/')}">Home</a></li><li><a href="${rel('/gallery/')}">Gallery</a></li><li aria-current="page">${esc(p.title)}</li></ol></nav>
  <h1 class="h1">${esc(p.title)}</h1>
  <figure class="photo-figure">
    <div class="photo-frame">${tape()}${picture(rel, p.img, { alt: p.alt, sizes: '(min-width: 960px) 640px, 92vw', eager: true })}</div>
    <figcaption class="photo-caption">${esc(p.caption)}</figcaption>
  </figure>
  <div class="photo-meta">
    <p>${esc(p.description)}</p>
    <dl>
      <div><dt>Category</dt><dd>${esc(p.category)}</dd></div>
      ${p.date ? `<div><dt>Taken</dt><dd><time datetime="${p.date}">${fmtDate(p.date)}</time></dd></div>` : ''}
      ${p.credit ? `<div><dt>Photo</dt><dd>${p.creditUrl ? `<a href="${p.creditUrl}" rel="noopener" target="_blank">${esc(p.credit)}</a>` : esc(p.credit)}</dd></div>` : ''}
      <div><dt>Use</dt><dd>${p.allowDownload ? `<a href="${rel(p.img.original)}" download>Download full size (JPEG, ${p.img.width}×${p.img.height})</a>` : `Please <a href="${rel('/contact/')}">ask first</a> before reusing this photo.`}</dd></div>
    </dl>
    ${p.credit ? '' : todo('Photographer credit for this photo (content/gallery.mjs → credit)')}
  </div>
  <nav class="pager" aria-label="More photos">
    <a href="${rel(prev.path)}" rel="prev"><span aria-hidden="true">←</span> ${esc(prev.title)}</a>
    <a href="${rel('/gallery/')}">All photos</a>
    <a href="${rel(next.path)}" rel="next">${esc(next.title)} <span aria-hidden="true">→</span></a>
  </nav>
</article>`,
  });
});

// Journal
pages.push({
  path: '/journal/',
  title: `Journal — Founder updates from ${site.name}`,
  description: `Founder updates and lessons from ${site.name} while building Navora in Kerala.`,
  jsonld: ctx({ '@type': 'Blog', url: abs('/journal/'), name: `${site.name}’s journal`, author: { '@id': abs('/#person') } }, crumbs([['Home', '/'], ['Journal', '/journal/']])),
  body: (rel) => `
<section class="wrap page narrow">
  <header class="page-head">
    <p class="kicker">notes from the build</p>
    <h1 class="display">Journal</h1>
    <p class="lede">Founder updates and things I learn while building Navora.</p>
  </header>
  ${
    posts.length
      ? `<ul class="post-list">${posts
          .map((p) => `<li><a href="${rel(p.path)}"><time datetime="${p.date}">${fmtDate(p.date)}</time><span class="post-title">${esc(p.title)}</span><span class="post-desc">${esc(p.description)}</span></a></li>`)
          .join('')}</ul>`
      : `<div class="empty paper-card">${tape()}<p class="hand">nothing here yet</p><p>The first update will appear here soon. In the meantime, see <a href="${rel('/navora/')}">how Navora is going</a>.</p></div>`
  }
</section>`,
});
for (const post of posts) {
  pages.push({
    path: post.path,
    title: `${post.title} — ${site.name}`,
    ogTitle: post.title,
    description: post.description,
    ogType: 'article',
    jsonld: ctx(
      { '@type': 'BlogPosting', headline: post.title, description: post.description, datePublished: post.date, ...(post.updated ? { dateModified: post.updated } : {}), url: abs(post.path), mainEntityOfPage: abs(post.path), author: { '@id': abs('/#person') }, image: abs(portrait.img.original) },
      personLd,
      crumbs([['Home', '/'], ['Journal', '/journal/'], [post.title, post.path]]),
    ),
    body: (rel) => `
<article class="wrap page narrow article">
  <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="${rel('/')}">Home</a></li><li><a href="${rel('/journal/')}">Journal</a></li><li aria-current="page">${esc(post.title)}</li></ol></nav>
  <header><time class="mono" datetime="${post.date}">${fmtDate(post.date)}</time><h1 class="h1">${esc(post.title)}</h1></header>
  <div class="prose">${marked.parse(post.body).replace(/(src|href)="\/(?!\/)/g, (m, a) => `${a}="${rel('/')}`)}</div>
  <p><a class="text-link" href="${rel('/journal/')}">← All posts</a></p>
</article>`,
  });
}

// Contact
if (!site.links.email) todos.push('Public email address for the Contact page');
pages.push({
  path: '/contact/',
  title: `Contact ${site.name}`,
  description: `Get in touch with ${site.name}, ${site.role.toLowerCase()}, by email or on LinkedIn, Instagram and GitHub.`,
  jsonld: ctx({ '@type': 'ContactPage', url: abs('/contact/'), name: `Contact ${site.name}`, about: { '@id': abs('/#person') } }, personLd, crumbs([['Home', '/'], ['Contact', '/contact/']])),
  body: (rel) => `
<section class="wrap page narrow">
  <header class="page-head center">
    <p class="kicker">say hi</p>
    <h1 class="display">Contact</h1>
    <p class="lede">For Navora, partnerships, design work, or just to say hello. Email is the best way to reach me.</p>
  </header>
  <div class="contact-card paper-card">
    ${tape()}
    ${site.links.email ? `<p class="mono">Email</p><a class="email" href="mailto:${site.links.email}">${esc(site.links.email)}</a>` : todo('Add your public email (content/site.mjs → links.email)')}
  </div>
  <h2 class="h3">Elsewhere</h2>
  <ul class="link-list">${socialList(rel).replace(/<li><a class="link-card" href="mailto:[^"]+"[\s\S]*?<\/li>/, '')}</ul>
  <h2 class="h3">Navora</h2>
  <ul class="link-list">
    <li><a class="link-card" href="${site.navoraLinks.website}" target="_blank" rel="noopener"><span class="link-kind">Website</span><span class="link-val">navoranow.com</span><span aria-hidden="true" class="arrow">↗</span></a></li>
    ${site.navoraLinks.instagram ? `<li><a class="link-card" href="${site.navoraLinks.instagram}" target="_blank" rel="noopener"><span class="link-kind">Instagram</span><span class="link-val">@navoranow</span><span aria-hidden="true" class="arrow">↗</span></a></li>` : ''}
  </ul>
</section>`,
});

// 404
const notFound = {
  path: '/404/',
  title: `Page not found — ${site.name}`,
  description: 'This page does not exist.',
  noSitemap: true,
  body: (rel) => `<section class="wrap page center"><p class="hand">oops</p><h1 class="display">Not found</h1><p class="lede">That page doesn’t exist. Try the <a href="${rel('/')}">home page</a> or the <a href="${rel('/gallery/')}">gallery</a>.</p></section>`,
};

// ── write ──────────────────────────────────────────────────────────────────
for (const pg of pages) {
  const dir = path.join(OUT, pg.path);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'index.html'), layout(pg));
}
// 404 at root so hosts (Cloudflare Pages, GitHub Pages, Netlify) serve it.
// Root-relative paths so it works at any depth.
const html404 = layout({ ...notFound, path: '/' })
  .replace(/<link rel="canonical"[^>]*>\n/, '')
  .replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex">')
  .replace(/(href|src|srcset)="(?!https?:|mailto:|#|\/)([^"]+)"/g, `$1="${BASE}/$2"`)
  .replace(/(srcset="[^"]*)/g, (m) => m.replace(/, (?!https?:|\/)/g, `, ${BASE}/`));
await fs.writeFile(path.join(OUT, '404.html'), html404);

// Assets
await fs.mkdir(path.join(OUT, 'assets'), { recursive: true });
await fs.copyFile(path.join(ROOT, 'src/site.css'), path.join(OUT, 'assets/site.css'));
await fs.copyFile(path.join(ROOT, 'src/site.js'), path.join(OUT, 'assets/site.js'));
// Google Search Console HTML-file verification
await fs.copyFile(path.join(ROOT, 'google03e4defd60651cc9.html'), path.join(OUT, 'google03e4defd60651cc9.html'));
await fs.writeFile(
  path.join(OUT, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#B8ED75"/><text x="32" y="45" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="38" fill="#1B1A17">a</text></svg>`,
);

// Sitemap (pages + image extension)
const urls = pages
  .filter((p) => !p.noSitemap)
  .map((p) => {
    const imgs = (p.images || (p.path === '/' ? [portrait, sideL, sideR].filter(Boolean) : p.path === '/gallery/' ? photos : p.ogImage ? [p.ogImage] : []))
      .map((im) => `\n    <image:image><image:loc>${abs(im.img.original)}</image:loc></image:image>`)
      .join('');
    const lastmod = p.path.startsWith('/journal/') && p.date ? `\n    <lastmod>${p.updated || p.date}</lastmod>` : '';
    return `  <url>\n    <loc>${abs(p.path)}</loc>${lastmod}${imgs}\n  </url>`;
  })
  .join('\n');
await fs.writeFile(
  path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls}\n</urlset>\n`,
);
await fs.writeFile(
  path.join(OUT, 'robots.txt'),
  PROD ? `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n` : `# Preview build — keep out of search results\nUser-agent: *\nDisallow: /\n`,
);
// Header rules for Cloudflare Pages / Netlify
await fs.writeFile(
  path.join(OUT, '_headers'),
  `${PROD ? '' : '/*\n  X-Robots-Tag: noindex, nofollow\n\n'}/images/*\n  Cache-Control: public, max-age=31536000, immutable\n/assets/*\n  Cache-Control: public, max-age=3600\n`,
);
await fs.writeFile(path.join(OUT, '.nojekyll'), '');

const uniq = [...new Set(todos)];
await fs.writeFile(path.join(ROOT, 'TODO.md'), `# Details still needed\n\nGenerated by the last build. Fill these in content/site.mjs or content/gallery.mjs.\n\n${uniq.map((t) => `- [ ] ${t}`).join('\n')}\n${PROD ? '' : '- [ ] Production domain (content/site.mjs → siteUrl)\n'}`);
console.log(`✓ Built ${pages.length} pages, ${photos.length} photos → dist/ (${PROD ? 'PRODUCTION — indexable' : 'preview — noindex'})`);
console.log(`  ${uniq.length} TODO items → TODO.md`);
