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

ipcMain.handle('backup-data', async () => {
  const options = {
    title: 'Save Backup',
    defaultPath: 'bills-backup.json',
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  };
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, options);
  if (canceled || !filePath) {
    return false;
  }
  try {
    // Read the current data from the app's data file.
    let data = {};
    if (fs.existsSync(dataFilePath)) {
      const raw = fs.readFileSync(dataFilePath, 'utf-8');
      data = JSON.parse(raw);
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('Backup failed:', err);
    return false;
  }
});

ipcMain.handle('restore-data', async () => {
  const options = {
    title: 'Restore Backup',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile']
  };
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, options);
  if (canceled || !filePaths || filePaths.length === 0) {
    return false;
  }
  try {
    const restoreFilePath = filePaths[0];
    const raw = fs.readFileSync(restoreFilePath, 'utf-8');
    const data = JSON.parse(raw);
    // Save the restored data to the app's data file.
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('Restore failed:', err);
    return false;
  }
});

ipcMain.handle('reset-data', async () => {
  try {
    // Reset data to empty arrays for bills and paychecks.
    fs.writeFileSync(dataFilePath, JSON.stringify({ bills: [], paychecks: [] }, null, 2));
    return true;
  } catch (err) {
    console.error('Reset failed:', err);
    return false;
  }
});