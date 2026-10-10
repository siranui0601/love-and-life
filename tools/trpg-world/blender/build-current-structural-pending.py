"""Build structural fixes into one temporary pending blend for 3D QA;
do not overwrite live current until a separate audit accepts.
"""
import bpy,bmesh,pathlib,json,sys
from mathutils import Vector
root=pathlib.Path(sys.argv[sys.argv.index('--')+1])
p=json.loads((root/'staged-ground-plan.json').read_text())
target=root/'capital-parcel-review.pending.blend'
if target.exists():raise RuntimeError('Pending exists; refuse replacing it')
floor=next(m for m in p['meshes'] if m['name']=='upper_city_ground')
obj=bpy.data.objects.get('upper_city_ground')
if obj is None:raise RuntimeError('Current upper city ground not found')
oldmat=list(obj.data.materials)
me=bpy.data.meshes.new('Upper-city ground repaired in-place')
me.from_pydata(floor['vertices'],[],floor['faces']);me.update()
bm=bmesh.new();bm.from_mesh(me)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
obj.data=me
for m in oldmat:me.materials.append(m)
wall=next(m for m in p['meshes']if m['name']=='current_civic_restored_exposed_cliff_support')
col=bpy.data.collections.get('Current structural gap repairs')
if col:raise RuntimeError('Already has collection')
col=bpy.data.collections.new('Current structural gap repairs')
bpy.context.scene.collection.children.link(col)
me=bpy.data.meshes.new(wall['name'])
me.from_pydata(wall['vertices'],[],wall['faces']);me.update()
bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
wobj=bpy.data.objects.new(wall['name'],me);col.objects.link(wobj)
mat=bpy.data.materials.get('stone')
if mat:me.materials.append(mat)
s=bpy.context.scene
s.render.resolution_x=1280;s.render.resolution_y=830
views=[
 ('current-structural-civic',(-1100,320,325),(-810,570,43),500),
 ('current-structural-upper',(860,650,405),(600,845,113),560),
 ('current-structural-street',(-940,550,95),(-850,670,42),None)]
for name,location,look,scale in views:
 camera=bpy.data.cameras.new(name)
 ob=bpy.data.objects.new(name,camera);s.collection.objects.link(ob)
 ob.location=location;ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler()
 camera.clip_start=.1;camera.clip_end=20000;camera.lens=28
 if scale:camera.type='ORTHO';camera.ortho_scale=scale
 s.camera=ob;s.render.filepath=str(root/(name+'.png'))
 bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(ob,do_unlink=True)
s['structural_status']='pending real-mesh QA; not accepted'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('PENDING_SAVED',target.stat().st_size,len(floor['faces']),len(wall['faces']))
