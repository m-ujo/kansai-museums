(function(){
'use strict';
const DATA_ASOF='2026-10-16';
const PREFS=['大阪','京都','兵庫','奈良','滋賀','和歌山','三重'];
const CATS={art:'美術館',history:'歴史・考古',science:'自然・科学',craft:'工芸・陶磁',special:'テーマ・専門',temple:'寺社宝物館'};
const TAG_ORDER=['国宝','建築','庭園','日本画','現代美術','西洋美術','仏教美術','陶磁・茶の湯','工芸','考古','歴史','自然・科学','写真','文学','マンガ・サブカル','子ども向け','体験型','無料','駅近','夜間開館','季節限定'];
const HOLIDAYS=new Set(['2026-01-01','2026-01-12','2026-02-11','2026-02-23','2026-03-20','2026-04-29','2026-05-03','2026-05-04','2026-05-05','2026-05-06','2026-07-20','2026-08-11','2026-09-21','2026-09-22','2026-09-23','2026-10-12','2026-11-03','2026-11-23',
 '2027-01-01','2027-01-11','2027-02-11','2027-02-23','2027-03-21','2027-03-22','2027-04-29','2027-05-03','2027-05-04','2027-05-05','2027-07-19','2027-08-11','2027-09-20','2027-09-23','2027-10-11','2027-11-03','2027-11-23']);
const WD=['日','月','火','水','木','金','土'];

const MUSEUMS=[].concat(MUSEUMS_OSAKA,MUSEUMS_KYOTO,MUSEUMS_HYOGO,MUSEUMS_NARA,MUSEUMS_SHIGA,MUSEUMS_WAKAYAMA,MUSEUMS_MIE);
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
  if(m.closedRanges){ const r=m.closedRanges.find(r=>s>=r[0]&&s<=r[1]); if(r) return {code:'closed',label:'本日休館（'+(r[2]||'展示替え')+'）'}; }
  if((mo===12&&day>=28)||(mo===1&&day<=4)) return {code:'unknown',label:'年末年始・要確認'};
  if(m.unknownOpen) return {code:'unknown',label:'会期中のみ開館'};
  if(m.seasons){ if(!m.seasons.some(r=>s>=r[0]&&s<=r[1])) return {code:'seasonal',label:'季節開館・会期外'}; }
  else if(m.seasonMonths){ if(!m.seasonMonths.includes(mo)) return {code:'seasonal',label:'季節開館・会期外'}; }
  if(m.nthClosed){
    const nc=m.nthClosed, nth=x=>Math.floor((x.getDate()-1)/7)+1, hit=x=>x.getDay()===nc.wd&&nc.n.includes(nth(x));
    const shift=/祝日の場合は翌日/.test(m.closed||'');
    if(hit(d)&&!(shift&&HOLIDAYS.has(s))) return {code:'closed',label:'本日休館（第'+nth(d)+'日月火水木金土'[w]+'曜）'};
    if(shift){ const y=new Date(d); y.setDate(y.getDate()-1); if(hit(y)&&HOLIDAYS.has(ymd(y))) return {code:'closed',label:'本日休館（祝日の翌日）'}; }
  }
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
function exLink(e){const m=BY_ID.get(e.m);if(e.page)return {href:e.page,kind:e.kind||'official'};const idx=(typeof EX_INDEX_URLS!=='undefined')&&EX_INDEX_URLS[e.m];if(idx)return {href:idx,kind:'index'};return {href:m.url,kind:'home'};}
function exHref(e){return exLink(e).href;}
function exTitle(e,cls){return '<a class="'+(cls||'ex-link')+'" href="'+esc(exHref(e))+'" target="_blank" rel="noopener">'+esc(e.title)+'</a>';}
function exLive(m){return (EX_BY_M.get(m.id)||[]).filter(e=>{const c=exStatus(e).code;return c==='open'||c==='ending';});}
function exFuture(m){return (EX_BY_M.get(m.id)||[]).filter(e=>exStatus(e).code!=='ended').sort((a,b)=>a.start.localeCompare(b.start));}

/* ---------- 状態 ---------- */
const state={tab:'list',q:'',prefs:new Set(),cats:new Set(),tags:new Set(),openToday:false,hasEx:false,sort:'pick',exFilter:'open',exView:'timeline',favs:new Set(),railOpen:false,zoom:'all'};
function loadFavs(){try{const a=JSON.parse(localStorage.getItem('kmt.favs')||'[]');if(Array.isArray(a))a.forEach(id=>{if(BY_ID.has(id))state.favs.add(id);});}catch(e){}}
function saveFavs(){try{localStorage.setItem('kmt.favs',JSON.stringify([...state.favs]));}catch(e){}}
loadFavs();

const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function norm(s){return String(s).normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));}

