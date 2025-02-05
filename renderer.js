// renderer.js
const { ipcRenderer } = require('electron');

let currentMonth = new Date();
let globalData = { bills: [], incomes: [] };
let currentPayBillIndex = null;

/** Initialize on DOM load */
function init() {
  setupTabs();
  updateMonthDisplay();
  loadAllData().then(() => {
    loadBills();
    loadManageBills();
    loadManagePaychecks();
    renderCalendar();
    loadCreditCardsForAnalysis();
  });
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

  // Bill Form
  document.getElementById('bill-form').addEventListener('submit', handleBillForm);
  // Show/hide CC fields if "Credit Card" is selected
  document.getElementById('bill-category').addEventListener('change', (e)=>{
    if (e.target.value === "Credit Card") {
      document.getElementById('cc-extra-fields').classList.remove('hidden');
      document.getElementById('non-cc-amount-field').classList.add('hidden');
    } else {
      document.getElementById('cc-extra-fields').classList.add('hidden');
      document.getElementById('non-cc-amount-field').classList.remove('hidden');
    }
  });

  // Paycheck Form
  document.getElementById('paycheck-form').addEventListener('submit', handlePaycheckForm);
  
  // Settings
  document.getElementById('backup-btn').addEventListener('click', async() => {
    const ok = await ipcRenderer.invoke('backup-data');
    alert(ok ? "Backup successful" : "Backup cancelled/failed");
  });
  document.getElementById('restore-btn').addEventListener('click', async() => {
    const ok = await ipcRenderer.invoke('restore-data');
    if (ok) {
      alert("Data restored!");
      loadAllData().then(()=>{
        loadBills();
        loadManageBills();
        loadManagePaychecks();
        renderCalendar();
        loadCreditCardsForAnalysis();
      });
    }
  });
  document.getElementById('reset-btn').addEventListener('click', async()=>{
    if (!confirm("Are you sure you want to reset ALL data?")) return;
    await ipcRenderer.invoke('reset-data');
    globalData = { bills: [], incomes: [] };
    loadBills();
    loadManageBills();
    loadManagePaychecks();
    renderCalendar();
    loadCreditCardsForAnalysis();
  });

  // Snowball
  document.getElementById('snowball-extra').addEventListener('input', (e)=>{
    document.getElementById('snowball-extra-value').textContent = "$"+ e.target.value;
  });
  document.getElementById('snowball-calc-btn').addEventListener('click', handleSnowballCalc);
}

/** Load data from main */
async function loadAllData() {
  const data = await ipcRenderer.invoke('get-data');
  if (!data.bills) data.bills = [];
  if (!data.incomes) data.incomes = [];
  globalData = data;
}

/** Save data to main */
async function saveData() {
  await ipcRenderer.invoke('save-data', globalData);
}

/** Bill View logic: merges bills + incomes for the current month, sorted by date. */
function loadBills() {
  const items = mergeBillsAndIncomesForMonth(currentMonth, globalData.bills, globalData.incomes);
  const billList = document.getElementById('bill-list');
  billList.innerHTML = '';

  if (!items.length) {
    document.getElementById('bill-summary').innerHTML = `
      <p><strong>This Month’s Totals:</strong><br/>
      Paid: $0.00 | Remaining: $0.00</p>`;
    const div = document.createElement('div');
    div.className = 'p-3 bg-gray-700 rounded';
    div.textContent = 'No bills or incomes found this month.';
    billList.appendChild(div);
    return;
  }

  items.sort((a,b)=>a.dateObj - b.dateObj);

  let totalDue = 0;
  let totalPaid = 0; // if partial pay logic, you'd track that

  items.forEach(item => {
    if (item.type === "Bill") {
      totalDue += item.amount;
    }

    const row = document.createElement('div');
    row.className = 'p-3 bg-gray-700 border border-gray-600 rounded flex justify-between items-center';

    const dateStr = formatDate(item.dateObj);
    let inner = `<div>
      <div class="font-semibold">${item.name}</div>
      <div class="text-sm">Date: ${dateStr}</div>`;
    if (item.type === "Bill") {
      inner += `<div class="text-sm mt-1 text-red-300">Bill: $${item.amount.toFixed(2)}</div>`;
    } else {
      inner += `<div class="text-sm mt-1 text-green-300">Income: $${item.amount.toFixed(2)}</div>`;
    }
    inner += `</div>`;
    row.innerHTML = inner;

    if (item.type === "Bill") {
      // Show Pay button
      const payBtn = document.createElement('button');
      payBtn.className = 'px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded';
      payBtn.textContent = 'Pay';
      payBtn.onclick = () => showPayDrawer(item.billIndex);
      row.appendChild(payBtn);
    }
    billList.appendChild(row);
  });

  const totalLeft = totalDue - totalPaid;
  document.getElementById('bill-summary').innerHTML = `
    <p><strong>This Month’s Totals:</strong><br/>
    Paid: $${totalPaid.toFixed(2)} | Remaining: $${totalLeft.toFixed(2)}</p>`;
}

