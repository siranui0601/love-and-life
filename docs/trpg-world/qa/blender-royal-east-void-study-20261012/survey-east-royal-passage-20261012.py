import json,pathlib,math
from shapely.geometry import LineString,Point,Polygon,box
from shapely.ops import unary_union,nearest_points
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
P=json.loads((root/'plan.json').read_text('utf8'));ms={m['name']:m for m in P['meshes']}
focus=['current_castle_east_stone_stairs','current_castle_east_winch_ramp','castle_east_ramp_landing_0','castle_east_ramp_landing_1',
'castle_east_ramp','forecourt_ground','forecourt_retaining','repair_royal_cliff_tapered_revetment','current_east_escarpment_rock','b104_castle_integrated_outer_retaining']
for r in P['routes']:
 if r['id'] not in focus:continue
 pts=r['points']
 print('ROUTE',r['id'],'kind',r.get('kind'),'width',r.get('width'),'length',round(r.get('lengthM',0),1),
 'start',tuple(round(a,1)for a in pts[0]),'end',tuple(round(a,1)for a in pts[-1]))
 for v in pts[::max(1,len(pts)//12)]:
  if 250<v[0]<530 and 825<v[1]<1070:print(' WAY',tuple(round(a,1)for a in v))
print('MESHES')
for name in focus:
 if name not in ms:continue
 m=ms[name];v=m['vertices']
 print(' MES',name,len(v),len(m['faces']),[(round(min(x[i]for x in v),1),round(max(x[i]for x in v),1))for i in(0,1,2)])
# pre-existing supports and rocks around 110..160 level
for m in P['meshes']:
 n=m['name'];v=m['vertices']
 if not v:continue
 if min(q[0]for q in v)>450 or max(q[0]for q in v)<285 or min(q[1]for q in v)>1000 or max(q[1]for q in v)<840:continue
 zz=(min(q[2]for q in v),max(q[2]for q in v))
 if zz[0]<=155 and zz[1]>=150 and any(x in n.lower()for x in('retaining','wall','support','ramp','stair','rock','abutment')):
  print('GEO',n,[round(x,1)for x in zz], 'faces',len(m['faces']))
