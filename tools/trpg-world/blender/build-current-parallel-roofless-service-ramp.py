"""Roofless five-flight freight slope beside royal civic staircase.
Steep winch-assisted service ramp; not an accessible footway for
unassisted carts. Stage only until collision and landings audited.
"""
import bpy,bmesh,json,math,pathlib
from mathutils import Vector
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'))
source=p['civicUpperShortStairPilot'];a,b=source['lowerRoad'],source['upperRoad']
dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
n=(dx/L,dy/L);t=(n[1],-n[0])
def xy(u,v):return(628+u*t[0]+v*n[0],670+u*t[1]+v*n[1])
pending=root/'roofless-service-ramp-r7.pending.blend'
if pending.exists():raise RuntimeError('Staged ramp exists')
col=bpy.data.collections.new('Current cliffside parallel open service ramp')
bpy.context.scene.collection.children.link(col)
pal={'deck':(.60,.57,.50,1),'curb':(.50,.49,.47,1),'masonry':(.70,.67,.60,1),'cable':(.16,.18,.21,1)}
batch={k:([],[])for k in pal}
faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
def add(k,verts,fs):
 vv,ff=batch[k];off=len(vv);vv.extend([list(x)for x in verts]);ff.extend([[z+off for z in f]for f in fs])
def bridge(k,a,b,za,zb,w=.0,thick=.45):
 w=w or 2.8
 dx=b[0]-a[0];dy=b[1]-a[1];ll=math.hypot(dx,dy)
 nx=-dy/ll*w/2;ny=dx/ll*w/2
 pts=[(a[0]+nx,a[1]+ny),(b[0]+nx,b[1]+ny),
      (b[0]-nx,b[1]-ny),(a[0]-nx,a[1]-ny)]
 verts=[[x,y,z]for z in(za-thick,zb-thick)for x,y in pts]
 # Heights differ along the long axis, not by top/bottom rectangle layers.
 verts=[[pts[0][0],pts[0][1],za-thick],[pts[1][0],pts[1][1],zb-thick],
 [pts[2][0],pts[2][1],zb-thick],[pts[3][0],pts[3][1],za-thick],
 [pts[0][0],pts[0][1],za],[pts[1][0],pts[1][1],zb],
 [pts[2][0],pts[2][1],zb],[pts[3][0],pts[3][1],za]]
 add(k,verts,faces)
def block(k,x,y,z,w,d,h):
 pts=[(x-w/2,y-d/2),(x+w/2,y-d/2),(x+w/2,y+d/2),(x-w/2,y+d/2)]
 add(k,[[x,y,q]for q in(z-h/2,z+h/2)for x,y in pts],faces)
stairRoute=next(q for q in p['routes'] if q['id']=='current_civic_upper_short_stair_east')
# Reuse the EXISTING lower stone bridge and upper stone link.
route=[list(stairRoute['points'][0]),
       [stairRoute['points'][1][0],stairRoute['points'][1][1],42.60]]
vc0=-22.5
entry=xy(-11.5,vc0)
entryOuter=xy(-14.5,vc0)  # flat approach bends BEFORE the steep flight
bridge('deck',stairRoute['points'][1][:2],entryOuter,42.60,42.60,3)
route.append([entryOuter[0],entryOuter[1],42.60])
bridge('deck',entryOuter,entry,42.60,42.55,3)
route.append([entry[0],entry[1],42.55])
piers=0
for f in range(5):
 v=vc0+4*f;direction=1 if f%2==0 else -1
 u0=-11.5 if direction==1 else 11.5
 u1=-u0
 for i in range(12):
  uA=u0+(u1-u0)*i/12;uB=u0+(u1-u0)*(i+1)/12
  axy=xy(uA,v);bxy=xy(uB,v)
  za=42+14*f+14*i/12;zb=42+14*f+14*(i+1)/12
  if f==0:  # smooth ~0.55m difference with the existing stone bridge
   za+=.55*(1-i/12)
   zb+=.55*(1-(i+1)/12)
  bridge('deck',axy,bxy,za,zb,3.0,.55)
  route.append([bxy[0],bxy[1],zb])
  # No ROOF. Low wheel curbs on open outer edges only.
  if i%2==0:
   edgeA=xy(uA,v+1.63);edgeB=xy(uB,v+1.63)
   bridge('curb',edgeA,edgeB,za+.45,zb+.45,.26,.25)
 # Two massive buttresses per flight, not individual twig-like posts.
 for u in(-6.0,6.0):
  vxy=xy(u,v+1.7)
  z=42+14*f+14*((u+11.5)/23 if direction==1 else(11.5-u)/23)
  h=z-42-.7
  if h>2.5:
   block('masonry',vxy[0],vxy[1],42+h/2,2.0,1.8,h);piers+=1
 if f<4:
  zTurn=42+14*(f+1)
  turn=[xy(u1,v),xy(u1+direction*2.8,v),
        xy(u1+direction*2.8,v+4),xy(u1,v+4)]
  for aTurn,bTurn in zip(turn,turn[1:]):
   bridge('deck',aTurn,bTurn,zTurn,zTurn,3.15,.5)
   route.append([bTurn[0],bTurn[1],zTurn])