/** Merges bills & incomes for a specific month, returning an array of items { type, name, amount, dateObj, billIndex? }. */
function mergeBillsAndIncomesForMonth(curMonth, bills, incomes) {
  const year = curMonth.getFullYear();
  const m = curMonth.getMonth();
  let arr = [];

  // Bills
  bills.forEach((bill, idx) => {
    const d = parseDate(bill.dueDate);
    if (d && d.getFullYear()===year && d.getMonth()===m) {
      // For normal bills, we assume .amount. For CC, maybe .balance or .minPayment?
      // If it's CC, you might show minPayment as the "bill" or up to user. We'll do .amount as fallback.
      let amt = parseFloat(bill.amount) || 0;
      if (bill.category === "Credit Card" && bill.minPayment) {
        amt = parseFloat(bill.minPayment);
      }
      arr.push({
        type: "Bill",
        dateObj: d,
        name: bill.name,
        amount: amt,
        billIndex: idx
      });
    }
  });

  // Incomes
  incomes.forEach(inc => {
    const payDates = computePayDatesForMonth(inc, year, m);
    payDates.forEach(pd => {
      arr.push({
        type: "Income",
        dateObj: pd,
        name: inc.name,
        amount: parseFloat(inc.amount) || 0
      });
    });
  });

  return arr;
}

/** Manage Bills form / list */
function loadManageBills() {
  const list = document.getElementById('manage-bill-list');
  list.innerHTML = '';
  const { bills } = globalData;
  if (!bills.length) {
    const div = document.createElement('div');
    div.className='p-3 bg-gray-700 rounded';
    div.textContent='No bills yet.';
    list.appendChild(div);
    return;
  }
  bills.forEach((b, idx)=>{
    const row = document.createElement('div');
    row.className='p-3 bg-gray-700 border border-gray-600 rounded flex justify-between items-center';

    let dd = '';
    const d = parseDate(b.dueDate);
    if (d) dd = formatDate(d);
    
    let text= `<div>
      <div class="font-semibold">${b.name}</div>
      <div class="text-sm">Category: ${b.category}, Due: ${dd || 'N/A'}</div>`;
    if (b.category==="Credit Card") {
      text += `<div class="text-sm">Balance: $${b.balance||0}, MinPay: $${b.minPayment||0}, APR: ${b.apr||0}%</div>`;
    } else {
      text += `<div class="text-sm">Amount: $${b.amount||0}</div>`;
    }
    text += `</div>`;
    row.innerHTML=text;

    const btnGroup=document.createElement('div');
    btnGroup.className='space-x-2';
    const editBtn=document.createElement('button');
    editBtn.className='px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded';
    editBtn.textContent='Edit';
    editBtn.onclick=()=>editBill(idx);
    btnGroup.appendChild(editBtn);
    const delBtn=document.createElement('button');
    delBtn.className='px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded';
    delBtn.textContent='Delete';
    delBtn.onclick=()=>deleteBill(idx);
    btnGroup.appendChild(delBtn);
    row.appendChild(btnGroup);
    list.appendChild(row);
  });
}

