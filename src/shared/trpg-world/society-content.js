// Source bindings, separate from generated balance data. All execution uses the
// same property / testimony / institutional primitives in every region.
export function societyDefinitions(content) {
 if(content.society)return content.society;
 if(content.npcs.length<20)return {properties:[],authorities:[]};
 const properties=[],authorities=[];
 for(const region of content.regions) {
  const residents=content.npcs.filter(n=>n.region===region.id);
  const officers=residents.filter(n=>/衛兵|警備|騎士|隊長|役人|領主|村長/.test(n.role||''));
  if(officers.length)authorities.push({id:`authority:${region.id}`,name:`${region.name}の公役所`,jurisdiction:region.id,officerIds:officers.map(n=>n.id)});
  const location=region.objects.find(o=>o.kind==='inn')||region.objects.find(o=>o.kind==='shop');
  const owner=residents.find(n=>/宿|店|商/.test(n.role||''))||residents.find(n=>!(/子|孤児/.test(n.role||'')));
  if(!location||!owner)continue;
  const chest=`private:${location.id}`,letter=`letter:${location.id}`;
  properties.push({id:chest,name:'私物をしまう箱',kind:'container',ownerId:owner.id,custodianId:owner.id,region:region.id,position:location.position,anchorId:location.id,privacy:'private',contents:[letter]},
   {id:letter,name:'仕入れの覚え書き',kind:'document',ownerId:owner.id,custodianId:owner.id,region:region.id,position:location.position,parentId:chest,privacy:'private',document:{id:letter,title:'仕入れの覚え書き',text:`次の便で食料と薬を仕入れる。代金は受け取りの時に渡す。差出人：${owner.name}`,topic:'trade'}});
 }
 for(const scenario of content.causalScenarios||[])if(scenario.type==='institution') {
  for(const doc of scenario.documents) {
   const region=content.regions.find(r=>r.objects.some(o=>o.id===doc.targetId));if(!region)continue;
   const location=region.objects.find(o=>o.id===doc.targetId),owner=content.npcs.find(n=>n.region===region.id&&/役人|商|孤児|院長/.test(n.role||''))||content.npcs.find(n=>n.region===region.id);
   const id=`document:${scenario.eventId}:${doc.id}`,chest=`archive:${doc.targetId}`;
   let box=properties.find(p=>p.id===chest);if(!box){box={id:chest,name:'書類箱',kind:'container',ownerId:owner.id,custodianId:owner.id,region:region.id,position:location.position,anchorId:location.id,privacy:doc.id==='registry'?'public':'private',contents:[]};properties.push(box);}
   box.contents.push(id);properties.push({id,name:doc.title,kind:'document',ownerId:owner.id,custodianId:owner.id,region:region.id,position:location.position,parentId:chest,privacy:box.privacy,document:{...doc,eventId:scenario.eventId,knowledgeId:`document:${scenario.eventId}:${doc.id}`,topic:'land-tenure'}});
  }
 }
 return {properties,authorities};
}
