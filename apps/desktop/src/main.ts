import { app, BrowserWindow } from 'electron'
import path from 'node:path'

function getWebEntry(): string {
  const configuredPath = process.env.NOTEBOOK_WEB_DIST
  if (configuredPath) {
    return path.join(path.resolve(configuredPath), 'index.html')
  }
  return path.resolve(__dirname, '..', '..', 'web', 'dist', 'index.html')
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#f6f7fb',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  const devUrl = process.env.NOTEBOOK_DESKTOP_DEV_URL
  if (devUrl) {
    void window.loadURL(devUrl)
  } else {
    void window.loadFile(getWebEntry())
  }
}

void app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
