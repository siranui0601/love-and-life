"""B112 court architecture render on B111, preserving source and all roads."""
import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('B112 already exists')
p=json.loads((out/'plan.json').read_text())
study=p['arcaneRoyalB112']
for name in study['originalSmallRoofsReplaced']:
 ob=bpy.data.objects.get(name)
 if ob is None:raise RuntimeError('Expected old roof not found: '+name)
 bpy.data.objects.remove(ob,do_unlink=True)
col=bpy.data.collections.new('B112 Palace Arcane Court Architectural Identity WIP')
bpy.context.scene.collection.children.link(col)
palette={'court_ashlar':(.73,.71,.64),'court_light_stone':(.88,.83,.71),
 'court_blue_slate':(.12,.26,.42),'court_midnight':(.08,.13,.21),
 'court_gold':(.77,.6,.22)}
materials={}
for name,c in palette.items():
 mat=bpy.data.materials.new(name)
 mat.diffuse_color=(*c,1)
 materials[name]=mat
for name in study['newMeshes']:
 mesh=next(q for q in p['meshes']if q['name']==name)
 me=bpy.data.meshes.new(name)
 me.from_pydata(mesh['vertices'],[],mesh['faces']);me.update()
 if me.polygons:
  bm=bmesh.new();bm.from_mesh(me)
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
  bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(name,me);col.objects.link(ob)
 if mesh['material']in materials:me.materials.append(materials[mesh['material']])
s=bpy.context.scene
s.render.resolution_x=1330;s.render.resolution_y=890;s.render.resolution_percentage=100
for name,pos,look,scale in [
 ('B112-court-arcane-birdseye',(1330,275,285),(1050,655,99),510),
 ('B112-court-arcane-palace',(860,470,205),(1054,664,93),450),
 ('B112-court-arcane-eye',(1079,505,78),(1055,648,96),None),
 ('B112-court-arcane-southern-gate',(1050,470,126),(1080,650,97),260),
 ('B112-court-arcane-city-context',(1450,100,385),(950,670,101),950)]:
 cam=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,cam)
 s.collection.objects.link(ob);ob.location=pos
 ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler()
 cam.clip_start=.1;cam.clip_end=20000;cam.lens=31
 if scale:cam.type='ORTHO';cam.ortho_scale=scale
 s.camera=ob;s.render.filepath=str(out/(name+'.png'))
 bpy.ops.render.render(write_still=True);ob.hide_set(True)
s.camera=bpy.data.objects['B112-court-arcane-birdseye']
s['status']='B112 court institutional architecture proposed, official mage ID preserved, still needs interiors and route QA'
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('B112_SAVED',target.stat().st_size,len(study['newMeshes']))
