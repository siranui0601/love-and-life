"""Torso-height ray probes against actual terrain/support meshes.
A diagnostic, not a character-controller or full collision certification.
Run Blender with the generated .blend, then --python this script -- plan.json.
"""
import bpy,json,pathlib,sys,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
source=pathlib.Path(sys.argv[sys.argv.index('--')+1]);data=json.loads(source.read_text())
# Hidden review collections otherwise retain unevaluated world transforms on load.
for collection in bpy.data.collections:collection.hide_viewport=False
bpy.context.view_layer.update()
vertices=[];faces=[];owners=[]
for group in ['Terrain','Retaining','Optional parcel massing - UNACCEPTED','North garden landscape proposal']:
 if group not in bpy.data.collections:continue
 for ob in bpy.data.collections[group].objects:
  if ob.type!='MESH':continue
  offset=len(vertices);vertices.extend([ob.matrix_world@v.co for v in ob.data.vertices])
  for f in ob.data.polygons:faces.append([offset+i for i in f.vertices]);owners.append(ob.name)
tree=BVHTree.FromPolygons(vertices,faces)
hits=[];count=0;probes=0
for route in data['routes']:
 for i,(a,b)in enumerate(zip(route['points'],route['points'][1:])):
  dx=b[0]-a[0];dy=b[1]-a[1];length=math.hypot(dx,dy)
  if length<1e-5:continue
  for offset in [-(route['width']/2-.4),-.3,0,.3,route['width']/2-.4]:
   p=Vector((a[0]-dy/length*offset,a[1]+dx/length*offset,a[2]+1.2))
   q=Vector((b[0]-dy/length*offset,b[1]+dx/length*offset,b[2]+1.2));direction=q-p;distance=direction.length;probes+=1
   hit,normal,index,d=tree.ray_cast(p,direction.normalized(),distance)
   if hit is not None and d>.001 and d<distance-.001:
    count+=1
    if len(hits)<100:hits.append({'route':route['id'],'segment':i,'obstacle':owners[index],'position':list(hit)})
result={'status':'FAIL'if count else 'PROBE_PASS','probeCount':probes,'blockedProbeCount':count,'examples':hits,'limitations':'Torso rays at centre, +/-0.3m and road edges minus0.4m. Not a swept capsule/cart, headroom, floor support or gameplay certification.'}
source.with_name('blender-width-clearance.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items()if k!='examples'}))
