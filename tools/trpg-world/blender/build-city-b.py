import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
source=pathlib.Path(sys.argv[sys.argv.index('--')+1]);out=source.parent
target=out/'capital-city-b01.blend'
if target.exists():raise RuntimeError('Existing version protected')
data=json.loads(source.read_text());bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene
s.unit_settings.system='METRIC';s.unit_settings.scale_length=1;s['status']=data['status'];s['core_area_km2']=data['coreAreaKm2']
colors={'ground':(.64,.64,.52),'stone':(.48,.46,.40),'primary':(.85,.62,.29),'lane':(.38,.45,.39),'stairs':(.75,.51,.37),'water':(.14,.42,.53)}
mats={}
for name,color in colors.items():
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);mats[name]=m
collections={}
for name in ['Terrain','Retaining','Primary','Life streets','Stairs','Water','Canonical survey anchors']:
 c=bpy.data.collections.new(name);s.collection.children.link(c);collections[name]=c
route_by_id={r['id']:r for r in data['routes']}
for entry in data['meshes']:
 kind=entry['material'];group={'ground':'Terrain','stone':'Retaining','primary':'Primary','lane':'Life streets','stairs':'Stairs','water':'Water'}[kind]
 me=bpy.data.meshes.new(entry['name']);me.from_pydata(entry['vertices'],[],entry['faces']);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 if kind in ['ground','primary','lane','stairs']:
  for face in bm.faces:
   if face.normal.z<-.1:face.normal_flip()
 bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(entry['name'],me);collections[group].objects.link(ob);me.materials.append(mats[kind])
 if entry['name'] in route_by_id:
  r=route_by_id[entry['name']];ob['route_id']=r['id'];ob['kind']=r['kind'];ob['width_m']=r['width'];ob['grade']=r['grade']
  if 'bridgeId'in r:ob['bridge_id']=r['bridgeId'];ob['flood_closed']=r.get('floodClosed',False)
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
