const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  refreshImage: () => ipcRenderer.invoke('refresh-image'),
  setWallpaper: () => ipcRenderer.invoke('set-wallpaper'),

  onImageLoaded: (callback) => {
    ipcRenderer.on('image-loaded', (event, data) => callback(data));
  },

  onLoading: (callback) => {
    ipcRenderer.on('loading', (event, isLoading) => callback(isLoading));
  },

  onSettingWallpaper: (callback) => {
    ipcRenderer.on('setting-wallpaper', (event, isSetting) => callback(isSetting));
  },

  onWallpaperSet: (callback) => {
    ipcRenderer.on('wallpaper-set', (event, success) => callback(success));
  },

  onError: (callback) => {
    ipcRenderer.on('error', (event, message) => callback(message));
  }
});
