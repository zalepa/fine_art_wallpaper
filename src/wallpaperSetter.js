/**
 * Cross-platform wallpaper setter
 * Uses native OS commands to set desktop wallpaper
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Sets the desktop wallpaper from an image file
 * @param {string} imagePath - Absolute path to the image file
 * @returns {Promise<void>}
 */
async function setWallpaper(imagePath) {
  const absolutePath = path.resolve(imagePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Image file not found: ${absolutePath}`);
  }

  const platform = process.platform;

  switch (platform) {
    case 'darwin':
      return setWallpaperMac(absolutePath);
    case 'win32':
      return setWallpaperWindows(absolutePath);
    case 'linux':
      return setWallpaperLinux(absolutePath);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Sets wallpaper on macOS using AppleScript
 */
function setWallpaperMac(imagePath) {
  return new Promise((resolve, reject) => {
    const script = `
      tell application "System Events"
        tell every desktop
          set picture to "${imagePath}"
        end tell
      end tell
    `;

    exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Failed to set wallpaper on macOS: ${stderr || error.message}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Sets wallpaper on Windows using PowerShell
 */
function setWallpaperWindows(imagePath) {
  return new Promise((resolve, reject) => {
    // Convert to Windows path format
    const winPath = imagePath.replace(/\//g, '\\');

    const script = `
      Add-Type -TypeDefinition @"
      using System;
      using System.Runtime.InteropServices;
      public class Wallpaper {
        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
      }
"@
      [Wallpaper]::SystemParametersInfo(0x0014, 0, "${winPath}", 0x0001 -bor 0x0002)
    `;

    exec(`powershell -Command "${script.replace(/"/g, '\\"')}"`, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Failed to set wallpaper on Windows: ${stderr || error.message}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Sets wallpaper on Linux (supports GNOME, KDE, XFCE, and others)
 */
function setWallpaperLinux(imagePath) {
  return new Promise((resolve, reject) => {
    const desktop = process.env.XDG_CURRENT_DESKTOP || '';
    const desktopLower = desktop.toLowerCase();

    let command;

    if (desktopLower.includes('gnome') || desktopLower.includes('unity') || desktopLower.includes('budgie')) {
      // GNOME and GNOME-based desktops
      command = `gsettings set org.gnome.desktop.background picture-uri "file://${imagePath}" && gsettings set org.gnome.desktop.background picture-uri-dark "file://${imagePath}"`;
    } else if (desktopLower.includes('kde') || desktopLower.includes('plasma')) {
      // KDE Plasma
      command = `qdbus org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell.evaluateScript '
        var allDesktops = desktops();
        for (var i = 0; i < allDesktops.length; i++) {
          var d = allDesktops[i];
          d.wallpaperPlugin = "org.kde.image";
          d.currentConfigGroup = Array("Wallpaper", "org.kde.image", "General");
          d.writeConfig("Image", "file://${imagePath}");
        }
      '`;
    } else if (desktopLower.includes('xfce')) {
      // XFCE
      command = `xfconf-query -c xfce4-desktop -p /backdrop/screen0/monitor0/workspace0/last-image -s "${imagePath}"`;
    } else if (desktopLower.includes('mate')) {
      // MATE
      command = `gsettings set org.mate.background picture-filename "${imagePath}"`;
    } else if (desktopLower.includes('cinnamon')) {
      // Cinnamon
      command = `gsettings set org.cinnamon.desktop.background picture-uri "file://${imagePath}"`;
    } else {
      // Fallback: try feh (common wallpaper setter)
      command = `feh --bg-fill "${imagePath}"`;
    }

    exec(command, (error, stdout, stderr) => {
      if (error) {
        // If the first attempt fails, try nitrogen as a fallback
        exec(`nitrogen --set-zoom-fill "${imagePath}"`, (error2) => {
          if (error2) {
            reject(new Error(`Failed to set wallpaper on Linux: ${stderr || error.message}`));
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  });
}

/**
 * Gets the path to store temporary wallpaper images
 */
function getWallpaperStoragePath() {
  const appDir = path.join(os.homedir(), '.fineartwallpaper');
  if (!fs.existsSync(appDir)) {
    fs.mkdirSync(appDir, { recursive: true });
  }
  return appDir;
}

module.exports = {
  setWallpaper,
  getWallpaperStoragePath
};
