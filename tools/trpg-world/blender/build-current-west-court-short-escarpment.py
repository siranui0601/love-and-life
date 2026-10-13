"""Court west architecture redesign WIP (2026-10-10):
replace 560m looping ramp with solid 78m stone embankment, side-by-side
roofless steps and powered-winch freight incline, 2 independent lanes.
Current .blend stays untouched until QA. Protected plots checked separately.
"""
import bpy,bmesh,math,json,pathlib
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'))
stage=root/'court-west-short-escarpment-v5.pending.blend'
if stage.exists():raise RuntimeError('Existing stage, refuse overwrite')
removedNames=['court_west_ramp','court_west_ramp_graded_bench',
 'court_west_ramp_terrace_support','court_west_ramp_outer_parapet',
 'court_west_ramp_treads','court_west_ramp_landing_0',
 'court_west_ramp_landing_1']
oldRNames=['court_west_ramp','court_west_ramp_landing_0','court_west_ramp_landing_1']
missing=[n for n in removedNames if not bpy.data.objects.get(n)]
if missing:raise RuntimeError('Refuse partial removal '+str(missing))
before={r['id']:r for r in p['routes']}
if not all(n in before for n in oldRNames):raise RuntimeError('Old routes absent')
for n in removedNames:bpy.data.objects.remove(bpy.data.objects[n],do_unlink=True)
p['meshes']=[m for m in p['meshes']if m['name'] not in removedNames]
p['routes']=[r for r in p['routes']if r['id'] not in oldRNames]
col=bpy.data.collections.new('CURRENT Royal Western Short Escarpment')
bpy.context.scene.collection.children.link(col)
cols={'masonry':(.55,.55,.52,1),'limestone':(.71,.67,.59,1),
 'stair':(.74,.72,.65,1),'parapet':(.56,.57,.54,1),
 'iron':(.21,.22,.25,1),'gold':(.63,.48,.25,1),
 'gate_stone':(.68,.66,.59,1),'gate_slate':(.19,.26,.40,1),
 'banner':(.46,.10,.15,1)}
bat={k:([],[])for k in cols}
F=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
def emit(k,v,faces):
 verts,fs=bat[k];off=len(verts)
 verts.extend([list(t)for t in v])
 fs.extend([[i+off for i in face]for face in faces])
def block(k,x,y,z,w,d,h):
 xy=[(x-w/2,y-d/2),(x+w/2,y-d/2),(x+w/2,y+d/2),(x-w/2,y+d/2)]
 emit(k,[[a,b,c]for c in(z-h/2,z+h/2)for a,b in xy],F)
def prism(k,xa,xb,y0,y1,z0,z1,base=112):
 # Solid prism grounded in 112m lower terrace
 v=[[xa,y0,base],[xb,y0,base],[xb,y1,base],[xa,y1,base],
    [xa,y0,z0],[xb,y0,z1],[xb,y1,z1],[xa,y1,z0]]
 emit(k,v,F)
def strip(k,xa,xb,y0,y1,za,zb,th=.5):
 v=[[xa,y0,za-th],[xb,y0,zb-th],[xb,y1,zb-th],[xa,y1,za-th],
    [xa,y0,za],[xb,y0,zb],[xb,y1,zb],[xa,y1,za]]
 emit(k,v,F)
# X axis crosses actual natural cliff between upper city Z112 and
# royal forecourt Z156. Two existing contour streets at X~-170/-87.
# Crucial: leave the old contour walkways outside new foundation bounds.
x0,x1=-166.4,-110.5
dist=x1-x0
# Two 4m-long horizontal plazas belong to the actual elevation function.
flats=[(-147.,-143.),(-127.,-123.)]
def altitude(x):
 progressed=max(0.,x-x0)
 for a,b in flats:
  if x>a:progressed-=max(0.,min(x,b)-a)
 return 112+44*progressed/(dist-8.0)
for j in range(26):
 xa=x0+j*dist/26;xb=x0+(j+1)*dist/26
 za=altitude(xa);zb=altitude(xb)
 prism('masonry',xa,xb,961,987,za,zb)
