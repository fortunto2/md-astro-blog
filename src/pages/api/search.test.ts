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

describe('Search API helpers', () => {
  it('should extract slug from path correctly', () => {
    expect(extractSlugFromPath('blog.akbuzat.net/20250916-test.md')).toBe('20250916-test');
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