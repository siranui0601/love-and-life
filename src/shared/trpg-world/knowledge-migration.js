// Retire only the compiler's exact old biography template. An actual witnessed
// statement/history is not erased, and authored evidence is not rewritten.
export function retireGeneratedBiographies(state,content) {
 if(state.knowledgeMigrationVersion>=1)return false;
 const generated=new Map((content.npcs||[]).map(n=>[`background:${n.id}:0`,`${n.name}は${n.role}として、この土地で暮らしている。`]));
 const removed=[];
 const retain=(facts,holderId)=>(facts||[]).filter(f=>{
  if(f.kind!=='background'||generated.get(f.id)!==f.text)return true;
  removed.push({holderId,fact:structuredClone(f)});return false;
 });
 state.knowledge=retain(state.knowledge,'player');
 for(const npc of Object.values(state.npcs||{})){
  npc.knowledge=retain(npc.knowledge,npc.id);
  const template=(content.npcs||[]).find(n=>n.id===npc.id);
  if(template&&npc.activity===`${template.role}の仕事`)npc.activity=template.publicRole?`${template.publicRole}の仕事`:'仕事';
 }
 let ended=false;
 if(removed.length){
  state.legacySnapshot||={};state.legacySnapshot.invalidGeneratedKnowledge=removed;
  if(state.conversation?.status==='active'&&(state.conversation.factsUsed||[]).some(id=>removed.some(x=>x.fact.id===id))){
   state.legacySnapshot.invalidGeneratedConversation=structuredClone(state.conversation);state.conversation.status='ended';ended=true;
  }
 }
 state.knowledgeMigrationVersion=1;return ended;
}

export function retireDesignInspections(state,content){
 const notes=new Map((content.regions||[]).flatMap(r=>r.objects||[]).filter(o=>o.sourceDesignNotes).map(o=>[o.id,o.sourceDesignNotes]));
 for(const [id,entry] of Object.entries(state.player.inspections||{}))if(notes.get(id)===entry.text){
  state.legacySnapshot||={};state.legacySnapshot.invalidDesignInspections||={};state.legacySnapshot.invalidDesignInspections[id]=structuredClone(entry);delete state.player.inspections[id];
 }
 // Objective socialFacts and memories of actual speech are deliberately retained.
}
