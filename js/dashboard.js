/* ==========================================================================
   Dashboard view
   ========================================================================== */
(function (global) {
  'use strict';

  let currentPeriod = 'today';
  let customStart = null, customEnd = null;

  function getRange() {
    switch (currentPeriod) {
      case 'today': return { start: U.todayStart(), end: U.todayStart()+U.MS_DAY, label: 'Today' };
      case 'week': return { start: U.startOfWeek(), end: U.todayStart()+U.MS_DAY, label: 'This week' };
      case 'month': return { start: U.startOfMonth(), end: U.todayStart()+U.MS_DAY, label: 'This month' };
      case 'year': return { start: U.startOfYear(), end: U.todayStart()+U.MS_DAY, label: 'This year' };
      case 'custom': return { start: customStart, end: customEnd+U.MS_DAY, label: 'Custom' };
      default: return { start: U.todayStart(), end: U.todayStart()+U.MS_DAY, label: 'Today' };
    }
  }

  function computeMetrics() {
    const {start,end} = getRange();
    const sales = AppState.state.sales.filter(s => s.date>=start && s.date<end && s.status!=='void');
    const revenue = U.sum(sales,'netSales');
    const cogs = U.sum(sales,'costOfGoods');
    const grossProfit = revenue - cogs;
    const expenses = AppState.state.expenses.filter(e => e.date>=start && e.date<end && !e.reversed).reduce((a,e)=>a+(Number(e.amount)||0),0);
    const netProfit = grossProfit - expenses;
    const txCount = sales.length;
    const products = AppState.state.products.filter(p => p.status !== 'archived');
    const inventoryValue = products.reduce((a,p)=>a+(Number(p.purchaseCost)||0)*(Number(p.stock)||0),0);
    const totalUnits = products.reduce((a,p)=>a+(Number(p.stock)||0),0);
    const totalProducts = products.length;
    const lowStock = products.filter(p => (p.stock||0)>0 && (p.stock||0)<=(p.minStock||0));
    const outOfStock = products.filter(p => (p.stock||0)===0);
    const productSales = new Map();
    sales.forEach(s => s.items.forEach(i => {
      const cur = productSales.get(i.productId) || { name:i.name, qty:0, revenue:0 };
      cur.qty += i.qty; cur.revenue += i.lineTotal;
      productSales.set(i.productId, cur);
    }));
    const best = Array.from(productSales.values()).sort((a,b)=>b.qty-a.qty)[0] || null;
    return { revenue,cogs,grossProfit,expenses,netProfit,txCount,inventoryValue,totalUnits,totalProducts,lowStock,outOfStock,sales,best };
  }

  function buildSeries() {
    const {start,end} = getRange();
    const days = Math.max(1, Math.ceil((end-start)/U.MS_DAY));
    const labels=[], revData=[], profitData=[];
    const sales = AppState.state.sales.filter(s=>s.status!=='void');
    const exps = AppState.state.expenses.filter(e=>!e.reversed);
    for (let i=0;i<days;i++){
      const dStart=start+i*U.MS_DAY, dEnd=dStart+U.MS_DAY;
      labels.push(days>45?new Date(dStart).toLocaleDateString('en-PH',{month:'short',day:'numeric'}):U.formatDate(dStart,'short'));
      const dSales = sales.filter(s=>s.date>=dStart&&s.date<dEnd);
      const dExp = exps.filter(e=>e.date>=dStart&&e.date<dEnd).reduce((a,e)=>a+(Number(e.amount)||0),0);
      const r = U.sum(dSales,'netSales');
      const gp = U.sum(dSales,'grossProfit');
      revData.push(r); profitData.push(gp - dExp);
    }
    return { labels, revData, profitData };
  }

  function render() {
    const container = U.$('#view-container');
    U.clear(container);
    const m = computeMetrics();
    const recentTx = [...m.sales].sort((a,b)=>b.date-a.date).slice(0,6);
    const hasAnyProducts = m.totalProducts > 0;
    const hasAnySales = m.sales.length > 0;

    container.appendChild(U.el('div', { class:'stats-grid' },
      statCard('Sales Revenue', U.currency(m.revenue), m.txCount+' transaction'+(m.txCount===1?'':'s'), 'accent'),
      statCard('Gross Profit', U.currency(m.grossProfit), m.revenue?U.percent(m.grossProfit/m.revenue)+' margin':'No sales yet', 'accent'),
      statCard('Net Profit (est.)', U.currency(m.netProfit), 'After expenses', m.netProfit<0?'danger':''),
      statCard('Inventory Value', U.currency(m.inventoryValue), m.totalUnits+' units in stock'),
      statCard('Products', String(m.totalProducts), hasAnyProducts?(m.totalUnits+' units'):'No products yet'),
      statCard('Alerts', String(m.lowStock.length+m.outOfStock.length), m.outOfStock.length+' out · '+m.lowStock.length+' low', (m.lowStock.length+m.outOfStock.length)>0?'warn':''),
    ));

    const series = buildSeries();
    const section = U.el('div',{class:'section'});
    section.appendChild(U.el('div',{class:'section-header'},
      U.el('div',{},
        U.el('h3',{class:'section-title'},'Sales Performance'),
        U.el('p',{class:'section-sub'},getRange().label+(hasAnySales?' · Daily revenue & profit':' · No sales in this period yet'))),
      U.el('div',{class:'chip-row'},
        periodChip('Today','today'), periodChip('Week','week'), periodChip('Month','month'),
        periodChip('Year','year'),
        U.el('button',{class:'chip'+(currentPeriod==='custom'?' active':''),onclick:showCustomRange},'Custom')
      )
    ));
    const chartWrap = U.el('div',{class:'chart-wrap'});
    const canvas = U.el('canvas');
    chartWrap.appendChild(canvas);
    section.appendChild(chartWrap);
    container.appendChild(section);
    setTimeout(()=>{
      Charts.drawLineChart(canvas, { labels:series.labels, datasets:[
        { label:'Revenue', data:series.revData.map(v=>v||0), color:'#35A879' },
        { label:'Net Profit', data:series.profitData.map(v=>v||0), color:'#153F32' }
      ]});
    },30);

    const two = U.el('div',{class:'two-col'});
    const recentSec = U.el('div',{class:'section'});
    recentSec.appendChild(U.el('div',{class:'section-header'},
      U.el('div',{},
        U.el('h3',{class:'section-title'},'Recent Transactions'),
        m.best?U.el('p',{class:'section-sub'},'Best seller: '+m.best.name+' ('+m.best.qty+' sold)'):null
      ),
      hasAnySales?U.el('button',{class:'btn btn-ghost btn-small',onclick:()=>App.setView('transactions')},'View all'):null
    ));
    if (!hasAnySales) {
      recentSec.appendChild(U.el('div',{class:'empty-state'},U.svgIcon('cart',48),
        U.el('h3',{},hasAnyProducts?'No sales yet today':'No products yet'),
        U.el('p',{},hasAnyProducts?'Open the cashier to record your first sale.':'Add products to inventory to start selling.'),
        hasAnyProducts
          ?U.el('button',{class:'btn btn-primary',onclick:()=>App.setView('cashier')},'Open Cashier')
          :U.el('button',{class:'btn btn-primary',onclick:()=>Inventory.openEditor()},'Add Your First Product')
      ));
    } else {
      const tw=U.el('div',{class:'table-wrap'});
      const tbl=U.el('table',{class:'data-table'});
      tbl.innerHTML=`<thead><tr><th>Receipt</th><th>Time</th><th>Items</th><th class="num">Total</th><th>Method</th></tr></thead><tbody></tbody>`;
      recentTx.forEach(s=>{
        const tr=U.el('tr');
        tr.innerHTML=`<td><strong>${s.transactionNo}</strong></td><td>${U.formatDate(s.date,'time')}</td><td>${s.items.reduce((a,i)=>a+i.qty,0)} items</td><td class="num"><strong>${U.currency(s.netSales)}</strong></td><td><span class="badge badge-info">${(s.paymentMethod||'cash').toUpperCase()}</span></td>`;
        tr.style.cursor='pointer'; tr.onclick=()=>App.showTransaction(s.id);
        tbl.querySelector('tbody').appendChild(tr);
      });
      tw.appendChild(tbl); recentSec.appendChild(tw);
    }
    two.appendChild(recentSec);

    const quick = U.el('div',{class:'section'});
    quick.appendChild(U.el('h3',{class:'section-title'},'Quick Actions'));
    const qgrid = U.el('div',{style:'display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:12px'});
    qgrid.appendChild(quickBtn('Open Cashier','cart',()=>App.setView('cashier'),true));
    qgrid.appendChild(quickBtn('Add Product','plus',()=>Inventory.openEditor()));
    qgrid.appendChild(quickBtn('Restock','upload',()=>App.setView('inventory')));
    qgrid.appendChild(quickBtn('Record Expense','minus',()=>Expenses.openEditor()));
    qgrid.appendChild(quickBtn('View Reports','chart',()=>App.setView('reports')));
    qgrid.appendChild(quickBtn('Backup Data','download',()=>Settings.backupNow()));
    quick.appendChild(qgrid);

    if (m.outOfStock.length || m.lowStock.length) {
      const a = U.el('div',{class:'mt-16'});
      a.appendChild(U.el('h4',{style:'margin:0 0 8px;font-size:14px;color:var(--warning)'},'⚠ Inventory Alerts'));
      if (m.outOfStock.length) a.appendChild(U.el('p',{class:'muted',style:'margin:4px 0;font-size:13px'},m.outOfStock.length+' out-of-stock: '+m.outOfStock.slice(0,4).map(p=>p.name).join(', ')+(m.outOfStock.length>4?'…':'')));
      if (m.lowStock.length) a.appendChild(U.el('p',{class:'muted',style:'margin:4px 0;font-size:13px'},m.lowStock.length+' low-stock: '+m.lowStock.slice(0,4).map(p=>p.name).join(', ')+(m.lowStock.length>4?'…':'')));
      quick.appendChild(a);
    }
    if (!hasAnyProducts) {
      quick.appendChild(U.el('div',{class:'mt-16 glass',style:'padding:14px;background:rgba(53,168,121,0.08);border-color:rgba(53,168,121,0.2)'},
        U.el('h4',{style:'margin:0 0 4px;font-size:14px;color:var(--emerald-deep)'},'Welcome to Janets Karenderya'),
        U.el('p',{class:'muted',style:'margin:0;font-size:13px'},'Start by adding your products with their purchase cost and selling price. Then use the Cashier to record sales — inventory, revenue, and profit will update automatically.')
      ));
    }
    two.appendChild(quick);
    container.appendChild(two);
  }

  function statCard(l,v,s,a){return U.el('div',{class:'stat-card '+(a||'')},U.el('div',{class:'stat-label'},l),U.el('div',{class:'stat-value'},v),U.el('div',{class:'stat-sub'},s));}
  function periodChip(label,key){return U.el('button',{class:'chip'+(currentPeriod===key?' active':''),onclick:()=>{currentPeriod=key;render();}},label);}
  function quickBtn(label,icon,onClick,primary){
    const b=U.el('button',{class:'btn '+(primary?'btn-primary':'btn-ghost'),style:'flex-direction:column;padding:18px 10px;gap:6px;font-size:13px',onclick:onClick});
    b.appendChild(U.svgIcon(icon,22)); b.appendChild(U.el('span',{},label)); return b;
  }
  function showCustomRange() {
    const body=U.el('div',{},
      U.el('div',{class:'form-group'},U.el('label',{class:'form-label'},'Start date'),U.el('input',{type:'date',id:'cr-start',class:'form-input',value:U.dateKey(U.startOfMonth())})),
      U.el('div',{class:'form-group'},U.el('label',{class:'form-label'},'End date'),U.el('input',{type:'date',id:'cr-end',class:'form-input',value:U.dateKey(Date.now())}))
    );
    U.openModal({title:'Custom Date Range',body,footer:[
      U.el('button',{class:'btn btn-ghost',onclick:()=>document.querySelector('#modal-root .modal-close').click()},'Cancel'),
      U.el('button',{class:'btn btn-primary',onclick:()=>{
        const s=U.$('#cr-start').value,e=U.$('#cr-end').value;
        if(!s||!e)return U.toast('Select start and end','error');
        customStart=new Date(s+'T00:00:00').getTime(); customEnd=new Date(e+'T00:00:00').getTime();
        if(customEnd<customStart)return U.toast('End must be after start','error');
        currentPeriod='custom'; document.querySelector('#modal-root .modal-close').click(); render();
      }},'Apply')
    ]});
  }

  global.Dashboard = { render };
})(window);
