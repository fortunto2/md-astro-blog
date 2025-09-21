import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseFrontmatter,
  processWikilinks,
  fetchNote,
  fetchPage,
  isPrivate,
  matchesDomain,
  getCurrentDomain,
  generateMetaTags,
  type NoteFrontmatter
} from './md.js';

describe('parseFrontmatter', () => {
  it('should parse frontmatter correctly', () => {
    const markdown = `---
title: 'Test Note'
date: '2025-09-22'
tags: ['tag1', 'tag2']
status: 'public'
---
# Content here`;

    const result = parseFrontmatter(markdown);

    expect(result.frontmatter.title).toBe('Test Note');
    expect(result.frontmatter.date).toBe('2025-09-22');
    expect(result.frontmatter.tags).toEqual(['tag1', 'tag2']);
    expect(result.frontmatter.status).toBe('public');
    expect(result.content).toBe('# Content here');
  });

  it('should handle markdown without frontmatter', () => {
    const markdown = '# Just content';
    const result = parseFrontmatter(markdown);

    expect(result.frontmatter).toEqual({});
    expect(result.content).toBe('# Just content');
  });

  it('should handle arrays in frontmatter', () => {
    const markdown = `---
tags: ['javascript', 'typescript']
aliases: ["js", "ts"]
---
Content`;

    const result = parseFrontmatter(markdown);
    expect(result.frontmatter.tags).toEqual(['javascript', 'typescript']);
    expect(result.frontmatter.aliases).toEqual(['js', 'ts']);
  });
});

describe('processWikilinks', () => {
  it('should convert wikilinks to regular links', () => {
    const content = 'Check out [[my-note]] and [[another note]].';
    const result = processWikilinks(content);

    expect(result).toBe('Check out [my-note](/n/my-note) and [another note](/n/another-note).');
  });

  it('should add markdown links when requested', () => {
    const content = 'Check out [[my-note]].';
    const result = processWikilinks(content, true);

    expect(result).toBe('Check out [my-note](/n/my-note) ([.md](/n/my-note.md)).');
  });

  it('should handle content without wikilinks', () => {
    const content = 'Regular content without links.';
    const result = processWikilinks(content);

    expect(result).toBe('Regular content without links.');
  });
});

describe('isPrivate', () => {
  it('should return true for private status', () => {
    const frontmatter: NoteFrontmatter = { status: 'private' };
    expect(isPrivate(frontmatter)).toBe(true);
  });

  it('should return false for public status', () => {
    const frontmatter: NoteFrontmatter = { status: 'public' };
    expect(isPrivate(frontmatter)).toBe(false);
  });

  it('should return false for undefined status', () => {
    const frontmatter: NoteFrontmatter = {};
    expect(isPrivate(frontmatter)).toBe(false);
  });
});

describe('matchesDomain', () => {
  it('should return true when no domain specified', () => {
    const frontmatter: NoteFrontmatter = {};
    expect(matchesDomain(frontmatter, 'example.com')).toBe(true);
  });

  it('should return true when domain matches', () => {
    const frontmatter: NoteFrontmatter = { domain: 'example.com' };
    expect(matchesDomain(frontmatter, 'example.com')).toBe(true);
  });

  it('should return false when domain does not match', () => {
    const frontmatter: NoteFrontmatter = { domain: 'other.com' };
    expect(matchesDomain(frontmatter, 'example.com')).toBe(false);
  });
});

describe('getCurrentDomain', () => {
  it('should extract domain from host', () => {
    expect(getCurrentDomain('example.com:3000')).toBe('example.com');
    expect(getCurrentDomain('test.example.com')).toBe('test.example.com');
  });

  it('should return fallback for localhost', () => {
    const result = getCurrentDomain('localhost:4321');
    expect(result).toBe('domain-a.example');
  });

  it('should return fallback for pages.dev domains', () => {
    const result = getCurrentDomain('abc123.pages.dev');
    expect(result).toBe('domain-a.example');
  });
});

