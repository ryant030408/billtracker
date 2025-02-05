// bill.js
class Bill {
    constructor({
      name = "",
      category = "",
      dueDate = "",
      balance,
      minPayment,
      apr,
      creditLimit,
      amount,
      paymentHistory = []
    } = {}) {
      this.name = name;
      this.category = category;
      this.dueDate = dueDate;
      this.balance = balance;
      this.minPayment = minPayment;
      this.apr = apr;
      this.creditLimit = creditLimit;
      this.amount = amount;
      this.paymentHistory = paymentHistory;
    }
  
    // Return the monthly due based on category
    getMonthlyDue() {
      if (this.category === "Loan" || this.category === "Credit Card") {
        return parseFloat(this.minPayment) || 0;
      } else if (this.category === "Utility") {
        return parseFloat(this.amount) || 0;
      }
      return 0;
    }
  
    // Sum payments for a given month and year
    getPaidThisMonth(year, month) {
      return this.paymentHistory
        .filter(r => r.year === year && r.month === month)
        .reduce((acc, r) => acc + r.amount, 0);
    }
  
    // Add a payment and update balance if necessary
    addPayment({ amount, year, month }) {
      if (typeof amount !== 'number' || amount <= 0) {
        throw new Error("Invalid payment amount");
      }
      this.paymentHistory.push({ year, month, amount });
      if ((this.category === "Loan" || this.category === "Credit Card") && typeof this.balance === 'number') {
        this.balance = Math.max(this.balance - amount, 0);
      }
    }
  
    // Format the due date for display
    getFormattedDueDate() {
      if (!this.dueDate) return 'N/A';
      const parsed = new Date(this.dueDate + 'T00:00:00');
      return formatAmericanDate(parsed);
    }
  }
  
  // Utility function used by the Bill class
  function formatAmericanDate(d) {
    if (!(d instanceof Date) || isNaN(d)) return '';
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }
  
  module.exports = Bill;