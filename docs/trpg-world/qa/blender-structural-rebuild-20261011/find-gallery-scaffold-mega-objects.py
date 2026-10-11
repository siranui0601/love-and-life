import bpy
items=[]
for o in bpy.data.objects:
 if o.type!='MESH' or not o.data.vertices:continue
 pts=[o.matrix_world@__import__('mathutils').Vector(p)for p in o.bound_box]
 x0,x1=min(q.x for q in pts),max(q.x for q in pts)
 y0,y1=min(q.y for q in pts),max(q.y for q in pts)
 z0,z1=min(q.z for q in pts),max(q.z for q in pts)
 if x1<600 or x0>635 or y1<640 or y0>708 or z1<25 or z0>120:continue
 if z1-z0<11:continue
 if (x1-x0)>300 or(y1-y0)>350:continue
 items.append((o.name,len(o.data.polygons),(round(x0),round(x1),round(y0),round(y1),round(z0),round(z1))))
print('FOUND',len(items))
for v in sorted(items,key=lambda x:-x[2][-1]+x[2][-2])[:90]:print('OBJ',v)
