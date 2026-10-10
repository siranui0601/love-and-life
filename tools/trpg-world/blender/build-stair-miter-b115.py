"""B115 live Blender miter integrated step lattice; B114 remains intact."""
import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('B115 exists')
p=json.loads((out/'plan.json').read_text())
s=p['nobleStairMiterB115']
for name in s['removedB114Meshes']:
 ob=bpy.data.objects.get(name)
 if ob is None:raise RuntimeError('Source B114 object missing '+name)
 bpy.data.objects.remove(ob,do_unlink=True)
col=bpy.data.collections.new('B115 mitered noble stairs WIP')
bpy.context.scene.collection.children.link(col)
for name in s['newMeshes']:
 m=next(q for q in p['meshes']if q['name']==name)
 me=bpy.data.meshes.new(name)
 me.from_pydata(m['vertices'],[],m['faces'])
 me.update()
 if me.polygons:
  bm=bmesh.new();bm.from_mesh(me)
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(name,me);col.objects.link(ob)
 mat=bpy.data.materials.get('stairs')or bpy.data.materials.get('stone')
 if mat:me.materials.append(mat)
sc=bpy.context.scene
sc.render.resolution_x=1250;sc.render.resolution_y=830
for name,pos,at,scale in [
 ('B115-east-stair-silhouette',(-385,365,265),(-590,557,66),455),
 ('B115-west-stair-silhouette',(-1040,580,224),(-806,814,70),450)]:
 cam=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,cam)
 sc.collection.objects.link(ob);ob.location=pos
 ob.rotation_euler=(Vector(at)-ob.location).to_track_quat('-Z','Y').to_euler()
 cam.type='ORTHO';cam.ortho_scale=scale;cam.clip_start=.1;cam.clip_end=20000
 sc.camera=ob;sc.render.filepath=str(out/(name+'.png'))
 bpy.ops.render.render(write_still=True);ob.hide_set(True)
sc.camera=bpy.data.objects.get('B115-east-stair-silhouette')
sc['status']='B115 mitered staircase geometry WIP, regression QA pending'
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('B115_SAVED',target.stat().st_size)
