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

export const GET: APIRoute = async ({ url, locals }) => {
  const query = url.searchParams.get('q');

  if (!query || query.trim().length < 2) {
    return new Response(JSON.stringify({
      error: 'Query must be at least 2 characters'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const env = locals?.cloudflare?.env ?? locals?.runtime?.env;

  console.log('Search env check:', {
    hasAI: !!env?.AI,
    hasVectorIndex: !!env?.VECTOR_INDEX,
    aiType: typeof env?.AI,
    autoragAvailable: env?.AI && typeof env.AI.autorag === 'function'
  });

  // Try AutoRAG first using direct binding
  if (env?.AI && typeof env.AI.autorag === 'function') {
    try {
      console.log('Trying AutoRAG search...');
      const answer = await env.AI.autorag("blog-deep").aiSearch({
        query: query.trim(),
      });

      console.log('AutoRAG response:', answer);

      if (answer?.documents) {
        const results = answer.documents.map((doc: any, index: number) => {
          const slug = extractSlugFromPath(doc.name || '');
          const title = extractTitleFromContent(doc.content || '') || slug || 'Untitled';

          return {
            title,
            description: doc.content ? doc.content.substring(0, 200) + '...' : 'No description available',
            url: `/n/${slug}`,
            score: 1 - (index * 0.1), // Approximate score based on ranking
            date: null,
            tags: [],
            source: 'autorag'
          };
        });

        return new Response(JSON.stringify({
          query: query.trim(),
          total: results.length,
          results: results,
          answer: answer.answer || null
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60, s-maxage=300'
          }
        });
      }
    } catch (autoragError) {
      console.error('AutoRAG search failed:', autoragError);
    }
  }

  // Try alternative AutoRAG access method
  if (env?.AI) {
    try {
      console.log('Trying alternative AutoRAG method...');
      // Sometimes AutoRAG is available directly on AI object
      const answer = await env.AI.run('@cf/autorag/search', {
        rag_id: 'blog-deep',
        query: query.trim()
      });

      console.log('Alternative AutoRAG response:', answer);

      if (answer?.documents) {
        const results = answer.documents.map((doc: any, index: number) => {
          const slug = extractSlugFromPath(doc.name || '');
          const title = extractTitleFromContent(doc.content || '') || slug || 'Untitled';

          return {
            title,
            description: doc.content ? doc.content.substring(0, 200) + '...' : 'No description available',
            url: `/n/${slug}`,
            score: 1 - (index * 0.1),
            date: null,
            tags: [],
            source: 'autorag-alt'
          };
        });

        return new Response(JSON.stringify({
          query: query.trim(),
          total: results.length,
          results: results,
          answer: answer.answer || null
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60, s-maxage=300'
          }
        });
      }
    } catch (altError) {
      console.error('Alternative AutoRAG failed:', altError);
    }
  }

  // Try direct vector search as fallback
  if (env?.VECTOR_INDEX && env?.AI) {
    try {
      console.log('Trying direct vector search...');

      // Generate embeddings for search
      const embeddings = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: [query.trim()]
      });

      // Search vector index
      const vectorResults = await env.VECTOR_INDEX.query(embeddings.data[0], {
        topK: 5,
        returnMetadata: true
      });

      console.log('Vector search results:', vectorResults);

      if (vectorResults?.matches?.length > 0) {
        const results = vectorResults.matches.map((match: any, index: number) => {
          const metadata = match.metadata || {};
          const slug = match.id.includes('/') ? match.id.split('/').pop() : match.id;

          return {
            title: metadata.title || slug || 'Untitled',
            description: metadata.description || metadata.content?.substring(0, 200) + '...' || 'No description available',
            url: `/n/${slug}`,
            score: match.score || (1 - index * 0.1),
            date: metadata.date || null,
            tags: metadata.tags || [],
            source: 'vector'
          };
        });

        return new Response(JSON.stringify({
          query: query.trim(),
          total: results.length,
          results: results,
          answer: `Found ${results.length} results using vector search.`
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60, s-maxage=300'
          }
        });
      }
    } catch (vectorError) {
      console.error('Vector search failed:', vectorError);
    }
  }

  // Final fallback - mock search results
  const mockResults = [
    {
      title: `No AutoRAG results for "${query}"`,
      description: 'AutoRAG search is not working. Check Cloudflare bindings configuration.',
      url: '/n/test-note',
      score: 0.5,
      date: '2025-09-22',
      tags: ['fallback'],
      source: 'fallback'
    }
  ];

  return new Response(JSON.stringify({
    query: query.trim(),
    total: mockResults.length,
    results: mockResults,
    answer: `AutoRAG search failed for query: "${query}". Check console logs for details.`,
    debug: {
      hasAI: !!env?.AI,
      hasVectorIndex: !!env?.VECTOR_INDEX,
      environment: env?.NODE_ENV || 'unknown'
    }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
};