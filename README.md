# Ajlan — personal website

Founder site for Ajlan, founder of Navora. Static HTML generated from a few content files: fast, crawlable, and mobile-first.

## Edit content

| What | Where |
|---|---|
| Bio, role, intro, timeline, Navora progress, links | `content/site.mjs` |
| Photos (title, alt text, caption, credit, download permission) | `content/gallery.mjs` + image files in `content/photos/` |
| Design-work screenshots | `content/site.mjs → projects` + files in `content/projects/` |
| Journal posts | `content/journal/YYYY-MM-DD-slug.md` (see `content/journal/README.md`) |

Every build writes `TODO.md` listing details that are still missing.

**Role:** change `role` in `content/site.mjs` (e.g. to `Founder & CEO of Navora`). It updates every page and the structured data.

**Add a photo:** save it as `content/photos/<descriptive-name>.jpg`, add an entry with the same `slug` to `content/gallery.mjs`, and build. The site generates AVIF/WebP/JPEG sizes, a photo page at `/gallery/<slug>/`, ImageObject structured data and a sitemap entry. Photos are never cropped or upscaled.

## Build

```bash
npm install
npm run build        # preview: noindex everywhere, TODO boxes visible
npm test             # checks 360/390/430/768/1440 px, links, viewer, metadata
npm run build:prod   # production: indexable, TODO boxes hidden
```

Output goes to `dist/`. Production builds stop with an error until `siteUrl` is set in `content/site.mjs`.

## Deploy (Cloudflare Pages)

1. Create a Pages project from this repo. Build command `npm run build`, output directory `dist`.
2. In **Settings → Environment variables → Production** add `SITE_ENV = production`. Leave Preview without it.
   Production deploys are then indexable. Preview deploys send `noindex` (meta tag, `X-Robots-Tag` header and `robots.txt Disallow`).
3. Add your custom domain and set the same domain as `siteUrl`.

GitHub Pages or Netlify work the same way: build with `SITE_ENV=production` only for the public site.

## Google Search Console

1. Open <https://search.google.com/search-console> and add a **Domain** property for your domain. Verify it with the DNS TXT record (Cloudflare → DNS).
2. **Sitemaps** → submit `sitemap.xml`. It lists every page plus image entries for each photo.
3. **URL Inspection** → test the home page, `/about/` and one `/gallery/...` page, then click *Request indexing*.
4. Check structured data with <https://search.google.com/test/rich-results> (Person, ImageObject, BreadcrumbList).
5. Later, check *Pages* and *Performance → Search type: Image* for coverage.

Google decides what to index and how to rank it, so nothing here guarantees indexing, image results or rankings. The site just makes everything easy to crawl and understand.

## What's built in

- Real routes: `/`, `/about/`, `/navora/`, `/gallery/`, `/gallery/<photo>/`, `/journal/`, `/journal/<post>/`, `/contact/`, `404.html`
- Unique title, description, canonical, Open Graph and Twitter tags on every page
- JSON-LD: Person (with `sameAs` for your own profiles), WebSite, ProfilePage, Organization (Navora), CollectionPage, ImageObject, BlogPosting, BreadcrumbList
- `sitemap.xml` with the image extension, `robots.txt`, `_headers`
- Responsive images (AVIF → WebP → JPEG), explicit width/height, lazy loading below the fold, the hero portrait preloaded with high priority
- Gallery viewer: native `<dialog>`, arrow keys, Esc, close button, swipe, focus returns to the photo. Every photo is also a normal link to its own page, so it works without JavaScript.
- Visible focus, 44px+ tap targets, reduced-motion support, no horizontal scrolling (tested)
