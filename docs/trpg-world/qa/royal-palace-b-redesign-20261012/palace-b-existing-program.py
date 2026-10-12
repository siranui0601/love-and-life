import json,pathlib
p=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current');d=json.loads((p/'plan.json').read_text('utf8'))
for key in ('currentRoyalResidencePalaceStudy','currentRoyalReform','castleReplanB101','castleCirculationB103','currentRoyalCustomsDepot'):
 print('\n',key,json.dumps(d.get(key),ensure_ascii=False)[:6500])
for m in d['meshes']:
 n=m['name'].lower()
 if any(q in n for q in ('royal_residence','royal_palace','royal_chapel','throne_hall','palace_','royal_masonry','royal_gate','royal_court')):
  v=m.get('vertices',[])
  if v:print('OBJ',m['name'],tuple(round(min(q[i]for q in v),1)for i in range(3)),tuple(round(max(q[i]for q in v),1)for i in range(3)))
