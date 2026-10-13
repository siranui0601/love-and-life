"""In-place refinement of noble quarter retaining face architecture.
Adds segment-aligned ashlar belts and stone counterforts on actual 42-78m
retaining wall exterior only, avoiding both pedestrian stair corridors.
Re-running replaces its own collection, never duplicates it.
"""
import bpy,math,json,pathlib,sys,bmesh
from mathutils import Vector
cur=pathlib.Path(sys.argv[sys.argv.index('--')+1])
plan=json.loads((cur/'plan.json').read_text())
collname='Current noble retaining masonry belts and counterforts'
old=bpy.data.collections.get(collname)
if old:
 for obj in list(old.objects):bpy.data.objects.remove(obj,do_unlink=True)
 bpy.data.collections.remove(old)
col=bpy.data.collections.new(collname);bpy.context.scene.collection.children.link(col)
routes=[r for r in plan['routes']if r['id']in ('west_noble_wall_stairs','noble_east_wall_stair')]
def pdist(x,y,points):
 best=1e20
 for a,b in zip(points,points[1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];den=dx*dx+dy*dy
  t=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/max(den,.0001)))
  best=min(best,math.hypot(x-a[0]-t*dx,y-a[1]-t*dy))
 return best
def clear(x,y):
 return all(pdist(x,y,r['points'])>r['width']/2+4.5 for r in routes)
material={
 'belt':(.79,.75,.66),
 'pier':(.67,.62,.53),
 'cap':(.83,.79,.70)}
buffers={k:([],[])for k in material}
def addblock(name,center,long,thick,height,angle):
 x,y,z=center
 a=Vector((math.cos(angle),math.sin(angle),0))*long/2
 b=Vector((-math.sin(angle),math.cos(angle),0))*thick/2
 c=Vector((0,0,height/2))
 center=Vector((x,y,z))
 v=[center-a-b-c,center+a-b-c,center+a+b-c,center-a+b-c,
    center-a-b+c,center+a-b+c,center+a+b+c,center-a+b+c]
 verts,faces=buffers[name];off=len(verts)
 verts.extend([list(q)for q in v])
 faces.extend([[off+j for j in q]for q in ([0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7])])
sourceNames=['b107_noble_west_retaining_reconstruction','noble_west_retaining']
sections=[];seen=set();posts=0;belts=0
for sourceName in sourceNames:
 obj=bpy.data.objects.get(sourceName)
 if obj is None:raise RuntimeError('Retaining wall disappeared: '+sourceName)
 for f in obj.data.polygons:
  vertices=[obj.matrix_world@obj.data.vertices[i].co for i in f.vertices]
  low=min(v.z for v in vertices);high=max(v.z for v in vertices)
  if low>42.3 or high<77.8:continue
  normal=(obj.matrix_world.to_3x3()@f.normal).normalized()
  if abs(normal.z)>.1:continue
  center=sum(vertices,Vector())/len(vertices)
  # Only faces pointing OUT of upper noble plateau to the lower city,
  # not the inner city wall side where adjoining civic roads run.
  outward=Vector((center.x+450,center.y-920,0))
  if outward.length<.01 or normal.dot(outward.normalized())<.50:continue
  unique=list({(round(v.x,5),round(v.y,5))for v in vertices})
  if len(unique)!=2:continue
  pa,pb=sorted(unique)
  length=math.dist(pa,pb)
  if length<3:continue
  angle=math.atan2(pb[1]-pa[1],pb[0]-pa[0])
  N=max(1,math.ceil(length/11))
  for i in range(N):
   t=(i+.5)/N
   x=pa[0]+(pb[0]-pa[0])*t;y=pa[1]+(pb[1]-pa[1])*t
   if not (-925<x<-515 and 495<y<885):continue
   if not clear(x,y):continue
   # Group equivalent two-thickness wall faces; only one cladding pass.
   mark=(round(x/6),round(y/6))
   if mark in seen:continue
   seen.add(mark)
   # Narrow horizontal string courses every 13m on the 36m retaining wall.
   # Their brackets project away from the accessible lower paths.
   ox=x+normal.x*.45;oy=y+normal.y*.45
   piece=min(11.2,length/N+.4)
   for z in (54.2,67.3):
    addblock('belt',(ox,oy,z),piece,.85,.75,angle);belts+=1
   # Vertical flying buttresses, deliberately NOT on every 11m strip:
   # monument-like horizontal articulation with irregular thick buttresses.
   if (i+len(sections))%3==0:
    xx=x+normal.x*.63;yy=y+normal.y*.63
    addblock('pier',(xx,yy,60),2.1,1.35,36.2,angle)
    addblock('cap',(xx,yy,77.0),2.9,1.8,1.6,angle)
    posts+=1
   sections.append((sourceName,x,y))
for name,(vertices,faces) in buffers.items():
 if not vertices:continue
 mat=bpy.data.materials.get('Noble retaining '+name)or bpy.data.materials.new('Noble retaining '+name)
 mat.diffuse_color=(*material[name],1)
 me=bpy.data.meshes.new('Noble retaining '+name)
 me.from_pydata(vertices,[],faces);me.update()
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new('CurrentRetaining '+name,me);col.objects.link(ob);me.materials.append(mat)
scene=bpy.context.scene
scene.render.resolution_x=1350;scene.render.resolution_y=890
for name,at,look,scale in [
 ('current-noble-wall-west',(-1080,680,270),(-814,772,66),435),
 ('current-noble-wall-east',(-405,382,220),(-628,551,60),450)]:
 cam=bpy.data.cameras.get(name)or bpy.data.cameras.new(name)
 ob=bpy.data.objects.get(name)
 if ob is None:ob=bpy.data.objects.new(name,cam);scene.collection.objects.link(ob)
 ob.location=at;ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler()
 cam.type='ORTHO';cam.ortho_scale=scale;cam.clip_end=18000
 scene.camera=ob;scene.render.filepath=str(cur/(name+'.png'))
 bpy.ops.render.render(write_still=True)
 ob.hide_set(True)
scene.camera=bpy.data.objects.get('current-noble-wall-west')
scene['noble_counterfort_piers']=posts;scene['noble_ashlar_course_panels']=belts
scene['noble_wall_status']='Scenic subdivision WIP. Structural collision sampled; gameplay/navmesh not complete.'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(cur/'capital-parcel-review.blend'))
(cur/'retaining-design-current.json').write_text(json.dumps(dict(
 wallNames=sourceNames,regions='noble-west/east urban incline facing lower city',
 counterforts=posts,coursePieces=belts,testedCorridorBufferM=6.5,
 status='visual WIP awaiting 3D regression QA'),indent=2),encoding='utf8')
print('RETAINING_OVERWROTE',posts,'buttresses',belts,'course_segments')
