import bpy,json,pathlib,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
P=json.loads((root/'royal-east-integrated-v7.staged.plan.json').read_text('utf8'))
# Identify which rendered surfaces make the tall spear-shaped seam.
scene=bpy.context.scene;deps=bpy.context.evaluated_depsgraph_get()
W=1040;H=696;pos=Vector((610,1050,192));target=Vector((428,1025,150))
rot=(target-pos).to_track_quat('-Z','Y')
right=rot@Vector((1,0,0));up=rot@Vector((0,1,0));direction=rot@Vector((0,0,-1))
for ix,iy in [(728,355),(745,350),(753,375),(761,405),(773,480),(703,372),(700,480),(725,520),(780,350)]:
 origin=pos+right*((ix/W-.5)*230)+up*((.5-iy/H)*230*H/W)
 hit,pt,normal,face,ob,mat=scene.ray_cast(deps,origin,direction,distance=5000)
 print('PIXEL',ix,iy,'HIT',ob.name if hit else 'NONE',tuple(round(q,2)for q in pt)if hit else None,flush=True)
# As-built foot of the old fortification, measured for each Z156 new ridge station.
old=['current_east_escarpment_rock','current_east_escarpment_stone',
    'b104_castle_integrated_outer_retaining','forecourt_retaining',
    'repair_royal_cliff_tapered_revetment']
items=[];sources=[]
for name in old:
 ob=bpy.data.objects.get(name)
 if ob is None:continue
 base=len(items)
 items.extend([ob.matrix_world@x.co for x in ob.data.vertices])
 for face in ob.data.polygons:sources.append((name,[base+i for i in face.vertices]))
bvh=BVHTree.FromPolygons(items,[a[1]for a in sources])
rock=bpy.data.objects['repair_royal_east_pocket_integrated_rock_v7']
# ridge is every other vertex at j=0 from the author sampling table.
for i in range(0,46,3):
 vertex=rock.data.vertices[(i*15)*2]
 pt=rock.matrix_world@vertex.co
 q,n,idx,dist=bvh.find_nearest(pt,25)
 print('RIDGE',round(pt.y,1),round(pt.x,1),'nearest',sources[idx][0]if idx is not None else None,
       'gapM',round(dist,2)if dist is not None else None,'hit',tuple(round(x,1)for x in q)if q else None,flush=True)
