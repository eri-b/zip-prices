const state = {geo: null, years: null};
const $ = id => document.getElementById(id);
const fmt = new Intl.NumberFormat('en-US');
const usd = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0});
const metricNames = {people: 'People on returns', returns: 'Tax returns', agi_usd: 'Aggregate income'};
const valueText = (value, metric) => value == null ? '—' : metric === 'agi_usd' ? usd.format(value) : fmt.format(value);
const shortValue = (value, metric) => value == null ? '—' : metric === 'agi_usd' && value >= 1e9 ? `$${(value / 1e9).toFixed(2)}B` : metric === 'agi_usd' && value >= 1e6 ? `$${(value / 1e6).toFixed(1)}M` : valueText(value, metric);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function destinationName(destination) {
  return destination.region === 'NYC' ? destination.name : `${destination.name} County, ${destination.state}`;
}

function routeFor(year, origin, destination) {
  return state.years[year].find(route => route.o === origin && route.d === destination);
}

function init() {
  for (const origin of state.geo.origins) $('origin').add(new Option(origin.name, origin.fips));
  for (const destination of state.geo.destinations) $('destination').add(new Option(destinationName(destination), destination.fips));
  for (const year of Object.keys(state.years).reverse()) $('year').add(new Option(year.replace('-', '–'), year));
  $('origin').value = '36047';
  const query = new URLSearchParams(location.search);
  for (const id of ['origin', 'destination', 'year', 'metric']) {
    const value = query.get(id);
    if (value && [...$(id).options].some(option => option.value === value)) $(id).value = value;
    $(id).addEventListener('change', () => {
      if ($('origin').value === $('destination').value) $('destination').value = 'all';
      render();
    });
  }
  render();
}

function render() {
  const origin = $('origin').value;
  for (const option of $('destination').options) option.disabled = option.value === origin;
  const year = $('year').value;
  const metric = $('metric').value;
  const originName = state.geo.origins.find(item => item.fips === origin).name;
  const destinations = state.geo.destinations.filter(item => item.fips !== origin);
  const rows = destinations.map(destination => ({destination, route: routeFor(year, origin, destination.fips)}));
  rows.sort((a, b) => (b.route?.[metric] ?? -1) - (a.route?.[metric] ?? -1) || destinationName(a.destination).localeCompare(destinationName(b.destination)));
  const selected = $('destination').value;
  const focus = selected === 'all' || selected === origin ? rows[0]?.destination.fips : selected;
  const max = Math.max(1, ...rows.map(row => row.route?.[metric] ?? 0));
  $('ranking-title').textContent = `From ${originName}`;
  $('year-pill').textContent = year.replace('-', ' → ');
  $('chart-measure').textContent = metricNames[metric];
  $('chart-scale').textContent = `Longest bar: ${shortValue(max, metric)}`;
  $('filter-note').textContent = `${originName} → ${selected === 'all' ? 'all listed destinations' : destinationName(destinations.find(d => d.fips === selected) || rows[0].destination)} · ${year.replace('-', ' → ')} · Dashes mean unpublished routes`;
  $('ranking').innerHTML = rows.map(({destination, route}, index) => {
    const active = destination.fips === focus;
    const name = destinationName(destination);
    const percent = route ? route[metric] / max * 100 : 0;
    return `<button class="rank-row ${active ? 'active' : ''}" data-destination="${destination.fips}" type="button" aria-pressed="${active}" aria-label="${escapeHtml(originName)} to ${escapeHtml(name)}: ${escapeHtml(valueText(route?.[metric], metric))}"><span class="rank-index">${String(index + 1).padStart(2, '0')}</span><span class="rank-name">${escapeHtml(originName)} <b>→</b> ${escapeHtml(name)}</span><span class="bar-track"><span class="bar-fill" style="width:${percent}%"></span></span><span class="rank-value">${shortValue(route?.[metric], metric)}</span></button>`;
  }).join('');
  for (const button of $('ranking').querySelectorAll('button')) button.addEventListener('click', () => {
    $('destination').value = button.dataset.destination;
    render();
    $('route-title').scrollIntoView({behavior: 'smooth', block: 'start'});
  });
  renderDetail(origin, focus, year, metric);
  const query = new URLSearchParams({origin, destination: selected, year, metric});
  history.replaceState(null, '', `${location.pathname}?${query}`);
}

function renderDetail(origin, destinationFips, year, metric) {
  const originName = state.geo.origins.find(item => item.fips === origin).name;
  const destination = state.geo.destinations.find(item => item.fips === destinationFips);
  const name = destinationName(destination);
  const route = routeFor(year, origin, destinationFips);
  $('route-title').textContent = `${originName} → ${name}`;
  const years = Object.keys(state.years);
  const history = years.map(item => ({year: item, route: routeFor(item, origin, destinationFips)}));
  const max = Math.max(1, ...history.map(item => item.route?.[metric] ?? 0));
  const bars = history.map(item => `<div class="history-row ${item.year === year ? 'current' : ''}"><span>${item.year.replace('-', '–')}${item.year === '2022-2023' ? '<sup>†</sup>' : ''}</span><span class="history-track"><i style="width:${item.route ? item.route[metric] / max * 100 : 0}%"></i></span><strong>${shortValue(item.route?.[metric], metric)}</strong></div>`).join('');
  $('route-detail').innerHTML = `<div class="route-summary"><div><span>${escapeHtml(year.replace('-', ' → '))} · ${escapeHtml(metricNames[metric])}</span><strong>${valueText(route?.[metric], metric)}</strong></div><div><span>Tax returns</span><strong>${valueText(route?.returns, 'returns')}</strong></div><div><span>People on returns</span><strong>${valueText(route?.people, 'people')}</strong></div><div><span>Aggregate income</span><strong>${valueText(route?.agi_usd, 'agi_usd')}</strong></div></div><div class="history"><div class="history-heading"><h3>Route over time</h3><span>${escapeHtml(metricNames[metric])}</span></div>${bars}<p>† IRS changed its matching process for 2022–2023; compare that year with caution. An unpublished year is shown as —.</p></div>`;
}

Promise.all([
  fetch('data/geography.json').then(response => { if (!response.ok) throw Error('geography unavailable'); return response.json(); }),
  fetch('data/processed/county_routes.json').then(response => { if (!response.ok) throw Error('routes unavailable'); return response.json(); })
]).then(([geo, data]) => { state.geo = geo; state.years = data.years; init(); })
  .catch(error => { $('ranking').innerHTML = `<div class="error">Could not load the data: ${escapeHtml(error.message)}. Serve this directory with a local web server.</div>`; });
