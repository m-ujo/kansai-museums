(function(){
'use strict';
const DATA_ASOF='2026-10-14';
const PREFS=['大阪','京都','兵庫','奈良','滋賀','和歌山'];
const CATS={art:'美術館',history:'歴史・考古',science:'自然・科学',craft:'工芸・陶磁',special:'テーマ・専門',temple:'寺社宝物館'};
const TAG_ORDER=['国宝','建築','庭園','日本画','現代美術','西洋美術','仏教美術','陶磁・茶の湯','工芸','考古','歴史','自然・科学','写真','文学','マンガ・サブカル','子ども向け','体験型','無料','駅近','夜間開館','季節限定'];
const HOLIDAYS=new Set(['2026-01-01','2026-01-12','2026-02-11','2026-02-23','2026-03-20','2026-04-29','2026-05-03','2026-05-04','2026-05-05','2026-05-06','2026-07-20','2026-08-11','2026-09-21','2026-09-22','2026-09-23','2026-10-12','2026-11-03','2026-11-23',
 '2027-01-01','2027-01-11','2027-02-11','2027-02-23','2027-03-21','2027-03-22','2027-04-29','2027-05-03','2027-05-04','2027-05-05','2027-07-19','2027-08-11','2027-09-20','2027-09-23','2027-10-11','2027-11-03','2027-11-23']);
const WD=['日','月','火','水','木','金','土'];

const MUSEUMS=[].concat(MUSEUMS_OSAKA,MUSEUMS_KYOTO,MUSEUMS_HYOGO,MUSEUMS_NARA,MUSEUMS_SHIGA,MUSEUMS_WAKAYAMA);
const BY_ID=new Map(MUSEUMS.map(m=>[m.id,m]));
const EX_BY_M=new Map();
for(const e of EXHIBITIONS){ if(!EX_BY_M.has(e.m)) EX_BY_M.set(e.m,[]); EX_BY_M.get(e.m).push(e); }
const COL_BY_M=new Map();
for(const c of COLLECTIONS) for(const id of c.museums){ if(!COL_BY_M.has(id)) COL_BY_M.set(id,[]); COL_BY_M.get(id).push(c); }

/* ---------- 日付 ---------- */
const today=new Date(); today.setHours(0,0,0,0);
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseYmd=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);};
const TODAY=ymd(today);
function fmtD(s){const d=parseYmd(s);const y=d.getFullYear()!==today.getFullYear()?d.getFullYear()+'/':'';return y+(d.getMonth()+1)+'/'+d.getDate()+'（'+WD[d.getDay()]+'）';}
function daysUntil(s){return Math.round((parseYmd(s)-today)/86400000);}

function openStatus(m,d){
  const s=ymd(d), mo=d.getMonth()+1, day=d.getDate(), w=d.getDay();
  if(m.closure) return {code:'closure',label:'休館中'};
  if(m.closedRanges&&m.closedRanges.some(r=>s>=r[0]&&s<=r[1])) return {code:'closed',label:'本日休館（展示替え）'};
  if((mo===12&&day>=28)||(mo===1&&day<=4)) return {code:'unknown',label:'年末年始・要確認'};
  if(m.unknownOpen) return {code:'unknown',label:'会期中のみ開館'};
  if(m.seasons){ if(!m.seasons.some(r=>s>=r[0]&&s<=r[1])) return {code:'seasonal',label:'季節開館・会期外'}; }
  else if(m.seasonMonths){ if(!m.seasonMonths.includes(mo)) return {code:'seasonal',label:'季節開館・会期外'}; }
  if(m.thirdThu&&w===4&&day>=15&&day<=21) return {code:'closed',label:'本日休館（第3木曜）'};
  const holOpen=!!m.holidayRule, nextClosed=holOpen&&/翌/.test(m.closed||'');
  if(m.closedDays.includes(w)){
    if(holOpen&&HOLIDAYS.has(s)) return {code:'open',label:'本日開館（祝日）'};
    return {code:'closed',label:'本日休館'};
  }
  if(nextClosed){ const y=new Date(d); y.setDate(y.getDate()-1); if(HOLIDAYS.has(ymd(y))&&m.closedDays.includes(y.getDay())) return {code:'closed',label:'本日休館（祝日の翌日）'}; }
  return {code:'open',label:'本日開館'};
}
function exStatus(e){
  if(e.start>TODAY) return {code:'upcoming',label:'開催予定'};
  if(e.end<TODAY) return {code:'ended',label:'終了'};
  const left=daysUntil(e.end);
  if(left<=14) return {code:'ending',label:left===0?'本日まで':'あと'+left+'日'};
  return {code:'open',label:'開催中'};
}
function exLive(m){return (EX_BY_M.get(m.id)||[]).filter(e=>{const c=exStatus(e).code;return c==='open'||c==='ending';});}
function exFuture(m){return (EX_BY_M.get(m.id)||[]).filter(e=>exStatus(e).code!=='ended').sort((a,b)=>a.start.localeCompare(b.start));}

