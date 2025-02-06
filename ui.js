// ui.js
const { ipcRenderer } = require('electron');
const Bill = require('./bill');
const Paycheck = require('./paycheck');
const dataService = require('./dataService');

// Global state
let currentMonth = new Date();
let currentPayBillIndex = null;

// Update the month display header
function updateMonthDisplay() {
  const options = { year: 'numeric', month: 'long' };
  document.getElementById('current-month').textContent =
    currentMonth.toLocaleDateString('en-US', options);
}

// --------------------
// BILL FUNCTIONS
// --------------------

async function loadBills() {
  await dataService.loadData();
  const bills = dataService.getBills();
  const billList = document.getElementById('bill-list');
  billList.innerHTML = '';

  const summary = document.getElementById('bill-summary');
  let totalDue = 0, totalPaid = 0;
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  if (!bills.length) {
    summary.innerHTML = `
      <p>
        <strong>This Month’s Bills:</strong><br/>
        Paid: $0.00 | Remaining: $0.00
      </p>`;
    const noBills = document.createElement('div');
    noBills.className = 'p-3 bg-gray-700 rounded';
    noBills.textContent = 'No bills yet. Add one under Manage Bills.';
    billList.appendChild(noBills);
  } else {
    bills.forEach((bill, index) => {
      const monthlyDue = bill.getMonthlyDue();
      const paidThisMonth = bill.getPaidThisMonth(year, month);
      totalDue += monthlyDue;
      totalPaid += paidThisMonth;

      const leftover = Math.max(monthlyDue - paidThisMonth, 0);
      const isPaid = leftover <= 0 && monthlyDue > 0;
      const dueDateStr = bill.getFormattedDueDate();

      const item = document.createElement('div');
      item.className = 'p-3 bg-gray-700 border border-gray-600 rounded flex justify-between items-center';

      item.innerHTML = `
        <div>
          <div class="font-semibold">${bill.name}</div>
          <div class="text-sm">
            Due: ${dueDateStr} <br/>
            Monthly Due: $${monthlyDue.toFixed(2)} <br/>
            Paid So Far: $${paidThisMonth.toFixed(2)} <br/>
            Leftover: $${leftover.toFixed(2)} <br/>
            Status: <span class="${isPaid ? 'text-green-400' : 'text-red-400'}">
              ${isPaid ? 'Paid' : 'Unpaid'}
            </span>
          </div>
        </div>
      `;
      if (!isPaid && leftover > 0) {
        const payBtn = document.createElement('button');
        payBtn.className = 'px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded';
        payBtn.textContent = 'Pay';
        payBtn.onclick = () => showPayDrawer(index);
        item.appendChild(payBtn);
      }
      billList.appendChild(item);
    });
  }
  const totalLeft = Math.max(totalDue - totalPaid, 0);
  summary.innerHTML = `
    <p>
      <strong>This Month’s Bills:</strong><br/>
      Paid: $${totalPaid.toFixed(2)} | Remaining: $${totalLeft.toFixed(2)}
    </p>`;
}

// Payment drawer functions for bills
function showPayDrawer(billIndex) {
  currentPayBillIndex = billIndex;
  document.getElementById('pay-amount').value = '';
  document.getElementById('pay-drawer').classList.remove('translate-x-full');
}

function hidePayDrawer() {
  document.getElementById('pay-drawer').classList.add('translate-x-full');
}

function setupPaymentDrawer() {
  document.getElementById('pay-cancel-btn').onclick = hidePayDrawer;
  document.getElementById('pay-confirm-btn').onclick = async () => {
    const amountStr = document.getElementById('pay-amount').value.trim();
    const amountNum = parseFloat(amountStr);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    try {
      const bills = dataService.getBills();
      bills[currentPayBillIndex].addPayment({ amount: amountNum, year, month });
      await dataService.saveData();
      loadBills();
      loadManageBills();
      renderCalendar();
    } catch (err) {
      alert(err.message);
    }
    hidePayDrawer();
  };
}

// --------------------
// PAYCHECK FUNCTIONS
// --------------------

