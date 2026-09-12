import {createHash} from 'node:crypto';
// Explicitly observed historical content versions, never a wildcard compatibility rule.
const versions=new Map([
 ['world-10d-0c89fc7ee769','a257dd91c417239bbdeb89df8414119f7a66caa7afcfefa3056c9fbc30726360'],
 ['world-10d-3d92a17b3ca5','6fb542356bf8d214b8f3a7d93410c027dd43980fc54f9a7352823518964721ac'],
 ['world-10d-33147c357b78',null],['world-10d-29a21ee5da06',null],['world-10d-7d0caf2d3049',null],
 ['world-10d-24de1ef85209','705e96bfa08f795647cca3b56829b23e44aac25b1d85c1151f682a32666f9908'],
]);
export function canMigrateContent(record,content) {
 // This additive migration retains existing outcomes and introduces the shaft
 // only in the reviewed target generation. It is not permission for any future
 // content revision to reinterpret the checkpoint's save.
 if(record.contentRevision==='world-10d-24de1ef85209'&&(content.revision!=='world-10d-10c3365b9e26'||createHash('sha256').update(JSON.stringify(content)).digest('hex')!=='91621277a5b0e34baef654f6a196a4c455c36fb6d2628d41c456f8342e939b19'))return false;
 if(!versions.has(record.contentRevision)||record.state?.schemaVersion!==1&&record.state?.schemaVersion!==2)return false;
 if((record.contentHash??null)!==versions.get(record.contentRevision))return false;
 const s=record.state;
 if(s.contentRevision!==record.contentRevision||!Number.isFinite(s.time)||!Number.isFinite(s.random))return false;
 const sets=Object.fromEntries(['regions','npcs','events','monsters'].map(k=>[k,new Set((content[k]||[]).map(x=>x.id))]));
 if(!sets.regions.has(s.player?.region)||!Array.isArray(s.player.position)||s.player.position.length!==3||!s.player.position.every(Number.isFinite))return false;
 for(const key of ['npcs','regions','events'])if(!s[key]||Object.keys(s[key]).some(id=>!sets[key].has(id))||Object.keys(s[key]).length!==sets[key].size)return false;
 for(const n of Object.values(s.npcs))if(!sets.regions.has(n.region)||n.travel&&!sets.regions.has(n.travel.to))return false;
 for(const m of Object.values(s.monsters||{}))if(!sets.monsters.has(m.templateId)||!sets.regions.has(m.region))return false;
 return true;
}
