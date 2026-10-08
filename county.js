const state = {geo: null, years: null};
const $ = id => document.getElementById(id);
const fmt = new Intl.NumberFormat('en-US');
const usd = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0});
const metricNames = {people: 'People on returns', returns: 'Tax returns', agi_usd: 'Aggregate income'};
const valueText = (value, metric) => value == null ? '—' : metric === 'agi_usd' ? usd.format(value) : fmt.format(value);
const shortValue = (value, metric) => value == null ? '—' : metric === 'agi_usd' && value >= 1e9 ? `$${(value / 1e9).toFixed(2)}B` : metric === 'agi_usd' && value >= 1e6 ? `$${(value / 1e6).toFixed(1)}M` : valueText(value, metric);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const heatStops = [[245,240,204],[171,220,183],[89,183,168],[27,123,146],[17,61,99]];
function heatColor(position) {
  const scaled = Math.max(0, Math.min(1, position)) * (heatStops.length - 1);
  const index = Math.min(heatStops.length - 2, Math.floor(scaled));
  const blend = scaled - index;
  return `rgb(${heatStops[index].map((channel, i) => Math.round(channel + (heatStops[index + 1][i] - channel) * blend)).join(',')})`;
}

function destinationName(destination) {
  return destination.region === 'NYC' ? destination.name : `${destination.name} County, ${destination.state}`;
}
const axisName = location => location.region === 'NYC' ? location.name : `${location.name}, ${location.state}`;

function routeFor(year, origin, destination) {
  return state.years[year].find(route => route.o === origin && route.d === destination);
}

function init() {
  for (const origin of state.geo.destinations) $('origin').add(new Option(destinationName(origin), origin.fips));
  for (const destination of state.geo.destinations) $('destination').add(new Option(destinationName(destination), destination.fips));
  for (const year of Object.keys(state.years).reverse()) $('year').add(new Option(year.replace('-', '–'), year));
  $('origin').value = '36119';
  $('destination').value = '36061';
  const query = new URLSearchParams(location.search);
  for (const id of ['origin', 'destination', 'year', 'metric']) {
    const value = query.get(id);
    if (value && [...$(id).options].some(option => option.value === value)) $(id).value = value;
    $(id).addEventListener('change', () => {
      if ($('origin').value === $('destination').value) {
        $('destination').value = state.geo.destinations.find(destination => destination.fips !== $('origin').value).fips;
      }
      render();
    });
  }
  render();
}

function render() {
  const origin = $('origin').value;
  for (const option of $('destination').options) option.disabled = option.value === origin;
  if ($('destination').value === origin) $('destination').value = state.geo.destinations.find(destination => destination.fips !== origin).fips;
  const destination = $('destination').value;
  const year = $('year').value;
  const metric = $('metric').value;
  const originName = destinationName(state.geo.destinations.find(item => item.fips === origin));
  const destinationLabel = destinationName(state.geo.destinations.find(item => item.fips === destination));
  const routes = new Map(state.years[year].map(route => [`${route.o}:${route.d}`, route]));
  const values = state.years[year].map(route => route[metric]);
  const min = Math.min(...values);
  const minPositive = Math.min(...values.filter(value => value > 0));
  const max = Math.max(...values);
  const logSpan = Math.log(max) - Math.log(minPositive);
  const heatPosition = value => value <= 0 ? 0 : logSpan ? (Math.log(value) - Math.log(minPositive)) / logSpan : 0.5;
  const possibleRoutes = state.geo.destinations.length * (state.geo.destinations.length - 1);
  $('year-pill').textContent = year.replace('-', ' → ');
  $('chart-measure').textContent = metricNames[metric];
  $('grid-coverage').textContent = `${routes.size} of ${possibleRoutes} routes published`;
  $('legend-min').textContent = shortValue(min, metric);
  $('legend-max').textContent = shortValue(max, metric);
  $('filter-note').textContent = `${originName} → ${destinationLabel} · ${year.replace('-', ' → ')}`;
  $('flow-grid').querySelector('thead').innerHTML = `<tr><th scope="col">Origin ↓ / Destination →</th>${state.geo.destinations.map(item => `<th scope="col" class="${item.fips === destination ? 'selected-axis' : ''}"><span class="axis-label">${escapeHtml(axisName(item))}</span></th>`).join('')}</tr>`;
  $('flow-grid').querySelector('tbody').innerHTML = state.geo.destinations.map(source => `<tr><th scope="row" class="${source.fips === origin ? 'selected-axis' : ''}">${escapeHtml(destinationName(source))}</th>${state.geo.destinations.map(target => {
    if (source.fips === target.fips) return '<td class="same-county" title="Same county; not a county-to-county move">n/a</td>';
    const route = routes.get(`${source.fips}:${target.fips}`);
    const active = source.fips === origin && target.fips === destination;
    const position = route ? heatPosition(route[metric]) : 0;
    const label = `${destinationName(source)} to ${destinationName(target)}: ${route ? valueText(route[metric], metric) : 'not published by the IRS'}`;
    const colors = route ? `--cell-bg:${heatColor(position)};--cell-ink:${position >= 0.71 ? '#fff' : '#081a1d'}` : '';
    return `<td><button type="button" class="flow-cell ${active ? 'active' : ''} ${route ? '' : 'unpublished'}" data-origin="${source.fips}" data-destination="${target.fips}" aria-pressed="${active}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" style="${colors}">${shortValue(route?.[metric], metric)}</button></td>`;
  }).join('')}</tr>`).join('');
  const scroller = document.querySelector('.flow-grid-scroll');
  const selectedHeader = $('flow-grid').querySelector('thead th.selected-axis');
  scroller.scrollLeft = Math.max(0, selectedHeader.offsetLeft - (scroller.clientWidth - selectedHeader.offsetWidth) / 2);
  for (const button of $('flow-grid').querySelectorAll('button')) button.addEventListener('click', () => {
    $('origin').value = button.dataset.origin;
    $('destination').value = button.dataset.destination;
    render();
    $('route-title').scrollIntoView({behavior: 'smooth', block: 'start'});
  });
  renderDetail(origin, destination, year, metric);
  const query = new URLSearchParams({origin, destination, year, metric});
  history.replaceState(null, '', `${location.pathname}?${query}`);
}

