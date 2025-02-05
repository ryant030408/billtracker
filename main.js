// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;
const dataFilePath = path.join(app.getPath('userData'), 'financeData.json');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

function readData() {
  if (!fs.existsSync(dataFilePath)) {
    return { bills: [], incomes: [] };
  }
  try {
    const raw = fs.readFileSync(dataFilePath, 'utf-8');
    const data = JSON.parse(raw);
    if (!data.bills) data.bills = [];
    if (!data.incomes) data.incomes = [];
    return data;
  } catch {
    return { bills: [], incomes: [] };
  }
}

function writeData(newData) {
  fs.writeFileSync(dataFilePath, JSON.stringify(newData, null, 2));
}

// IPC
ipcMain.handle('get-data', () => {
  return readData();
});
ipcMain.handle('save-data', (event, data) => {
  writeData(data);
  return true;
});

// Backup/Restore/Reset
ipcMain.handle('backup-data', async () => {
  const data = readData();
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Backup Data',
    defaultPath: 'financeData-backup.json'
  });
  if (!canceled && filePath) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  }
  return false;
});

ipcMain.handle('restore-data', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Restore Data',
    properties: ['openFile'],
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });
  if (!canceled && filePaths.length > 0) {
    try {
      const raw = fs.readFileSync(filePaths[0], 'utf-8');
      const data = JSON.parse(raw);
      writeData(data);
      return true;
    } catch {
      return false;
    }
  }
  return false;
});

ipcMain.handle('reset-data', () => {
  writeData({ bills: [], incomes: [] });
  return true;
});