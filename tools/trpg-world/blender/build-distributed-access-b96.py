"""B95 real Blender model builder; never overwrite an earlier .blend."""
import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
out=pathlib.Path(args[0]); builder=pathlib.Path(args[1])
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('Refuse overwrite '+str(target))
p=json.loads((out/'plan.json').read_text(encoding='utf-8'))
study=p['distributedAscentsStudy'];names=set(study['changedMeshes']+study['addedMeshes'])
for n in study['changedMeshes']:
    ob=bpy.data.objects.get(n)
    if ob is None:raise RuntimeError('Missing baseline object '+n)
    bpy.data.objects.remove(ob,do_unlink=True)
collection=bpy.data.collections.new('Distributed Noble Access B96')
bpy.context.scene.collection.children.link(collection)
for entry in p['meshes']:
    if entry['name'] not in names:continue
    me=bpy.data.meshes.new(entry['name'])
    me.from_pydata(entry['vertices'],[],entry['faces'])
    me.update()
    if len(me.polygons):
        bm=bmesh.new();bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(me);bm.free()
    obj=bpy.data.objects.new(entry['name'],me);collection.objects.link(obj)
    mat=bpy.data.materials.get(entry['material'])
    if mat:me.materials.append(mat)
if study['replacedParcelIds']:
    for n in ['Parcel footprints','Optional parcel massing - UNACCEPTED']:
        coll=bpy.data.collections.get(n)
        if coll:
            for ob in list(coll.objects):bpy.data.objects.remove(ob,do_unlink=True)
            bpy.data.collections.remove(coll)
    source=builder.read_text(encoding='utf-8')
    marker="scene['parcel_status']='Review-only."
    if marker not in source:raise RuntimeError('Unexpected parcel-builder content')
    sys.argv=['blender','--',str(out/'parcels.json')]
    exec(compile(source.split(marker)[0],str(builder),'exec'),{})
s=bpy.context.scene
if bpy.data.collections.get('Parcel footprints'):
    bpy.data.collections['Parcel footprints'].hide_render=True
    bpy.data.collections['Parcel footprints'].hide_viewport=True
if bpy.data.collections.get('Optional parcel massing - UNACCEPTED'):
    bpy.data.collections['Optional parcel massing - UNACCEPTED'].hide_render=False
cameras=[
('Noble-east-overview',(-850,175,410),(-600,540,64),780),
('Noble-east-cargo-eye',(-560,517,44),(-560,548,64),None),
('Noble-east-upper-eye',(-560,575,81),(-560,536,55),None),
('Noble-east-ped-eye',(-591,529,47),(-609,558,61),None),
('Noble-east-network',(-700,435,170),(-555,553,62),360)]
s.render.resolution_x=1280
s.render.resolution_y=850
s.render.resolution_percentage=100
for name,position,look,scale in cameras:
    cam=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,cam)
    s.collection.objects.link(ob);ob.location=position
    ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler()
    cam.clip_start=.05;cam.clip_end=20000;cam.lens=30
    if scale:cam.type='ORTHO';cam.ortho_scale=scale
    s.camera=ob;s.render.filepath=str(out/(name+'.png'))
    bpy.ops.render.render(write_still=True)
s.camera=bpy.data.objects['Noble-east-overview']
s['status']='B96 authored study, runtime and route validation pending'
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('B95_BLEND_SAVED',target,target.stat().st_size, 'CHANGED',len(study['changedMeshes']),'NEW',len(study['addedMeshes']))
