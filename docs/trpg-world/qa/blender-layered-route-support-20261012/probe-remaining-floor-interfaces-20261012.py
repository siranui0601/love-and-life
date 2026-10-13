import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
names=['distributed_access_freight_continuous_deck','noble_west_contour_1',
 'noble_west_ground','b116_noble_east_wall_stair_mitered_stone_step_lattice',
 'western_ascent_civic_foot_contour_1_retained_1_continuous_floor','civic_foot_ground',
 'court_wall_stairs','court_wall_stairs_treads','court_wall_stairs_support']
trees={}
for name in names:
 ob=bpy.data.objects.get(name)
 if not ob:continue
 v=[ob.matrix_world @ a.co for a in ob.data.vertices]
 faces=[list(f.vertices)for f in ob.data.polygons]
 trees[name]=BVHTree.FromPolygons(v,faces)
for context,pts in [('noble',[(-560,y,42+(y-522.5)*.98)for y in (552,554,556,557.48,558.65,559.83,560.61,561.39,562.56,564)]),
 ('civic',[(-593,520.5,42),(-592.2,520.17,42),(-591.2,519.95,42),(-589,519.5,42)]),
 ('court',[(101.16,769.8,138.64),(101.2,769.43,138.56),(101.13,770.5,138.89)])]:
 print('\nREGION',context,flush=True)
 for x,y,z in pts:
  result=[]
  for name,tree in trees.items():
   if context=='noble' and name not in names[:4]:continue
   if context=='civic' and name not in names[3:6]:continue
   if context=='court' and name not in names[6:]:continue
   hit,normal,idx,dist=tree.ray_cast(Vector((x,y,180)),Vector((0,0,-1)),180)
   if hit:result.append((name,round(hit.z,3),round(hit.z-z,3)))
  print('PROBE',round(x,2),round(y,2),'routeApproxZ',round(z,3),'floors',result,flush=True)
