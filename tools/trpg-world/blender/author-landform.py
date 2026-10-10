"""Authored macro alternative. Not the inherited heightfield or an accepted game map.
New background scene only; never overwrites a previous model.
"""
import bpy, bmesh, math, json, pathlib, sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1]);out.mkdir(parents=True,exist_ok=True)
blend=out/'capital-landform-a01.blend'
if blend.exists():raise RuntimeError('Choose a new output directory; previous design is protected')
bpy.ops.wm.read_factory_settings(use_empty=True)
s=bpy.context.scene;s.unit_settings.system='METRIC';s.unit_settings.scale_length=1
s['design_status']='MACRO ALTERNATIVE / ROUTE AND CANONICAL PLACEMENT AUDIT PENDING'
def coll(name):
 c=bpy.data.collections.new(name);s.collection.children.link(c);return c
land=coll('01_AUTHORED_LAND_AND_RETAINING');roads=coll('02_CART_RAMPS');stairs=coll('03_WALL_STAIRS');lanes=coll('04_CONTOUR_STREETS');water=coll('05_RIVER_RESERVATION');marks=coll('06_LANDMARK_ENVELOPES');qa=coll('90_REVIEW_CAMERAS')
def mat(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);return m
stone=mat('Retaining masonry',(.48,.45,.38));soil=mat('Buildable terraces',(.67,.65,.53));roadmat=mat('Carriageway',(.79,.62,.35));stepmat=mat('Pedestrian stairs',(.77,.73,.61));lanemat=mat('Life streets',(.43,.5,.44));blue=mat('River reservation',(.15,.4,.49));castle=mat('Castle volume reservation',(.75,.75,.69))
def mesh(name,verts,faces,c,material):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();ob=bpy.data.objects.new(name,me);c.objects.link(ob);me.materials.append(material);return ob
def prism(name,poly,bottom,top,c=land):
 n=len(poly);verts=[(x,y,bottom)for x,y in poly]+[(x,y,top)for x,y in poly]
 faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)]
 ob=mesh(name,verts,faces,c,stone);ob.data.materials.append(soil);ob.data.polygons[1].material_index=1;ob['bench_height_m']=top;return ob
core=[(-1190,-187),(-1028,-835),(-501,-1280),(268,-1401),(996,-1118),(1482,-592),(1604,96),(1442,825),(996,1351),(308,1554),(-461,1432),(-987,906),(-1230,299)]
base=prism('Lower city / quay datum 14m',core,-12,14)
# Each front is authored independently. Offsets are not a concentric hill formula.
def front1(x):return -300+.00012*(x-100)**2
fronts=[
 ('Market terrace',42,[(-1080,-130),(-650,-235),(-120,-310),(450,-265),(1100,-100),(1460,60)], [ (1380,790),(950,1290),(300,1500),(-440,1380),(-950,860)]),
 ('Civic terrace',74,[(-870,150),(-500,55),(40,80),(580,140),(1250,360)],[(1200,870),(900,1240),(300,1450),(-390,1300),(-840,830)]),
 ('Upper residential terrace',108,[(-640,420),(-240,295),(270,325),(790,450),(1120,660)],[(1040,1000),(800,1240),(300,1400),(-350,1200),(-660,820)]),
 ('Noble and court terrace',144,[(-440,675),(-50,540),(400,560),(860,780)],[(840,1100),(610,1290),(230,1350),(-290,1130),(-460,900)]),
 ('Royal forecourt terrace',182,[(-170,900),(160,780),(570,810),(720,1010)],[(560,1230),(180,1280),(-130,1140)]),
 ('Castle summit',224,[(70,1070),(270,970),(490,1010),(560,1120)],[(400,1220),(150,1200)])]
platforms=[]
for name,z,front,back in fronts:platforms.append(prism(name,front+back,14,z))
def interp(front,x):
 for a,b in zip(front,front[1:]):
  if a[0]<=x<=b[0]:return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])
 raise ValueError(x)
records=[]
def ribbon(name,points,width,c,material,thickness=.3):
 verts=[]
 for i,p in enumerate(points):
  a=points[max(0,i-1)];b=points[min(len(points)-1,i+1)];dx=b[0]-a[0];dy=b[1]-a[1];d=math.hypot(dx,dy);nx=-dy/d*width/2;ny=dx/d*width/2
  verts.extend([(p[0]+nx,p[1]+ny,p[2]),(p[0]-nx,p[1]-ny,p[2])])
 ob=mesh(name,verts,[(2*i,2*i+1,2*i+3,2*i+2)for i in range(len(points)-1)],c,material)
 if thickness:mod=ob.modifiers.new('Paving thickness','SOLIDIFY');mod.thickness=thickness;mod.offset=-1
 ob['width_m']=width;records.append(dict(id=name,width=width,points=points,kind=c.name));return ob
