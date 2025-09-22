import type { APIRoute } from 'astro';
import { getCurrentDomain } from '../lib/md';

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url);
    const domain = getCurrentDomain(url.hostname);

    // Get R2 binding from Cloudflare runtime
    const r2 = (locals as any).runtime?.env?.BLOG_CONTENT;

    if (!r2) {
      return new Response('R2 storage not available', { status: 500 });
    }

    // List all objects in the domain folder
    const prefix = domain ? `${domain}/` : '';
    const objects = await r2.list({ prefix });

    const baseUrl = url.origin;
    const now = new Date().toISOString();

    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/search</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;

    // Add document URLs (exclude service files)
    for (const obj of objects.objects) {
      if (obj.key.endsWith('.md') &&
          !obj.key.includes('header') &&
          !obj.key.includes('footer') &&
          !obj.key.includes('index')) {
        const slug = obj.key.replace(/\.md$/, '').replace(/^[^/]+\//, '');
        const lastMod = obj.uploaded ? new Date(obj.uploaded).toISOString() : now;

        sitemap += `
  <url>
    <loc>${baseUrl}/n/${slug}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
      }
    }

    sitemap += `
</urlset>`;

    return new Response(sitemap, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400'
      }
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return new Response('Error generating sitemap', { status: 500 });
  }
};