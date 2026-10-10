"""Current capital: royal private residential palace + chapel +
state hall facade language. Preserve prior meshes/routes and use
validated empty castle plots; this is a real WIP, not palace completion.
"""
import bpy,bmesh,json,pathlib,math
from mathutils import Vector
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
plan=json.loads((root/'plan.json').read_text('utf8'))
stage=root/'royal-palace-massing-v6.pending.blend'
if stage.exists():raise RuntimeError('already staged')
coll=bpy.data.collections.new('Current Royal Palace Residence Chapel and Hall Revamp')
bpy.context.scene.collection.children.link(coll)
colors={'limestone':(.78,.75,.66,1),'buttress':(.58,.57,.54,1),
 'slate':(.15,.24,.38,1),'wood':(.32,.19,.11,1),
 'glass':(.13,.36,.48,1),'gold':(.72,.54,.22,1),
 'crimson':(.46,.09,.13,1),'copper':(.31,.43,.44,1)}
B={k:([],[])for k in colors}
def emit(k,v,f):
 a,b=B[k];j=len(a);a.extend([list(t)for t in v]);b.extend([[j+z for z in face]for face in f])
def block(k,x,y,z,w,d,h):
 xy=[(x-w/2,y-d/2),(x+w/2,y-d/2),(x+w/2,y+d/2),(x-w/2,y+d/2)]
 emit(k,[[q[0],q[1],zz]for zz in (z-h/2,z+h/2)for q in xy],
 [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
def cylinder(k,x,y,z,r,h,N=12,rTop=None):
 if rTop is None:rTop=r
 V=[]
 for rr,zz in ((r,z-h/2),(rTop,z+h/2)):
  V.extend([[x+rr*math.cos(2*math.pi*i/N),y+rr*math.sin(2*math.pi*i/N),zz]for i in range(N)])
 F=[list(range(N-1,-1,-1)),list(range(N,2*N))]
 for i in range(N):F.append([i,(i+1)%N,(i+1)%N+N,i+N])
 emit(k,V,F)
def gable(k,x,y,w,d,eave,rise,along='x'):
 x0=x-w/2;x1=x+w/2;y0=y-d/2;y1=y+d/2
 if along=='x':
  V=[[x0,y0,eave],[x1,y0,eave],[x1,y1,eave],[x0,y1,eave],
     [x0,y,eave+rise],[x1,y,eave+rise]]
  faces=[[0,1,5,4],[4,5,2,3],[0,4,3],[1,2,5]]
 else:
  V=[[x0,y0,eave],[x1,y0,eave],[x1,y1,eave],[x0,y1,eave],
     [x,y0,eave+rise],[x,y1,eave+rise]]
  faces=[[0,4,5,3],[4,1,2,5],[0,1,4],[3,5,2]]
 emit(k,V,faces)
def lancet(x,y,z,w=2.6,h=6.4,normal='front'):
 if normal=='front':
  block('glass',x,y,z,w,.2,h)
  for dx in(-w/2,w/2):block('limestone',x+dx,y-.08,z,.19,.3,h+.3)
  block('limestone',x,y-.09,z-h/2+.1,w+.3,.29,.23)
  block('gold',x,y-.10,z+.7,.09,.22,h*.45)
  block('limestone',x,y-.1,z+h/2+.35,.55,.28,.65)
 else:
  block('glass',x,y,z,.2,w,h)
  for dy in(-w/2,w/2):block('limestone',x-.09,y+dy,z,.30,.17,h+.3)
  block('gold',x-.15,y,z+.7,.2,.09,h*.45)
def approach(a,b,width=3.5):
 dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
 if L<.5:return
 nx=-dy/L*width/2;ny=dx/L*width/2
 xy=[(a[0]+nx,a[1]+ny),(b[0]+nx,b[1]+ny),
     (b[0]-nx,b[1]-ny),(a[0]-nx,a[1]-ny)]
 emit('buttress',[[x,y,z]for z in (204.04,204.15)for x,y in xy],
 [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
def addroute(name,points,width=3.5):
 if any(r['id']==name for r in plan['routes']):raise RuntimeError('Duplicate route '+name)
 for a,b in zip(points,points[1:]):approach(a,b,width)
 plan['routes'].append(dict(id=name,kind='palace',points=[[x,y,204.]for x,y in points],
    width=width,z0=204,z1=204,grade=0,
    lengthM=round(sum(math.dist(a,b)for a,b in zip(points,points[1:])),3)))
# Royal private palace: a genuine internally traversable court house,
# NOT a featureless solid box occupying the north castle terrace.
block('limestone',300,1173,204.12,48,24,.24)
# Open main south portal x296-304, side service doors at y1173 on x276/324.
for x,w in ((287.1,17.8),(314,20)):
 block('limestone',x,1161.5,217.2,w,1.15,26.4)
block('limestone',300,1161.5,228.0,8.2,1.15,4.8)
block('limestone',300,1184.5,217.2,48,1.15,26.4)
for x in(277.2,323.5):
 lower=(1166.5,7)if x<300 else(1165.5,9)
 for y,d in (lower,(1180.5,9)):
  block('limestone',x,y,217.2,1.15,d,26.4)
 block('limestone',x,1173,228.2,1.15,5.3,4.4)
# The great roof is steep and layered with dormer gables.
gable('slate',300,1173,49.6,25.8,230.4,13.2,'x')
for x in (287,313):
 gable('slate',x,1159.8,10.2,8.4,231.5,7.0,'y')
# South ceremonial balcony, columns and trim:
for x in (290,310):
 cylinder('limestone',x,1157.8,213.5,.8,18,12)
 block('gold',x,1157.8,223,.95,.95,1.2)
block('buttress',300,1158,222.5,12,4,.8)
block('gold',300,1156.3,223.3,10,.35,.6)
block('crimson',300,1160.52,229.0,5.3,.13,2.1) # royal banner above, leave doorway open
# Give palace front a recognisable paired lancet rhythm:
for x in(280,285.4,290.8,309.2,314.6,320):
 lancet(x,1160.86,219.8,2.35,7.0)
for x in (277.9,292.3,307.7,322.1):
 block('buttress',x,1160.8,217.3,1.35,2.2,24.6)
 for z in (211,225,229):
  block('gold',x,1159.6,z,1.8,.42,.35)
# Secondary side doors have lintels; side face windows above street level.
for y in (1166.3,1179.3):
 lancet(276.55,y,219.6,2.5,5.5,'side')
 lancet(324.12,y,219.6,2.5,5.5,'side')
# Two octagonal sculpted roof turrets, a beacon visible from lower districts.
for tx,ty,h in ((281,1181,40),(319,1181,37)):
 cylinder('buttress',tx,ty,204+h*.5,4.25,h,10)
 for z in(221,232):
  cylinder('gold',tx,ty,z,4.65,.45,10)
 cylinder('slate',tx,ty,204+h+7,5.5,14,10,0.25)
 cylinder('copper',tx,ty,204+h+15,.25,2.4,10)
# Inside, three functional compartments and furnished court library/administration.
for x in (284,316):
 block('wood',x,1172.6,210,9.2,1.1,10)
for y in (1176.8,1181.2):
 for x in(287,311.5):
  block('wood',x,y,207,5,.95,5)
  for v in (205.6,207,208.4):block('gold',x,y-.51,v,4.0,.08,.18)
for x in(291,309):
 block('wood',x,1168.9,206.1,6,2.2,1.3) # household office desks
# Privy chapel — separate royal ritual function, not another residence.
block('limestone',195,1129,204.12,18,30,.24)
for x in(186.55,203.45):
 for y,d in ((1122,16),(1143,2)):
  if x==186.55:
   block('limestone',x,y,218,1.0,d,27.7)  # 10m west chapel portal
  else:
   block('limestone',x,1129,218,1.0,30,27.7)
   break
for y in(1114.5,1143.5):
 block('limestone',195,y,218,18,.95,27.7)
# Public west-side arch passage, separated royal south ritual portal.
# Remove wall at central west entry by rebuilding it in the portal QA.
gable('slate',195,1129,20.4,31.8,233,12.5,'y')
for y in(1119,1126,1133,1140):
 for x in(185.85,204.15):
  block('buttress',x,y,216.5,2.0,2.5,25)
for x in(188.5,201.5):
 lancet(x,1113.88,224,2.3,7.4)
for yy in(1121,1137):
 lancet(185.89,yy,222,2.2,7.6,'side')
 lancet(204.11,yy,222,2.2,7.6,'side')
# Bell lantern above far north end:
cylinder('limestone',195,1141,239,4.5,20,12)
cylinder('slate',195,1141,256.4,5.3,14,12,0.2)
cylinder('gold',195,1141,264.1,.25,2.2,12)
# Chapel interior altar / bell chancel, accessible through later
# specific portal opening, don't claim gameplay accessibility yet.
block('wood',195,1137.9,206,4.5,2.4,3.4)
block('gold',195,1136.5,208,.8,.25,2.1)
# Enhance existing Throne Hall south facade at Y~1027 without
# erecting a new wall across the processional gate.
for x in(246,265,316,334):
 block('buttress',x,1026.5,228,1.5,1.55,24)
 for zz in (216,228,238):block('gold',x,1025.55,zz,1.8,.24,.42)
for x in(254,275,305,324):
 lancet(x,1026.58,225.3,3.1,8.5)
# Royal pennants, heraldic roofline, and a stepped monumental central gable:
for x in(241,338):
 block('crimson',x,1025.1,232.2,2.5,.19,12)
 block('gold',x,1024.92,236.5,2.8,.15,1.1)
gable('slate',290,1029,22,9,240,11,'y')
# The rear of the central throne-hall was a ~104m featureless wall.
# Divide its mass into a six-bay royal facade without blocking the
# original processional route below. The lower colonnade reads from
# multiple terraces and provides architectural scale references.
for x in (248,265,282,301,318,334):
 block('buttress',x,1132.6,222.1,1.45,1.8,27.5)
 for z in (213,224,235):
  block('gold',x,1133.75,z,2.05,.38,.38)
for x in (255.5,272.5,309.5,326.5):
 block('glass',x,1132.53,226.8,4.8,.16,10.7)
 for edge in (-2.5,0,2.5):
  block('limestone',x+edge,1132.77,226.6,.18,.34,11.3)
 block('gold',x,1132.9,232.4,1.15,.27,.8)
# Royal emblem above audience hall as a real raised geometric crest.
cylinder('gold',291,1133.0,231,4.1,.65,12)
cylinder('crimson',291,1133.42,231,2.8,.26,12)
for dx in (-1.4,1.4):
 block('gold',291+dx,1133.65,231,.55,.24,3.0)
block('gold',291,1133.7,230.7,4.5,.24,.65)
# High stone parapet bands connect original roof masses visually.
block('buttress',290,1132.6,237.6,91.5,1.3,.75)
for x in range(246,337,9):
 block('limestone',x,1133.1,239.35,2.8,1.0,3.2)
# Distinct tall chimneys suggest palace kitchens and hearths, not
# anonymous residential gables; the stepped tops are roof landmarks.
for x,y in ((265,1109),(329,1090),(311,1117)):
 block('buttress',x,y,249,3.0,3.5,17.0)
 block('limestone',x,y,258,4.2,4.6,1.4)
 block('slate',x,y,259.1,4.4,4.8,.65)
# Existing bridge roads are preserved; new palace uses THREE separate
# outward-facing entrances and ritual chapel one frontage.
newRoutes=[
 ('royal_palace_west_service',[(271.08,1170.71),(276,1173.0),(283,1173.0)],2.7),
 ('royal_palace_east_service',[(334.34,1184.34),(327.5,1179),(324,1173.0),(318,1173)],2.7),
 ('royal_palace_south_procession',[(283.94,1149.22),(291.5,1156),(300,1161),(300,1172)],3.2),
 ('royal_chapel_west_approach',[(180.16,1149.07),(186,1140.4),(188,1134)],2.6)
]
for nm,pp,ww in newRoutes:addroute(nm,pp,ww)
created=[]
for k,(verts,faces)in B.items():
 if not faces:continue
 name='current_palace_royal_'+k
 if bpy.data.objects.get(name):raise RuntimeError('Mesh exists '+name)
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(name,me);coll.objects.link(ob)
 mat=bpy.data.materials.get(name)or bpy.data.materials.new(name)
 mat.diffuse_color=colors[k];me.materials.append(mat)
 plan['meshes'].append(dict(name=name,vertices=[list(q.co)for q in me.vertices],
 faces=[list(q.vertices)for q in me.polygons],material=name))
 created.append(name)
plan['audit']['routeCount']=len(plan['routes'])
meta=dict(status='PENDING_3D_VISUAL_QA',purpose='Royal palace proper: private apartments, chapel, decorated state hall',palace=(300,1173,204),chapel=(195,1129,204),newMeshBatches=created,
 newRouteIds=[x[0]for x in newRoutes],entrancesClaimed=3,
 features=['royal residence interior with private record stacks','ritual chapel and bell lantern',
 'two monumental residential towers','state hall Gothic facade tracery','dual servant/service approaches'],
 caveats=['Actual player-capable portal and chapel door opening QA required',
 'NPC royal households, inventory and event logic not yet implemented',
 'Entire castle precinct, royal ramps, retaining walls and external urban fabric remain open'])
plan['currentRoyalResidencePalaceStudy']=meta
(root/'royal-palace-plan-v6.staged.json').write_text(json.dumps(plan,separators=(',',':')),encoding='utf8')
(root/'royal-palace-study-v6.staged.json').write_text(json.dumps(meta,indent=2),encoding='utf8')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(stage))
print('ROYAL_PALACE_STAGED',len(created),stage.stat().st_size,meta['newRouteIds'])
