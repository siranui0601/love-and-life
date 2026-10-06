"""Add optional parcel/massing layers to an existing terrain review .blend.
Preserves original file; massing is hidden by default until explicitly reviewed.
"""
import bpy,json,pathlib,sys,math
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
source=pathlib.Path(sys.argv[sys.argv.index('--')+1]);out=source.parent;data=json.loads(source.read_text())
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('Existing version protected')
scene=bpy.context.scene
parcel_collection=bpy.data.collections.new('Parcel footprints');scene.collection.children.link(parcel_collection)
mass_collection=bpy.data.collections.new('Optional parcel massing - UNACCEPTED');scene.collection.children.link(mass_collection)
def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);return m
stone=material('District walls',(.63,.58,.47));roof=material('Clay roofs',(.39,.19,.12));foot=material('Parcel outline',(.46,.53,.42))
def build(name,verts,faces,collection,mat):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(name,me);collection.objects.link(ob);me.materials.append(mat);return ob
walls_v=[];walls_f=[];roofs_v=[];roofs_f=[];parcel_v=[];parcel_f=[]
district_meshes={};detail_v=[];detail_f=[];trim_v=[];trim_f=[]
window_mat=material('Recessed window openings',(.12,.15,.15));trim_mat=material('Noble carved cornice',(.89,.85,.74))
render_parcels=[dict(p,footprint=f)for p in data['parcels']for f in p.get('footprints',[p['footprint']])]
for p in render_parcels:
 district=p['district'];buffers=district_meshes.setdefault(district,[[],[],[],[]]);walls_v,walls_f,roofs_v,roofs_f=buffers
 xy=p['footprint']['coordinates'][0][:-1];base=p['groundM'];height=p['heightM'];n=len(xy)
 # Explicit parcel footprints provide a building-free review of actual lots.
 loop=[Vector((x,y,base+.21))for x,y in p['geometry']['coordinates'][0][:-1]]
 for tri in tessellate_polygon([loop]):
  i=len(parcel_v);parcel_v.extend([list(loop[v] if isinstance(v,int) else v)for v in tri]);parcel_f.append([i,i+1,i+2])
 for a,b in zip(xy,xy[1:]+xy[:1]):
  i=len(walls_v);walls_v.extend([[*a,base],[*b,base],[*b,base+height],[*a,base+height]]);walls_f.append([i,i+1,i+2,i+3])
 # Facade rhythm follows each building wall, with richer noble cornices.
 for a,b in zip(xy,xy[1:]+xy[:1]):
  dx=b[0]-a[0];dy=b[1]-a[1];length=math.hypot(dx,dy)
  if length<3:continue
  ux,uy=dx/length,dy/length;nx,ny=-uy*.025,ux*.025
  window_width=1.6 if district=='noble_west'else .8;window_height=2.2 if district=='noble_west'else 1.15
  spacing=4.5 if district=='noble_west'else 3.4;floors=max(1,int(height/(4.2 if district=='noble_west'else 3.2)))
  for floor in range(floors):
   z=base+1.2+floor*height/floors
   for k in range(1,max(2,int(length/spacing))):
    t=length*k/max(2,int(length/spacing));cx=a[0]+ux*t;cy=a[1]+uy*t;w=window_width/2;i=len(detail_v)
    detail_v.extend([[cx-ux*w+nx,cy-uy*w+ny,z],[cx+ux*w+nx,cy+uy*w+ny,z],[cx+ux*w+nx,cy+uy*w+ny,z+window_height],[cx-ux*w+nx,cy-uy*w+ny,z+window_height]]);detail_f.append([i,i+1,i+2,i+3])
  if district=='noble_west':
   i=len(trim_v);trim_v.extend([[a[0]+nx,a[1]+ny,base+height-.9],[b[0]+nx,b[1]+ny,base+height-.9],[b[0]+nx,b[1]+ny,base+height-.35],[a[0]+nx,a[1]+ny,base+height-.35]]);trim_f.append([i,i+1,i+2,i+3])
 if n==4:
  # Gabled roof stays inside the convex four-sided footprint.
  if (Vector(xy[1])-Vector(xy[0])).length>(Vector(xy[2])-Vector(xy[1])).length:xy=xy[1:]+xy[:1]
  a=[(xy[0][k]+xy[1][k])/2 for k in range(2)];b=[(xy[2][k]+xy[3][k])/2 for k in range(2)]
  i=len(roofs_v);roofs_v.extend([[*q,base+height]for q in xy]+[[*a,base+height+2.5],[*b,base+height+2.5]])
  roofs_f.extend([[i,i+1,i+4],[i+2,i+3,i+5],[i+1,i+2,i+5,i+4],[i+3,i,i+4,i+5]])
 else:
  loop=[Vector((x,y,base+height))for x,y in xy]
  for tri in tessellate_polygon([loop]):
   i=len(roofs_v);roofs_v.extend([list(loop[v] if isinstance(v,int) else v)for v in tri]);roofs_f.append([i,i+1,i+2])
