import json,pathlib,math
r=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current');p=json.loads((r/'plan.json').read_text('utf8'))
for name in ('current_east_escarpment_rock','current_east_escarpment_stone','b104_castle_integrated_outer_retaining','repair_royal_cliff_tapered_revetment'):
 m=next(m for m in p['meshes']if m['name']==name)
 v=m['vertices']
 print('MESH',name)
 for y in(950,970,985,1000,1010,1020,1030,1040,1050):
  near=[x for x in v if 360<x[0]<480 and abs(x[1]-y)<3.4 and 112<x[2]<208]
  if not near:continue
  ex=sorted(near,key=lambda z:-z[0])[:10]
  print(' Y',y,'maxX',round(max(x[0]for x in near),1),'extreme',[(round(x[0],1),round(x[1],1),round(x[2],1))for x in ex[:6]])
