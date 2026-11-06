const { app, BrowserWindow, ipcMain, desktopCapturer, session, screen, globalShortcut } = require('electron');
const path = require('path');

process.on('uncaughtException', (err) => {
  console.error('ClueAI uncaught exception:', err);
});
let autoUpdater = null;
try {
  const updaterModule = require('electron-updater');
  autoUpdater = updaterModule.autoUpdater;
  // USER-CONTROLLED: Never auto-download or auto-install without consent
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.disableDifferentialDownload = true;
} catch (e) {
  console.warn('electron-updater failed to load:', e.message);
}
let audio = null;
try {
  if (process.platform === 'win32') {
    audio = require('win-audio');
  }
} catch (e) {
  console.warn('win-audio module not available or platform not win32:', e.message);
}

let mainWindow;
let isStealthMode = true;
let isCustomMaximized = false;
let preMaximizeBounds = { width: 1000, height: 600, x: 0, y: 0 };

function applyStealthProtection(win, enabled) {
  if (!win || win.isDestroyed()) return;
  try {
    win.setContentProtection(Boolean(enabled));
  } catch (err) {
    console.warn('setContentProtection non-fatal notice:', err.message);
  }
}

if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    center: true,
    show: false,
    transparent: true,
    frame: false,
    hasShadow: true,
    minWidth: 100,
    minHeight: 100,
    thickFrame: false,
    roundedCorners: true,
    resizable: false,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    focusable: true,
    skipTaskbar: true,
    type: 'toolbar',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      applyStealthProtection(mainWindow, isStealthMode);
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      applyStealthProtection(mainWindow, isStealthMode);
    }
  });

  // Fast safety fallback: show immediately if ready-to-show delays
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      applyStealthProtection(mainWindow, isStealthMode);
    }
  }, 200);

  // Force the window to the absolute highest z-level, above all fullscreen apps
  // 'screen-saver' is the highest level on Windows, bypasses exclusive fullscreen apps
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setIgnoreMouseEvents(false);

  mainWindow.on('minimize', () => {
    unregisterAllHotkeys();
  });

  mainWindow.on('restore', () => {
    if (mainWindow) {
      applyStealthProtection(mainWindow, isStealthMode);
      mainWindow.setIgnoreMouseEvents(false);
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      mainWindow.webContents.send('window-shown');
    }
    if (hotkeysActive) {
      registerAllHotkeys();
    }
  });

  mainWindow.on('hide', () => {
    unregisterAllHotkeys();
  });

  mainWindow.on('show', () => {
    if (mainWindow) {
      applyStealthProtection(mainWindow, isStealthMode);
      mainWindow.setIgnoreMouseEvents(false);
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      mainWindow.webContents.send('window-shown');
    }
    if (hotkeysActive) {
      registerAllHotkeys();
    }
  });

  // --- AUDIO API IPC HANDLERS ---
  if (audio && audio.mic) {
    try {
      audio.mic.start(250);
      audio.mic.on('change', (val) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const vol = (typeof val === 'object' && val !== null && 'new' in val) ? val.new : val;
          mainWindow.webContents.send('mic-state-changed', {
            volume: typeof vol === 'number' ? vol : audio.mic.get(),
            muted: audio.mic.isMuted()
          });
        }
      });
      audio.mic.on('toggle', (val) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const isM = (typeof val === 'object' && val !== null && 'new' in val) ? val.new : val;
          mainWindow.webContents.send('mic-state-changed', {
            volume: audio.mic.get(),
            muted: Boolean(isM)
          });
        }
      });
    } catch (err) {
      console.warn('Failed to start audio.mic listener:', err.message);
    }
  }

  ipcMain.handle('get-mic-state', () => {
    try {
      if (audio && audio.mic) {
        return { volume: audio.mic.get(), muted: audio.mic.isMuted() };
      }
      return { volume: 100, muted: false };
    } catch (e) {
      return { volume: 100, muted: false };
    }
  });

  ipcMain.handle('set-mic-volume', (event, volume) => {
    try {
      if (audio && audio.mic) {
        audio.mic.set(volume);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mic-state-changed', {
            volume: audio.mic.get(),
            muted: audio.mic.isMuted()
          });
        }
        return { volume: audio.mic.get(), muted: audio.mic.isMuted() };
      }
    } catch (e) { }
    return { volume: 100, muted: false };
  });

  ipcMain.handle('toggle-mic-mute', (event, muteState) => {
    try {
      if (audio && audio.mic) {
        if (muteState !== undefined) {
          if (muteState) audio.mic.mute();
          else audio.mic.unmute();
        } else {
          audio.mic.toggle();
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mic-state-changed', {
            volume: audio.mic.get(),
            muted: audio.mic.isMuted()
          });
        }
        return { volume: audio.mic.get(), muted: audio.mic.isMuted() };
      }
    } catch (e) { }
    return { volume: 100, muted: false };
  });


  // Stealth Mode: Hide window from screen sharing software - always on by default
  applyStealthProtection(mainWindow, isStealthMode); // Hide from OBS, screen sharing, etc.

  ipcMain.handle('focus-window', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.setIgnoreMouseEvents(false);
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      mainWindow.focus();
    }
  });

  ipcMain.handle('set-stealth', (event, enable) => {
    isStealthMode = Boolean(enable);
    if (mainWindow && !mainWindow.isDestroyed()) {
      applyStealthProtection(mainWindow, isStealthMode);
      if (!isStealthMode) {
        mainWindow.setIgnoreMouseEvents(false);
      }
    }
  });

  ipcMain.handle('set-ignore-mouse-events', (event, ignore) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // If stealth mode is OFF or window is in fullscreen answer mode, NEVER ignore mouse events - window must be 100% clickable!
      if (!isStealthMode || isCustomMaximized) {
        mainWindow.setIgnoreMouseEvents(false);
        return;
      }
      if (ignore) {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
      } else {
        mainWindow.setIgnoreMouseEvents(false);
      }
    }
  });

  // Also support ipcRenderer.send (fire-and-forget variant)
  ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // If stealth mode is OFF or window is in fullscreen answer mode, NEVER ignore mouse events - window must be 100% clickable!
      if (!isStealthMode || isCustomMaximized) {
        mainWindow.setIgnoreMouseEvents(false);
        return;
      }
      if (ignore) {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
      } else {
        mainWindow.setIgnoreMouseEvents(false);
      }
    }
  });

  ipcMain.handle('set-focusable', (event, focusable) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setFocusable(focusable);
      if (focusable) {
        mainWindow.focus();
        mainWindow.webContents.focus();
      }
      // Always re-assert screen-saver level so we stay above fullscreen apps
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }
  });

  let hotkeysActive = false;
  const rawKeys = [
    'NUM0', 'NUM1', 'NUM2', 'NUM3', 'NUM4', 'NUM5', 'NUM6', 'NUM7', 'NUM8',
    'Alt+0', 'Alt+1', 'Alt+2', 'Alt+3', 'Alt+4', 'Alt+5', 'Alt+6', 'Alt+7', 'Alt+8',
    'Alt+Z', 'Alt+X', 'Alt+C', 'Alt+A', 'Alt+S', 'Alt+D', 'Alt+Q', 'Alt+H'
  ];
  const windowKeys = ['Alt+=', 'Alt+Plus', 'Alt+-', 'Alt+Up', 'Alt+Down', 'Alt+Left', 'Alt+Right', 'Alt+PageUp', 'Alt+PageDown'];

  const unregisterAllHotkeys = () => {
    [...rawKeys, ...windowKeys].forEach(k => {
      try { globalShortcut.unregister(k); } catch (e) { }
    });
  };

  const registerAllHotkeys = () => {
    const shortcuts = {
      'NUM0': 'toggle-color', 'Alt+0': 'toggle-color',
      'NUM1': 'toggle-pause', 'Alt+1': 'toggle-pause', 'Alt+Z': 'toggle-pause',
      'NUM2': 'force-ai', 'Alt+2': 'force-ai', 'Alt+X': 'force-ai',
      'NUM3': 'clear-all', 'Alt+3': 'clear-all', 'Alt+C': 'clear-all',
      'NUM4': 'snapshot', 'Alt+4': 'snapshot', 'Alt+A': 'snapshot',
      'NUM5': 'switch-model', 'Alt+5': 'switch-model', 'Alt+S': 'switch-model',
      'NUM6': 'stop-generation', 'Alt+6': 'stop-generation', 'Alt+D': 'stop-generation',
      'NUM7': 'edit-transcript', 'Alt+7': 'edit-transcript', 'Alt+Q': 'edit-transcript',
      'NUM8': 'toggle-history', 'Alt+8': 'toggle-history', 'Alt+H': 'toggle-history'
    };

    for (const [key, action] of Object.entries(shortcuts)) {
      try {
        globalShortcut.register(key, () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('trigger-hotkey', action);
          }
        });
      } catch (e) {
        console.error('Failed to register global shortcut:', key);
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
      } catch (e) {
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
    if (enable && mainWindow && !mainWindow.isMinimized() && mainWindow.isVisible()) {
      registerAllHotkeys();
    }
  });

  ipcMain.handle('is-cursor-inside-window', () => {
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return false;
    const cursor = screen.getCursorScreenPoint();
    const bounds = mainWindow.getBounds();
    return (
      cursor.x >= bounds.x &&
      cursor.x <= bounds.x + bounds.width &&
      cursor.y >= bounds.y &&
      cursor.y <= bounds.y + bounds.height
    );
  });

  ipcMain.on('app-quit', () => {
    app.quit();
  });

  ipcMain.on('toggle-fullscreen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (isCustomMaximized) {
        isCustomMaximized = false;
        mainWindow.setBounds(preMaximizeBounds);
        mainWindow.setResizable(false);
      } else {
        isCustomMaximized = true;
        mainWindow.setIgnoreMouseEvents(false);
        try { mainWindow.focus(); } catch (e) {}
        preMaximizeBounds = mainWindow.getBounds();
        const currentDisplay = screen.getDisplayNearestPoint(preMaximizeBounds);
        mainWindow.setResizable(true);
        mainWindow.setBounds(currentDisplay.bounds);
      }
    }
  });

  ipcMain.on('set-window-maximized', (event, maximize) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (maximize) {
        isCustomMaximized = true;
        mainWindow.setIgnoreMouseEvents(false);
        try { mainWindow.focus(); } catch (e) {}
        preMaximizeBounds = mainWindow.getBounds();
        const currentDisplay = screen.getDisplayNearestPoint(preMaximizeBounds);
        mainWindow.setResizable(true);
        mainWindow.setBounds(currentDisplay.bounds);
      } else {
        if (isCustomMaximized) {
          isCustomMaximized = false;
          mainWindow.setBounds(preMaximizeBounds);
          mainWindow.setResizable(false);
          mainWindow.center();
        }
      }
    }
  });

  let dragInterval = null;
  let dragOffset = { x: 0, y: 0 };
  let dragSize = { width: 0, height: 0 };

  ipcMain.on('start-drag', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const cursorPos = screen.getCursorScreenPoint();
    const bounds = mainWindow.getBounds();
    dragOffset = { x: cursorPos.x - bounds.x, y: cursorPos.y - bounds.y };
    dragSize = { width: bounds.width, height: bounds.height };

    if (dragInterval) clearInterval(dragInterval);
    const dragStartTime = Date.now();

    dragInterval = setInterval(() => {
      // Safety auto-abort after 12s if stop-drag was missed, or if window destroyed
      if (!mainWindow || mainWindow.isDestroyed() || Date.now() - dragStartTime > 12000) {
        if (dragInterval) clearInterval(dragInterval);
        dragInterval = null;
        return;
      }
      const currentCursor = screen.getCursorScreenPoint();
      mainWindow.setBounds({
        x: currentCursor.x - dragOffset.x,
        y: currentCursor.y - dragOffset.y,
        width: dragSize.width,
        height: dragSize.height
      });
    }, 16); // ~60fps cap
  });

  ipcMain.on('stop-drag', () => {
    if (dragInterval) {
      clearInterval(dragInterval);
      dragInterval = null;
    }
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

  // Handle get-desktop-sources IPC: thumbnailSize 0x0 eliminates multi-second screenshot freeze on laptops
  ipcMain.handle('get-desktop-sources', async () => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
      return sources.map(source => ({
        id: source.id,
        name: source.name,
        display_id: source.display_id,
      }));
    } catch (err) {
      console.warn('Error fetching desktop sources:', err);
      return [];
    }
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

  let preInterviewBounds = null;

  ipcMain.handle('start-interview-window', (event, layout) => {
    if (mainWindow) {
      // Save pre-interview dashboard bounds so stop-interview-window returns to exact size
      const currentB = mainWindow.getBounds();
      if (currentB && currentB.height > 350) {
        preInterviewBounds = currentB;
      }

      const { screen } = require('electron');
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width } = primaryDisplay.workAreaSize;

      const w = layout === 'horizontal' ? 1080 : 450;
      // Low profile compact dock height while listening/transcribing: 215px fits two-tier controls & live transcript perfectly!
      const h = 215;

      mainWindow.setBounds({
        width: w,
        height: h,
        x: Math.round((width - w) / 2),
        y: 0
      });

      // Re-assert the highest possible always-on-top level to punch through fullscreen apps
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
  });

  ipcMain.handle('set-ai-fullscreen-bounds', (event, isFullscreen, options = {}) => {
    if (mainWindow) {
      const { screen } = require('electron');
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      const w = Math.min(1150, width - 20);

      if (isFullscreen) {
        // Expand window downwards to display the full view / snapshot preview / AI answer
        const h = Math.min(860, height - 20);
        mainWindow.setBounds({
          width: w,
          height: h,
          x: Math.round((width - w) / 2),
          y: 0
        });
      } else {
        // Shrink back to low-profile transcription dock at the top
        // Dynamically accommodate snapshots and expanded transcript comfortably without clipping
        let h = 215;
        if (options && options.hasSnapshots) {
          h += 68; // 283px total: guarantees all 4 corners, borders, and shadows of snapshot cards are 100% visible
        }
        if (options && options.isTranscriptTall) {
          h += 45; // extra room for multiline transcript expansion
        }
        mainWindow.setBounds({
          width: w,
          height: Math.min(h, height - 20),
          x: Math.round((width - w) / 2),
          y: 0
        });
      }
    }
  });

  ipcMain.handle('stop-interview-window', (event) => {
    if (mainWindow) {
      const { screen } = require('electron');
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;

      // Restore exact dashboard window size (1000x600) so content fits neatly above taskbar
      if (preInterviewBounds && preInterviewBounds.width > 300 && preInterviewBounds.height > 500) {
        mainWindow.setBounds(preInterviewBounds);
      } else {
        const w = 1000;
        const h = 600;
        mainWindow.setBounds({
          width: w,
          height: h,
          x: Math.round((width - w) / 2),
          y: Math.max(10, Math.round((height - h) / 2))
        });
      }
      preInterviewBounds = null;
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
    unregisterAllHotkeys();
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  // --- AUTO-UPDATER IPC HANDLERS ---
  ipcMain.handle('check-for-updates', async () => {
    if (!autoUpdater) return { error: 'Updater not available' };
    try {
      const res = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: res ? res.updateInfo : null };
    } catch (e) {
      console.warn('check-for-updates error:', e.message);
      return { error: e.message };
    }
  });

  ipcMain.handle('download-update', async () => {
    if (!autoUpdater) return { error: 'Updater not available' };
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (e) {
      console.warn('download-update error:', e.message);
      return { error: e.message };
    }
  });

  ipcMain.handle('quit-and-install-update', () => {
    if (autoUpdater) {
      try {
        const fs = require('fs');
        const tokenPath = path.join(app.getPath('userData'), '.in_app_update');
        fs.writeFileSync(tokenPath, Date.now().toString(), 'utf8');
      } catch (err) {
        console.warn('Failed to write .in_app_update token:', err.message);
      }
      try {
        if (snipWindow) { snipWindow.destroy(); snipWindow = null; }
        // Keep mainWindow alive so the user sees the 100% complete screen
        // instead of a blank desktop while the silent installer swaps binaries.
      } catch (e) { }
      try {
        // Run silently (/S) and force-run after installation (--force-run)
        autoUpdater.quitAndInstall(true, true);
      } catch (err) {
        console.error('quitAndInstall error:', err);
        app.relaunch();
        app.exit(0);
      }
    } else {
      app.relaunch();
      app.exit(0);
    }
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('restart-app', () => {
    app.relaunch();
    app.exit(0);
  });

  // --- STORAGE INFORMATION & CLEANUP HANDLERS ---
  function getDirectorySize(dirPath) {
    let size = 0;
    try {
      if (!fs.existsSync(dirPath)) return 0;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          if (entry.isDirectory()) {
            size += getDirectorySize(fullPath);
          } else if (entry.isFile()) {
            size += fs.statSync(fullPath).size;
          }
        } catch (e) { }
      }
    } catch (e) { }
    return size;
  }

  ipcMain.handle('get-storage-info', () => {
    try {
      const userDataPath = app.getPath('userData');
      const appInstallPath = path.dirname(app.getPath('exe'));

      // 1. Laptop Drive Storage via fs.statfsSync
      let totalGB = 0;
      let freeGB = 0;
      let usedGB = 0;
      let usedPercent = 0;

      if (fs.statfsSync) {
        const stats = fs.statfsSync(userDataPath);
        const totalBytes = stats.bsize * stats.blocks;
        const freeBytes = stats.bsize * stats.bfree;
        const usedBytes = totalBytes - freeBytes;
        totalGB = Number((totalBytes / (1024 ** 3)).toFixed(1));
        freeGB = Number((freeBytes / (1024 ** 3)).toFixed(1));
        usedGB = Number((usedBytes / (1024 ** 3)).toFixed(1));
        usedPercent = totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(1)) : 0;
      }

      // 2. ClueAI Software Installation & UserData Breakdown
      const userDataBytes = getDirectorySize(userDataPath);
      let appBytes = 0;
      if (app.isPackaged) {
        appBytes = getDirectorySize(appInstallPath);
      } else {
        appBytes = 820 * 1024 * 1024;
      }

      const softwareSizeMB = Math.round(appBytes / (1024 ** 2));
      const softwareStorageFormatted = softwareSizeMB >= 1024 ? (softwareSizeMB / 1024).toFixed(1) + ' GB' : softwareSizeMB + ' MB';

      const userDataSizeMB = Math.round(userDataBytes / (1024 ** 2));
      const userDataStorageFormatted = userDataSizeMB >= 1024 ? (userDataSizeMB / 1024).toFixed(1) + ' GB' : userDataSizeMB + ' MB';

      const totalClueBytes = userDataBytes + appBytes;
      const appSizeMB = Math.round(totalClueBytes / (1024 ** 2));
      let appStorageFormatted = appSizeMB >= 1024 ? (appSizeMB / 1024).toFixed(2) + ' GB' : appSizeMB + ' MB';

      const isFilling = usedPercent >= 90;
      const isFull = usedPercent >= 98 || (totalGB > 0 && freeGB < 0.8);

      return {
        appSizeMB,
        appStorageFormatted,
        softwareSizeMB,
        softwareStorageFormatted,
        userDataSizeMB,
        userDataStorageFormatted,
        totalStorageGB: totalGB,
        freeStorageGB: freeGB,
        usedStorageGB: usedGB,
        usedPercent,
        isFilling,
        isFull
      };
    } catch (err) {
      console.warn('get-storage-info error:', err.message);
      return {
        appSizeMB: 875,
        appStorageFormatted: '875 MB',
        softwareSizeMB: 830,
        softwareStorageFormatted: '830 MB',
        userDataSizeMB: 45,
        userDataStorageFormatted: '45 MB',
        totalStorageGB: 500,
        freeStorageGB: 150,
        usedStorageGB: 350,
        usedPercent: 70,
        isFilling: false,
        isFull: false
      };
    }
  });

  ipcMain.handle('clear-clueai-cache', () => {
    try {
      const userDataPath = app.getPath('userData');
      const cacheFolders = ['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'blob_storage'];
      for (const folder of cacheFolders) {
        const p = path.join(userDataPath, folder);
        try {
          if (fs.existsSync(p)) {
            fs.rmSync(p, { recursive: true, force: true });
          }
        } catch (e) { }
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('delete-user-data', async () => {
    try {
      const userDataPath = app.getPath('userData');

      // Clear session web storage (IndexedDB, LocalStorage, Cookies, etc.)
      try {
        const ses = session.defaultSession;
        if (ses && ses.clearStorageData) {
          await ses.clearStorageData({
            storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
          });
        }
      } catch (e) { }

      const targetFolders = [
        'Cache',
        'Code Cache',
        'GPUCache',
        'DawnGraphiteCache',
        'DawnWebGPUCache',
        'blob_storage',
        'Local Storage',
        'IndexedDB',
        'Session Storage',
        'logs',
        'Crashpad'
      ];

      for (const folder of targetFolders) {
        const p = path.join(userDataPath, folder);
        try {
          if (fs.existsSync(p)) {
            fs.rmSync(p, { recursive: true, force: true });
          }
        } catch (e) { }
      }

      return { success: true };
    } catch (err) {
      console.warn('delete-user-data error:', err.message);
      return { success: false, error: err.message };
    }
  });

  let snipWindow = null;

  ipcMain.handle('start-snipping', async (event, sourceId) => {
    try {
      if (snipWindow) return; // Already snipping

      const { screen } = require('electron');
      const primaryDisplay = screen.getPrimaryDisplay();
      const scaleFactor = primaryDisplay.scaleFactor;
      const { x, y, width, height } = primaryDisplay.bounds;

      const physicalWidth = Math.round(width * scaleFactor);
      const physicalHeight = Math.round(height * scaleFactor);

      // STEP 1: Capture screen FIRST, while everything looks normal.
      // This avoids any OS-level window focus change before capture.
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: physicalWidth, height: physicalHeight },
        fetchWindowIcons: false
      });

      let targetSource = sources.find(s => s.id === sourceId) || sources[0];
      if (!targetSource) return null;

      const base64Image = targetSource.thumbnail.toDataURL();

      // STEP 2: NOW hide the main window — after capture is already done.
      if (mainWindow && !mainWindow.isMinimized()) {
        mainWindow.setOpacity(0);
      }

      snipWindow = new BrowserWindow({
        x: x,
        y: y,
        width: width,
        height: height,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        focusable: true,
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
      // Critical: snip window must also be content-protected
      applyStealthProtection(snipWindow, isStealthMode);
      snipWindow.loadFile(path.join(__dirname, 'snipping.html'));

      // Instant Escape cancellation hook at the window level
      snipWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'Escape') {
          event.preventDefault();
          if (snipWindow) { snipWindow.close(); snipWindow = null; }
          if (mainWindow) mainWindow.setOpacity(1);
        }
      });

      snipWindow.webContents.once('did-finish-load', () => {
        snipWindow.show();
        snipWindow.focus();
        snipWindow.webContents.send('snip-image', base64Image);
      });

      return new Promise((resolve) => {
        // Auto-abort after 15 seconds to prevent freezing
        const timeout = setTimeout(() => {
          if (snipWindow) { snipWindow.close(); snipWindow = null; }
          if (mainWindow) mainWindow.setOpacity(1);
          resolve(null);
        }, 15000);

        ipcMain.once('snip-complete', (e, b64) => {
          clearTimeout(timeout);
          if (snipWindow) { snipWindow.close(); snipWindow = null; }
          if (mainWindow) mainWindow.setOpacity(1);
          resolve(b64);
        });

        ipcMain.once('snip-cancel', () => {
          clearTimeout(timeout);
          if (snipWindow) { snipWindow.close(); snipWindow = null; }
          if (mainWindow) mainWindow.setOpacity(1);
          resolve(null);
        });

        snipWindow.on('closed', () => {
          clearTimeout(timeout);
          snipWindow = null;
          if (mainWindow) mainWindow.setOpacity(1);
          resolve(null);
        });
      });

    } catch (err) {
      console.error('Snipping error:', err);
      if (snipWindow) { snipWindow.close(); snipWindow = null; }
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
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load URL:', errorCode, errorDescription, validatedURL);
    if (app.isPackaged) {
      mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html')).catch(() => { });
    }
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }
}
function terminateOtherInstances() {
  try {
    const { execSync } = require('child_process');
    if (process.platform === 'win32') {
      const output = execSync('tasklist /FO CSV /NH', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = output.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        const match = line.match(/^"([^"]+)","(\d+)"/);
        if (match) {
          const procName = match[1].toLowerCase();
          const pid = parseInt(match[2], 10);
          if (procName.includes('clueai') && pid && pid !== process.pid) {
            try {
              execSync('taskkill /F /T /PID ' + pid, { stdio: 'ignore' });
            } catch (_) { }
          }
        }
      }
    } else if (process.platform === 'darwin') {
      try {
        const currentPid = process.pid;
        execSync(`pgrep -f "ClueAI" | grep -v "^${currentPid}$" | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' });
      } catch (_) { }
    }
  } catch (err) {
    console.warn('Process scan notice:', err.message);
  }
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.setIgnoreMouseEvents(false);
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      applyStealthProtection(mainWindow, isStealthMode);
      mainWindow.webContents.send('window-shown');
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    if (autoUpdater) {
      autoUpdater.on('checking-for-update', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('updater-status', { status: 'checking' });
        }
      });

      autoUpdater.on('update-available', (info) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('updater-status', {
            status: 'available',
            version: info.version,
            releaseDate: info.releaseDate,
            releaseNotes: info.releaseNotes,
          });
        }
      });

      autoUpdater.on('update-not-available', (info) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('updater-status', {
            status: 'not-available',
            version: info.version,
          });
        }
      });

      autoUpdater.on('download-progress', (progressObj) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('updater-status', {
            status: 'downloading',
            percent: Math.round(progressObj.percent || 0),
            bytesPerSecond: progressObj.bytesPerSecond || 0,
            transferred: progressObj.transferred || 0,
            total: progressObj.total || 0,
          });
        }
      });

      autoUpdater.on('update-downloaded', (info) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('updater-status', {
            status: 'downloaded',
            version: info.version,
            releaseNotes: info.releaseNotes,
          });
        }
      });

      autoUpdater.on('before-quit-for-update', () => {
        try {
          const fs = require('fs');
          const tokenPath = path.join(app.getPath('userData'), '.in_app_update');
          fs.writeFileSync(tokenPath, Date.now().toString(), 'utf8');
        } catch (err) {
          console.warn('Failed to write .in_app_update token in before-quit-for-update:', err.message);
        }
        setTimeout(() => {
          app.exit(0);
        }, 300);
      });

      autoUpdater.on('error', (err) => {
        console.warn('Updater background notice:', err ? err.message : err);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('updater-status', {
            status: 'error',
            message: err ? err.message : 'Update check failed',
          });
        }
      });

      // Fast startup check after 1.5 seconds
      setTimeout(() => {
        try {
          autoUpdater.checkForUpdates().catch(e => console.warn('Quiet update check notice:', e.message));
        } catch (e) { }
      }, 1500);
    }

    globalShortcut.register('CommandOrControl+Shift+K', () => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (!mainWindow.isVisible() || mainWindow.isMinimized()) {
            try {
              if (mainWindow.isMinimized()) mainWindow.restore();
            } catch (e) { }
            mainWindow.show();
            try { mainWindow.setIgnoreMouseEvents(false); } catch (e) { }
            try { mainWindow.setAlwaysOnTop(true, 'screen-saver', 1); } catch (e) { }
            applyStealthProtection(mainWindow, isStealthMode);
            try { mainWindow.focus(); } catch (e) { }
            try { mainWindow.webContents.send('window-shown'); } catch (e) { }
            if (hotkeysActive) {
              registerAllHotkeys();
            }
          } else {
            mainWindow.hide();
          }
        }
      } catch (err) {
        console.warn('CommandOrControl+Shift+K handler non-fatal notice:', err.message);
      }
    });

    globalShortcut.register('CommandOrControl+Shift+R', () => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.destroy();
        }
      } catch (e) { }
      app.relaunch();
      app.exit(0);
    });
  });

  app.on('will-quit', () => {
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