/* ---------- 状態 ---------- */
const state={tab:'list',q:'',prefs:new Set(),cats:new Set(),tags:new Set(),openToday:false,hasEx:false,sort:'pick',exFilter:'all',favs:new Set(),railOpen:false,zoom:'all'};
function loadFavs(){try{const a=JSON.parse(localStorage.getItem('kmt.favs')||'[]');if(Array.isArray(a))a.forEach(id=>{if(BY_ID.has(id))state.favs.add(id);});}catch(e){}}
function saveFavs(){try{localStorage.setItem('kmt.favs',JSON.stringify([...state.favs]));}catch(e){}}
loadFavs();

const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function norm(s){return String(s).normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));}

function matchesBase(m){
  if(state.prefs.size&&!state.prefs.has(m.pref)) return false;
  if(state.cats.size&&!state.cats.has(m.cat)) return false;
  if(state.tags.size) for(const t of state.tags) if(!m.tags.includes(t)) return false;
  if(state.q){
    const q=norm(state.q.trim()); if(q){
      const hay=norm([m.name,m.kana,m.pref,m.city,m.area,m.note,m.highlights.join(' '),m.tags.join(' '),m.arch||'',(EX_BY_M.get(m.id)||[]).map(e=>e.title).join(' ')].join(' '));
      if(!hay.includes(q)) return false;
    }
  }
  return true;
}
function matches(m){
  if(!matchesBase(m)) return false;
  if(state.openToday&&openStatus(m,today).code!=='open') return false;
  if(state.hasEx&&!exLive(m).length) return false;
  return true;
}
function sortList(list){
  const pi=m=>PREFS.indexOf(m.pref), cl=m=>m.closure?1:0;
  const byKana=(a,b)=>a.kana.localeCompare(b.kana,'ja');
  const s=list.slice();
  if(state.sort==='pick') s.sort((a,b)=>cl(a)-cl(b)||b.pick-a.pick||pi(a)-pi(b)||byKana(a,b));
  else if(state.sort==='pref') s.sort((a,b)=>pi(a)-pi(b)||cl(a)-cl(b)||b.pick-a.pick||byKana(a,b));
  else if(state.sort==='kana') s.sort(byKana);
  else if(state.sort==='ex') s.sort((a,b)=>exLive(b).length-exLive(a).length||b.pick-a.pick||byKana(a,b));
  return s;
}
function filtersActive(){return !!(state.q.trim()||state.prefs.size||state.cats.size||state.tags.size||state.openToday||state.hasEx);}

/* ---------- 描画: レール ---------- */
function chip(label,key,group,pressed,count){return '<button type="button" class="chip" data-group="'+group+'" data-key="'+esc(key)+'" aria-pressed="'+pressed+'">'+esc(label)+(count!=null?'<span class="c">'+count+'</span>':'')+'</button>';}
function renderRail(){
  $('chips-pref').innerHTML=PREFS.map(p=>chip(p,p,'pref',state.prefs.has(p),MUSEUMS.filter(m=>m.pref===p).length)).join('');
  $('chips-cat').innerHTML=Object.keys(CATS).map(c=>chip(CATS[c],c,'cat',state.cats.has(c),MUSEUMS.filter(m=>m.cat===c).length)).join('');
  const tags=TAG_ORDER.filter(t=>MUSEUMS.some(m=>m.tags.includes(t)));
  $('chips-tag').innerHTML=tags.map(t=>chip(t,t,'tag',state.tags.has(t))).join('');
  $('open-today').checked=state.openToday; $('has-ex').checked=state.hasEx; $('sort').value=state.sort; $('q').value=state.q;
  $('rail-toggle').classList.toggle('active',filtersActive());
}
function syncRail(){
  const desktop=window.matchMedia('(min-width:900px)').matches;
  $('rail-body').hidden=desktop?false:!state.railOpen;
  $('rail-toggle').setAttribute('aria-expanded',String(state.railOpen));
}

