const svg = document.getElementById('metro-map');
const zctaLayer = document.getElementById('zcta-layer');
const waterLayer = document.getElementById('water-layer');
const townLayer = document.getElementById('town-labels');
const detailZip = document.getElementById('detail-zip');
const detailExplainer = document.getElementById('detail-explainer');
const detailContent = document.getElementById('detail-content');
const usd = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0});
const number = new Intl.NumberFormat('en-US');
const app = {geometry:null, data:null, towns:null, water:null, paths:new Map(), zips:new Map(), selected:null, matches:[], view:{x:0,y:0,w:1400,h:850}, drag:null};
const thresholds = [300000,500000,750000,1000000,1500000,2500000];
const bedLabel = {'1':'1 bedroom','2':'2 bedrooms','3':'3 bedrooms','4':'4 bedrooms','5':'5+ bedrooms'};
const $ = id => document.getElementById(id);

function setView(x,y,w){
  w=Math.max(110,Math.min(1400,w));const h=w*850/1400;
  x=Math.max(0,Math.min(1400-w,x));y=Math.max(0,Math.min(850-h,y));
  app.view={x,y,w,h};svg.setAttribute('viewBox',`${x} ${y} ${w} ${h}`);
  renderTownLabels();
}
function zoom(factor,point){
  const old=app.view, px=point?.[0] ?? old.x+old.w/2, py=point?.[1] ?? old.y+old.h/2;
  const w=Math.max(110,Math.min(1400,old.w*factor)),h=w*850/1400;
  setView(px-(px-old.x)/old.w*w,py-(py-old.y)/old.h*h,w);
}
function screenToMap(event){
  const rect=svg.getBoundingClientRect(),v=app.view;
  return [v.x+(event.clientX-rect.left)/rect.width*v.w,v.y+(event.clientY-rect.top)/rect.height*v.h];
}
function settings(){
  const min=$('min-price').value===''?0:Number($('min-price').value);
  const max=$('max-price').value===''?Infinity:Number($('max-price').value);
  return {bed:$('bedrooms').value,period:$('period').value,min,max};
}
function value(zip,bed,period){return app.data?.values?.[zip]?.[bed]?.[period] ?? null;}
function colorClass(amount){return 'price-'+thresholds.filter(t=>amount>=t).length;}
function monthLabel(date){return new Date(`${date}T12:00:00`).toLocaleDateString('en-US',{month:'short',year:'numeric'});}

