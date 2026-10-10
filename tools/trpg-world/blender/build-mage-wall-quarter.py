"""Apply mage-quarter mesh replacement to the saved B82 blend; render actual review views."""
import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];out=pathlib.Path(args[0]);builder=pathlib.Path(args[1])
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('Existing version protected')
p=json.loads((out/'plan.json').read_text());r=p['mageWallQuarterStudy'];names=set(r['changedMeshes']+r['addedMeshes'])
for name in r['changedMeshes']:
    ob=bpy.data.objects.get(name)
    if not ob:raise RuntimeError('Expected baseline mesh absent: '+name)
    bpy.data.objects.remove(ob,do_unlink=True)
c=bpy.data.collections.new('Mage wall quarter');bpy.context.scene.collection.children.link(c)
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
cameras=[('Mage-wall-context',(1530,80,360),(1050,650,45),1250),('Quarter-context',(1500,70,180),(1395,236,18),280),('Quarter-life-eye',(1370,232,15.9),(1390,252,16.5),None),('Mage-short-stair-eye',(1192,343,15.9),(1154,345,30),None),('Mage-wall-freight-eye',(1137,343,15.9),(1103,343,42),None),('Mage-mid-landing-view',(1101,343,43.9),(1395,236,18),None)]
s.render.resolution_x=1500;s.render.resolution_y=1000;s.render.resolution_percentage=100
for name,loc,look,scale in cameras:
 ca=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,ca);s.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler();ca.clip_start=.05;ca.clip_end=20000;ca.lens=28
 if scale:ca.type='ORTHO';ca.ortho_scale=scale
 s.camera=ob;s.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
s.camera=bpy.data.objects['Mage-wall-context'];s['status']='Mage wall and working quarter proposal; runtime pending'
bpy.ops.wm.save_as_mainfile(filepath=str(target));print('MAGE_QUARTER_SAVED',target,target.stat().st_size)