// Loads paycheck information for the Bill View section
async function loadPaychecksView() {
  await dataService.loadData();
  const paychecks = dataService.getPaychecks();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  let totalPay = 0;
  paychecks.forEach(pc => {
    const pcDate = new Date(pc.date + 'T00:00:00');
    if (pcDate.getFullYear() === year && pcDate.getMonth() === month) {
      totalPay += pc.amount;
    }
  });
  const paycheckSummary = document.getElementById('paycheck-summary');
  if (paycheckSummary) {
    paycheckSummary.innerHTML = `<p>
      <strong>This Month’s Paychecks:</strong><br/>
      Total: $${totalPay.toFixed(2)}
    </p>`;
  }
  
  const paycheckList = document.getElementById('paycheck-list');
  if (paycheckList) {
    paycheckList.innerHTML = '';
    paychecks.forEach((pc, index) => {
      const pcDate = new Date(pc.date + 'T00:00:00');
      if (pcDate.getFullYear() === year && pcDate.getMonth() === month) {
        const item = document.createElement('div');
        item.className = 'p-3 bg-gray-700 border border-gray-600 rounded flex justify-between items-center';
        item.innerHTML = `
          <div>
            <div class="font-semibold">Paycheck</div>
            <div class="text-sm">
              Date: ${pc.getFormattedDate()}<br/>
              Amount: $${pc.amount.toFixed(2)}
            </div>
          </div>
        `;
        paycheckList.appendChild(item);
      }
    });
  }
}

// Handles the paycheck form submission in Manage Bills
async function savePaycheckForm(e) {
  e.preventDefault();
  const date = document.getElementById('paycheck-date').value;
  const amount = parseFloat(document.getElementById('paycheck-amount').value);
  if (!date || isNaN(amount) || amount <= 0) {
    alert("Please enter a valid date and positive amount.");
    return;
  }
  const newPaycheck = new Paycheck({ date, amount });
  const paychecks = dataService.getPaychecks();
  paychecks.push(newPaycheck);
  await dataService.saveData();
  document.getElementById('paycheck-form').reset();
  loadPaychecksView();
  loadManagePaychecks();
  renderCalendar();
}

// Loads the Manage Paychecks list in the Manage Bills section
async function loadManagePaychecks() {
  await dataService.loadData();
  const paychecks = dataService.getPaychecks();
  const manageList = document.getElementById('manage-paycheck-list');
  manageList.innerHTML = '';

  if (!paychecks.length) {
    const noItem = document.createElement('div');
    noItem.className = 'p-3 bg-gray-700 rounded';
    noItem.textContent = 'No paychecks yet. Add one below.';
    manageList.appendChild(noItem);
    return;
  }
  
  paychecks.forEach((pc, index) => {
    const item = document.createElement('div');
    item.className = 'p-3 bg-gray-700 border border-gray-600 rounded flex justify-between items-center';
    item.innerHTML = `
      <div>
        <div class="font-semibold">Paycheck</div>
        <div class="text-sm">
          Date: ${pc.getFormattedDate()}<br/>
          Amount: $${pc.amount.toFixed(2)}
        </div>
      </div>
    `;
    const btnGroup = document.createElement('div');
    btnGroup.className = 'space-x-2';
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = async () => {
        if (!confirm("Are you sure you want to delete this paycheck?")) return;
        // Retrieve the current paychecks array
        let currentPaychecks = dataService.getPaychecks();
        // Remove the paycheck at the given index
        currentPaychecks.splice(index, 1);
        // Update the data service with the new array
        dataService.setPaychecks(currentPaychecks);
        // Save the updated data
        await dataService.saveData();
        // Refresh the UI sections
        await loadManagePaychecks();
        await loadPaychecksView();
        renderCalendar();
      };
    btnGroup.appendChild(deleteBtn);
    item.appendChild(btnGroup);
    manageList.appendChild(item);
  });
}

// --------------------
// CALENDAR RENDERING
// --------------------