build('Parcels - street frontage first',parcel_v,parcel_f,parcel_collection,foot)
palette={'noble_west':((.81,.76,.63),(.17,.25,.34)),'lower':((.43,.39,.32),(.29,.22,.16)),'market':((.72,.61,.44),(.45,.21,.13)),'quay':((.49,.48,.41),(.29,.30,.29)),'ajin':((.61,.53,.42),(.40,.25,.17)),'civic_foot':((.71,.70,.62),(.24,.29,.32))}
for district,(wv,wf,rv,rf)in district_meshes.items():
 wall_color,roof_color=palette.get(district,((.65,.63,.55),(.29,.32,.35)))
 build(district+' building walls',wv,wf,mass_collection,material(district+' masonry',wall_color))
 build(district+' roofs',rv,rf,mass_collection,material(district+' roof material',roof_color))
build('District facade openings',detail_v,detail_f,mass_collection,window_mat)
build('Noble cornices',trim_v,trim_f,mass_collection,trim_mat)
# Gardens and an open gate-to-house walk stay inside each noble parcel.
garden_mat=material('Noble garden grass',(.27,.38,.22));path_mat=material('Noble garden paving',(.65,.61,.49))
gv=[];gf=[];pv=[];pf=[];fv=[];ff=[]
for p in data['parcels']:
 if p['district']!='noble_west':continue
 a,b=p['frontagePoints'];length=math.dist(a,b);ux=(b[0]-a[0])/length;uy=(b[1]-a[1])/length;nx=-uy;ny=ux;z=p['groundM']
 def pt(t,d,h=0):return [a[0]+ux*t+nx*d,a[1]+uy*t+ny*d,z+h]
 # Garden triangulation includes inner rings, so grass cannot cover house floors.
 geometry=p['garden'];polygons=[geometry['coordinates']]if geometry['type']=='Polygon'else geometry['coordinates']
 for rings in polygons:
  loops=[[Vector((x,y,z+.10))for x,y in ring[:-1]]for ring in rings]
  flat=[v for loop in loops for v in loop]
  for tri in tessellate_polygon(loops):
   i=len(gv);gv.extend([list(flat[v]if isinstance(v,int)else v)for v in tri]);gf.append([i,i+1,i+2])
 # Only emit path and front fence on retained frontage, avoiding clipped corner lots.
 ring=p['geometry']['coordinates'][0];area=abs(sum(a[0]*b[1]-b[0]*a[1]for a,b in zip(ring,ring[1:])))/2
 if area>=p['frontageM']*p['depthM']*.98:
  # Front gate remains four metres wide; paths are reviewed separately below.
  for lo,hi in [(1,length/2-2),(length/2+2,length-1)]:
   if hi<=lo:continue
   i=len(fv);fv.extend([pt(lo,.7),pt(hi,.7),pt(hi,.7,1.7),pt(lo,.7,1.7)]);ff.append([i,i+1,i+2,i+3])
