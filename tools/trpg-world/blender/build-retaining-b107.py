"""Integrate B107 structural retaining/masonry onto B106 source."""
import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('Refuse existing output')
p=json.loads((out/'plan.json').read_text(encoding='utf-8'))
study=p['retainingClosureB107']
collection=bpy.data.collections.new('B107 terrace integrated retainers - WIP')
bpy.context.scene.collection.children.link(collection)
count=0
for meshname in study['newMeshes']:
 m=next(t for t in p['meshes']if t['name']==meshname)
 if not m['faces']:continue
 me=bpy.data.meshes.new(meshname)
 me.from_pydata(m['vertices'],[],m['faces']);me.update()
 if me.polygons:
  bm=bmesh.new();bm.from_mesh(me)
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 obj=bpy.data.objects.new(meshname,me);collection.objects.link(obj)
 mat=bpy.data.materials.get(m['material'])
 if mat:me.materials.append(mat)
 count+=1
scene=bpy.context.scene
scene.render.resolution_x=1300;scene.render.resolution_y=840
scene.render.resolution_percentage=100
for name,pos,look,scale in [
 ('Upper-retaining-scan',(790,300,480),(80,900,110),1060),
 ('Noble-west-retaining',(-1040,410,250),(-670,930,68),730),
 ('Civic-south-retaining',(700,-200,330),(-110,590,46),1250),
 ('Castle-south-retaining',(960,500,510),(350,1040,155),1220)]:
 cam=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,cam)
 scene.collection.objects.link(ob);ob.location=pos
 ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler()
 cam.clip_start=.1;cam.clip_end=20000
 cam.type='ORTHO';cam.ortho_scale=scale
 scene.camera=ob;scene.render.filepath=str(out/(name+'.png'))
 bpy.ops.render.render(write_still=True);ob.hide_set(True)
scene.camera=bpy.data.objects.get('B106 castle review')
scene['status']='B107 outer retaining continuity proposal; entrance and 3D validation pending'
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('B107_SAVED',target.stat().st_size,'MESHGROUPS',count)
