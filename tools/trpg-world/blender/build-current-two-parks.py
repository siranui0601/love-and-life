"""Add two neighborhood greens on verified parcel-free, real floors. Pending only."""
import bpy,bmesh,json,math,pathlib
from mathutils import Vector
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'))
pending=root/'neighborhood-parks.pending.blend'
if pending.exists():raise RuntimeError('Staging exists')
col=bpy.data.collections.new('Current pocket parks — lower & upper quarters')
bpy.context.scene.collection.children.link(col)
palette={'stone':(.67,.65,.57,1),'walk':(.58,.56,.48,1),'grass':(.30,.46,.25,1),
 'leaf':(.17,.35,.22,1),'wood':(.40,.29,.19,1),'water':(.16,.36,.48,1)}
geo={m:([],[])for m in palette}
cubeF=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
def add(m,v,f):
 a,b=geo[m];j=len(a);a.extend([list(q)for q in v]);b.extend([[k+j for k in ff]for ff in f])
def box(m,x,y,z,w,d,h):
 xy=[(x-w/2,y-d/2),(x+w/2,y-d/2),(x+w/2,y+d/2),(x-w/2,y+d/2)]
 add(m,[[a,b,c]for c in(z-h/2,z+h/2)for a,b in xy],cubeF)
def disc(m,x,y,z,r,h):
 N=12
 v=[[x+math.cos(2*math.pi*i/N)*r,y+math.sin(2*math.pi*i/N)*r,zz]for zz in (z-h/2,z+h/2)for i in range(N)]
 f=[list(range(N-1,-1,-1)),list(range(N,2*N))]
 f.extend([[i,(i+1)%N,(i+1)%N+N,i+N]for i in range(N)])
 add(m,v,f)
def tree(x,y,z):
 disc('wood',x,y,z+2.1,.38,4.2)
 disc('leaf',x,y,z+5.6,2.2,2.2)
 disc('leaf',x,y,z+6.5,1.6,1.4)
def road(a,b,z,w):
 dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
 if L<.1:raise ValueError('Empty road')
 nx=-dy/L*w/2;ny=dx/L*w/2
 xy=[(a[0]+nx,a[1]+ny),(b[0]+nx,b[1]+ny),(b[0]-nx,b[1]-ny),(a[0]-nx,a[1]-ny)]
 add('walk',[[x,y,zz]for zz in (z+.05,z+.18)for x,y in xy],cubeF)
def passage(name,pts,z):
 for a,b in zip(pts,pts[1:]):road(a,b,z,2.2)
 p['routes'].append(dict(id=name,points=[[x,y,z]for x,y in pts],kind='park',z0=z,z1=z,
   width=2.2,lengthM=round(sum(math.dist(a,b)for a,b in zip(pts,pts[1:])),2),grade=0))
# Lower working quarter: communal well, shade, benches; keep all through-streets open.
for x,y,w,d in [(-560,-892,9,5),(-539,-895,7,8)]:
 box('grass',x,y,14.08,w,d,.13)
for x,y in [(-562,-892),(-558,-892),(-538,-896)]:tree(x,y,14)
disc('stone',-538,-900,14.7,1.5,1.3)
disc('water',-538,-900,15.41,1.1,.12)
box('wood',-542,-895,14.8,3.1,.7,.4)
passage('current_lower_green_west_north',[(-566,-900.9),(-554,-898),(-547.2,-887.5)],14)
passage('current_lower_green_west_east',[(-566,-908.7),(-550,-906),(-534,-910.2)],14)
# Upper terrace: reflective fountain & viewpoint with two real highway entrances.
for x,y,w,d in [(206,605,17,11),(206,617,18,5)]:
 box('grass',x,y,112.08,w,d,.12)
for x,y in [(190,602),(212,618)]:tree(x,y,112)
disc('stone',205,607,112.51,3.1,.9)
disc('water',205,607,113.01,2.5,.12)
disc('stone',213,603,112.8,1.1,1.6)
box('wood',210,613,112.8,3.1,.7,.4)
passage('current_upper_garden_west_gate',[(182.5,617.2),(192,614),(200,611)],112)
passage('current_upper_garden_north_gate',[(195.8,622),(198,618),(200,611)],112)
passage('current_upper_garden_overlook',[(200,611),(210,614),(214,614)],112)
new=[]
for k,(v,f)in geo.items():
 if not f:continue
 n='current_two_new_parks_'+k
 me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update()
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(n,me);col.objects.link(ob)
 mat=bpy.data.materials.get(n)or bpy.data.materials.new(n)
 mat.diffuse_color=palette[k];me.materials.append(mat)
 p['meshes'].append(dict(name=n,vertices=[list(a.co)for a in me.vertices],
 faces=[list(a.vertices)for a in me.polygons],material=n));new.append(n)
p['audit']['routeCount']=len(p['routes'])
p['currentNewNeighborhoodParks']=dict(status='PENDING_3D_QA',newParkCount=2,
 names=['Lower People Green','Upper Terrace Reflection Garden'],
 locations=[[-550,-900,14],[200,610,112]],
 newMeshes=new,newRoutes=5,entrancesLower=3,entrancesUpper=2,
 parkRoles=['water/social shade','view/rest reflection'],
 caveats=['Aesthetic acceptance, continuous NPC movement and all-city public greens remain unfinished'])
(root/'two-parks-plan.staged.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(pending))
print('PARKS_PENDING',len(new),pending.stat().st_size)
