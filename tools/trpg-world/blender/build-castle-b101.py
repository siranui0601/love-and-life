"""B101 real Blender castle alternative, read B100, write B101 only."""
import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('Refuse existing B101 Blend')
p=json.loads((out/'plan.json').read_text(encoding='utf-8'))
study=p['castleReplanB101']
for name in study['removedSceneObjects']:
 ob=bpy.data.objects.get(name)
 if ob is None:raise RuntimeError('Baseline object missing '+name)
 bpy.data.objects.remove(ob,do_unlink=True)
collections=bpy.data.collections.new('B101 Royal Castle Rebuild WIP')
bpy.context.scene.collection.children.link(collections)
colors={'royal_stone':(.69,.66,.6),'royal_light_stone':(.81,.79,.69),
        'royal_roof_blue':(.17,.29,.45),'royal_shadow':(.14,.14,.2),
        'royal_court_stone':(.59,.53,.43)}
mats={}
for name,RGB in colors.items():
 mat=bpy.data.materials.new(name)
 mat.diffuse_color=(*RGB,1)
 shader=mat.node_tree.nodes.get('Principled BSDF') or mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
 shader.inputs['Base Color'].default_value=(*RGB,1)
 shader.inputs['Roughness'].default_value=.77
 surface=next((n for n in mat.node_tree.nodes if n.type=='OUTPUT_MATERIAL'),None)or mat.node_tree.nodes.new('ShaderNodeOutputMaterial')
 mat.node_tree.links.new(shader.outputs['BSDF'],surface.inputs['Surface'])
 mats[name]=mat
N=set(study['newMeshes'])
for entry in p['meshes']:
 if entry['name'] not in N:continue
 me=bpy.data.meshes.new(entry['name'])
 me.from_pydata(entry['vertices'],[],entry['faces']);me.update()
 if me.polygons:
  bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
  bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(entry['name'],me);collections.objects.link(ob)
 if entry['material']in mats:me.materials.append(mats[entry['material']])
s=bpy.context.scene
s.render.resolution_x=1320
s.render.resolution_y=850
s.render.resolution_percentage=100
for name,pos,target,scale in [
 ('Rebuilt-royal-castle',(575,650,395),(308,1090,232),535),
 ('Rebuilt-castle-front',(290,780,290),(342,1080,230),None),
 ('Rebuilt-castle-profile',(680,1000,320),(330,1110,234),470),
 ('B101-royal-city-context',(1300,20,620),(300,1030,185),1100)]:
 cam=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,cam);s.collection.objects.link(ob)
 ob.location=pos;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
 cam.clip_start=.1;cam.clip_end=20000;cam.lens=32
 if scale:cam.type='ORTHO';cam.ortho_scale=scale
 s.camera=ob;s.render.filepath=str(out/(name+'.png'))
 bpy.ops.render.render(write_still=True)
s.camera=bpy.data.objects['Rebuilt-royal-castle']
s['status']='B101 provisional castle architecture; QA and region completion required'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'capital-parcel-review.blend'))
print('B101_SAVED',str(target),target.stat().st_size)
