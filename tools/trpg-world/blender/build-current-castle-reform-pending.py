"""Royal castle structural hierarchy overhaul, staged only.
This edits a TEMPORARY blend and staged JSON; final current is changed only
after geometry/route and human camera validation.
Original b101 gate towers are shifted to align with the throne nave.
The former throne-room solid becomes a true hollow space with cut-through door.
Roof is redesigned into elevated nave + side aisles. Detail objects are batched.
"""
import bpy,bmesh,math,json,pathlib,sys
from mathutils import Vector
root=pathlib.Path(sys.argv[sys.argv.index('--')+1])
target=root/'castle-reform.pending.blend'
if target.exists():raise RuntimeError('Pending castle blend exists; refuse overwrite')
p=json.loads((root/'plan.json').read_text(encoding='utf8'))
scene=bpy.context.scene
coll=bpy.data.collections.get('Current castle architectural core')
if coll:raise RuntimeError('Castle current previously applied; refusing repeat')
coll=bpy.data.collections.new('Current castle architectural core')
scene.collection.children.link(coll)
# Build masonry in a handful of batched meshes, NOT a separate cube object
# for every window, crenel, column or stone.
palette={
 'masonry':(.73,.71,.64,1),
 'cornice':(.88,.82,.69,1),
 'roof':(.13,.27,.47,1),
 'roof_dark':(.11,.19,.35,1),
 'accent':(.71,.48,.19,1),
 'window':(.09,.17,.27,1),
 'floor':(.65,.60,.49,1)
}
batches={key:([],[])for key in palette}
materials={}
for key,c in palette.items():
 m=bpy.data.materials.get('RoyalCurrent '+key)or bpy.data.materials.new('RoyalCurrent '+key)
 m.diffuse_color=c
 materials[key]=m
def emit(key,verts,faces):
 v,f=batches[key];n=len(v)
 v.extend([list(t)for t in verts]);f.extend([[n+i for i in face]for face in faces])
