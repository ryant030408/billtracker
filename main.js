const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;
const dataFilePath = path.join(app.getPath('userData'), 'bills.json');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

// minimal get-data, save-data
ipcMain.handle('get-data', () => {
  if (!fs.existsSync(dataFilePath)) return { bills: [] };
  try {
    const raw = fs.readFileSync(dataFilePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { bills: [] };
  }
});
ipcMain.handle('save-data', (event, data) => {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
  return true;
});

// add backup-data, restore-data, reset-data as needed