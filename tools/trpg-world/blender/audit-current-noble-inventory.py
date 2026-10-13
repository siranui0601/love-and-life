import bpy,json,pathlib,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
a=[]
def inspect(region):
 minx,miny,maxx,maxy=region
 objdata=[]
 for obj in bpy.data.objects:
  if obj.type!='MESH':continue
  c=[obj.matrix_world@Vector(v) for v in obj.bound_box]
  b=(min(v.x for v in c),min(v.y for v in c),max(v.x for v in c),max(v.y for v in c))
  if b[0]>maxx or b[2]<minx or b[1]>maxy or b[3]<miny:continue
  if len(obj.data.polygons)==0:continue
  objdata.append(dict(name=obj.name,faces=len(obj.data.polygons),coll=[x.name for x in obj.users_collection],z=[round(min(v.z for v in c),1),round(max(v.z for v in c),1)],bounds=[round(v)for v in b]))
 return sorted(objdata,key=lambda x:-x['faces'])
for region in [(-655,480,-520,625),(-925,710,-710,865)]:
 res=inspect(region);a.append(dict(region=region,count=len(res),objects=res))
(out/'noble-corridor-scene-inventory.json').write_text(json.dumps(a,indent=2),encoding='utf8')
for r in a:
 print('REGION',r['region'],'count',r['count'])
 for obj in r['objects'][:85]:print('OB',obj['name'],'faces',obj['faces'],'z',obj['z'],'coll',obj['coll'])
