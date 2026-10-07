import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
source=pathlib.Path(sys.argv[sys.argv.index('--')+1]);out=source.parent
target=out/'capital-city-b01.blend'
if target.exists():raise RuntimeError('Existing version protected')
data=json.loads(source.read_text());bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene
s.unit_settings.system='METRIC';s.unit_settings.scale_length=1;s['status']=data['status'];s['core_area_km2']=data['coreAreaKm2']
colors={'garden':(.31,.41,.24),'ground':(.64,.64,.52),'stone':(.48,.46,.40),'primary':(.85,.62,.29),'lane':(.38,.45,.39),'stairs':(.75,.51,.37),'water':(.14,.42,.53)}
mats={}
for name,color in colors.items():
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);mats[name]=m
collections={}
for name in ['Terrain','Retaining','Primary','Life streets','Stairs','Water','Canonical survey anchors']:
 c=bpy.data.collections.new(name);s.collection.children.link(c);collections[name]=c
route_by_id={r['id']:r for r in data['routes']}
for entry in data['meshes']:
 kind=entry['material'];group={'garden':'Terrain','ground':'Terrain','stone':'Retaining','primary':'Primary','lane':'Life streets','stairs':'Stairs','water':'Water'}[kind]
 me=bpy.data.meshes.new(entry['name']);me.from_pydata(entry['vertices'],[],entry['faces']);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 if kind in ['garden','ground','primary','lane','stairs']:
  for face in bm.faces:
   if face.normal.z<-.1:face.normal_flip()
 bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(entry['name'],me);collections[group].objects.link(ob);me.materials.append(mats[kind])
 if entry['name'] in route_by_id:
  r=route_by_id[entry['name']];ob['route_id']=r['id'];ob['kind']=r['kind'];ob['width_m']=r['width'];ob['grade']=r['grade']
  if 'bridgeId'in r:ob['bridge_id']=r['bridgeId'];ob['flood_closed']=r.get('floodClosed',False)
# Proposal landscape props live in a distinct collection; no canonical IDs added.
land=bpy.data.collections.new('North garden landscape proposal');s.collection.children.link(land)
for i,tree in enumerate(data.get('landscapeStudy',{}).get('trees',[])):
 x,y,z=tree['position'];h=tree['heightM'];radius=tree['radiusM']
 for trunk in [True,False]:
  if trunk:bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=.4,depth=h*.65,location=(x,y,z+h*.325))
  else:bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,z+h*.68))
  ob=bpy.context.object;ob.name=('Garden trunk 'if trunk else 'Garden crown ')+str(i)
  if not trunk:ob.scale=(radius,radius,h*.4)
  for c in list(ob.users_collection):c.objects.unlink(ob)
  land.objects.link(ob);ob.data.materials.append(mats['stone'if trunk else 'garden'])
# A visible transport animation is a review prototype, never a walking edge.
for transport in data.get('verticalTransportStudy',[]):
 platform=bpy.data.objects.get('castle_hoist_platform');weight=bpy.data.objects.get('castle_hoist_counterweight')
 if platform and weight:
  for ob in list(bpy.data.objects):
   if ob.name.startswith('castle_hoist_platform_rail_'):ob.parent=platform
  travel=transport['upperZ']-transport['lowerZ'];s.render.fps=24
  for frame,offset in [(1,0),(241,0),(1777,travel),(2017,travel),(3553,0)]:
   platform.location.z=offset;platform.keyframe_insert(data_path='location',frame=frame)
   weight.location.z=-offset;weight.keyframe_insert(data_path='location',frame=frame)
  platform['runtime_control']='UNIMPLEMENTED';platform['transport_id']=transport['id']
  s.frame_end=3553;s.frame_set(1)
survey=out.parent/'survey-pass8.json'
if survey.exists():
 for f in json.loads(survey.read_text())['facilities']:
  ob=bpy.data.objects.new(f['id'],None);collections['Canonical survey anchors'].objects.link(ob);ob.location=f['position'];ob.empty_display_size=15;ob['canonical_id']=f['id'];ob['status']='old surveyed position, reassignment pending'
s.world=bpy.data.worlds.new('Review daylight');s.world.color=(.3,.3,.3)
def camera(name,loc,look,scale=None):
 ca=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,ca);s.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler();ca.clip_end=20000
 if scale:ca.type='ORTHO';ca.ortho_scale=scale
 else:ca.lens=28
 return ob
cams=[camera('Overview',(2900,-3800,2600),(100,100,70),3850),camera('Plan',(100,100,6000),(100,100,0),3500),camera('Section',(3900,600,480),(0,600,80),3150),camera('Market-eye',(0,-50,15.7),(250,1050,190))]
cams.append(camera('West-wall-stair',(-925,520,15.7),(-888,670,34)))
cams.append(camera('Court-stair',(220,1315,113.7),(250,1215,150)))
for name in ['west_lower_wall_stairs','north_court_wall_stairs']:
 r=route_by_id[name];p=r['points'][0];q=r['points'][min(20,len(r['points'])-1)]
 cams.append(camera(name+'-entry',(p[0],p[1],p[2]+1.7),(q[0],q[1],q[2]+1.7)))
if data.get('bridges'):
 b=data['bridges'][0];p=b['south'];q=b['north']
 cams.append(camera('West-low-bridge',(p[0],p[1],15.7),(q[0],q[1],14)))
 cams.append(camera('River-districts',(-1400,-1900,1000),(0,-650,14),2800))
cams.append(camera('Pilot-lower-overview',(-1300,-1800,650),(-650,-950,14),650))
pilot=next((r for r in data['routes']if r.get('reviewArea')=='lower-quarter-pilot'),None)
if pilot:
 p=pilot['points'][min(3,len(pilot['points'])-2)];q=pilot['points'][min(12,len(pilot['points'])-1)]
 cams.append(camera('Pilot-lower-eye',(p[0],p[1],p[2]+1.7),(q[0],q[1],q[2]+1.7)))
refuge=next((r for r in data['routes']if r['id']=='lower_pilot_view_lane'),None)
if refuge:
 p=refuge['points'][0];cams.append(camera('Pilot-court-reveal',(p[0],p[1],p[2]+1.7),(300,1070,296)))
s.camera=cams[0]
for screen in bpy.data.screens:
 for a in screen.areas:
  if a.type=='VIEW_3D':
   a.spaces.active.clip_end=20000;a.spaces.active.region_3d.view_distance=3900;a.spaces.active.region_3d.view_location=Vector((100,100,70));a.spaces.active.region_3d.view_rotation=s.camera.rotation_euler.to_quaternion();a.spaces.active.shading.color_type='MATERIAL'
s.render.engine='BLENDER_WORKBENCH';s.display.shading.color_type='MATERIAL';s.display.shading.light='STUDIO';s.render.resolution_x=1500;s.render.resolution_y=1100;s.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(target))
for cam in cams:s.camera=cam;s.render.filepath=str(out/(cam.name+'.png'));bpy.ops.render.render(write_still=True)
(out/'audit.json').write_text(json.dumps(data['audit'],indent=2))
print('SAVED',target,'ROUTES',len(data['routes']))
