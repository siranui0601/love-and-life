import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('No overwrite')
report=json.loads((out/'castle-roof-and-access.json').read_text())
ob=bpy.data.objects.get(report['oldStructureToRemove'])
if not ob:raise RuntimeError('Old central keep not found')
bpy.data.objects.remove(ob,do_unlink=True)
for name in report['officeMeshNames']:
 ob=bpy.data.objects.get(name)
 if ob is None:raise RuntimeError('Office mesh not found '+name)
 ob.location.x+=report['officeShiftX']
p=json.loads((out/'plan.json').read_text())
coll=bpy.data.collections.new('B106 castle central spire')
bpy.context.scene.collection.children.link(coll)
for name in report['newMeshes']:
 m=next(m for m in p['meshes'] if m['name']==name)
 me=bpy.data.meshes.new(name);me.from_pydata(m['vertices'],[],m['faces']);me.update()
 if me.polygons:
  bm=bmesh.new();bm.from_mesh(me)
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(name,me);coll.objects.link(ob)
 mat=bpy.data.materials.get(m['material'])
 if mat:me.materials.append(mat)
s=bpy.context.scene
cam=bpy.data.cameras.new('B106 castle review')
o=bpy.data.objects.new('B106 castle review',cam);s.collection.objects.link(o)
o.location=(590,620,405)
o.rotation_euler=(Vector((295,1082,235))-o.location).to_track_quat('-Z','Y').to_euler()
cam.type='ORTHO';cam.ortho_scale=530;cam.clip_end=20000
s.camera=o;s.render.resolution_x=1300;s.render.resolution_y=850
s.render.filepath=str(out/'B106-castle-royal-silhouette.png')
bpy.ops.render.render(write_still=True)
o.hide_set(True)
s['status']='B106 castle clearance + coherent spire; residual safety and gameplay audits outstanding'
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('B106_SAVED',target.stat().st_size)
