import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre><code class="hljs language-' + lang + '">' +
               hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
               '</code></pre>';
      } catch (__) {}
    }
    return '<pre><code class="hljs">' + md.utils.escapeHtml(str) + '</code></pre>';
  }
});

type RuntimeEnv = {
  BLOG_CONTENT?: {
    get(key: string): Promise<any>;
  };
} | undefined;

function addEndpoint(endpoints: string[], visited: Set<string>, url: string) {
  if (!visited.has(url)) {
    endpoints.push(url);
    visited.add(url);
  }
}

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
  let processed = content.replace(/\[\[([^\]]+)\]\]/g, (match, linkText) => {
    const slug = linkText.toLowerCase().replace(/\s+/g, '-');
    return `[${linkText}](/n/${slug})`;
  });

  // Add markdown version links for index pages
  if (addMarkdownLinks) {
    processed = processed.replace(/(\[([^\]]+)\]\(\/n\/([^)]+)\))/g, (match, fullLink, linkText, slug) => {
      return `${fullLink} ([.md](/n/${slug}.md))`;
    });
  }

  return processed;
}

export async function fetchNote(slug: string, currentDomain?: string, env?: RuntimeEnv): Promise<Note | null> {
  // Build domain-aware endpoints
  const endpoints: string[] = [];
  const visited = new Set<string>();
  const r2Keys = new Set<string>();

  const segments = slug.split('/').filter(Boolean);
  const firstSegment = segments[0];
  const rest = segments.slice(1).join('/');

  const addCandidate = (key: string) => {
    if (!key) return;
    r2Keys.add(key);
    addEndpoint(endpoints, visited, `/api/r2/${key}`);
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

  // Legacy fallback endpoint
  addEndpoint(endpoints, visited, `/api/r2/${slug}.md`);

  if (env?.BLOG_CONTENT && r2Keys.size > 0) {
    for (const key of r2Keys) {
      const markdown = await loadFromR2(env, key);
      if (!markdown) continue;
      const { frontmatter, content } = parseFrontmatter(markdown);
      const processedContent = processWikilinks(content);
      const html = md.render(processedContent);

      return {
        frontmatter,
        content: processedContent,
        html,
        slug
      };
    }
  }

  for (const url of endpoints) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        const markdown = await response.text();
        const { frontmatter, content } = parseFrontmatter(markdown);
        const processedContent = processWikilinks(content);
        const html = md.render(processedContent);

        return {
          frontmatter,
          content: processedContent,
          html,
          slug
        };
      }
    } catch (error) {
      console.error(`Failed to fetch from ${url}:`, error);
    }
  }

  return null;
}

export async function fetchMOC(url?: string, addMarkdownLinks = false, currentDomain?: string, env?: RuntimeEnv): Promise<string | null> {
  const keys = new Set<string>();

  if (currentDomain) {
    keys.add(`${currentDomain}/index.md`);
  }

  if (url && !url.startsWith('http')) {
    keys.add(url.replace(/^\/+/, ''));
  }

  if (env?.BLOG_CONTENT) {
    for (const key of keys) {
      const markdown = await loadFromR2(env, key);
      if (!markdown) continue;
      const { content } = parseFrontmatter(markdown);
      const processedContent = processWikilinks(content, addMarkdownLinks);
      return md.render(processedContent);
    }
  }

  if (url && url.startsWith('http')) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const markdown = await response.text();
        const { content } = parseFrontmatter(markdown);
        const processedContent = processWikilinks(content, addMarkdownLinks);
        return md.render(processedContent);
      }
    } catch (error) {
      console.error(`Failed to fetch MOC from ${url}:`, error);
    }
  }

  return null;
}

export async function fetchPartial(partial: string, currentDomain?: string, addMarkdownLinks = false, env?: RuntimeEnv): Promise<string | null> {
  if (!currentDomain) return null;

  const bases = (import.meta.env.PUBLIC_MD_BASES ?? '')
    .split(';')
    .map((base) => base.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const key = `${currentDomain}/${partial}.md`;

  if (env?.BLOG_CONTENT) {
    const markdown = await loadFromR2(env, key);
    if (markdown) {
      const { content } = parseFrontmatter(markdown);
      const processedContent = processWikilinks(content, addMarkdownLinks);
      return md.render(processedContent);
    }
  }

  for (const base of bases) {
    const url = `${base}/${key}`;
    try {
      const response = await fetch(url);
      if (!response.ok) continue;

      const markdown = await response.text();
      const { content } = parseFrontmatter(markdown);
      const processedContent = processWikilinks(content, addMarkdownLinks);
      return md.render(processedContent);
    } catch (error) {
      console.error(`Failed to fetch partial ${partial} from ${url}:`, error);
    }
  }

  return null;
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

export function generateMetaTags(frontmatter: NoteFrontmatter, slug: string) {
  const title = frontmatter.title || slug.replace(/-/g, ' ');
  const description = frontmatter.description || `Заметка: ${title}`;
  const siteTitle = "Zettelkasten Blog";
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
