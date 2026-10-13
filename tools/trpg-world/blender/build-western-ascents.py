"""Apply western-ascent mesh replacement to the saved B88 blend; render actual review views."""
import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];out=pathlib.Path(args[0]);builder=pathlib.Path(args[1])
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('Existing version protected')
p=json.loads((out/'plan.json').read_text());r=p['westernAscentsStudy'];names=set(r['changedMeshes']+r['addedMeshes'])
for name in r['changedMeshes']:
    ob=bpy.data.objects.get(name)
    if not ob:raise RuntimeError('Expected baseline mesh absent: '+name)
    bpy.data.objects.remove(ob,do_unlink=True)
c=bpy.data.collections.new('Western short ascents');bpy.context.scene.collection.children.link(c)
for e in p['meshes']:
    if e['name'] not in names:continue
    me=bpy.data.meshes.new(e['name']);me.from_pydata(e['vertices'],[],e['faces']);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    ob=bpy.data.objects.new(e['name'],me);c.objects.link(ob)
    mat=bpy.data.materials.get(e['material'])
    if mat:me.materials.append(mat)
# Regenerate parcel massing only when an actual ordinary lot has changed.
if r['replacedParcelIds']:
    for name in ['Parcel footprints','Optional parcel massing - UNACCEPTED']:
        col=bpy.data.collections.get(name)
        for ob in list(col.objects):bpy.data.objects.remove(ob,do_unlink=True)
        bpy.data.collections.remove(col)
    source=builder.read_text(encoding='utf-8');marker="scene['parcel_status']='Review-only."
    if marker not in source:raise RuntimeError('Review changed parcel builder')
    sys.argv=['blender','--',str(out/'parcels.json')];exec(compile(source.split(marker)[0],str(builder),'exec'),{})
s=bpy.context.scene
bpy.data.collections['Parcel footprints'].hide_render=True;bpy.data.collections['Parcel footprints'].hide_viewport=True
bpy.data.collections['Optional parcel massing - UNACCEPTED'].hide_render=False
cameras=[('Western-context',(-1230,-300,600),(-630,400,40),1050),('Market-ascent-eye',(-492,123,15.9),(-492,151,30),None),('Market-upper-view',(-492,172,43.9),(-480,80,14),None),('Noble-ascent-eye',(-820,557,43.9),(-820,590,66),None),('Noble-upper-view',(-820,618,79.9),(-850,400,42),None),('Market-court-eye',(-488,90,15.9),(-444,106,16),None),('Market-court-context',(-365,42,110),(-445,102,14),170)]
s.render.resolution_x=1500;s.render.resolution_y=1000;s.render.resolution_percentage=100
for name,loc,look,scale in cameras:
 ca=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,ca);s.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler();ca.clip_start=.05;ca.clip_end=20000;ca.lens=28
 if scale:ca.type='ORTHO';ca.ortho_scale=scale
 s.camera=ob;s.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
s.camera=bpy.data.objects['Western-context'];s['status']='Western short steep ascents; runtime pending'
bpy.ops.wm.save_as_mainfile(filepath=str(target));print('WESTERN_ASCENTS_SAVED',target,target.stat().st_size)