/* ---------- 描画: カード ---------- */
function card(m){
  const st=openStatus(m,today), live=exLive(m).length;
  const noteText=m.closure?('休館中: '+m.closure):m.note;
  return '<article class="card" data-id="'+m.id+'">'+
    '<div class="spine"><span>'+esc(m.pref)+'　'+esc(m.area)+'</span></div>'+
    '<div class="card-body">'+
      '<div class="card-top"><span class="cat '+m.cat+'">'+CATS[m.cat]+'</span><span class="pill '+st.code+'">'+st.label+'</span></div>'+
      '<h3 class="name"><button type="button" data-open="'+m.id+'">'+esc(m.name)+'</button>'+(m.pick===3?'<span class="pick">おすすめ</span>':'')+'</h3>'+
      '<p class="note">'+esc(noteText)+'</p>'+
      '<ul class="tags">'+m.tags.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>'+
      '<div class="card-foot"><span>'+(live?'<span class="ex">会期中の展覧会 '+live+'件</span>':'<span>所要 '+esc(m.time)+'の目安</span>')+'</span>'+
      '<button class="fav" type="button" data-fav="'+m.id+'" aria-pressed="'+state.favs.has(m.id)+'"><span class="h"></span>行きたい</button></div>'+
    '</div></article>';
}
function renderList(){
  const list=sortList(MUSEUMS.filter(matches));
  $('list-count').textContent=list.length;
  $('list-hint').textContent=filtersActive()?'絞り込み中（全'+MUSEUMS.length+'館）':'編集部のおすすめ順。カードの館名で詳細を開けます';
  $('list-grid').innerHTML=list.length?list.map(card).join(''):'<div class="empty">条件に合う館がありません。条件を減らしてみてください。</div>';
}
function renderSaved(){
  const list=sortList(MUSEUMS.filter(m=>state.favs.has(m.id)));
  $('saved-count').textContent=list.length;
  const openN=list.filter(m=>openStatus(m,today).code==='open').length;
  $('saved-hint').textContent=list.length?('うち本日開館 '+openN+'館。この端末のブラウザに保存されます'):'';
  $('saved-grid').innerHTML=list.length?list.map(card).join(''):'<div class="empty">まだありません。カードの「♡ 行きたい」で、気になる館をここに集められます。</div>';
}

/* ---------- 描画: 展覧会 ---------- */
function exRow(e,withMuseum){
  const m=BY_ID.get(e.m), st=exStatus(e);
  return '<li class="ex-row">'+
    '<div class="ex-date"><span class="d">'+fmtD(e.start)+' – '+fmtD(e.end)+'</span><span class="ex-badge '+st.code+'">'+st.label+'</span></div>'+
    '<div class="ex-main"><h3 class="ex-title">'+esc(e.title)+'</h3>'+
    (withMuseum?'<div class="ex-museum"><button type="button" data-open="'+m.id+'">'+esc(m.name)+'</button><span style="color:var(--fg-3)">　'+esc(m.pref)+'・'+esc(m.area)+'</span></div>':'')+
    (e.note?'<p class="ex-note">'+esc(e.note)+'</p>':'')+
    '<div class="ex-meta">'+(e.src?'<a href="'+esc(e.src)+'" target="_blank" rel="noopener">会期の出典</a>':'')+(e.conf!=='high'?'<span class="conf-m">会期は要確認</span>':'')+'</div>'+
    '</div></li>';
}
function renderExhibitions(){
  const f=state.exFilter;
  const opts=[['all','すべて'],['open','開催中'],['ending','まもなく終了'],['upcoming','開催予定']];
  $('ex-tools').innerHTML=opts.map(o=>'<button type="button" class="chip" data-exf="'+o[0]+'" aria-pressed="'+(f===o[0])+'">'+o[1]+'</button>').join('');
  let list=EXHIBITIONS.filter(e=>matchesBase(BY_ID.get(e.m))).map(e=>({e,st:exStatus(e)})).filter(x=>x.st.code!=='ended');
  if(f==='open') list=list.filter(x=>x.st.code==='open'||x.st.code==='ending');
  else if(f==='ending') list=list.filter(x=>x.st.code==='ending');
  else if(f==='upcoming') list=list.filter(x=>x.st.code==='upcoming');
  list.sort((a,b)=>{const ua=a.st.code==='upcoming',ub=b.st.code==='upcoming';if(ua!==ub)return ua?1:-1;return ua?a.e.start.localeCompare(b.e.start):a.e.end.localeCompare(b.e.end);});
  $('ex-count').textContent=list.length;
  $('ex-list').innerHTML=list.length?list.map(x=>exRow(x.e,true)).join(''):'<li class="empty" style="border:0">条件に合う展覧会がありません。</li>';
}

