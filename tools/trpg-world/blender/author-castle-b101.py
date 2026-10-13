"""B101: replace the nonsensical castle massing with recognisable royal
architecture. Preserve castle terrace and its existing access centre-lines.
"""
import json,pathlib,sys,math
# The castle mesh itself has no Shapely dependency.
src,out=map(pathlib.Path,sys.argv[1:3])
if out.exists():raise RuntimeError('B101 output exists')
p=json.loads((src/'plan.json').read_text(encoding='utf-8'))
d=json.loads((src/'parcels.json').read_text(encoding='utf-8'))
old={m['name']for m in p['meshes']}
Z=204
def mesh(name,v,f,mat='royal_stone'):
 p['meshes'].append(dict(name='b101_'+name,vertices=v,faces=f,material=mat))
def prism(name,x,y,w,d,z,h,material='royal_stone'):
 v=[[x-w/2,y-d/2,z],[x+w/2,y-d/2,z],[x+w/2,y+d/2,z],[x-w/2,y+d/2,z]]
 v+= [[q[0],q[1],z+h]for q in v]
 f=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
 mesh(name,v,f,material)
def gabled(name,x,y,w,d,z,wallh=26,roofh=12):
 prism(name+'_block',x,y,w,d,z,wallh)
 l=x-w/2;r=x+w/2;b=y-d/2;t=y+d/2;top=z+wallh
 v=[[l-2,b-2,top],[r+2,b-2,top],[r+2,t+2,top],[l-2,t+2,top],[x,b-2,top+roofh],[x,t+2,top+roofh]]
 mesh(name+'_high_roof',v,[[0,1,4],[3,5,2],[0,4,5,3],[4,1,2,5]],'royal_roof_blue')
 # facade accent piers & roof finials, no mass-produced house appearance
 for k,sx in enumerate([l+4,r-4]):
  prism(name+'_face_pier_'+str(k),sx,b-.7,1.7,1.7,z,wallh+2,'royal_light_stone')
 for k,xx in enumerate([l+7,x,r-7]):
  prism(name+'_window_bay_'+str(k),xx,b-1.08,2.2,.26,z+wallh*.53,5,'royal_shadow')
def tower(name,x,y,r,z,shaft,roof=16):
 n=12;v=[]
 for h,rad in [(0,r),(shaft,r),(shaft+1,r+1)]:
  v.extend([[x+rad*math.cos(2*math.pi*i/n),y+rad*math.sin(2*math.pi*i/n),z+h]for i in range(n)])
 f=[]
 for ring in range(2):
  for i in range(n):
   a=ring*n+i;b=ring*n+(i+1)%n;f.append([a,b,b+n,a+n])
 mesh(name+'_shaft',v,f,'royal_stone')
 mesh(name+'_roof',v[2*n:]+[[x,y,z+shaft+roof]],[[i,(i+1)%n,n]for i in range(n)],'royal_roof_blue')
 for i in range(0,n,3):
  angle=2*math.pi*i/n
  a=x+(r+.18)*math.cos(angle);b=y+(r+.18)*math.sin(angle)
  prism(name+'_arrow_slot_'+str(i),a,b,1.2,.38,z+shaft*.72,3.2,'royal_shadow')
def paving(name,x,y,w,d,z,mat):
 v=[[x-w/2,y-d/2,z],[x+w/2,y-d/2,z],[x+w/2,y+d/2,z],[x-w/2,y+d/2,z]]
 mesh(name,v,[[0,1,2,3]],mat)
def arcade(name,x0,y0,x1,y1,z,n=8):
 dx=(x1-x0)/n;dy=(y1-y0)/n
 for i in range(n+1):
  x=x0+i*dx;y=y0+i*dy
  prism(name+'_column_'+str(i),x,y,1.6,1.6,z,11,'royal_light_stone')
 # continuous overhead spine
 L=math.hypot(x1-x0,y1-y0)
 if abs(x1-x0)>abs(y1-y0):
  prism(name+'_beam',(x0+x1)/2,(y0+y1)/2,L+2,2,z+11,1.3,'royal_light_stone')
 else:prism(name+'_beam',(x0+x1)/2,(y0+y1)/2,2,L+2,z+11,1.3,'royal_light_stone')
# Keep location is displaced EAST of a historically existing lane, preserving
# castle_lane_1 and the east ramp/stairs landing as actual access.
gabled('principal_throne_hall',361,1119,104,105,Z,36,19)
gabled('western_residence_wing',264,1150,56,49,Z,20,11)
gabled('eastern_royal_offices',381,1025,64,34,Z,18,9)
gabled('western_command_barracks',175,1025,42,48,Z,14,8)
for name,x,y,r,h in [('northwest',227,1185,11,38),('northeast',416,1185,12,49),
                      ('southeast',416,1061,11,42),('southern_outer',255,1062,9,35)]:
 tower('castle_'+name,x,y,r,Z,h)
# Ceremonial courtyard and the defensive entrance are functional, not filler.
paving('royal_ceremony_court',351,1031,102,44,Z+.05,'royal_court_stone')
arcade('royal_processional_cloister_west',297,1016,297,1048,Z,4)
arcade('royal_processional_cloister_east',406,1016,406,1048,Z,4)
# Gatehouse excludes the 6m lane so its old centreline is not blocked.
tower('royal_gate_left',312,976,7,Z,23,10)
tower('royal_gate_right',340,976,7,Z,23,10)
# Historical court relief and palace staircase. Avoid traversable route at x326.
for i in range(6):
 z=Z+(i+1)*.32
 paving('throne_stair_'+str(i),360,1060-i*1.1,44,1.05,z,'royal_light_stone')
# castellated royal skyline between substantial hall and towers
for i,x in enumerate(range(308,412,9)):
 prism('palace_merlon_'+str(i),x,1065,3,3,Z+35,3,'royal_light_stone')
# Royal complex is NOT a mass of anonymous residential parcels.
study=dict(status='REQUIRES_3D_VISUAL_AND_COLLISION_QA',base=src.name,
 removedSceneObjects=['castle_compound building walls','castle_compound roofs',
                      'Proposed castle palace'],
 newMeshes=[m['name']for m in p['meshes']if m['name']not in old],
 semantic='A defensible palace, grand audience hall, court offices, guarded approach, and towers',
 doesNotChangeCanonicalId=True,
 concerns=['Castle road clearance and silhouette must be inspected','Road network remains B100',
           'Previous long ramp and retaining-wall problems not yet solved'])
p['castleReplanB101']=study
out.mkdir()
for n,v in [('plan.json',p),('parcels.json',d),('castle-replan-study.json',study)]:
 (out/n).write_text(json.dumps(v,separators=(',',':')),encoding='utf-8')
print(json.dumps(dict(out=str(out),addedMeshCount=len(study['newMeshes']),removed=len(study['removedSceneObjects']))))
