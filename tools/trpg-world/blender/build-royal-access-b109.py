import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
dst=out/'capital-parcel-review.blend'
if dst.exists():raise RuntimeError('No overwrite')
p=json.loads((out/'plan.json').read_text())
st=p['reformedRoyalAccessB109']
for name in st['deletedMeshes']:
 ob=bpy.data.objects.get(name)
 if ob is None:raise RuntimeError('Original object not found '+name)
 bpy.data.objects.remove(ob,do_unlink=True)
coll=bpy.data.collections.new('B109 integrated cliffside gallery WIP')
bpy.context.scene.collection.children.link(coll)
for name in st['newMeshes']:
 m=next(x for x in p['meshes']if x['name']==name)
 me=bpy.data.meshes.new(name);me.from_pydata(m['vertices'],[],m['faces']);me.update()
 if me.polygons:
  bm=bmesh.new();bm.from_mesh(me)
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(name,me);coll.objects.link(ob)
 mat=bpy.data.materials.get(m['material'])
 if mat:me.materials.append(mat)
scene=bpy.context.scene
scene.render.resolution_x=1260;scene.render.resolution_y=820
for name,pos,look,scale in [
 ('B109-royal-gallery-overview',(900,300,285),(617,640,78),430),
 ('B109-royal-gallery-approach',(659,711,65),(609,637,82),None),
 ('B109-royal-gallery-side',(820,650,208),(600,642,79),350)]:
 cam=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,cam)
 scene.collection.objects.link(ob);ob.location=pos
 ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler()
 cam.clip_end=20000;cam.clip_start=.1;cam.lens=28
 if scale:cam.type='ORTHO';cam.ortho_scale=scale
 scene.camera=ob;scene.render.filepath=str(out/(name+'.png'))
 bpy.ops.render.render(write_still=True);ob.hide_set(True)
scene.camera=bpy.data.objects.get('B106 castle review')
scene['status']='B109 stair revamp and side-overlooks; NOT ACCEPTED until full QA'
bpy.ops.wm.save_as_mainfile(filepath=str(dst))
print('B109_SAVE',dst.stat().st_size)
