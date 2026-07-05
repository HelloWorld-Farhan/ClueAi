const { app, BrowserWindow, ipcMain, desktopCapturer, session, screen } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    center: true,
    transparent: true,
    frame: false,
    hasShadow: false,
    thickFrame: false,
    roundedCorners: false,
    resizable: false,
    backgroundColor: '#00000000',
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Stealth Mode: Hide window from screen sharing software
  let isStealthMode = true;
  mainWindow.setContentProtection(true);

  ipcMain.handle('set-stealth', (event, enable) => {
    isStealthMode = enable;
    if (mainWindow) {
      mainWindow.setContentProtection(enable);
    }
  });

  ipcMain.on('toggle-fullscreen', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      mainWindow.setSize(1000, 600);
      mainWindow.center();
    } else {
      mainWindow.maximize();
    }
  });

  let dragInterval;
  let dragOffset = { x: 0, y: 0 };
  let dragSize = { width: 0, height: 0 };

  ipcMain.on('start-drag', () => {
    if (!mainWindow) return;
    const cursorPos = screen.getCursorScreenPoint();
    const bounds = mainWindow.getBounds();
    dragOffset = { x: cursorPos.x - bounds.x, y: cursorPos.y - bounds.y };
    dragSize = { width: bounds.width, height: bounds.height };
    
    if (dragInterval) clearInterval(dragInterval);
    dragInterval = setInterval(() => {
      if (mainWindow) {
        const currentCursor = screen.getCursorScreenPoint();
        mainWindow.setBounds({
          x: currentCursor.x - dragOffset.x,
          y: currentCursor.y - dragOffset.y,
          width: dragSize.width,
          height: dragSize.height
        });
      }
    }, 10);
  });

  ipcMain.on('stop-drag', () => {
    if (dragInterval) clearInterval(dragInterval);
  });

  // Handle get-desktop-sources IPC
  ipcMain.handle('get-desktop-sources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      display_id: source.display_id,
    }));
  });

  const fs = require('fs');
  const pdfParse = require('pdf-parse');

  ipcMain.handle('parse-pdf', async (event, filePath) => {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (err) {
      console.error(err);
      return null;
    }
  });

  ipcMain.handle('parse-pdf-buffer', async (event, arrayBuffer) => {
    try {
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Handle different versions of pdf-parse exports (v1.x function vs v2.x class)
      if (typeof pdfParse === 'function') {
        const data = await pdfParse(Buffer.from(arrayBuffer));
        const isScanned = data.numpages > 2 && (data.text.trim().length / data.numpages) < 100;
        return { text: data.text, isScanned };
      } else if (pdfParse.default && typeof pdfParse.default === 'function') {
        const data = await pdfParse.default(Buffer.from(arrayBuffer));
        const isScanned = data.numpages > 2 && (data.text.trim().length / data.numpages) < 100;
        return { text: data.text, isScanned };
      } else if (pdfParse.PDFParse) {
        const parser = new pdfParse.PDFParse(uint8Array);
        await parser.load();
        const data = await parser.getText();
        return { text: data.text, isScanned: false }; // v2 doesn't easily expose numpages
      } else {
        throw new Error('Could not identify pdf-parse API.');
      }
    } catch (err) {
      console.error('PDF Parse Error:', err);
      return null;
    }
  });

  ipcMain.handle('set-opacity', (event, opacity) => {
    if (mainWindow) {
      mainWindow.setOpacity(opacity);
    }
  });

  ipcMain.handle('set-layout', (event, layout) => {
    if (mainWindow) {
      if (layout === 'horizontal') {
        mainWindow.setSize(1000, 600);
      } else {
        mainWindow.setSize(450, 850);
      }
    }
  });

  ipcMain.handle('minimize-window', () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  let snipWindow = null;

  ipcMain.handle('start-snipping', async (event, sourceId) => {
    try {
      if (snipWindow) return; // Already snipping
      
      const { screen } = require('electron');
      const primaryDisplay = screen.getPrimaryDisplay();
      const scaleFactor = primaryDisplay.scaleFactor;
      const { width, height } = primaryDisplay.size;
      
      const physicalWidth = width * scaleFactor;
      const physicalHeight = height * scaleFactor;
      
      if (mainWindow && !mainWindow.isMinimized()) {
        mainWindow.setOpacity(0); // Make invisible but keep focus
        await new Promise(r => setTimeout(r, 150)); // Wait for OS compositing
      }
      
      // Capture a static frame of the screen safely using physical resolution
      const sources = await desktopCapturer.getSources({ 
        types: ['screen'], 
        thumbnailSize: { width: physicalWidth, height: physicalHeight },
        fetchWindowIcons: false
      });
      
      if (mainWindow) {
        mainWindow.setOpacity(1); // Restore visibility
      }
      
      // Find the specific source or just use the first screen
      let targetSource = sources.find(s => s.id === sourceId) || sources[0];
      if (!targetSource) return null;
      
      const base64Image = targetSource.thumbnail.toDataURL();
      
      snipWindow = new BrowserWindow({
        width: width,
        height: height,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        enableLargerThanScreen: true,
        roundedCorners: false,
        hasShadow: false,
        thickFrame: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });
      
      snipWindow.setContentProtection(isStealthMode);
      snipWindow.setFullScreen(true);
      snipWindow.loadFile(path.join(__dirname, 'snipping.html'));
      
      snipWindow.webContents.once('did-finish-load', () => {
        snipWindow.webContents.send('snip-image', base64Image);
      });
      
      return new Promise((resolve) => {
        ipcMain.once('snip-complete', (e, croppedDataUrl) => {
          if (snipWindow) { snipWindow.close(); snipWindow = null; }
          resolve(croppedDataUrl);
        });
        
        ipcMain.once('snip-cancel', () => {
          if (snipWindow) { snipWindow.close(); snipWindow = null; }
          resolve(null);
        });
        
        snipWindow.on('closed', () => {
          snipWindow = null;
          resolve(null);
        });
      });
      
    } catch (err) {
      console.error('Snipping error:', err);
      if (snipWindow) { snipWindow.close(); snipWindow = null; }
      return null;
    }
  });

  // Automatically allow media access
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (permission === 'media') {
      return true;
    }
    return false;
  });

  // In production, load the built index.html. In dev, load Vite's dev server.
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }
}

app.whenReady().then(() => {
  createWindow();
  
  const { globalShortcut } = require('electron');
  globalShortcut.register('CommandOrControl+Shift+K', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('will-quit', () => {
  const { globalShortcut } = require('electron');
  globalShortcut.unregisterAll();
});

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