// File: ui.js
// File: ui.js
async function renderCalendar() {
    const container = document.getElementById('calendar-container');
    if (!container) return;
    container.innerHTML = '';
  
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const dayOfWeek = firstOfMonth.getDay();
    const lastOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastOfMonth.getDate();
  
    let html = `
      <div class="grid grid-cols-7 gap-1 text-center text-xs font-bold">
        <div>Sun</div><div>Mon</div><div>Tue</div>
        <div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>
    `;
  
    // Group bills by day
    const bills = dataService.getBills();
    const billsByDay = {};
    bills.forEach(bill => {
      if (!bill.dueDate) return;
      const d = new Date(bill.dueDate + 'T00:00:00');
      if (d.getFullYear() === year && d.getMonth() === month) {
        const dayNum = d.getDate();
        billsByDay[dayNum] = billsByDay[dayNum] || [];
        billsByDay[dayNum].push(bill);
      }
    });
  
    // Group paychecks by day using the paycheck "date" property
    const paychecks = dataService.getPaychecks();
    const paychecksByDay = {};
    paychecks.forEach(pc => {
      if (!pc.date) return;
      const d = new Date(pc.date + 'T00:00:00');
      if (d.getFullYear() === year && d.getMonth() === month) {
        const dayNum = d.getDate();
        paychecksByDay[dayNum] = paychecksByDay[dayNum] || [];
        paychecksByDay[dayNum].push(pc);
      }
    });
  
    html += `<div class="grid grid-cols-7 gap-1 mt-2">`;
    let dayCounter = 1 - dayOfWeek;
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        if (dayCounter < 1 || dayCounter > daysInMonth) {
          html += `<div class="h-20 p-1 bg-gray-800 text-gray-500 rounded"></div>`;
        } else {
          // Determine cell background based on bills status
          let cellBgClass = "bg-gray-700"; // default if no bills
          if (billsByDay[dayCounter] && billsByDay[dayCounter].length > 0) {
            let allPaid = true;
            billsByDay[dayCounter].forEach(bill => {
              let monthlyDue = bill.getMonthlyDue();
              let paidThisMonth = bill.getPaidThisMonth(year, month);
              if (!(paidThisMonth >= monthlyDue && monthlyDue > 0)) {
                allPaid = false;
              }
            });
            cellBgClass = allPaid ? "bg-green-600" : "bg-red-600";
          }
          html += `<div class="h-20 p-1 ${cellBgClass} rounded border border-gray-600 flex flex-col overflow-auto">`;
          html += `<div class="text-xs font-bold">${dayCounter}</div>`;
          // List bills due on this day
          if (billsByDay[dayCounter]) {
            billsByDay[dayCounter].forEach(bill => {
              html += `<div class="text-xs text-white">${bill.name}</div>`;
            });
          }
          // List paychecks on this day
          if (paychecksByDay[dayCounter]) {
            paychecksByDay[dayCounter].forEach(pc => {
              html += `<div class="text-xs text-green-300">Paycheck: $${pc.amount.toFixed(2)}</div>`;
            });
          }
          html += `</div>`;
        }
        dayCounter++;
      }
    }
    html += `</div>`;
    container.innerHTML = html;
  }

// --------------------
// MANAGE BILLS (for editing/deleting bills)
// --------------------
async function loadManageBills() {
  await dataService.loadData();
  const bills = dataService.getBills();
  const manageList = document.getElementById('manage-bill-list');
  manageList.innerHTML = '';

  if (!bills.length) {
    const noItem = document.createElement('div');
    noItem.className = 'p-3 bg-gray-700 rounded';
    noItem.textContent = 'No bills yet. Add one below.';
    manageList.appendChild(noItem);
    return;
  }
  bills.forEach((bill, index) => {
    const item = document.createElement('div');
    item.className = 'p-3 bg-gray-700 border border-gray-600 rounded flex justify-between items-center';
    let info = `<div class="font-semibold">${bill.name}</div>
                <div class="text-sm">
                  Category: ${bill.category} <br/>
                  Due: ${bill.getFormattedDueDate()}
                </div>`;
    if (bill.category === "Loan") {
      if (bill.balance !== undefined) info += `<div class="text-sm">Balance: $${bill.balance}</div>`;
      if (bill.minPayment !== undefined) info += `<div class="text-sm">Min Payment: $${bill.minPayment}</div>`;
    } else if (bill.category === "Credit Card") {
      if (bill.balance !== undefined) info += `<div class="text-sm">Balance: $${bill.balance}</div>`;
      if (bill.creditLimit !== undefined) info += `<div class="text-sm">Credit Limit: $${bill.creditLimit}</div>`;
      if (bill.minPayment !== undefined) info += `<div class="text-sm">Min Payment: $${bill.minPayment}</div>`;
    } else if (bill.category === "Utility" && bill.amount !== undefined) {
      info += `<div class="text-sm">Monthly Amount: $${bill.amount}</div>`;
    }
    item.innerHTML = `<div>${info}</div>`;
    const btnGroup = document.createElement('div');
    btnGroup.className = 'space-x-2';

    const editBtn = document.createElement('button');
    editBtn.className = 'px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded';
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => editBill(index, bill);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = async () => {
      if (!confirm("Are you sure you want to delete this bill?")) return;
      bills.splice(index, 1);
      await dataService.saveData();
      loadManageBills();
      loadBills();
      renderCalendar();
    };

    btnGroup.appendChild(editBtn);
    btnGroup.appendChild(deleteBtn);
    item.appendChild(btnGroup);
    manageList.appendChild(item);
  });
}

function editBill(index, bill) {
  document.getElementById('bill-id').value = index;
  document.getElementById('bill-name').value = bill.name;
  document.getElementById('bill-category').value = bill.category;
  document.getElementById('bill-due-date').value = bill.dueDate || '';
  showExtraFields(bill.category, bill);
}