/** When saving a Bill, if category=Credit Card, we store advanced fields. Otherwise, store an .amount for normal bills. */
function handleBillForm(e) {
  e.preventDefault();
  const id = document.getElementById('bill-id').value;
  const name = document.getElementById('bill-name').value.trim();
  const category = document.getElementById('bill-category').value;
  const dueDate = document.getElementById('bill-due-date').value;
  if(!name) {alert("Enter a bill name.");return;}

  // Build the Bill object
  let newBill = {
    name, category, dueDate
  };
  if(category==="Credit Card") {
    newBill.balance     = parseFloat(document.getElementById('cc-balance').value)||0;
    newBill.minPayment  = parseFloat(document.getElementById('cc-min-payment').value)||0;
    newBill.apr         = parseFloat(document.getElementById('cc-apr').value)||0;
    newBill.creditLimit = parseFloat(document.getElementById('cc-limit').value)||0;
    newBill.amount      = 0; // we won't use .amount for CC bills
  } else {
    newBill.amount = parseFloat(document.getElementById('bill-amount').value)||0;
    // Clear CC fields
    newBill.balance=0;
    newBill.minPayment=0;
    newBill.apr=0;
    newBill.creditLimit=0;
  }

  if(id==="") {
    globalData.bills.push(newBill);
  } else {
    globalData.bills[parseInt(id,10)] = newBill;
  }
  saveData().then(()=>{
    document.getElementById('bill-form').reset();
    document.getElementById('bill-id').value="";
    // Hide cc fields again
    document.getElementById('cc-extra-fields').classList.add('hidden');
    document.getElementById('non-cc-amount-field').classList.remove('hidden');
    loadManageBills();
    loadBills();
    renderCalendar();
    loadCreditCardsForAnalysis();
  });
}
function editBill(idx) {
  const b=globalData.bills[idx];
  document.getElementById('bill-id').value=idx;
  document.getElementById('bill-name').value=b.name;
  document.getElementById('bill-category').value=b.category;
  document.getElementById('bill-due-date').value=b.dueDate||"";
  
  if(b.category==="Credit Card") {
    document.getElementById('cc-extra-fields').classList.remove('hidden');
    document.getElementById('non-cc-amount-field').classList.add('hidden');
    document.getElementById('cc-balance').value=b.balance||0;
    document.getElementById('cc-min-payment').value=b.minPayment||0;
    document.getElementById('cc-apr').value=b.apr||0;
    document.getElementById('cc-limit').value=b.creditLimit||0;
  } else {
    document.getElementById('cc-extra-fields').classList.add('hidden');
    document.getElementById('non-cc-amount-field').classList.remove('hidden');
    document.getElementById('bill-amount').value=b.amount||0;
  }
}
function deleteBill(idx) {
  if(!confirm("Delete this bill?"))return;
  globalData.bills.splice(idx,1);
  saveData().then(()=>{
    loadManageBills();
    loadBills();
    renderCalendar();
    loadCreditCardsForAnalysis();
  });
}

