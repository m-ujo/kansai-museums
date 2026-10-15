// src/ の各ファイルを結合して index.html（単体で動く1ファイル）を生成する。
// 使い方: node build.js            → index.html を更新
//         node build.js --artifact → artifact.html（claude.ai Artifact 用、文書の骨組みなし）も出力
const fs=require('fs'),path=require('path');
const S=p=>fs.readFileSync(path.join(__dirname,'src',p),'utf8');
const css=S('styles.css'), markup=S('markup.html'), leafletCss=S('leaflet.css');
const data=['data-osaka.js','data-kyoto.js','data-hyogo.js','data-nara.js','data-shiga.js','data-wakayama.js','data-mie.js','data-collections.js','data-exhibitions.js','data-geo.js'].map(S).join('\n');
const app=S('app.js');
const fonts='<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap">';
const desc='大阪・京都・兵庫・奈良・滋賀・和歌山・三重の美術館・博物館を、今日の開館状況・会期中の展覧会・テーマ別特集から探せる案内。';
const LEAFLET='<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>';
const body=markup+'\n<script>\n'+data+'\n</script>\n<script>\n'+app+'\n</script>\n';
const full='<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>関西ミュージアム手帖</title>\n<meta name="description" content="'+desc+'">\n<meta name="theme-color" content="#f3f4f1">\n'+fonts+'\n<style>\nhtml{color-scheme:light}\n'+leafletCss+'\n'+css+'\n</style>\n'+LEAFLET+'\n</head>\n<body>\n'+body+'</body>\n</html>\n';
fs.writeFileSync(path.join(__dirname,'index.html'),full);
console.log('index.html',(full.length/1024).toFixed(0)+'KB');
if(process.argv.includes('--artifact')){
  const artifact='<title>関西ミュージアム手帖</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<meta name="description" content="'+desc+'">\n'+fonts+'\n<style>\n'+css+'\n</style>\n'+body;
  fs.writeFileSync(path.join(__dirname,'artifact.html'),artifact);
  console.log('artifact.html',(artifact.length/1024).toFixed(0)+'KB');
}
