import bpy,math
from mathutils import Vector
s=[o for o in bpy.data.objects if o.type=='MESH' and o.name in ('low_city_ground','civic_foot_ground','mage_east_ground','upper_city_ground','b107_upper_city_retaining_reconstruction','western_ascent_noble_service_restored_low_ground')]
for r in [0,19,21,24,27,32]:
 for angle in [0,60,120,180,240,300]:
  x=636+r*math.cos(math.radians(angle));y=664+r*math.sin(math.radians(angle))
  hits=[]
  for o in s:
   org=o.matrix_world.inverted()@Vector((x,y,145))
   direction=o.matrix_world.inverted().to_3x3()@Vector((0,0,-1))
   found,loc,no,i=o.ray_cast(org,direction,distance=160)
   if found:hits.append((o.name,round((o.matrix_world@loc).z,2)))
  print('GROUND',r,angle,round(x,1),round(y,1),hits)
