"""B110 build real replacement low-city massing (389 cleared generic houses)
plus four civic/craft sites; B107 source blend protected. CastleSite legacy
wing duplication is disabled in the temporary render parcel list.
"""
import bpy,json,pathlib,sys,bmesh
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
builder=pathlib.Path(sys.argv[sys.argv.index('--')+2])
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('B110 already generated')
p=json.loads((out/'plan.json').read_text(encoding='utf-8'))
study=p['southernCityB110']
original_parcels=json.loads((out/'parcels.json').read_text(encoding='utf-8'))
temp=json.loads(json.dumps(original_parcels))
if 'castleSite' in temp:temp['castleSite']['wings']=[]
renderpath=out/'parcel-render-input.json'
renderpath.write_text(json.dumps(temp,separators=(',',':')),encoding='utf-8')
# Destroy ONLY the previous massing preview, preserve current city terrain,
# existing ramps, canon facility structures, camera and other new structures.
for name in ['Parcel footprints','Optional parcel massing - UNACCEPTED']:
 col=bpy.data.collections.get(name)
 if col is None:raise RuntimeError('Missing parcel preview collection '+name)
 for ob in list(col.objects):bpy.data.objects.remove(ob,do_unlink=True)
 bpy.data.collections.remove(col)
source=builder.read_text(encoding='utf-8')
marker="scene['parcel_status']='Review-only."
if marker not in source:raise RuntimeError('Unrecognized renderer source: cannot safely rebuild')
sys.argv=['blender','--',str(renderpath)]
exec(compile(source.split(marker)[0],str(builder),'exec'),{})
coll=bpy.data.collections.get('Parcel footprints')
if coll:coll.hide_viewport=True;coll.hide_render=True
mass=bpy.data.collections.get('Optional parcel massing - UNACCEPTED')
if mass:mass.hide_viewport=False;mass.hide_render=False
# Preserve the roof-window cleanup made in B102 by NOT adding old castleSite wings.
colors={
 'civic_stone':(.68,.62,.48),'civic_light':(.83,.75,.55),
 'civic_wood':(.37,.24,.15),'b110_baked_clay':(.49,.22,.13),
 'b110_paving_ochre':(.72,.58,.36),'b110_paving_civic':(.64,.65,.52),
 'b110_paving_craft':(.59,.49,.40),'b110_paving_river':(.49,.56,.55),
 'b110_roof_ochre':(.54,.24,.15),'b110_roof_civic':(.26,.34,.28),
 'b110_roof_craft':(.31,.23,.24),'b110_roof_river':(.20,.31,.37)
}
mats={}
for name,c in colors.items():
 mat=bpy.data.materials.new(name)
 mat.diffuse_color=(*c,1.)
 if mat.node_tree:
  pr=mat.node_tree.nodes.get('Principled BSDF')
  if pr:pr.inputs['Base Color'].default_value=(*c,1.);pr.inputs['Roughness'].default_value=.8
 mats[name]=mat
col=bpy.data.collections.new('B110 Southern artisan and civic quarters WIP')
bpy.context.scene.collection.children.link(col)
for name in study['addedMeshes']:
 m=next(q for q in p['meshes']if q['name']==name)
 if not m['faces']:continue
 me=bpy.data.meshes.new(name);me.from_pydata(m['vertices'],[],m['faces']);me.update()
 if me.polygons:
  bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
  bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(name,me);col.objects.link(ob)
 if m['material'] in mats:me.materials.append(mats[m['material']])
 if ob.type!='MESH':raise RuntimeError('Unexpected non mesh')
s=bpy.context.scene
s.render.resolution_x=1350;s.render.resolution_y=900
s.render.resolution_percentage=100
views=[
 ('B110-southgate-arrival',(-10,-1280,360),(-90,-980,24),390),
 ('B110-west-commons',(-760,-1100,295),(-500,-920,22),320),
 ('B110-artisans-craft',(505,-1240,295),(300,-987,22),330),
 ('B110-river-workers',(815,-1040,340),(650,-740,22),365),
 ('B110-south-city-overview',(1100,-1760,1330),(-30,-790,65),1960),
 ('B110-royal-city-wide',(1400,-1750,1970),(130,80,95),2950)]
for name,location,look,scale in views:
 cam=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,cam)
 s.collection.objects.link(ob);ob.location=location
 ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler()
 cam.type='ORTHO';cam.ortho_scale=scale;cam.clip_start=.1;cam.clip_end=20000
 s.camera=ob;s.render.filepath=str(out/(name+'.png'))
 bpy.ops.render.render(write_still=True);ob.hide_set(True)
s.camera=bpy.data.objects.get('B110-south-city-overview')
s['status']='B110 prototype: four meaningful districts, 389 generic lots replotted, ground-level traversal NOT certified'
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('SAVED_B110',target.stat().st_size,'scenic_meshes',len(study['addedMeshes']))