/* ---------- 描画: 特集 ---------- */
function renderCollections(){
  $('col-list').innerHTML=COLLECTIONS.map(c=>{
    const rows=c.museums.map(id=>{const m=BY_ID.get(id);const st=openStatus(m,today);const live=exLive(m).length;
      return '<li><button type="button" class="n" data-open="'+m.id+'">'+esc(m.name)+'</button><span class="p">'+esc(m.pref)+'・'+esc(m.area)+'</span><span class="s">'+(live?'<span>展覧会 '+live+'件</span>':'')+'<span class="pill '+st.code+'">'+st.label+'</span></span></li>';}).join('');
    return '<article class="col" id="col-'+c.id+'"><h2>'+esc(c.title)+'</h2><p class="lead">'+esc(c.lead)+'</p><p class="tip"><b>めぐり方のヒント</b>'+esc(c.tip)+'</p><ul class="col-museums">'+rows+'</ul></article>';
  }).join('');
}

/* ---------- 描画: 地図（概略図） ---------- */
const LNG0=134.30,LAT0=35.80,S=400,KX=Math.cos(34.6*Math.PI/180);
const px=lng=>(lng-LNG0)*S*KX, py=lat=>(LAT0-lat)*S;
const MAP_W=px(136.45), MAP_H=py(33.45);
const COAST=[[35.65,134.30],[35.65,134.45],[35.63,134.63],[35.64,134.82],[35.58,134.95],[35.55,135.10],[35.62,135.20],[35.75,135.22],[35.68,135.33],[35.55,135.28],[35.50,135.35],[35.47,135.42],[35.53,135.52],[35.48,135.62],[35.45,135.75],[35.55,135.95],[35.62,136.10],[35.62,136.45],[34.30,136.45],[34.20,136.33],[34.07,136.19],[33.88,136.10],[33.72,136.00],[33.60,135.95],[33.47,135.78],[33.55,135.50],[33.68,135.34],[33.72,135.37],[33.77,135.33],[33.88,135.15],[33.95,135.10],[34.08,135.10],[34.23,135.15],[34.32,135.12],[34.40,135.31],[34.47,135.36],[34.58,135.43],[34.65,135.43],[34.70,135.40],[34.71,135.34],[34.68,135.19],[34.64,135.11],[34.63,135.03],[34.64,134.99],[34.75,134.78],[34.78,134.67],[34.74,134.37],[34.74,134.30]];
const AWAJI=[[34.60,135.02],[34.55,134.98],[34.40,134.92],[34.30,134.85],[34.25,134.72],[34.33,134.72],[34.45,134.78],[34.55,134.95]];
const BIWA=[[35.00,135.87],[35.03,135.90],[35.07,135.93],[35.10,135.95],[35.15,136.03],[35.22,136.10],[35.27,136.22],[35.35,136.26],[35.42,136.22],[35.50,136.12],[35.48,136.05],[35.40,136.02],[35.30,135.98],[35.20,135.92],[35.12,135.90],[35.05,135.87]];
const CITIES=[['大阪',34.69,135.50],['京都',35.01,135.76],['神戸',34.69,135.19],['奈良',34.68,135.83],['大津',35.01,135.86],['和歌山',34.23,135.17],['姫路',34.83,134.69],['田辺',33.73,135.38],['高野山',34.21,135.58],['舞鶴',35.47,135.39],['長浜',35.38,136.27],['信楽',34.90,136.05],['新宮',33.72,136.00],['橿原',34.50,135.79]];
const PREF_LABELS=[['京 都 府',35.33,135.60],['兵 庫 県',35.18,134.72],['滋 賀 県',35.30,136.38],['奈 良 県',34.38,135.95],['和 歌 山 県',33.95,135.60],['大 阪 府',34.58,135.60]];
const ZOOMS={all:{label:'関西全域',lat:[33.45,35.80],lng:[134.30,136.45]},keihanshin:{label:'京阪神',lat:[34.55,35.12],lng:[135.05,135.98]},nara:{label:'奈良・南大阪',lat:[34.38,34.78],lng:[135.38,135.92]},shiga:{label:'滋賀',lat:[34.84,35.46],lng:[135.78,136.36]},wakayama:{label:'和歌山',lat:[33.48,34.32],lng:[135.03,136.05]}};
function poly(pts){return pts.map(p=>px(p[1]).toFixed(1)+','+py(p[0]).toFixed(1)).join(' ');}
let mapBuilt=false;
function buildMap(){
  if(mapBuilt) return; mapBuilt=true;
  const dots=MUSEUMS.map(m=>'<circle class="pt '+m.cat+'" data-id="'+m.id+'" cx="'+px(m.lng).toFixed(1)+'" cy="'+py(m.lat).toFixed(1)+'" r="5"><title>'+esc(m.name)+'</title></circle>').join('');
  const cities=CITIES.map(c=>'<g class="cityg"><circle class="cityDot" cx="'+px(c[2]).toFixed(1)+'" cy="'+py(c[1]).toFixed(1)+'" r="1.8"/><text class="city" x="'+(px(c[2])+4).toFixed(1)+'" y="'+(py(c[1])-4).toFixed(1)+'">'+c[0]+'</text></g>').join('');
  const prefs=PREF_LABELS.map(c=>'<text class="pref" x="'+px(c[2]).toFixed(1)+'" y="'+py(c[1]).toFixed(1)+'" text-anchor="middle">'+c[0]+'</text>').join('');
  $('map-frame').innerHTML='<svg id="map-svg" viewBox="0 0 '+MAP_W.toFixed(0)+' '+MAP_H.toFixed(0)+'" role="img" aria-label="関西の館の位置を示す概略図">'+
    '<polygon class="land" points="'+poly(COAST)+'"/><polygon class="land" points="'+poly(AWAJI)+'"/><polygon class="lake" points="'+poly(BIWA)+'"/>'+
    prefs+cities+'<g id="map-dots">'+dots+'</g></svg><div class="map-hover" id="map-hover"></div>';
  $('legend').innerHTML=Object.keys(CATS).map(c=>'<span style="--c:var(--cat-'+c+')">'+CATS[c]+'</span>').join('');
  const svg=$('map-svg'), hover=$('map-hover'), frame=$('map-frame');
  svg.addEventListener('mousemove',ev=>{const t=ev.target.closest('.pt');if(!t){hover.classList.remove('show');return;}const r=frame.getBoundingClientRect();hover.textContent=BY_ID.get(t.dataset.id).name;hover.style.left=(ev.clientX-r.left)+'px';hover.style.top=(ev.clientY-r.top)+'px';hover.classList.add('show');});
  svg.addEventListener('mouseleave',()=>hover.classList.remove('show'));
  svg.addEventListener('click',ev=>{const t=ev.target.closest('.pt');if(t)openDetail(t.dataset.id);});
}
function renderMap(){
  buildMap();
  $('map-zoom').innerHTML=Object.keys(ZOOMS).map(k=>'<button type="button" class="chip" data-zoom="'+k+'" aria-pressed="'+(state.zoom===k)+'">'+ZOOMS[k].label+'</button>').join('');
  const z=ZOOMS[state.zoom], x0=px(z.lng[0]), y0=py(z.lat[1]), w=px(z.lng[1])-x0, h=py(z.lat[0])-y0;
  const svg=$('map-svg'); svg.setAttribute('viewBox',x0.toFixed(1)+' '+y0.toFixed(1)+' '+w.toFixed(1)+' '+h.toFixed(1));
  const k=w/MAP_W;
  svg.querySelectorAll('.pt').forEach(el=>{const m=BY_ID.get(el.dataset.id);el.setAttribute('r',((m.pick===3?6.5:5)*Math.max(k,0.38)).toFixed(2));el.classList.toggle('dim',!matches(m));});
  svg.querySelectorAll('.city').forEach(el=>el.setAttribute('font-size',(11*Math.max(k,0.45)).toFixed(1)));
  svg.querySelectorAll('.cityDot').forEach(el=>el.setAttribute('r',(1.8*Math.max(k,0.45)).toFixed(2)));
  svg.querySelectorAll('.pref').forEach(el=>el.setAttribute('font-size',(13*Math.max(k,0.45)).toFixed(1)));
}

