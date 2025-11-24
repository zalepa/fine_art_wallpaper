/**
 * Image Fetcher Module - Multi-source support
 *
 * Delegates to the selected source (Met, ARTIC, etc.)
 */

const met = require('./sources/met');
const artic = require('./sources/artic');

const sources = {
  met,
  artic
};

let currentSourceId = 'met'; // Default source

function setSource(sourceId) {
  if (sources[sourceId]) {
    currentSourceId = sourceId;
    console.log(`Image source set to: ${sources[sourceId].name}`);
  } else {
    console.error(`Unknown source: ${sourceId}`);
  }
}

function getSource() {
  return currentSourceId;
}

function getSourceName() {
  return sources[currentSourceId].name;
}

function getAllSources() {
  return Object.values(sources).map(s => ({ id: s.id, name: s.name }));
}

async function fetchRandomImage() {
  return sources[currentSourceId].fetchRandomImage();
}

async function downloadImage(url) {
  return sources[currentSourceId].downloadImage(url);
}

module.exports = {
  setSource,
  getSource,
  getSourceName,
  getAllSources,
  fetchRandomImage,
  downloadImage
};
