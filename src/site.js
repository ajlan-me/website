// Progressive enhancement only — every page works without JavaScript.
(() => {
  // Mobile menu
  const btn = document.querySelector('.menu-btn');
  const nav = document.getElementById('site-nav');
  if (btn && nav) {
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      btn.textContent = open ? 'Menu' : 'Close';
      nav.classList.toggle('open', !open);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        btn.click();
        btn.focus();
      }
    });
  }

  // Gallery category filter
  const grid = document.querySelector('[data-gallery]');
  const filterBtns = document.querySelectorAll('[data-filter]');
  filterBtns.forEach((b) =>
    b.addEventListener('click', () => {
      const f = b.dataset.filter;
      filterBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      grid.querySelectorAll('li').forEach((li) => (li.hidden = f !== 'all' && li.dataset.cat !== f));
    }),
  );

  // Photo viewer (links still go to the photo page without JS)
  const viewer = document.querySelector('[data-viewer]');
  if (!grid || !viewer || typeof viewer.showModal !== 'function') return;
  const stage = viewer.querySelector('[data-stage]');
  const count = viewer.querySelector('.viewer-count');
  const title = viewer.querySelector('.viewer-title');
  const caption = viewer.querySelector('.viewer-caption');
  const pageLink = viewer.querySelector('.viewer-link');
  let items = [];
  let i = 0;
  let opener = null;

  const visible = () => [...grid.querySelectorAll('li:not([hidden]) [data-lightbox]')];

  function render() {
    const a = items[i];
    const d = a.dataset;
    stage.innerHTML = `<picture>
      <source type="image/avif" srcset="${d.avif}" sizes="100vw">
      <source type="image/webp" srcset="${d.webp}" sizes="100vw">
      <img src="${d.src}" srcset="${d.jpg}" sizes="100vw" width="${d.w}" height="${d.h}" alt="">
    </picture>`;
    const img = stage.querySelector('img');
    img.alt = d.alt;
    img.draggable = false;
    count.textContent = `${i + 1} / ${items.length}`;
    title.textContent = d.title;
    caption.textContent = d.caption;
    pageLink.href = a.getAttribute('href');
    const single = items.length < 2;
    viewer.querySelector('[data-prev]').hidden = single;
    viewer.querySelector('[data-next]').hidden = single;
  }
  const go = (step) => {
    i = (i + step + items.length) % items.length;
    render();
  };

  grid.addEventListener('click', (e) => {
    const a = e.target.closest('[data-lightbox]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    items = visible();
    i = Math.max(0, items.indexOf(a));
    opener = a;
    render();
    viewer.showModal();
    viewer.querySelector('[data-close]').focus();
  });

  viewer.querySelector('[data-close]').addEventListener('click', () => viewer.close());
  viewer.querySelector('[data-prev]').addEventListener('click', () => go(-1));
  viewer.querySelector('[data-next]').addEventListener('click', () => go(1));
  viewer.addEventListener('close', () => {
    stage.innerHTML = '';
    if (opener) opener.focus();
  });
  viewer.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  });
  // Click on the dark backdrop area closes
  viewer.addEventListener('click', (e) => {
    if (e.target === viewer || e.target === stage) viewer.close();
  });

  // Swipe
  let x0 = null;
  let y0 = null;
  stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; });
  stage.addEventListener('dragstart', (e) => e.preventDefault());
  stage.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  });
  stage.addEventListener('pointercancel', () => (x0 = null));
})();
