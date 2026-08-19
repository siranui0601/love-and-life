const BASE_REACTION_TYPES=new Set(['counter','reflect']);

export function initializeLearnedBaseReactions({data,session}){
  const actor=session?.state?.players?.[0];if(!actor)return[];
  session.playerRuntimeMechanics.baseReactions??=[];
  for(const skillId of actor.skillIds??[]){
    const skill=data.playerSkillById.get(skillId);if(!skill||!['reaction','passive'].includes(skill.kind))continue;
    for(const effect of skill.specialStates??[]){
      if(!BASE_REACTION_TYPES.has(effect?.type))continue;
      const stateId=effect.type;
      const entry={...effect,type:stateId,stateId,duration:99,charges:Number(effect.charges??1),sourceSkillId:skill.id};
      actor.specialStates.set(stateId,entry);
      session.playerRuntimeMechanics.baseReactions.push({skillId:skill.id,stateId,charges:entry.charges});
    }
  }
  return session.playerRuntimeMechanics.baseReactions;
}
