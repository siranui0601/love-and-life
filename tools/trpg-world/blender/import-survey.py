"""Create an editable, metre-scale survey, separate from authored design collections.
Run in a NEW background Blender session; refuses to overwrite an existing blend.
"""
import bpy, json, sys, pathlib, math
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
source,target=map(pathlib.Path,args[:2])
if target.exists(): raise RuntimeError('Output already exists; choose a new version')
data=json.loads(source.read_text(encoding='utf-8'))
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene['status']=data['status'];scene['core_area_km2']=data['coreAreaKm2']
def collection(name):
 c=bpy.data.collections.new(name);scene.collection.children.link(c);return c
survey=collection('00_EXISTING_SURVEY_NOT_APPROVED')
for name in ['10_AUTHORED_TERRACES','20_WALLS_AND_GATES','30_PRIMARY_STREETS','31_LIFE_AND_SERVICE_LANES','32_ALLEYS_STAIRS_LOOPS','40_RIVER_AND_BRIDGES','50_RESERVED_SQUARES','60_CANONICAL_ANCHORS']:
 collection(name)
def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);return m
mats={k:material(k,c) for k,c in {'terrain':(.39,.43,.35),'ceremonial':(.8,.6,.27),'primary':(.8,.7,.46),'stairs':(.76,.32,.2),'alley':(.65,.65,.59),'secondary':(.58,.67,.61),'service':(.45,.52,.6),'roof':(.5,.32,.65),'world':(.55,.46,.3),'wall':(.48,.46,.41),'river':(.15,.43,.55)}.items()}
def mesh(name,vertices,faces,mat):
 me=bpy.data.meshes.new(name);me.from_pydata(vertices,[],faces);me.update();ob=bpy.data.objects.new(name,me);survey.objects.link(ob);ob.data.materials.append(mat);return ob
def ribbon(name,points,width,mat):
 vertices=[]
 for i,p in enumerate(points):
  a=Vector(points[max(0,i-1)]);b=Vector(points[min(len(points)-1,i+1)]);d=b-a;d.z=0
  if d.length<1e-8:d=Vector((1,0,0))
  d.normalize();normal=Vector((-d.y,d.x,0))*width/2
  vertices.extend([tuple(Vector(p)+normal),tuple(Vector(p)-normal)])
 return mesh(name,vertices,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(points)-1)],mat)
mesh('Existing terrain — replace through authored terraces',data['terrain']['vertices'],data['terrain']['faces'],mats['terrain'])
for e in data['streets']:
 ob=ribbon(e['id'],e['points'],e['widthM'],mats.get(e['kind'],mats['secondary']))
 for k in ['id','from','to','kind','widthM','role','gateTag']:
  if e.get(k) is not None:ob[k]=e[k]
for w in data['walls']:
 ob=ribbon(w['id'],w['points'],w['widthM'],mats['wall']);mod=ob.modifiers.new('Wall height','SOLIDIFY');mod.thickness=w['heightM'];mod.offset=1
for r in data['rivers']:ribbon(r['id'],r['points'],r['widthM'],mats['river'])
for f in data['facilities']:
 ob=bpy.data.objects.new(f['id'],None);scene.collection.children['60_CANONICAL_ANCHORS'].objects.link(ob);ob.location=f['position'];ob.empty_display_type='PLAIN_AXES';ob.empty_display_size=20;ob['canonical_id']=f['id']
# Human-scale and kilometre-scale checks remain visible while editing.
for name,loc,scale in [('Scale_100m',(0,-1800,0),(100,2,2)),('Human_1_7m',(0,-1770,0),(0.5,0.5,1.7))]:
 bpy.ops.mesh.primitive_cube_add(size=1,location=(loc[0],loc[1],loc[2]+scale[2]/2));ob=bpy.context.object;ob.name=name;ob.dimensions=scale
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':area.spaces.active.clip_end=20000
scene.world=bpy.data.worlds.new('Survey daylight');scene.world.color=(.65,.65,.65)
target.parent.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('SAVED_SURVEY',target,'STREETS',len(data['streets']))
