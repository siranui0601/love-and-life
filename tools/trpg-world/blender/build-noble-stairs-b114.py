"""Build B114 consolidated stone stairs, preserve all baseline meshes
except 230 east micro-decks, and 2 old overlapping west stair-top meshes.
"""
import bpy,bmesh,sys,json,pathlib
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('B114 protected')
p=json.loads((out/'plan.json').read_text(encoding='utf8'))
study=p['integratedNobleStairsB114']
missing=[]
for name in study['discardedMeshes']:
 ob=bpy.data.objects.get(name)
 if not ob:missing.append(name);continue
 bpy.data.objects.remove(ob,do_unlink=True)
if missing:raise RuntimeError('Historical objects not found '+str(missing[:10]))
coll=bpy.data.collections.new('B114 unified noble terraced stone stairs WIP')
bpy.context.scene.collection.children.link(coll)
for name in study['unifiedMeshes']:
 entry=next(m for m in p['meshes']if m['name']==name)
 me=bpy.data.meshes.new(name)
 me.from_pydata(entry['vertices'],[],entry['faces']);me.update()
 if me.polygons:
  bm=bmesh.new();bm.from_mesh(me)
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
  bm.to_mesh(me);bm.free()
 obj=bpy.data.objects.new(name,me);coll.objects.link(obj)
 mat=bpy.data.materials.get('stairs') or bpy.data.materials.get('stone')
 if mat:me.materials.append(mat)
s=bpy.context.scene
s.render.resolution_x=1250;s.render.resolution_y=830;s.render.resolution_percentage=100
for name,pos,at,scale in [
 ('B114-noble-east-overview',(-380,345,260),(-590,565,68),490),
 ('B114-noble-east-eyelevel',(-575,502,44),(-605,545,61),None),
 ('B114-noble-west-overview',(-1030,580,205),(-790,795,72),445),
 ('B114-noble-west-eyelevel',(-885,758,46),(-835,810,63),None)]:
 cam=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,cam)
 s.collection.objects.link(ob);ob.location=pos
 ob.rotation_euler=(Vector(at)-ob.location).to_track_quat('-Z','Y').to_euler()
 cam.clip_end=20000;cam.clip_start=.1;cam.lens=25
 if scale:cam.type='ORTHO';cam.ortho_scale=scale
 s.camera=ob;s.render.filepath=str(out/(name+'.png'))
 bpy.ops.render.render(write_still=True);ob.hide_set(True)
s.camera=bpy.data.objects.get('B114-noble-east-overview')
s['status']='B114 unified nobility stairs construction WIP; local support QA pending'
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('B114_SAVED',target.stat().st_size)
