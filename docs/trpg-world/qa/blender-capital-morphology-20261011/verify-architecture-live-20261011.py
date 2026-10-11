import bpy,json,pathlib,math
from mathutils import Vector
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'))
original=json.loads((root/'architecture-repair-20261011.study.json').read_text('utf8'))
checks=[];bad=[]
for prefix,expect in original['removed'].items():
 cnt=sum(o.name.startswith(prefix)for o in bpy.data.objects)
 checks.append(dict(category='obsolete',prefix=prefix,remaining=cnt,removedExpected=expect))
 if cnt:bad.append('obsolete '+prefix)
for name,cnt in original['added']:
 o=bpy.data.objects.get(name)
 if not o or len(o.data.polygons)!=cnt:bad.append('merged '+name)
for name,fc,vc in p['upperCharterHall20261011']['newMeshes']:
 o=bpy.data.objects.get(name)
 if not o or len(o.data.polygons)!=fc or len(o.data.vertices)!=vc:bad.append('hall '+name)
for name in ('lower','ajin','market','quay'):
 wo=bpy.data.objects[name+' building walls'];ro=bpy.data.objects[name+' roofs']
 ref={(round(v.co.x,2),round(v.co.y,2),round(v.co.z,2))for v in wo.data.vertices}
 matched=sum((round(v.co.x,2),round(v.co.y,2),round(v.co.z,2))in ref for v in ro.data.vertices)
 rate=round(matched/len(ro.data.vertices),6)
 checks.append(dict(category='roofFacadeConnection',zone=name,matched=matched,total=len(ro.data.vertices),rate=rate))
 if rate<.995:bad.append('floating-roof candidate '+name)
# Central new hall must have actual upper city mesh support, not a floating platform.
terrain=bpy.data.objects['upper_city_ground']
for x,y in ((312,660),(284,663),(335,661),(336,666),(310,638),(285,635),(310,650)):
 org=terrain.matrix_world.inverted()@Vector((x,y,113))
 direction=terrain.matrix_world.inverted().to_3x3()@Vector((0,0,-1))
 found,point,normal,face=terrain.ray_cast(org,direction,distance=3)
 z=(terrain.matrix_world@point).z if found else None
 checks.append(dict(category='charterFoundation',xy=(x,y),hit=found,z=z))
 if not found or abs(z-112)>.15:bad.append('new hall unsupported '+str((x,y)))
royal=bpy.data.objects['current_royal_masonry']
base=[royal.matrix_world@v.co for v in royal.data.vertices if abs((royal.matrix_world@v.co).z-204)<.03]
seen=set();support=0
for v in base:
 key=(round(v.x,1),round(v.y,1))
 if key in seen:continue
 seen.add(key)
 orig=terrain.matrix_world.inverted()@Vector((v.x,v.y,204.8))
 # actual castle upper rock top, not upper-city terrace
 castle=bpy.data.objects['castle_ground']
 origin=castle.matrix_world.inverted()@Vector((v.x,v.y,205))
 direct=castle.matrix_world.inverted().to_3x3()@Vector((0,0,-1))
 found,loc,n,f=castle.ray_cast(origin,direct,distance=3)
 if found and abs((castle.matrix_world@loc).z-204)<.3:support+=1
checks.append(dict(category='royalMasonryCastleGroundBase',total=len(seen),supported=support,unsupported=len(seen)-support))
road=json.loads((root/'architecture-repair-20261011.stage2-road-qa.json').read_text('utf8'))
if road['totalFailureRays']>14:bad.append('route support regression')
out=dict(status='LOCAL_PASS'if not bad else'FAIL',meshProblems=bad,checks=checks,roadsChecked=road['routesVisited'],remainingPreviousRouteFailures=road['totalFailureRays'],
limitations=['Visual morphology acceptance separate from local mesh QA','No player capsule or NPC/cart navigation','Not all remaining old wall stairs repaired'])
(root/'architecture-repair-20261011.live-qa.json').write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf8')
print('QA_RESULT',json.dumps(dict(status=out['status'],problems=bad,royalSupport=checks[-1],roofRates=[c for c in checks if c['category']=='roofFacadeConnection']),ensure_ascii=False),flush=True)
if bad:raise RuntimeError('Local geometry QA failed')
