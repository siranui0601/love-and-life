import bpy,json,pathlib,math
from mathutils import Vector
from mathutils.kdtree import KDTree
p=json.loads((pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')/'plan.json').read_text('utf8'))
route=next(r for r in p['routes']if r['id']=='civic_wall_gallery_stairs')
objs=[o for o in bpy.data.objects if o.type=='MESH' and ('upper_city_retaining' in o.name or 'wall_gallery' in o.name and 'retaining' in o.name)]
print('WALL_CANDIDATES',[(o.name,len(o.data.vertices))for o in objs[:20]])
for o in objs[:15]:
 kd=KDTree(len(o.data.vertices))
 for i,v in enumerate(o.data.vertices):
  xyz=o.matrix_world@v.co;kd.insert((xyz.x,xyz.y,0),i)
 kd.balance();record=[]
 for k in [0,75,150,225,300,375,450]:
  x,y,z=route['points'][k];co,idx,dist=kd.find((x,y,0))
  record.append((k,round(dist,1),(round(co.x,1),round(co.y,1)),round(z,1)))
 print('NEAR',o.name,record)
