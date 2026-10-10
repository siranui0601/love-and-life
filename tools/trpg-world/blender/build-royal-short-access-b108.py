"""Blender B108 integrate short civic→upper-court royal access,
continuous stair mesh, landings, hoist study and localized wall portal.
"""
import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
dst=out/'capital-parcel-review.blend'
if dst.exists():raise RuntimeError('Refuse overwrite')
p=json.loads((out/'plan.json').read_text())
r=p['shortRoyalAccessB108']
coll=bpy.data.collections.new('B108 short royal terrace access WIP')
bpy.context.scene.collection.children.link(coll)
# Remove carved faces from B107 retaining and parapet mesh, other walls remain.
for name in r['changedWallNames']:
 entry=next(q for q in p['meshes']if q['name']==name)
 ob=bpy.data.objects.get(name)
 if not ob:raise RuntimeError('B107 wall missing '+name)
 material=ob.data.materials[0]if ob.data.materials else None
 me=bpy.data.meshes.new(name+' B108 carved')
 me.from_pydata(entry['vertices'],[],entry['faces']);me.update()
 ob.data=me
 if material:me.materials.append(material)
for name in r['newMeshNames']:
 entry=next(q for q in p['meshes']if q['name']==name)
 me=bpy.data.meshes.new(name)
 me.from_pydata(entry['vertices'],[],entry['faces']);me.update()
 if me.polygons:
  bm=bmesh.new();bm.from_mesh(me)
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
  bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(name,me);coll.objects.link(ob)
 mat=bpy.data.materials.get(entry['material'])
 if mat:me.materials.append(mat)
s=bpy.context.scene
s.render.resolution_x=1320;s.render.resolution_y=850;s.render.resolution_percentage=100
for name,pos,look,scale in [
 ('Royal-short-access-overview',(900,300,275),(617,641,85),430),
 ('Royal-stairs-bottom-eye',(655,690,46),(603,632,76),None),
 ('Royal-stairs-top-eye',(560,595,117),(631,646,76),None),
 ('Royal-stairs-side-section',(835,640,200),(609,640,75),330),
 ('Royal-access-context',(1200,100,480),(560,660,130),1250)]:
 cam=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,cam)
 s.collection.objects.link(ob);ob.location=pos
 ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler()
 cam.clip_end=20000;cam.clip_start=.1;cam.lens=28
 if scale:cam.type='ORTHO';cam.ortho_scale=scale
 s.camera=ob;s.render.filepath=str(out/(name+'.png'))
 bpy.ops.render.render(write_still=True);ob.hide_set(True)
s.camera=bpy.data.objects.get('B106 castle review')
s['status']='B108 short stairs 206m + hoist visual study; old 1170m civic ramp retained pending actual travel tests'
bpy.ops.wm.save_as_mainfile(filepath=str(dst))
print('B108_SAVED',dst.stat().st_size)