function matchesBase(m,noPref){
  if(!noPref&&state.prefs.size&&!state.prefs.has(m.pref)) return false;
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
// 地図用: 地図タブには府県の絞り込みを出さないので、府県は条件に入れない
function mapMatches(m){
  if(!matchesBase(m,true)) return false;
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
    '<div class="ex-main"><h3 class="ex-title">'+exTitle(e)+'</h3>'+
    (withMuseum?'<div class="ex-museum"><button type="button" data-open="'+m.id+'">'+esc(m.name)+'</button><span style="color:var(--fg-3)">　'+esc(m.pref)+'・'+esc(m.area)+'</span></div>':'')+
    (e.note?'<p class="ex-note">'+esc(e.note)+'</p>':'')+
    '<div class="ex-meta"><span>'+({official:'リンク先: 公式の展覧会ページ',news:'リンク先: 公式サイトのお知らせ',pdf:'リンク先: 公式の案内（PDF）',index:'リンク先: 館の展覧会一覧',listing:'リンク先: 展覧会情報サイト',home:'リンク先: 館の公式サイト'}[exLink(e).kind]||'リンク先: 展覧会のページ')+'</span>'+(e.src&&e.src!==exHref(e)?'<a href="'+esc(e.src)+'" target="_blank" rel="noopener">会期の出典</a>':'')+(e.conf!=='high'?'<span class="conf-m">会期は要確認</span>':'')+'</div>'+
    '</div></li>';
}
function fmtShort(s){const d=parseYmd(s);return (d.getMonth()+1)+'/'+d.getDate();}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function exFiltered(){
  const f=state.exFilter;
  let list=EXHIBITIONS.filter(e=>matchesBase(BY_ID.get(e.m))).map(e=>({e,st:exStatus(e)})).filter(x=>x.st.code!=='ended');
  if(f==='open') list=list.filter(x=>x.st.code==='open'||x.st.code==='ending');
  else if(f==='ending') list=list.filter(x=>x.st.code==='ending');
  else if(f==='upcoming') list=list.filter(x=>x.st.code==='upcoming');
  list.sort((a,b)=>{const ua=a.st.code==='upcoming',ub=b.st.code==='upcoming';if(ua!==ub)return ua?1:-1;return ua?a.e.start.localeCompare(b.e.start):a.e.end.localeCompare(b.e.end);});
  return list;
}
function renderExhibitions(){
  const f=state.exFilter, v=state.exView;
  const opts=[['open','開催中'],['ending','まもなく終了'],['upcoming','開催予定'],['all','すべて']];
  $('ex-tools').innerHTML=opts.map(o=>'<button type="button" class="chip" data-exf="'+o[0]+'" aria-pressed="'+(f===o[0])+'">'+o[1]+'</button>').join('');
  const views=[['timeline','タイムライン'],['board','館ごと'],['list','リスト']];
  $('ex-views').innerHTML=views.map(o=>'<button type="button" class="chip" data-exv="'+o[0]+'" aria-pressed="'+(v===o[0])+'">'+o[1]+'</button>').join('');
  const list=exFiltered();
  $('ex-count').textContent=list.length;
  const hints={timeline:'横軸が日付、縦線が今日。展覧会名や棒で展覧会のページ、館名で館の詳細が開きます',board:'府県ごと・館ごとにまとめた一覧。展覧会名で展覧会のページ、館名で館の詳細が開きます',list:'会期終了が近い順。展覧会名で展覧会のページが開きます'};
  $('ex-hint').textContent=hints[v];
  $('ex-timeline').hidden=v!=='timeline'; $('ex-board').hidden=v!=='board'; $('ex-list').hidden=v!=='list';
  if(!list.length){const empty='<div class="empty">条件に合う展覧会がありません。</div>';$('ex-timeline').innerHTML=empty;$('ex-board').innerHTML=empty;$('ex-list').innerHTML='<li class="empty" style="border:0">条件に合う展覧会がありません。</li>';return;}
  if(v==='timeline') renderTimeline(list);
  else if(v==='board') renderBoard(list);
  else $('ex-list').innerHTML=list.map(x=>exRow(x.e,true)).join('');
}
function groupByPref(list){
  const g=new Map(); for(const p of PREFS) g.set(p,[]);
  for(const x of list) g.get(BY_ID.get(x.e.m).pref).push(x);
  return g;
}
function renderTimeline(list){
  const rangeStart=addDays(today,-7);
  let maxStart=TODAY; for(const x of list) if(x.e.start>maxStart) maxStart=x.e.start;
  const DAYS=Math.min(210,Math.max(112,daysUntil(maxStart)+21));
  const rangeEnd=addDays(rangeStart,DAYS);
  const pos=d=>Math.min(100,Math.max(0,(d-rangeStart)/86400000/DAYS*100));
  // 月の境目
  let months='', grid='';
  const cur=new Date(rangeStart.getFullYear(),rangeStart.getMonth()+1,1);
  while(cur<rangeEnd){const l=pos(cur).toFixed(2);months+='<span class="tl-month" style="left:'+l+'%">'+(cur.getMonth()+1)+'月'+(cur.getMonth()===0?'<small>'+cur.getFullYear()+'</small>':'')+'</span>';grid+='<span class="gl" style="left:'+l+'%"></span>';cur.setMonth(cur.getMonth()+1);}
  const tp=pos(today).toFixed(2);
  const groups=groupByPref(list); let rows='';
  for(const [pref,items] of groups){
    if(!items.length) continue;
    items.sort((a,b)=>a.e.start.localeCompare(b.e.start)||a.e.end.localeCompare(b.e.end));
    rows+='<div class="tl-group">'+esc(pref)+'<span class="c">'+items.length+'</span></div>';
    for(const x of items){
      const m=BY_ID.get(x.e.m), s=parseYmd(x.e.start), e=addDays(parseYmd(x.e.end),1);
      const l=pos(s), r=pos(e); const cutL=s<rangeStart, cutR=e>rangeEnd;
      const cls='tl-bar '+x.st.code+(cutL?' cut-l':'')+(cutR?' cut-r':'');
      const label=x.st.code==='upcoming'?fmtShort(x.e.start)+'から':x.st.code==='ending'?x.st.label:fmtShort(x.e.end)+'まで';
      rows+='<div class="tl-row"><div class="tl-label"><button type="button" class="tl-m" data-open="'+m.id+'">'+esc(m.name)+'</button><span class="tl-t" title="'+esc(x.e.title)+'">'+exTitle(x.e,'tl-link')+'</span><span class="tl-d">'+fmtShort(x.e.start)+'–'+fmtShort(x.e.end)+'</span></div>'+
        '<div class="tl-track"><a class="'+cls+'" href="'+esc(exHref(x.e))+'" target="_blank" rel="noopener" style="left:'+l.toFixed(2)+'%;width:'+Math.max(0.6,r-l).toFixed(2)+'%" title="'+esc(x.e.title)+'　'+fmtShort(x.e.start)+'–'+fmtShort(x.e.end)+'"><span class="visually-hidden">'+esc(x.e.title)+'</span></a>'+
        (r<97?'<span class="tl-end" style="left:'+r.toFixed(2)+'%">'+esc(label)+'</span>':'')+'</div></div>';
    }
  }
  $('ex-timeline').innerHTML='<div class="tl-inner"><div class="tl-head"><div class="tl-corner"><span class="tl-key"><i class="k open"></i>開催中</span><span class="tl-key"><i class="k ending"></i>2週間以内に終了</span><span class="tl-key"><i class="k upcoming"></i>開催予定</span></div><div class="tl-months">'+months+'<span class="tl-today" style="left:'+tp+'%">今日</span></div></div>'+
    '<div class="tl-body"><div class="tl-grid">'+grid+'<span class="today" style="left:'+tp+'%"></span></div>'+rows+'</div></div>';
}
function renderBoard(list){
  const groups=groupByPref(list); let html='';
  for(const [pref,items] of groups){
    if(!items.length) continue;
    const byM=new Map(); for(const x of items){ if(!byM.has(x.e.m)) byM.set(x.e.m,[]); byM.get(x.e.m).push(x); }
    const ms=[...byM.keys()].map(id=>BY_ID.get(id)).sort((a,b)=>b.pick-a.pick||a.kana.localeCompare(b.kana,'ja'));
    html+='<section class="board-group"><h2 class="board-pref">'+esc(pref)+'<span class="c">'+ms.length+'館 ・ '+items.length+'件</span></h2><div class="board-grid">';
    for(const m of ms){
      const st=openStatus(m,today);
      const exs=byM.get(m.id).sort((a,b)=>a.e.start.localeCompare(b.e.start));
      html+='<article class="bcard"><div class="bcard-head"><div><button type="button" class="bcard-name" data-open="'+m.id+'">'+esc(m.name)+'</button><div class="bcard-where">'+esc(m.area)+' ・ '+esc(m.hours)+'</div></div><span class="pill '+st.code+'">'+st.label+'</span></div><ul class="bcard-list">'+
        exs.map(x=>'<li><span class="ex-badge '+x.st.code+'">'+x.st.label+'</span><span class="bcard-t">'+exTitle(x.e)+'</span><span class="bcard-d">'+fmtShort(x.e.start)+'–'+fmtShort(x.e.end)+'</span></li>').join('')+'</ul></article>';
    }
    html+='</div></section>';
  }
  $('ex-board').innerHTML=html;
}

/* ---------- 描画: 特集 ---------- */
function renderCollections(){
  $('col-list').innerHTML=COLLECTIONS.map(c=>{
    const rows=c.museums.map(id=>{const m=BY_ID.get(id);const st=openStatus(m,today);const live=exLive(m).length;
      return '<li><button type="button" class="n" data-open="'+m.id+'">'+esc(m.name)+'</button><span class="p">'+esc(m.pref)+'・'+esc(m.area)+'</span><span class="s">'+(live?'<span>展覧会 '+live+'件</span>':'')+'<span class="pill '+st.code+'">'+st.label+'</span></span></li>';}).join('');
    return '<article class="col" id="col-'+c.id+'"><h2>'+esc(c.title)+'</h2><p class="lead">'+esc(c.lead)+'</p><p class="tip"><b>めぐり方のヒント</b>'+esc(c.tip)+'</p><ul class="col-museums">'+rows+'</ul></article>';
  }).join('');
}

/* ---------- 描画: 地図 ---------- */
const LNG0=134.25,LAT0=35.80,S=400,KX=Math.cos(34.6*Math.PI/180);
const px=lng=>(lng-LNG0)*S*KX, py=lat=>(LAT0-lat)*S;
const MAP_W=px(136.95), MAP_H=py(33.42);
const BIWA=[[35.00,135.87],[35.03,135.90],[35.07,135.93],[35.10,135.95],[35.15,136.03],[35.22,136.10],[35.27,136.22],[35.35,136.26],[35.42,136.22],[35.50,136.12],[35.48,136.05],[35.40,136.02],[35.30,135.98],[35.20,135.92],[35.12,135.90],[35.05,135.87]];
const CITIES=[['大阪',34.69,135.50],['京都',35.01,135.76],['神戸',34.69,135.19],['奈良',34.68,135.83],['大津',35.01,135.86],['和歌山',34.23,135.17],['姫路',34.83,134.69],['田辺',33.73,135.38],['高野山',34.21,135.58],['舞鶴',35.47,135.39],['長浜',35.38,136.27],['信楽',34.90,136.05],['新宮',33.72,136.00],['橿原',34.50,135.79],['津',34.72,136.51],['伊勢',34.49,136.71],['鳥羽',34.48,136.84],['四日市',34.97,136.62],['伊賀',34.77,136.13],['尾鷲',34.07,136.19]];
const PREF_LABELS=[['京 都 府',35.33,135.55],['兵 庫 県',35.15,134.72],['滋 賀 県',35.32,136.32],['奈 良 県',34.33,135.88],['和 歌 山 県',33.95,135.55],['大 阪 府',34.58,135.55],['三 重 県',34.60,136.40]];
const ZOOMS={all:{label:'関西全域',lat:[33.42,35.80],lng:[134.25,136.95]},keihanshin:{label:'京阪神',lat:[34.55,35.12],lng:[135.05,135.98]},nara:{label:'奈良・南大阪',lat:[34.38,34.78],lng:[135.38,135.92]},shiga:{label:'滋賀',lat:[34.84,35.46],lng:[135.78,136.36]},wakayama:{label:'和歌山',lat:[33.48,34.32],lng:[135.03,136.05]},mie:{label:'三重',lat:[34.20,35.12],lng:[136.05,136.95]}};
function ringPath(ring){return 'M'+ring.map(p=>px(p[0]).toFixed(1)+' '+py(p[1]).toFixed(1)).join('L')+'Z';}
function prefPath(polys){return polys.map(poly=>poly.map(ringPath).join('')).join('');}
function poly(pts){return pts.map(p=>px(p[1]).toFixed(1)+','+py(p[0]).toFixed(1)).join(' ');}
let mapMode=null, leaflet=null, appliedZoom=null;
function probeTiles(cb){
  if(typeof L==='undefined'){cb(false);return;}
  if(window.KMT_FORCE_TILES){cb(true);return;}
  let done=false; const fin=ok=>{if(!done){done=true;cb(ok);}};
  const img=new Image(); img.onload=()=>fin(true); img.onerror=()=>fin(false);
  setTimeout(()=>fin(false),5000); img.src='https://tile.openstreetmap.org/7/112/50.png';
}
function gmapsUrl(m){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(m.name+' '+m.city);}
function buildLeaflet(){
  $('map-frame').innerHTML='<div id="map-leaflet" class="map-leaflet"></div>';
  const map=L.map('map-leaflet',{scrollWheelZoom:true,zoomSnap:0.5});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map);
  const markers=new Map();
  for(const m of MUSEUMS){
    const c=L.circleMarker([m.lat,m.lng],{radius:m.pick===3?8:6,weight:1.5,fillOpacity:.95,className:'mk '+m.cat});
    c.bindTooltip(m.name,{direction:'top',offset:[0,-6]});
    c.on('click',()=>{
      const st=openStatus(m,today), live=exLive(m).length;
      c.bindPopup('<div class="mpop"><div class="cat '+m.cat+'">'+CATS[m.cat]+'</div><div class="mpop-name">'+esc(m.name)+'</div><div class="mpop-sub">'+esc(m.pref)+'・'+esc(m.area)+'　'+esc(m.hours)+'</div><div class="mpop-row"><span class="pill '+st.code+'">'+st.label+'</span>'+(live?'<span class="mpop-ex">会期中の展覧会 '+live+'件</span>':'')+'</div><div class="mpop-actions"><button type="button" class="btn primary" data-open="'+m.id+'">詳細を見る</button><a class="btn" href="'+gmapsUrl(m)+'" target="_blank" rel="noopener">Googleマップ</a></div></div>',{maxWidth:320,closeButton:true}).openPopup();
    });
    c.addTo(map); markers.set(m.id,c);
  }
  leaflet={map,markers};
}
function buildSvg(){
  const neigh=Object.keys(GEO.neighbor).map(n=>'<path class="neigh-land" d="'+prefPath(GEO.neighbor[n])+'"/>').join('');
  const land=Object.keys(GEO.target).map(n=>'<path class="pref-land" vector-effect="non-scaling-stroke" d="'+prefPath(GEO.target[n])+'"><title>'+n+'</title></path>').join('');
  const dots=MUSEUMS.map(m=>'<circle class="pt '+m.cat+'" vector-effect="non-scaling-stroke" data-id="'+m.id+'" cx="'+px(m.lng).toFixed(1)+'" cy="'+py(m.lat).toFixed(1)+'" r="5"><title>'+esc(m.name)+'</title></circle>').join('');
  const cities=CITIES.map(c=>'<g class="cityg"><circle class="cityDot" cx="'+px(c[2]).toFixed(1)+'" cy="'+py(c[1]).toFixed(1)+'" r="1.8"/><text class="city" x="'+(px(c[2])+4).toFixed(1)+'" y="'+(py(c[1])-4).toFixed(1)+'">'+c[0]+'</text></g>').join('');
  const prefs=PREF_LABELS.map(c=>'<text class="pref" x="'+px(c[2]).toFixed(1)+'" y="'+py(c[1]).toFixed(1)+'" text-anchor="middle">'+c[0]+'</text>').join('');
  $('map-frame').innerHTML='<svg id="map-svg" viewBox="0 0 '+MAP_W.toFixed(0)+' '+MAP_H.toFixed(0)+'" role="img" aria-label="関西の館の位置を示す地図">'+
    neigh+land+'<polygon class="lake" vector-effect="non-scaling-stroke" points="'+poly(BIWA)+'"/>'+prefs+cities+'<g id="map-dots">'+dots+'</g></svg><div class="map-hover" id="map-hover"></div>';
  $('map-frame').insertAdjacentHTML('beforeend','<div class="map-ctrl"><button type="button" data-mapzoom="in" aria-label="拡大">＋</button><button type="button" data-mapzoom="out" aria-label="縮小">－</button><button type="button" data-mapzoom="reset" aria-label="元の範囲に戻す">⟲</button></div>');
  const svg=$('map-svg'), hover=$('map-hover'), frame=$('map-frame');
  svg.addEventListener('mousemove',ev=>{const t=ev.target.closest('.pt');if(!t){hover.classList.remove('show');return;}const r=frame.getBoundingClientRect();hover.textContent=BY_ID.get(t.dataset.id).name;hover.style.left=(ev.clientX-r.left)+'px';hover.style.top=(ev.clientY-r.top)+'px';hover.classList.add('show');});
  svg.addEventListener('mouseleave',()=>hover.classList.remove('show'));
  svg.addEventListener('click',ev=>{if(svgGesture.dragged){svgGesture.dragged=false;return;}const t=ev.target.closest('.pt');if(t)openDetail(t.dataset.id);});
  // ピンチ・ドラッグ・ホイールで地図だけを拡大縮小
  const pts=svgGesture.pointers;
  svg.addEventListener('pointerdown',ev=>{if(ev.button&&ev.button!==0)return;svg.setPointerCapture(ev.pointerId);pts.set(ev.pointerId,{x:ev.clientX,y:ev.clientY,sx:ev.clientX,sy:ev.clientY});if(pts.size===2){const [a,b]=[...pts.values()];svgGesture.dist=Math.hypot(a.x-b.x,a.y-b.y);svgGesture.mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};}});
  svg.addEventListener('pointermove',ev=>{const prev=pts.get(ev.pointerId);if(!prev)return;const cur={x:ev.clientX,y:ev.clientY,sx:prev.sx,sy:prev.sy};pts.set(ev.pointerId,cur);
    if(pts.size===1){if(!svgGesture.dragged&&Math.hypot(cur.x-cur.sx,cur.y-cur.sy)>5)svgGesture.dragged=true;if(svgGesture.dragged){svgPan(cur.x-prev.x,cur.y-prev.y);hover.classList.remove('show');}}
    else if(pts.size===2){const [a,b]=[...pts.values()];const dist=Math.hypot(a.x-b.x,a.y-b.y),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};if(svgGesture.dist>0){svgZoomAt(mid,dist/svgGesture.dist);svgPan(mid.x-svgGesture.mid.x,mid.y-svgGesture.mid.y);}svgGesture.dist=dist;svgGesture.mid=mid;svgGesture.dragged=true;}
    ev.preventDefault();});
  const end=ev=>{pts.delete(ev.pointerId);if(pts.size<2)svgGesture.dist=0;if(pts.size===0)setTimeout(()=>{svgGesture.dragged=false;},0);};
  svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
  svg.addEventListener('wheel',ev=>{ev.preventDefault();const f=Math.min(2,Math.max(0.5,Math.exp(-ev.deltaY*(ev.deltaMode===1?0.05:0.0015))));svgZoomAt({x:ev.clientX,y:ev.clientY},f);},{passive:false});
  svg.addEventListener('dblclick',ev=>{ev.preventDefault();svgZoomAt({x:ev.clientX,y:ev.clientY},2);});
}
const svgGesture={pointers:new Map(),dragged:false,dist:0,mid:null};
const vb={x:0,y:0,w:MAP_W,h:MAP_H};
function svgScale(){const svg=$('map-svg');const r=svg.getBoundingClientRect();return Math.min(r.width/vb.w,r.height/vb.h);}
function svgPointFromClient(p){const svg=$('map-svg');const pt=svg.createSVGPoint();pt.x=p.x;pt.y=p.y;const m=svg.getScreenCTM();if(!m)return {x:vb.x+vb.w/2,y:vb.y+vb.h/2};const q=pt.matrixTransform(m.inverse());return {x:q.x,y:q.y};}
function svgSetVb(x,y,w,h){
  const minW=MAP_W/40,maxW=MAP_W*1.4;
  if(w>maxW){const f=maxW/w;w=maxW;h*=f;} if(w<minW){const f=minW/w;w=minW;h*=f;}
  x=Math.min(MAP_W-w*0.4,Math.max(-w*0.6,x)); y=Math.min(MAP_H-h*0.4,Math.max(-h*0.6,y));
  vb.x=x;vb.y=y;vb.w=w;vb.h=h; svgApplyVb();
}
function svgZoomAt(client,f){const c=svgPointFromClient(client);svgSetVb(c.x-(c.x-vb.x)/f,c.y-(c.y-vb.y)/f,vb.w/f,vb.h/f);}
function svgPan(dx,dy){const sc=svgScale();svgSetVb(vb.x-dx/sc,vb.y-dy/sc,vb.w,vb.h);}
let vbRaf=0;
function svgApplyVb(){
  if(vbRaf)return; vbRaf=requestAnimationFrame(()=>{vbRaf=0;const svg=$('map-svg');if(!svg)return;
    svg.setAttribute('viewBox',vb.x.toFixed(1)+' '+vb.y.toFixed(1)+' '+vb.w.toFixed(1)+' '+vb.h.toFixed(1));
    const k=vb.w/MAP_W, kd=k*Math.min(2.2,Math.pow(k,-0.25)), kt=k*Math.min(1.8,Math.pow(k,-0.2));
    svg.querySelectorAll('.pt').forEach(el=>{const m=BY_ID.get(el.dataset.id);el.setAttribute('r',((m.pick===3?6.5:5)*kd).toFixed(2));});
    svg.querySelectorAll('.city').forEach(el=>{el.style.fontSize=(11*kt).toFixed(1)+'px';});
    svg.querySelectorAll('.cityDot').forEach(el=>el.setAttribute('r',(1.8*kt).toFixed(2)));
    svg.querySelectorAll('.pref').forEach(el=>{el.style.fontSize=(13*kt).toFixed(1)+'px';});
  });
}
function svgPreset(){const z=ZOOMS[state.zoom];const x0=px(z.lng[0]),y0=py(z.lat[1]);vb.x=x0;vb.y=y0;vb.w=px(z.lng[1])-x0;vb.h=py(z.lat[0])-y0;svgApplyVb();}
function renderMap(){
  $('legend').innerHTML=Object.keys(CATS).map(c=>'<span style="--c:var(--cat-'+c+')">'+CATS[c]+'</span>').join('');
  if(mapMode===null){
    mapMode='probing'; $('map-frame').innerHTML='<div class="map-loading">地図を読み込んでいます…</div>';
    probeTiles(ok=>{mapMode=ok?'tiles':'svg'; if(ok) buildLeaflet(); else buildSvg(); applyMap();});
    return;
  }
  if(mapMode==='probing') return;
  applyMap();
}
function applyMap(){
  const z=ZOOMS[state.zoom];
  if(mapMode==='tiles'){
    $('map-note').textContent='地図: OpenStreetMap。点をクリックすると館の情報が開きます。絞り込み条件に合わない館は薄く表示します。';
    leaflet.map.invalidateSize();
    if(appliedZoom!==state.zoom){leaflet.map.fitBounds([[z.lat[0],z.lng[0]],[z.lat[1],z.lng[1]]],{padding:[12,12]});appliedZoom=state.zoom;}
    leaflet.markers.forEach((c,id)=>{const el=c.getElement();if(el)el.classList.toggle('dim',!mapMatches(BY_ID.get(id)));});
    return;
  }
  $('map-note').textContent='概略図（都道府県の輪郭は簡略化）。ピンチやホイール、＋－で拡大、ドラッグで移動できます。点をクリックすると詳細が開きます。絞り込み条件に合わない館は薄く表示します。';
  if(appliedZoom!==state.zoom){svgPreset();appliedZoom=state.zoom;}
  $('map-svg').querySelectorAll('.pt').forEach(el=>el.classList.toggle('dim',!mapMatches(BY_ID.get(el.dataset.id))));
}

