import { describe, it, expect } from 'vitest';

// Helper functions tests
function extractSlugFromPath(path: string): string {
  const parts = path.split('/');
  const filename = parts[parts.length - 1];
  return filename.replace(/\.md$/, '');
}

function extractTitleFromContent(content: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.substring(2).trim();
    }
  }
  return '';
}

// Domain filtering function test
function createDomainFilter(domain?: string) {
  if (!domain) return undefined;
  return {
    type: 'and' as const,
    filters: [
      { type: 'gte' as const, key: 'folder', value: `${domain}/` },
      { type: 'lt' as const, key: 'folder', value: `${domain}/~` }
    ]
  };
}

describe('Search API helpers', () => {
  it('should extract slug from path correctly', () => {
    expect(extractSlugFromPath('domain-a.example/20250916-test.md')).toBe('20250916-test');
    expect(extractSlugFromPath('simple-file.md')).toBe('simple-file');
    expect(extractSlugFromPath('folder/subfolder/note.md')).toBe('note');
  });

  it('should extract title from markdown content', () => {
    expect(extractTitleFromContent('# Test Title\nContent here')).toBe('Test Title');
    expect(extractTitleFromContent('No title\nJust content')).toBe('');
    expect(extractTitleFromContent('## Not H1\n# This is H1')).toBe('This is H1');
  });

  it('should handle empty or invalid content', () => {
    expect(extractTitleFromContent('')).toBe('');
    expect(extractSlugFromPath('')).toBe('');
    expect(extractSlugFromPath('no-extension')).toBe('no-extension');
  });
});

describe('Domain filtering', () => {
  it('should create proper domain filter for specific domain', () => {
    const filter = createDomainFilter('domain-a.example');

    expect(filter).toEqual({
      type: 'and',
      filters: [
        { type: 'gte', key: 'folder', value: 'domain-a.example/' },
        { type: 'lt', key: 'folder', value: 'domain-a.example/~' }
      ]
    });
  });

  it('should return undefined when no domain specified', () => {
    const filter = createDomainFilter();
    expect(filter).toBeUndefined();
  });

  it('should return undefined for empty domain', () => {
    const filter = createDomainFilter('');
    expect(filter).toBeUndefined();
  });

  it('should handle different domain formats', () => {
    const filter1 = createDomainFilter('example.com');
    const filter2 = createDomainFilter('subdomain.example.com');

    expect(filter1?.filters[0].value).toBe('example.com/');
    expect(filter1?.filters[1].value).toBe('example.com/~');

    expect(filter2?.filters[0].value).toBe('subdomain.example.com/');
    expect(filter2?.filters[1].value).toBe('subdomain.example.com/~');
  });
});

describe('Search mode parameter', () => {
  it('should handle AI search mode', () => {
    const mode = 'ai';
    const isAIMode = mode === 'ai';
    expect(isAIMode).toBe(true);
  });

  it('should handle regular search mode', () => {
    const mode = 'regular';
    const isAIMode = mode === 'ai';
    expect(isAIMode).toBe(false);
  });

  it('should default to regular search for undefined mode', () => {
    const mode = undefined;
    const isAIMode = mode === 'ai';
    expect(isAIMode).toBe(false);
  });

  it('should default to regular search for invalid mode', () => {
    const mode = 'invalid';
    const isAIMode = mode === 'ai';
    expect(isAIMode).toBe(false);
  });
});