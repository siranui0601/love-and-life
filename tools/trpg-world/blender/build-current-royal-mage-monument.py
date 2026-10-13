"""Substantive stage 1: Royal Mage Corps observatory/research institute.
Add major royal architectural massing, rather than a token cloister. 
Do NOT change canonical parcels or overwrite the tested current until QA.
"""
import bpy,bmesh,json,pathlib,math
from mathutils import Vector
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'))
stage=root/'court-mage-monumental-campus-v2.pending.blend'
if stage.exists():raise RuntimeError('Candidate exists; refusing overwrite')
assert bpy.data.objects.get('Proposed mage tower') is not None
assert len(p['routes'])>=1200
palette={'ashlar':(.76,.73,.66,1),'rib':(.56,.55,.53,1),
 'blue_slate':(.12,.21,.36,1),'glass':(.10,.32,.44,1),
 'brass':(.70,.48,.19,1),'porphyry':(.38,.17,.21,1),
 'interior':(.39,.32,.25,1),'floor':(.49,.51,.50,1)}
matgeo={k:([],[])for k in palette}
co=bpy.data.collections.new('Current Royal Mage Corps and Arcane Research Institute')
bpy.context.scene.collection.children.link(co)
cubeFaces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
def emit(k,verts,faces):
 vs,fs=matgeo[k];o=len(vs);vs.extend([list(v)for v in verts]);fs.extend([[o+idx for idx in f]for f in faces])
def block(k,x,y,z,w,l,h):
 pts=[(x-w/2,y-l/2),(x+w/2,y-l/2),(x+w/2,y+l/2),(x-w/2,y+l/2)]
 emit(k,[[a,b,c]for c in (z-h/2,z+h/2)for a,b in pts],cubeFaces)
def cyl(k,x,y,z,r,h,sides=12,r2=None):
 if r2 is None:r2=r
 v=[]
 for rr,zp in ((r,z-h/2),(r2,z+h/2)):
  v += [[x+rr*math.cos(2*math.pi*i/sides),y+rr*math.sin(2*math.pi*i/sides),zp]for i in range(sides)]
 f=[list(range(sides-1,-1,-1)),list(range(sides,2*sides))]
 f += [[i,(i+1)%sides,(i+1)%sides+sides,i+sides]for i in range(sides)]
 emit(k,v,f)
def gable(k,x,y,w,l,z,rise,axis='x'):
 # axis x means ridge parallel to world X
 a=x-w/2;b=x+w/2;c=y-l/2;d=y+l/2
 if axis=='x':
  emit(k,[[a,c,z],[b,c,z],[b,d,z],[a,d,z],[a,y,z+rise],[b,y,z+rise]],
   [[0,1,5,4],[4,5,2,3],[0,4,3],[1,2,5]])
 else:
  emit(k,[[a,c,z],[b,c,z],[b,d,z],[a,d,z],[x,c,z+rise],[x,d,z+rise]],
   [[0,4,5,3],[4,1,2,5],[0,1,4],[3,5,2]])
def roadpad(a,b,width=3):
 dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
 if L<.1:return
 nx=-dy/L*width/2;ny=dx/L*width/2
 xy=[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],
     [b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]]
 emit('floor',[[q[0],q[1],z]for z in(70.10,70.19)for q in xy],cubeFaces)
def route(name,pts,width):
 if any(q['id']==name for q in p['routes']):raise RuntimeError('Duplicate route '+name)
 for a,b in zip(pts,pts[1:]):roadpad(a,b,width)
 p['routes'].append(dict(id=name,kind='royal_mage',width=width,z0=70,z1=70,grade=0,
 points=[[x,y,70]for x,y in pts],
 lengthM=round(sum(math.dist(a,b)for a,b in zip(pts,pts[1:])),3)))
# --- Monumental crown and load-bearing facade of ORIGINAL primary tower ---
# Facade reliefs physically touch the tower, not an abstract distant fence.
# Keep existing ground floor south entrance and east archive portal clear.
for z in (93.4,118.8,147.1):
 block('ashlar',1050,625.2,z,49.2,1.9,1.15)
 block('ashlar',1050,674.8,z,49.2,1.9,1.15)
 block('ashlar',1025.3,650,z,1.9,49.6,1.15)
 block('ashlar',1074.7,650,z,1.9,49.6,1.15)
for x in (1028,1072):
 for y in (628,672):
  # corner pilasters with clearly visible stone joints
  block('rib',x,y,118.2,3.6,3.6,79)
  for z in (94,116,139,155):
   block('ashlar',x,y,z,4.7,4.7,.7)