// =============== MANAGE PAYCHECKS ===============
function loadManagePaychecks() {
  const list = document.getElementById('manage-paycheck-list');
  list.innerHTML='';
  if(!globalData.incomes.length) {
    const div=document.createElement('div');
    div.className='p-3 bg-gray-700 rounded';
    div.textContent='No paychecks yet.';
    list.appendChild(div);
    return;
  }
  globalData.incomes.forEach((inc,idx)=>{
    const row=document.createElement('div');
    row.className='p-3 bg-gray-700 border border-gray-600 rounded flex justify-between items-center';
    let info= `<div class="font-semibold">${inc.name}</div>
      <div class="text-sm">
        Freq: ${inc.frequency}, Amount: $${inc.amount||0}
        <br/>Start: ${inc.startDate||'N/A'} 
        <br/>Extra: ${inc.paycheckExtra||''}
      </div>`;
    row.innerHTML=info;

    const btnGroup=document.createElement('div');
    btnGroup.className='space-x-2';

    const editBtn=document.createElement('button');
    editBtn.className='px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded';
    editBtn.textContent='Edit';
    editBtn.onclick=()=>editPaycheck(idx);
    btnGroup.appendChild(editBtn);

    const delBtn=document.createElement('button');
    delBtn.className='px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded';
    delBtn.textContent='Delete';
    delBtn.onclick=()=>deletePaycheck(idx);
    btnGroup.appendChild(delBtn);

    row.appendChild(btnGroup);
    list.appendChild(row);
  });
}
function handlePaycheckForm(e) {
  e.preventDefault();
  const id=document.getElementById('paycheck-id').value;
  const name=document.getElementById('paycheck-name').value.trim();
  const frequency=document.getElementById('paycheck-frequency').value;
  const amount=parseFloat(document.getElementById('paycheck-amount').value)||0;
  const startDate=document.getElementById('paycheck-start').value;
  const paycheckExtra=document.getElementById('paycheck-extra').value||"";

  if(!name){alert("Enter a name for the paycheck.");return;}
  const obj={ name, frequency, amount, startDate, paycheckExtra };

  if(id==="") {
    globalData.incomes.push(obj);
  } else {
    globalData.incomes[parseInt(id,10)] = obj;
  }
  saveData().then(()=>{
    document.getElementById('paycheck-form').reset();
    document.getElementById('paycheck-id').value="";
    loadManagePaychecks();
    loadBills();
    renderCalendar();
  });
}
function editPaycheck(idx){
  const inc=globalData.incomes[idx];
  document.getElementById('paycheck-id').value=idx;
  document.getElementById('paycheck-name').value=inc.name;
  document.getElementById('paycheck-frequency').value=inc.frequency;
  document.getElementById('paycheck-amount').value=inc.amount||0;
  document.getElementById('paycheck-start').value=inc.startDate||"";
  document.getElementById('paycheck-extra').value=inc.paycheckExtra||"";
}
function deletePaycheck(idx){
  if(!confirm("Delete paycheck?"))return;
  globalData.incomes.splice(idx,1);
  saveData().then(()=>{
    loadManagePaychecks();
    loadBills();
    renderCalendar();
  });
}

// =============== CALENDAR ===============
function renderCalendar(){
  const container=document.getElementById('calendar-container');
  if(!container)return;
  container.innerHTML='';

  const year=currentMonth.getFullYear();
  const m=currentMonth.getMonth();
  
  const merged=mergeBillsAndIncomesForMonth(currentMonth, globalData.bills, globalData.incomes);
  // group by day
  const dayMap={};
  merged.forEach(item=>{
    const day=item.dateObj.getDate();
    if(!dayMap[day])dayMap[day]=[];
    dayMap[day].push(item);
  });

  const first=new Date(year,m,1);
  const dayOfWeek=first.getDay();
  const last=new Date(year,m+1,0);
  const daysInMonth=last.getDate();

  let html= `
    <div class="grid grid-cols-7 gap-1 text-center text-xs font-bold">
      <div>Sun</div><div>Mon</div><div>Tue</div>
      <div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
    </div>
    <div class="grid grid-cols-7 gap-1 mt-2">
  `;
  let dayCounter=1-dayOfWeek;
  for(let row=0;row<6;row++){
    for(let col=0;col<7;col++){
      if(dayCounter<1 || dayCounter>daysInMonth){
        html+=`<div class="h-20 p-1 bg-gray-800 text-gray-500 rounded"></div>`;
      } else {
        html+=`<div class="h-20 p-1 bg-gray-700 border border-gray-600 rounded flex flex-col">
          <div class="font-bold text-xs">${dayCounter}</div>`;
        if(dayMap[dayCounter]){
          dayMap[dayCounter].forEach(it=>{
            if(it.type==="Bill") {
              html+=`<div class="text-xs text-red-400">${it.name} ($${it.amount})</div>`;
            } else {
              html+=`<div class="text-xs text-green-400">${it.name} ($${it.amount})</div>`;
            }
          });
        }
        html+=`</div>`;
      }
      dayCounter++;
    }
  }
  html+="</div>";
  container.innerHTML=html;
}

