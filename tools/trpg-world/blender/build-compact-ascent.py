"""Apply gallery mesh replacement to the saved B76 blend; render actual review views."""
import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];out=pathlib.Path(args[0]);builder=pathlib.Path(args[1])
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('Existing version protected')
p=json.loads((out/'plan.json').read_text());r=p['wallGalleryStudy'];names=set(r['changedMeshes']+r['addedMeshes'])
for name in r['changedMeshes']:
    ob=bpy.data.objects.get(name)
    if not ob:raise RuntimeError('Expected baseline mesh absent: '+name)
    bpy.data.objects.remove(ob,do_unlink=True)
c=bpy.data.collections.new('Wall gallery proposal');bpy.context.scene.collection.children.link(c)
for e in p['meshes']:
    if e['name'] not in names:continue
    me=bpy.data.meshes.new(e['name']);me.from_pydata(e['vertices'],[],e['faces']);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    ob=bpy.data.objects.new(e['name'],me);c.objects.link(ob)
    mat=bpy.data.materials.get(e['material'])
    if mat:me.materials.append(mat)
# Regenerate parcel massing only when an actual ordinary lot has changed.
if r['removedParcelIds']:
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
routes={q['id']:q for q in p['routes']};stair=routes['civic_wall_gallery_stairs']['points']
# Repeated visible lamps mark a maintained public circulation space. Lighting is a
# Blender study; Workbench images assess geometry and do not certify game lighting.
lamp=bpy.data.materials.new('Gallery warm lamps');lamp.diffuse_color=(1,.72,.32,1)
for i in range(0,len(stair),18):
    x,y,z=stair[i];bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=.22,location=(x-3.3,y,z+3))
    ob=bpy.context.object;ob.name='Gallery lamp '+str(i);ob.data.materials.append(lamp)
    light=bpy.data.lights.new(ob.name,'POINT');light.energy=120;light.color=(1,.78,.49);light.shadow_soft_size=.5
    lo=bpy.data.objects.new(ob.name+' light',light);c.objects.link(lo);lo.location=ob.location
low=routes['civic_wall_gallery_lower']['points'];a=Vector(low[0]);b=Vector(low[5]);u=(b-a).normalized()
rest=r['restLandings'][-1]['position'];mid=Vector(r['middlePortal']);v=Vector(routes['civic_wall_gallery_mid_exit']['points'][-5])
cameras=[('Work-court-open-front',(1320,17,15.9),(1362,25,17),None),('North-compact-context',(340,1380,245),(208,1255,135),210),('North-compact-eye',(186,1278,114),(210,1262,124),None),('Wall-gallery-context',(1000,1070,370),(620,820,82),680),('Wall-gallery-lower-gate',tuple(a-u*12+Vector((0,0,1.8))),tuple(b+Vector((0,0,1.8))),None),('Wall-gallery-stair-eye',tuple(Vector(stair[100])+Vector((0,0,1.9))),tuple(Vector(stair[120])+Vector((0,0,1.9))),None),('Wall-gallery-mid-gate',tuple(mid+(mid-v).normalized()*12+Vector((0,0,1.9))),tuple(v+Vector((0,0,1.9))),None),('Wall-gallery-loggia',(rest[0]+32,rest[1],rest[2]+1.9),(950,800,90),None)]
s.render.resolution_x=1500;s.render.resolution_y=1000;s.render.resolution_percentage=100
for name,loc,look,scale in cameras:
    ca=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,ca);s.collection.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler();ca.clip_start=.05;ca.clip_end=20000;ca.lens=28
    if scale:ca.type='ORTHO';ca.ortho_scale=scale
    s.camera=ob;s.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
s.camera=bpy.data.objects['Wall-gallery-context'];s['status']='Wall gallery proposal; no runtime acceptance'
bpy.ops.wm.save_as_mainfile(filepath=str(target));print('GALLERY_SAVED',target,target.stat().st_size)
