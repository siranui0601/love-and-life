import json,pathlib,collections
p=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
d=json.loads((p/'plan.json').read_text('utf8'))
print('TOP_KEYS',list(d))
for k in ('meshes','routes','buildings','facilities','districts'):
 v=d.get(k);print('COUNT',k,len(v)if hasattr(v,'__len__')else None)
 if isinstance(v,list)and v:print('SAMPLE',str(v[0])[:550])
for key in ('meshes','routes'):
 a=d.get(key,[])
 sel=[x for x in a if any(q in str(x.get('name',x.get('id',''))).lower() for q in ('royal','castle','palace','throne','chapel','court','gatehouse','kitchen','stable'))]
 print('MATCH',key,len(sel))
 for x in sel[:100]:
  if key=='meshes':
   v=x.get('vertices',[]);xs=[q[0]for q in v];ys=[q[1]for q in v];zs=[q[2]for q in v]
   print('M',x.get('name'),len(v),[round(min(a),1)for a in (xs,ys,zs)]if v else [],[round(max(a),1)for a in (xs,ys,zs)]if v else [])
  else:print('R',x.get('id'),len(x.get('points',[])),str(x.get('points',[])[:2])[:150])
