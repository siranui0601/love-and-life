"""Second pass for 14 first-hit anomalies: resolve layered floor and overhead surfaces.
Does not silently reclassify headroom hazards as safe paths.
"""
import bpy,json,math,pathlib,collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
plan=json.loads((root/'plan.json').read_text('utf8'))
fail=json.loads((root/'royal-east-integrated-v9.active-roadqa.json').read_text('utf8'))['failureExamples']
pattern=('_ground','_floor','_deck','_stair','_bridge','_road','paving','wall_gallery','_landing','_ramp','_treads','_walk','_lane','_contour')
routes={r['id']:r for r in plan['routes']}
routeMesh={r['id']for r in plan['routes']}
surf=[]
for ob in bpy.data.objects:
 if ob.type!='MESH' or not ob.data.polygons:continue
 n=ob.name.lower()
 if (ob.name in routeMesh or any(x in n for x in pattern) or n in ('current_east_escarpment_rock','current_east_escarpment_stone','current_west_court_escarpment_limestone','current_west_court_escarpment_masonry')) and not any(x in n for x in ('roof','_window','_rail','_parapet','_support','roofing','_bench')):
  surf.append(ob)
v=[];f=[];owner=[]
for ob in surf:
 base=len(v);v.extend([ob.matrix_world@x.co for x in ob.data.vertices])
 for q in ob.data.polygons:
  f.append([base+i for i in q.vertices]);owner.append(ob.name)
tree=BVHTree.FromPolygons(v,f)
output=[]
for q in fail:
 id=q['route'];x,y,z=q['x'],q['y'],q['z']
 # audit records each centreline sample BEFORE the narrow shoulder is added
 r=routes[id]
 seg=min(zip(r['points'],r['points'][1:]),key=lambda pair:
   (x-(pair[0][0]+pair[1][0])/2)**2+(y-(pair[0][1]+pair[1][1])/2)**2)
 aa,bb=seg;dx=bb[0]-aa[0];dy=bb[1]-aa[1];length=math.hypot(dx,dy)
 off=q['lateral'];xx=x-dy/length*off;yy=y+dx/length*off
 layers=[]
 current=Vector((xx,yy,z+2.4))
 for k in range(18):
  point,normal,idx,dist=tree.ray_cast(current,Vector((0,0,-1)),7)
  if point is None or point.z<z-1.5:break
  layers.append(dict(z=round(point.z,3),delta=round(point.z-z,3),
     source=owner[idx],normalZ=round(normal.z,2)))
  current=Vector((xx,yy,point.z-.035))
 supported=[layer for layer in layers if abs(layer['delta'])<=.55 and layer['normalZ']>-.4]
 above=[layer for layer in layers if .42<layer['delta']<1.8]
 output.append(dict(route=id,lateral=off,
   probe=[round(xx,2),round(yy,2),z],hasNearbyDeck=bool(supported),
   nearbySurface=supported[0]if supported else None,
   lowHeadroomCandidates=above,allLayers=layers))
summary=dict(originalFirstHitAnomalies=len(fail),
 multilayerSupportCount=sum(a['hasNearbyDeck']for a in output),
 noCloseSupportCount=sum(not a['hasNearbyDeck']for a in output),
 overheadCandidateRays=sum(bool(a['lowHeadroomCandidates'])for a in output),
 grouped={id:dict(failureRays=sum(a['route']==id for a in output),
   confirmedNearbySurface=sum(a['route']==id and a['hasNearbyDeck']for a in output),
   possibleLowHeadroom=sum(a['route']==id and bool(a['lowHeadroomCandidates'])for a in output))for id in sorted(set(a['route']for a in output))},
 notes=['First-hit floor misses can be due to an upper stair or contour surface, not a floor hole',
        'Overhead surface intersection is only a candidate physical blockage; verify thickness, side access and NPC capsule',
        'A route is not safe merely because a separate supporting surface exists at nominal height'])
path=root/'royal-v9-remaining14-layered-floor-audit.json'
path.write_text(json.dumps(dict(summary=summary,details=output),indent=2),encoding='utf8')
print('LAYER_AUDIT',json.dumps(summary),flush=True)
for row in output:print('ROW',row['route'],row['probe'],row['lateral'],'floor',row['nearbySurface'],'overhead',row['lowHeadroomCandidates'][:3],flush=True)
