import {createHash} from 'node:crypto';
// Explicitly observed historical content versions, never a wildcard compatibility rule.
const versions=new Map([
 ['world-10d-7447e1bcfa30','8a5fe8b96466446cc564ee2fa8eba5636dac1f313f907c4c87fed8812d1d0353'],
 ['world-10d-25c5a7733444','54c487dd467dce5c7a7a944e1d842f0f01cdd14b336f9bd32a5e8943b7223bc0'],
 ['world-10d-30a9cef5f426','336695fb99c010735c5cbb837ad1551a04eb5c67c45a04e39419923e8fe9948d'],
 ['world-10d-be0609b3b3b0','2d5c4f51ab6aaa306d41d58640fed69cf41a66bb4a6f2ebddfa33d86e96a4da5'],
 ['world-10d-4de4bc7caf72','e0eedf7e177b01de941d7c01431a2b37aa9f23c029e20dda2e1de6776ef082e2'],
 ['world-10d-1620f79180c0','2dd4e9662ebc4cbe525776f85a168fa5812bfc7d5c2affe76295b972e996f8d3'],
 ['world-10d-c0ca1f03faba','4f969820b2b81e895304621bd54a92b7380c8aad864cc42ebe746c1be1ed9390'],
 ['world-10d-940b5356c6a8','5594baac95de746eb873321e3c074e6499f9f233cb32acb2e1fc8ce4fce3120f'],
 ['world-10d-0c89fc7ee769','a257dd91c417239bbdeb89df8414119f7a66caa7afcfefa3056c9fbc30726360'],
 ['world-10d-3d92a17b3ca5','6fb542356bf8d214b8f3a7d93410c027dd43980fc54f9a7352823518964721ac'],
 ['world-10d-33147c357b78',null],['world-10d-29a21ee5da06',null],['world-10d-7d0caf2d3049',null],
 ['world-10d-10c3365b9e26','91621277a5b0e34baef654f6a196a4c455c36fb6d2628d41c456f8342e939b19'],
 ['world-10d-24de1ef85209','705e96bfa08f795647cca3b56829b23e44aac25b1d85c1151f682a32666f9908'],
 ['world-10d-ec2c41296f3c','095e3f7e79de4ae8d7e86d0bbd405afa0203dfbd70ded2bb78db867697cca388'],
]);
const reviewedTargets=new Map([
 ['world-10d-8cc8c18b05b7','e91dabb3a30f29e81b894b81b89c11b33801f979542b8b45f3b09a9d58c47d1b'],
 ['world-10d-7447e1bcfa30','8a5fe8b96466446cc564ee2fa8eba5636dac1f313f907c4c87fed8812d1d0353'],
 ['world-10d-25c5a7733444','54c487dd467dce5c7a7a944e1d842f0f01cdd14b336f9bd32a5e8943b7223bc0'],
 ['world-10d-30a9cef5f426','336695fb99c010735c5cbb837ad1551a04eb5c67c45a04e39419923e8fe9948d'],
 ['world-10d-4de4bc7caf72','e0eedf7e177b01de941d7c01431a2b37aa9f23c029e20dda2e1de6776ef082e2'],
 ['world-10d-be0609b3b3b0','2d5c4f51ab6aaa306d41d58640fed69cf41a66bb4a6f2ebddfa33d86e96a4da5'],
]);
export function canMigrateContent(record,content) {
 // This additive migration retains existing outcomes and introduces the shaft
 // only in the reviewed target generation. It is not permission for any future
 // content revision to reinterpret the checkpoint's save.
 if(['world-10d-7447e1bcfa30','world-10d-25c5a7733444','world-10d-30a9cef5f426','world-10d-be0609b3b3b0','world-10d-4de4bc7caf72','world-10d-1620f79180c0','world-10d-c0ca1f03faba','world-10d-940b5356c6a8','world-10d-24de1ef85209','world-10d-10c3365b9e26','world-10d-ec2c41296f3c'].includes(record.contentRevision)&&createHash('sha256').update(JSON.stringify(content)).digest('hex')!==reviewedTargets.get(content.revision))return false;
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