/* ---------- 詳細パネル ---------- */
let lastFocus=null;
function openDetail(id){
  const m=BY_ID.get(id); if(!m) return;
  if(leaflet&&leaflet.map) leaflet.map.closePopup();
  const st=openStatus(m,today), exs=exFuture(m), cols=COL_BY_M.get(id)||[];
  const gmaps=gmapsUrl(m);
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
    '<span><span class="num">'+openN+'</span>館が本日開館</span><button type="button" class="today-jump" data-jump="open"><span class="num">'+live.length+'</span>件の展覧会が会期中</button>'+(ending?'<button type="button" class="today-jump" data-jump="ending">うち2週間以内に終了 '+ending+'件</button>':'');
}
function setTab(tab,push){
  if(!['list','exhibitions','collections','map','saved'].includes(tab)) tab='list';
  state.tab=tab;
  document.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));
  ['list','exhibitions','collections','map','saved'].forEach(t=>{$('view-'+t).hidden=t!==tab;});
  $('rail').hidden=(tab==='collections'||tab==='saved');
  $('field-pref').hidden=(tab==='map');
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
  if(t.dataset.exv){state.exView=t.dataset.exv;renderExhibitions();return;}
  if(t.dataset.jump){state.exFilter=t.dataset.jump;state.exView='timeline';setTab('exhibitions');window.scrollTo({top:0});return;}
  if(t.dataset.mapzoom){const k=t.dataset.mapzoom;if(mapMode==='tiles'&&leaflet){if(k==='in')leaflet.map.zoomIn();else if(k==='out')leaflet.map.zoomOut();else{appliedZoom=null;applyMap();}}else if(mapMode==='svg'){const svg=$('map-svg');const r=svg.getBoundingClientRect();const c={x:r.left+r.width/2,y:r.top+r.height/2};if(k==='in')svgZoomAt(c,1.6);else if(k==='out')svgZoomAt(c,1/1.6);else svgPreset();}return;}
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
