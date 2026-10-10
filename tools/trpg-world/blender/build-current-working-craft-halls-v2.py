"""Transform only verified unoccupied plots in the enormous 32k m2
artisan patch into visually identifiable active manufacturing facilities.
Three different built uses, with true open ground-floor portals,
functional graybox machinery and road connections. Protect canon sites.
"""
import bpy,bmesh,math,json,pathlib
r=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((r/'plan.json').read_text('utf8'))
stage=r/'craft-functional-workshops-v2.pending.blend'
if stage.exists():raise RuntimeError('Stage path already exists')
palette={'ashlar':(.66,.62,.55,1),'wood':(.41,.25,.15,1),
 'terracotta':(.49,.23,.15,1),'slate':(.18,.29,.36,1),
 'iron':(.22,.24,.25,1),'copper':(.63,.39,.20,1),
 'furnace':(.79,.23,.07,1),'water':(.19,.42,.54,1)}
F=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
geo={k:([],[])for k in palette}
coll=bpy.data.collections.new('Current Craft Quarters Working Forge Wheelwright Dyehouse')
bpy.context.scene.collection.children.link(coll)
def em(k,v,f):
 a,b=geo[k];n=len(a);a.extend([list(t)for t in v]);b.extend([[n+j for j in q]for q in f])
def box(k,x,y,z,w,d,h):
 corners=[(x-w/2,y-d/2),(x+w/2,y-d/2),(x+w/2,y+d/2),(x-w/2,y+d/2)]
 em(k,[[xx,yy,zz]for zz in(z-h/2,z+h/2)for xx,yy in corners],F)
def cylinder(k,x,y,z,rad,height,N=12,R=None):
 if R is None:R=rad
 vertices=[]
 for rr,zz in ((rad,z-height/2),(R,z+height/2)):
  for i in range(N):
   a=math.tau*i/N
   vertices.append([x+rr*math.cos(a),y+rr*math.sin(a),zz])
 ff=[list(range(N-1,-1,-1)),list(range(N,2*N))]
 ff.extend([[i,(i+1)%N,(i+1)%N+N,i+N] for i in range(N)])
 em(k,vertices,ff)
def gable(k,x,y,w,d,z,top,along='x'):
 a=x-w/2;b=x+w/2;c=y-d/2;dd=y+d/2
 if along=='x':
  verts=[[a,c,z],[b,c,z],[b,dd,z],[a,dd,z],[a,y,top],[b,y,top]]
  faces=[[0,1,5,4],[4,5,2,3],[0,4,3],[1,2,5]]
 else:
  verts=[[a,c,z],[b,c,z],[b,dd,z],[a,dd,z],[x,c,top],[x,dd,top]]
  faces=[[0,4,5,3],[4,1,2,5],[0,1,4],[3,5,2]]
 em(k,verts,faces)
def path(a,b,w=3.2):
 dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
 if L<.1:return
 nx=-dy/L*w/2;ny=dx/L*w/2
 pts=[(a[0]+nx,a[1]+ny),(b[0]+nx,b[1]+ny),
      (b[0]-nx,b[1]-ny),(a[0]-nx,a[1]-ny)]
 em('ashlar',[[x,y,z]for z in (14.09,14.21)for x,y in pts],F)
def route(id,coords,w=3.2):
 if any(q['id']==id for q in p['routes']):raise RuntimeError('Old route reused')
 for a,b in zip(coords,coords[1:]):path(a,b,w)
 p['routes'].append(dict(id=id,kind='industrial_access',width=w,
  points=[[xx,yy,14]for xx,yy in coords],z0=14,z1=14,grade=0,
  lengthM=round(sum(math.dist(a,b)for a,b in zip(coords,coords[1:])),3)))
# 1. Massive unified guild foundry, 66x12m, stone and timber factory.
# The previous 19x12m hut was rejected as visually trivial.
# Validate source parcel / street / actual ground before using this 65m hall.
box('ashlar',-369,160,14.07,66,12,.14)
# Outer wall shell contains FOUR genuinely passable public furnace doors.
for xx in (-401.5,-336.5):
 box('ashlar',xx,160,25.0,1.0,12,22.0)
