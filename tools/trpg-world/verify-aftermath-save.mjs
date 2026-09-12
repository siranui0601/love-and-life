import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {PersistentWorldService,hashWorldToken} from '../../src/server/trpg/world/service.js';
import {FileWorldStore} from '../../src/server/trpg/world/store.js';
import {replay,digest} from './validation/replay.mjs';

// Uses a state reached by real commands, never an injected completed rescue.
// All writes remain in a fresh diagnostic directory, outside real world saves.
const root=new URL('./reports/aftermath-worldlines/',import.meta.url);
const name=process.argv[2]||'mine';if(!/^[a-z-]+$/.test(name))throw new Error('Invalid recorded worldline name');
const c=JSON.parse(await fs.readFile(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url),'utf8'));
const record=JSON.parse(await fs.readFile(new URL(name+'-replay.json',root),'utf8'));
let split;
try{split=JSON.parse(await fs.readFile(new URL(name+'-intermediate.json',root),'utf8'));}
catch(error){
 if(error.code!=='ENOENT')throw error;
 const index=record.operations.findIndex(op=>op.command?.type==='maintain');assert(index>=0,'No recorded physical work to resume');
 const prefix=replay(c,{...record,operations:record.operations.slice(0,index+1)});
 split={operation:index+1,state:prefix.state};
}
assert.equal(digest(split.state),record.operations[split.operation-1].after);
const directory=await fs.mkdtemp(fileURLToPath(new URL('save-check-',root))),store=new FileWorldStore({directory});
const ownerKey=hashWorldToken('aftermath-production-restart');
await store.put(ownerKey,{schemaVersion:2,id:'recorded-escort',ownerKey,contentRevision:c.revision,contentHash:hashWorldToken(JSON.stringify(c)),
 advancedAtMs:1,revision:0,lastSeq:0,receipts:[],state:split.state});
let now=864000000;
for(let restart=0;restart<2;restart++){
 const service=new PersistentWorldService({content:c,store,autoStart:false,now:()=>now});
 try{
  const response=await service.session(ownerKey);
  assert.equal(response.view.time,split.state.time);
  const restored=(await store.get(ownerKey)).state;
  for(const key of ['npcs','structures','events','knowledge','socialFacts','promises','properties','simulationTime'])
   assert.deepEqual(restored[key],split.state[key],`restoration changed ${key}`);
 }finally{await service.close();}
 now+=864000000;
}
const restored=(await store.get(ownerKey)).state;
const continuation=replay(c,{...record,initialState:restored,operations:record.operations.slice(split.operation)});
assert.equal(digest(continuation.state),record.finalHash);
const result={status:'PASS',worldline:name,sourceOperation:split.operation,sourceHash:digest(split.state),contentRevision:c.revision,
 diskRoundTrips:2,offlineCalendarAdvance:0,suffixOperations:record.operations.length-split.operation,
 finalHash:digest(continuation.state),sameFinalState:true,
 scope:'FileWorldStore + PersistentWorldService restore, followed by exact recorded shared-runtime continuation; not HTTP timing equivalence'};
await fs.writeFile(new URL(name+'-save-summary.json',root),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
