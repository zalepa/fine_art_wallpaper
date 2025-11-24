/**
 * Metropolitan Museum of Art Image Fetcher
 * API docs: https://metmuseum.github.io
 */

const https = require('https');

const API_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

// Cache painting IDs to avoid repeated API calls
let cachedPaintingIds = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Fetches a random painting from the Metropolitan Museum of Art
 */
async function fetchRandomImage() {
  // Get list of painting IDs (cached)
  if (!cachedPaintingIds || Date.now() - cacheTimestamp > CACHE_DURATION) {
    const searchUrl = `${API_BASE}/search?hasImages=true&medium=Paintings&q=*`;
    const searchResult = await fetchJson(searchUrl);

    if (!searchResult.objectIDs || searchResult.objectIDs.length === 0) {
      throw new Error('No paintings found');
    }

    cachedPaintingIds = searchResult.objectIDs;
    cacheTimestamp = Date.now();
    console.log(`Cached ${cachedPaintingIds.length} painting IDs from Met Museum`);
  }

  // Try random paintings until we find one with an image
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const randomIndex = Math.floor(Math.random() * cachedPaintingIds.length);
    const objectId = cachedPaintingIds[randomIndex];

    try {
      const objectUrl = `${API_BASE}/objects/${objectId}`;
      const artwork = await fetchJson(objectUrl);

      if (artwork.primaryImage) {
        return {
          url: artwork.primaryImage,
          title: artwork.title || 'Untitled',
          author: artwork.artistDisplayName || 'Unknown Artist'
        };
      }

      console.log(`No image for "${artwork.title}", trying another...`);
    } catch (e) {
      console.log(`Failed to fetch object ${objectId}, trying another...`);
    }
  }

  throw new Error('Could not find a painting with an image after multiple attempts');
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: { 'User-Agent': 'FineArtWallpaper/1.0' }
    }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`API request failed: ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()));
        } catch (e) {
          reject(new Error('Failed to parse API response'));
        }
      });
      response.on('error', reject);
    });

    request.on('error', reject);
    request.end();
  });
}

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : require('http');

    const request = protocol.get(url, {
      headers: { 'User-Agent': 'FineArtWallpaper/1.0' }
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        resolve(downloadImage(response.headers.location));
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });

    request.on('error', reject);
    request.end();
  });
}

module.exports = {
  name: 'Metropolitan Museum of Art',
  id: 'met',
  fetchRandomImage,
  downloadImage
};
