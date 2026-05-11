#!/usr/bin/env node

// ============================================================================
// Follow Builders — RSS Feed Generator
// ============================================================================
// Fetches the three JSON feeds from the upstream repo and generates an
// Atom XML feed. No API keys needed — pure fetch + JSON-to-XML.
//
// Usage: node generate-rss.js
// Output: ../feed.xml
// ============================================================================

import { writeFile } from 'fs/promises';
import { join } from 'path';

const scriptDir = decodeURIComponent(new URL('.', import.meta.url).pathname);
const rootDir = join(scriptDir, '..');

const UPSTREAM = 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main';

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toISODate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  return new Date(dateStr).toISOString();
}

function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function main() {
  const [feedX, feedPodcasts, feedBlogs] = await Promise.all([
    fetchJSON(`${UPSTREAM}/feed-x.json`),
    fetchJSON(`${UPSTREAM}/feed-podcasts.json`),
    fetchJSON(`${UPSTREAM}/feed-blogs.json`),
  ]);

  const entries = [];
  const now = new Date().toISOString();
  const feedUpdated = feedX?.generatedAt || feedPodcasts?.generatedAt || now;

  // --- Tweets ---
  if (feedX?.x) {
    for (const builder of feedX.x) {
      for (const tweet of builder.tweets) {
        entries.push({
          id: tweet.url,
          title: `${builder.name} (@${builder.handle})`,
          content: tweet.text,
          link: tweet.url,
          published: toISODate(tweet.createdAt),
          authorName: builder.name,
          category: 'twitter',
        });
      }
    }
  }

  // --- Blog posts ---
  if (feedBlogs?.blogs) {
    for (const blog of feedBlogs.blogs) {
      entries.push({
        id: blog.url,
        title: `${blog.name}: ${blog.title}`,
        content: truncate(blog.content, 1000),
        link: blog.url,
        published: toISODate(blog.publishedAt),
        authorName: blog.author || blog.name,
        category: 'blog',
      });
    }
  }

  // --- Podcasts ---
  if (feedPodcasts?.podcasts) {
    for (const ep of feedPodcasts.podcasts) {
      entries.push({
        id: ep.url || ep.guid,
        title: `${ep.name}: ${ep.title}`,
        content: truncate(ep.transcript, 500),
        link: ep.url,
        published: toISODate(ep.publishedAt),
        authorName: ep.name,
        category: 'podcast',
      });
    }
  }

  // Sort by published date descending
  entries.sort((a, b) => new Date(b.published) - new Date(a.published));

  // --- Build Atom XML ---
  const atomEntries = entries.map(e => `  <entry>
    <id>${escapeXml(e.id)}</id>
    <title>${escapeXml(e.title)}</title>
    <link href="${escapeXml(e.link)}" rel="alternate" />
    <published>${e.published}</published>
    <updated>${e.published}</updated>
    <author><name>${escapeXml(e.authorName)}</name></author>
    <category term="${e.category}" />
    <content type="text">${escapeXml(e.content)}</content>
  </entry>`).join('\n');

  const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>https://github.com/yucheng-Li/follow-builders</id>
  <title>AI Builders Digest</title>
  <subtitle>Daily updates from top AI builders — tweets, podcasts, and blog posts</subtitle>
  <link href="https://github.com/yucheng-Li/follow-builders" rel="alternate" />
  <link href="https://raw.githubusercontent.com/yucheng-Li/follow-builders/main/feed.xml" rel="self" />
  <updated>${feedUpdated}</updated>
  <icon>https://github.githubassets.com/favicons/favicon.svg</icon>
${atomEntries}
</feed>
`;

  const outPath = join(rootDir, 'feed.xml');
  await writeFile(outPath, atom, 'utf-8');
  console.log(`Wrote ${entries.length} entries to feed.xml`);
}

main().catch(err => {
  console.error('Error generating RSS:', err.message);
  process.exit(1);
});
