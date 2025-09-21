import type { APIRoute } from 'astro';
import { getCurrentDomain } from '../../lib/md.ts';

async function loadFromR2(env: any, key: string): Promise<string | null> {
  if (!env?.BLOG_CONTENT) return null;
  try {
    const object: any = await env.BLOG_CONTENT.get(key);
    if (!object) return null;
    if (typeof object.text === 'function') {
      return await object.text();
    }
    if (object.body) {
      const response = new Response(object.body);
      return await response.text();
    }
  } catch (error) {
    console.error(`Failed to load ${key} from R2:`, error);
  }
  return null;
}

export const GET: APIRoute = async ({ params, request, locals }) => {
  const slugParam = params.slug;
  if (!slugParam) {
    return new Response('Slug is required', { status: 400 });
  }

  const slug = Array.isArray(slugParam) ? slugParam.join('/') : slugParam;

  const host = request.headers.get('host') || '';
  const url = new URL(request.url);
  const domainOverride = url.searchParams.get('domain');
  const currentDomain = domainOverride || getCurrentDomain(host);
  const env = locals?.cloudflare?.env ?? locals?.runtime?.env;

  // Simplified domain-aware note fetching (same logic as fetchNote)
  const tryKeys: string[] = [];

  // Priority order: domain-specific, shared, legacy
  if (currentDomain) {
    tryKeys.push(`${currentDomain}/${slug}.md`);
  }
  tryKeys.push(`shared/${slug}.md`);
  tryKeys.push(`${slug}.md`);

  // Try R2 first if available
  if (env?.BLOG_CONTENT) {
    for (const key of tryKeys) {
      const markdown = await loadFromR2(env, key);
      if (markdown) {
        return new Response(markdown, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=0, s-maxage=86400'
          }
        });
      }
    }
  }

  // Fallback to API endpoints
  for (const key of tryKeys) {
    try {
      const apiUrl = new URL(`/api/r2/${key}`, request.url);
      const response = await fetch(apiUrl.toString());
      if (response.ok) {
        const markdown = await response.text();
        return new Response(markdown, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=0, s-maxage=86400'
          }
        });
      }
    } catch (error) {
      console.error(`Failed to fetch ${key}:`, error);
    }
  }

  return new Response('Not found', { status: 404 });
};
