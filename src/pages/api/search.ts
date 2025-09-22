import type { APIRoute } from 'astro';

function extractSlugFromPath(path: string): string {
  // Extract slug from paths like "blog.akbuzat.net/20250916-025936-protesty-v-bashkortostane.md"
  const parts = path.split('/');
  const filename = parts[parts.length - 1];
  return filename.replace(/\.md$/, '');
}

function extractTitleFromContent(content: string): string {
  // Try to extract title from content
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.substring(2).trim();
    }
  }
  return '';
}

function createDomainFilter(domain?: string) {
  if (!domain) return undefined;

  // AutoRAG использует 'folder' metadata для фильтрации, НЕ 'filename'
  // Создаем фильтр "starts with" для папки домена
  return {
    type: 'and' as const,
    filters: [
      {
        type: 'gte' as const,
        key: 'folder',
        value: `${domain}/`
      },
      {
        type: 'lt' as const,
        key: 'folder',
        value: `${domain}/~` // Следующий символ после домена для "starts with"
      }
    ]
  };
}

function getDomainFromHost(host: string): string | undefined {
  // Маппинг хостов на домены для автофильтрации
  if (host.includes('blog.akbuzat.net')) {
    return 'blog.akbuzat.net';
  }
  // Добавьте другие домены при необходимости
  return undefined;
}

export const GET: APIRoute = async ({ url, locals, request }) => {
  const query = url.searchParams.get('q');
  const domainParam = url.searchParams.get('domain');

  // Автоматическое определение домена из хоста
  const host = request.headers.get('host') || '';
  const autoDomain = getDomainFromHost(host);
  const domain = domainParam || autoDomain;

  if (!query || query.trim().length < 2) {
    return new Response(JSON.stringify({
      error: 'Query must be at least 2 characters'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const env = (locals as any)?.cloudflare?.env ?? (locals as any)?.runtime?.env;

  // Use AutoRAG with proper API according to documentation
  if (env?.AI) {
    try {
      const domainFilter = createDomainFilter(domain);
      
      // Try aiSearch first (with AI-generated answer)
      const answer = await env.AI.autorag("blog-deep").aiSearch({
        query: query.trim(),
        max_num_results: 10,
        rewrite_query: true,
        filters: domainFilter
      });

      if (answer?.data && answer.data.length > 0) {
        const results = answer.data.map((doc: any, index: number) => {
          const slug = extractSlugFromPath(doc.filename || '');
          const title = extractTitleFromContent(doc.content?.[0]?.text || '') || slug || 'Untitled';
          const description = doc.content?.[0]?.text?.substring(0, 200) + '...' || 'No description available';

          return {
            title,
            description,
            url: `/n/${slug}`,
            score: 1 - (index * 0.1),
            date: null,
            tags: [],
            source: 'autorag'
          };
        });

        return new Response(JSON.stringify({
          query: query.trim(),
          domain: domain || 'all',
          total: results.length,
          results: results,
          answer: answer.answer || `Found ${results.length} relevant documents.`
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60, s-maxage=300'
          }
        });
      }

      // If aiSearch didn't work, try simple search
      const searchResult = await env.AI.autorag("blog-deep").search({
        query: query.trim(),
        max_num_results: 10,
        rewrite_query: false,
        filters: domainFilter
      });

      if (searchResult?.data && searchResult.data.length > 0) {
        const results = searchResult.data.map((doc: any, index: number) => {
          const slug = extractSlugFromPath(doc.filename || '');
          const title = extractTitleFromContent(doc.content?.[0]?.text || '') || slug || 'Untitled';
          const description = doc.content?.[0]?.text?.substring(0, 200) + '...' || 'No description available';

          return {
            title,
            description,
            url: `/n/${slug}`,
            score: 1 - (index * 0.1),
            date: null,
            tags: [],
            source: 'autorag-search'
          };
        });

        return new Response(JSON.stringify({
          query: query.trim(),
          domain: domain || 'all',
          total: results.length,
          results: results,
          answer: `Found ${results.length} documents matching your search.`
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60, s-maxage=300'
          }
        });
      }

    } catch (autoragError) {
      console.error('AutoRAG failed:', autoragError);

      return new Response(JSON.stringify({
        error: 'AutoRAG search failed',
        details: autoragError instanceof Error ? autoragError.message : 'Unknown error',
        query: query.trim()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({
    error: 'AutoRAG not available',
    details: 'AI binding not found in environment',
    query: query.trim()
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
};