function renderDetail(origin, destinationFips, year, metric) {
  const originName = destinationName(state.geo.destinations.find(item => item.fips === origin));
  const destination = state.geo.destinations.find(item => item.fips === destinationFips);
  const name = destinationName(destination);
  const route = routeFor(year, origin, destinationFips);
  $('route-title').textContent = `${originName} → ${name}`;
  const years = Object.keys(state.years);
  const history = years.map(item => ({year: item, route: routeFor(item, origin, destinationFips)}));
  const max = Math.max(1, ...history.map(item => item.route?.[metric] ?? 0));
  const bars = history.map(item => `<div class="history-row ${item.year === year ? 'current' : ''}"><span>${item.year.replace('-', '–')}${item.year === '2022-2023' ? '<sup>†</sup>' : ''}</span><span class="history-track"><i style="width:${item.route ? Math.max(0, item.route[metric]) / max * 100 : 0}%"></i></span><strong>${shortValue(item.route?.[metric], metric)}</strong></div>`).join('');
  $('route-detail').innerHTML = `${route ? '' : '<p class="unpublished-note">The IRS did not publish this county-to-county route for the selected year. This does not mean zero moves.</p>'}<div class="route-summary"><div><span>${escapeHtml(year.replace('-', ' → '))} · ${escapeHtml(metricNames[metric])}</span><strong>${valueText(route?.[metric], metric)}</strong></div><div><span>Tax returns</span><strong>${valueText(route?.returns, 'returns')}</strong></div><div><span>People on returns</span><strong>${valueText(route?.people, 'people')}</strong></div><div><span>Aggregate income</span><strong>${valueText(route?.agi_usd, 'agi_usd')}</strong></div></div><div class="history"><div class="history-heading"><h3>Route over time</h3><span>${escapeHtml(metricNames[metric])}</span></div>${bars}<p>† IRS changed its matching process for 2022–2023; compare that year with caution. An unpublished year is shown as —.</p></div>`;
}

Promise.all([
  fetch('data/geography.json').then(response => { if (!response.ok) throw Error('geography unavailable'); return response.json(); }),
  fetch('data/processed/county_routes.json').then(response => { if (!response.ok) throw Error('routes unavailable'); return response.json(); })
]).then(([geo, data]) => { state.geo = geo; state.years = data.years; init(); })
  .catch(error => { document.querySelector('.flow-grid-scroll').innerHTML = `<div class="error">Could not load the data: ${escapeHtml(error.message)}. Serve this directory with a local web server.</div>`; });