describe('generateMetaTags', () => {
  it('should generate meta tags for public note', () => {
    const frontmatter: NoteFrontmatter = {
      title: 'Test Note',
      description: 'Test description',
      date: '2025-09-22'
    };

    const result = generateMetaTags(frontmatter, 'test-slug');

    expect(result.title).toBe('Test Note | Blog');
    expect(result.description).toBe('Test description');
    expect(result.robots).toBe('index,follow');
    expect(result.canonical).toBe('/n/test-slug');
  });

  it('should generate meta tags for private note', () => {
    const frontmatter: NoteFrontmatter = {
      title: 'Private Note',
      status: 'private'
    };

    const result = generateMetaTags(frontmatter, 'private-slug');

    expect(result.robots).toBe('noindex,nofollow');
  });

  it('should handle note without title', () => {
    const frontmatter: NoteFrontmatter = {};
    const result = generateMetaTags(frontmatter, 'test-slug');

    expect(result.title).toBe('test slug | Blog');
    expect(result.description).toBe('Note: test slug');
  });
});

describe('fetchNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no content found', async () => {
    const mockEnv = {
      BLOG_CONTENT: {
        get: vi.fn().mockResolvedValue(null)
      }
    };

    global.fetch = vi.fn().mockRejectedValue(new Error('Not found'));

    const result = await fetchNote('nonexistent', 'example.com', mockEnv);
    expect(result).toBeNull();
  });

  it('should fetch note from R2 when available', async () => {
    const mockMarkdown = `---
title: 'Test Note'
---
Test content`;

    const mockEnv = {
      BLOG_CONTENT: {
        get: vi.fn().mockResolvedValue({
          text: () => Promise.resolve(mockMarkdown)
        })
      }
    };

    const result = await fetchNote('test-note', 'example.com', mockEnv);

    expect(result).toBeTruthy();
    expect(result?.frontmatter.title).toBe('Test Note');
    expect(result?.content).toBe('Test content');
    expect(result?.slug).toBe('test-note');
  });

  it('should fallback to public URL when R2 not available', async () => {
    const mockMarkdown = `---
title: 'Public Test Note'
---
Public content`;

    // Mock import.meta.env
    vi.stubGlobal('import.meta', {
      env: {
        PUBLIC_MD_BASES: 'https://content.example.com'
      }
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockMarkdown)
    });

    const result = await fetchNote('test-note', 'example.com');

    expect(result).toBeTruthy();
    expect(result?.frontmatter.title).toBe('Public Test Note');
    expect(result?.content).toBe('Public content');
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:4322/api/r2/example.com/test-note.md');
  });
});

describe('fetchPage', () => {
  it('should return null when no content found', async () => {
    const mockEnv = {
      BLOG_CONTENT: {
        get: vi.fn().mockResolvedValue(null)
      }
    };

    global.fetch = vi.fn().mockRejectedValue(new Error('Not found'));

    const result = await fetchPage('nonexistent', false, 'example.com', mockEnv);
    expect(result).toBeNull();
  });

  it('should render page content with wikilinks processed', async () => {
    const mockMarkdown = `---
title: 'Index Page'
---
Welcome to [[my-notes]]!`;

    const mockEnv = {
      BLOG_CONTENT: {
        get: vi.fn().mockResolvedValue({
          text: () => Promise.resolve(mockMarkdown)
        })
      }
    };

    const result = await fetchPage('index', false, 'example.com', mockEnv);

    expect(result).toContain('Welcome to <a href="/n/my-notes">my-notes</a>!');
  });
});