function renderGeometry(){
  zctaLayer.innerHTML=app.geometry.zctas.map(z=>`<path class="zcta" data-zip="${z.zip}" d="${z.path}" fill-rule="evenodd"><title>ZIP area ${z.zip}</title></path>`).join('');
  for(const z of app.geometry.zctas){app.zips.set(z.zip,z);app.paths.set(z.zip,zctaLayer.querySelector(`[data-zip="${z.zip}"]`));}
  waterLayer.innerHTML=app.water.paths.map(path=>`<path class="water-shape" d="${path}" fill-rule="evenodd"></path>`).join('');
}
function renderTownLabels(){
  if(!app.geometry||!app.towns)return;
  const rect=svg.getBoundingClientRect(),view=app.view;
  if(!rect.width||!rect.height)return;
  const groups=new Map();
  for(const z of app.geometry.zctas){
    const town=app.towns.towns[z.zip];
    if(!town)continue;
    const [x,y]=z.center;
    if(x<view.x||x>view.x+view.w||y<view.y||y>view.y+view.h)continue;
    const key=town.source+':'+town.id;
    const item=groups.get(key)||{name:town.name,count:0,x:0,y:0};
    item.count++;item.x+=x;item.y+=y;
    groups.set(key,item);
  }
  const candidates=[...groups.values()].map(item=>({...item,x:item.x/item.count,y:item.y/item.count}));
  candidates.sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
  const maxLabels=view.w>950?15:view.w>450?28:45, boxes=[];
  const scale=view.w/rect.width;
  townLayer.replaceChildren();
  for(const item of candidates){
    if(boxes.length>=maxLabels)break;
    const sx=(item.x-view.x)/view.w*rect.width,sy=(item.y-view.y)/view.h*rect.height;
    const width=Math.min(150,item.name.length*7+16),height=20;
    const box={left:sx-width/2,right:sx+width/2,top:sy-height/2,bottom:sy+height/2};
    if(box.left<8||box.right>rect.width-8||box.top<8||box.bottom>rect.height-8)continue;
    if(boxes.some(other=>box.left<other.right+8&&box.right>other.left-8&&box.top<other.bottom+5&&box.bottom>other.top-5))continue;
    boxes.push(box);
    const label=document.createElementNS('http://www.w3.org/2000/svg','text');
    label.setAttribute('class','town-label');label.setAttribute('x',item.x);label.setAttribute('y',item.y);
    label.setAttribute('font-size',String(12*scale));label.setAttribute('stroke-width',String(3*scale));
    label.textContent=item.name;townLayer.append(label);
  }
}
function renderMap(){
  const {bed,period,min,max}=settings(),matches=[];
  for(const [zip,path] of app.paths){
    const amount=value(zip,bed,period),inRange=amount!==null&&amount>=min&&amount<=max;
    path.setAttribute('class',`zcta ${amount===null?'no-data':colorClass(amount)} ${inRange?'':'filtered'} ${zip===app.selected?'selected':''}`);
    path.querySelector('title').textContent=`ZIP ${zip}: ${amount===null?`No ${bedLabel[bed]} estimate`:usd.format(amount)}`;
    if(inRange)matches.push({zip,amount});
  }
  matches.sort((a,b)=>a.amount-b.amount||a.zip.localeCompare(b.zip));
  app.matches=matches;
  $('match-count').textContent=`${number.format(matches.length)} matching ZIPs`;
  $('map-stat').textContent=`${number.format(app.geometry.zctas.length)} mapped ZIP areas · ${number.format(matches.length)} match the selected bedroom and price range`;
  $('result-total').textContent=number.format(matches.length);
  renderResults();renderDetail();
}
function renderResults(){
  const list=$('result-list');
  if(!app.matches.length){list.innerHTML='<p class="detail-empty">No ZIPs match these filters. Try a wider price range or another bedroom count.</p>';return;}
  list.innerHTML=app.matches.slice(0,100).map(({zip,amount})=>`<button type="button" class="result-row" data-zip="${zip}"><span>${zip}</span><strong>${usd.format(amount)}</strong></button>`).join('')+
    (app.matches.length>100?`<p class="result-note">Showing the 100 lowest-priced matches of ${number.format(app.matches.length)}. Narrow the price range to see more.</p>`:'');
}
function renderDetail(){
  const zip=app.selected, {bed,period,min,max}=settings();
  if(!zip){detailZip.textContent='Choose a ZIP';detailExplainer.textContent='Hover over the map or search for a ZIP to compare home values.';detailContent.innerHTML='';return;}
  if(!app.zips.has(zip)){detailZip.textContent=zip;detailExplainer.textContent='This ZIP has no mapped Census ZCTA in the displayed metro area.';detailContent.innerHTML='';return;}
  const amount=value(zip,bed,period),date=app.data.end_dates[bed];
  detailZip.textContent=zip;
  detailExplainer.textContent=`${period==='1'?'12':period==='2'?'24':'36'}-month average through ${monthLabel(date)} · ${bedLabel[bed]}`;
  const town=app.towns?.towns?.[zip]?.name;
  let html=town?`<p class="town-meta">Town/area: <strong>${town.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</strong></p>`:'';
  html+=`<div class="detail-summary"><span>AVERAGE TYPICAL VALUE</span><strong>${amount===null?'No estimate':usd.format(amount)}</strong></div>`;
  if(amount===null)html+=`<p class="detail-note">No ${bedLabel[bed]} estimate is published for this ZIP. Other bedroom counts are shown below when available.</p>`;
  if(amount!==null&&(amount<min||amount>max))html+='<p class="outside-note">This ZIP is outside the selected price range.</p>';
  html+='<div class="detail-subhead">ALL BEDROOM COUNTS</div>';
  for(const count of ['1','2','3','4','5']){
    const v=value(zip,count,period);
    html+=`<div class="bed-row ${count===bed?'active':''}"><span>${bedLabel[count]}</span><strong>${v===null?'—':usd.format(v)}</strong></div>`;
  }
  html+='<p class="detail-note">Bedroom categories are separate Zillow estimates. Values are based on the housing stock, not just sold homes.</p>';
  detailContent.innerHTML=html;
}
function selectZip(zip,persist=false){
  if(zip===app.selected&&!persist)return;
  const previous=app.selected;app.selected=zip;
  if(previous&&app.paths.has(previous))app.paths.get(previous).classList.remove('selected');
  if(app.paths.has(zip))app.paths.get(zip).classList.add('selected');
  renderDetail();
  if(persist){const q=new URLSearchParams(location.search);q.set('zip',zip);history.replaceState(null,'',`${location.pathname}?${q}`);}
}
function search(){
  const zip=$('zip-search').value.trim();
  if(!/^\d{5}$/.test(zip)){detailExplainer.textContent='Enter a five-digit ZIP code.';return;}
  selectZip(zip,true);
  if(app.zips.has(zip)){const [x,y]=app.zips.get(zip).center;setView(x-190,y-115,380);}
}
function wireEvents(){
  for(const id of ['bedrooms','period'])$(id).addEventListener('change',renderMap);
  for(const id of ['min-price','max-price'])$(id).addEventListener('input',renderMap);
  $('clear-filters').addEventListener('click',()=>{$('min-price').value='';$('max-price').value='';renderMap();});
  $('search-button').addEventListener('click',search);
  $('zip-search').addEventListener('keydown',event=>{if(event.key==='Enter')search();});
  $('result-list').addEventListener('click',event=>{const button=event.target.closest('button[data-zip]');if(button){selectZip(button.dataset.zip,true);const [x,y]=app.zips.get(button.dataset.zip).center;setView(x-190,y-115,380);}});
  zctaLayer.addEventListener('pointerover',event=>{const path=event.target.closest?.('.zcta');if(path&&!app.drag?.moved)selectZip(path.dataset.zip);});
  zctaLayer.addEventListener('click',event=>{const path=event.target.closest?.('.zcta');if(path&&!app.drag?.moved)selectZip(path.dataset.zip,true);});
  $('zoom-in').addEventListener('click',()=>zoom(.7));$('zoom-out').addEventListener('click',()=>zoom(1/.7));$('reset-view').addEventListener('click',()=>setView(0,0,1400));
  svg.addEventListener('wheel',event=>{event.preventDefault();zoom(event.deltaY>0?1.22:.82,screenToMap(event));},{passive:false});
  svg.addEventListener('pointerdown',event=>{if(event.button!==0)return;app.drag={start:[event.clientX,event.clientY],view:{...app.view},moved:false};svg.setPointerCapture(event.pointerId);});
  svg.addEventListener('pointermove',event=>{if(!app.drag)return;const dx=event.clientX-app.drag.start[0],dy=event.clientY-app.drag.start[1];if(Math.abs(dx)+Math.abs(dy)>4)app.drag.moved=true;if(!app.drag.moved)return;svg.classList.add('dragging');const rect=svg.getBoundingClientRect();setView(app.drag.view.x-dx/rect.width*app.drag.view.w,app.drag.view.y-dy/rect.height*app.drag.view.h,app.drag.view.w);});
  svg.addEventListener('pointerup',()=>{svg.classList.remove('dragging');setTimeout(()=>app.drag=null,0);});
  window.addEventListener('resize',renderTownLabels);
}
try{
  const geometry=window.METRO_ZCTAS,data=window.METRO_HOME_VALUES,towns=window.METRO_TOWNS,water=window.METRO_WATER;
  if(!geometry?.zctas?.length)throw Error('ZIP boundary data unavailable');
  if(data?.format!=='metro-zhvi-v1'||!Object.keys(data.values||{}).length)throw Error('Home value data unavailable');
  if(towns?.format!=='metro-towns-v1')throw Error('Town label data unavailable');
  if(water?.format!=='metro-water-v1'||!water.paths?.length)throw Error('Water map data unavailable');
  app.geometry=geometry;app.data=data;app.towns=towns;app.water=water;renderGeometry();wireEvents();
  $('data-banner').classList.add('loaded');$('data-state').textContent='Bedroom-specific ZIP values loaded';
  $('data-message').textContent=`Through ${monthLabel(data.end_dates['3'])} · Data provided by Zillow Group`;
  const zip=new URLSearchParams(location.search).get('zip');if(zip)selectZip(zip);
  renderMap();renderTownLabels();
}catch(error){$('data-state').textContent='Could not load data';$('data-message').textContent=error.message;$('map-stat').textContent=error.message;detailExplainer.textContent='Check that the generated data scripts are beside the page.';}
