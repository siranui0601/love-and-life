"""Build B104 from B103: castle architecture repositioned by terrain,
road and patrol-ring geometry resynced, extension supported.
"""
import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('Existing model protected')
p=json.loads((out/'plan.json').read_text())
study=p['castleTerrainB104']
for change in study['shifts']:
 n=0
 for ob in bpy.data.objects:
  if ob.name.startswith('b101_'+change['prefix']):
   ob.location.x+=change['dx'];ob.location.y+=change['dy'];n+=1
 if n!=change['meshes']:raise RuntimeError('Mesh group mismatch: '+change['prefix']+' '+str(n))
need=set(study['changedMeshNames'])
for meshname in need:
 srcmesh=next(m for m in p['meshes']if m['name']==meshname)
 ob=bpy.data.objects.get(meshname)
 if not ob:raise RuntimeError('Expected route mesh '+meshname)
 saved=ob.data.materials[0]if ob.data.materials else None
 me=bpy.data.meshes.new('B104 road '+meshname)
 me.from_pydata(srcmesh['vertices'],[],srcmesh['faces']);me.update()
 ob.data=me
 if saved:me.materials.append(saved)
coll=bpy.data.collections.new('B104 reconstructed castle terrain and masonry')
bpy.context.scene.collection.children.link(coll)
for meshname in study['addMeshNames']:
 m=next(x for x in p['meshes']if x['name']==meshname)
 if not m['vertices'] or not m['faces']:continue
 me=bpy.data.meshes.new(meshname);me.from_pydata(m['vertices'],[],m['faces']);me.update()
 if me.polygons:
  bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
  bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(meshname,me);coll.objects.link(ob)
 material=bpy.data.materials.get(m['material'])
 if material:me.materials.append(material)
s=bpy.context.scene
s.render.resolution_x=1300;s.render.resolution_y=850
for name,pos,look,scale in [
 ('B104-royal-castle-context',(590,625,415),(278,1092,235),530),
 ('B104-royal-main-axis',(300,905,295),(290,1070,238),None),
 ('B104-royal-above',(370,1150,430),(280,1075,236),420)]:
 cam=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,cam)
 s.collection.objects.link(ob);ob.location=pos
 ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler()
 cam.clip_start=.1;cam.clip_end=20000;cam.lens=30
 if scale:cam.type='ORTHO';cam.ortho_scale=scale
 s.camera=ob;s.render.filepath=str(out/(name+'.png'))
 bpy.ops.render.render(write_still=True);ob.hide_set(True)
s.camera=bpy.data.objects.get('B102-castle-clean')
s['status']='B104 circulation, castle shape and terrain tested only provisionally'
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('B104_MODEL_SAVED',target,target.stat().st_size)
