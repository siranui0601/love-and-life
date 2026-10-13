"""Royal freight customs & ledger-house at a surveyed existing street.
No parcel erasure. One batched mesh per material, with real entry opening.
Stage only; actual current changes after 3D route and floor QA.
"""
import bpy,bmesh,json,pathlib,sys,math
from mathutils import Vector
root=pathlib.Path(sys.argv[sys.argv.index('--')+1])
pre=json.loads((root/'royal-customs-preflight.json').read_text('utf8'))
if pre['status']!='PASS':raise RuntimeError('Geometry/parcels/route preflight FAIL')
p=json.loads((root/'plan.json').read_text('utf8'))
pending=root/'royal-customs.pending.blend'
if pending.exists():raise RuntimeError('Pending already exists')
coll=bpy.data.collections.new('Current Royal Freight Customs Depot')
bpy.context.scene.collection.children.link(coll)
palette={
 'foundation':(.59,.58,.53,1),'ashlar':(.73,.70,.61,1),
 'lime_plaster':(.83,.79,.68,1),'slate':(.19,.27,.37,1),
 'timber':(.39,.26,.18,1),'iron':(.18,.19,.21,1),
 'brass':(.65,.45,.18,1),'road':(.62,.61,.56,1)}
geo={k:([],[])for k in palette}
def mesh(k,v,f):
 vertices,faces=geo[k];s=len(vertices)
 vertices.extend([list(map(float,q))for q in v])
 faces.extend([[s+j for j in ff]for ff in f])
