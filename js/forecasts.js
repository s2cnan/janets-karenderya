/* ==========================================================================
   Profit Analytics & Forecasting
   ========================================================================== */
(function (global) {
  'use strict';

  let horizon = 7; // 7, 30, 365

  function render() {
    const container = U.$('#view-container');
    U.clear(container);

    // Header chip row
    container.appendChild(U.el('div', { class: 'section' },
      U.el('div', { class: 'section-header' },
        U.el('div', {},
          U.el('h3', { class: 'section-title' }, 'Profit & Forecasts'),
          U.el('p', { class: 'section-sub' }, 'Actuals from your sales history; projections are estimates based on trends')
        ),
        U.el('div', { class: 'chip-row' },
          horizonChip('Next 7 Days', 7),
          horizonChip('Next 30 Days', 30),
          horizonChip('Next 12 Months', 365),
        )
      )
    ));

    const forecast = computeForecast(horizon);

    // Summary cards
    const isLong = horizon === 365;
    container.appendChild(U.el('div', { class: 'stats-grid' },
      makeCard('Projected Revenue', U.currency(forecast.totalRevenue), 'Estimated sales', 'accent'),
      makeCard('Projected COGS', U.currency(forecast.totalCogs), 'Cost of goods'),
      makeCard('Gross Profit', U.currency(forecast.totalGross), U.percent(forecast.totalRevenue ? forecast.totalGross / forecast.totalRevenue : 0) + ' margin', 'accent'),
      makeCard('Operating Expenses', U.currency(forecast.totalExpenses), 'Projected costs'),
      makeCard('Net Profit', U.currency(forecast.totalNet), forecast.totalNet >= 0 ? 'Estimated' : 'Projected loss', forecast.totalNet >= 0 ? '' : 'danger'),
    ));

    // Chart
    const sec = U.el('div', { class: 'section' });
    sec.appendChild(U.el('div', { class: 'section-header' },
      U.el('div', {},
        U.el('h3', { class: 'section-title' }, 'Projected Daily Performance'),
        U.el('p', { class: 'section-sub' }, forecast.disclaimer)
      )
    ));
    const cw = U.el('div', { class: 'chart-wrap' });
    const canvas = U.el('canvas');
    cw.appendChild(canvas);
    sec.appendChild(cw);
    container.appendChild(sec);

    setTimeout(() => {
      if (isLong) renderMonthlyChart(canvas, forecast);
      else Charts.drawBarChart(canvas, {
        labels: forecast.labels,
        datasets: [
          { label: 'Revenue', data: forecast.revenueData, color: '#35A879' },
          { label: 'Expenses', data: forecast.expenseData, color: '#D64545' },
          { label: 'Net Profit', data: forecast.netData, color: '#153F32' },
        ]
      });
    }, 30);

    // Actual vs forecast note + historical summary
    const histSec = U.el('div', { class: 'section' });
    histSec.appendChild(U.el('h3', { class: 'section-title' }, 'Historical Performance'));
    const h = historicalSummary();
    histSec.appendChild(U.el('div', { class: 'stats-grid', style: { marginTop: '12px' } },
      makeCard('Last 7 days', U.currency(h.last7.rev), U.currency(h.last7.net) + ' net', h.last7.net >= 0 ? '' : 'danger'),
      makeCard('Last 30 days', U.currency(h.last30.rev), U.currency(h.last30.net) + ' net', h.last30.net >= 0 ? '' : 'danger'),
      makeCard('Last 90 days', U.currency(h.last90.rev), U.currency(h.last90.net) + ' net', h.last90.net >= 0 ? '' : 'danger'),
      makeCard('All-time', U.currency(h.all.rev), U.currency(h.all.net) + ' net', h.all.net >= 0 ? '' : 'danger'),
    ));
    histSec.appendChild(U.el('p', { class: 'form-hint', style: { marginTop: '8px' } },
      'Methodology: Forecasts use your average daily revenue over the past 30 days (or all history if less), adjusted by your configured growth rate and seasonality multiplier. COGS is estimated from historical gross margin. Expenses are projected from your average daily operating expenses. Forecasts are estimates only.'
    ));
    container.appendChild(histSec);
  }

  function horizonChip(label, days) {
    return U.el('button', {
      class: 'chip' + (horizon === days ? ' active' : ''),
      onclick: () => { horizon = days; render(); }
    }, label);
  }

  function makeCard(l, v, s, a) {
    return U.el('div', { class: 'stat-card ' + (a||'') },
      U.el('div', { class: 'stat-label' }, l),
      U.el('div', { class: 'stat-value' }, v),
      U.el('div', { class: 'stat-sub' }, s)
    );
  }

  function getDailyHistory(days) {
    const start = U.todayStart() - (days - 1) * U.MS_DAY;
    const end = U.todayStart() + U.MS_DAY;
    const sales = AppState.state.sales.filter(s => s.date >= start && s.date < end && s.status !== 'void');
    const expenses = AppState.state.expenses.filter(e => e.date >= start && e.date < end && !e.reversed);
    const arr = [];
    for (let i = 0; i < days; i++) {
      const ds = start + i * U.MS_DAY;
      const de = ds + U.MS_DAY;
      const dSales = sales.filter(s => s.date >= ds && s.date < de);
      const dExp = expenses.filter(e => e.date >= ds && e.date < de).reduce((a,e)=>a+(Number(e.amount)||0),0);
      const rev = U.sum(dSales, 'netSales');
      const cogs = U.sum(dSales, 'costOfGoods');
      arr.push({ start: ds, rev, cogs, gp: rev - cogs, exp: dExp, net: rev - cogs - dExp, count: dSales.length });
    }
    return arr;
  }

  function historicalSummary() {
    const s7 = getDailyHistory(7), s30 = getDailyHistory(30), s90 = getDailyHistory(90), sAll = allTime();
    const sum = (arr, key) => arr.reduce((a,b)=>a+b[key],0);
    return {
      last7: { rev: sum(s7,'rev'), net: sum(s7,'net') },
      last30: { rev: sum(s30,'rev'), net: sum(s30,'net') },
      last90: { rev: sum(s90,'rev'), net: sum(s90,'net') },
      all: sAll,
    };
  }

  function allTime() {
    const sales = AppState.state.sales.filter(s => s.status !== 'void');
    const exps = AppState.state.expenses.filter(e => !e.reversed);
    const rev = U.sum(sales, 'netSales');
    const cogs = U.sum(sales, 'costOfGoods');
    const exp = exps.reduce((a,e)=>a+(Number(e.amount)||0),0);
    return { rev, net: rev - cogs - exp };
  }

  function computeForecast(days) {
    // Use last 30 days as baseline; if less data, use what we have
    const history = getDailyHistory(30);
    const hasData = history.some(h => h.rev > 0);
    const daysWithData = history.filter(h => h.rev > 0).length;
    const disclaimer = !hasData ? 'Preliminary estimate — no sales history recorded yet.' :
      daysWithData < 7 ? `Preliminary estimate — based on ${daysWithData} day(s) of data.` :
      'Based on trailing 30-day performance.';

    const growth = Number(AppState.state.settings.forecastGrowth) || 0.05; // monthly default 5%
    const seasonality = Number(AppState.state.settings.seasonality) || 1.0;

    // Baseline daily revenue from days with data (or active days), fallback 0
    const activeDays = history.filter(h => h.rev > 0);
    const baseRevenue = activeDays.length ? activeDays.reduce((a,b)=>a+b.rev,0) / activeDays.length : 0;
    const baseCogsPct = activeDays.length ? activeDays.reduce((a,b)=>a+b.cogs,0) / Math.max(1, activeDays.reduce((a,b)=>a+b.rev,0)) : 0.5;
    const avgDailyExp = history.reduce((a,b)=>a+b.exp,0) / Math.max(1, history.length);

    const labels = [];
    const revenueData = [];
    const cogsData = [];
    const expenseData = [];
    const grossData = [];
    const netData = [];

    let totalRevenue = 0, totalCogs = 0, totalExpenses = 0, totalGross = 0, totalNet = 0;
    const dailyGrowth = Math.pow(1 + growth, 1/30);

    for (let i = 1; i <= days; i++) {
      const d = U.todayStart() + i * U.MS_DAY;
      const dDate = new Date(d);
      const dow = dDate.getDay();
      const weekendFactor = (dow === 0 || dow === 6) ? 1.15 : 1.0; // mild weekend lift
      const growthFactor = Math.pow(dailyGrowth, i);
      let rev = baseRevenue * seasonality * weekendFactor * growthFactor;
      let cogs = rev * baseCogsPct;
      // Expenses: allocate known recurring expenses evenly + daily avg
      let exp = avgDailyExp;
      // If monthly horizon, spike on day 1 / 15 for rent/utilities pattern if they exist
      if (days >= 30 && days < 365) {
        if (dDate.getDate() === 1 || dDate.getDate() === 15) exp = exp * 1.5 + (baseRevenue * 0.1);
      }
      let gross = rev - cogs;
      let net = gross - exp;
      labels.push(days === 365 ? dDate.toLocaleDateString('en-PH', { month: 'short' }) : U.formatDate(d, 'short'));
      revenueData.push(Math.round(rev));
      cogsData.push(Math.round(cogs));
      expenseData.push(Math.round(exp));
      grossData.push(Math.round(gross));
      netData.push(Math.round(net));
      totalRevenue += rev; totalCogs += cogs; totalExpenses += exp; totalGross += gross; totalNet += net;
    }

    // For 12-month forecast aggregate per month
    if (days === 365) {
      return monthlyAggregate(labels, revenueData, cogsData, expenseData, grossData, netData, disclaimer);
    }

    return {
      labels, revenueData, cogsData, expenseData, grossData, netData,
      totalRevenue, totalCogs, totalExpenses, totalGross, totalNet,
      disclaimer
    };
  }

  function monthlyAggregate(labels, revenueData, cogsData, expenseData, grossData, netData, disclaimer) {
    // labels here are day labels (365 entries); aggregate by month label
    const map = new Map();
    for (let i = 0; i < revenueData.length; i++) {
      const mKey = labels[i];
      if (!map.has(mKey)) map.set(mKey, { rev: 0, cogs: 0, exp: 0, gross: 0, net: 0 });
      const e = map.get(mKey);
      e.rev += revenueData[i];
      e.cogs += cogsData[i];
      e.exp += expenseData[i];
      e.gross += grossData[i];
      e.net += netData[i];
    }
    const out = { labels: [], revenueData: [], cogsData: [], expenseData: [], grossData: [], netData: [], disclaimer, isMonthly: true };
    let totalRevenue = 0, totalCogs = 0, totalExpenses = 0, totalGross = 0, totalNet = 0;
    // Preserve chronological order starting from next month
    const now = new Date();
    const ordered = [];
    for (let i = 1; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const k = d.toLocaleDateString('en-PH', { month: 'short' });
      if (map.has(k)) ordered.push({ key: k, v: map.get(k) });
    }
    ordered.forEach(({ key, v }) => {
      out.labels.push(key);
      out.revenueData.push(Math.round(v.rev));
      out.cogsData.push(Math.round(v.cogs));
      out.expenseData.push(Math.round(v.exp));
      out.grossData.push(Math.round(v.gross));
      out.netData.push(Math.round(v.net));
      totalRevenue += v.rev; totalCogs += v.cogs; totalExpenses += v.exp; totalGross += v.gross; totalNet += v.net;
    });
    Object.assign(out, { totalRevenue, totalCogs, totalExpenses, totalGross, totalNet });
    return out;
  }

  function renderMonthlyChart(canvas, f) {
    Charts.drawBarChart(canvas, {
      labels: f.labels,
      datasets: [
        { label: 'Revenue', data: f.revenueData, color: '#35A879' },
        { label: 'Expenses', data: f.expenseData, color: '#D64545' },
        { label: 'Net Profit', data: f.netData, color: '#153F32' },
      ]
    });
  }

  global.Forecasts = { render };
})(window);
