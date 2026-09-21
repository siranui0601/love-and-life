import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {PersistentWorldService,hashWorldToken} from '../../src/server/trpg/world/service.js';
import {FileWorldStore} from '../../src/server/trpg/world/store.js';
import {replay,digest} from './validation/replay.mjs';
const name=process.argv[2]||'blind-sixth';if(!/^[a-z-]+$/.test(name))throw new Error('Invalid worldline name');
const root=new URL('./reports/',import.meta.url),content=JSON.parse(await fs.readFile(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url),'utf8'));
const record=JSON.parse(await fs.readFile(new URL(name+'-record.json',root),'utf8')),split=JSON.parse(await fs.readFile(new URL(name+'-intermediate.json',root),'utf8'));
assert.equal(digest(split.state),record.operations[split.operationIndex-1].after);
const directory=await fs.mkdtemp(fileURLToPath(new URL('blind-save-',root))),store=new FileWorldStore({directory}),ownerKey=hashWorldToken('blind-recorded-restart');
await store.put(ownerKey,{schemaVersion:2,id:'blind-life',ownerKey,contentRevision:content.revision,contentHash:hashWorldToken(JSON.stringify(content)),advancedAtMs:1,revision:0,lastSeq:0,receipts:[],state:split.state});
for(let i=0;i<2;i++){
 const service=new PersistentWorldService({content,store,autoStart:false,now:()=>864000000*(i+1)});
 try{assert.equal((await service.session(ownerKey)).view.time,split.state.time);const restored=(await store.get(ownerKey)).state;
  for(const key of ['npcs','processes','structures','events','knowledge','socialFacts','properties'])assert.deepEqual(restored[key],split.state[key],key);
  for(const key of ['observedPlaces','observedExits','siteSearches'])assert.deepEqual(restored.player[key],split.state.player[key],key);
 }finally{await service.close();}
}
const restored=(await store.get(ownerKey)).state,continuation=replay(content,{...record,initialState:restored,operations:record.operations.slice(split.operationIndex)});assert.equal(digest(continuation.state),record.finalHash);
const result={status:'PASS',diskRoundTrips:2,offlineCalendarAdvance:0,sourceOperation:split.operationIndex,suffixOperations:record.operations.length-split.operationIndex,finalHash:record.finalHash,scope:'Actual blind-play intermediate state, FileWorldStore and service restore, then exact shared-runtime command continuation. Not browser/HTTP timing equivalence.'};
await fs.writeFile(new URL(name+'-save-summary.json',root),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
