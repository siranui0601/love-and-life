import {mountWorldAtlas} from './atlas.js';
const status=document.getElementById('status'),canvas=document.getElementById('atlas');
let instance=null;
try{
 if(!globalThis.BABYLON)throw new Error('3D描画ライブラリを読み込めませんでした。通信を確認してください。');
 const response=await fetch('/atlas-review/content.json',{cache:'no-store'});
 if(!response.ok)throw new Error('地理データを取得できませんでした（'+response.status+'）。');
 const content=await response.json();
 instance=mountWorldAtlas(canvas,content);
 status.hidden=true;
}catch(error){
 console.error('Public world atlas failed',error);
 status.textContent=error instanceof Error?error.message:'世界地図の描画に失敗しました。';
}
document.getElementById('reset').addEventListener('click',()=>location.reload());
window.addEventListener('pagehide',()=>{instance?.dispose();instance=null;},{once:true});
