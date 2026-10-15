#!/usr/bin/env node
// 定期タスク（Claude）が調べた展覧会を data-exhibitions.js に取り込む
// 使い方: node scripts/apply-added.js <追加行のJSONLファイル> --asof YYYY-MM-DD [--checked <調査済み館のJSONファイル>]
//        node scripts/apply-added.js --asof YYYY-MM-DD --checked <ファイル>     （追加が0件のとき）
//  - JSONL は1行1件 {m,title,start,end,note,src,conf,page,kind}。(m, title) が既存行と一致すれば上書き、なければ追加
//  - 全行を検証し、1件でも不正なら何も書き換えずに終了コード1で止まる
//  - 既存行を上書きするとき、リンク先の格（official > news > listing > pdf > index）が下がる page は採用しない
//  - src/app.js の DATA_ASOF を --asof の日付に更新する
//  - --checked のファイル {"館ID": 見つけた件数, ...} を research/checked.json（{館ID:{last,found}}）に反映する
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'), SRC=path.join(ROOT,'src');
const S=p=>fs.readFileSync(path.join(SRC,p),'utf8');
const DATA_FILES=['data-osaka.js','data-kyoto.js','data-hyogo.js','data-nara.js','data-shiga.js','data-wakayama.js','data-mie.js'];
const MUSEUMS=new Function(DATA_FILES.map(S).join('\n')+';return [].concat(MUSEUMS_OSAKA,MUSEUMS_KYOTO,MUSEUMS_HYOGO,MUSEUMS_NARA,MUSEUMS_SHIGA,MUSEUMS_WAKAYAMA,MUSEUMS_MIE);')();
const BY_ID=new Map(MUSEUMS.map(m=>[m.id,m]));

const args=process.argv.slice(2);
const opt=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:undefined;};
const FILE=args.find((a,i)=>!a.startsWith('--')&&(i===0||!args[i-1].startsWith('--')));
const ASOF=opt('--asof'), CHECKED=opt('--checked');
const isDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&s>='2024-01-01'&&s<='2031-12-31';
if(!ASOF||!isDate(ASOF)){ console.error('使い方: node scripts/apply-added.js <追加行.jsonl> --asof YYYY-MM-DD [--checked <館ID:件数のJSON>]'); process.exit(2); }

const exSrc=S('data-exhibitions.js');
const EXHIBITIONS=new Function(exSrc+';return EXHIBITIONS;')();
const EX_INDEX_URLS=new Function(exSrc+';return EX_INDEX_URLS;')();
const KINDS=['official','news','listing','pdf','index'];
const RANK={official:5,news:4,listing:3,pdf:2,index:1};
const norm=s=>String(s).replace(/[\s　「」『』【】〈〉《》()（）\[\]［］]/g,'').toLowerCase();
const isUrl=s=>typeof s==='string'&&/^https?:\/\/\S+$/.test(s);

/* ---------- 読み込みと検証 ---------- */
const rows=[], errors=[];
if(FILE){
  const lines=fs.readFileSync(FILE,'utf8').split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('//')&&!l.startsWith('#'));
  lines.forEach((l,i)=>{ try{ rows.push(JSON.parse(l.replace(/,$/,''))); }catch(e){ errors.push(`${i+1}行目: JSON として読めません`); } });
}
rows.forEach((o,i)=>{
  const at=`${i+1}行目`;
  if(!o||typeof o!=='object'||Array.isArray(o)){ errors.push(`${at}: オブジェクトではありません`); return; }
  if(!o.m||!BY_ID.has(o.m)) errors.push(`${at}: m「${o.m}」に該当する館がありません`);
  if(typeof o.title!=='string'||o.title.trim().length<2) errors.push(`${at}: title がありません`);
  if(!isDate(o.start)) errors.push(`${at}: start が YYYY-MM-DD ではありません（${o.start}）`);
  if(!isDate(o.end)) errors.push(`${at}: end が YYYY-MM-DD ではありません（${o.end}）`);
  if(isDate(o.start)&&isDate(o.end)&&o.start>o.end) errors.push(`${at}: start が end より後です`);
  if(o.note!==undefined&&(typeof o.note!=='string'||o.note.length>120)) errors.push(`${at}: note は120字以内の文字列にしてください`);
  if(!isUrl(o.src)) errors.push(`${at}: src は http(s) で始まる URL（会期の出典）が必要です`);
  if(!['high','medium'].includes(o.conf)) errors.push(`${at}: conf は high か medium`);
  if(o.page!==undefined){
    if(!isUrl(o.page)) errors.push(`${at}: page は http(s) で始まる URL`);
    if(!KINDS.includes(o.kind)) errors.push(`${at}: kind は ${KINDS.join('/')} のいずれか`);
    if(isUrl(o.page)&&/(artagenda\.jp\/museum\/|museum\.or\.jp\/museum\/\d+|artscape\.jp\/mdb\/|tokyoartbeat\.com\/venues\/)/.test(o.page)) errors.push(`${at}: page が展覧会情報サイトの館ページです。展覧会の個別ページか館の一覧ページ（kind: index）にしてください`);
  } else if(o.kind!==undefined) errors.push(`${at}: page が無いのに kind があります`);
  if(o.added) errors.push(`${at}: added は付けません`);
  for(const k of Object.keys(o)) if(!['m','title','start','end','note','src','conf','page','kind'].includes(k)) errors.push(`${at}: 不明なキー「${k}」`);
});
if(errors.length){ console.error('取り込みを中止しました（データは変更していません）:'); errors.forEach(e=>console.error(' - '+e)); process.exit(1); }

