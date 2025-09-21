import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, request, locals }) => {
  const path = params.path || '';

  if (!path.endsWith('.md')) {
    return new Response('Only markdown files allowed', { status: 400 });
  }

  try {
    const env = locals?.cloudflare?.env ?? locals?.runtime?.env;

    if (env?.BLOG_CONTENT) {
      const object: any = await env.BLOG_CONTENT.get(path);
      if (object) {
        const markdown = typeof object.text === 'function' ? await object.text() : await new Response(object.body).text();
        return new Response(markdown, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=300, s-maxage=3600',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    // Try the public R2 endpoint first
    const publicUrl = `https://pub-ff9e4624d5814320a835cd2dcc3be262.r2.dev/${path}`;
    const response = await fetch(publicUrl);

    if (response.ok) {
      const content = await response.text();

      return new Response(content, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=300, s-maxage=3600',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // If public access fails, return 404
    return new Response('Not found', { status: 404 });
  } catch (error) {
    console.error(`Failed to fetch ${path}:`, error);
    return new Response('Internal server error', { status: 500 });
  }
};
