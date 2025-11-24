const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { fetchRandomImage, downloadImage, setSource, getSource, getAllSources } = require('./imageFetcher');
const { setWallpaper, getWallpaperStoragePath } = require('./wallpaperSetter');

// Set the app name for the menu bar
app.setName('Fine Art Wallpaper');

let mainWindow;
let currentImagePath = null;

const CURRENT_IMAGE_FILE = 'current-wallpaper.jpg';
const METADATA_FILE = 'metadata.json';
const SETTINGS_FILE = 'settings.json';

function loadSettings() {
  const storagePath = getWallpaperStoragePath();
  const settingsPath = path.join(storagePath, SETTINGS_FILE);

  try {
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (settings.source) {
        setSource(settings.source);
      }
      return settings;
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return {};
}

function saveSettings(settings) {
  const storagePath = getWallpaperStoragePath();
  const settingsPath = path.join(storagePath, SETTINGS_FILE);

  try {
    const existing = loadSettings();
    const merged = { ...existing, ...settings };
    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

function buildMenu() {
  const sources = getAllSources();
  const currentSource = getSource();

  const sourceSubmenu = sources.map(source => ({
    label: source.name,
    type: 'radio',
    checked: source.id === currentSource,
    click: () => {
      setSource(source.id);
      saveSettings({ source: source.id });
      buildMenu(); // Rebuild menu to update checkmarks
    }
  }));

  const template = [
    {
      label: app.name,
      submenu: [
        {
          label: 'About Fine Art Wallpaper',
          click: () => {
            app.setAboutPanelOptions({
              applicationName: 'Fine Art Wallpaper',
              applicationVersion: '1.0.0',
              version: '',
              copyright: '© 2025 George Zalepa',
              credits: 'Art sources:\n• Metropolitan Museum of Art\n• Art Institute of Chicago',
              iconPath: path.join(__dirname, 'icon.png')
            });
            app.showAboutPanel();
          }
        },
        {
          label: 'Open Source Licenses',
          click: () => {
            shell.openExternal('https://raw.githubusercontent.com/zalepa/fine_art_wallpaper/refs/heads/main/oss.txt');
          }
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Source',
      submenu: sourceSubmenu
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  // Load settings before creating window
  loadSettings();

  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 400,
    minHeight: 300,
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'darwin' ? true : false,
    transparent: process.platform !== 'linux',
    backgroundColor: '#000000',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Build application menu
  buildMenu();

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Load initial image after window is ready
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window loaded, calling loadInitialImage');
    loadInitialImage();
  });
}

/**
 * Loads the last saved image, or fetches a new one if none exists
 */
async function loadInitialImage() {
  const storagePath = getWallpaperStoragePath();
  const imagePath = path.join(storagePath, CURRENT_IMAGE_FILE);
  const metadataPath = path.join(storagePath, METADATA_FILE);

  // Check if we have a saved image
  if (fs.existsSync(imagePath)) {
    try {
      currentImagePath = imagePath;
      const imageBuffer = fs.readFileSync(imagePath);
      const base64 = imageBuffer.toString('base64');

      // Load metadata if available
      let metadata = { title: 'Saved Image', author: 'Unknown' };
      if (fs.existsSync(metadataPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        } catch (e) {
          // Ignore metadata parse errors
        }
      }

      mainWindow.webContents.send('image-loaded', {
        dataUrl: `data:image/jpeg;base64,${base64}`,
        title: metadata.title,
        author: metadata.author
      });
      return;
    } catch (error) {
      console.error('Failed to load saved image:', error);
      // Fall through to fetch new image
    }
  }

  // No saved image or failed to load - fetch a new one
  await loadNewImage();
}

async function loadNewImage(retryCount = 0) {
  const maxRetries = 3;

  try {
    mainWindow.webContents.send('loading', true);

    const imageInfo = await fetchRandomImage();
    const imageBuffer = await downloadImage(imageInfo.url);

    // Save to persistent storage
    const storagePath = getWallpaperStoragePath();
    currentImagePath = path.join(storagePath, CURRENT_IMAGE_FILE);

    fs.writeFileSync(currentImagePath, imageBuffer);

    // Save metadata
    const metadataPath = path.join(storagePath, METADATA_FILE);
    fs.writeFileSync(metadataPath, JSON.stringify({
      title: imageInfo.title,
      author: imageInfo.author
    }));

    // Send image to renderer as base64
    const base64 = imageBuffer.toString('base64');

    mainWindow.webContents.send('image-loaded', {
      dataUrl: `data:image/jpeg;base64,${base64}`,
      title: imageInfo.title,
      author: imageInfo.author
    });

    mainWindow.webContents.send('loading', false);
  } catch (error) {
    console.error('Failed to load image:', error);

    // Retry on failure with exponential backoff
    if (retryCount < maxRetries) {
      const delay = (retryCount + 1) * 2000;
      console.log(`Retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return loadNewImage(retryCount + 1);
    }

    mainWindow.webContents.send('error', error.message);
    mainWindow.webContents.send('loading', false);
  }
}

async function setCurrentAsWallpaper() {
  if (!currentImagePath) {
    mainWindow.webContents.send('error', 'No image loaded');
    return;
  }

  try {
    mainWindow.webContents.send('setting-wallpaper', true);

    // Copy to a unique filename so macOS recognizes it as a new file
    // (macOS caches wallpapers by filename)
    const storagePath = getWallpaperStoragePath();
    const uniquePath = path.join(storagePath, `wallpaper-${Date.now()}.jpg`);
    fs.copyFileSync(currentImagePath, uniquePath);

    // Clean up old wallpaper files (keep only the 5 most recent)
    cleanupOldWallpapers(storagePath);

    await setWallpaper(uniquePath);
    mainWindow.webContents.send('wallpaper-set', true);
    mainWindow.webContents.send('setting-wallpaper', false);
  } catch (error) {
    console.error('Failed to set wallpaper:', error);
    mainWindow.webContents.send('error', error.message);
    mainWindow.webContents.send('setting-wallpaper', false);
  }
}

function cleanupOldWallpapers(storagePath) {
  try {
    const files = fs.readdirSync(storagePath)
      .filter(f => f.startsWith('wallpaper-') && f.endsWith('.jpg'))
      .map(f => ({ name: f, path: path.join(storagePath, f), mtime: fs.statSync(path.join(storagePath, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);

    // Keep only the 5 most recent
    files.slice(5).forEach(f => {
      try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
    });
  } catch (e) {
    // Ignore cleanup errors
  }
}

// IPC handlers
ipcMain.handle('refresh-image', async () => {
  await loadNewImage();
});

ipcMain.handle('set-wallpaper', async () => {
  await setCurrentAsWallpaper();
});

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