build('Noble private gardens',gv,gf,mass_collection,garden_mat)
build('Noble frontage walls with open gates',fv,ff,mass_collection,trim_mat)
# Two canonical landmark volume studies, reserved before ordinary parcels.
# Proposal coordinates remain distinct from the old canonical survey anchors.
blue=material('Landmark blue slate',(.13,.22,.31))
def move_to_mass(ob):
 for c in list(ob.users_collection):c.objects.unlink(ob)
 mass_collection.objects.link(ob)
def box(name,loc,scale,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);ob=bpy.context.object;ob.name=name;ob.scale=scale;move_to_mass(ob);ob.data.materials.append(mat);return ob
def tower(name,x,y,base,radius,height,spire):
 bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=radius,depth=height,location=(x,y,base+height/2));ob=bpy.context.object;ob.name=name;move_to_mass(ob);ob.data.materials.append(stone)
 bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=radius*1.15,radius2=0,depth=spire,location=(x,y,base+height+spire/2));ob=bpy.context.object;ob.name=name+'_roof';move_to_mass(ob);ob.data.materials.append(blue)
box('Proposed castle palace',(315,1090,220),(120,100,32),stone)['canonical_id']='LOC_CAP_CASTLE'
box('Castle central keep',(315,1090,263),(58,56,54),stone)
for x in [263,367]:
 for y in [1048,1132]:tower('Castle corner tower',x,y,204,12,56,22)
tower('Castle highest tower',315,1090,236,20,65,28)
tower('Proposed mage tower',1050,650,70,24,88,32)
bpy.data.objects['Proposed mage tower']['canonical_id']='LOC_CAP_MAGE_TOWER'
scene['parcel_status']='Review-only. No doors/collision/canonical facility reassignment acceptance.'
scene['parcel_count']=len(data['parcels']);scene.camera=bpy.data.objects['Overview']
parcel_collection.hide_render=False;mass_collection.hide_render=True
scene.render.filepath=str(out/'Parcel-overview.png');bpy.ops.render.render(write_still=True)
parcel_collection.hide_render=True;mass_collection.hide_render=False
scene.render.filepath=str(out/'Massing-overview.png');bpy.ops.render.render(write_still=True)
for camera_name in ['Market-eye','West-low-bridge','west_lower_wall_stairs-entry']:
 scene.camera=bpy.data.objects[camera_name];scene.render.filepath=str(out/('Massing-'+camera_name+'.png'));bpy.ops.render.render(write_still=True)
# Compare districts from street-side eye level and elevated close views.
for district in ['noble_west','lower','market','quay']:
 candidates=[p for p in data['parcels']if p['district']==district]
 if not candidates:continue
 p=min(candidates,key=lambda p:abs(p['frontageM']-({'noble_west':40,'lower':8,'market':11,'quay':23}[district])))
 a,b=p['frontagePoints'];cx=(a[0]+b[0])/2;cy=(a[1]+b[1])/2;length=math.dist(a,b);nx=-(b[1]-a[1])/length;ny=(b[0]-a[0])/length;z=p['groundM']
 for label,distance,height in [('eye',.8,1.7),('context',-12,70)]:
  camera_data=bpy.data.cameras.new(district+'-'+label);camera=bpy.data.objects.new(district+'-'+label,camera_data);scene.collection.objects.link(camera)
  camera.location=(cx-nx*distance,cy-ny*distance,z+height);look=Vector((cx+(b[0]-a[0])/length*25-nx*.8,cy+(b[1]-a[1])/length*25-ny*.8,z+1.7))if label=='eye'else Vector((cx+nx*14,cy+ny*14,z+6));camera.rotation_euler=(look-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.lens=24;camera_data.clip_end=10000;camera_data.clip_start=.05
  scene.camera=camera;scene.render.filepath=str(out/('District-'+district+'-'+label+'.png'));bpy.ops.render.render(write_still=True)
scene.camera=bpy.data.objects['Overview']
# Save both layers available; keep massing off so it never conceals unfinished streets.
mass_collection.hide_render=True;mass_collection.hide_viewport=True;parcel_collection.hide_render=False
bpy.ops.wm.save_as_mainfile(filepath=str(target));print('SAVED',target,'PARCELS',len(data['parcels']))
