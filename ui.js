// ui.js
const { ipcRenderer } = require('electron');
const Bill = require('./bill');
const Paycheck = require('./paycheck');
const dataService = require('./dataService');

// Global state
let currentMonth = new Date();
let currentPayBillIndex = null;
// Global variables to hold Chart.js instances for Credit Analysis
let interestChartInstance = null;
let utilizationChartInstance = null;

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
        <strong>This Month’s Bills:</strong><br>
        Paid: $0.00 | Remaining: $0.00
      </p>`;
    const noBills = document.createElement('div');
    // Use the neumorphic class for a light background
    noBills.className = 'neumorphic p-4';
    noBills.textContent = 'No bills yet. Add one under Manage Bills.';
    billList.appendChild(noBills);
  } else {
    bills.forEach((bill, index) => {
      const monthlyDue = bill.getMonthlyDue();
      const paidThisMonth = bill.getPaidThisMonth(year, month);
      totalDue += monthlyDue;
      totalPaid += paidThisMonth;

      const leftover = Math.max(monthlyDue - paidThisMonth, 0);
      const isPaid = (paidThisMonth >= monthlyDue && monthlyDue > 0);
      const dueDateStr = bill.getFormattedDueDate();

      // Create bill item using our neumorphic styling
      const item = document.createElement('div');
      item.className = 'neumorphic p-4 flex justify-between items-center';
      item.innerHTML = `
        <div>
          <div class="font-semibold text-lg">${bill.name}</div>
          <div class="text-sm">
            Due: ${dueDateStr}<br>
            Monthly Due: $${monthlyDue.toFixed(2)}<br>
            Paid: $${paidThisMonth.toFixed(2)}<br>
            Leftover: $${leftover.toFixed(2)}<br>
            Status: <span class="${isPaid ? 'text-green-600' : 'text-red-600'}">
              ${isPaid ? 'Paid' : 'Unpaid'}
            </span>
          </div>
        </div>
      `;
      if (!isPaid && leftover > 0) {
        const payBtn = document.createElement('button');
        payBtn.className = 'neumorphic-button';
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
      <strong>This Month’s Bills:</strong><br>
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
async function loadPaychecksView() {
  await dataService.loadData();
  const paychecks = dataService.getPaychecks();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const lastOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastOfMonth.getDate();
  
  let totalPay = 0;
  paychecks.forEach(pc => {
    if (!pc.recurrence) {
      const pcDate = new Date(pc.date + 'T00:00:00');
      if (pcDate.getFullYear() === year && pcDate.getMonth() === month) {
        totalPay += pc.amount;
      }
    } else {
      // Count the number of occurrences for a recurring paycheck in the current month
      let count = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        if (pc.occursOn(year, month, day)) count++;
      }
      totalPay += (pc.amount * count);
    }
  });
  const paycheckSummary = document.getElementById('paycheck-summary');
  if (paycheckSummary) {
    paycheckSummary.innerHTML = `<p>
      <strong>This Month’s Paychecks:</strong><br>
      Total: $${totalPay.toFixed(2)}
    </p>`;
  }
  
  // (The list rendering below uses calendar logic; see updated renderCalendar.)
  const paycheckList = document.getElementById('paycheck-list');
  if (paycheckList) {
    paycheckList.innerHTML = '';
    paychecks.forEach((pc, index) => {
      if (!pc.recurrence) {
        const pcDate = new Date(pc.date + 'T00:00:00');
        if (pcDate.getFullYear() === year && pcDate.getMonth() === month) {
          const item = document.createElement('div');
          item.className = 'neumorphic p-4 flex justify-between items-center';
          item.innerHTML = `
            <div>
              <div class="font-semibold">Paycheck</div>
              <div class="text-sm">
                Date: ${pc.getFormattedDate()}<br>
                Amount: $${pc.amount.toFixed(2)}
              </div>
            </div>
          `;
          paycheckList.appendChild(item);
        }
      } else {
        // For recurring, count occurrences and display once
        let count = 0;
        for (let day = 1; day <= daysInMonth; day++) {
          if (pc.occursOn(year, month, day)) count++;
        }
        if (count > 0) {
          const item = document.createElement('div');
          item.className = 'neumorphic p-4 flex justify-between items-center';
          item.innerHTML = `
            <div>
              <div class="font-semibold">Recurring Paycheck</div>
              <div class="text-sm">
                Occurs ${count} times this month<br>
                Amount per occurrence: $${pc.amount.toFixed(2)}
              </div>
            </div>
          `;
          paycheckList.appendChild(item);
        }
      }
    });
  }
}

async function savePaycheckForm(e) {
  e.preventDefault();
  const date = document.getElementById('paycheck-date').value;
  const amount = parseFloat(document.getElementById('paycheck-amount').value);
  // Get recurrence settings
  const recurrence = document.getElementById('paycheck-recurrence').checked;
  const recurrenceType = document.getElementById('paycheck-recurrence-type').value;
  let customDays = [];
  if (recurrence && recurrenceType === "custom") {
    const customDaysInput = document.getElementById('paycheck-custom-days').value;
    customDays = customDaysInput.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d));
  }
  if (!date || isNaN(amount) || amount <= 0) {
    alert("Please enter a valid date and positive amount.");
    return;
  }
  const newPaycheck = new (require('./paycheck'))({
    date,
    amount,
    recurrence,
    recurrenceType: recurrence ? recurrenceType : "",
    customDays
  });
  const paychecks = dataService.getPaychecks();
  paychecks.push(newPaycheck);
  await dataService.saveData();
  document.getElementById('paycheck-form').reset();
  loadPaychecksView();
  loadManagePaychecks();
  renderCalendar();
}

async function loadManagePaychecks() {
  await dataService.loadData();
  const paychecks = dataService.getPaychecks();
  const manageList = document.getElementById('manage-paycheck-list');
  manageList.innerHTML = '';

  if (!paychecks.length) {
    const noItem = document.createElement('div');
    noItem.className = 'neumorphic p-4';
    noItem.textContent = 'No paychecks yet. Add one below.';
    manageList.appendChild(noItem);
    return;
  }
  
  paychecks.forEach((pc, index) => {
    const item = document.createElement('div');
    item.className = 'neumorphic p-4 flex justify-between items-center';
    item.innerHTML = `
      <div>
        <div class="font-semibold">Paycheck</div>
        <div class="text-sm">
          Date: ${pc.getFormattedDate()}<br>
          Amount: $${pc.amount.toFixed(2)}
        </div>
      </div>
    `;
    const btnGroup = document.createElement('div');
    btnGroup.className = 'space-x-2';
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'neumorphic-button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = async () => {
      if (!confirm("Are you sure you want to delete this paycheck?")) return;
      let currentPaychecks = dataService.getPaychecks();
      currentPaychecks.splice(index, 1);
      dataService.setPaychecks(currentPaychecks);
      await dataService.saveData();
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

  // Group paychecks by day (including recurring paychecks)
  const paychecks = dataService.getPaychecks();
  const paychecksByDay = {};
  for (let day = 1; day <= daysInMonth; day++) {
    paychecks.forEach(pc => {
      if (pc.occursOn(year, month, day)) {
        if (!paychecksByDay[day]) paychecksByDay[day] = [];
        paychecksByDay[day].push(pc);
      }
    });
  }

  html += `<div class="grid grid-cols-7 gap-1 mt-2">`;
  let dayCounter = 1 - dayOfWeek;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      if (dayCounter < 1 || dayCounter > daysInMonth) {
        // Use a light, neumorphic background for empty cells
        html += `<div class="h-20 p-1 neumorphic"></div>`;
      } else {
        // Determine cell background based on bills status
        let cellBgClass = "neumorphic"; // default if no bills
        if (billsByDay[dayCounter] && billsByDay[dayCounter].length > 0) {
          let allPaid = true;
          billsByDay[dayCounter].forEach(bill => {
            let monthlyDue = bill.getMonthlyDue();
            let paidThisMonth = bill.getPaidThisMonth(year, month);
            if (!(paidThisMonth >= monthlyDue && monthlyDue > 0)) {
              allPaid = false;
            }
          });
          // Use green or red overlays via inline style
          cellBgClass = allPaid ? "bg-green-100" : "bg-red-100";
          // Wrap the cell content in a container that still has the neumorphic border/rounding
          cellBgClass += " neumorphic";
        }
        html += `<div class="h-20 p-1 ${cellBgClass} rounded border border-solid border-[#d1d9e6] flex flex-col overflow-auto">`;
        html += `<div class="text-xs font-bold">${dayCounter}</div>`;
        // List bills for this day
        if (billsByDay[dayCounter]) {
          billsByDay[dayCounter].forEach(bill => {
            html += `<div class="text-xs text-gray-800">${bill.name}</div>`;
          });
        }
        // List paychecks for this day
        if (paychecksByDay[dayCounter]) {
          paychecksByDay[dayCounter].forEach(pc => {
            html += `<div class="text-xs text-teal-600">Paycheck: $${pc.amount.toFixed(2)}</div>`;
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
// MANAGE BILLS (Editing/Deleting Bills)
// --------------------
async function loadManageBills() {
  await dataService.loadData();
  const bills = dataService.getBills();
  const manageList = document.getElementById('manage-bill-list');
  manageList.innerHTML = '';

  if (!bills.length) {
    const noItem = document.createElement('div');
    noItem.className = 'neumorphic p-4';
    noItem.textContent = 'No bills yet. Add one below.';
    manageList.appendChild(noItem);
    return;
  }
  bills.forEach((bill, index) => {
    const item = document.createElement('div');
    item.className = 'neumorphic p-4 flex justify-between items-center';
    let info = `<div class="font-semibold">${bill.name}</div>
                <div class="text-sm">
                  Category: ${bill.category}<br>
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
    editBtn.className = 'neumorphic-button';
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => editBill(index, bill);
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'neumorphic-button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = async () => {
      if (!confirm("Are you sure you want to delete this bill?")) return;
      bills.splice(index, 1);
      await dataService.saveData();
      loadManageBills();
      loadBills();
      renderCalendar();
    
      // Update Credit Analysis if it is active.
      if (!document.getElementById('credit-analysis').classList.contains('hidden')) {
        loadCreditAnalysis();
      }
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
// EXTRA FIELDS (for Bill Categories)
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
// SAVE BILL FORM
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

  // If the Credit Analysis tab is active, update it.
  if (!document.getElementById('credit-analysis').classList.contains('hidden')) {
    loadCreditAnalysis();
  }
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
        b.classList.remove('active-tab');
        b.classList.add('neumorphic-button');
      });
      sections.forEach(sec => sec.classList.add('hidden'));

      btn.classList.remove('neumorphic-button');
      btn.classList.add('active-tab');

      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.remove('hidden');

      if (tabId === 'calendar-view') {
        renderCalendar();
      } else if (tabId === 'credit-analysis') {
        loadCreditAnalysis();
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
async function loadCreditAnalysis() {
  await dataService.loadData();
  const bills = dataService.getBills();
  const creditCards = bills.filter(bill => bill.category === "Credit Card");

  const summaryDiv = document.getElementById('credit-summary');
  if (!creditCards.length) {
    summaryDiv.innerHTML = "<p>No credit card data available.</p>";
    return;
  }

  let totalBalance = 0, totalCreditLimit = 0, totalAPR = 0, totalMinPayment = 0;
  creditCards.forEach(card => {
    totalBalance += parseFloat(card.balance) || 0;
    totalCreditLimit += parseFloat(card.creditLimit) || 0;
    totalAPR += parseFloat(card.apr) || 0;
    totalMinPayment += parseFloat(card.minPayment) || 0;
  });
  const avgAPR = creditCards.length ? (totalAPR / creditCards.length) : 0;
  const overallUtilization = totalCreditLimit > 0 ? (totalBalance / totalCreditLimit * 100) : 0;

  let summaryHTML = `<h2 class="text-2xl font-bold mb-4">Credit Card Analysis Summary</h2>`;
  summaryHTML += `<p>Total Balance: $${totalBalance.toFixed(2)}</p>`;
  summaryHTML += `<p>Total Credit Limit: $${totalCreditLimit.toFixed(2)}</p>`;
  summaryHTML += `<p>Average APR: ${avgAPR.toFixed(2)}%</p>`;
  summaryHTML += `<p>Total Minimum Payment: $${totalMinPayment.toFixed(2)}</p>`;
  summaryHTML += `<p>Overall Credit Utilization: ${overallUtilization.toFixed(2)}%</p>`;
  summaryHTML += `<h3 class="text-xl font-bold mt-4">Truths about Credit Cards:</h3>
                  <ul class="list-disc ml-6">
                    <li>High credit utilization can negatively impact your credit score.</li>
                    <li>Paying only the minimum prolongs debt and increases interest costs.</li>
                    <li>Lowering your balance quickly saves you money on interest.</li>
                    <li>Understanding your APR is crucial for managing credit costs.</li>
                  </ul>`;
  summaryDiv.innerHTML = summaryHTML;

  // Prepare data for the interest cost chart.
  const interestData = creditCards.map(card => {
    const balance = parseFloat(card.balance) || 0;
    const apr = parseFloat(card.apr) || 0;
    const monthlyInterest = (apr / 100 / 12) * balance;
    return { name: card.name, monthlyInterest };
  });

  const interestLabels = interestData.map(item => item.name);
  const interestValues = interestData.map(item => parseFloat(item.monthlyInterest.toFixed(2)));

  // Destroy the previous interest chart if it exists.
  if (interestChartInstance) {
    interestChartInstance.destroy();
  }
  const interestCtx = document.getElementById('interestChart').getContext('2d');
  interestChartInstance = new Chart(interestCtx, {
    type: 'bar',
    data: {
      labels: interestLabels,
      datasets: [{
        label: 'Monthly Interest ($)',
        data: interestValues,
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  // Prepare data for the utilization chart.
  const utilizationData = creditCards.map(card => {
    const balance = parseFloat(card.balance) || 0;
    const creditLimit = parseFloat(card.creditLimit) || 0;
    const utilization = creditLimit > 0 ? (balance / creditLimit * 100) : 0;
    return { name: card.name, utilization };
  });

  const utilizationLabels = utilizationData.map(item => item.name);
  const utilizationValues = utilizationData.map(item => parseFloat(item.utilization.toFixed(2)));

  // Destroy the previous utilization chart if it exists.
  if (utilizationChartInstance) {
    utilizationChartInstance.destroy();
  }
  const utilizationCtx = document.getElementById('utilizationChart').getContext('2d');
  utilizationChartInstance = new Chart(utilizationCtx, {
    type: 'bar',
    data: {
      labels: utilizationLabels,
      datasets: [{
        label: 'Credit Utilization (%)',
        data: utilizationValues,
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true, max: 100 }
      }
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
  loadCreditAnalysis,
  currentMonth
};