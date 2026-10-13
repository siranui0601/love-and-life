exec(__import__('pathlib').Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current\work014-F01-full-boundary-survey.py').read_text('utf-8-sig'))
ns={};exec((R/'author-user-F01-F08-v23.py').read_text('utf-8-sig').split('cases=')[0],ns)
added=[]
for i,g in enumerate(parts):
 if g.length<1:continue
 wall=g.buffer(2.5,cap_style=3,join_style=2)
 for r in P['routes']:
  if not any(14<=p[2]<76 for p in r['points']):continue
  l=LineString([p[:2] for p in r['points']])
  assert l.distance(wall)>r.get('width',2)/2+1,('wall route conflict',r['id'])
 soil=wall.buffer(1,join_style=2)
 assert wall.intersection(D['noble_west']).area>20
 assert soil.intersection(D['low_city']).area>20
 for poly,name,hi,lo in [(wall,'work014_noble_complete_seam_'+str(i),78,13.7),(soil,'work014_noble_complete_ground_'+str(i),14,11.4)]:
  P['meshes'].append(ns['volume'](poly,name,hi,lo));added.append(name)
P['work014WallBaseRepair']['completeNobleSeamMeshes']=added
out=R/'work014-p0-complete.staged.plan.json';assert not out.exists()
out.write_text(json.dumps(P,separators=(',',':')),encoding='utf8')
print('COMPLETE_SEAMS',added,flush=True)
