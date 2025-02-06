// renderer.js
const ui = require('./ui');

function init() {
  ui.setupTabs();
  // Automatically select the Bill View tab
  document.querySelector('[data-tab="bill-view"]').click();

  ui.updateMonthDisplay();
  ui.loadBills();
  ui.loadManageBills();
  ui.setupPaymentDrawer();
  ui.setupSettings();
  
  // Setup paycheck form listener
  document.getElementById('paycheck-form').addEventListener('submit', ui.savePaycheckForm);
  // Load managed paychecks on startup
  ui.loadManagePaychecks();
  
  // Month navigation buttons in Bill View
  document.getElementById('prev-month').addEventListener('click', () => {
    ui.currentMonth.setMonth(ui.currentMonth.getMonth() - 1);
    ui.updateMonthDisplay();
    ui.loadBills();
    ui.renderCalendar();
    ui.loadPaychecksView();
  });
  document.getElementById('next-month').addEventListener('click', () => {
    ui.currentMonth.setMonth(ui.currentMonth.getMonth() + 1);
    ui.updateMonthDisplay();
    ui.loadBills();
    ui.renderCalendar();
    ui.loadPaychecksView();
  });

  // Bill form
  document.getElementById('bill-form').addEventListener('submit', ui.saveBillForm);
  document.getElementById('bill-category').addEventListener('change', e => {
    ui.showExtraFields(e.target.value);
  });

  // Initial render for calendar and paycheck view
  ui.renderCalendar();
  ui.loadPaychecksView();
}

document.addEventListener('DOMContentLoaded', init);