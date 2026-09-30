const state = { geo: null, records: [], selected: null };
const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat('en-US');
const money = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits: 0}).format(n);
const compactMoney = (n) => n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : money(n);
const metricLabel = {exemptions: 'Individuals represented', returns: 'Tax returns', agi_usd: 'Aggregate AGI'};
const metricShort = {exemptions: 'Individuals', returns: 'Returns', agi_usd: 'AGI'};
const valueText = (n, metric) => metric === 'agi_usd' ? compactMoney(n) : fmt.format(n);
const exactText = (n, metric) => metric === 'agi_usd' ? money(n) : fmt.format(n);
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function initControls() {
  for (const origin of state.geo.origins) $('origin').add(new Option(origin.name, origin.name));
  for (const region of [...new Set(state.geo.destinations.map(d => d.region))]) $('region').add(new Option(region, region));
  const query = new URLSearchParams(location.search);
  for (const id of ['origin', 'metric', 'region']) {
    const value = query.get(id);
    if (value && [...$(id).options].some(option => option.value === value)) $(id).value = value;
    $(id).addEventListener('change', () => { state.selected = null; render(); });
  }
}

function render() {
  const origin = $('origin').value, metric = $('metric').value, region = $('region').value;
  const destinations = state.geo.destinations.filter(d => region === 'all' || d.region === region);
  const visible = state.records.filter(r => (origin === 'all' || r.origin_borough === origin) && destinations.some(d => d.fips === r.destination_state_fips + r.destination_county_fips));
  const totals = destinations.map(d => {
    const routes = visible.filter(r => r.destination_state_fips + r.destination_county_fips === d.fips);
    return {...d, routes, value: routes.length ? routes.reduce((n, r) => n + r[metric], 0) : null, returns: routes.reduce((n, r) => n + r.returns, 0), agi_usd: routes.reduce((n, r) => n + r.agi_usd, 0)};
  }).sort((a,b) => b.value - a.value);
  const sum = totals.reduce((n, d) => n + (d.value || 0), 0), max = totals[0]?.value || 1;
  if (!state.selected || !destinations.some(d => d.fips === state.selected)) state.selected = totals[0]?.fips;
  $('total-label').textContent = metricLabel[metric].toUpperCase();
  $('total-value').textContent = valueText(sum, metric);
  $('route-count').textContent = fmt.format(visible.length);
  $('top-county').textContent = totals[0] ? totals[0].name : '—';
  $('filter-note').textContent = `Showing ${origin === 'all' ? 'all five NYC boroughs' : origin} → ${region === 'all' ? '16 selected NY and NJ counties' : region} · Fairfield, CT is unavailable in this IRS release · Unpublished routes are shown as —`;
  $('ranking').innerHTML = totals.map((d,i) => `<button class="rank-row ${d.fips === state.selected ? 'active' : ''}" data-fips="${d.fips}" type="button" aria-label="Show ${escapeHtml(d.name)} origin details"><span class="rank-index">${String(i+1).padStart(2,'0')}</span><span class="rank-name">${escapeHtml(d.name)} <small>${d.state}</small></span><span class="bar-track"><span class="bar-fill" style="width:${d.value === null ? 0 : Math.max(1,d.value/max*100)}%"></span></span><span class="rank-value">${d.value === null ? '—' : valueText(d.value,metric)}</span></button>`).join('');
  for (const row of $('ranking').querySelectorAll('button')) row.addEventListener('click', () => select(row.dataset.fips));
  $('table-metric').textContent = metricShort[metric];
  $('destination-table').querySelector('tbody').innerHTML = totals.map(d => `<tr data-fips="${d.fips}" title="Show ${escapeHtml(d.name)} origins"><td>${escapeHtml(d.name)} <small>${d.state}</small></td><td class="region-cell">${escapeHtml(d.region)}</td><td>${d.value === null ? '—' : exactText(d.value,metric)}</td><td class="share-cell">${d.value === null ? '—' : (d.value/sum*100).toFixed(1) + '%'}</td><td>${d.value === null ? '—' : fmt.format(d.returns)}</td><td>${d.value === null ? '—' : compactMoney(d.agi_usd)}</td></tr>`).join('');
  for (const row of $('destination-table').querySelectorAll('tbody tr')) row.addEventListener('click', () => select(row.dataset.fips));
  renderInsight(totals.find(d => d.fips === state.selected), metric);
  renderMatrix(totals, metric);
  const query = new URLSearchParams();
  if (origin !== 'all') query.set('origin',origin);
  if (metric !== 'exemptions') query.set('metric',metric);
  if (region !== 'all') query.set('region',region);
  history.replaceState(null, '', location.pathname + (query.size ? '?' + query : ''));
}

