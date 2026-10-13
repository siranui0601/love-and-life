import bpy,pathlib,json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
R=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
camloc=Vector((480,1360,125));target=Vector((350,1228,50))
rot=(target-camloc).to_track_quat('-Z','Y');forward=rot@Vector((0,0,-1));right=rot@Vector((1,0,0));up=rot@Vector((0,1,0))
deps=bpy.context.evaluated_depsgraph_get()
for px,py in [(895,440),(915,440),(935,440),(915,525),(680,440)]:
 origin=camloc+right*((px/1100-.5)*190)+up*((.5-py/730)*190*730/1100)
 hit,loc,normal,idx,obj,matrix=bpy.context.scene.ray_cast(deps,origin,forward,distance=3000)
 print('PIXEL',px,py,hit,tuple(loc),obj.name if obj else None,flush=True)
P=json.loads((R/'work014-p0-contact.staged.plan.json').read_text('utf8'))
for m in P['meshes']:
 if any(t in m['name'] for t in ('retaining','revetment','W03')):
  vs=m['vertices'];bounds=[[min(v[i] for v in vs),max(v[i] for v in vs)] for i in range(3)]
  if bounds[0][0]<420 and bounds[0][1]>320 and bounds[1][0]<1280 and bounds[1][1]>1180:print('NEAR_WALL',m['name'],bounds,flush=True)