# Top stone highway: open-air cargo lane and 220 connected steps
# delivered as one batched mesh, not 220 individual objects.
for j in range(26):
 xa=x0+j*dist/26;xb=x0+(j+1)*dist/26
 strip('limestone',xa,xb,979,984.5,altitude(xa),altitude(xb),.38)
stepCount=220
for i in range(stepCount):
 xa=x0+dist*i/stepCount;xb=x0+dist*(i+1)/stepCount
 z=altitude(xb)
 block('stair',(xa+xb)/2,968.0,z-.15,xb-xa,5.0,.30)
# Separate side rails (not a canopy or ladder-like suspended ramp).
for j in range(26):
 xa=x0+dist*j/26;xb=x0+dist*(j+1)/26
 za=altitude(xa);zb=altitude(xb)
 for y in (964.9,971.1,977.2,986.1):
  middle=(xa+xb)/2
  if y==964.9 and any(abs(middle-t)<3.0 for t in (-145,-125)):
   continue # deliberately open real lookout entrance
  strip('parapet',xa,xb,y-.27,y+.27,za+1.28,zb+1.28,.77)
# Buttress masonry is tied into the SLANTED foundation; no giant stilt posts.
for x in (-156,-141,-126,-111,-98):
 high=altitude(x)
 h=high-112
 if h<2:continue
 for y in (959.3,988.7):
  block('masonry',x,y,112+h/2,3.6,3.5,h)
  block('limestone',x,y,high-.6,4.5,4.0,1.15)
# Intermittent coursing and recesses; creates readable wall scale and
# an explorable fortification rather than a featureless gray wedge.
for j in range(9):
 xa=-162+j*8.1
 high=altitude(xa)
 for y in (960.2,987.6):
  for z in (114,120,126,132,138,144):
   if z<high-2:
    block('limestone',xa,y,z,4.6,.65,.36)
# Two safe side overlooks at different heights facing the city.
# Access corridors are included in route authoring below.
for xx in (-145,-125):
 zz=altitude(xx)
 block('limestone',xx,957.6,zz-.2,7.2,6.4,.45)
 # Continuous level stone threshold joins sloping stair to lookout deck.
 block('limestone',xx,963.0,zz-.02,3.2,11.6,.42)
 block('parapet',xx,954.5,zz+.64,7.5,.5,1.48)
 for x in (xx-3.2,xx+3.2):
  block('parapet',x,957.5,zz+.64,.35,6.4,1.48)
 block('gold',xx,954.1,zz+1.65,2.0,.12,.9)
# Guard towers are physically rooted in the masonry bank, not on
# floating stilts. Their tower roofs do not cover the cargo incline.
def turret(k,x,y,z,r0,r1,h,N=12):
 v=[]
 for r,zz in ((r0,z-h/2),(r1,z+h/2)):
  for i in range(N):
   a=2*math.pi*i/N
   v.append([x+r*math.cos(a),y+r*math.sin(a),zz])
 ff=[list(range(N-1,-1,-1)),list(range(N,2*N))]
 ff.extend([[i,(i+1)%N,(i+1)%N+N,i+N]for i in range(N)])
 emit(k,v,ff)
for xx in(-158.,-113.):
 base=altitude(xx)
 for yy in(958.7,990.3):
  bank=base-112
  if bank>1:block('masonry',xx,yy,112+bank/2,4.5,4.5,bank)
  high=12.5 if xx>-130 else 9.2
  turret('gate_stone',xx,yy,base+high/2,2.15,2.0,high)
  turret('gate_slate',xx,yy,base+high+4.5,2.8,.25,9.0)
  turret('gold',xx,yy,base+high+9.55,.19,.19,1.4)
  block('banner',xx,yy-2.1,base+high-1.2,1.7,.12,3.8)
  block('gold',xx,yy-2.23,base+high-3.1,2.0,.17,.3)