// --------------------
// EXTRA FIELDS (for bill categories)
// --------------------
function showExtraFields(category, bill = {}) {
  document.getElementById('loan-fields').classList.add('hidden');
  document.getElementById('credit-card-fields').classList.add('hidden');
  document.getElementById('utility-fields').classList.add('hidden');

  if (category === "Loan") {
    document.getElementById('loan-fields').classList.remove('hidden');
    document.getElementById('bill-balance').value = bill.balance || "";
    document.getElementById('bill-min-payment').value = bill.minPayment || "";
    document.getElementById('bill-apr').value = bill.apr || "";
  } else if (category === "Credit Card") {
    document.getElementById('credit-card-fields').classList.remove('hidden');
    document.getElementById('cc-balance').value = bill.balance || "";
    document.getElementById('cc-limit').value = bill.creditLimit || "";
    document.getElementById('cc-min-payment').value = bill.minPayment || "";
    document.getElementById('cc-apr').value = bill.apr || "";
  } else if (category === "Utility") {
    document.getElementById('utility-fields').classList.remove('hidden');
    document.getElementById('utility-amount').value = bill.amount || "";
  }
}

// --------------------
// SAVE BILL FORM (for bills)
// --------------------
async function saveBillForm(e) {
  e.preventDefault();
  const id = document.getElementById('bill-id').value;
  const name = document.getElementById('bill-name').value.trim();
  const category = document.getElementById('bill-category').value;
  const dueDate = document.getElementById('bill-due-date').value;

  if (!name) {
    alert("Please enter a bill name.");
    return;
  }
  let billData = { name, category, dueDate };
  if (category === "Loan") {
    billData.balance = parseFloat(document.getElementById('bill-balance').value) || 0;
    billData.minPayment = parseFloat(document.getElementById('bill-min-payment').value) || 0;
    billData.apr = parseFloat(document.getElementById('bill-apr').value) || 0;
  } else if (category === "Credit Card") {
    billData.balance = parseFloat(document.getElementById('cc-balance').value) || 0;
    billData.creditLimit = parseFloat(document.getElementById('cc-limit').value) || 0;
    billData.minPayment = parseFloat(document.getElementById('cc-min-payment').value) || 0;
    billData.apr = parseFloat(document.getElementById('cc-apr').value) || 0;
  } else if (category === "Utility") {
    billData.amount = parseFloat(document.getElementById('utility-amount').value) || 0;
  }
  const newBill = new Bill(billData);
  const bills = dataService.getBills();
  if (id === "") {
    bills.push(newBill);
  } else {
    bills[parseInt(id)] = newBill;
  }
  await dataService.saveData();
  document.getElementById('bill-form').reset();
  document.getElementById('bill-id').value = "";
  loadManageBills();
  loadBills();
  renderCalendar();
}

// --------------------
// TAB SETUP
// --------------------
function setupTabs() {
  const btns = document.querySelectorAll('.tab-btn');
  const sections = document.querySelectorAll('.tab-content');

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white');
        b.classList.add('bg-gray-700', 'text-gray-200');
      });
      sections.forEach(sec => sec.classList.add('hidden'));

      btn.classList.remove('bg-gray-700', 'text-gray-200');
      btn.classList.add('bg-blue-600', 'text-white');

      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.remove('hidden');

      if (tabId === 'calendar-view') {
        renderCalendar();
      }
    });
  });
}

// --------------------
// SETTINGS
// --------------------
function setupSettings() {
  document.getElementById('backup-btn').addEventListener('click', () => {
    ipcRenderer.invoke('backup-data').then(success => {
      alert(success ? "Backup successful!" : "Backup cancelled or failed.");
    });
  });
  document.getElementById('restore-btn').addEventListener('click', () => {
    ipcRenderer.invoke('restore-data').then(success => {
      if (success) {
        alert("Data restored successfully!");
        loadBills();
        loadManageBills();
        renderCalendar();
      } else {
        alert("Restore cancelled or failed.");
      }
    });
  });
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm("Are you sure you want to delete all data?")) {
      ipcRenderer.invoke('reset-data').then(() => {
        dataService.setBills([]);
        dataService.setPaychecks([]);
        loadBills();
        loadManageBills();
        renderCalendar();
      });
    }
  });
}

// Export functions and state needed by renderer.js
module.exports = {
  updateMonthDisplay,
  loadBills,
  renderCalendar,
  showPayDrawer,
  hidePayDrawer,
  setupPaymentDrawer,
  loadManageBills,
  editBill,
  saveBillForm,
  showExtraFields,
  setupSettings,
  setupTabs,
  savePaycheckForm,
  loadManagePaychecks,
  loadPaychecksView,
  currentMonth
};