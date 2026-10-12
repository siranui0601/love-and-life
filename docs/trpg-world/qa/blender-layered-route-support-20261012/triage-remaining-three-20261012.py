import json,pathlib,math
r=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((r/'plan.json').read_text('utf8'))
for name,pt in [('noble_east_winch_incline',(-560,559,77)),('civic_foot_contour_1_retained_1',(-592,520,42)),('court_wall_stairs',(101.16,769.8,138.64))]:
 route=next(x for x in p['routes']if x['id']==name)
 arr=sorted(enumerate(route['points']),key=lambda q:math.dist(q[1][:2],pt[:2]))[:18]
 print('\nROUTE',name,'width',route.get('width'),'len',route.get('lengthM'),'pts',len(route['points']))
 print('CLOSE',[(i,tuple(round(t,2)for t in v))for i,v in arr])
 near=[]
 for m in p['meshes']:
  v=m['vertices']
  if not v:continue
  lo=[min(x[i]for x in v)for i in range(3)];hi=[max(x[i]for x in v)for i in range(3)]
  if not(lo[0]-1<=pt[0]<=hi[0]+1 and lo[1]-1<=pt[1]<=hi[1]+1):continue
  if lo[2]>pt[2]+5 or hi[2]<pt[2]-6:continue
  near.append((m['name'],tuple(round(a,1)for a in lo),tuple(round(a,1)for a in hi),len(m['faces'])))
 print('BBOX_CANDIDATES',len(near),near[:45])