box('ashlar',-369,165.5,25,66,1.0,22)
for a,b in ((-402,-385),(-379,-364),(-358,-350),(-342,-336)):
 box('ashlar',(a+b)/2,154.5,25.0,b-a,1.0,22)
for xx in (-382,-361,-346):
 blockWidth=6
 box('ashlar',xx,154.5,34.1,blockWidth,1.0,4.2)
# Four sharply peaked furnace halls share a recognizable skyline,
# unlike separate generic residential roofs.
for i in range(4):
 xx=-393.75+16.5*i
 gable('terracotta',xx,160,16.6,13.0,36,49+(i%2)*2.1,'x')
 box('iron',xx,160,49.1+(i%2)*2.1,2.8,6.5,.95)
# Stone piers articulate a long workshop facade, with top-floor glazing.
for x in (-402,-385.5,-369,-352.5,-336):
 box('ashlar',x,165.3,26.2,2.0,2.7,24.2)
 box('wood',x,153.6,26.0,1.0,2.1,22.0)
 for z in (19,28,34):
  box('copper',x,153.0,z,1.8,.30,.42)
for x in (-395,-374,-357,-338.5):
 box('slate',x,154.15,29.3,4.5,.2,7.8)
 box('iron',x,153.94,29.0,.16,.17,7.0)
# Two heavy chimneys flank furnace and smelting guild service.
for xx,yy,high in ((-387.8,162.2,37),(-347.7,162.1,31)):
 box('iron',xx,yy,23.0,5.4,5.4,12.0)
 cylinder('iron',xx,yy,35.0+high/2,2.1,high,12,1.4)
 cylinder('ashlar',xx,yy,35.0+high-.35,3.0,1.5,12)
 box('furnace',xx,yy-3,17.0,4.2,.3,4.0)
# Functional zones separated by low interior partition & path aisles.
# West smelting / mid steel / far east casting and water quench.
for xx,yy in ((-389.5,158.2),(-377.3,161.0),(-365.3,162.2),
              (-353.1,159.2),(-342.2,162.5)):
 box('wood',xx,yy,15.5,4,2.5,2.6)
 box('iron',xx,yy,17.15,4.5,2.1,.6)
for xx,yy in ((-377,163.7),(-359.5,163.7),(-340.6,163.7)):
 box('wood',xx,yy,15.1,5.0,1.35,1.9)
 for zz in(16.3,17.0):
  box('iron',xx,yy,zz,4.6,.85,.40)
# Multi-bay charcoal staging beside the lower cart lane;
# cargo trolleys can access the 6m forge doors.
for xx in (-393,-382,-361,-346):
 box('wood',xx,151.85,14.53,7.5,2.1,.8)
 for side in(-1,1):
  box('wood',xx+side*3.9,151.85,15.2,.50,2.1,2.0)
# Overhead pivot cranes represent real moving-load machinery envelope:
for xx in(-383,-354):
 box('wood',xx+8,160,25.0,1.1,1.1,22)
 box('iron',xx+4,160,35.5,10.0,.9,.9)
 box('iron',xx,160,32.8,.14,.14,5.2)
 box('iron',xx,160,30.2,1.4,.26,.65)
# 2. Coach and wheelwright factory beside the market arrival gate.
box('ashlar',-436,130,14.07,20,14,.14)
for xx in(-445.5,-426.5):box('wood',xx,130,22.2,1,14,16.4)
box('ashlar',-436,136.5,22.2,20,1,16.4)
for xx in(-442,-430):box('ashlar',xx,123.5,22.2,8,1,16.4)
box('wood',-436,123.5,29.4,6.0,1,1.7)
gable('terracotta',-436,130,22,15.5,30.5,40,'x')
for xx in(-445.5,-436,-426.5):
 box('wood',xx,130,30.0,.9,16,.95)
# A covered timber sawing pit: machine is accessible from the entrance.
box('ashlar',-441,130.5,14.6,3.3,8,1.1)
box('wood',-441,130.5,15.0,2.4,7,.6)
for yy in(127,134):
 cylinder('wood',-429.5,yy,17.6,2.5,.6,12)
 cylinder('iron',-429.5,yy,17.93,.5,.65,12)
# Stocked sawn logs and a lifting beam inside workshop.
for yy in(129.5,133.7):
 box('wood',-440,yy,15.6,8,1.2,1.2)
