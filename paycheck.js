// paycheck.js
// A simple class to represent a paycheck.
class Paycheck {
    constructor({ date = "", amount = 0 } = {}) {
      this.date = date;
      this.amount = parseFloat(amount) || 0;
    }
  
    // Returns a formatted date string (MM/DD/YYYY)
    getFormattedDate() {
      if (!this.date) return 'N/A';
      const parsed = new Date(this.date + 'T00:00:00');
      return formatAmericanDate(parsed);
    }
  }
  
  // Utility function (same as in bill.js; you might consider a shared utility module)
  function formatAmericanDate(d) {
    if (!(d instanceof Date) || isNaN(d)) return '';
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }
  
  module.exports = Paycheck;