describe('H1 Detection and Duplicate Heading Prevention', () => {
  it('should detect H1 at beginning of content', () => {
    const markdownWithH1 = `---
title: 'Test Note'
---

# My Heading

Some content here.`;

    const note = parseFrontmatter(markdownWithH1);
    const hasH1 = /^\s*#\s+/.test(note.content.trim());

    expect(hasH1).toBe(true);
  });

  it('should not detect H1 when content starts with other text', () => {
    const markdownWithoutH1 = `---
title: 'Test Note'
---

Some paragraph text first.

## Then an H2

More content.`;

    const note = parseFrontmatter(markdownWithoutH1);
    const hasH1 = /^\s*#\s+/.test(note.content.trim());

    expect(hasH1).toBe(false);
  });

  it('should not detect H1 when ## H2 is at beginning', () => {
    const markdownWithH2 = `---
title: 'Test Note'
---

## This is an H2

Not an H1.`;

    const note = parseFrontmatter(markdownWithH2);
    const hasH1 = /^\s*#\s+/.test(note.content.trim());

    expect(hasH1).toBe(false);
  });

  it('fetchNote should include hasH1 property', async () => {
    const markdownWithH1 = `---
title: 'Test Note'
---

# Test Heading

Content here.`;

    const mockEnv = {
      BLOG_CONTENT: {
        get: vi.fn().mockResolvedValue({
          text: () => Promise.resolve(markdownWithH1)
        })
      }
    };

    const result = await fetchNote('test-h1', 'example.com', mockEnv);

    expect(result).toBeTruthy();
    expect(result!.hasH1).toBe(true);
    expect(result!.frontmatter.title).toBe('Test Note');
  });

  it('fetchNote should set hasH1 to false when no H1', async () => {
    const markdownWithoutH1 = `---
title: 'Test Note'
---

Some content without heading.

## An H2 Later

More content.`;

    const mockEnv = {
      BLOG_CONTENT: {
        get: vi.fn().mockResolvedValue({
          text: () => Promise.resolve(markdownWithoutH1)
        })
      }
    };

    const result = await fetchNote('test-no-h1', 'example.com', mockEnv);

    expect(result).toBeTruthy();
    expect(result!.hasH1).toBe(false);
    expect(result!.frontmatter.title).toBe('Test Note');
  });
});

describe('Markdown Endpoint Integration', () => {
  it('should handle domain-specific markdown retrieval', async () => {
    const domainMarkdown = `---
title: 'Domain Specific Note'
---

# Domain Note

This is a domain-specific note.`;

    const mockEnv = {
      BLOG_CONTENT: {
        get: vi.fn()
          .mockResolvedValueOnce(null) // First try: domain-a.example/test-domain.md (not found)
          .mockResolvedValueOnce({    // Second try: shared/test-domain.md (found)
            text: () => Promise.resolve(domainMarkdown)
          })
      }
    };

    const result = await fetchNote('test-domain', 'domain-a.example', mockEnv);

    expect(result).toBeTruthy();
    expect(result!.frontmatter.title).toBe('Domain Specific Note');
    expect(result!.hasH1).toBe(true);
    expect(mockEnv.BLOG_CONTENT.get).toHaveBeenCalledWith('domain-a.example/test-domain.md');
    expect(mockEnv.BLOG_CONTENT.get).toHaveBeenCalledWith('shared/test-domain.md');
  });

  it('should handle legacy markdown retrieval', async () => {
    const legacyMarkdown = `---
title: 'Legacy Note'
---

Content without H1 at start.

## Some section`;

    const mockEnv = {
      BLOG_CONTENT: {
        get: vi.fn()
          .mockResolvedValueOnce(null) // First try: domain/note.md (not found)
          .mockResolvedValueOnce(null) // Second try: shared/note.md (not found)
          .mockResolvedValueOnce({    // Third try: note.md (found)
            text: () => Promise.resolve(legacyMarkdown)
          })
      }
    };

    const result = await fetchNote('legacy-note', 'example.com', mockEnv);

    expect(result).toBeTruthy();
    expect(result!.frontmatter.title).toBe('Legacy Note');
    expect(result!.hasH1).toBe(false);
    expect(mockEnv.BLOG_CONTENT.get).toHaveBeenCalledWith('example.com/legacy-note.md');
    expect(mockEnv.BLOG_CONTENT.get).toHaveBeenCalledWith('shared/legacy-note.md');
    expect(mockEnv.BLOG_CONTENT.get).toHaveBeenCalledWith('legacy-note.md');
  });
});