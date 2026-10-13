import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ob=bpy.data.objects['repair_royal_cliff_tapered_revetment']
v=[ob.matrix_world@a.co for a in ob.data.vertices]
b=BVHTree.FromPolygons(v,[[i for i in p.vertices] for p in ob.data.polygons])
for y in (1050,1060,1070,1080,1085,1090,1100,1110,1120):
 print('Y',y,flush=True)
 for z in (112.5,125,138,151,155.8,160,180,203.5):
  pt,n,f,d=b.ray_cast(Vector((600,y,z)),Vector((-1,0,0)),400)
  if pt is not None:print('  Z',z,'xWallFace',round(pt.x,2),flush=True)
