// renderer.js
const ui = require('./ui');

function init() {
  ui.setupTabs();
  ui.updateMonthDisplay();
  ui.loadBills();
  ui.loadManageBills();
  ui.setupPaymentDrawer();
  ui.setupSettings();

  // Month navigation in Bill View
  document.getElementById('prev-month').addEventListener('click', () => {
    // Update the global currentMonth in ui.js directly
    ui.currentMonth.setMonth(ui.currentMonth.getMonth() - 1);
    ui.updateMonthDisplay();
    ui.loadBills();
    ui.renderCalendar();
  });
  document.getElementById('next-month').addEventListener('click', () => {
    ui.currentMonth.setMonth(ui.currentMonth.getMonth() + 1);
    ui.updateMonthDisplay();
    ui.loadBills();
    ui.renderCalendar();
  });

  // Manage Bills form
  document.getElementById('bill-form').addEventListener('submit', ui.saveBillForm);
  document.getElementById('bill-category').addEventListener('change', e => {
    ui.showExtraFields(e.target.value);
  });

  // Initial calendar render
  ui.renderCalendar();
}

document.addEventListener('DOMContentLoaded', init);