# Divider island marker supports orientation without narrowing foot/cart lanes.
turret('gate_stone',-113,975,altitude(-113)+2.3,1.1,.9,4.6,10)
block('gold',-113,974.0,altitude(-113)+3.8,1.55,.18,.8)
# Original contours retained and accessed independently; two
# service/use classes. At each end, narrow level slabs actually span
# the 3-4m between old contour surface and the ascending masonry.
strip('limestone',-170.0,x0,965.5,970.5,112,112,.30)
strip('limestone',-170.0,x0,979.3,984.5,112,112,.30)
strip('limestone',x1,-108.0,965.5,970.5,156,156,.35)
strip('limestone',x1,-108.0,979.3,984.5,156,156,.35)
# Outside this 2.5m seam, the original forecourt ground at Z156
# supports the final level walk to the original contour road.
def addRoute(name,pts,width,kind):
 if any(q['id']==name for q in p['routes']):raise RuntimeError('Route collision '+name)
 p['routes'].append(dict(id=name,kind=kind,width=width,
 points=[[round(v,5)for v in q]for q in pts],
 z0=pts[0][2],z1=pts[-1][2],grade=round(44/(dist-8.0),4),
 lengthM=round(sum(math.dist(a,b)for a,b in zip(pts,pts[1:])),3)))
people=[(-170.0,968.,112),(-166.4,968.,112)]
for j in range(1,stepCount+1):
 if j%3==0 or j==stepCount:
  people.append((x0+dist*j/stepCount,968.0,altitude(x0+dist*j/stepCount)))
people.append((-87.4,968.,156))
cart=[(-170.0,982.,112),(-166.4,982.,112)]
for j in range(1,77):
 cart.append((x0+dist*j/76,982.,altitude(x0+dist*j/76)))
cart.append((-87.0,982.,156))
addRoute('current_west_court_short_stone_stair',people,5.0,'stairs')
addRoute('current_west_court_open_winch_incline',cart,5.5,'winch_service')
for i,xx in enumerate((-145,-125),1):
 zz=altitude(xx)
 addRoute('current_west_court_overlook_'+str(i),
 [(xx,968.,zz),(xx,961.,zz),(xx,957.5,zz)],2.6,'discovery')
created=[]
for mat,(verts,ff) in bat.items():
 if not ff:continue
 name='current_west_court_escarpment_'+mat
 if bpy.data.objects.get(name):raise RuntimeError('Exists '+name)
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],ff);me.update()
 bm=bmesh.new();bm.from_mesh(me)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(name,me);col.objects.link(ob)
 m=bpy.data.materials.get(name)or bpy.data.materials.new(name)
 m.diffuse_color=cols[mat];me.materials.append(m)
 p['meshes'].append(dict(name=name,vertices=[list(q.co)for q in me.vertices],
 faces=[list(f.vertices)for f in me.polygons],material=name))
 created.append(name)
p['audit']['routeCount']=len(p['routes'])
meta=dict(status='STAGED_UNVERIFIED',
 previousRampM=before['court_west_ramp']['lengthM'],
 removedRoutes=oldRNames,removedMeshes=removedNames,
 newRoutes=['current_west_court_short_stone_stair','current_west_court_open_winch_incline',
 'current_west_court_overlook_1','current_west_court_overlook_2'],
 newMeshes=created,stepCount=220,climbM=44,
 footEstimatedM=round(math.hypot(dist,44)+7.0,2),
 roofless=True,solidRetaining=True,protectedParcelOverlapExpected=0,
 earlyTopJoinX=-110.5,flatRunToExistingForecourt=True,
 caveats=['Stage only: real Blender floor/obstacle/streets and visual QA outstanding',
 'Cargo incline requires unimplemented winch; 30 degrees unsuitable for unassisted carts',
 'Does not repair other distant walls, castle, city zoning or NPC paths'])
p['currentWestCourtShortEscarpment']=meta
(root/'west-court-short-plan-v5.staged.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(root/'west-court-short-study-v5.staged.json').write_text(json.dumps(meta,indent=2),encoding='utf8')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(stage))
print('WEST_COURT_SHORT_STAGED',stage.stat().st_size,len(created),len(p['routes']),meta)
