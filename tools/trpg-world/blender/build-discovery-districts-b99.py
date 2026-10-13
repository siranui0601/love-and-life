"""Build and render B98 public discovery sites onto the real B96 Blender scene.
The B96 source file and all GUI sessions remain untouched.
"""
import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
builder=pathlib.Path(sys.argv[sys.argv.index('--')+2])
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('Output already exists')
p=json.loads((out/'plan.json').read_text(encoding='utf-8'))
study=p['discoveryDistrictsB99']
if not study['canonicalFacilitiesUnmodified']:raise RuntimeError('Canonical check failed')
names=set(study['addedMeshes']);scene=bpy.context.scene
collection=bpy.data.collections.new('B99 Discoverable civic spaces')
scene.collection.children.link(collection)
colors=dict(grass=(.18,.36,.16),foliage=(.15,.29,.16),water=(.11,.39,.49),
            cloth=(.68,.31,.12),wood=(.45,.31,.17),stone=(.64,.63,.56),
            lane=(.65,.59,.48))
mats={}
for name,color in colors.items():
    mat=bpy.data.materials.new('B98 '+name)
    mat.diffuse_color=(*color,1.0)
    # Blender 5.2 creates an empty material node graph by default.
    nodes=mat.node_tree.nodes
    shader=nodes.get('Principled BSDF') or nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Base Color'].default_value=(*color,1.0)
    shader.inputs['Roughness'].default_value=.8
    output=next((n for n in nodes if n.type=='OUTPUT_MATERIAL'),None)
    if output is None:output=nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(shader.outputs['BSDF'],output.inputs['Surface'])
    mats[name]=mat
for entry in p['meshes']:
    if entry['name'] not in names:continue
    me=bpy.data.meshes.new(entry['name'])
    me.from_pydata(entry['vertices'],[],entry['faces']);me.update()
    if len(me.polygons):
        bm=bmesh.new();bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(me);bm.free()
    obj=bpy.data.objects.new(entry['name'],me);collection.objects.link(obj)
    mat=mats.get(entry['material']) or bpy.data.materials.get(entry['material'])
    if mat:me.materials.append(mat)
# Seven original ordinary lots were removed so that gates connect to live streets.
# Regenerate ordinary parcel massing from the updated parcel inventory exactly once.
if study['removedOrdinaryParcels']:
    for n in ['Parcel footprints','Optional parcel massing - UNACCEPTED']:
        coll=bpy.data.collections.get(n)
        if not coll:raise RuntimeError('Expected parcel collection '+n)
        for ob in list(coll.objects):bpy.data.objects.remove(ob,do_unlink=True)
        bpy.data.collections.remove(coll)
    source=builder.read_text(encoding='utf-8')
    marker="scene['parcel_status']='Review-only."
    if marker not in source:raise RuntimeError('Parcel builder format changed')
    sys.argv=['blender','--',str(out/'parcels.json')]
    exec(compile(source.split(marker)[0],str(builder),'exec'),{})
if bpy.data.collections.get('Parcel footprints'):
    bpy.data.collections['Parcel footprints'].hide_render=True
    bpy.data.collections['Parcel footprints'].hide_viewport=True
if bpy.data.collections.get('Optional parcel massing - UNACCEPTED'):
    bpy.data.collections['Optional parcel massing - UNACCEPTED'].hide_render=False
# Distinct camera scales: no fake wide-angle world-scale illusion.
cameras=[
('Park-approach-urban', (1030,-150,155),(1056,22,14),240),
('Park-entry-eye',(1009,-20,16.4),(1055,24,17.2),None),
('Park-interior-eye',(1040,20,16.4),(1063,51,18),None),
('Market-approach-context',(135,-32,123),(108,135,14),218),
('Market-gate-eye',(48,145,16.4),(111,139,16.2),None),
('Burial-court-context',(570,1020,137),(650,1187,14),215),
('Burial-gate-eye',(679,1190,16.4),(642,1190,16.3),None),
('Craft-context',(1330,-145,112),(1242,-12,14),290)]
scene.render.resolution_x=1360
scene.render.resolution_y=900
scene.render.resolution_percentage=100
for name,position,look,scale in cameras:
    cam=bpy.data.cameras.new(name)
    obj=bpy.data.objects.new(name,cam)
    scene.collection.objects.link(obj)
    obj.location=position
    obj.rotation_euler=(Vector(look)-obj.location).to_track_quat('-Z','Y').to_euler()
    cam.clip_start=.05;cam.clip_end=20000;cam.lens=30
    if scale:cam.type='ORTHO';cam.ortho_scale=scale
    scene.camera=obj
    scene.render.filepath=str(out/(name+'.png'))
    bpy.ops.render.render(write_still=True)
scene.camera=bpy.data.objects['Park-approach-urban']
scene['status']='B99 experimental public-discovery districts; 3D/path audits and game runtime pending'
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('B98_BLEND_SAVED',target,target.stat().st_size,
      'objects',len(study['addedMeshes']),'deletedOrdinaryLots',len(study['removedOrdinaryParcels']))
