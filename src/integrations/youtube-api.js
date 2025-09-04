/**
 * YouTube Data API Integration
 * Provides video search functionality
 */

"use strict";

const fetch = (...a) => import("node-fetch").then(({default:f}) => f(...a));
const { APIConfig } = require('./api-config');

class YouTubeAPI {
  constructor() {
    this.config = new APIConfig();
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
  }

  /**
   * Search for videos on YouTube
   */
  async searchVideos(query, options = {}) {
    try {
      const {
        maxResults = 1,
        type = 'video',
        order = 'relevance',
        publishedAfter,
        publishedBefore,
        channelId,
        regionCode,
        safeSearch = 'moderate'
      } = options;

      if (!query || query.trim() === '') {
        throw new Error('Search query is required');
      }

      const apiKey = this.config.getYouTubeApiKey();
      
      // Build search URL with parameters
      const searchParams = new URLSearchParams({
        part: 'snippet',
        q: query.trim(),
        type: type,
        key: apiKey,
        maxResults: Math.min(maxResults, 50), // YouTube API limit
        order: order,
        safeSearch: safeSearch
      });

      // Add optional parameters
      if (publishedAfter) searchParams.append('publishedAfter', publishedAfter);
      if (publishedBefore) searchParams.append('publishedBefore', publishedBefore);
      if (channelId) searchParams.append('channelId', channelId);
      if (regionCode) searchParams.append('regionCode', regionCode);

      const url = `${this.baseUrl}/search?${searchParams.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'c9ai-client/1.0'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`YouTube API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      // Process and format the results
      const processedResults = data.items?.map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnails: item.snippet.thumbnails,
        channelTitle: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        publishedAt: item.snippet.publishedAt,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        embedUrl: `https://www.youtube.com/embed/${item.id.videoId}`
      })) || [];

      return {
        success: true,
        query: query,
        totalResults: data.pageInfo?.totalResults || 0,
        resultsPerPage: data.pageInfo?.resultsPerPage || 0,
        videos: processedResults,
        searchedAt: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`YouTube search failed: ${error.message}`);
    }
  }

  /**
   * Get video details by ID
   */
  async getVideoDetails(videoId) {
    try {
      if (!videoId) {
        throw new Error('Video ID is required');
      }

      const apiKey = this.config.getYouTubeApiKey();
      
      const searchParams = new URLSearchParams({
        part: 'snippet,statistics,contentDetails',
        id: videoId,
        key: apiKey
      });

      const url = `${this.baseUrl}/videos?${searchParams.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'c9ai-client/1.0'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`YouTube API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        throw new Error('Video not found');
      }

      const video = data.items[0];
      
      return {
        success: true,
        video: {
          videoId: video.id,
          title: video.snippet.title,
          description: video.snippet.description,
          thumbnails: video.snippet.thumbnails,
          channelTitle: video.snippet.channelTitle,
          channelId: video.snippet.channelId,
          publishedAt: video.snippet.publishedAt,
          duration: video.contentDetails?.duration,
          viewCount: video.statistics?.viewCount,
          likeCount: video.statistics?.likeCount,
          commentCount: video.statistics?.commentCount,
          url: `https://www.youtube.com/watch?v=${video.id}`,
          embedUrl: `https://www.youtube.com/embed/${video.id}`
        },
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`YouTube video details fetch failed: ${error.message}`);
    }
  }

  /**
   * Search for trending videos
   */
  async getTrendingVideos(regionCode = 'US', maxResults = 10) {
    try {
      const apiKey = this.config.getYouTubeApiKey();
      
      const searchParams = new URLSearchParams({
        part: 'snippet,statistics',
        chart: 'mostPopular',
        regionCode: regionCode,
        maxResults: Math.min(maxResults, 50),
        key: apiKey
      });

      const url = `${this.baseUrl}/videos?${searchParams.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'c9ai-client/1.0'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`YouTube API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      const trendingVideos = data.items?.map(item => ({
        videoId: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnails: item.snippet.thumbnails,
        channelTitle: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        publishedAt: item.snippet.publishedAt,
        viewCount: item.statistics?.viewCount,
        likeCount: item.statistics?.likeCount,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        embedUrl: `https://www.youtube.com/embed/${item.id}`
      })) || [];

      return {
        success: true,
        region: regionCode,
        videos: trendingVideos,
        count: trendingVideos.length,
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`YouTube trending videos fetch failed: ${error.message}`);
    }
  }

  /**
   * Helper method to get API status
   */
  async getAPIStatus() {
    const status = {
      hasApiKey: !!this.config.config.youtubeApiKey,
      baseUrl: this.baseUrl,
      endpoints: {
        search: '/search',
        videos: '/videos'
      }
    };

    // Test basic connectivity with a simple search
    try {
      await this.searchVideos('test', { maxResults: 1 });
      status.connectivity = 'ok';
    } catch (error) {
      status.connectivity = 'failed';
      status.error = error.message;
    }

    return status;
  }
}

module.exports = { YouTubeAPI };