/* ---------- 取り込み ---------- */
let added=0, updated=0, unchanged=0; const log=[];
for(const o of rows){
  const t=norm(o.title);
  const ex=EXHIBITIONS.find(e=>e.m===o.m&&norm(e.title)===t);
  const clean={m:o.m,title:o.title.trim(),start:o.start,end:o.end,note:(o.note||'').trim(),src:o.src,conf:o.conf};
  if(o.page){ clean.page=o.page; clean.kind=o.kind; }
  const name=BY_ID.get(o.m).name;
  if(ex){
    const before=JSON.stringify(ex);
    for(const k of ['start','end','src','conf']) ex[k]=clean[k];
    if(clean.note) ex.note=clean.note;
    if(clean.page&&(!ex.page||(RANK[clean.kind]||0)>=(RANK[ex.kind]||0))){ ex.page=clean.page; ex.kind=clean.kind; delete ex.autolink; }
    if(JSON.stringify(ex)===before){ unchanged++; log.push(`- [変更なし] ${name}「${ex.title}」`); }
    else { updated++; log.push(`- [更新] ${name}「${ex.title}」 ${ex.start}〜${ex.end}`); }
  } else {
    EXHIBITIONS.push(clean); added++; log.push(`- [追加] ${name}「${clean.title}」 ${clean.start}〜${clean.end}（${clean.kind||'リンクなし'}）`);
  }
}

/* ---------- 書き出し（scripts/update-links.js の writeData と同じ形式） ---------- */
const sorted=EXHIBITIONS.slice().sort((a,b)=>a.end.localeCompare(b.end)||a.start.localeCompare(b.start));
let js=exSrc.slice(0,exSrc.indexOf('const EXHIBITIONS = ['));
js+='const EXHIBITIONS = [\n';
for(const e of sorted){ const o={m:e.m,title:e.title,start:e.start,end:e.end,note:e.note,src:e.src,conf:e.conf}; if(e.page){o.page=e.page;o.kind=e.kind;} if(e.added)o.added=true; if(e.autolink)o.autolink=e.autolink; js+=JSON.stringify(o)+',\n'; }
js=js.replace(/,\n$/,'\n')+'];\n// 館ごとの「展覧会一覧」ページ（展覧会に個別ページが見つからない場合のリンク先）\nconst EX_INDEX_URLS = '+JSON.stringify(EX_INDEX_URLS,null,0).replace(/","/g,'",\n "')+';\n';
fs.writeFileSync(path.join(SRC,'data-exhibitions.js'),js);
new Function(js+';return EXHIBITIONS.length;')(); // 構文確認

const appPath=path.join(SRC,'app.js'); const app=fs.readFileSync(appPath,'utf8');
if(!/const DATA_ASOF='\d{4}-\d{2}-\d{2}'/.test(app)) { console.error('src/app.js に DATA_ASOF が見つかりません'); process.exit(1); }
fs.writeFileSync(appPath,app.replace(/const DATA_ASOF='\d{4}-\d{2}-\d{2}'/,`const DATA_ASOF='${ASOF}'`));

let checkedN=0;
if(CHECKED){
  const file=path.join(ROOT,'research','checked.json');
  const cur=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
  const upd=JSON.parse(fs.readFileSync(CHECKED,'utf8'));
  for(const [id,found] of Object.entries(upd)){ if(!BY_ID.has(id)){ console.error(`--checked: 館ID「${id}」がありません`); process.exit(1); } cur[id]={last:ASOF,found:Number(found)||0}; checkedN++; }
  const out={}; for(const k of Object.keys(cur).sort()) out[k]=cur[k];
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(out,null,1)+'\n');
}
console.log(`取り込み: 追加 ${added}件、更新 ${updated}件、変更なし ${unchanged}件（合計 ${EXHIBITIONS.length}件）。DATA_ASOF=${ASOF}${CHECKED?`、調査済み記録 ${checkedN}館`:''}`);
log.forEach(l=>console.log(l));
