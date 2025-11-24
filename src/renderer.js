const image = document.getElementById('wallpaper-image');
const refreshBtn = document.getElementById('refresh-btn');
const setBtn = document.getElementById('set-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const successIndicator = document.getElementById('success-indicator');
const legend = document.getElementById('legend');
const legendTitle = document.getElementById('legend-title');
const legendArtist = document.getElementById('legend-artist');

// Handle refresh button
refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  setBtn.disabled = true;
  await window.api.refreshImage();
});

// Handle set wallpaper button
setBtn.addEventListener('click', async () => {
  setBtn.disabled = true;
  await window.api.setWallpaper();
  setBtn.disabled = false;
});

// Listen for image loaded
window.api.onImageLoaded((data) => {
  image.src = data.dataUrl;
  image.onload = () => {
    image.classList.add('loaded');
    refreshBtn.disabled = false;
    setBtn.disabled = false;

    // Update legend
    legendTitle.textContent = data.title || 'Untitled';
    legendArtist.textContent = data.author || 'Unknown Artist';
    legend.classList.add('visible');
  };
});

// Listen for loading state
window.api.onLoading((isLoading) => {
  if (isLoading) {
    loadingOverlay.classList.add('visible');
    image.classList.remove('loaded');
    legend.classList.remove('visible');
  } else {
    loadingOverlay.classList.remove('visible');
  }
});

// Listen for wallpaper set success
window.api.onWallpaperSet((success) => {
  if (success) {
    successIndicator.classList.add('visible');
    setTimeout(() => {
      successIndicator.classList.remove('visible');
    }, 2000);
  }
});

// Listen for errors
window.api.onError((message) => {
  console.error('Error:', message);
  refreshBtn.disabled = false;
  setBtn.disabled = false;
});
