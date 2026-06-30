import type { Tool, ToolContext, ToolResult } from './types.js';

export const webSearchTool: Tool = {
  name: 'web.search',
  description: 'Search the web using DuckDuckGo for up-to-date information. Returns titles, URLs, and snippets.',
  positional: 'query',
  args: [
    { name: 'query', description: 'The search query string', required: true }
  ],
  run: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const query = typeof args.query === 'string' ? args.query : '';
    if (!query) return { ok: false, error: 'Usage: @web.search <query>' };

    try {
      ctx.emit(`Searching the web for "${query}"...\n`);
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const html = await res.text();
      const results: Array<{ title: string; url: string; snippet: string }> = [];
      const resultBlocks = html.split('<div class="result results_links results_links_deep web-result');
      
      for (const block of resultBlocks.slice(1)) {
        const titleMatch = block.match(/<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
                           block.match(/<a class="result__link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
                           
        const snippetMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i) ||
                             block.match(/<div class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);

        if (titleMatch) {
          let urlVal = titleMatch[1] ? titleMatch[1].trim() : '';
          
          if (urlVal.includes('uddg=')) {
            const uddgMatch = urlVal.match(/uddg=([^&]+)/);
            if (uddgMatch && uddgMatch[1]) {
              urlVal = decodeURIComponent(uddgMatch[1]);
            }
          }

          const clean = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          const title = clean(titleMatch[2] || 'Untitled');
          const snippet = snippetMatch ? clean(snippetMatch[1] || '') : '';

          if (urlVal && !urlVal.startsWith('/')) {
            results.push({ title, url: urlVal, snippet });
          }
        }
      }

      if (results.length === 0) {
        ctx.emit('(no results found on the web)\n');
        return { ok: true, output: '(no results found on the web)' };
      }

      const formatted = results
        .slice(0, 8)
        .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}\n`)
        .join('\n');

      ctx.emit(`Found ${results.length} web search results.\n`);
      return { ok: true, output: formatted };
    } catch (err) {
      return {
        ok: false,
        error: `Web search failed: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }
};

export const webFetchTool: Tool = {
  name: 'web.fetch',
  description: 'Fetch and extract plain-text content from a public webpage URL (capped at 10,000 chars).',
  positional: 'url',
  args: [
    { name: 'url', description: 'The public webpage URL to fetch', required: true }
  ],
  run: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const url = typeof args.url === 'string' ? args.url : '';
    if (!url) return { ok: false, error: 'Usage: @web.fetch <url>' };

    try {
      ctx.emit(`Fetching webpage content from ${url}...\n`);
      
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      let html = await res.text();

      // Clean script, style, and metadata tags
      html = html.replace(/<(script|style|svg|head|footer|nav|noscript|iframe)[^>]*>([\s\S]*?)<\/\1>/gi, '');
      
      // Extract main text content
      let text = html.replace(/<[^>]+>/g, ' ');
      
      // Clean up spacing
      text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();

      const capLimit = 10000;
      const finalOutput = text.length > capLimit ? text.slice(0, capLimit) + '\n... [truncated]' : text;
      
      ctx.emit(`Successfully fetched ${finalOutput.length} characters of plain text.\n`);
      return { ok: true, output: finalOutput || '(empty page)' };
    } catch (err) {
      return {
        ok: false,
        error: `Web fetch failed: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }
};

export const mayaNewsTool: Tool = {
  name: 'maya.news',
  description: 'Query Maya (Knobly Cream NewsFeed RAG) to retrieve pre-synthesized, curated news insights and posts on a topic.',
  positional: 'query',
  args: [
    { name: 'query', description: 'The news topic or query string to search inside Cream', required: true }
  ],
  run: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const query = typeof args.query === 'string' ? args.query : '';
    if (!query) return { ok: false, error: 'Usage: @maya.news <query>' };

    try {
      ctx.emit(`Querying Maya NewsFeed RAG for "${query}"...\n`);
      
      const res = await fetch('https://www.knoblycream.com/api/landing_chat.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) c9ai-cli/4.0.0'
        },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: query }
          ]
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const payload = await res.json() as { reply?: string; error?: string };
      
      if (payload.error) {
        throw new Error(payload.error);
      }

      const reply = payload.reply || '';
      if (!reply.trim()) {
        ctx.emit('(no results found on Maya NewsFeed)\n');
        return { ok: true, output: '(no results found on Maya NewsFeed)' };
      }

      ctx.emit(`Successfully retrieved news report from Maya RAG.\n`);
      return { ok: true, output: reply };
    } catch (err) {
      return {
        ok: false,
        error: `Maya NewsFeed query failed: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }
};

export const webTools = [webSearchTool, webFetchTool, mayaNewsTool];
