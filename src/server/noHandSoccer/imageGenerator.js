import fs from 'node:fs/promises';
import path from 'node:path';
import {sha256} from './gimmickBuilder.js';
function esc(s){return String(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
export async function ensureIcon(visualLabel, emojiSequence='⚽'){
  const imageId=sha256('icon:'+visualLabel);
  const dir=path.join(process.cwd(),'public/noHand_soccer/generated-icons');
  await fs.mkdir(dir,{recursive:true});
  const file=path.join(dir,`${imageId}.svg`);
  try{await fs.access(file)}catch{
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eaffd0"/><stop offset="1" stop-color="#3ddc84"/></linearGradient><filter id="s"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-opacity=".28"/></filter></defs><rect width="256" height="256" rx="48" fill="url(#g)"/><path d="M20 70h216M20 186h216M128 10v236" stroke="white" stroke-opacity=".35" stroke-width="8"/><circle cx="128" cy="128" r="70" fill="none" stroke="white" stroke-opacity=".55" stroke-width="7"/><text x="128" y="116" text-anchor="middle" font-size="58" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif" filter="url(#s)">${esc(emojiSequence)}</text><text x="128" y="182" text-anchor="middle" font-size="24" font-weight="800" font-family="sans-serif" fill="#073b23">${esc(visualLabel).slice(0,12)}</text></svg>`;
    await fs.writeFile(file,svg);
  }
  return{imageId,imagePath:`/noHand_soccer/generated-icons/${imageId}.svg`};
}
