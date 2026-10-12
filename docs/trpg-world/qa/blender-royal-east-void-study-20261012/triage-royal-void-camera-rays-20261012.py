import bpy,math
from mathutils import Vector
# Recreate the approved identical camera for exact pixel-to-world analysis.
render=bpy.context.scene.render
W=render.resolution_x or 1280;H=render.resolution_y or 850
# images were generated at 1280x850 with 85% scaling => 1088x722.
W=1088;H=722
views=[('high',Vector((540,1100,330)),Vector((376,960,165)),260,
        [(760,550),(825,560),(800,660),(740,650),(650,600),(830,450)]),
       ('side',Vector((550,900,250)),Vector((378,950,172)),255,
        [(945,640),(970,550),(860,620),(940,680),(845,550)])]
for name,pos,target,scale,points in views:
 rotation=(target-pos).to_track_quat('-Z','Y')
 right=rotation@Vector((1,0,0));up=rotation@Vector((0,1,0));ray=rotation@Vector((0,0,-1))
 print('VIEW',name,'ray',tuple(round(x,3)for x in ray),flush=True)
 for x,y in points:
  origin=pos+right*((x/W-.5)*scale)+up*((.5-y/H)*scale*H/W)
  levels=[]
  for zz in (112,156,204):
   t=(zz-origin.z)/ray.z
   here=origin+ray*t
   levels.append((zz,(round(here.x,1),round(here.y,1))))
  deps=bpy.context.evaluated_depsgraph_get()
  hit,loc,norm,ind,ob,matrix=bpy.context.scene.ray_cast(deps,origin,ray,distance=7000)
  print('PIXEL',name,x,y,'WORLDBY_Z',levels,'FIRST_HIT',ob.name if hit else None,
    tuple(round(q,1)for q in loc)if hit else None,flush=True)
