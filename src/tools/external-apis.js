/**
 * External API Tools
 * Integrations with KnoblyCream and YouTube APIs
 */

"use strict";

const { CreamAPI } = require('../integrations/cream-api');
const { YouTubeAPI } = require('../integrations/youtube-api');

// Initialize API clients
const creamAPI = new CreamAPI();
const youtubeAPI = new YouTubeAPI();

/**
 * RSS Feeds Tool
 */
async function rssRead(args) {
  const { rss_id = 8, raw = false } = args || {};
  
  try {
    const result = await creamAPI.getRSSFeeds(rss_id);
    
    if (result.success) {
      const items = Array.isArray(result.articles) ? result.articles : [];
      if (raw) {
        try { return JSON.stringify(items, null, 2); } catch { return String(items); }
      }
      const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const top = items.slice(0, 5).map(a => {
        const title = strip(a.title || 'Untitled');
        const descr = strip(a.description || '');
        const date = strip(a.date || a.published_at || '');
        const img = strip(a.image || a.thumbnail || '');
        const url = a.url || '';
        const lines = [];
        if (title && url) lines.push(`- [${title}](${url})`);
        else if (title) lines.push(`- ${title}`);
        if (img) lines.push(`![thumbnail](${img})`);
        if (descr) lines.push(`${descr}`);
        if (url) lines.push(`[Read more](${url})${date ? ` · ${date}` : ''}`);
        return lines.join('\n');
      }).join('\n\n');
      return `## Essential Results\n\n${top}`;
    } else {
      return `Failed to fetch RSS feed: ${result.error || 'Unknown error'}`;
    }
  } catch (error) {
    // Check if it's likely an API key issue
    if (error.message.includes('API') || error.message.includes('auth') || error.message.includes('401') || error.message.includes('403')) {
      return `⚠️ RSS Feed Error: API authentication failed\n\n🔧 To fix this:\n1. Go to Settings → API Keys\n2. Configure your KnoblyCream API credentials\n3. Save and retry\n\nError: ${error.message}`;
    }
    return `RSS feed error: ${error.message}\n\n💡 If this persists, check your API configuration in Settings.`;
  }
}

/**
 * Cream Posts Tool
 */
async function creamFetch(args) {
  const { limit = 10, raw = false } = args;
  
  try {
    const result = await creamAPI.getRecentPosts(limit);
    
    if (result.success) {
      const posts = result.posts;

      if (raw) {
        // Return raw JSON (first N) for inspection
        try {
          const snippet = Array.isArray(posts) ? posts.slice(0, limit) : posts;
          return JSON.stringify(snippet, null, 2);
        } catch (e) {
          return `Raw posts (unformatted): ${String(posts)}`;
        }
      }

      const pick = (obj, keys) => {
        for (const k of keys) {
          if (obj && obj[k] != null && String(obj[k]).trim() !== '') return String(obj[k]);
        }
        return '';
      };
      const strip = (s) => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

      const toArray = (x) => Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.values(x) : []);
      const arr = toArray(posts);
      const summary = arr.length
        ? arr.slice(0, 5).map(post => {
            // Handle chat stream shape: { id, full_name, chat }
            const chatUser = pick(post, ['full_name', 'user', 'author']);
            const chatText = pick(post, ['chat', 'message', 'text', 'content', 'description']);

            const title = pick(post, ['title', 'headline', 'subject']) || chatText;
            const date  = pick(post, ['created_at', 'createdAt', 'timestamp', 'time', 'date', 'published_at']);

            const safeTitle = title ? strip(title).slice(0, 160) : '(no content)';
            const safeUser  = chatUser ? strip(chatUser) + ' — ' : '';
            const suffix    = date ? (' - ' + strip(date)) : '';
            return `• ${safeUser}${safeTitle}${suffix}`;
          }).join('\n')
        : 'No posts in expected format';
        
      return `Recent Cream Posts (${result.count} found):\n\n${summary}${result.count > 5 ? '\n\n...and more posts available' : ''}`;
    } else {
      return `Failed to fetch Cream posts: ${result.error || 'Unknown error'}`;
    }
  } catch (error) {
    // Check if it's likely an API key issue
    if (error.message.includes('API') || error.message.includes('auth') || error.message.includes('401') || error.message.includes('403')) {
      return `⚠️ Cream Posts Error: API authentication failed\n\n🔧 To fix this:\n1. Go to Settings → API Keys\n2. Configure your KnoblyCream API credentials\n3. Save and retry\n\nError: ${error.message}`;
    }
    return `Cream posts fetch error: ${error.message}\n\n💡 If this persists, check your API configuration in Settings.`;
  }
}

/**
 * Email Sending Tool
 */