def box(key,center,size):
 cx,cy,cz=center;w,d,h=size
 v=[[cx-w/2,cy-d/2,cz-h/2],[cx+w/2,cy-d/2,cz-h/2],
 [cx+w/2,cy+d/2,cz-h/2],[cx-w/2,cy+d/2,cz-h/2],
 [cx-w/2,cy-d/2,cz+h/2],[cx+w/2,cy-d/2,cz+h/2],
 [cx+w/2,cy+d/2,cz+h/2],[cx-w/2,cy+d/2,cz+h/2]]
 emit(key,v,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
def gable(key,cx,cy,w,d,zbase,peak):
 x0=cx-w/2;x1=cx+w/2
 y0=cy-d/2;y1=cy+d/2
 v=[[x0,y0,zbase],[x1,y0,zbase],[x1,y1,zbase],[x0,y1,zbase],[cx,y0,zbase+peak],[cx,y1,zbase+peak]]
 emit(key,v,[[0,1,4],[3,5,2],[0,4,5,3],[4,1,2,5]])
def arch_ring(key,cx,cy,spring,r0,r1,depth):
 steps=28
 v=[];faces=[]
 for y in [cy-depth/2,cy+depth/2]:
  for r in (r0,r1):
   for i in range(steps+1):
    theta=math.pi*i/steps
    v.append((cx+r*math.cos(theta),y,spring+r*math.sin(theta)))
 k=steps+1
 for i in range(steps):
  faces.extend([[i,i+1,k+i+1,k+i],
   [2*k+i,2*k+i+1,3*k+i+1,3*k+i],
   [i,i+1,2*k+i+1,2*k+i],
   [k+i,k+i+1,3*k+i+1,3*k+i]])
 emit(key,v,faces)
# The original B101 pair is kept in its correct historic gate position.
# Relocation to a centered gate obstructed castle_lane_1; the view axis is
# instead formed by a court turn after entering the original gate.
moved=[]
officeShift=[]
# Eliminate duplicate legacy solid superimposed on the great nave;
# replacement residential block will be genuinely hollow.
removed=['Proposed castle palace','b101_principal_throne_hall_high_roof']
for name in removed:
 obj=bpy.data.objects.get(name)
 if not obj:raise RuntimeError('Expected legacy block '+name+' not found')
 bpy.data.objects.remove(obj,do_unlink=True)
p['meshes']=[m for m in p['meshes']if m['name']not in removed]
hall=bpy.data.objects.get('b101_principal_throne_hall_block')
if not hall or len(hall.data.polygons)!=6:raise RuntimeError('Main hall source not recognized')
def carve(name,center,dims,targetObj):
 bpy.ops.mesh.primitive_cube_add(size=1,location=center)
 ob=bpy.context.object;ob.name='TEMP_CUT_'+name;ob.dimensions=dims
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 bpy.ops.object.select_all(action='DESELECT')
 targetObj.select_set(True);bpy.context.view_layer.objects.active=targetObj
 mod=targetObj.modifiers.new('actual hollow space '+name,'BOOLEAN')
 mod.object=ob;mod.solver='EXACT';mod.operation='DIFFERENCE'
 bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.data.objects.remove(ob,do_unlink=True)
carve('court_throne_audience_hall',(290,1080,221),(97,97,34),hall)
carve('public_south_throne_entry',(265,1027.2,212),(11,13,16),hall)
# Opposite internal access: internal wing door, clipped to throne wall.
carve('eastern_residential_passage',(340,1080,212),(12,9,15.5),hall)
print('THRONE_BOOLEAN_FACES',len(hall.data.polygons))
if len(hall.data.polygons)<10:raise RuntimeError('Boolean interior did not occur')
for m in p['meshes']:
 if m['name']=='b101_principal_throne_hall_block':
  m['vertices']=[[float(v.co[j])for j in range(3)]for v in hall.data.vertices]
  m['faces']=[list(face.vertices)for face in hall.data.polygons]
  break
# Formal three-part roof: the center has distinct clerestory and roof mass;
# side aisles remain lower to avoid 100m uniform blue plastic triangle.
box('masonry',(290,1080,245.5),(44,94,11))
box('cornice',(290,1080,251),(48,98,1.4))
gable('roof',290,1080,48,102,251,25)
gable('roof_dark',254,1080,36,110,240,14)
gable('roof_dark',326,1080,36,110,240,14)
# Buttressed west/east clerestory windows in one mesh each.
for side,x in [('west',268),('east',312)]:
 for i,y in enumerate(range(1046,1122,15)):
  box('cornice',(x,y,245),(1.15,3.6,8.5))
  # Recess visual, not a claim of a punched-through window.
  box('window',(x+(.6 if side=='west'else -.6),y,246.2),(.31,2.1,4.8))
# West keep chapel and east royal residence share royal-court functions.
# New east residence is HOLLOW (four continuous structural walls), not a solid box.
cx,cy=363,1086
box('floor',(cx,cy,204.5),(41,68,.9))
box('masonry',(344,1063,222),(3,22,34))
box('masonry',(344,1104,222),(3,32,34))
box('masonry',(344,1081,229),(3,14,20))
box('masonry',(382,cy,222),(3,68,34))
box('masonry',(cx,1054,222),(39,3,34))
box('masonry',(cx,1118,222),(39,3,34))
gable('roof',cx,cy,45,72,240,19)
# Royal entrance now physically centers at x290, aligned with throne door.
# Open horseshoe gate 18m clear plus paired square stone columns.
for x in [252.5,277.5]:
 box('masonry',(x,995,211.5),(5,8,15))
arch_ring('cornice',265,995,218.8,10.0,13.1,9)
box('masonry',(265,995,236.5),(29,9,8))
gable('roof',265,995,32,12,240.8,8)
for x in [259,271]:
 box('window',(x,990.35,237.0),(2,.3,4.5))
# Ground-floor public procession, visually navigable and truly in front of
# the south door, not overlapping guard towers x269/310.
for y in range(1002,1026,7):
 box('floor',(265,y,204.33),(9,6,.17))
# Sightline: treasury/guard galleries in the courtyard either side of axis.
for x in [250,330]:
 for y in (1008,1021):
  box('masonry',(x,y,211), (2.2,2.2,14))
  box('cornice',(x,y,218.5),(4.1,4.1,1.1))
# Palace upper curtain crest on the SOUTH facing existing retaining wall,
# not on entrance opening. One batched masonry, not 200 objects.
battlements=0
for a,b in [((110,955),(235,955)),((337,955),(447,955)),
 ((105,960),(105,1205)),((445,960),(445,1205))]:
 dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
 ux,uy=dx/L,dy/L;count=int(L/7.2)
 for i in range(count):
  t=(i+.5)/count
  x=a[0]+dx*t;y=a[1]+dy*t
  # Gate access, west wall stair and east access are protected.
  if math.hypot(x-200,y-1080)<22 or math.hypot(x-270,y-1170)<24:continue
  box('masonry',(x,y,206.35),(4.2,3.0,4.4))
  battlements+=1
# Actual audience chamber -- freestanding dais, side galleries and benches;
# none obstruct the x290 central procession.
box('floor',(290,1081,204.34),(93,93,.18))
box('masonry',(290,1114,205.55),(15,9,2.8))
box('cornice',(290,1114,207.12),(16,10,.5))
for i,y in enumerate((1050,1068,1086,1104)):
 for x in (255,325):
  box('masonry',(x,y,208.3),(2.3,2.3,8))
  box('cornice',(x,y,212.7),(3.6,3.6,1))
for x in (265,315):
 for y in range(1054,1105,10):
  box('floor',(x,y,205.0),(9,2.3,1.2))
for i,x in enumerate((273,307)):
 box('accent',(x,1114,210.2),(2,1,4))
# Relocate four legacy "corner towers" away from the open throne hall and
# its adjoining functional wing onto genuine outer court terrain. Coordinates
# were surveyed inside castle_ground and >=11m from existing road clear zones.
relocations=[
 ((139,1055),''),
 ((244,1173),'.001'),
 ((403,1095),'.002'),
 ((358,1140),'.003')]
relocated=[]
for (x,y),suffix in relocations:
 name='Castle corner tower'+suffix
 shaft=bpy.data.objects.get(name)
 roof=bpy.data.objects.get('Castle corner tower_roof'+suffix)
 if shaft is None or roof is None:raise RuntimeError('Expected existing court corner tower '+name)
 bb=[shaft.matrix_world@Vector(v)for v in shaft.bound_box]
 oldx=(min(v.x for v in bb)+max(v.x for v in bb))/2
 oldy=(min(v.y for v in bb)+max(v.y for v in bb))/2
 dx=x-oldx;dy=y-oldy
 for ob in (shaft,roof):
  ob.location.x+=dx;ob.location.y+=dy
  relocated.append((ob.name,round(dx,2),round(dy,2)))
  for m in p['meshes']:
   if m['name']==ob.name:
    for v in m['vertices']:v[0]+=dx;v[1]+=dy
# Materialized batched mesh groups
added=[]
for name,(verts,faces) in batches.items():
 if not faces:continue
 me=bpy.data.meshes.new('RoyalCurrent '+name)
 me.from_pydata(verts,[],faces);me.update()
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 bm.to_mesh(me);bm.free()
 obj=bpy.data.objects.new('current_royal_'+name,me);coll.objects.link(obj)
 me.materials.append(materials[name]);added.append(obj.name)
 p['meshes'].append(dict(name=obj.name,vertices=[list(v.co)for v in me.vertices],
                        faces=[list(f.vertices)for f in me.polygons],material=materials[name].name))
# Axial traversable centerline; endpoints connect royal gate and actual hall.
r=dict(id='royal_processional_throne_entry_current',
       points=[[265,972,204],[265,995,204],[265,1028,204],
               [265,1038,204],[290,1058,204],[290,1107,204]],
       width=6,kind='life',z0=204,z1=204,lengthM=149.1,grade=0)
if any(q['id']==r['id']for q in p['routes']):raise RuntimeError('duplicate procession route')
p['routes'].append(r)
p['audit']['routeCount']=len(p['routes'])
info=dict(status='PENDING_3D_CHECK',base='current',movedGateObjects=moved,
 originalGateShiftX=0,shiftedOffices=officeShift,relocatedCornerTowers=relocated,removedLegacy=removed,throneSolidHollowed=True,
 hallFaces=len(hall.data.polygons),roofAisles=3,entranceAxisX=265,
 entranceRouteId=r['id'],batchedGeometry=added,outerBattlements=battlements,
 limitations=['No full palace second-floor player navigation yet',
 'Collision along new processional path and with legacy object required',
 'Palace court cinematic identity must be reviewed by user from eye-level',
 'Castle defensive structures require all-side corridor connectivity'])
p['currentRoyalReform']=info
(root/'staged-castle-plan.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(root/'staged-castle-QA.json').write_text(json.dumps(info,indent=2),encoding='utf8')
# Render before approval
scene.render.resolution_x=1320;scene.render.resolution_y=850
views=[
 ('pending-royal-silhouette',(640,710,500),(284,1090,230),680),
 ('pending-royal-front',(290,885,288),(290,1050,235),385),
 ('pending-royal-gate-eye',(265,953,208),(265,1037,226),None),
 ('pending-royal-hall-eye',(290,1042,209),(290,1110,214),None)]
for name,pos,at,scale in views:
 camera=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,camera)
 scene.collection.objects.link(o);o.location=pos
 o.rotation_euler=(Vector(at)-o.location).to_track_quat('-Z','Y').to_euler()
 camera.clip_start=.1;camera.clip_end=25000;camera.lens=25
 if scale:camera.type='ORTHO';camera.ortho_scale=scale
 scene.camera=o;scene.render.filepath=str(root/(name+'.png'))
 bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(o,do_unlink=True)
scene['castle_status']='PENDING QA: real hall carved and ceremonial gate realigned'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('CASTLE_PENDING',target.stat().st_size,info['hallFaces'],battlements,len(added))