function select(fips) { state.selected = fips; render(); }

function renderInsight(destination, metric) {
  if (!destination) return;
  const origins = state.geo.origins.map(o => ({name:o.name, route:state.records.find(r => r.origin_borough === o.name && r.destination_state_fips+r.destination_county_fips === destination.fips)}));
  const total = origins.reduce((n, o) => n + (o.route ? o.route[metric] : 0), 0);
  const rows = origins.map(o => { const n = o.route?.[metric] ?? 0; return `<div class="insight-origin"><span>${escapeHtml(o.name)}</span><span class="mini-bar"><i style="width:${total ? n/total*100 : 0}%"></i></span><span>${o.route ? (n/total*100).toFixed(0)+'%' : '—'}</span></div>`; }).join('');
  $('insight').innerHTML = `<span class="insight-kicker">COUNTY FOCUS</span><h3>Who moved to ${escapeHtml(destination.name)}?</h3><p>Share of published NYC → ${escapeHtml(destination.name)} flows, measured in ${metricLabel[metric].toLowerCase()}.</p>${rows}<div class="insight-stat"><span>All NYC boroughs</span><strong>${valueText(total,metric)}</strong></div><p style="margin:12px 0 0;font-size:11px">${$('origin').value === 'all' ? 'County focus always compares all five origins.' : 'County focus compares all five origins, regardless of the origin filter.'}</p>`;
}

function renderMatrix(totals, metric) {
  const all = totals.flatMap(d => state.geo.origins.map(o => state.records.find(r => r.origin_borough === o.name && r.destination_state_fips+r.destination_county_fips === d.fips)?.[metric] || 0));
  const max = Math.max(...all, 1);
  $('matrix').querySelector('thead').innerHTML = `<tr><th scope="col">Destination</th>${state.geo.origins.map(o => `<th scope="col">${escapeHtml(o.name)}</th>`).join('')}</tr>`;
  $('matrix').querySelector('tbody').innerHTML = totals.map(d => `<tr><td>${escapeHtml(d.name)} <small>${d.state}</small></td>${state.geo.origins.map(o => {const r = state.records.find(r => r.origin_borough === o.name && r.destination_state_fips+r.destination_county_fips === d.fips); return r ? `<td class="heat" style="background:rgba(18,109,103,${(0.06 + r[metric]/max*0.30).toFixed(3)})" title="${escapeHtml(o.name)} → ${escapeHtml(d.name)}: ${exactText(r[metric],metric)}">${valueText(r[metric],metric)}</td>` : `<td class="missing" title="Route not published by IRS">—</td>`;}).join('')}</tr>`).join('');
}

Promise.all([fetch('data/geography.json').then(r => {if (!r.ok) throw Error('geography unavailable'); return r.json()}), fetch('data/processed/routes_2022_2023.json').then(r => {if (!r.ok) throw Error('routes unavailable'); return r.json()})])
  .then(([geo, data]) => { state.geo = geo; state.records = data.records; initControls(); render(); })
  .catch(error => { $('ranking').innerHTML = `<div class="error">Could not load the data: ${escapeHtml(error.message)}. Run the import script and serve this directory with a local web server.</div>`; });
