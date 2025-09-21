import type { APIRoute } from 'astro';
import { getCurrentDomain } from '../../lib/md.ts';

export const GET: APIRoute = async ({ params, request, locals }) => {
  const slugParam = params.slug;
  if (!slugParam) {
    return new Response('Slug is required', { status: 400 });
  }

  const slug = Array.isArray(slugParam) ? slugParam.join('/') : slugParam;

  const bases = (import.meta.env.PUBLIC_MD_BASES ?? '')
    .split(';')
    .map((base) => base.trim())
    .filter(Boolean);
  const host = request.headers.get('host') || '';
  const currentDomain = getCurrentDomain(host);
  const env = locals?.cloudflare?.env ?? locals?.runtime?.env;

  const endpoints: string[] = [];
  const visited = new Set<string>();

  const segments = slug.split('/').filter(Boolean);
  const firstSegment = segments[0];
  const rest = segments.slice(1).join('/');

  const addEndpoint = (url: string) => {
    if (!visited.has(url)) {
      endpoints.push(url);
      visited.add(url);
    }
  };

  const r2Keys = new Set<string>();

  const addCandidate = (key: string) => {
    if (!key) return;
    r2Keys.add(key);
    addEndpoint(`/api/r2/${key}`);
  };

  if (currentDomain) {
    addCandidate(`${currentDomain}/${slug}.md`);
  }

  if (firstSegment === 'shared') {
    const sharedPath = rest || 'index';
    addCandidate(`shared/${sharedPath}.md`);
  }

  if (firstSegment === 'indexes') {
    const indexPath = rest || 'index';
    addCandidate(`indexes/${indexPath}.md`);
  }

  if (firstSegment && firstSegment.includes('.') && rest) {
    const targetDomain = firstSegment;
    const domainPath = rest;
    addCandidate(`${targetDomain}/${domainPath}.md`);
  }

  if (env?.BLOG_CONTENT && r2Keys.size > 0) {
    for (const key of r2Keys) {
      try {
        const object: any = await env.BLOG_CONTENT.get(key);
        if (!object) continue;
        const markdown = typeof object.text === 'function' ? await object.text() : await new Response(object.body).text();

        // Set cache headers
        const headers = new Headers();
        headers.set('Content-Type', 'text/plain; charset=utf-8');
        headers.set('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');

        const etag = object.httpEtag || object.etag;
        const lastModified = object.uploaded ? new Date(object.uploaded).toUTCString() : undefined;

        if (etag) headers.set('ETag', etag);
        if (lastModified) headers.set('Last-Modified', lastModified);

        return new Response(markdown, { status: 200, headers });
      } catch (error) {
        console.error(`Failed to fetch from R2 key ${key}:`, error);
      }
    }
  }

  for (const url of endpoints) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        const markdown = await response.text();

        // Set cache headers
        const headers = new Headers();
        headers.set('Content-Type', 'text/plain; charset=utf-8');
        headers.set('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');

        // Pass through ETag and Last-Modified if available
        const etag = response.headers.get('etag');
        const lastModified = response.headers.get('last-modified');

        if (etag) headers.set('ETag', etag);
        if (lastModified) headers.set('Last-Modified', lastModified);

        return new Response(markdown, { status: 200, headers });
      }
    } catch (error) {
      console.error(`Failed to fetch from ${url}:`, error);
    }
  }

  return new Response('Not found', { status: 404 });
};
