#!/usr/bin/env node
// 展覧会データのリンクを自動で整える（GitHub Actions で毎週 月・木 に実行）
//  1. 個別ページが未設定（kind: index/listing/home、または page なし）の展覧会について、
//     館の展覧会一覧ページを取得し、タイトルが一致するリンク（または id 付き要素へのページ内アンカー）を探して page に設定する
//  2. 設定済みの公式ページがリンク切れ（404/410）になっていないか確認し、切れていれば一覧ページに戻す
//  3. 会期終了から 90 日以上たった展覧会を削除する
//  4. 一覧ページ上の「まだデータにない展覧会らしきリンク」を research/candidates.json に書き出す（新規追加の手がかり）
// 使い方: node scripts/update-links.js            （kansai-museums ディレクトリで実行）
//        KMT_FIXTURES=dir node scripts/update-links.js   （テスト用: dir/<館ID>.html を一覧ページの代わりに読む）
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'), SRC=path.join(ROOT,'src');
const S=p=>fs.readFileSync(path.join(SRC,p),'utf8');
const DATA_FILES=['data-osaka.js','data-kyoto.js','data-hyogo.js','data-nara.js','data-shiga.js','data-wakayama.js','data-mie.js'];
const MUSEUMS=new Function(DATA_FILES.map(S).join('\n')+';return [].concat(MUSEUMS_OSAKA,MUSEUMS_KYOTO,MUSEUMS_HYOGO,MUSEUMS_NARA,MUSEUMS_SHIGA,MUSEUMS_WAKAYAMA,MUSEUMS_MIE);')();
const BY_ID=new Map(MUSEUMS.map(m=>[m.id,m]));
const exSrc=S('data-exhibitions.js');
const EXHIBITIONS=new Function(exSrc+';return EXHIBITIONS;')();
const EX_INDEX_URLS=new Function(exSrc+';return EX_INDEX_URLS;')();
const FIX=process.env.KMT_FIXTURES||'';
const today=new Date(); const pad=n=>String(n).padStart(2,'0'); const TODAY=today.getFullYear()+'-'+pad(today.getMonth()+1)+'-'+pad(today.getDate());
const log=[]; const say=s=>{log.push(s);console.log(s);};

/* ---------- 取得 ---------- */
const UA='Mozilla/5.0 (compatible; kansai-museums-link-bot/1.0; +https://m-ujo.github.io/bid-monitor/kansai-museums/)';
const DEADLINE=Date.now()+8*60*1000; // ネットワーク処理全体の上限（8分）
const overBudget=()=>Date.now()>DEADLINE;
const cache=new Map();
async function fetchText(url){
  if(FIX){ // テスト用フィクスチャ
    const id=[...BY_ID.values()].find(m=>(EX_INDEX_URLS[m.id]||m.url)===url); const f=id&&path.join(FIX,id.id+'.html');
    return (f&&fs.existsSync(f))?{status:200,text:fs.readFileSync(f,'utf8'),url}:{status:404,text:'',url};
  }
  if(cache.has(url)) return cache.get(url);
  if(overBudget()) return {status:0,text:'',url,error:'time budget exceeded'};
  const p=(async()=>{
    try{
      const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(),15000);
      const r=await fetch(url,{headers:{'user-agent':UA,'accept':'text/html,*/*;q=0.8','accept-language':'ja,en;q=0.5'},redirect:'follow',signal:ctl.signal});
      clearTimeout(t);
      const ct=r.headers.get('content-type')||'';
      const text=(r.ok&&/text|html|xml/.test(ct))?await r.text():'';
      return {status:r.status,text,url:r.url||url};
    }catch(e){return {status:0,text:'',url,error:String(e.message||e)};}
  })();
  cache.set(url,p); return p;
}
async function prefetch(urls,conc){const q=[...new Set(urls)];let i=0;await Promise.all(Array.from({length:conc},async()=>{while(i<q.length){const u=q[i++];const t0=Date.now();const r=await fetchText(u);console.log(`  fetched ${u} status ${r.status} ${Date.now()-t0}ms`);}}));}
async function headStatus(url){
  if(FIX) return 200;
  if(overBudget()) return 0;
  try{
    const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(),15000);
    let r=await fetch(url,{method:'HEAD',headers:{'user-agent':UA},redirect:'follow',signal:ctl.signal}).catch(()=>null);
    if(!r||r.status===405||r.status===403||r.status===501){r=await fetch(url,{method:'GET',headers:{'user-agent':UA},redirect:'follow',signal:ctl.signal});}
    clearTimeout(t); return r.status;
  }catch(e){return 0;}
}

