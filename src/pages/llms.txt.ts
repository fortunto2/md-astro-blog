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
    const siteName = 'Blog';

    let content = `# ${siteName} - LLMs.txt

> Zettelkasten blog with notes and knowledge

Collection of notes, articles and thoughts in Zettelkasten format.

## Available Documents

`;

    // Add document list (exclude service files)
    for (const obj of objects.objects) {
      if (obj.key.endsWith('.md') &&
          !obj.key.includes('header') &&
          !obj.key.includes('footer') &&
          !obj.key.includes('index')) {
        const slug = obj.key.replace(/\.md$/, '').replace(/^[^/]+\//, '');
        const title = slug.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
        content += `- [${title}](${baseUrl}/n/${slug}.md)\n`;
      }
    }

    content += `
## Additional Resources

- [Search](${baseUrl}/search) - AI-powered search across all notes
- [Full Content](/llms-full.txt) - All content in single file
- [Sitemap](/sitemap.xml) - Site structure

## Notes

- Content is dynamically served from R2 storage
- Search powered by Cloudflare AutoRAG
- Domain-specific content filtering available
`;

    return new Response(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400'
      }
    });
  } catch (error) {
    console.error('Error generating llms.txt:', error);
    return new Response('Error generating document list', { status: 500 });
  }
};