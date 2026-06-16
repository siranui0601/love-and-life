export const app={catalog:[],userState:{},ownedGimmicks:[],placements:JSON.parse(localStorage.nohand_placements||'[]'),selectedEmojiArray:[],selectedGimmick:null,tutorialState:'intro',versions:{},debug:false,showHit:false,playing:false,usedCost:0,stageId:'stage1',seed:'stage1-fixed'};
export const ownedEmojis=()=>new Set(JSON.parse(app.userState.ownedEmojisJson||'[]'));
export const ownedGimmickIds=()=>new Set(JSON.parse(app.userState.ownedGimmickIdsJson||'[]'));
export function savePlacements(){localStorage.nohand_placements=JSON.stringify(app.placements)}
export function recalcCost(){app.usedCost=app.placements.reduce((a,p)=>a+Number(p.gimmick?.cost||0),0);return app.usedCost}
