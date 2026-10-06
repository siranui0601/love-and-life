"""Sample walking floors and headroom from actual Blender meshes; not gameplay QA."""
import bpy,json,pathlib,sys,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
source=pathlib.Path(sys.argv[sys.argv.index('--')+1]);data=json.loads(source.read_text());vs=[];fs=[];names=[]
for ob in bpy.context.scene.objects:
 if ob.type!='MESH':continue
 # Water is not walkable.
 if any(c.name=='Water'for c in ob.users_collection):continue
 offset=len(vs);vs.extend([ob.matrix_world@v.co for v in ob.data.vertices])
 for f in ob.data.polygons:fs.append([offset+i for i in f.vertices]);names.append(ob.name)
tree=BVHTree.FromPolygons(vs,fs);failures=[];counts={};samples=0
for route in data['routes']:
 for i,p in enumerate(route['points']):
  if i%3 and i!=len(route['points'])-1:continue
  samples+=1;origin=Vector((p[0],p[1],p[2]+2));hit,normal,index,d=tree.ray_cast(origin,Vector((0,0,-1)),3)
  problem=None
  if hit is None:problem='missing_floor'
  elif hit.z>p[2]+.6:problem='floor_above_route'
  elif hit.z<p[2]-.3:problem='floor_below_route'
  elif normal.z<.5:problem='floor_normal'
  if problem:
   counts[problem]=counts.get(problem,0)+1
   if len(failures)<80:failures.append({'route':route['id'],'sample':i,'problem':problem,'position':p,'mesh':None if index is None else names[index],'normal':None if normal is None else list(normal)})
result={'status':'FAIL'if counts else 'SAMPLE_PASS','sampleCount':samples,'failureCounts':counts,'examples':failures,'limitations':'Centreline samples only; downward ray starts2m above route. Not continuous capsule, side clearance or gameplay validation.'}
source.with_name('blender-floor-audit.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items()if k!='examples'}))
