/**
 * Builds sitemap.xml from the pages the prerender actually emitted, so it
 * can't drift from the routing table. Runs after `ng build`.
 */
import { readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLIENT_DIR = join(fileURLToPath(import.meta.url), '..', '..');
const BUILD_DIR = join(CLIENT_DIR, 'dist', 'client', 'browser');
const BASE_URL = 'https://www.dolarenvivo.com.ar';

/** Paths kept out of search results — mirrored in public/robots.txt. */
const EXCLUDED = [/^auth\//, /^portfolio$/, /^analysis$/];

/** Crawl priority and refresh hints, most specific pattern first. */
const RULES = [
  { match: (p) => p === '', changefreq: 'hourly', priority: '1.0' },
  { match: (p) => /^dolar-/.test(p), changefreq: 'hourly', priority: '0.9' },
  { match: (p) => p === 'brecha-cambiaria', changefreq: 'hourly', priority: '0.8' },
  { match: (p) => p.startsWith('calculadora/'), changefreq: 'weekly', priority: '0.8' },
  { match: (p) => p === 'convertir', changefreq: 'weekly', priority: '0.7' },
  { match: (p) => p.startsWith('convertir/'), changefreq: 'daily', priority: '0.6' },
  { match: (p) => p.startsWith('historico/'), changefreq: 'daily', priority: '0.6' },
];

async function findPrerenderedPages(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const pages = [];

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      pages.push(...(await findPrerenderedPages(full, base)));
    } else if (entry.name === 'index.html') {
      const rel = relative(base, dir).split(sep).join('/');
      pages.push(rel);
    }
  }

  return pages;
}

function metaFor(path) {
  return (
    RULES.find((rule) => rule.match(path)) ?? { changefreq: 'weekly', priority: '0.5' }
  );
}

const pages = (await findPrerenderedPages(BUILD_DIR))
  .filter((path) => !EXCLUDED.some((pattern) => pattern.test(path)))
  .sort((a, b) => a.localeCompare(b));

const lastmod = new Date().toISOString().slice(0, 10);

const urls = pages
  .map((path) => {
    const { changefreq, priority } = metaFor(path);
    const loc = path === '' ? `${BASE_URL}/` : `${BASE_URL}/${path}`;
    return [
      '  <url>',
      `    <loc>${loc}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority}</priority>`,
      '  </url>',
    ].join('\n');
  })
  .join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

await writeFile(join(BUILD_DIR, 'sitemap.xml'), sitemap, 'utf8');
console.log(`sitemap.xml generated with ${pages.length} URLs`);
