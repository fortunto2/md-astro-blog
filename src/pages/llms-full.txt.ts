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

    let content = `# Akbuzat Blog - Full Content Export

> Complete content dump of all notes and articles

===

`;

    // Process each markdown file (exclude service files)
    for (const obj of objects.objects) {
      if (obj.key.endsWith('.md') &&
          !obj.key.includes('header') &&
          !obj.key.includes('footer') &&
          !obj.key.includes('index')) {
        try {
          const file = await r2.get(obj.key);
          if (file) {
            const markdown = await file.text();
            const slug = obj.key.replace(/\.md$/, '').replace(/^[^/]+\//, '');

            content += `## ${slug}\n\n`;
            content += markdown;
            content += '\n\n===***===***==***===\n\n';
          }
        } catch (fileError) {
          console.error(`Error reading file ${obj.key}:`, fileError);
          content += `## ${obj.key} (Error loading content)\n\n===\n\n`;
        }
      }
    }

    return new Response(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400'
      }
    });
  } catch (error) {
    console.error('Error generating llms-full.txt:', error);
    return new Response('Error generating full content export', { status: 500 });
  }
};