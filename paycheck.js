// File: paycheck.js
// A class to represent a paycheck, with optional recurrence.
class Paycheck {
  constructor({
    date = "", // the original date as a string (e.g. "2025-02-07")
    amount = 0,
    recurrence = false,           // boolean: is this paycheck recurring?
    recurrenceType = "",          // string: "weekly", "biweekly", "monthly", "custom"
    customDays = []               // array of numbers (e.g., [7,22]) if recurrenceType is "custom"
  } = {}) {
    this.date = date;
    this.amount = parseFloat(amount) || 0;
    this.recurrence = recurrence;
    this.recurrenceType = recurrenceType;
    this.customDays = customDays;
  }

  // Returns a formatted date string (MM/DD/YYYY) for the original date.
  getFormattedDate() {
    if (!this.date) return 'N/A';
    const parsed = new Date(this.date + 'T00:00:00');
    return formatAmericanDate(parsed);
  }

  // Determines whether this paycheck occurs on a given day.
  // (year: full year, month: zero-indexed month, day: day of month)
  occursOn(year, month, day) {
    const original = new Date(this.date + 'T00:00:00');
    if (!this.recurrence) {
      // Only occurs on the original date.
      return original.getFullYear() === year &&
             original.getMonth() === month &&
             original.getDate() === day;
    }
    // For recurring paychecks, check the recurrence type.
    if (this.recurrenceType === "weekly") {
      // Occurs on the same day of week as the original.
      const target = new Date(year, month, day);
      return original.getDay() === target.getDay();
    }
    if (this.recurrenceType === "biweekly") {
      // Occurs on the same day-of-week and the difference in days is a multiple of 14.
      const target = new Date(year, month, day);
      if (original.getDay() !== target.getDay()) return false;
      // Round the day difference to the nearest integer.
      const diff = Math.round((target - original) / (1000 * 60 * 60 * 24));
      return diff % 14 === 0;
    }
    if (this.recurrenceType === "monthly") {
      // Occurs on the same day-of-month as the original.
      return day === original.getDate();
    }
    if (this.recurrenceType === "custom") {
      // Occurs on any of the custom specified days.
      return this.customDays.includes(day);
    }
    return false;
  }
}

// Utility function used by the Paycheck class.
function formatAmericanDate(d) {
  if (!(d instanceof Date) || isNaN(d)) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

module.exports = Paycheck;