/* ---------- 詳細パネル ---------- */
let lastFocus=null;
function openDetail(id){
  const m=BY_ID.get(id); if(!m) return;
  const st=openStatus(m,today), exs=exFuture(m), cols=COL_BY_M.get(id)||[];
  const gmaps='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(m.name+' '+m.city);
  let info='<dt>開館時間</dt><dd>'+esc(m.hours)+'</dd><dt>休館日</dt><dd>'+esc(m.closed)+'</dd>';
  if(m.seasonal) info+='<dt>開館期間</dt><dd>'+esc(m.seasonal)+'</dd>';
  info+='<dt>料金</dt><dd>'+esc(m.fee)+'</dd><dt>アクセス</dt><dd>'+esc(m.access)+'</dd><dt>所要時間</dt><dd>'+esc(m.time)+'の目安</dd>';
  if(m.arch) info+='<dt>建築</dt><dd>'+esc(m.arch)+'</dd>';
  $('sheet-in').innerHTML=
    '<div class="sheet-head"><div><p class="where">'+esc(m.pref)+' ・ '+esc(m.city)+' ・ '+esc(m.area)+'</p><h2 id="sheet-title">'+esc(m.name)+'</h2><p class="kana">'+esc(m.kana)+'</p></div><button type="button" class="close" id="sheet-close" aria-label="閉じる">×</button></div>'+
    '<div class="status-row"><span class="cat '+m.cat+'">'+CATS[m.cat]+'</span><span class="pill '+st.code+'">'+st.label+'</span>'+(m.pick===3?'<span class="pick" style="margin:0">編集部おすすめ</span>':'')+'</div>'+
    (m.closure?'<div class="closure-box">休館中: '+esc(m.closure)+'</div>':'')+(m.notice?'<div class="notice-box">'+esc(m.notice)+'</div>':'')+
    '<p class="note-full">'+esc(m.note)+'</p>'+
    '<section><h3>見どころ</h3><ul class="hl">'+m.highlights.map(h=>'<li>'+esc(h)+'</li>').join('')+'</ul></section>'+
    '<section><h3>基本情報</h3><dl class="info">'+info+'</dl></section>'+
    '<section><h3>展覧会（会期中・予定）</h3>'+(exs.length?'<ul class="ex-list">'+exs.map(e=>exRow(e,false)).join('')+'</ul>':'<p class="ex-note" style="margin:0">'+DATA_ASOF.replace(/-/g,'/')+'時点の調査では会期中・予定の展覧会情報を確認できませんでした。公式サイトでご確認ください。</p>')+'</section>'+
    (cols.length?'<section><h3>この館が登場する特集</h3><div class="col-links">'+cols.map(c=>'<button type="button" data-col="'+c.id+'">'+esc(c.title)+'</button>').join('')+'</div></section>':'')+
    '<div class="actions"><a class="btn primary" href="'+esc(m.url)+'" target="_blank" rel="noopener">公式サイト</a><a class="btn" href="'+gmaps+'" target="_blank" rel="noopener">Googleマップ</a><button type="button" class="btn fav-btn" data-fav="'+m.id+'" aria-pressed="'+state.favs.has(m.id)+'"><span class="h"></span> 行きたい</button></div>';
  lastFocus=document.activeElement;
  $('sheet').classList.add('show'); $('backdrop').classList.add('show'); $('sheet').setAttribute('aria-hidden','false'); $('sheet').scrollTop=0;
  document.body.style.overflow='hidden';
  $('sheet-close').focus();
}
function closeDetail(){
  if(!$('sheet').classList.contains('show')) return;
  $('sheet').classList.remove('show'); $('backdrop').classList.remove('show'); $('sheet').setAttribute('aria-hidden','true');
  document.body.style.overflow='';
  if(lastFocus&&document.contains(lastFocus)) lastFocus.focus();
}

