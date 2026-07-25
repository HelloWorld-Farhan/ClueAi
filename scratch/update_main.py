import os

filepath = 'electron/main.cjs'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

ipc_handler = '''  ipcMain.handle('set-ignore-mouse-events', (event, ignore) => {
    if (mainWindow) {
      if (ignore) {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
      } else {
        mainWindow.setIgnoreMouseEvents(false);
      }
    }
  });

'''

if "set-ignore-mouse-events" not in content:
    # Insert it right before set-focusable
    content = content.replace("  ipcMain.handle('set-focusable',", ipc_handler + "  ipcMain.handle('set-focusable',")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated main.cjs")
else:
    print("main.cjs already contains handler")
