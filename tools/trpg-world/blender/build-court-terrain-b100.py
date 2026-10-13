"""B100 real Blender integration: terrain structure and palace-connected
mage research precinct. Only produces new-version outputs.
"""
import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
out=pathlib.Path(args[0])
builder=pathlib.Path(args[1])
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('Already exists '+str(target))
p=json.loads((out/'plan.json').read_text(encoding='utf-8'))
study=p['courtAndTerrainB100']
newnames=set(study['newMeshes'])
if not study['newMeshes']:raise RuntimeError('No meshes to build')
collection=bpy.data.collections.new('B100 court terrain reconstruction WIP')
bpy.context.scene.collection.children.link(collection)
count=0
for entry in p['meshes']:
 if entry['name'] not in newnames:continue
 verts=entry['vertices'];faces=entry['faces']
 if not verts or not faces:continue
 me=bpy.data.meshes.new(entry['name'])
 me.from_pydata(verts,[],faces)
 me.update()
 if me.polygons:
  bm=bmesh.new();bm.from_mesh(me)
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
  bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(entry['name'],me)
 collection.objects.link(ob)
 mat=bpy.data.materials.get(entry['material'])
 if mat:me.materials.append(mat)
 count+=1
# Generic building mass is one mesh per district and must be rebuilt without the
# 25 removed parcels; otherwise the apparent new halls are engulfed in homes.
for name in ['Parcel footprints','Optional parcel massing - UNACCEPTED']:
 coll=bpy.data.collections.get(name)
 if not coll:raise RuntimeError('Missing expected collection '+name)
 for ob in list(coll.objects):bpy.data.objects.remove(ob,do_unlink=True)
 bpy.data.collections.remove(coll)
source=builder.read_text(encoding='utf-8')
marker="scene['parcel_status']='Review-only."
if marker not in source:raise RuntimeError('Unknown baseline parcel generator')
sys.argv=['blender','--',str(out/'parcels.json')]
exec(compile(source.split(marker)[0],str(builder),'exec'),{})
scene=bpy.context.scene
foot=bpy.data.collections.get('Parcel footprints')
if foot:foot.hide_render=True;foot.hide_viewport=True
mass=bpy.data.collections.get('Optional parcel massing - UNACCEPTED')
if mass:mass.hide_render=False
scene.render.resolution_x=1200
scene.render.resolution_y=800
scene.render.resolution_percentage=100
for name,position,look,scale in [
 ('Mage-regional-overview',(1450,235,370),(1047,627,90),700),
 ('Mage-ground-breach',(1150,210,230),(1020,450,70),380),
 ('Mage-royal-precinct',(965,435,137),(1040,659,96),280),
 ('Mage-eye-approach',(1010,515,75),(1050,650,108),None),
 ('Castle-master-silhouette',(550,520,410),(260,1070,206),540)]:
 cam=bpy.data.cameras.new(name);obj=bpy.data.objects.new(name,cam)
 scene.collection.objects.link(obj)
 obj.location=position
 obj.rotation_euler=(Vector(look)-obj.location).to_track_quat('-Z','Y').to_euler()
 cam.clip_end=20000;cam.lens=29;cam.clip_start=.1
 if scale:cam.type='ORTHO';cam.ortho_scale=scale
 scene.camera=obj;scene.render.filepath=str(out/(name+'.png'))
 bpy.ops.render.render(write_still=True)
scene.camera=bpy.data.objects['Mage-regional-overview']
scene['status']='B100 repaired gaps and provisional royal mage precinct; all-system QA incomplete'
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('B100_MODEL_SAVED',str(target),target.stat().st_size,'objects',count)
