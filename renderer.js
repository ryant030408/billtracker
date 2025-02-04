const { ipcRenderer } = require('electron');

let currentMonth = new Date();
let currentPayBillIndex = null;

function init() {
  setupTabs();
  updateMonthDisplay();
  loadBills();
  loadManageBills();
  setupPaymentDrawer();

  // Month nav
  document.getElementById('prev-month').addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    updateMonthDisplay();
    loadBills();
    renderCalendar();
  });
  document.getElementById('next-month').addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    updateMonthDisplay();
    loadBills();
    renderCalendar();
  });

  // Manage Bills form
  document.getElementById('bill-form').addEventListener('submit', saveBillForm);
  document.getElementById('bill-category').addEventListener('change', e => {
    showExtraFields(e.target.value);
  });

  // Settings
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
        loadBills();
        loadManageBills();
        renderCalendar();
      });
    }
  });

  // Initial calendar render
  renderCalendar();
}

// American date format
function formatAmericanDate(d) {
  if (!(d instanceof Date)) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

// Show current month in Bill View
function updateMonthDisplay() {
  const options = { year: 'numeric', month: 'long' };
  document.getElementById('current-month').textContent =
    currentMonth.toLocaleDateString('en-US', options);
}

// Load & Display Bills
function loadBills() {
  ipcRenderer.invoke('get-data').then(data => {
    if (!data || !data.bills) data = { bills: [] };
    const bills = data.bills;
    const billList = document.getElementById('bill-list');
    billList.innerHTML = '';

    const summary = document.getElementById('bill-summary');
    let totalDue = 0, totalPaid = 0;

    if (!bills.length) {
      summary.innerHTML = `
        <p><strong>This Month’s Totals:</strong><br/>
        Paid: $0.00 | Remaining: $0.00
        </p>`;
      const noBills = document.createElement('div');
      noBills.className = 'p-3 bg-gray-700 rounded';
      noBills.textContent = 'No bills yet. Add one under Manage Bills.';
      billList.appendChild(noBills);
      return;
    }

    const year = currentMonth.getFullYear();
    const monthIndex = currentMonth.getMonth();

    bills.forEach((bill, index) => {
      let monthlyDue = 0;
      if (bill.category === "Loan" || bill.category === "Credit Card") {
        monthlyDue = bill.minPayment || 0;
      } else if (bill.category === "Utility") {
        monthlyDue = bill.amount || 0;
      }
      const paidThisMonth = (bill.paymentHistory || [])
        .filter(r => r.year === year && r.month === monthIndex)
        .reduce((acc, r) => acc + r.amount, 0);

      totalDue += monthlyDue;
      totalPaid += paidThisMonth;

      let leftover = monthlyDue - paidThisMonth;
      if (leftover < 0) leftover = 0;
      const isPaid = leftover <= 0 && monthlyDue > 0;

      let dueDateStr = '';
      if (bill.dueDate) {
        const parsed = new Date(bill.dueDate + 'T00:00:00');
        dueDateStr = formatAmericanDate(parsed);
      }

      const item = document.createElement('div');
      item.className = 'p-3 bg-gray-700 border border-gray-600 rounded flex justify-between items-center';
      let html = `
        <div>
          <div class="font-semibold">${bill.name}</div>
          <div class="text-sm">
            Due: ${dueDateStr || 'N/A'} <br/>
            Monthly Due: $${monthlyDue.toFixed(2)} <br/>
            Paid So Far: $${paidThisMonth.toFixed(2)} <br/>
            Leftover: $${leftover.toFixed(2)} <br/>
            Status: <span class="${isPaid ? 'text-green-400' : 'text-red-400'}">
              ${isPaid ? 'Paid' : 'Unpaid'}
            </span>
          </div>
        </div>
      `;
      item.innerHTML = html;

      if (!isPaid && leftover > 0) {
        const payBtn = document.createElement('button');
        payBtn.className = 'px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded';
        payBtn.textContent = 'Pay';
        payBtn.onclick = () => showPayDrawer(index);
        item.appendChild(payBtn);
      }
      billList.appendChild(item);
    });

    let totalLeft = totalDue - totalPaid;
    if (totalLeft < 0) totalLeft = 0;
    summary.innerHTML = `
      <p>
        <strong>This Month’s Totals:</strong><br/>
        Paid: $${totalPaid.toFixed(2)} | Remaining: $${totalLeft.toFixed(2)}
      </p>`;
  });
}

// Render the Calendar tab
function renderCalendar() {
  const container = document.getElementById('calendar-container');
  if (!container) return; // might be hidden initially
  container.innerHTML = '';

  const year = currentMonth.getFullYear();
  const monthIndex = currentMonth.getMonth();

  const firstOfMonth = new Date(year, monthIndex, 1);
  const dayOfWeek = firstOfMonth.getDay(); 
  const lastOfMonth = new Date(year, monthIndex + 1, 0);
  const daysInMonth = lastOfMonth.getDate();

  let html = `
    <div class="grid grid-cols-7 gap-1 text-center text-sm font-bold">
      <div>Sun</div><div>Mon</div><div>Tue</div>
      <div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
    </div>
  `;

  ipcRenderer.invoke('get-data').then(data => {
    if (!data || !data.bills) data = { bills: [] };
    const bills = data.bills;
    // group bills by day-of-month
    const billsByDay = {};
    bills.forEach(b => {
      if (!b.dueDate) return;
      const d = new Date(b.dueDate + 'T00:00:00');
      if (d.getFullYear() === year && d.getMonth() === monthIndex) {
        const dayNum = d.getDate();
        if (!billsByDay[dayNum]) billsByDay[dayNum] = [];
        billsByDay[dayNum].push(b);
      }
    });

    html += `<div class="grid grid-cols-7 gap-1 mt-2">`;
    let dayCounter = 1 - dayOfWeek;
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        if (dayCounter < 1 || dayCounter > daysInMonth) {
          // blank
          html += `<div class="h-20 p-1 bg-gray-800 text-gray-500 rounded"></div>`;
        } else {
          html += `<div class="h-20 p-1 bg-gray-700 rounded border border-gray-600 flex flex-col">`;
          html += `<div class="text-xs font-bold">${dayCounter}</div>`;

          if (billsByDay[dayCounter]) {
            billsByDay[dayCounter].forEach(b => {
              html += `<div class="text-xs text-red-400">${b.name}</div>`;
            });
          }
          html += `</div>`;
        }
        dayCounter++;
      }
    }
    html += `</div>`;
    container.innerHTML = html;
  });
}