/* ---------- 文字列の正規化と照合 ---------- */
const decode=s=>s.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(m,n)=>String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi,(m,h)=>String.fromCodePoint(parseInt(h,16)));
const strip=s=>decode(s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
function norm(s){return String(s).normalize('NFKC').toLowerCase().replace(/[\s　]/g,'').replace(/[「」『』【】（）()\[\]〈〉《》“”"'’‘・･,.、。:：;；!！?？\-–—―~〜～_/／|｜#＃]/g,'').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));}
// タイトルの「核」: 展覧会の種別などの前置きを除いた部分
function core(title){
  let t=title.replace(/[（(]仮称?[)）]/g,'').replace(/^(第\d+回)?\s*(令和\d+年度\s*)?(秋季|春季|夏季|冬季|新春)?\s*(特別展|企画展示|企画展|特集展示|特別展示|特別企画展|テーマ展示|テーマ展|コレクション展|所蔵品展|常設展|ミニ展示|シリーズ展|開館\d+周年記念(特別展)?)?\s*[「『]?/,'');
  t=t.replace(/[」』].*$/,'').replace(/[－―—–\-:：].*$/,'');
  const n=norm(t); return n.length>=4?n:norm(title);
}
function score(anchorText,title){
  const a=norm(anchorText), c=core(title), full=norm(title);
  if(!a||a.length<4) return 0;
  if(a===full||a===c) return 1;
  if(a.includes(c)) return 0.9;
  if(c.includes(a)&&a.length>=6) return 0.7;
  // 文字 bigram の重なり
  const bg=s=>{const r=new Set();for(let i=0;i<s.length-1;i++)r.add(s.slice(i,i+2));return r;};
  const A=bg(a),C=bg(c); let hit=0; for(const x of C) if(A.has(x)) hit++;
  const ratio=C.size?hit/C.size:0; return ratio>=0.6?0.5+ratio*0.3:0;
}
function anchors(html,baseUrl){
  const out=[]; const re=/<a\b([^>]*)>([\s\S]*?)<\/a>/gi; let m;
  while((m=re.exec(html))){
    const attrs=m[1]; const hm=attrs.match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'|href\s*=\s*([^\s>]+)/i); const href=hm?decode(hm[1]||hm[2]||hm[3]||'').trim():'';
    if(!href||/^(javascript:|mailto:|tel:|#)/i.test(href)||/\s|&nbsp;|[\u3000-\u9fff]/.test(href)) continue;
    let abs; try{abs=new URL(href,baseUrl).href;}catch(e){continue;}
    if(/\s|%E3%80%80/.test(abs)) continue;
    const text=strip(m[2])||decode((attrs.match(/title="([^"]*)"|aria-label="([^"]*)"/i)||[])[1]||'');
    out.push({href:abs,text});
  }
  return out;
}
const GENERIC_ID=/^(pan|pankuzu|breadcrumb|main|content|contents|container|wrapper|wrap|header|footer|nav|menu|gnav|side|sidebar|top|page|body|notice|info|info_top|tmp_anchor|tmp_contents|tmp_[a-z_]+|section\d*|area|box|inner|outer|primary|secondary|column|col\d*|list|news|skip|anchor|here|current|upcoming|next|coming|schedule|past|future)$/i;
function anchorIdFor(html,title){
  // タイトルの直前（タグ除去後 600 文字以内）にある、展覧会固有らしい id="..." を探す
  const c=core(title); const re=/\bid\s*=\s*"([^"\s]+)"/gi; let m,best=null;
  while((m=re.exec(html))){
    const id=m[1]; if(GENERIC_ID.test(id)||id.length>40) continue;
    const seg=norm(strip(html.slice(m.index,m.index+3000))); const at=seg.indexOf(c);
    if(at>=0&&at<=600) best=id;
  }
  return best;
}
function sameUrl(a,b){try{const x=new URL(a),y=new URL(b);return x.host.replace(/^www\./,'')===y.host.replace(/^www\./,'')&&x.pathname.replace(/\/$/,'')===y.pathname.replace(/\/$/,'');}catch(e){return false;}}

/* ---------- 1. 個別ページの解決 ---------- */
async function resolveLinks(){
  const need=EXHIBITIONS.filter(e=>!e.page||['index','listing','home'].includes(e.kind));
  const byMuseum=new Map(); for(const e of need){ if(!byMuseum.has(e.m)) byMuseum.set(e.m,[]); byMuseum.get(e.m).push(e); }
  let resolved=0;
  await prefetch([...byMuseum.keys()].map(mid=>EX_INDEX_URLS[mid]||BY_ID.get(mid).url),6);
  for(const [mid,list] of byMuseum){
    const m=BY_ID.get(mid); const indexUrl=EX_INDEX_URLS[mid]||m.url;
    const r=await fetchText(indexUrl);
    if(!r.text){say(`- [一覧取得失敗] ${m.name} ${indexUrl} (status ${r.status}${r.error?' '+r.error:''})`);continue;}
    const as=anchors(r.text,r.url); const anchorUse=new Map();
    for(const e of list){
      let best=null,bs=0;
      for(const a of as){ if(sameUrl(a.href,indexUrl)||sameUrl(a.href,m.url)) continue; const sc=score(a.text,e.title); if(sc>bs){bs=sc;best=a;} }
      if(best&&bs>=0.7){ e.page=best.href; e.kind=/\.pdf(\?|$)/i.test(best.href)?'pdf':'official'; e.autolink=TODAY; resolved++; say(`- [個別ページ] ${m.name}「${e.title}」→ ${best.href}`); continue; }
      if(e.kind==='listing') continue; // 展覧会情報サイトの個別ページは、公式の個別ページが見つかった時だけ置き換える
      const id=anchorIdFor(r.text,e.title);
      if(id){ anchorUse.set(id,(anchorUse.get(id)||0)+1); e._anchor=indexUrl.split('#')[0]+'#'+id; }
      else if(!e.page){ e.page=indexUrl; e.kind='index'; }
    }
    for(const e of list){ // 同じ id に複数の展覧会が当たる場合は展覧会固有でないので使わない
      if(!e._anchor) continue; const id=e._anchor.split('#')[1];
      if(anchorUse.get(id)===1&&e.page!==e._anchor){ e.page=e._anchor; e.kind='official'; e.autolink=TODAY; resolved++; say(`- [ページ内アンカー] ${m.name}「${e.title}」→ ${e._anchor}`); }
      else if(!e.page){ e.page=indexUrl; e.kind='index'; }
      delete e._anchor;
    }
  }
  return resolved;
}

/* ---------- 2. リンク切れ確認 ---------- */
async function checkLinks(){
  const targets=EXHIBITIONS.filter(e=>e.page&&['official','news','pdf'].includes(e.kind)&&!e.page.includes('#'));
  let broken=0, i=0; const workers=[];
  for(let w=0;w<8;w++) workers.push((async()=>{ while(i<targets.length){ const e=targets[i++]; const st=await headStatus(e.page); if(st===404||st===410){ broken++; const m=BY_ID.get(e.m); say(`- [リンク切れ] ${m.name}「${e.title}」 ${e.page} → 一覧ページに戻す`); e.page=EX_INDEX_URLS[e.m]||m.url; e.kind='index'; delete e.autolink; } } })());
  await Promise.all(workers); return broken;
}

/* ---------- 3. 終了から 90 日以上の展覧会を削除 ---------- */
function prune(){
  const limit=new Date(today); limit.setDate(limit.getDate()-90); const L=limit.getFullYear()+'-'+pad(limit.getMonth()+1)+'-'+pad(limit.getDate());
  const keep=EXHIBITIONS.filter(e=>e.end>=L); const removed=EXHIBITIONS.length-keep.length;
  EXHIBITIONS.length=0; EXHIBITIONS.push(...keep); return removed;
}

/* ---------- 4. 新規候補の抽出 ---------- */
async function candidates(){
  const known=new Set(EXHIBITIONS.map(e=>e.m+'|'+core(e.title))); const out=[];
  await prefetch(MUSEUMS.map(m=>EX_INDEX_URLS[m.id]).filter(Boolean),6);
  for(const m of MUSEUMS){
    const indexUrl=EX_INDEX_URLS[m.id]; if(!indexUrl) continue;
    const r=await fetchText(indexUrl); if(!r.text) continue;
    const seen=new Set();
    for(const a of anchors(r.text,r.url)){
      const t=a.text; if(!t||t.length<6||t.length>80) continue;
      const pathLooksLikeEx=/(exhibit|exhibition|planned|special|tenji|tenrankai|kikaku|tokubetsu|sp_evt|event)/i.test(new URL(a.href).pathname);
      if(!pathLooksLikeEx&&!/展|企画|特集/.test(t)) continue;
      if(/^(コレクション|展覧会|企画展示?|特別展|常設展|過去の展覧会|今後の展覧会|開催中の展覧会|展覧会一覧|展示案内|イベント|一覧|もっと見る|詳細|詳しく|english|top|home)$/i.test(t.trim())) continue;
      if(/^終了|【終了】|カレンダー|本日の催し|講演会|トーク|ワークショップ|ギャラリーツアー|スケジュール|年間|PDF|申込|募集|チケット|アクセス|お知らせ一覧|^(-->|&emsp;)|^[0-9０-９B]+Ｆ?F?\s|展示場|バーチャル|過去の|これまでの|^イベント|講座|寄席|茶話|ツアー|展示一覧|現在の展示|もっと詳しく|館外|屋外|展示更新|展示・イベント|スタンプラリー|NEWS|レポート|ガイド|学芸員|ポケット/.test(t)) continue;
      { const h1=new URL(a.href).hostname.split('.').slice(-2).join('.'), h2=new URL(indexUrl).hostname.split('.').slice(-2).join('.'); if(h1!==h2) continue; }
      if(/event-post|calendar|eventlist|\.pdf(\?|$)/i.test(a.href)) continue;
      { // 会期の終了が今日より前なら除外（例: 2026.07.11～09.06 / 2025.10.25～2026.01.12）
        const dm=t.match(/(20\d\d)[.\/年](\d{1,2})[.\/月](\d{1,2})日?\s*[~〜～－-]\s*(?:(20\d\d)[.\/年])?(\d{1,2})[.\/月](\d{1,2})/);
        if(dm){ const ey=dm[4]||dm[1]; const end=ey+'-'+pad(+dm[5])+'-'+pad(+dm[6]); if(end<TODAY) continue; }
      }
      if(sameUrl(a.href,indexUrl)||sameUrl(a.href,m.url)||/\.(jpg|png|gif|svg)(\?|$)/i.test(a.href)) continue;
      const c=core(t); if(known.has(m.id+'|'+c)) continue;
      if([...known].some(k=>k.startsWith(m.id+'|')&&(k.slice(m.id.length+1).includes(c)||c.includes(k.slice(m.id.length+1))))) continue;
      const key=a.href+'|'+c; if(seen.has(key)) continue; seen.add(key);
      if(out.filter(x=>x.museum_id===m.id).length>=12) break;
      out.push({museum_id:m.id,museum:m.name,text:t,url:a.href});
    }
  }
  const file=path.join(ROOT,'research','candidates.json'); fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify({generated:TODAY,note:'展覧会一覧ページ上の、まだデータにない展覧会らしきリンク。会期と内容を確認してから data-exhibitions.js に追加する。',candidates:out},null,1)+'\n');
  return out.length;
}

/* ---------- 書き出し ---------- */
function writeData(){
  const sorted=EXHIBITIONS.slice().sort((a,b)=>a.end.localeCompare(b.end)||a.start.localeCompare(b.start));
  let js=exSrc.slice(0,exSrc.indexOf('const EXHIBITIONS = ['));
  js=js.replace(/\n\/\/ links-checked:.*\n?/,'\n'); js=js.trimEnd()+'\n// links-checked: '+TODAY+'\n';
  js+='const EXHIBITIONS = [\n';
  for(const e of sorted){ const o={m:e.m,title:e.title,start:e.start,end:e.end,note:e.note,src:e.src,conf:e.conf}; if(e.page){o.page=e.page;o.kind=e.kind;} if(e.added)o.added=true; if(e.autolink)o.autolink=e.autolink; js+=JSON.stringify(o)+',\n'; }
  js=js.replace(/,\n$/,'\n')+'];\n// 館ごとの「展覧会一覧」ページ（展覧会に個別ページが見つからない場合のリンク先）\nconst EX_INDEX_URLS = '+JSON.stringify(EX_INDEX_URLS,null,0).replace(/","/g,'",\n "')+';\n';
  fs.writeFileSync(path.join(SRC,'data-exhibitions.js'),js);
}

(async()=>{
  say(`# 関西ミュージアム手帖 リンク更新 ${TODAY}`);
  const removed=prune(); say(`- 終了から90日以上たった展覧会の削除: ${removed}件`);
  const resolved=await resolveLinks(); say(`- 新たに個別ページを設定: ${resolved}件`);
  const broken=await checkLinks(); say(`- リンク切れ: ${broken}件`);
  const cand=await candidates(); say(`- 新規候補（research/candidates.json）: ${cand}件`);
  writeData();
  require('child_process').execFileSync(process.execPath,[path.join(ROOT,'build.js')],{stdio:'inherit'});
  if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,log.join('\n')+'\n');
})().catch(e=>{console.error(e);process.exit(1);});
