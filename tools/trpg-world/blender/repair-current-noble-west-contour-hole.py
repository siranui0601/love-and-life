"""Repair true noble west 12m missing road/ground with masonry arch
integrated into existing road mesh. No parcel, route or building changes.
"""
import bpy,bmesh,json,pathlib,math
from mathutils import Vector
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
stage=root/'noble-west-integrated-arch.pending.blend'
if stage.exists():raise RuntimeError('stage exists')
p=json.loads((root/'plan.json').read_text('utf8'))
r=next(t for t in p['routes']if t['id']=='noble_west_contour_1')
m=next(q for q in p['meshes']if q['name']=='noble_west_contour_1')
o=bpy.data.objects.get('noble_west_contour_1')
assert o and o.type=='MESH'
assert len(o.data.polygons)==len(m['faces'])
assert len(r['points'])>=461
stations=r['points'][457:461]
assert all(-571<x[0]<-550 and 554<x[1]<563 and abs(x[2]-78)<.01 for x in stations)
# New roadway joins existing paved road with about a 1cm beveled lip;
# the underside is an actual shallow arched stone vault across the void.
start,end=stations[0],stations[-1]
dx=end[0]-start[0];dy=end[1]-start[1];D=math.hypot(dx,dy)
nx=-dy/D;ny=dx/D
width=7
inv=o.matrix_world.inverted()
bm=bmesh.new();bm.from_mesh(o.data)
layers=[]
for i,p0 in enumerate(stations):
 t=i/(len(stations)-1)
 z=78.16+.06*math.sin(math.pi*t)
 underneath=72.1+4.0*math.sin(math.pi*t)
 x,y=p0[:2]
 def vertex(lateral,Z):
  return bm.verts.new(inv@Vector((x+nx*lateral,y+ny*lateral,Z)))
 layer=[vertex(-width/2,z),vertex(width/2,z),
        vertex(-width/2,underneath),vertex(width/2,underneath)]
 layers.append(layer)
for a,b in zip(layers,layers[1:]):
 bm.faces.new((a[0],b[0],b[1],a[1])) # road
 bm.faces.new((a[2],a[3],b[3],b[2])) # masonry vault underside
 bm.faces.new((a[0],a[2],b[2],b[0])) # wall face
 bm.faces.new((a[1],b[1],b[3],a[3]))
bm.faces.new((layers[0][0],layers[0][1],layers[0][3],layers[0][2]))
bm.faces.new((layers[-1][1],layers[-1][0],layers[-1][2],layers[-1][3]))
# Continuous parapet/kerb on either side with 1.05m high guard wall;
# no individual step or post objects.
for side in (-1,1):
 parapets=[]
 for i,q in enumerate(stations):
  t=i/(len(stations)-1)
  z=78.16+.06*math.sin(math.pi*t)
  cx,cy=q[:2]
  edge=side*(width/2-.18)
  def v(ds,z0):
   return bm.verts.new(inv@Vector((cx+nx*(edge+ds),cy+ny*(edge+ds),z0)))
  parapets.append([v(-.24,z+.01),v(.24,z+.01),
                    v(-.24,z+1.16),v(.24,z+1.16)])
 for a,b in zip(parapets,parapets[1:]):
  bm.faces.new((a[0],b[0],b[1],a[1]))
  bm.faces.new((a[2],a[3],b[3],b[2]))
  bm.faces.new((a[0],a[2],b[2],b[0]))
  bm.faces.new((a[1],b[1],b[3],a[3]))
 bm.faces.new((parapets[0][0],parapets[0][1],parapets[0][3],parapets[0][2]))
 bm.faces.new((parapets[-1][1],parapets[-1][0],parapets[-1][2],parapets[-1][3]))
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.to_mesh(o.data);bm.free();o.data.update()
m['vertices']=[list(q.co)for q in o.data.vertices]
m['faces']=[list(f.vertices)for f in o.data.polygons]
meta=dict(status='PENDING_LOCAL_QA',changedMesh='noble_west_contour_1',
 oldFaces=537,newFaces=len(o.data.polygons),newVerts=len(o.data.vertices),
 routeIDsChanged=[],stitchedSamples=stations,
 bridgeLengthM=round(D,2),widthM=width,
 vaultDepthAtHaunchM=round(78.16-72.1,2),
 voidZ=78.0, undersideType='stone arch vault',
 guardWalls='integrated both sides',
 limitations=['Masonry physical spans are schematic; no structural engineering',
 'Local travel and side fall protection still require ray and gameplay review'])
p['nobleWestRoadBridgeRepair']=meta
(root/'noble-west-plan.staged.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(root/'noble-west-study.staged.json').write_text(json.dumps(meta,indent=2),encoding='utf8')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(stage))
print('NOBLE_WEST_ARCH_STAGED',meta,stage.stat().st_size)
