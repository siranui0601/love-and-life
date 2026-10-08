"""Apply B76 mesh delta to B75 and rebuild only parcel collections.
Uses the pinned existing parcel builder, suppressing its unrelated renders.
Blender --background B75/capital-parcel-review.blend --python THIS -- B76 BUILDER
"""
import bpy,bmesh,json,pathlib,sys,hashlib
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
out=pathlib.Path(args[0]);builder=pathlib.Path(args[1])
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('Existing version protected')
p=json.loads((out/'plan.json').read_text());report=p['eastServiceBlockStudy']
scene=bpy.context.scene
for name in ['Parcel footprints','Optional parcel massing - UNACCEPTED']:
    collection=bpy.data.collections.get(name)
    if not collection:raise RuntimeError('Expected B75 collection absent: '+name)
    for ob in list(collection.objects):bpy.data.objects.remove(ob,do_unlink=True)
    bpy.data.collections.remove(collection)
collection=bpy.data.collections.new('East service block B76 - proposal');scene.collection.children.link(collection)
for e in p['meshes'][report['oldMeshCount']:]:
    me=bpy.data.meshes.new(e['name']);me.from_pydata(e['vertices'],[],e['faces']);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if e['material']=='lane':
        for f in bm.faces:
            if f.normal.z<0:f.normal_flip()
    bm.to_mesh(me);bm.free()
    ob=bpy.data.objects.new(e['name'],me);collection.objects.link(ob)
    mat=bpy.data.materials.get(e['material'])
    if mat:me.materials.append(mat)
source=builder.read_text(encoding='utf-8')
marker="scene['parcel_status']='Review-only."
if marker not in source:raise RuntimeError('Parcel builder changed; review before use')
sys.argv=['blender','--',str(out/'parcels.json')]
exec(compile(source.split(marker)[0],str(builder),'exec'),{})
scene=bpy.context.scene
bpy.data.collections['Parcel footprints'].hide_render=True
bpy.data.collections['Parcel footprints'].hide_viewport=True
bpy.data.collections['Optional parcel massing - UNACCEPTED'].hide_render=False
scene['status']='B76 morphology proposal, not accepted; runtime unimplemented'
scene['source_plan_sha256']=report['sourcePlanSHA256']
scene.render.resolution_x=1500;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
for ca in report['cameras']:
    c=bpy.data.cameras.new(ca['name']);ob=bpy.data.objects.new(ca['name'],c);scene.collection.objects.link(ob)
    ob.location=ca['position'];ob.rotation_euler=(Vector(ca['target'])-ob.location).to_track_quat('-Z','Y').to_euler()
    c.clip_start=.05;c.clip_end=20000
    if 'scale' in ca:c.type='ORTHO';c.ortho_scale=ca['scale']
    else:c.lens=30
    scene.camera=ob;scene.render.filepath=str(out/(ca['name']+'.png'));bpy.ops.render.render(write_still=True)
scene.camera=bpy.data.objects['East-work-context']
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('B76_SAVED',str(target),target.stat().st_size)