// =============== CREDIT CARD ANALYSIS (Snowball) ===============
function loadCreditCardsForAnalysis(){
  const ccList=document.getElementById('cc-list');
  ccList.innerHTML='';
  // Filter bills with category=Credit Card
  const cards = globalData.bills.filter(b=>b.category==="Credit Card");
  if(!cards.length){
    const div=document.createElement('div');
    div.className='p-3 bg-gray-700 rounded';
    div.textContent='No credit cards found. Add them in Manage Bills (select "Credit Card").';
    ccList.appendChild(div);
    return;
  }
  cards.forEach(c=>{
    const row=document.createElement('div');
    row.className='p-3 bg-gray-700 border border-gray-600 rounded';
    // show name, balance, apr, minPayment
    row.innerHTML=`
      <div class="font-semibold">${c.name}</div>
      <div class="text-sm">
        Balance: $${c.balance||0}, APR: ${c.apr||0}%, Min Payment: $${c.minPayment||0}
      </div>
    `;
    ccList.appendChild(row);
  });
}
function handleSnowballCalc(){
  // gather cards from bills
  const cards = globalData.bills.filter(b=>b.category==="Credit Card").map(b=>({
    name: b.name,
    balance: parseFloat(b.balance)||0,
    apr: parseFloat(b.apr)||0,
    minPayment: parseFloat(b.minPayment)||0
  }));
  if(!cards.length){
    document.getElementById('snowball-result').textContent="No credit cards to analyze.";
    return;
  }
  const extraInput=document.getElementById('snowball-extra').value;
  const extra = parseFloat(extraInput)||0;

  // Sort by ascending balance for classic Snowball
  cards.sort((a,b)=> a.balance - b.balance);
  let totalInterest=0;
  let months=0;
  let allPaid=false;

  while(!allPaid && months<600){ // 50 yrs limit
    months++;
    allPaid=true;
    let leftover=extra;
    for(let c of cards){
      if(c.balance>0.01){
        allPaid=false;
        // 1) interest
        const monthlyRate=c.apr/100/12;
        const interest=c.balance*monthlyRate;
        totalInterest+=interest;
        c.balance+=interest;
        // 2) pay minPayment + leftover (applied to first card)
        let pay=c.minPayment;
        if(leftover>0){
          pay+=leftover;
          leftover=0;
        }
        if(pay>c.balance) pay=c.balance;
        c.balance-=pay;
      }
    }
    if(cards.every(cc=>cc.balance<=0.01)) allPaid=true;
  }
  const resultDiv=document.getElementById('snowball-result');
  if(!allPaid){
    resultDiv.innerHTML=`
      <p>Some cards never paid off with these payments. 
      Possibly minPayment <= interest monthly.</p>`;
  } else {
    resultDiv.innerHTML=`
      <p>All cards paid in <b>${months}</b> months. 
      Total interest paid: <b>$${totalInterest.toFixed(2)}</b></p>
    `;
  }
}

// =============== Payment Drawer ===============
function setupPaymentDrawer(){
  document.getElementById('pay-cancel-btn').onclick=hidePayDrawer;
  document.getElementById('pay-confirm-btn').onclick=()=>{
    const amtStr=document.getElementById('pay-amount').value;
    const amt=parseFloat(amtStr);
    if(isNaN(amt)||amt<=0){
      alert("Enter valid payment amount.");
      return;
    }
    doPayBill(currentPayBillIndex,amt);
    hidePayDrawer();
  };
}
function showPayDrawer(billIndex){
  currentPayBillIndex=billIndex;
  document.getElementById('pay-amount').value='';
  document.getElementById('pay-drawer').classList.remove('translate-x-full');
}
function hidePayDrawer(){
  document.getElementById('pay-drawer').classList.add('translate-x-full');
}
function doPayBill(billIndex, amount){
  // Simplified logic: If it's a CC with .balance, reduce it. Otherwise, up to you.
  const b=globalData.bills[billIndex];
  if(!b){alert("Bill not found");return;}
  if(b.category==="Credit Card"){
    b.balance=Math.max(0, (parseFloat(b.balance)||0)-amount);
    alert(`Paid $${amount} on credit card '${b.name}'. New balance: $${b.balance.toFixed(2)}.`);
  } else {
    // For normal bills, we might just say "Paid"
    alert(`Paid $${amount} on '${b.name}'.`);
  }
  saveData().then(()=>{
    loadBills();
    renderCalendar();
    loadCreditCardsForAnalysis();
  });
}