async function creamMail(args) {
  const { 
    from_email, 
    from_name = '', 
    to_email, 
    to_name = '', 
    subject, 
    body 
  } = args;
  
  // Validate required fields
  if (!from_email || !to_email || !subject || !body) {
    return 'Error: Missing required email fields. Need: from_email, to_email, subject, body';
  }
  
  try {
    const result = await creamAPI.sendEmail({
      fromEmail: from_email,
      fromName: from_name,
      toEmail: to_email,
      toName: to_name,
      subject: subject,
      body: body
    });
    
    if (result.success) {
      return `✅ Email sent successfully to ${to_email}\nSubject: ${subject}\nSent at: ${result.emailSent.sentAt}`;
    } else {
      return `Failed to send email: ${result.error || 'Unknown error'}`;
    }
  } catch (error) {
    return `Email send error: ${error.message}`;
  }
}

/**
 * Cream Post Creation Tool
 */
async function creamPost(args) {
  const { 
    content, 
    visibility = 'public',
    media = []
  } = args;
  
  if (!content) {
    return 'Error: Post content is required';
  }
  
  try {
    const result = await creamAPI.createPost({
      content: content,
      visibility: visibility,
      mediaFiles: Array.isArray(media) ? media : []
    });
    
    if (result.success) {
      return `✅ Post created successfully!\nVisibility: ${result.visibility}\nMedia files: ${result.mediaCount}\nCreated at: ${result.createdAt}`;
    } else {
      return `Failed to create post: ${result.error || 'Unknown error'}`;
    }
  } catch (error) {
    return `Post creation error: ${error.message}`;
  }
}

/**
 * YouTube Video Search Tool
 */
async function youtubeSearch(args) {
  const { 
    query, 
    max_results = 5,
    order = 'relevance'
  } = args;
  
  if (!query) {
    return 'Error: Search query is required';
  }
  
  try {
    const result = await youtubeAPI.searchVideos(query, {
      maxResults: max_results,
      order: order
    });
    
    if (result.success) {
      const videos = result.videos;
      const summary = videos.map(video => 
        `• ${video.title}\n  Channel: ${video.channelTitle}\n  URL: ${video.url}\n  Published: ${new Date(video.publishedAt).toLocaleDateString()}`
      ).join('\n\n');
        
      return `YouTube Search: "${query}" (${result.totalResults} total results)\n\n${summary}`;
    } else {
      return `Failed to search YouTube: ${result.error || 'Unknown error'}`;
    }
  } catch (error) {
    return `YouTube search error: ${error.message}`;
  }
}

/**
 * YouTube Trending Videos Tool
 */
async function youtubeTrending(args) {
  const { 
    region = 'US',
    max_results = 10
  } = args;
  
  try {
    const result = await youtubeAPI.getTrendingVideos(region, max_results);
    
    if (result.success) {
      const videos = result.videos;
      const summary = videos.slice(0, 5).map(video => 
        `• ${video.title}\n  Channel: ${video.channelTitle}\n  Views: ${parseInt(video.viewCount).toLocaleString()}\n  URL: ${video.url}`
      ).join('\n\n');
        
      return `Trending Videos in ${region} (${result.count} found):\n\n${summary}${result.count > 5 ? '\n\n...and more trending videos' : ''}`;
    } else {
      return `Failed to fetch trending videos: ${result.error || 'Unknown error'}`;
    }
  } catch (error) {
    return `YouTube trending error: ${error.message}`;
  }
}

/**
 * API Status Check Tool
 */
async function apiStatus(args) {
  try {
    const creamStatus = await creamAPI.getAPIStatus();
    const youtubeStatus = await youtubeAPI.getAPIStatus();
    
    return `API Status Report:

🍦 Cream API:
- Base URL: ${creamStatus.baseUrl}
- API Key: ${creamStatus.hasApiKey ? '✅ Configured' : '❌ Missing'}
- Connectivity: ${creamStatus.connectivity === 'ok' ? '✅ Working' : '❌ Failed'}
${creamStatus.error ? `- Error: ${creamStatus.error}` : ''}

📺 YouTube API:
- Base URL: ${youtubeStatus.baseUrl}  
- API Key: ${youtubeStatus.hasApiKey ? '✅ Configured' : '❌ Missing'}
- Connectivity: ${youtubeStatus.connectivity === 'ok' ? '✅ Working' : '❌ Failed'}
${youtubeStatus.error ? `- Error: ${youtubeStatus.error}` : ''}`;
  } catch (error) {
    return `API status check failed: ${error.message}`;
  }
}

module.exports = {
  rssRead,
  creamFetch,  
  creamMail,
  creamPost,
  youtubeSearch,
  youtubeTrending,
  apiStatus
};
