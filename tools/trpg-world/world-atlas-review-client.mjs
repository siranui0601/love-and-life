import {mountWorldAtlas} from '../../src/client/trpg-world/world-atlas.js';

// Authoring-only full-catalog overview. Unlike the player-facing M map, this
// intentional design review endpoint can see the entire generated world.
document.body.innerHTML=`<header><h1>TRPG（仮） · 3D WORLD ATLAS</h1><p>設計者用 · 全11地域 / R01–R15。左ドラッグで回転、ホイールで拡大。これは連続歩行の実装証明ではありません。</p><a href="/spatial-review">地域別Spatial Reviewへ戻る</a></header><canvas id="atlas" aria-label="設計者用・世界全体の立体地図"></canvas>`;
const css=document.createElement('style');
css.textContent='html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#14212a;color:#eee8d4;font:14px "Yu Gothic",sans-serif}header{position:absolute;z-index:2;top:16px;left:18px;right:18px;pointer-events:none;text-shadow:0 2px 7px #081014}h1{font:25px "Yu Mincho",serif;margin:0 0 8px}p{margin:5px 0;font-size:12px}a{display:inline-block;margin-top:8px;color:#ead29d;pointer-events:auto}canvas{width:100%;height:100%;touch-action:none;display:block}';
document.head.append(css);
const response=await fetch('/spatial-review/content');
if(!response.ok)throw new Error('Canonical world content is unavailable');
const content=await response.json();
const atlas=mountWorldAtlas(document.getElementById('atlas'),content);
window.addEventListener('pagehide',()=>atlas.dispose(),{once:true});
