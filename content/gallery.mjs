// ─────────────────────────────────────────────────────────────────────────────
//  PHOTO GALLERY — one entry per photo.
//
//  To add a photo:
//   1. Put the original file in content/photos/ with a descriptive filename,
//      e.g. "ajlan-shop-visit-manjeri-market.jpg" (lowercase, hyphens).
//   2. Add an entry below whose `slug` matches the filename without ".jpg".
//   3. Run the build. Resized AVIF/WebP/JPEG versions, the photo page
//      (/gallery/<slug>/), structured data and the sitemap are generated.
//
//  Fields
//   title        Short, human title (page <h1>).
//   alt          What is in the photo, for screen readers & Google Images.
//   caption      One visible line under the photo.
//   description  One or two sentences for the photo page & meta description.
//   category     'Portraits' | 'Building Navora' | 'Behind the Scenes' | 'Events'
//                (A category tab appears only if a photo uses it.)
//   date         'YYYY-MM-DD' when taken, or null if unknown.
//   credit       Photographer name, or null. TODO for all current photos.
//   creditUrl    Photographer link, or null.
//   allowDownload  true shows a download link on the photo page.
//   license      URL describing reuse terms, or null.
//   copyright    e.g. '© 2026 Photographer Name', or null.
//   featured     true = can appear on the home page.
// ─────────────────────────────────────────────────────────────────────────────

export default [
  {
    slug: 'muhammed-ajlan-portrait-light-blue-shirt-grey-backdrop',
    title: 'Muhammed Ajlan in a light blue shirt',
    alt: 'Muhammed Ajlan (Muhammad Ajlan), founder of Navora, in a light blue button-down shirt against a plain light grey backdrop',
    caption: 'Studio portrait in a light blue shirt.',
    description:
      'Head-and-shoulders portrait of Muhammed Ajlan, founder of Navora, wearing a light blue button-down shirt, photographed against a plain light grey studio backdrop.',
    category: 'Portraits',
    date: null,
    credit: null, // TODO
    creditUrl: null,
    allowDownload: false,
    license: null,
    copyright: null,
    featured: true,
  },
  {
    slug: 'muhammed-ajlan-portrait-black-t-shirt-neon-sign',
    title: 'Muhammed Ajlan in a black T-shirt with a neon sign',
    alt: 'Muhammed Ajlan in a black T-shirt standing in front of a dark wall, with a warm glowing neon script sign behind him',
    caption: 'Black T-shirt, dark wall, warm neon glow.',
    description:
      'Portrait of Muhammed Ajlan in a plain black T-shirt against a dark background, with a warm white neon script sign glowing behind his head.',
    category: 'Portraits',
    date: null,
    credit: null, // TODO
    creditUrl: null,
    allowDownload: false,
    license: null,
    copyright: null,
    featured: true,
  },
  {
    slug: 'muhammed-ajlan-portrait-white-t-shirt-window-light',
    title: 'Muhammed Ajlan in a white T-shirt in window light',
    alt: 'Muhammed Ajlan in an oversized white T-shirt against a white wall, with soft window light and shadows across the wall',
    caption: 'White on white, with window light.',
    description:
      'Portrait of Muhammed Ajlan wearing an oversized white T-shirt, photographed against a white wall with soft window light and diagonal shadows.',
    category: 'Portraits',
    date: null,
    credit: null, // TODO
    creditUrl: null,
    allowDownload: false,
    license: null,
    copyright: null,
    featured: true,
  },
];