# Round arch reliefs at three floors; open reading of height and use:
for z in (105.5,130.8,149.4):
 for x in (1035,1045,1055,1065):
  for y,sign in ((625.4,-1),(674.6,1)):
   block('glass',x,y,z,3.6,.25,7.2)
   for dx in (-2,2):block('ashlar',x+dx,y+sign*.20,z,.35,.5,8.6)
   block('ashlar',x,y+sign*.23,z+4.3,4.25,.55,.55)
   block('brass',x,y+sign*.40,z,0.11,.10,6.7)
 for y in (637,650,663):
  for x,sign in ((1025.35,-1),(1074.65,1)):
   block('glass',x,y,z,.23,3.6,7.2)
   for dy in(-2,2):block('ashlar',x+sign*.2,y+dy,z,.50,.35,8.6)
   block('ashlar',x+sign*.2,y,z+4.3,.55,4.25,.55)
# Giant pointed flying-counterfort arches bind vertical and roof composition
for x in (1030,1070):
 for y in (631,669):
  block('rib',x,y,136,4.5,4.5,23)
  cyl('blue_slate',x,y,151.5,4.0,8,8,0)
# Stone balcony at the level of royal observation chambers:
for y in (624.25,675.75):
 block('ashlar',1050,y,141.7,39,3.1,1.1)
 for x in range(1034,1069,7):
  block('rib',x,y+(-1.1 if y<650 else 1.1),143.1,1.1,1.2,2.1)
for x in (1024.25,1075.75):
 block('ashlar',x,650,141.7,3.1,34,1.1)
 for y in range(638,668,7):
  block('rib',x+(-1.1 if x<1050 else 1.1),y,143.1,1.2,1.1,2.1)
# Projecting octagonal astronomy balconies at four high corners.
for x in (1029,1071):
 for y in (629,671):
  cyl('ashlar',x,y,153,5.0,5.0,10)
  cyl('rib',x,y,156.5,5.7,1.0,10)
  cyl('blue_slate',x,y,162.5,5.5,11,10,.6)
  cyl('brass',x,y,168.4,.3,3.0,10)
# Facade identity: a large 16-spoke gilded astrolabe at top tier south.
cyl('brass',1050,625.02,132.4,5.7,.55,16)
# Defining heraldic twelve-ray geometry set against dark stone:
for i in range(12):
 a=i*2*math.pi/12
 x=1050+4.2*math.cos(a)
 z=132.4+4.2*math.sin(a)
 block('porphyry',x,624.67,z,.65,.28,.75)
block('porphyry',1050,624.60,132.4,3.0,.35,3.0)
# --- South-east royal divination / astronomical hall: independent
# institutional 20x22m building with an actual open south entrance.
x,y,w,d=1118,620,20,22
block('floor',x,y,70.12,w,d,.24)
block('ashlar',x-w/2+.55,y,85.7,1.1,d,31.4)
block('ashlar',x+w/2-.55,y,85.7,1.1,d,31.4)
block('ashlar',x,y+d/2-.55,85.7,w,1.1,31.4)
for xx,ww in ((1112,8),(1124,8)):
 block('ashlar',xx,y-d/2+.55,85.7,ww,1.1,31.4)
block('ashlar',1118,y-d/2+.55,99,7.8,1.1,5)
gable('blue_slate',x,y,22,24,101.4,16,'y')
for yy in (614,627):
 for xx in (1108,1128):
  block('rib',xx,yy,86.4,2.7,3.1,29)
  for zz in (78,96,102):block('ashlar',xx,yy,zz,3.4,3.6,.7)
for xx in (1112,1124):
 block('glass',xx,608.6,88,3,0.25,9.5)
 block('brass',xx,608.38,88,.20,.20,9.0)
# Central world-visible observatory cupola and open astronomical colonnade
cyl('rib',1118,620,117.6,6,7.2,12)
for i in range(12):
 a=2*math.pi*i/12
 cyl('ashlar',1118+4.55*math.cos(a),620+4.55*math.sin(a),124.5,.50,6,6)
cyl('brass',1118,620,129.3,5.4,1,12)
cyl('blue_slate',1118,620,135.6,6.1,12.0,12,.20)
cyl('brass',1118,620,143,.3,2.3,12)
# interior astrolabe platform on hall ground and archival desks:
cyl('brass',1118,620,71.3,4.3,2.2,12)
cyl('porphyry',1118,620,72.42,2.9,.20,12)
for xx in (1112.4,1123.6):
 block('interior',xx,625,72.3,4.2,1.7,2.6)
# --- Ancient-text and ward research hall, east-north (25x20m).
x,y,w,d=1100,696,25,20
block('floor',x,y,70.12,w,d,.24)
for xx in (1088.1,1111.9):block('ashlar',xx,y,87.5,1.2,d,35)
# North gateway, 6.5m entrance centrally:
for xx,ww in ((1092,9),(1108,9)):
 block('ashlar',xx,705.5,87.5,ww,1.0,35)
