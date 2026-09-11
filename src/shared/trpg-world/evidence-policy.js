// Decisions describe institutional knowledge, not objective guilt. A crowd
// repeating one account is not corroboration. Policy is scoped to an authority.
export function assessEvidence(file,reports,suspect,policy={}) {
 const relevant=reports.filter(r=>r.statement.description.actorId===suspect);
 const accounts=relevant.map(r=>({reportId:r.id,source:r.reporterId,direct:r.statement.basis==='seen',
  precise:r.statement.chain.every(h=>h.memoryStatus==='clear'&&!(h.changes||[]).length),identified:!!r.statement.description.actorId}));
 const admission=file.evidence.some(e=>e.type==='admission');
 const physical=file.evidence.some(e=>e.type==='verified-possession'&&e.holderId===suspect);
 const serious=(policy.detainableOffenses||['theft','threat']).includes(file.allegedOffense);
 const reliable=accounts.some(a=>a.direct&&a.precise&&a.identified);
 const supported=admission||physical&&reliable;
 return {response:serious&&supported?'apprehend':'question',grounds:{admission,physical,reliableDirectObservation:reliable,serious},accounts,
  missing:supported?[]:['自認、または現物による裏付けが必要']};
}
