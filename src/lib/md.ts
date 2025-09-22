import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre><code class="hljs language-' + lang + '">' +
               hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
               '</code></pre>';
      } catch {}
    }
    return '<pre><code class="hljs">' + md.utils.escapeHtml(str) + '</code></pre>';
  }
});

type RuntimeEnv = {
  BLOG_CONTENT?: {
    get(key: string): Promise<any>;
  };
} | undefined;


async function loadFromR2(env: RuntimeEnv, key: string): Promise<string | null> {
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

export interface NoteFrontmatter {
  title?: string;
  description?: string;
  date?: string;
  tags?: string[];
  category?: string;
  status?: 'public' | 'private';
  domain?: string;
  cover?: string;
  aliases?: string[];
}

export interface Note {
  frontmatter: NoteFrontmatter;
  content: string;
  html: string;
  slug: string;
  hasH1: boolean;
}

export function parseFrontmatter(markdown: string): { frontmatter: NoteFrontmatter; content: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = markdown.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, content: markdown };
  }

  const frontmatterString = match[1];
  const content = match[2];

  // Simple YAML parser for frontmatter
  const frontmatter: NoteFrontmatter = {};
  const lines = frontmatterString.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Handle arrays (simple case)
    if (value.startsWith('[') && value.endsWith(']')) {
      const arrayContent = value.slice(1, -1);
      (frontmatter as any)[key] = arrayContent.split(',').map(item =>
        item.trim().replace(/^["']|["']$/g, '')
      );
    } else {
      (frontmatter as any)[key] = value;
    }
  }

  return { frontmatter, content };
}

export function processWikilinks(content: string, addMarkdownLinks = false): string {
  // Convert [[wikilink]] to /n/wikilink
  let processed = content.replace(/\[\[([^\]]+)\]\]/g, (_, linkText) => {
    const slug = linkText.toLowerCase().replace(/\s+/g, '-');
    return `[${linkText}](/n/${slug})`;
  });

  // Add markdown version links for index pages
  if (addMarkdownLinks) {
    processed = processed.replace(/(\[([^\]]+)\]\(\/n\/([^)]+)\))/g, (_, fullLink, __, slug) => {
      return `${fullLink} ([.md](/n/${slug}.md))`;
    });
  }

  return processed;
}

function createNoteFromMarkdown(markdown: string, slug: string): Note {
  const { frontmatter, content } = parseFrontmatter(markdown);
  const processedContent = processWikilinks(content);
  const html = md.render(processedContent);

  // Check if content starts with H1 (# at beginning of line)
  const hasH1 = /^\s*#\s+/.test(content.trim());

  return {
    frontmatter,
    content: processedContent,
    html,
    slug,
    hasH1
  };
}

export async function fetchNote(slug: string, currentDomain?: string, env?: RuntimeEnv, request?: Request): Promise<Note | null> {
  // Simplified domain-aware note fetching
  const tryKeys: string[] = [];

  // Priority order: domain-specific, shared, legacy
  if (currentDomain) {
    tryKeys.push(`${currentDomain}/${slug}.md`);
  }
  tryKeys.push(`shared/${slug}.md`);
  tryKeys.push(`${slug}.md`);

  // Try R2 first if available (production)
  if (env?.BLOG_CONTENT) {
    for (const key of tryKeys) {
      const markdown = await loadFromR2(env, key);
      if (markdown) {
        return createNoteFromMarkdown(markdown, slug);
      }
    }
  }

  // Fallback to API endpoints (dev + production)
  for (const key of tryKeys) {
    try {
      const url = new URL(`/api/r2/${key}`, request?.url || 'http://localhost:4322');
      const response = await fetch(url.toString());
      if (response.ok) {
        const markdown = await response.text();
        return createNoteFromMarkdown(markdown, slug);
      }
    } catch (error) {
      console.error(`Failed to fetch ${key}:`, error);
    }
  }

  return null;
}

export async function fetchPage(slug: string, addMarkdownLinks = false, currentDomain?: string, env?: RuntimeEnv, request?: Request): Promise<string | null> {
  // Unified page fetching - no distinction between MOC and regular pages
  const note = await fetchNote(slug, currentDomain, env, request);
  if (!note) return null;

  const processedContent = processWikilinks(note.content, addMarkdownLinks);
  return md.render(processedContent);
}


export function isPrivate(frontmatter: NoteFrontmatter): boolean {
  return frontmatter.status === 'private';
}

export function matchesDomain(frontmatter: NoteFrontmatter, host: string): boolean {
  if (!frontmatter.domain) return true;
  return frontmatter.domain === host;
}

export function getCurrentDomain(host: string): string {
  // Extract domain from host (remove port if present)
  const domain = host.split(':')[0];
  const fallbackDomain = import.meta.env.PUBLIC_DEFAULT_DOMAIN?.trim() || 'domain-a.example';

  // For localhost, return a default domain
  if (domain === 'localhost' || domain === '127.0.0.1') {
    return fallbackDomain;
  }

  // For Cloudflare Pages preview domains
  if (domain.endsWith('.pages.dev')) {
    return fallbackDomain;
  }

  return domain;
}

export function generateDefaultHeader(): string {
  const siteName = 'Blog';
  return md.render(`# [🌟 ${siteName} - Zettelkasten](/)

**Navigation:** [🔍 Search](/search) | [🤖 llms.txt](/llms.txt)`);
}

export function generateMetaTags(frontmatter: NoteFrontmatter, slug: string) {
  const title = frontmatter.title || slug.replace(/-/g, ' ');
  const description = frontmatter.description || `Note: ${title}`;
  const siteTitle = "Blog";
  const fullTitle = title === siteTitle ? title : `${title} | ${siteTitle}`;
  const canonical = frontmatter.domain ? `https://${frontmatter.domain}/n/${slug}` : `/n/${slug}`;

  return {
    title: fullTitle,
    description,
    canonical,
    robots: isPrivate(frontmatter) ? 'noindex,nofollow' : 'index,follow',
    og: {
      title: fullTitle,
      description,
      type: 'article',
      image: frontmatter.cover,
      publishedTime: frontmatter.date,
      url: canonical
    }
  };
}
