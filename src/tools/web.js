"use strict";

const { APIConfig } = require('../integrations/api-config');
const fetch = (...a) => import("node-fetch").then(({default:f}) => f(...a));

/**
 * Web search functionality using SerpAPI
 */
async function webSearch(args) {
  const { query, limit = 5 } = args;
  
  if (!query) {
    throw new Error("Search query is required");
  }

  const config = new APIConfig();
  const serpApiKey = config.config.serpApiKey;
  
  // Check if SerpAPI key is configured
  if (!serpApiKey) {
    return `⚠️ Web Search Error: SerpAPI key not configured\n\n🔧 To fix this:\n1. Go to Settings → API Keys\n2. Add your SerpAPI key (get one at https://serpapi.com/dashboard)\n3. Save and retry\n\n💡 Mock results provided instead:\n• Search results for: ${query}\n• This would normally show real web search results\n• Configure SerpAPI for actual search functionality`;
  }

  try {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${serpApiKey}&engine=google&num=${limit}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 401) {
        return `⚠️ Web Search Error: Invalid SerpAPI key\n\n🔧 To fix this:\n1. Go to Settings → API Keys\n2. Check your SerpAPI key is valid\n3. Get a new key at https://serpapi.com/dashboard if needed\n4. Save and retry`;
      }
      throw new Error(`SerpAPI request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.organic_results && data.organic_results.length > 0) {
      const results = data.organic_results.slice(0, limit).map(result => ({
        title: result.title || 'No title',
        url: result.link || '#',
        snippet: result.snippet || 'No description'
      }));
      
      const summary = results.map(r => `• ${r.title}\n  ${r.snippet}\n  ${r.url}`).join('\n\n');
      
      return `🔍 Web Search Results for "${query}":\n\n${summary}`;
    } else {
      return `No search results found for "${query}"`;
    }
    
  } catch (error) {
    return `Web search error: ${error.message}\n\n💡 Check your SerpAPI configuration in Settings.`;
  }
}

module.exports = { webSearch };