/* ---------- 共通 ---------- */
function toggleFav(id){
  if(state.favs.has(id)) state.favs.delete(id); else state.favs.add(id);
  saveFavs();
  document.querySelectorAll('[data-fav="'+id+'"]').forEach(b=>b.setAttribute('aria-pressed',String(state.favs.has(id))));
  $('cnt-saved').textContent=state.favs.size?'('+state.favs.size+')':'';
  if(state.tab==='saved') renderSaved();
}
function renderTodayLine(){
  const openN=MUSEUMS.filter(m=>openStatus(m,today).code==='open').length;
  const live=EXHIBITIONS.filter(e=>{const c=exStatus(e).code;return c==='open'||c==='ending';});
  const ending=live.filter(e=>exStatus(e).code==='ending').length;
  $('today-line').innerHTML='<span><strong>'+(today.getMonth()+1)+'月'+today.getDate()+'日（'+WD[today.getDay()]+'）</strong></span>'+
    '<span><span class="num">'+openN+'</span>館が本日開館</span><span><span class="num">'+live.length+'</span>件の展覧会が会期中</span>'+(ending?'<span>うち2週間以内に終了 '+ending+'件</span>':'');
}
function setTab(tab,push){
  if(!['list','exhibitions','collections','map','saved'].includes(tab)) tab='list';
  state.tab=tab;
  document.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));
  ['list','exhibitions','collections','map','saved'].forEach(t=>{$('view-'+t).hidden=t!==tab;});
  $('rail').hidden=(tab==='collections'||tab==='saved');
  document.querySelector('.layout').classList.toggle('no-rail',$('rail').hidden);
  render();
  if(push!==false){try{history.replaceState(null,'','#'+tab);}catch(e){}}
}
function render(){
  if(state.tab==='list') renderList();
  else if(state.tab==='exhibitions') renderExhibitions();
  else if(state.tab==='collections') renderCollections();
  else if(state.tab==='map') renderMap();
  else if(state.tab==='saved') renderSaved();
  $('rail-toggle').classList.toggle('active',filtersActive());
}

