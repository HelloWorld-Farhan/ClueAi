const { app, BrowserWindow, ipcMain, desktopCapturer, session, screen, globalShortcut } = require('electron');
const path = require('path');
const audio = require('win-audio');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    center: true,
    transparent: true,
    frame: false,
    hasShadow: false,
    minWidth: 100,
    minHeight: 100,
    thickFrame: false,
    roundedCorners: false,
    resizable: false,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    type: 'toolbar',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.on('minimize', () => {
    if (hotkeysActive) {
      unregisterAllHotkeys();
    }
  });

  mainWindow.on('restore', () => {
    if (hotkeysActive) {
      registerAllHotkeys();
    }
  });

  // --- AUDIO API IPC HANDLERS ---
  ipcMain.handle('get-mic-state', () => {
    try {
      return { volume: audio.mic.get(), muted: audio.mic.isMuted() };
    } catch (e) {
      return { volume: 100, muted: false };
    }
  });

  ipcMain.handle('set-mic-volume', (event, volume) => {
    try {
      audio.mic.set(volume);
    } catch (e) {}
  });

  ipcMain.handle('toggle-mic-mute', (event, muteState) => {
    try {
      if (muteState !== undefined) {
         if (muteState) audio.mic.mute();
         else audio.mic.unmute();
      } else {
         audio.mic.toggle();
      }
    } catch (e) {}
  });


  // Stealth Mode: Hide window from screen sharing software
  let isStealthMode = true;
  mainWindow.setContentProtection(true);

  ipcMain.handle('focus-window', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  ipcMain.handle('set-stealth', (event, enable) => {
    isStealthMode = enable;
    if (mainWindow) {
      mainWindow.setContentProtection(enable);
    }
  });

  ipcMain.handle('set-focusable', (event, focusable) => {
    if (mainWindow) {
      mainWindow.setFocusable(focusable);
    }
  });

  let hotkeysActive = false;
  const rawKeys = ['0', 'NUM0', '1', 'Z', 'NUM1', '2', 'X', 'NUM2', '3', 'C', 'NUM3', '4', 'A', 'NUM4', '5', 'S', 'NUM5', '6', 'D', 'NUM6', '7', 'Q', 'NUM7'];
  const windowKeys = ['=', 'Plus', '-', 'Up', 'Down', 'Left', 'Right', 'PageUp', 'PageDown'];

  const unregisterAllHotkeys = () => {
    [...rawKeys, ...windowKeys].forEach(k => {
      try { globalShortcut.unregister(k); } catch(e){}
    });
  };

  const registerAllHotkeys = () => {
    const shortcuts = {
      '0': 'toggle-color', 'NUM0': 'toggle-color',
      '1': 'toggle-pause', 'z': 'toggle-pause', 'NUM1': 'toggle-pause',
      '2': 'force-ai', 'x': 'force-ai', 'NUM2': 'force-ai',
      '3': 'clear-all', 'c': 'clear-all', 'NUM3': 'clear-all',
      '4': 'snapshot', 'a': 'snapshot', 'NUM4': 'snapshot',
      '5': 'switch-model', 's': 'switch-model', 'NUM5': 'switch-model',
      '6': 'stop-generation', 'd': 'stop-generation', 'NUM6': 'stop-generation',
      '7': 'edit-transcript', 'q': 'edit-transcript', 'NUM7': 'edit-transcript'
    };
    
    for (const [key, action] of Object.entries(shortcuts)) {
      const bindKey = key.toUpperCase();
      try {
        globalShortcut.register(bindKey, () => {
          if (mainWindow) mainWindow.webContents.send('trigger-hotkey', action);
        });
      } catch(e) {
        console.error('Failed to register global shortcut:', bindKey);
      }
    }

    const moveWindow = (dx, dy) => {
      if (mainWindow) {
        const [currX, currY] = mainWindow.getPosition();
        mainWindow.setPosition(currX + dx, currY + dy);
      }
    };
    
    const resizeWindow = (dw, dh) => {
      if (mainWindow) {
        const bounds = mainWindow.getBounds();
        let newW = bounds.width + dw;
        let newH = bounds.height + dh;
        
        // Horizontal layout is roughly w: 1000, h: 300
        // Vertical layout is roughly w: 400, h: 700
        // We'll enforce a generic safe minimum here based on aspect ratio approximation
        if (newW < 380 || newH < 300) {
          mainWindow.webContents.send('show-size-warning');
          return;
        }

        if (newW < 200) newW = 200;
        if (newH < 200) newH = 200;
        mainWindow.setBounds({ width: newW, height: newH });
      }
    };

    const windowActions = {
      'Alt+=': () => resizeWindow(50, 50),
      'Alt+Plus': () => resizeWindow(50, 50),
      'Alt+numadd': () => resizeWindow(50, 50),
      'Alt+]': () => resizeWindow(50, 50),
      'Alt+-': () => resizeWindow(-50, -50),
      'Alt+_': () => resizeWindow(-50, -50),
      'Alt+[': () => resizeWindow(-50, -50),
      'CommandOrControl+-': () => resizeWindow(-50, -50),
      'Alt+numsub': () => resizeWindow(-50, -50),
      'Shift+Alt+-': () => resizeWindow(-50, -50),
      'Alt+Subtract': () => resizeWindow(-50, -50),
      'Alt+Minus': () => resizeWindow(-50, -50),
      'CommandOrControl+Minus': () => resizeWindow(-50, -50),
      'CommandOrControl+Subtract': () => resizeWindow(-50, -50),
      'Alt+Up': () => moveWindow(0, -50),
      'Alt+Down': () => moveWindow(0, 50),
      'Alt+Left': () => moveWindow(-50, 0),
      'Alt+Right': () => moveWindow(50, 0),
      'Alt+PageUp': () => moveWindow(0, -50),
      'Alt+PageDown': () => moveWindow(0, 50)
    };

    for (const [key, action] of Object.entries(windowActions)) {
      try {
        globalShortcut.register(key, action);
      } catch(e) {
        // Silently ignore speculative minus bindings that Electron might reject on some OS versions
        if (!key.toLowerCase().includes('minus') && !key.toLowerCase().includes('subtract')) {
          console.error('Failed to register window shortcut:', key);
        }
      }
    }
  };

  ipcMain.handle('toggle-global-hotkeys', (event, enable) => {
    hotkeysActive = enable;
    unregisterAllHotkeys();
    if (enable && mainWindow && !mainWindow.isMinimized()) {
      registerAllHotkeys();
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

  ipcMain.on('resize-window', (event, { width, height }) => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      mainWindow.setBounds({
        x: bounds.x,
        y: bounds.y,
        width: Math.max(300, bounds.width + width),
        height: Math.max(200, bounds.height + height)
      });
    }
  });

  ipcMain.on('move-window-by', (event, { x, y }) => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      mainWindow.setBounds({
        x: bounds.x + x,
        y: bounds.y + y,
        width: bounds.width,
        height: bounds.height
      });
    }
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
        mainWindow.setSize(1000, 800); 
      } else {
        mainWindow.setSize(450, 800);
      }
    }
  });

  ipcMain.handle('start-interview-window', (event, layout) => {
    if (mainWindow) {
      const { screen } = require('electron');
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width } = primaryDisplay.workAreaSize;
      
      const w = layout === 'horizontal' ? 1000 : 450;
      const h = 800;

      mainWindow.setBounds({
        width: w,
        height: h,
        x: Math.round((width - w) / 2),
        y: 0
      });
    }
  });

  ipcMain.handle('stop-interview-window', (event) => {
    if (mainWindow) {
      const { screen } = require('electron');
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      const w = 1000;
      const h = 600;
      mainWindow.setBounds({
        width: w,
        height: h,
        x: Math.round((width - w) / 2),
        y: Math.round((height - h) / 2)
      });
    }
  });

  ipcMain.handle('set-window-size', (event, width, height) => {
    if (mainWindow) {
      mainWindow.setSize(width, height);
      mainWindow.center(); // Re-center after resetting size

    }
  });

  ipcMain.handle('resize-window', (event, dw, dh) => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      let newW = bounds.width + dw;
      let newH = bounds.height + dh;
      if (newW < 200) newW = 200;
      if (newH < 200) newH = 200;
      mainWindow.setBounds({ width: newW, height: newH });
    }
  });

  ipcMain.handle('minimize-window', () => {
    if (mainWindow) {
      mainWindow.hide();
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
      
      // Delay restoring visibility until snip is finished
      
      // Find the specific source or just use the first screen
      let targetSource = sources.find(s => s.id === sourceId) || sources[0];
      if (!targetSource) return null;
      
      const base64Image = targetSource.thumbnail.toDataURL();
      
      snipWindow = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        focusable: false,
        skipTaskbar: true,
        show: false,
        type: 'toolbar',
        enableLargerThanScreen: true,
        roundedCorners: false,
        hasShadow: false,
        thickFrame: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });
      
      snipWindow.setAlwaysOnTop(true, 'screen-saver');
      snipWindow.setContentProtection(isStealthMode);
      snipWindow.loadFile(path.join(__dirname, 'snipping.html'));
      
      snipWindow.webContents.once('did-finish-load', () => {
        snipWindow.showInactive();
        snipWindow.webContents.send('snip-image', base64Image);
      });
      
      const unregisterEsc = () => {
        try { globalShortcut.unregister('Escape'); } catch(e) {}
      };
      
      try {
        globalShortcut.register('Escape', () => {
          if (snipWindow) { snipWindow.close(); snipWindow = null; }
          unregisterEsc();
        });
      } catch(e) {}
      
      return new Promise((resolve) => {
        // Auto-abort after 15 seconds to prevent freezing if hidden behind exclusive fullscreen
        const timeout = setTimeout(() => {
          if (snipWindow) { snipWindow.close(); snipWindow = null; }
          unregisterEsc();
          if (mainWindow) mainWindow.setOpacity(1);
          resolve(null);
        }, 15000);

        ipcMain.once('snip-complete', (e, b64) => {
          clearTimeout(timeout);
          if (snipWindow) { snipWindow.close(); snipWindow = null; }
          unregisterEsc();
          if (mainWindow) mainWindow.setOpacity(1);
          resolve(b64);
        });
        
        ipcMain.once('snip-cancel', () => {
          if (snipWindow) { snipWindow.close(); snipWindow = null; }
          unregisterEsc();
          resolve(null);
        });
        
        snipWindow.on('closed', () => {
          snipWindow = null;
          unregisterEsc();
          if (mainWindow) mainWindow.setOpacity(1);
          resolve(null);
        });
      });
      
    } catch (err) {
      console.error('Snipping error:', err);
      if (snipWindow) { snipWindow.close(); snipWindow = null; }
      try { globalShortcut.unregister('Escape'); } catch(e) {}
      if (mainWindow) mainWindow.setOpacity(1);
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
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
  
  const { globalShortcut } = require('electron');
  globalShortcut.register('CommandOrControl+Shift+K', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.showInactive();
      }
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
}