# Ramps follow the retaining edge; the terminal crosses into the upper bench.
# Their solid bodies support the road, and boolean excavation removes overlap.
for idx,((name,z,front,back),platform) in enumerate(zip(fronts,platforms)):
 low=14 if idx==0 else fronts[idx-1][1]
 start=front[0][0]+60;end=front[-1][0]-60
 if idx%2:start,end=end,start
 # Rise over a long wall-side run; a separate stair offers shorter pedestrian travel.
 points=[]
 for j in range(33):
  t=j/32;x=start+(end-start)*t;y=interp(front,x)-34+46*max(0,(t-.8)/.2);points.append((x,y,low+(z-low)*t))
 n=len(points);verts=[]
 for j,p in enumerate(points):
  a=points[max(0,j-1)];b=points[min(n-1,j+1)];dx=b[0]-a[0];dy=b[1]-a[1];l=math.hypot(dx,dy);nx=-dy/l*8;ny=dx/l*8
  verts.extend([(p[0]+nx,p[1]+ny,low),(p[0]-nx,p[1]-ny,low),(p[0]+nx,p[1]+ny,p[2]),(p[0]-nx,p[1]-ny,p[2])])
 faces=[]
 for j in range(n-1):
  a=j*4;b=a+4;faces.extend([(a,a+1,b+1,b),(a+2,b+2,b+3,a+3),(a,b,b+2,a+2),(a+1,a+3,b+3,b+1)])
 faces.extend([(0,2,3,1),(4*n-4,4*n-3,4*n-1,4*n-2)])
 mesh('Supported ramp '+str(idx+1),verts,faces,land,stone)
 # Open the last portion of the platform above the exact ramp floor.
 cutverts=[(x,y,h+.02 if k%4>=2 else z+5)for k,(x,y,h) in enumerate(verts)]
 cutter=mesh('temporary ramp excavation',cutverts,faces,land,stone)
 mod=platform.modifiers.new('Ramp entrance excavation','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
 bpy.context.view_layer.objects.active=platform
 bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
 ribbon('Cart ramp '+str(idx+1),[(x,y,h+.12)for x,y,h in points],14,roads,roadmat)
 # Contour street stays on the plateau, avoiding the previous radial cut field.
 contour=[(x,interp(front,x)+28,z+.12)for x in [front[0][0]+45+(front[-1][0]-front[0][0]-90)*j/24 for j in range(25)]]
 ribbon('Terrace life street '+str(idx+1),contour,7 if idx<3 else 10,lanes,lanemat)
 # Pedestrian flight rises beside the wall, with landings every 12 risers.
 x0=(front[0][0]+front[-1][0])/2-130;x1=x0+230;steps=math.ceil((z-low)/.17);sp=[]
 for j in range(steps+1):
  t=j/steps;x=x0+(x1-x0)*t;y=interp(front,x)-13+31*max(0,(t-.9)/.1);sp.append((x,y,low+(z-low)*t+.15))
 ribbon('Wall stair alignment '+str(idx+1),sp,4,stairs,stepmat)
# Low-city primary routes share one level until the first actual ramp.
for name,points in [('West logistics',[(-1220,90),(-1020,50),(-720,-70),(-450,-160),(-180,-380)]),('South produce',[(0,-1380),(-80,-1100),(40,-880),(-70,-650),(-180,-380)]),('East civic',[(1580,80),(1330,-130),(950,-400),(440,-500),(-180,-380)])]:ribbon(name,[(x,y,14.15)for x,y in points],18,roads,roadmat)
# River planning reservation respects local 16m width. No canonical new facilities.
river=[(-1130,-480,10),(-780,-590,10),(-400,-550,10),(-40,-740,10),(340,-670,10),(750,-570,10),(1170,-340,10),(1460,-240,10)]
for i,(a,b) in enumerate(zip(river,river[1:])):
 dx=b[0]-a[0];dy=b[1]-a[1];d=math.hypot(dx,dy);nx=-dy/d*9;ny=dx/d*9
 cutter=prism('channel cutter',[(a[0]+nx,a[1]+ny),(a[0]-nx,a[1]-ny),(b[0]-nx,b[1]-ny),(b[0]+nx,b[1]+ny)],7,20)
 mod=base.modifiers.new('River excavation '+str(i),'BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter;bpy.context.view_layer.objects.active=base;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
ribbon('River corridor proposal',river,16,water,blue)
# Lower-town lanes are a separate manual study; no ring-road generator is reused.
for name,ps in [
 ('Lower west loop',[(-900,-540),(-930,-800),(-690,-980),(-500,-860),(-540,-620),(-900,-540)]),
 ('Lower south loop',[(-500,-860),(-450,-1120),(-180,-1250),(90,-1130),(40,-880),(-230,-840),(-500,-860)]),
 ('Lower east loop',[(40,-880),(300,-920),(570,-850),(690,-690),(470,-730),(300,-920)]),
 ('West service',[(-930,-800),(-760,-730),(-540,-620)]),
 ('Lower market alley',[(-690,-980),(-600,-830),(-760,-730)]),
 ('Southern service',[(-450,-1120),(-220,-1050),(40,-880)]),
 ('Inn court access',[(-220,-1050),(-180,-1250)]),
 ('Eastern back lane',[(300,-920),(370,-800),(470,-730)]),
 ('River stair approach',[(-540,-620),(-400,-650),(-400,-515)]),
 ('East quay link',[(690,-690),(810,-580),(1020,-450)])]:
 ribbon(name,[(x,y,14.2) for x,y in ps],4 if 'alley' in name or 'back' in name else 6,lanes,lanemat)
# Outer enceinte is real thickness. Three reserved gaps remain explicit.
for i,(a,b) in enumerate(zip(core,core[1:]+core[:1])):
 dx=b[0]-a[0];dy=b[1]-a[1];length=math.hypot(dx,dy);nx=-dy/length*4;ny=dx/length*4
 pieces=[(0,.46),(.54,1)] if i in [3,6,12] else [(0,1)]
 for j,(t,u) in enumerate(pieces):
  p=(a[0]+dx*t,a[1]+dy*t);q=(a[0]+dx*u,a[1]+dy*u)
  prism('Enceinte %d %d'%(i,j),[(p[0]+nx,p[1]+ny),(p[0]-nx,p[1]-ny),(q[0]-nx,q[1]-ny),(q[0]+nx,q[1]+ny)],14,42)

# Market's open space is a reserved footprint, not a canonical facility move.
prism('Market open-space reservation',[(-300,-190),(-100,-210),(10,-90),(-210,0)],42,42.3,marks)
prism('Castle envelope ONLY',[(160,1060),(360,1040),(440,1130),(210,1170)],224,275,marks)
# Cameras make scale/section review reproducible.
def camera(name,location,target,scale):
 data=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,data);qa.objects.link(ob);ob.location=location;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=scale;data.clip_end=20000;return ob
s.camera=camera('South oblique',(3000,-4000,2800),(100,100,70),4000)
camera('Plan',(100,100,6000),(100,100,0),3700)
camera('Terrace section',(3900,500,420),(0,500,100),3200)
s.world=bpy.data.worlds.new('Review background');s.world.color=(.3,.3,.3)
s.render.engine='BLENDER_WORKBENCH';s.display.shading.color_type='MATERIAL';s.display.shading.light='STUDIO';s.display.shading.show_shadows=True
s.render.resolution_x=1500;s.render.resolution_y=1100;s.render.resolution_percentage=100
for screen in bpy.data.screens:
 for a in screen.areas:
  if a.type=='VIEW_3D':a.spaces.active.clip_end=20000;a.spaces.active.region_3d.view_distance=4000;a.spaces.active.region_3d.view_location=Vector((100,100,70));a.spaces.active.region_3d.view_rotation=s.camera.rotation_euler.to_quaternion();a.spaces.active.shading.color_type='MATERIAL'
s['warning']='Only macro landform and connection studies. Alley coverage, bridges, gates, collision and canonical placement remain unaccepted.'
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
for name in ['South oblique','Plan','Terrace section']:
 s.camera=bpy.data.objects[name];s.render.filepath=str(out/(name.replace(' ','-')+'.png'));bpy.ops.render.render(write_still=True)
(out/'design-routes.json').write_text(json.dumps({'status':'incomplete proposal','units':'m','routes':records},indent=2))
print('AUTHORED_MACRO_SAVED',blend)