// =============== HELPER FUNCS ===============
function parseDate(str){
  if(!str) return null;
  const parts=str.split('-');
  if(parts.length<3)return null;
  const [y,m,d]=parts.map(Number);
  return new Date(y,m-1,d);
}
function formatDate(d){
  if(!(d instanceof Date)) return '';
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');
  const yyyy=d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}
/** Return an array of Date objects for the paychecks that fall into (year, month). */
function computePayDatesForMonth(inc, year, monthIdx){
  const results=[];
  const freq=inc.frequency||"OneOff";
  switch(freq){
    case "OneOff": {
      // interpret inc.paycheckExtra as the date
      const d=parseDate(inc.paycheckExtra);
      if(d && d.getFullYear()===year && d.getMonth()===monthIdx){
        results.push(d);
      }
      break;
    }
    case "SemiMonthly": {
      // parse "7,22"
      if(inc.paycheckExtra){
        const days=inc.paycheckExtra.split(',');
        days.forEach(ds=>{
          const day=Number(ds.trim());
          if(day>0){
            const d=new Date(year, monthIdx, day);
            results.push(adjustWeekend(d));
          }
        });
      }
      break;
    }
    case "BiWeekly": {
      if(inc.startDate){
        let start=parseDate(inc.startDate);
        const end=endOfMonth(year, monthIdx);
        while(start<=end){
          if(start.getFullYear()===year && start.getMonth()===monthIdx){
            results.push(new Date(start));
          }
          start=new Date(start.getTime()+14*86400000);
        }
      }
      break;
    }
    case "Weekly": {
      if(inc.startDate){
        let s=parseDate(inc.startDate);
        const end=endOfMonth(year, monthIdx);
        while(s<=end){
          if(s.getFullYear()===year && s.getMonth()===monthIdx){
            results.push(new Date(s));
          }
          s=new Date(s.getTime()+7*86400000);
        }
      }
      break;
    }
    case "Monthly": {
      if(inc.startDate){
        const d=parseDate(inc.startDate);
        // if the day is the 10th, for example
        const day=d.getDate();
        const monthly=new Date(year, monthIdx, day);
        if(monthly.getMonth()===monthIdx){
          results.push(adjustWeekend(monthly));
        }
      }
      break;
    }
  }
  return results;
}
function adjustWeekend(d){
  const day=d.getDay();
  if(day===0){ // Sunday
    d.setDate(d.getDate()-2);
  } else if(day===6){ // Saturday
    d.setDate(d.getDate()-1);
  }
  return d;
}
function endOfMonth(y,m){
  return new Date(y,m+1,0);
}

// Tab logic
function setupTabs() {
  const btns=document.querySelectorAll('.tab-btn');
  const sections=document.querySelectorAll('.tab-content');
  btns.forEach(btn=>{
    btn.addEventListener('click',()=>{
      btns.forEach(b=>{
        b.classList.remove('bg-blue-600','text-white');
        b.classList.add('bg-gray-700','text-gray-200');
      });
      sections.forEach(sec=>sec.classList.add('hidden'));
      btn.classList.remove('bg-gray-700','text-gray-200');
      btn.classList.add('bg-blue-600','text-white');
      const tabId=btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.remove('hidden');
      if(tabId==='calendar-view'){
        renderCalendar();
      } else if(tabId==='credit-analysis'){
        loadCreditCardsForAnalysis();
      }
    });
  });
}
function updateMonthDisplay() {
  const opt={ year:'numeric', month:'long'};
  document.getElementById('current-month').textContent =
    currentMonth.toLocaleDateString('en-US', opt);
}

// Start
document.addEventListener('DOMContentLoaded', init);