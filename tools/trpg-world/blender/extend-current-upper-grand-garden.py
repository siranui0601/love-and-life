"""Expand the upper garden from a tiny green into a landmark-scale civic garden.
Adds a southern entrance, district circuit, orchard, waypoint court and
botanical records nook. Preserve all previous streets and houses.
"""
import bpy,bmesh,json,pathlib,math
from mathutils import Vector
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
plan=json.loads((root/'two-parks-plan.staged.json').read_text('utf8'))
pending=root/'grand-upper-garden.pending.blend'
if pending.exists():raise RuntimeError('Existing staged design')
col=bpy.data.collections.new('Upper civic grand botanical garden expansion')
bpy.context.scene.collection.children.link(col)
colors={'stone':(.70,.67,.57,1),'path':(.58,.56,.51,1),
 'turf':(.32,.46,.27,1),'tree':(.17,.32,.2,1),
 'timber':(.36,.25,.17,1),'water':(.18,.43,.53,1),'bronze':(.57,.43,.24,1)}
G={k:([],[])for k in colors}
def emit(k,v,faces):
 a,b=G[k];j=len(a);a.extend([list(q)for q in v]);b.extend([[j+i for i in f]for f in faces])
def block(k,x,y,z,w,d,h):
 xy=[(x-w/2,y-d/2),(x+w/2,y-d/2),(x+w/2,y+d/2),(x-w/2,y+d/2)]
 v=[[i,j,t]for t in(z-h/2,z+h/2)for i,j in xy]
 emit(k,v,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
def cylinder(k,x,y,z,r,h,N=16):
 v=[]
 for zz in (z-h/2,z+h/2):
  for i in range(N):
   a=2*math.pi*i/N
   v.append([x+math.cos(a)*r,y+math.sin(a)*r,zz])
 faces=[list(range(N-1,-1,-1)),list(range(N,2*N))]
 for i in range(N):faces.append([i,(i+1)%N,(i+1)%N+N,i+N])
 emit(k,v,faces)
def pathSegment(a,b,width):
 dx=b[0]-a[0];dy=b[1]-a[1];ll=math.hypot(dx,dy)
 if ll<.01:raise RuntimeError('degenerate park road')
 nx=-dy/ll*width*.5;ny=dx/ll*width*.5
 pts=[(a[0]+nx,a[1]+ny),(b[0]+nx,b[1]+ny),
      (b[0]-nx,b[1]-ny),(a[0]-nx,a[1]-ny)]
 vertices=[[x,y,t] for t in (112.06,112.18)for x,y in pts]
 emit('path',vertices,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
def route(name,points,width):
 if any(r['id']==name for r in plan['routes']):raise RuntimeError('Duplicate route ID')
 for a,b in zip(points,points[1:]):pathSegment(a,b,width)
 out=dict(id=name,points=[[x,y,112.]for x,y in points],width=width,
  kind='park',z0=112,z1=112,grade=0,
  lengthM=round(sum(math.dist(a,b)for a,b in zip(points,points[1:])),2))
 plan['routes'].append(out);return out
def tree(x,y,height=7):
 cylinder('timber',x,y,112+height*.3,.5,height*.6,9)
 cylinder('tree',x,y,112+height*.8,2.8,height*.55,12)
 cylinder('tree',x,y,112+height*1.04,1.8,height*.33,12)
# The two western approaches were already built in the pilot. Main park
# becomes a walkable multi-destination civic district, not just a green patch.
loop=route('current_upper_garden_great_walk',
 [(200,611),(205,629),(225,630),(235,611),(235,585),
 (242,570),(230,560),(210,565),(200,580),(195,594),(200,611)],3.0)
south=route('current_upper_garden_south_gate',
 [(230,535),(230,545),(230,560)],3.4)
east=route('current_upper_garden_east_court',
 [(235,585),(247,584),(260,591),(269,600)],2.6)
bot=route('current_upper_garden_record_branch',
 [(235,611),(249,613),(263,619)],2.4)
overlook=route('current_upper_garden_eastern_prospect',
 [(242,570),(255,562),(269,562)],2.8)
# Four distinct gardens / grounds leaving clear corridors:
for x,y,w,d in [(220,587,20,15),(256,607,26,15),(259,576,21,10),
                  (214,554,20,8),(223,618,13,10),(268,625,9,7)]:
 block('turf',x,y,112.08,w,d,.13)
# Historic arboretum planted along park edge instead of blocked shortcuts:
for x,y,h in [(191,577,8),(213,576,7),(250,620,8),(263,610,7),
               (258,575,7),(211,553,7),(274,615,8),(269,552,8),
               (221,595,7),(225,608,6)]:
 tree(x,y,h)
# Distinct visual waypoint, marking the large park from distant avenue:
cylinder('stone',255,596,112.55,5.5,1.0)
cylinder('water',255,596,113.1,4.8,.12)
cylinder('stone',255,596,113.6,1.15,.9)
cylinder('bronze',255,596,114.75,.52,1.7)
# Botanical record portico with 3 columns, worktable and readable signage:
for xx in (254.7,259.3,263.9):
 cylinder('stone',xx,622,114.1,.43,3.9,10)
 block('bronze',xx,622,116.1,1.15,1.3,.26)
block('stone',259.3,624.1,112.36,11.8,4.3,.56)
block('timber',259.3,624.1,113.17,5,1.2,.54)
block('bronze',259.3,623.35,113.53,3,.18,.65)
# Eastern overlook with stone viewing deck and defensive edge to drop side:
block('stone',269,562,112.22,9.5,7.5,.38)
block('stone',273.4,562,112.90,.50,7.5,1.4)
for y in (559,565):
 block('bronze',269,y,113.55,1.2,.4,.75)
# benches in rest alcoves off the great loop
for x,y,w,d in [(222,602,3.6,.85),(268,607,3.5,.85),(219,550,3.6,.85)]:
 block('timber',x,y,112.78,w,d,.35)
for x,y in [(222,601.7),(268,606.7),(219,549.7)]:
 block('timber',x,y,113.3,3.6,.15,.75)
created=[]
for k,(v,f)in G.items():
 if not f:continue
 name='current_upper_grand_garden_'+k
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],f);mesh.update()
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
 ob=bpy.data.objects.new(name,mesh);col.objects.link(ob)
 material=bpy.data.materials.get(name)or bpy.data.materials.new(name)
 material.diffuse_color=colors[k];mesh.materials.append(material)
 plan['meshes'].append(dict(name=name,vertices=[list(a.co) for a in mesh.vertices],
 faces=[list(face.vertices)for face in mesh.polygons],material=name))
 created.append(name)
plan['audit']['routeCount']=len(plan['routes'])
meta=plan['currentNewNeighborhoodParks']
meta['parks']=[dict(name='Lower People Green',footprint=(32,25),z=14,openGates=3),
 dict(name='Upper City Grand Botanical Gardens',footprint=(105,95),z=112,openGates=3)]
meta['grandGardenNewMeshes']=created
meta['grandGardenNewRoutes']=[x['id'] for x in (loop,south,east,bot,overlook)]
meta['status']='PENDING_STREET_VISUAL_AND_QA'
meta['features']=['arbor and shade walks','central reflection court','surveyers sundial',
 'open-access records portico','stone eastern prospect terrace','three separated public approaches']
plan['currentNewNeighborhoodParks']=meta
(root/'grand-garden-plan.staged.json').write_text(json.dumps(plan,separators=(',',':')),encoding='utf8')
(root/'grand-garden-design.staged.json').write_text(json.dumps(meta,indent=2),encoding='utf8')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(pending))
print('GRAND_GARDEN_PENDING',pending.stat().st_size,len(created),meta['grandGardenNewRoutes'])