/* ---------- イベント ---------- */
document.addEventListener('click',ev=>{
  const t=ev.target.closest('button,a'); if(!t) return;
  if(t.dataset.open){openDetail(t.dataset.open);return;}
  if(t.dataset.fav){toggleFav(t.dataset.fav);return;}
  if(t.dataset.col){closeDetail();setTab('collections');const el=$('col-'+t.dataset.col);if(el)el.scrollIntoView({block:'start'});return;}
  if(t.dataset.tab){setTab(t.dataset.tab);return;}
  if(t.dataset.group){
    const set=t.dataset.group==='pref'?state.prefs:t.dataset.group==='cat'?state.cats:state.tags;
    const k=t.dataset.key; if(set.has(k)) set.delete(k); else set.add(k);
    t.setAttribute('aria-pressed',String(set.has(k))); render(); return;
  }
  if(t.dataset.exf){state.exFilter=t.dataset.exf;renderExhibitions();return;}
  if(t.dataset.zoom){state.zoom=t.dataset.zoom;renderMap();return;}
  if(t.id==='sheet-close'){closeDetail();return;}
  if(t.id==='reset'){state.q='';state.prefs.clear();state.cats.clear();state.tags.clear();state.openToday=false;state.hasEx=false;state.sort='pick';renderRail();render();return;}
  if(t.id==='rail-toggle'){state.railOpen=!state.railOpen;syncRail();return;}
});
$('backdrop').addEventListener('click',closeDetail);
document.addEventListener('keydown',ev=>{if(ev.key==='Escape')closeDetail();});
$('q').addEventListener('input',ev=>{state.q=ev.target.value;render();});
$('open-today').addEventListener('change',ev=>{state.openToday=ev.target.checked;render();});
$('has-ex').addEventListener('change',ev=>{state.hasEx=ev.target.checked;render();});
$('sort').addEventListener('change',ev=>{state.sort=ev.target.value;render();});
window.matchMedia('(min-width:900px)').addEventListener('change',syncRail);
window.addEventListener('hashchange',()=>setTab((location.hash||'#list').slice(1),false));

/* ---------- 初期化 ---------- */
$('data-asof').textContent=DATA_ASOF.replace(/-/g,'年').replace('年','年').replace(/^(\d+)年(\d+)年(\d+)$/,'$1年$2月$3日');
$('cnt-list').textContent='('+MUSEUMS.length+')';
$('cnt-exhibitions').textContent='('+EXHIBITIONS.filter(e=>exStatus(e).code!=='ended').length+')';
$('cnt-collections').textContent='('+COLLECTIONS.length+')';
$('cnt-saved').textContent=state.favs.size?'('+state.favs.size+')':'';
renderTodayLine(); renderRail(); syncRail();
setTab((location.hash||'#list').slice(1),false);
window.KMT={openStatus:openStatus,exStatus:exStatus,MUSEUMS:MUSEUMS,EXHIBITIONS:EXHIBITIONS};
})();
