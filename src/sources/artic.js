/**
 * Art Institute of Chicago Image Fetcher
 * API docs: https://api.artic.edu/docs
 *
 * Note: Uses /artworks endpoint instead of /artworks/search to avoid 403 errors
 */

const https = require('https');

const API_BASE = 'https://api.artic.edu/api/v1';
const IIIF_BASE = 'https://www.artic.edu/iiif/2';
const IMAGE_WIDTH = 1686;

/**
 * Fetches a random painting from the Art Institute of Chicago
 */
async function fetchRandomImage() {
  // Use the regular artworks endpoint with a random page
  // Filter for paintings (artwork_type_title) client-side
  const maxPage = 100; // Stay within safe pagination limits
  const randomPage = Math.floor(Math.random() * maxPage) + 1;

  const artworksUrl = `${API_BASE}/artworks?page=${randomPage}&limit=100&fields=id,title,artist_title,image_id,is_public_domain,artwork_type_title`;
  const artworksResult = await fetchJson(artworksUrl);

  if (!artworksResult.data || artworksResult.data.length === 0) {
    throw new Error('No artworks found');
  }

  // Filter to public domain PAINTINGS with images
  const validArtworks = artworksResult.data.filter(
    artwork => artwork.image_id &&
               artwork.is_public_domain &&
               artwork.artwork_type_title === 'Painting'
  );

  if (validArtworks.length === 0) {
    // No paintings on this page, try another
    console.log('No paintings on this page, trying another...');
    return fetchRandomImage();
  }

  // Shuffle and try each
  const shuffled = validArtworks.sort(() => Math.random() - 0.5);

  for (const artwork of shuffled) {
    const imageUrl = `${IIIF_BASE}/${artwork.image_id}/full/${IMAGE_WIDTH},/0/default.jpg`;

    try {
      await testImageUrl(imageUrl);
      return {
        url: imageUrl,
        title: artwork.title || 'Untitled',
        author: artwork.artist_title || 'Unknown Artist'
      };
    } catch (e) {
      console.log(`Image unavailable for "${artwork.title}", trying another...`);
      continue;
    }
  }

  // All images on this page failed, try a different page
  return fetchRandomImage();
}

function testImageUrl(url) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { method: 'HEAD', headers: { 'User-Agent': 'FineArtWallpaper/1.0' } }, (response) => {
      if (response.statusCode === 200) {
        resolve();
      } else {
        reject(new Error(`Image not accessible: ${response.statusCode}`));
      }
    });
    request.on('error', reject);
    request.end();
  });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'FineArtWallpaper/1.0',
        'AIC-User-Agent': 'FineArtWallpaper/1.0'
      }
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
  name: 'Art Institute of Chicago',
  id: 'artic',
  fetchRandomImage,
  downloadImage
};