// Payment Drawer
function showPayDrawer(billIndex) {
  currentPayBillIndex = billIndex;
  document.getElementById('pay-amount').value = '';
  document.getElementById('pay-drawer').classList.remove('translate-x-full');
}
function hidePayDrawer() {
  document.getElementById('pay-drawer').classList.add('translate-x-full');
}
function setupPaymentDrawer() {
  document.getElementById('pay-cancel-btn').onclick = () => {
    hidePayDrawer();
  };
  document.getElementById('pay-confirm-btn').onclick = () => {
    const amountStr = document.getElementById('pay-amount').value.trim();
    const amountNum = parseFloat(amountStr);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }
    payBill(currentPayBillIndex, amountNum);
    hidePayDrawer();
  };
}

// Actually record the payment
function payBill(billIndex, amount) {
  ipcRenderer.invoke('get-data').then(data => {
    if (!data || !data.bills) data = { bills: [] };
    const bill = data.bills[billIndex];
    if (!bill) {
      alert("Error: Bill not found.");
      return;
    }
    if (!bill.paymentHistory) {
      bill.paymentHistory = [];
    }
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    bill.paymentHistory.push({ year: y, month: m, amount });

    if ((bill.category === "Loan" || bill.category === "Credit Card") && bill.balance !== undefined) {
      let newBalance = parseFloat(bill.balance) - amount;
      if (newBalance < 0) newBalance = 0;
      bill.balance = newBalance;
    }
    ipcRenderer.invoke('save-data', data).then(() => {
      loadBills();
      loadManageBills();
      renderCalendar();
    });
  });
}

// Manage Bills
function loadManageBills() {
  ipcRenderer.invoke('get-data').then(data => {
    if (!data || !data.bills) data = { bills: [] };
    const bills = data.bills;
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

      let dueDateStr = '';
      if (bill.dueDate) {
        dueDateStr = formatAmericanDate(new Date(bill.dueDate + 'T00:00:00'));
      }

      let info = `<div class="font-semibold">${bill.name}</div>
                  <div class="text-sm">Category: ${bill.category} <br/>
                  Due: ${dueDateStr || 'N/A'}</div>`;

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
      deleteBtn.onclick = () => deleteBill(index);

      btnGroup.appendChild(editBtn);
      btnGroup.appendChild(deleteBtn);
      item.appendChild(btnGroup);
      manageList.appendChild(item);
    });
  });
}
function editBill(index, bill) {
  document.getElementById('bill-id').value = index;
  document.getElementById('bill-name').value = bill.name;
  document.getElementById('bill-category').value = bill.category;
  document.getElementById('bill-due-date').value = bill.dueDate || '';
  showExtraFields(bill.category, bill);
}
function deleteBill(index) {
  if (!confirm("Are you sure you want to delete this bill?")) return;
  ipcRenderer.invoke('get-data').then(data => {
    if (!data || !data.bills) data = { bills: [] };
    data.bills.splice(index, 1);
    ipcRenderer.invoke('save-data', data).then(() => {
      loadManageBills();
      loadBills();
      renderCalendar();
    });
  });
}
function saveBillForm(e) {
  e.preventDefault();
  const id = document.getElementById('bill-id').value;
  const name = document.getElementById('bill-name').value.trim();
  const category = document.getElementById('bill-category').value;
  const dueDate = document.getElementById('bill-due-date').value;

  if (!name) {
    alert("Please enter a bill name.");
    return;
  }
  let bill = { name, category, dueDate };

  if (category === "Loan") {
    bill.balance = parseFloat(document.getElementById('bill-balance').value) || 0;
    bill.minPayment = parseFloat(document.getElementById('bill-min-payment').value) || 0;
    bill.apr = parseFloat(document.getElementById('bill-apr').value) || 0;
  } else if (category === "Credit Card") {
    bill.balance = parseFloat(document.getElementById('cc-balance').value) || 0;
    bill.creditLimit = parseFloat(document.getElementById('cc-limit').value) || 0;
    bill.minPayment = parseFloat(document.getElementById('cc-min-payment').value) || 0;
    bill.apr = parseFloat(document.getElementById('cc-apr').value) || 0;
  } else if (category === "Utility") {
    bill.amount = parseFloat(document.getElementById('utility-amount').value) || 0;
  }

  ipcRenderer.invoke('get-data').then(data => {
    if (!data || !data.bills) data = { bills: [] };
    if (id === "") {
      data.bills.push(bill);
    } else {
      data.bills[parseInt(id)] = bill;
    }
    ipcRenderer.invoke('save-data', data).then(() => {
      document.getElementById('bill-form').reset();
      document.getElementById('bill-id').value = "";
      loadManageBills();
      loadBills();
      renderCalendar();
    });
  });
}

// Show/hide extra fields
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

// Tab switching
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

// Initialize
document.addEventListener('DOMContentLoaded', init);