def box(k,c,d):
 x,y,z=c;w,dep,h=d
 co=[(x-w/2,y-dep/2),(x+w/2,y-dep/2),(x+w/2,y+dep/2),(x-w/2,y+dep/2)]
 vv=[[a,b,zz]for zz in (z-h/2,z+h/2)for a,b in co]
 mesh(k,vv,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
def gable(k,x,y,w,depth,eave,rise):
 x0=x-w/2;x1=x+w/2;y0=y-depth/2;y1=y+depth/2
 v=[[x0,y0,eave],[x1,y0,eave],[x1,y1,eave],[x0,y1,eave],
 [x,y0,eave+rise],[x,y1,eave+rise]]
 mesh(k,v,[[0,1,4],[3,5,2],[0,4,5,3],[4,1,2,5]])
def walkway(k,a,b,width,low,hi):
 dx=b[0]-a[0];dy=b[1]-a[1];length=math.hypot(dx,dy)
 if length<.001:raise RuntimeError('zero road segment')
 nx=-dy/length*width/2;ny=dx/length*width/2
 r=[(a[0]+nx,a[1]+ny),(b[0]+nx,b[1]+ny),(b[0]-nx,b[1]-ny),(a[0]-nx,a[1]-ny)]
 v=[[xx,yy,z]for z in (low,hi)for xx,yy in r]
 mesh(k,v,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
# An OPEN stone house, not an inaccessible 18x14x10 solid.
box('foundation',(710,705,42.05),(18.0,14.0,.3))
box('ashlar',(701.45,705,46.35),(.9,14,8.3))
box('ashlar',(718.55,705,46.35),(.9,14,8.3))
box('ashlar',(710,711.55,46.35),(18,.9,8.3))
box('ashlar',(704.2,698.45,46.35),(6.4,.9,8.3))
box('ashlar',(715.8,698.45,46.35),(6.4,.9,8.3))
box('ashlar',(710,698.45,49.55),(5.2,.9,1.7))
# Windows have proper recessed frames and crossbars.
for x in (703.9,716.1):
 box('lime_plaster',(x,698.0,47.1),(2.3,.12,3.4))
 box('timber',(x,697.90,47.1),(.18,.23,3.5))
 box('timber',(x,697.86,47.1),(2.45,.15,.18))
 box('iron',(x,697.81,47.1),(.08,.1,3.5))
# Timber half-timber frame rhythm, not copied generic residence facade.
for x in (701.35,704.1,716,718.7):
 box('timber',(x,698,46.7),(.34,.37,7.5))
for z in (43.2,49.7):
 if z<44:
  # Preserve the 5m public doorway: continuous lower timber blocking
  # the threshold failed actual head/shoulder clearance in QA.
  box('timber',(704.25,697.92,z),(6.5,.4,.38))
  box('timber',(715.75,697.92,z),(6.5,.4,.38))
 else:
  box('timber',(710,697.92,z),(18,.4,.38))
for x in (701.45,718.55):
 for yy in (700,705,710):
  box('timber',(x,yy,47),(.35,.3,6.8))
# Contrast prominent slate steep gable and small customs bell-cupola.
gable('slate',710,705,20.2,16.0,50.8,5.4)
box('ashlar',(710,705,52.7),(2.8,3.2,4.7))
gable('slate',710,705,4,4.7,55.1,2.7)
box('brass',(710,702.5,53.7),(.5,.25,1.8))
box('ashlar',(715.5,709,53.8),(1.5,1.6,7.3))
# Internal public inspection zone; central x710 access 698→707 remains open.
box('timber',(704.4,707.9,43.2),(3.1,1.3,1.7)) # inspection table
box('brass',(704.4,708,44.13),(2.2,1.0,.12))
for yy in (704.0,708.0):
 box('timber',(716,yy,43.5),(2.4,.75,2.6)) # shelving
for x,y in ((705.4,710.2),(715,710.1),(714.8,703)):
 box('timber',(x,y,42.9),(1.25,1.25,1.3)) # inspected freight crates
 box('iron',(x,y,43.55),(1.26,1.27,.10))
# Hidden evidence chest tucked off the central route; later quest hook.
box('timber',(704.0,710.35,42.75),(1.8,1.2,1.3))
box('brass',(704,709.73,43.0),(.5,.09,.36))
# Exterior receiving / weigh-bridge away from carriage access centerline.
box('road',(702.6,692.1,42.21),(4.8,3.6,.23))
for x in (700.7,704.5):
 box('timber',(x,692.1,42.9),(.28,2.7,1.6))
box('iron',(702.6,692.1,43.6),(4.5,2.7,.16))
box('brass',(702.6,692.1,43.75),(.65,.8,.08))
# Street connection follows proven zero-parcel-conflict path.
routePoints=[(713,683),(716,691),(710,698),(710,703)]
for a,b in zip(routePoints,routePoints[1:]):
 walkway('road',a,b,3.2,42.03,42.20)
# Customs sign, sovereign crest and two guarded path lamps.
box('ashlar',(710,697.7,50.4),(4.4,.25,1.6))
box('brass',(710,697.52,50.5),(2.3,.13,.8))
for x,y in ((707,692),(721,687)):
 box('ashlar',(x,y,44.2),(.55,.55,4.0))
 box('brass',(x,y,46.4),(1.0,1.0,.5))
 box('slate',(x,y,46.9),(1.3,1.3,.4))
created=[]
for mat,(v,f) in geo.items():
 if not f:continue
 name='current_royal_customs_'+mat
 if bpy.data.objects.get(name):raise RuntimeError('Duplicate named mesh')
 me=bpy.data.meshes.new(name);me.from_pydata(v,[],f);me.update()
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 o=bpy.data.objects.new(name,me);coll.objects.link(o)
 m=bpy.data.materials.get('RoyalCustoms '+mat) or bpy.data.materials.new('RoyalCustoms '+mat)
 m.diffuse_color=palette[mat];me.materials.append(m)
 p['meshes'].append(dict(name=name,vertices=[list(q.co)for q in me.vertices],
                         faces=[list(q.vertices)for q in me.polygons],material=m.name))
 created.append(name)
route=dict(id='current_civic_customs_road',points=[[x,y,42]for x,y in routePoints],
           width=3.2,kind='life',z0=42,z1=42,
           lengthM=round(sum(math.dist(a,b)for a,b in zip(routePoints,routePoints[1:])),3),grade=0)
if any(r['id']==route['id']for r in p['routes']):raise RuntimeError('Duplicate access')
p['routes'].append(route)
p['audit']['routeCount']=len(p['routes'])
meta=dict(status='PENDING_3D_QA',role='Royal freight receiving, customs, evidence ledger',
 station=(710,705,42),warehouseFootprint=pre['warehouseFootprint'],
 roofRidgeElevation=56.2,warehouseEnterable=True,canonicalParcelIntersectionM2=0,
 accessRoute=route['id'],routeLengthM=route['lengthM'],newMeshes=created,
 narratives=['freight inspection table','customs records','sealed evidence chest','weighbridge'],
 caveats=['No building NPC interactions, game quest scripts or usable container hooks yet',
 'No actual goods route to the hoist is proven on the wider street network',
 'Structural / visual local QA required'])
p['currentRoyalCustomsDepot']=meta
(root/'royal-customs-plan.staged.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(root/'royal-customs-design.staged.json').write_text(json.dumps(meta,indent=2),encoding='utf8')
sc=bpy.context.scene;sc.render.resolution_x=1250;sc.render.resolution_y=830
for name,pos,at,scale in [
 ('customs-depot-overview',(785,580,138),(709,705,48),150),
 ('customs-depot-street',(708,650,63),(710,704,46),None)]:
 cam=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,cam)
 sc.collection.objects.link(ob);ob.location=pos
 ob.rotation_euler=(Vector(at)-ob.location).to_track_quat('-Z','Y').to_euler()
 cam.clip_end=18000;cam.clip_start=.1
 if scale:cam.type='ORTHO';cam.ortho_scale=scale
 else:cam.type='PERSP';cam.lens=35
 sc.camera=ob;sc.render.filepath=str(root/(name+'.png'))
 bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(ob,do_unlink=True)
sc['royal_customs_status']='pending local route QA; game logistics not implemented'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(pending))
print('CUSTOMS_STAGED',len(created),route['lengthM'],pending.stat().st_size)
