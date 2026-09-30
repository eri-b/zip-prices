const svg = document.getElementById('metro-map');
const zctaLayer = document.getElementById('zcta-layer');
const flowLayer = document.getElementById('flow-layer');
const labelLayer = document.getElementById('map-labels');
const detailZip = document.getElementById('detail-zip');
const detailExplainer = document.getElementById('detail-explainer');
const detailContent = document.getElementById('detail-content');
const number = new Intl.NumberFormat('en-US');
const escapeText = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app = {geometry:null, zipMap:new Map(), pathMap:new Map(), flows:new Map(), selected:null, fileName:null, period:'', view:{x:0,y:0,w:1400,h:850}, drag:null};

function project(lon,lat){
  const [west,south,east,north]=app.geometry.bounds;
  return [(lon-west)/(east-west)*app.geometry.width,(north-lat)/(north-south)*app.geometry.height];
}
function setView(x,y,w){
  w=Math.max(110,Math.min(1400,w));
  const h=w*850/1400;
  x=Math.max(0,Math.min(1400-w,x));
  y=Math.max(0,Math.min(850-h,y));
  app.view={x,y,w,h};
  svg.setAttribute('viewBox',`${x} ${y} ${w} ${h}`);
}
function zoom(factor,point){
  const old=app.view, px=point?.[0] ?? old.x+old.w/2, py=point?.[1] ?? old.y+old.h/2;
  const w=Math.max(110,Math.min(1400,old.w*factor)), h=w*850/1400;
  const rx=(px-old.x)/old.w, ry=(py-old.y)/old.h;
  setView(px-rx*w,py-ry*h,w);
}
function screenToMap(event){
  const rect=svg.getBoundingClientRect(), v=app.view;
  return [v.x+(event.clientX-rect.left)/rect.width*v.w,v.y+(event.clientY-rect.top)/rect.height*v.h];
}
function inside(lon,lat){
  const [w,s,e,n]=app.geometry.bounds;
  return lon>=w&&lon<=e&&lat>=s&&lat<=n;
}
function edgeTarget(source,target){
  const dx=target[0]-source[0],dy=target[1]-source[1],hits=[];
  for(const x of [22,1378]) if(dx!==0){const t=(x-source[0])/dx,y=source[1]+t*dy;if(t>0&&y>=22&&y<=828)hits.push({t,point:[x,y],side:x<700?'west':'east'});}
  for(const y of [22,828]) if(dy!==0){const t=(y-source[1])/dy,x=source[0]+t*dx;if(t>0&&x>=22&&x<=1378)hits.push({t,point:[x,y],side:y<425?'north':'south'});}
  return hits.sort((a,b)=>a.t-b.t)[0]||{point:[Math.max(22,Math.min(1378,target[0])),Math.max(22,Math.min(828,target[1]))],side:'east'};
}
function renderGeometry(){
  zctaLayer.innerHTML=app.geometry.zctas.map(z=>`<path class="zcta" data-zip="${z.zip}" d="${z.path}" fill-rule="evenodd"><title>ZIP area ${z.zip}</title></path>`).join('');
  for(const z of app.geometry.zctas){app.zipMap.set(z.zip,z);app.pathMap.set(z.zip,zctaLayer.querySelector(`[data-zip="${z.zip}"]`));}
  const places=[['NEW YORK CITY',-73.95,40.70],['WESTCHESTER',-73.79,41.08],['LONG ISLAND',-72.88,40.86],['NORTH JERSEY',-74.52,40.93],['CONNECTICUT',-73.31,41.32]];
  labelLayer.innerHTML=places.map(([name,lon,lat])=>{const [x,y]=project(lon,lat);return `<text class="map-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle">${name}</text>`}).join('');
  document.getElementById('map-stat').textContent=`${number.format(app.geometry.zctas.length)} Census ZIP areas shown · drag or zoom to inspect`;
}
function selectZip(zip,persist=false){
  if(!app.zipMap.has(zip)){
    detailZip.textContent='ZIP not mapped';detailExplainer.textContent=`${zip} has no Census ZCTA area in the displayed NYC metro extent.`;detailContent.innerHTML='';return;
  }
  app.selected=zip;
  const routes=(app.flows.get(zip)||[]).slice().sort((a,b)=>b.count-a.count);
  const drawing=routes.slice(0,8);
  const targets=new Set(drawing.map(r=>r.destination));
  for(const [code,path] of app.pathMap){
    path.classList.toggle('selected',code===zip);
    path.classList.toggle('destination',code!==zip&&targets.has(code));
  }
  detailZip.textContent=zip;
  if(!app.fileName){
    detailExplainer.textContent='ZIP boundaries are ready; move counts need a ZIP-to-ZIP source file.';
    detailContent.innerHTML='<div class="detail-empty">Load a USPS Population Mobility Trends CSV above. The file is read locally in this browser session; no routes are estimated.</div>';
    flowLayer.innerHTML='';
  } else if(!routes.length){
    detailExplainer.textContent='No published route for this ZIP in the loaded file.';
    detailContent.innerHTML='<div class="detail-empty">This does not mean no one moved. The ZIP may be absent from the file or below its publication threshold.</div>';
    flowLayer.innerHTML='';
  } else {
    const total=routes.reduce((n,r)=>n+r.count,0);
    detailExplainer.textContent=`Published change-of-address requests from ${zip}, ${app.period}. Routes below USPS thresholds may be absent.`;
    detailContent.innerHTML=`<div class="detail-summary"><span>SHOWN ROUTE TOTAL</span><strong>${number.format(total)}</strong></div><div class="detail-subhead">DESTINATION ZIPs · ${routes.length} PUBLISHED ROUTES</div>`+
      routes.slice(0,30).map((r,i)=>`<div class="route"><span class="route-index">${String(i+1).padStart(2,'0')}</span><span><b>${escapeText(r.destination)}</b> · ${escapeText(r.city)}, ${escapeText(r.state)}<small>${r.local?'Within map':'Beyond map edge'}</small></span><strong>${number.format(r.count)}</strong></div>`).join('')+
      (routes.length>30?`<p style="font-size:11px;color:#6a7c78">Showing 30 of ${routes.length} routes.</p>`:'');
    renderFlows(zip,drawing);
  }
  if(persist){const q=new URLSearchParams(location.search);q.set('zip',zip);history.replaceState(null,'',location.pathname+'?'+q);}
}
function renderFlows(origin,routes){
  const source=app.zipMap.get(origin).center;
  const paths=[],labels=[],usedOutside={west:0,east:0,north:0,south:0};
  routes.forEach((r,i)=>{
    let target, outside=false,side='';
    const mapped=app.zipMap.get(r.destination);
    if(mapped)target=mapped.center;
    else if(Number.isFinite(r.lon)&&Number.isFinite(r.lat)){
      const actual=project(r.lon,r.lat);
      if(inside(r.lon,r.lat))target=actual;
      else{const edge=edgeTarget(source,actual);target=edge.point;side=edge.side;outside=true;}
    }
    if(!target)return;
    const dx=target[0]-source[0],dy=target[1]-source[1],length=Math.hypot(dx,dy);
    if(length<1){
      const x=source[0],y=source[1];
      paths.push(`<path class="flow-line" d="M${x},${y} C${x+34},${y-54} ${x-34},${y-54} ${x-8},${y-5}"><title>${escapeText(origin)} → same ZIP: ${number.format(r.count)} change-of-address requests</title></path>`);
      labels.push(`<text class="flow-label" x="${x}" y="${y-49}" text-anchor="middle">same ZIP · ${number.format(r.count)}</text>`);
      return;
    }
    const adjust=outside?0:Math.min(17,length*.13)*(i%2?-1:1);
    const cx=(source[0]+target[0])/2-dy/length*adjust,cy=(source[1]+target[1])/2+dx/length*adjust;
    paths.push(`<path class="flow-line ${outside?'outside':''}" d="M${source[0]},${source[1]} Q${cx.toFixed(1)},${cy.toFixed(1)} ${target[0].toFixed(1)},${target[1].toFixed(1)}"><title>${escapeText(origin)} → ${escapeText(r.destination)}: ${number.format(r.count)} change-of-address requests</title></path>`);
    let lx=target[0],ly=target[1]-13,anchor='middle';
    if(outside){const n=usedOutside[side]++;if(side==='west'){lx=target[0]+14;ly=target[1]+(n%3-1)*22;anchor='start'}else if(side==='east'){lx=target[0]-14;ly=target[1]+(n%3-1)*22;anchor='end'}else{lx=target[0]+(n%3-1)*55;ly=side==='north'?target[1]+22:target[1]-18;}}
    const caption=outside?`${r.destination} ${r.city}, ${r.state} · ${number.format(r.count)}`:`${r.destination} · ${number.format(r.count)}`;
    labels.push(`<text class="flow-label" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}">${escapeText(caption)}</text>`);
  });
  flowLayer.innerHTML=paths.join('')+labels.join('');
}
function csvRows(text,callback){
  let field='',row=[],quoted=false,started=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){
      if(c==='\r'&&text[i+1]==='\n')i++;
      row.push(field);field='';
      if(row.some(x=>x!=='')){if(!started&&row[0].trim()==='Date'){started=true;callback(row);}else if(started)callback(row);}
      row=[];
    }else field+=c;
  }
  if(field||row.length){row.push(field);if(started)callback(row);}
  if(!started)throw Error('No USPS header row beginning with Date was found.');
}
function parsePmt(text){
  let columns=null, accepted=0;const groups=new Map(),months=new Set();
  csvRows(text,row=>{
    if(!columns){columns=new Map(row.map((name,index)=>[name.trim(),index]));for(const key of ['O Zip','N Zip','Tot Vol'])if(!columns.has(key))throw Error(`Missing USPS column: ${key}`);return;}
    const get=name=>row[columns.get(name)]?.trim()||'';
    const origin=get('O Zip').padStart(5,'0'),destination=get('N Zip').padStart(5,'0'),count=Number(get('Tot Vol'));
    if(!/^\d{5}$/.test(origin)||!/^\d{5}$/.test(destination)||!Number.isInteger(count)||count<=0||!app.zipMap.has(origin))return;
    const key=origin+'|'+destination;
    const state=get('N St'),city=get('N Cty');
    const rawLon=get('NEWLON'),rawLat=get('NEWLAT');
    const lon=rawLon?Number(rawLon):NaN,lat=rawLat?Number(rawLat):NaN;
    const route=groups.get(key)||{origin,destination,city,state,count:0,lon:Number.isFinite(lon)?lon:null,lat:Number.isFinite(lat)?lat:null};
    route.count+=count;groups.set(key,route);accepted++;
    if(get('Date'))months.add(get('Date'));
  });
  const flows=new Map();
  for(const route of groups.values()){
    route.local=app.zipMap.has(route.destination)||(route.lon!==null&&route.lat!==null&&inside(route.lon,route.lat));
    if(!flows.has(route.origin))flows.set(route.origin,[]);
    flows.get(route.origin).push(route);
  }
  const dates=[...months].sort();
  return {flows,accepted,months:months.size,period:dates.length?(dates[0]===dates[dates.length-1]?dates[0]:`${dates[0]}–${dates[dates.length-1]}`):'undated file'};
}
function parsePreparedJson(text){
  const data=JSON.parse(text);
  if(data.format!=='nyc-metro-pmt-v1'||!Array.isArray(data.routes))throw Error('Unsupported prepared flow JSON format.');
  const flows=new Map();
  for(const r of data.routes){
    if(!/^\d{5}$/.test(r.origin)||!/^\d{5}$/.test(r.destination)||!Number.isInteger(r.count)||r.count<=0||!app.zipMap.has(r.origin))continue;
    r.local=app.zipMap.has(r.destination)||(Number.isFinite(r.lon)&&Number.isFinite(r.lat)&&inside(r.lon,r.lat));
    if(!flows.has(r.origin))flows.set(r.origin,[]);
    flows.get(r.origin).push(r);
  }
  return {flows,accepted:data.source_rows||data.routes.length,period:data.period||'undated file'};
}
async function loadFile(file){
  const state=document.getElementById('data-state'),message=document.getElementById('data-message');
  state.textContent='Reading ZIP flows…';message.textContent=file.name;
  try{
    const text=await file.text();const result=file.name.toLowerCase().endsWith('.json')?parsePreparedJson(text):parsePmt(text);
    if(!result.accepted)throw Error('No routes with NYC metro origin ZCTAs were found. The public USPS sample contains no NYC rows.');
    app.flows=result.flows;app.fileName=file.name;app.period=result.period;
    document.getElementById('data-banner').classList.add('loaded');
    state.textContent=`${number.format(result.flows.size)} origin ZIPs loaded`;
    message.textContent=`${result.period} · ${number.format(result.accepted)} source rows · local browser session`;
    for(const [zip,path] of app.pathMap)path.classList.toggle('has-data',app.flows.has(zip));
    document.getElementById('map-stat').textContent=`${number.format(app.geometry.zctas.length)} ZIP areas · ${number.format(app.flows.size)} origins with published routes`;
    const first=app.selected&&app.flows.has(app.selected)?app.selected:[...app.flows.entries()].sort((a,b)=>b[1].reduce((n,r)=>n+r.count,0)-a[1].reduce((n,r)=>n+r.count,0))[0][0];
    selectZip(first,true);
  }catch(error){state.textContent='Could not load ZIP flows';message.textContent=error.message;}
}
function wireEvents(){
  zctaLayer.addEventListener('pointerover',event=>{const path=event.target.closest?.('.zcta');if(path&&!app.drag?.moved)selectZip(path.dataset.zip);});
  zctaLayer.addEventListener('click',event=>{const path=event.target.closest?.('.zcta');if(path&&!app.drag?.moved)selectZip(path.dataset.zip,true);});
  document.getElementById('file-input').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)loadFile(file);});
  function search(){const zip=document.getElementById('zip-search').value.trim();if(!/^\d{5}$/.test(zip)){detailExplainer.textContent='Enter a five-digit ZIP code.';return;}selectZip(zip,true);if(app.zipMap.has(zip)){const [x,y]=app.zipMap.get(zip).center;setView(x-190,y-115,380);}}
  document.getElementById('search-button').addEventListener('click',search);
  document.getElementById('zip-search').addEventListener('keydown',event=>{if(event.key==='Enter')search();});
  document.getElementById('zoom-in').addEventListener('click',()=>zoom(.7));
  document.getElementById('zoom-out').addEventListener('click',()=>zoom(1/.7));
  document.getElementById('reset-view').addEventListener('click',()=>setView(0,0,1400));
  svg.addEventListener('wheel',event=>{event.preventDefault();zoom(event.deltaY>0?1.22:.82,screenToMap(event));},{passive:false});
  svg.addEventListener('pointerdown',event=>{if(event.button!==0)return;app.drag={start:[event.clientX,event.clientY],view:{...app.view},moved:false};svg.setPointerCapture(event.pointerId);});
  svg.addEventListener('pointermove',event=>{if(!app.drag)return;const dx=event.clientX-app.drag.start[0],dy=event.clientY-app.drag.start[1];if(Math.abs(dx)+Math.abs(dy)>4)app.drag.moved=true;if(!app.drag.moved)return;svg.classList.add('dragging');const rect=svg.getBoundingClientRect();setView(app.drag.view.x-dx/rect.width*app.drag.view.w,app.drag.view.y-dy/rect.height*app.drag.view.h,app.drag.view.w);});
  svg.addEventListener('pointerup',()=>{svg.classList.remove('dragging');setTimeout(()=>app.drag=null,0);});
}
fetch('data/processed/metro_zctas.json').then(response=>{if(!response.ok)throw Error('ZIP boundary data unavailable');return response.json();}).then(geo=>{
  app.geometry=geo;renderGeometry();wireEvents();
  const zip=new URLSearchParams(location.search).get('zip');if(zip)selectZip(zip);
}).catch(error=>{document.getElementById('map-stat').textContent=error.message;detailExplainer.textContent='Run the boundary build script and serve this project from a local web server.';});
