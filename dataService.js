// dataService.js
const { ipcRenderer } = require('electron');
const Bill = require('./bill');
const Paycheck = require('./paycheck');

let bills = [];      // Array of Bill instances
let paychecks = [];  // Array of Paycheck instances

async function loadData() {
  let data = await ipcRenderer.invoke('get-data');
  if (!data) {
    data = { bills: [], paychecks: [] };
  }
  if (!data.bills) data.bills = [];
  if (!data.paychecks) data.paychecks = [];
  
  bills = data.bills.map(b => new Bill(b));
  paychecks = data.paychecks.map(p => new Paycheck(p));
  return data;
}

async function saveData() {
  const data = { 
    bills: bills.map(bill => ({ ...bill })),
    paychecks: paychecks.map(pc => ({ ...pc }))
  };
  await ipcRenderer.invoke('save-data', data);
}

function getBills() {
  return bills;
}

function setBills(newBills) {
  bills = newBills;
}

function getPaychecks() {
  return paychecks;
}

function setPaychecks(newPaychecks) {
  paychecks = newPaychecks;
}

module.exports = {
  loadData,
  saveData,
  getBills,
  setBills,
  getPaychecks,
  setPaychecks
};