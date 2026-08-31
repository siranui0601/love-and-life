import fs from "node:fs";

const indexPath = "public/index.html";
const workflowPath = ".github/workflows/now-coding-entry-once.yml";
const selfPath = "tools/now-coding/inject-menu-entry.mjs";
let source = fs.readFileSync(indexPath, "utf8");

if (!source.includes('data-game="now-coding"')) {
  const pattern = /(?<trpg>[ \t]*<div class="game-card" data-game="trpg" onclick="window\.location\.href='\/TRPG\/'" role="link" tabindex="0" aria-label="TRPG\(仮題\)を開く">\s*<div class="game-icon">⚔️<\/div>\s*<h2>TRPG\(仮題\)<\/h2>\s*<p>時間が止まらない異世界ゲームブック<\/p>\s*<\/div>)/g;
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one untouched TRPG card, found ${matches.length}; refusing broad rewrite`);
  }

  const card = `

    <div class="game-card" data-game="now-coding" role="button" tabindex="0" aria-label="Now Codingを開く"
      onclick="event.stopPropagation();(()=>{let u=null;try{u=JSON.parse(localStorage.getItem('currentUser')||'null')}catch(e){}if(u&&u.userTrackingId){window.location.href='/now-coding/';return;}sessionStorage.setItem('afterAuthRedirect','/now-coding/');document.getElementById('openLoginBtn')?.click();})()">
      <div class="game-icon" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="58" height="58" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:auto;">
          <path d="M8 8H56V56H8V8Z" stroke="currentColor" stroke-width="2"/>
          <path d="M24 8V56M40 8V56M8 24H56M8 40H56" stroke="currentColor" stroke-opacity=".35"/>
          <path d="M19 33L27 25M19 33L27 41M45 23L35 43" stroke="currentColor" stroke-width="3" stroke-linecap="square"/>
        </svg>
      </div>
      <h2>Now Coding</h2>
      <p>コードを組んで、駒を戦わせろ。</p>
    </div>`;

  source = source.replace(pattern, (full) => full + card);
  fs.writeFileSync(indexPath, source, "utf8");
}

// The helper removes itself and its workflow after applying the surgical patch.
for (const path of [workflowPath, selfPath]) {
  if (fs.existsSync(path)) fs.unlinkSync(path);
}
