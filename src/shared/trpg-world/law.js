import {societyDefinitions} from './society-content.js';
import {recalled,testimony,hearTestimony} from './memory.js';
import {rememberAction,evaluateCooperation} from './relationships.js';
import {distance,hasLineOfSight,followPath} from './navigation.js';
import {searchPlan,advanceActionPlan} from './npc-planner.js';
const offenses=new Set(['theft','attempted-theft','document-read','trespass','threat']);
export function initializeLaw(state,content) {
 state.law||={authorities:structuredClone(societyDefinitions(content).authorities),reports:[],cases:[],warrants:[]};
}
function near(state,content,a,b,range=5){return a&&b&&a.hp>0&&b.hp>0&&!a.travel&&!b.travel&&a.region===b.region&&distance(a.position,b.position)<=range&&hasLineOfSight(content.regions.find(r=>r.id===a.region),a.position,b.position);}
export function crimeMemories(npc) {return (npc.memories||[]).filter(m=>m.recall&&m.status!=='forgotten'&&offenses.has(m.recall.kind)&&(m.recall.kind!=='document-read'||m.recall.private));}
export function reportCrime(state,content,reporter,officer,factId) {
 initializeLaw(state,content);
 const authority=state.law.authorities.find(a=>a.jurisdiction===officer.region&&a.officerIds.includes(officer.id)),memory=recalled(reporter,factId);
 if(!authority||!near(state,content,reporter,officer)||!memory?.recall||!offenses.has(memory.recall.kind))return null;
 if(state.law.reports.some(r=>r.reporterId===reporter.id&&r.originFactId===factId&&r.authorityId===authority.id))return null;
 const statement=testimony(state,reporter,memory);
 const report={id:`report:${state.nextId++}`,authorityId:authority.id,reporterId:reporter.id,receiverId:officer.id,originFactId:factId,at:state.time,statement};state.law.reports.push(report);
 hearTestimony(state,officer,reporter,statement);
 rememberAction(state,content,'testimony-given',{actorId:reporter.id,targetId:officer.id,payload:{reportId:report.id},observedBy:[reporter.id,officer.id]});
 let file=state.law.cases.find(c=>c.authorityId===authority.id&&c.originFactId===factId);
 if(!file){file={id:`case:${state.nextId++}`,authorityId:authority.id,jurisdiction:authority.jurisdiction,originFactId:factId,allegedOffense:statement.description.kind,evidence:[],suspects:[],status:'investigating',openedAt:state.time};state.law.cases.push(file);}
 file.evidence.push({type:'testimony',reportId:report.id});
 const suspect=statement.description.actorId;
 if(suspect&&!file.suspects.includes(suspect))file.suspects.push(suspect);
 // A single remembered account starts an inquiry. Coercive action needs two
 // independent firsthand accounts, or an admission given to this authority.
 for(const id of file.suspects) {
  const reports=state.law.reports.filter(r=>r.authorityId===authority.id&&r.originFactId===factId&&r.statement.description.actorId===id);
  const direct=new Set(reports.filter(r=>r.statement.basis==='seen').map(r=>r.reporterId));
  const old=state.law.warrants.find(w=>w.caseId===file.id&&w.knownSuspect===id&&w.status==='active');
  const warrant=old||{id:`warrant:${state.nextId++}`,issuingAuthority:authority.id,jurisdiction:authority.jurisdiction,caseId:file.id,allegedOffense:file.allegedOffense,knownSuspect:id,evidence:[],witnesses:[],issuedAt:state.time,status:'active'};
  warrant.response=direct.size>=2?'apprehend':'question';warrant.evidence=reports.map(r=>r.id);warrant.witnesses=[...new Set(reports.map(r=>r.reporterId))];warrant.lastReportedPlace={region:statement.description.region,position:[...statement.description.position]};
  if(!old)state.law.warrants.push(warrant);officer.knownWarrantIds||=[];if(!officer.knownWarrantIds.includes(warrant.id))officer.knownWarrantIds.push(warrant.id);
 }
 return report;
}
function socialChoice(state,npc,memory) {
 const suspect=memory.recall.actorId,personality=npc.personality||'',values=npc.values||{};
 const aid=suspect&&evaluateCooperation(state,npc,{actorId:suspect,purpose:'discretion',risk:.2});
 if(aid?.willing&&memory.source.type!=='seen')return 'silence';
 if(/臆病|怖がり/.test(personality)||values.caution>.8)return 'report';
 if(/強欲|金に|恐喝/.test(personality)&&suspect)return 'demand';
 if(/勇敢|正義|短気/.test(personality)&&suspect)return 'confront';
 return 'report';
}
export function advanceSocialPlan(state,content,npc,seconds) {
 initializeLaw(state,content);
 if(npc.hp<=0||npc.travel||npc.rescueAssignment||npc.causalAssignment)return false;
 if(npc.socialAssignment) {
  const a=npc.socialAssignment,other=state.npcs[a.recipientId]||(a.recipientId==='player'?state.player:null),m=recalled(npc,a.factId);
  if(!other||!m||npc.hunger>95||npc.fatigue>95||other.region!==npc.region){if(npc.plan)npc.plan.status='invalidated';npc.lastSocialFailure={at:state.time,reason:!m?'forgotten':'recipient-or-needs'};delete npc.socialAssignment;delete npc.plan;npc.nextDecision=0;return false;}
  const outcome=advanceActionPlan(state,npc,seconds,{facts:()=>({known:!!m,near:near(state,content,npc,other),done:false}),handlers:{
   'approach-person':(step,dt)=>{const before=distance(npc.position,other.position);followPath(content.regions.find(r=>r.id===npc.region),npc,other.position,dt/(content.time?.scale||60)*1.8);step.stalled=distance(npc.position,other.position)>=before-.01?(step.stalled||0)+dt:0;return step.stalled>1800?{failed:'path-unreachable'}:{complete:near(state,content,npc,other)};},
   'give-report':()=>({complete:!!reportCrime(state,content,npc,other,m.factId)||state.law.reports.some(r=>r.originFactId===m.factId&&r.reporterId===npc.id)}),
   'confront-person':()=>{npc.confrontation={factId:m.factId,suspectId:m.recall.actorId,kind:a.response,at:state.time};rememberAction(state,content,a.response==='demand'?'demand':'accusation',{actorId:npc.id,targetId:other.id,payload:{aboutFactId:m.factId}});return {complete:true};}
  }});
  if(['completed','invalidated'].includes(outcome)){npc.socialConsidered||={};npc.socialConsidered[a.factId]=state.time;delete npc.socialAssignment;delete npc.plan;npc.nextDecision=0;}
  return true;
 }
 if(npc.goal==='sleep'||npc.hunger>90||npc.fatigue>90)return false;
 const memory=crimeMemories(npc).find(m=>!npc.socialConsidered?.[m.factId]&&m.recall.actorId!==npc.id);
 if(!memory)return false;
 const response=socialChoice(state,npc,memory);
 if(response==='silence'){npc.socialConsidered||={};npc.socialConsidered[memory.factId]=state.time;return false;}
 const authority=state.law.authorities.find(a=>a.jurisdiction===npc.region);
 const candidate=response==='report'?authority?.officerIds.map(id=>state.npcs[id]).find(n=>n&&near(state,content,npc,n,45)):memory.recall.actorId==='player'?state.player:state.npcs[memory.recall.actorId];
 if(!candidate||!near(state,content,npc,candidate,45))return false;
 const initial={known:true,near:near(state,content,npc,candidate),done:false},operators=[
  {action:'approach-person',preconditions:{known:true,near:false},effects:{near:true},cost:1,expectedDuration:60},
  {action:response==='report'?'give-report':'confront-person',preconditions:{known:true,near:true},effects:{done:true},cost:1,expectedDuration:30}];
 const steps=searchPlan(initial,{done:true},operators);if(!steps)return false;
 npc.plan={id:`plan:${state.nextId++}`,goal:response==='report'?'report-crime':'confront-suspect',region:npc.region,status:'active',steps,cursor:0,createdAt:state.time};
 npc.socialAssignment={factId:memory.factId,recipientId:candidate.id,response};npc.activity=response==='report'?'目撃したことを伝えに行く':'確かめたいことがある';return true;
}
export function advanceLaw(state,content) {
 initializeLaw(state,content);
 for(const officer of Object.values(state.npcs))for(const id of officer.knownWarrantIds||[]) {
  const warrant=state.law.warrants.find(w=>w.id===id&&w.status==='active'&&w.jurisdiction===officer.region);
  if(!warrant)continue;
  const suspect=warrant.knownSuspect==='player'?state.player:state.npcs[warrant.knownSuspect];
  if(!near(state,content,officer,suspect))continue;
  officer.confrontation={caseId:warrant.caseId,warrantId:id,suspectId:suspect.id,kind:warrant.response,at:state.time};officer.activity='事情を聞こうとしている';
  if(warrant.response==='apprehend'&&!suspect.detention){suspect.detention={authorityId:warrant.issuingAuthority,warrantId:id,at:state.time,status:'summoned'};rememberAction(state,content,'custody-demanded',{actorId:officer.id,targetId:suspect.id,payload:{warrantId:id}});}
 }
}
export function exchangeCrimeMemories(state,speaker,listener) {
 const m=crimeMemories(speaker).find(m=>!listener.memories.some(n=>n.factId===m.factId));
 if(m)hearTestimony(state,listener,speaker,testimony(state,speaker,m));
}
export function legalChoices(state,npc) {
 const confrontation=npc.confrontation?.suspectId==='player'?npc.confrontation:null;
 const options=[];
 if(confrontation)for(const [intent,label] of [['QUESTION_EVIDENCE','何を根拠に疑っているのか聞く'],['DENY','自分ではないと否定する'],['CONFESS','自分がしたことだと認める'],['BARGAIN','返却と償いで話を収められないか相談する'],['THREATEN','追及するならただでは済まないと脅す']])options.push({id:`law:${intent}`,intent,family:'law',label});
 const accusation=state.knowledge.find(k=>k.testimony?.description.actorId&&k.testimony.description.actorId!=='player');
 if(accusation)options.push({id:'law:ACCUSE',intent:'ACCUSE',family:'law',factId:accusation.id,label:'見聞きした行為について告発する'});
 return options;
}
export function speakLegal(state,content,npc,choice,fact) {
 const c=npc.confrontation,file=state.law?.cases.find(f=>f.id===c?.caseId),warrant=state.law?.warrants.find(w=>w.id===c?.warrantId);
 fact.payload.semanticIntent=choice.intent;
 if(choice.intent==='ACCUSE') {const k=state.knowledge.find(k=>k.id===choice.factId);hearTestimony(state,npc,{id:'player'},k.testimony);return 'その話を聞いた。まず裏を確かめよう。';}
 if(choice.intent==='QUESTION_EVIDENCE')return file?`${file.evidence.length}件の証言を受け取っている。言い分も聞きたい。`:'見聞きしたことについて、あなたの言い分を聞きたい。';
 if(choice.intent==='DENY'){npc.beliefs.push({id:`belief:${state.nextId++}`,claim:'denies-allegation',about:'player',factId:fact.id,source:{type:'heard',actorId:'player'},at:state.time});return '否定したことも覚えておく。ほかの話と照らし合わせよう。';}
 if(choice.intent==='CONFESS'){if(file){file.evidence.push({type:'admission',factId:fact.id,receivedBy:npc.id});file.status='admitted';}return '認めるのだね。被害を戻せるか、まず確かめよう。';}
 if(choice.intent==='THREATEN'){rememberAction(state,content,'threat',{targetId:npc.id,payload:{ownerId:npc.id,aboutFactId:c?.factId}});npc.nextDecision=0;return 'その言葉も、黙って聞き流すわけにはいかない。';}
 if(choice.intent==='BARGAIN') {
  const incident=(state.propertyIncidents||[]).find(i=>i.factId===(file?.originFactId||c?.factId));const object=state.properties?.[incident?.assetId];
  if(object?.custodianId==='player')return 'まず持ち去った物を元の箱へ戻してほしい。返却した上で話そう。';
  if(!incident||!object||object.custodianId!==object.ownerId)return '被害の回復をまだ確かめられない。約束だけで終わりにはできない。';
  if(file&&file.status!=='admitted')return '返却と、誰が何をしたのかは別の話だ。事情を話してほしい。';
  if(file){file.status='restitution-agreed';file.evidence.push({type:'custody-check',assetId:object.id,at:state.time});}if(warrant)warrant.status='settled';delete npc.confrontation;
  rememberAction(state,content,'restitution-agreed',{targetId:npc.id,payload:{caseId:file?.id,assetId:object.id}});return '品物が戻ったことを確認した。返却による償いとして記録しよう。';
 }
 return '話を聞いた。';
}
