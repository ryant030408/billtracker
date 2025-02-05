// dataService.js
const { ipcRenderer } = require('electron');
const Bill = require('./bill');

let bills = []; // Holds our Bill instances

async function loadData() {
  let data = await ipcRenderer.invoke('get-data');
  if (!data || !data.bills) {
    data = { bills: [] };
  }
  // Wrap each raw bill object in a Bill instance
  bills = data.bills.map(b => new Bill(b));
  return bills;
}

async function saveData() {
  const data = { bills: bills.map(bill => ({ ...bill })) };
  await ipcRenderer.invoke('save-data', data);
}

function getBills() {
  return bills;
}

function setBills(newBills) {
  bills = newBills;
}

module.exports = {
  loadData,
  saveData,
  getBills,
  setBills
};