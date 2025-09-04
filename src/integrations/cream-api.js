/**
 * KnoblyCream API Integration
 * Provides RSS feeds, posts, and mailer functionality
 */

"use strict";

const fetch = (...a) => import("node-fetch").then(({default:f}) => f(...a));
const FormData = require('form-data');
const { APIConfig } = require('./api-config');
const { setTimeout: sleep } = require('node:timers/promises');

async function fetchWithTimeout(url, opts = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs).unref?.();
  const started = Date.now();
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
    const elapsed = Date.now() - started;
    if (elapsed > 5000) {
      // eslint-disable-next-line no-console
      console.log(`🌐 fetch ${url} took ${elapsed}ms`);
    }
  }
}

class CreamAPI {
  constructor() {
    this.config = new APIConfig();
    this.timeoutMs = Number(process.env.CREAM_TIMEOUT_MS || 45000);
  }

  /**
   * 1. RSS Feeds API
   * GET https://knoblycream.com/api/articles.php?rss_id=8
   */
  async getRSSFeeds(rssId = 8) {
    try {
      const url = `${this.config.config.creamBaseUrl}/articles.php?rss_id=${rssId}`;
      
      // Retry up to 2 times on network timeouts/aborts
      let response;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await fetchWithTimeout(url, {
            method: 'GET',
            headers: {
              'User-Agent': 'c9ai-client/1.0'
            }
          }, this.timeoutMs);
          break;
        } catch (e) {
          if (attempt >= 3) throw e;
          await sleep(500 * attempt);
        }
      }

      if (!response.ok) {
        throw new Error(`RSS API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        rssId: rssId,
        articles: data,
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`RSS feeds fetch failed: ${error.message}`);
    }
  }

  /**
   * 2. Fetch Recent Cream Posts
   * GET https://knoblycream.com/api/stream.php
   */
  async getRecentPosts(limit = 10) {
    try {
      const url = `${this.config.config.creamBaseUrl}/stream.php`;
      
      let response;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await fetchWithTimeout(url, {
            method: 'GET',
            headers: {
              'User-Agent': 'c9ai-client/1.0'
            }
          }, this.timeoutMs);
          break;
        } catch (e) {
          if (attempt >= 3) throw e;
          await sleep(500 * attempt);
        }
      }

      if (!response.ok) {
        throw new Error(`Stream API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Normalize various payload shapes:
      // 1) [ {...}, {...} ]
      // 2) { data: [ {...} ] }
      // 3) { posts: [ {...} ] }
      // 4) { items: [ {...} ] }
      let items = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (Array.isArray(data?.data)) {
        items = data.data;
      } else if (Array.isArray(data?.posts)) {
        items = data.posts;
      } else if (Array.isArray(data?.items)) {
        items = data.items;
      } else if (data && typeof data === 'object') {
        // Try common object-of-objects case
        const vals = Object.values(data);
        if (vals.length && Array.isArray(vals[0])) items = vals[0];
      }
      
      const limitedData = Array.isArray(items) ? items.slice(0, limit) : [];
      
      return {
        success: true,
        posts: limitedData,
        count: limitedData.length,
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Recent posts fetch failed: ${error.message}`);
    }
  }

  /**
   * 3. Mailer API
   * POST https://knoblycream.com/api/mail.php
   */
  async sendEmail(emailData) {
    try {
      const {
        fromEmail,
        fromName,
        toEmail,
        toName,
        subject,
        body
      } = emailData;

      // Validate required fields
      if (!fromEmail || !toEmail || !subject || !body) {
        throw new Error('Missing required email fields: fromEmail, toEmail, subject, body');
      }

      const url = `${this.config.config.creamBaseUrl}/mail.php`;
      
      const payload = {
        action: "send",
        from_email: fromEmail,
        from_name: fromName || 'C9AI Assistant',
        to_email: toEmail,
        to_name: toName || 'Recipient',
        subject: subject,
        body: body
      };

      console.log(`📧 Sending email request to: ${url}`);
      console.log(`📧 Payload:`, JSON.stringify(payload, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: this.config.getCreamHeaders(),
        body: JSON.stringify(payload)
      });

      console.log(`📧 Response status: ${response.status} ${response.statusText}`);
      
      // Always get the response text first
      const responseText = await response.text();
      console.log(`📧 Raw response:`, responseText);

      if (!response.ok) {
        throw new Error(`Mailer API request failed: ${response.status} ${response.statusText} - ${responseText}`);
      }

      // Try to parse as JSON
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`📧 JSON parse error:`, parseError.message);
        console.error(`📧 Response text that failed to parse:`, responseText);
        throw new Error(`Invalid JSON response from mailer API: ${responseText}`);
      }
      
      return {
        success: true,
        result: result,
        emailSent: {
          to: toEmail,
          subject: subject,
          sentAt: new Date().toISOString()
        }
      };

    } catch (error) {
      throw new Error(`Email send failed: ${error.message}`);
    }
  }

  /**
   * 4. Post to Cream API
   * POST https://knoblycream.com/api/posts.php
   */
  async createPost(postData) {
    try {
      const {
        content,
        visibility = 'public',
        mediaFiles = []
      } = postData;

      // Validate required fields
      if (!content) {
        throw new Error('Post content is required');
      }

      if (!['public', 'private'].includes(visibility)) {
        throw new Error('Visibility must be either "public" or "private"');
      }

      // Some deployments require API key as query param even with Bearer headers.
      // Include accesskey when an API key is configured, while still sending Authorization.
      const includeKey = !!this.config.config.creamApiKey;
      const url = this.config.buildCreamUrl('posts.php', includeKey);
      
      // Create FormData for multipart/form-data submission
      const formData = new FormData();
      formData.append('content', content);
      formData.append('visibility', visibility);

      // Add media files if provided
      if (mediaFiles && mediaFiles.length > 0) {
        for (let i = 0; i < mediaFiles.length; i++) {
          const file = mediaFiles[i];
          // If file is a buffer/stream, append directly
          // If file is a path, would need to read it first
          formData.append(`media[]`, file.data || file, file.filename || `media_${i}`);
        }
      }

      const headers = this.config.getCreamMultipartHeaders();
      
      let response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      if (!response.ok) {
        // If unauthorized, retry with accesskey in URL (fallback)
        if (response.status === 401 && !includeKey && this.config.config.creamApiKey) {
          const retryUrl = this.config.buildCreamUrl('posts.php', true);
          response = await fetch(retryUrl, { method: 'POST', headers, body: formData });
        }
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Posts API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }
      }

      const result = await response.json();
      
      return {
        success: true,
        post: result,
        createdAt: new Date().toISOString(),
        visibility: visibility,
        mediaCount: mediaFiles.length
      };

    } catch (error) {
      throw new Error(`Post creation failed: ${error.message}`);
    }
  }

  /**
   * Helper method to get API status
   */
  async getAPIStatus() {
    const status = {
      hasApiKey: !!(this.config.config.creamApiKey || this.config.config.creamToken),
      hasToken: !!this.config.config.creamToken,
      baseUrl: this.config.config.creamBaseUrl,
      endpoints: {
        rss: 'articles.php',
        stream: 'stream.php', 
        mailer: 'mail.php',
        posts: 'posts.php'
      }
    };

    // Test basic connectivity
    try {
      await this.getRecentPosts(1);
      status.connectivity = 'ok';
    } catch (error) {
      status.connectivity = 'failed';
      status.error = error.message;
    }

    return status;
  }
}

module.exports = { CreamAPI };