block('ashlar',1100,705.5,101,6,1.1,8)
# South gateway for ritual courtyard at y686:
for xx,ww in ((1092.1,9.2),(1107.9,9.2)):
 block('ashlar',xx,686.5,87.5,ww,1.1,35)
block('ashlar',1100,686.5,102,6.6,1.1,6.5)
gable('blue_slate',1100,696,27.5,22.0,105.0,15.0,'x')
for xx in (1088,1112):
 for yy in (688,704):
  block('rib',xx,yy,87.5,3.0,3.0,34)
for xx in (1092,1100,1108):
 block('glass',xx,685.85,91.0,3,.22,9)
 block('brass',xx,685.60,91.0,.13,.19,8.5)
# Visible chapter archive towers, two guarded research gables:
for xx in(1091.5,1108.5):
 cyl('rib',xx,701,109.4,3.8,11,10)
 cyl('blue_slate',xx,701,119.5,4.4,9,10,.3)
 cyl('brass',xx,701,124.6,.2,2.2,10)
# Interior stacks & isolated dangerous material lecterns:
for xx in(1093,1107):
 for yy in(693,699):
  block('interior',xx,yy,73,6,1.2,6.0)
block('porphyry',1100,696,71.8,7,3.5,2.4)
# -- Rectangular open royal archive garden is ACTUAL circulation space --
# Symbolic astronomy pavement; only 0.1m raised and not a dead square.
for r in (6,9,12):
 cyl('floor',1097.4,677.0,70.24,r,.10,24)
for k in range(12):
 a=k*math.pi/6
 x=1097.4+11.1*math.cos(a)
 y=677.0+11.1*math.sin(a)
 block('brass',x,y,70.31,0.46,0.46,.06)
# Planting beds are placed outside central walk, not impeding portals.
for xx,yy in ((1084,679),(1113,674)):
 block('ashlar',xx,yy,70.55,3.1,6.0,1.1)
 block('porphyry',xx,yy,71.23,2.0,4.2,.45)
# Arcaded archive passage from tower existing gallery endpoint to courtyard
# is OPEN above pedestrians, uses rhythm of masonry piers and lintels.
for xx,yy in ((1081,655),(1085,665)): # keep route center and shoulders clear
 block('ashlar',xx,yy,74.2,1.5,1.5,8.4)
 block('rib',xx,yy,78.5,2.2,2.2,.9)
# Connect to original PUBLIC streets on two independent flanks.
entryRoutes=[
 ('royal_mage_south_divination_access',[(1131.4,602.84),(1118,609),(1118,617)],4.0),
 ('royal_mage_north_research_access',[(1103.43,716.46),(1100,708),(1100,699)],3.5),
 ('royal_mage_archive_courtyard',[(1076,651),(1080,658),(1085,670),(1097.4,677),(1100,685.5)],3.5)]
for name,pts,width in entryRoutes:route(name,pts,width)
created=[]
for k,(v,f)in matgeo.items():
 if not f:continue
 name='current_royal_mage_monument_'+k
 if bpy.data.objects.get(name):raise RuntimeError('duplicate mesh '+name)
 me=bpy.data.meshes.new(name);me.from_pydata(v,[],f);me.update()
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(name,me);co.objects.link(ob)
 mat=bpy.data.materials.get(name)or bpy.data.materials.new(name)
 mat.diffuse_color=palette[k];me.materials.append(mat)
 p['meshes'].append(dict(name=name,vertices=[list(x.co)for x in me.vertices],
 faces=[list(x.vertices)for x in me.polygons],material=name))
 created.append(name)
p['audit']['routeCount']=len(p['routes'])
meta=dict(status='PENDING_LOCAL_QA',scope='Royal Mage tower massing and 2 functional compound halls',
 tower='LOC_CAP_MAGE_TOWER',canon='Research/summoning, mage corps, ancient studies, T17 guard; NOT an academy setting',
 southHall='court divination hall (1118,620)',northHall='ancient studies records and ward lab (1100,696)',
 createdMeshBatches=created,newRouteIds=[x[0]for x in entryRoutes],
 purpose='Replace isolated unornamented tower with palace-grade multi-wing institution',
 caveats=['No player access to new tower upper galleries yet',
 'Lighting, high-detail materials, NPC interactive roles and true instanced magic effects unimplemented',
 'No source-proven school or student dormitories added',
 'Court households beyond selected free lots not yet redesigned'])
p['currentRoyalMageMonument']=meta
(root/'court-mage-monument-plan-v2.staged.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(root/'court-mage-monument-study-v2.staged.json').write_text(json.dumps(meta,indent=2),encoding='utf8')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(stage))
print('MAGE_MONUMENT_STAGED',len(created),'routes',len(p['routes']),'size',stage.stat().st_size)
