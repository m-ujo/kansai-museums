#!/usr/bin/env node
// 定期タスク（Claude）が今回調べる館を選ぶ
// 使い方: node scripts/select-targets.js --today YYYY-MM-DD [--max 25] [--days 21] [--out-dir DIR --batch-size 5]
//   --out-dir を付けると DIR/batch-1.json, batch-2.json … に --batch-size 館ずつ書き出し、標準出力には各ファイルの館名だけを出す
//  優先順位: (a) 今日から --days 日以内に会期が終わる展覧会があり、その後の展覧会がデータにない館
//          → (c) research/candidates.json に未登録の展覧会候補がある館
//          → (b) 会期中・開催予定の展覧会が1件もない館
//  ただし research/checked.json で 14 日以内に調べた館は優先順位にかかわらず後回し。同順位では最終調査日（last）が古い順（記録なしが最優先）。
//  (b) の館で 28 日以内に調べて 0 件だったものは今回は飛ばす。closure（長期休館）のある館は対象外。
//  出力: 標準出力に JSON {today, targets:[{id,name,pref,url,host,reason,last,existing:[...],candidates:[...]}]}
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'), SRC=path.join(ROOT,'src');
const S=p=>fs.readFileSync(path.join(SRC,p),'utf8');
const DATA_FILES=['data-osaka.js','data-kyoto.js','data-hyogo.js','data-nara.js','data-shiga.js','data-wakayama.js','data-mie.js'];
const MUSEUMS=new Function(DATA_FILES.map(S).join('\n')+';return [].concat(MUSEUMS_OSAKA,MUSEUMS_KYOTO,MUSEUMS_HYOGO,MUSEUMS_NARA,MUSEUMS_SHIGA,MUSEUMS_WAKAYAMA,MUSEUMS_MIE);')();
const exSrc=S('data-exhibitions.js');
const EXHIBITIONS=new Function(exSrc+';return EXHIBITIONS;')();
const EX_INDEX_URLS=new Function(exSrc+';return EX_INDEX_URLS;')();
const args=process.argv.slice(2); const opt=(k,d)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;};
const TODAY=opt('--today'); const MAX=+opt('--max',25); const DAYS=+opt('--days',21); const OUT=opt('--out-dir'); const BATCH=+opt('--batch-size',5);
if(!TODAY||!/^\d{4}-\d{2}-\d{2}$/.test(TODAY)){ console.error('使い方: node scripts/select-targets.js --today YYYY-MM-DD [--max 25] [--days 21]'); process.exit(2); }
const addDays=(d,n)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
const LIMIT=addDays(TODAY,DAYS), SKIP_BEFORE=addDays(TODAY,-28), RECENT=addDays(TODAY,-14);
const readJson=f=>{const p=path.join(ROOT,'research',f);return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):null;};
const cand=(readJson('candidates.json')||{}).candidates||[];
const checked=readJson('checked.json')||{};
const byM=new Map(); for(const e of EXHIBITIONS){ if(!byM.has(e.m)) byM.set(e.m,[]); byM.get(e.m).push(e); }
const out=[];
for(const m of MUSEUMS){
  if(m.closure) continue;
  const exs=(byM.get(m.id)||[]).filter(e=>e.end>=TODAY);
  const ending=exs.filter(e=>e.end<=LIMIT), later=exs.filter(e=>e.end>LIMIT);
  const cs=cand.filter(c=>c.museum_id===m.id);
  const rec=checked[m.id]||{};
  let tier=0, reason='';
  if(ending.length&&!later.length){ tier=1; reason=`会期が${DAYS}日以内に終わる展覧会があり、その後の展覧会が未登録`; }
  else if(cs.length){ tier=2; reason=`一覧ページに未登録の展覧会候補が${cs.length}件`; }
  else if(!exs.length){ if(rec.last&&rec.last>=SKIP_BEFORE&&!(rec.found>0)) continue; tier=3; reason='会期中・開催予定の展覧会が未登録'; }
  if(!tier) continue;
  out.push({tier,recent:(rec.last&&rec.last>=RECENT)?1:0,id:m.id,name:m.name,pref:m.pref,url:m.url,host:new URL(m.url).hostname.replace(/^www\./,''),index:EX_INDEX_URLS[m.id]||null,reason,last:rec.last||null,
    existing:exs.map(e=>({title:e.title,start:e.start,end:e.end,page:e.page||null,kind:e.kind||null})),
    candidates:cs.slice(0,8).map(c=>({text:c.text,url:c.url}))});
}
out.sort((a,b)=>a.recent-b.recent||a.tier-b.tier||String(a.last||'').localeCompare(String(b.last||''))||a.id.localeCompare(b.id));
const targets=out.slice(0,MAX).map(({tier,recent,...t})=>t);
console.error(`対象候補 ${out.length}館（(a) ${out.filter(x=>x.tier===1).length} / (c) ${out.filter(x=>x.tier===2).length} / (b) ${out.filter(x=>x.tier===3).length}）→ 今回 ${targets.length}館`);
if(OUT){
  fs.mkdirSync(OUT,{recursive:true});
  for(const f of fs.readdirSync(OUT)) if(/^batch-\d+\.json$/.test(f)) fs.unlinkSync(path.join(OUT,f));
  let n=0;
  for(let i=0;i<targets.length;i+=BATCH){ n++; const b=targets.slice(i,i+BATCH); fs.writeFileSync(path.join(OUT,`batch-${n}.json`),JSON.stringify({today:TODAY,targets:b},null,1)+'\n'); console.log(`${path.join(OUT,`batch-${n}.json`)}: ${b.map(x=>x.id+'（'+x.name+'）').join('、')}`); }
  if(!n) console.log('今回調べる館はありません');
} else {
  console.log(JSON.stringify({today:TODAY,targets},null,1));
}
