import bpy,json,pathlib,math
from mathutils import Vector
out=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current\castle-scene-inventory.json')
items=[]
for obj in bpy.data.objects:
 if obj.type!='MESH' or not obj.data.polygons:continue
 bounds=[obj.matrix_world@Vector(v)for v in obj.bound_box]
 minx,miny,minz=(min(v[j]for v in bounds)for j in range(3))
 maxx,maxy,maxz=(max(v[j]for v in bounds)for j in range(3))
 if maxx<98 or minx>460 or maxy<930 or miny>1240 or maxz<204 or minz>290:continue
 name=obj.name
 if len(obj.data.polygons)>10 or any(n in name.lower() for n in ['castle','royal','palace','citadel','hall','gate']):
  items.append(dict(name=name,poly=len(obj.data.polygons),bounds=[round(v)for v in [minx,miny,minz,maxx,maxy,maxz]],
   mats=[m.name for m in obj.data.materials],collection=[c.name for c in obj.users_collection]))
items.sort(key=lambda x:(-x['poly'],x['name']))
out.write_text(json.dumps(items,indent=2),encoding='utf8')
print('FOUND',len(items))
for obj in items[:190]:
 print(obj['name'],'faces',obj['poly'],'bounds',obj['bounds'])