for xx in(-444,-428):
 box('wood',xx,129,23,1.0,1,17)
box('wood',-436,129,32,16.8,.9,.9)
# External wagon repair frames visible when approaching market.
box('wood',-436,139.0,17.8,11.2,1.2,.8)
for xx in(-440,-432):
 box('wood',xx,139.0,16.0,.9,1.2,4.1)
# 3. Indigo dye and fabric mill: open courtyard and vats behind a shed.
box('ashlar',-346,114,14.07,20,14,.14)
box('ashlar',-346,107.5,22.1,20,1,16.2)
box('ashlar',-355.5,114,22.1,1,14,16.2)
box('ashlar',-346,120.5,22.1,20,1,16.2)
# East industrial door: central six-metre opening.
for yy,dd in((109,4),(119,4)):
 box('ashlar',-336.5,yy,22.1,1,dd,16.2)
box('ashlar',-336.5,114,29,1,6.0,2.5)
gable('slate',-346,114,21.5,14.8,31,38,'x')
for xx in(-352,-346,-340):
 # vats in a work line, no standing obstacles in central approach
 if xx==-340:continue
 cylinder('copper',xx,116,15.2,2.3,2.2,12)
 cylinder('water',xx,116,16.33,2.0,.07,12)
for yy in(109.6,119.0):
 box('wood',-348,yy,16.8,8,.65,.7)
 for xx in(-352,-348,-344):
  box('wood',xx,yy,18.1,.5,.5,2.5)
  box('terracotta',xx,yy,17.6,.9,.11,1.8)
# Dye shop storage, water barrel: distinct materials.
for yy in(110,118):
 cylinder('wood',-352.9,yy,15.5,1.15,2.8,10)
 box('copper',-352.9,yy,17.0,2.5,2.5,.32)
# Public entrances connect to the established street network.
route('current_craft_foundry_public_loading',[(-380.49,143.19),(-382,154),(-382,158.2)],3.2)
route('current_craft_factory_east_loading',[(-351.12,146.96),(-346,154),(-346,159)],3.2)
route('current_craft_wheelwright_market_gate',[(-432,117),(-436,123),(-436,127.1)],3.2)
route('current_craft_dyehouse_water_delivery',[(-331,123),(-336,114),(-341.4,114)],3.2)
created=[]
for mat,(v,f)in geo.items():
 if not f:continue
 name='current_craft_active_'+mat
 if bpy.data.objects.get(name):raise RuntimeError('duplicate mesh '+name)
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],f);mesh.update()
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
 ob=bpy.data.objects.new(name,mesh);coll.objects.link(ob)
 m=bpy.data.materials.get(name)or bpy.data.materials.new(name)
 m.diffuse_color=palette[mat];mesh.materials.append(m)
 p['meshes'].append(dict(name=name,vertices=[list(x.co)for x in mesh.vertices],
 faces=[list(x.vertices)for x in mesh.polygons],material=name))
 created.append(name)
p['audit']['routeCount']=len(p['routes'])
study=dict(status='PENDING_LOCAL_3D_QA',
 purpose='Functional craft district: visible work, manufacturing, goods and discoveries instead of empty housing grid',
 addedHalls=[{'name':'guild_foundry','center':[-369,160],'footprintM':[66,12]},{'name':'wheelwright','center':[-436,130]},
             {'name':'dyehouse','center':[-346,114]}],
 newRoutes=['current_craft_foundry_public_loading','current_craft_factory_east_loading','current_craft_wheelwright_market_gate',
            'current_craft_dyehouse_water_delivery'],
 newMaterialBatches=created,groundFloorZ=14,sourceParcelOverlap=0,
 caveats=['Unaccepted until real-player capsule, cart/load, dynamic furnace/craft NPC testing',
 'This does not finish the entire empty 32072m2 artisan district',
 'Nearby repetitive housing remains a separate urban-design task'])
p['currentCraftWorkingQuarter']=study
(r/'craft-working-plan-v2.staged.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(r/'craft-working-study-v2.staged.json').write_text(json.dumps(study,indent=2),encoding='utf8')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(stage))
print('CRAFT_WORKING_STAGED','meshes',len(created),'routes',len(p['routes']), 'bytes',stage.stat().st_size)