top=xy(11.5,vc0+4*4)
upper=stairRoute['points'][-3][:2]  # connect to top stair bridge at Z112
bridge('deck',top,upper,112,112,3.1,.60)
route.append([upper[0],upper[1],112.])
route.extend([list(v)for v in stairRoute['points'][-2:]])
# Keep the stair treads and bridges, open ONLY its two lateral
# railing terminals where the parallel ascent joins the existing deck.
# Open a second safe port in the upper guard parapet; preserve flanking
# stones to prevent an unsupported drop from the long viaduct.
def open_terminal(legacy,expected_faces,remove_ids):
 ob=bpy.data.objects.get(legacy)
 original=next((x for x in p['meshes']if x['name']==legacy),None)
 if ob is None or original is None:
  raise RuntimeError('Cannot find preexisting gateway '+legacy)
 if len(original['faces'])!=expected_faces or len(ob.data.polygons)!=expected_faces:
  raise RuntimeError('Legacy wall/rail mesh has changed; stop rather than removing arbitrary faces')
 keep=[q for j,q in enumerate(original['faces']) if j not in remove_ids]
 old=ob.data
 materials=list(old.materials)
 new=bpy.data.meshes.new(legacy+'_portal_sculpted')
 new.from_pydata(original['vertices'],[],keep);new.update()
 for mat in materials:new.materials.append(mat)
 ob.data=new
 original['faces']=keep
 return len(remove_ids)
removedRail=open_terminal('current_civic_upper_short_rail',240,
                        set(range(0,6))|set(range(234,240)))
removedWall=open_terminal('b107_upper_city_upper_guard_parapet',831,
                        {741,742,743})
# Jambs continue the guard up to the actual walkway and open a 4m gate.
# There is NO overhead canopy/roof.
for y,depth in ((672.5,2.55),(680.45,5.0)):
 block('masonry',603.0,y,112.76,1.72,depth,1.27)
# Twin inclines. Historical stair tread mesh and road remain unchanged.
added=[]
for k,(v,f)in batch.items():
 if not f:continue
 nm='current_civic_parallel_roofless_ramp_'+k
 me=bpy.data.meshes.new(nm);me.from_pydata(v,[],f);me.update()
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 obj=bpy.data.objects.new(nm,me);col.objects.link(obj)
 mat=bpy.data.materials.get(nm)or bpy.data.materials.new(nm)
 mat.diffuse_color=pal[k];me.materials.append(mat)
 p['meshes'].append(dict(name=nm,vertices=[list(a.co)for a in me.vertices],
 faces=[list(a.vertices)for a in me.polygons],material=nm))
 added.append(nm)
rr=dict(id='current_civic_parallel_roofless_service_ramp',
 points=route,width=3.0,kind='cart-winch',z0=42,z1=112,
 lengthM=round(sum(math.dist(a,b)for a,b in zip(route,route[1:])),2),
 grade=round(14/23,4))
p['routes'].append(rr);p['audit']['routeCount']=len(p['routes'])
info=dict(status='PENDING_3D_QA',roofless=True,
 alongsideExistingStairs=True,flights=5,grade=round(14/23,4),
 inclinationDegrees=round(math.degrees(math.atan(14/23)),1),
 routeID=rr['id'],routeLengthM=rr['lengthM'],piers=piers,meshes=added,
 freightNote='Only winch-assisted steep cart service / manual guidance; real motor and physics not implemented',
 caveats=['Real turn geometry, collision and bridge supports require QA',
 'This does not replace conventional 5-8% accessible ramps or lift'])
p['currentRooflessCartIncline']=info
(root/'roofless-ramp-r7-plan.staged.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(root/'roofless-ramp-r7-study.staged.json').write_text(json.dumps(info,indent=2),encoding='utf8')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(pending))
print('RAMP_ROOFLESS_STAGED',pending.stat().st_size,info['routeLengthM'],len(added))
