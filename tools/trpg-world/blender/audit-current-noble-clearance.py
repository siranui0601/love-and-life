"""Current city QA: narrow stair head/body collision against actual
retaining walls, old ascent equipment, and massing in Blender scene.
Discrete horizontal rays only; doesn't prove full capsule or NavMesh.
"""
import bpy,math,pathlib,json,sys,collections
from mathutils import Vector
p=pathlib.Path(sys.argv[sys.argv.index('--')+1])
plan=json.loads((p/'plan.json').read_text())
paths=[r for r in plan['routes'] if r['id']in ('west_noble_wall_stairs','noble_east_wall_stair')]
bounds=[(-655,480,-520,625),(-925,710,-710,865)]
candidates=[]
for obj in bpy.data.objects:
 if obj.type!='MESH' or len(obj.data.polygons)==0:continue
 if obj.name in ('District facade openings','Frontage entrance doors - visual only','Parcels - street frontage first'):continue
 if obj.name.startswith(('b116_', 'b115_', 'b114_','west_noble_wall_stairs','distributed_access_stair_tread_')):continue
 if any(x in obj.name for x in ['ground','floor','roofs','roof','lane','path','deck','gabled']):continue
 pts=[obj.matrix_world@Vector(a)for a in obj.bound_box]
 xmin,xmax=min(v.x for v in pts),max(v.x for v in pts)
 ymin,ymax=min(v.y for v in pts),max(v.y for v in pts)
 zmin,zmax=min(v.z for v in pts),max(v.z for v in pts)
 if zmax<41 or zmin>83:continue
 if not any(xmax>=b[0]-5 and xmin<=b[2]+5 and ymax>=b[1]-5 and ymin<=b[3]+5 for b in bounds):continue
 candidates.append((obj,(xmin,ymin,xmax,ymax),obj.matrix_world.inverted()))
hits=[];rays=0;hitBy=collections.Counter()
for route in paths:
 for a,b in zip(route['points'],route['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];ll=math.hypot(dx,dy)
  if ll<.01:continue
  nx=-dy/ll;ny=dx/ll
  steps=max(1,math.ceil(ll/1.25))
  for t in range(steps):
   x=a[0]+dx*t/steps;y=a[1]+dy*t/steps;z=a[2]+(b[2]-a[2])*t/steps
   X=a[0]+dx*(t+1)/steps;Y=a[1]+dy*(t+1)/steps;Z=a[2]+(b[2]-a[2])*(t+1)/steps
   for w in (-.9,0,.9):
    for h in (1.1,1.85):
     st=Vector((x+nx*w,y+ny*w,z+h))
     en=Vector((X+nx*w,Y+ny*w,Z+h))
     dr=en-st;L=dr.length
     if L<.001:continue
     rays+=1
     for obj,(minx,miny,maxx,maxy),matinv in candidates:
      if not (minx-1.5<=st.x<=maxx+1.5 and miny-1.5<=st.y<=maxy+1.5):continue
      p0=matinv@st;v=matinv.to_3x3()@dr
      if v.length<.0001:continue
      success,loc,norm,idx=obj.ray_cast(p0,v.normalized(),distance=v.length)
      if success:
       dist=(obj.matrix_world@loc-st).length
       if .018<dist<L-.018:
        hitBy[obj.name]+=1
        if len(hits)<70:hits.append(dict(route=route['id'],obj=obj.name,xyz=[round(q,2)for q in st]))
result=dict(status='LOCAL_PASS'if not hitBy else 'FAIL',routes=[r['id']for r in paths],rays=rays,candidateMeshCount=len(candidates),
 collisions=sum(hitBy.values()),byObject=hitBy.most_common(35),examples=hits,
 limitations=['Render-only 420064-face district facade mesh not included',
 'No real game actor capsule','Old stair tread overlapping other paths not sampled as obstacles',
 'Vertical and lateral full swept movement not modeled'])
(p/'noble-clearance-current.json').write_text(json.dumps(result,indent=2,ensure_ascii=False))
print('CLEARANCE',json.dumps({k:v for k,v in result.items()if k not in ('examples','limitations')}))
