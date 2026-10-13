"""Acceptance check for user-reported exact 12 sites, no citywide other-task work."""
import json,pathlib,math,bpy,bmesh,hashlib
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
m=json.loads((root/'user-p0-12-gaps-eastrock-b-20261012.study.json').read_text('utf8'))
base=(root/'plan.json').read_bytes()
assert m['sourcePlanSHA256']==hashlib.sha256(base).hexdigest()
P=json.loads((root/'user-p0-12-gaps-eastrock-b-20261012.staged.plan.json').read_text('utf8'))
OLD=json.loads(base)
assert P['routes']==OLD['routes'], 'Route registry changed'
old_mesh_names={ob['name']for ob in OLD['meshes']}
for item in OLD['meshes']:
 matching=next(q for q in P['meshes']if q['name']==item['name'])
 assert item==matching,('Original mesh was modified',item['name'])
positions={
'F01':(-654.298,1076.59,12.1),
'F02':(-784.298,756.89,42.2),
'F03':(-124.498,219.29,14.4),
'F04W01':(-127.198,914.99,113.4),
'F05':(353.602,960.79,156.1),
'F06':(424.202,1126.79,114.3),
'F07':(271.202,1239.89,114.3),
'F08':(405.302,1180.19,30.7),
'F09':(584.702,925.49,30.7),
'W01':(-127.198,914.99,113.4),
'W02':(552.002,878.49,75.1),
'W03':(355.702,1226.39,30.3),
'W04':(1175.8,492.69,30.3)}
floors=[];walls=[]
for f in m['floors']:
 if f['tag'] not in positions:continue
 name=f['meshName'];ob=bpy.data.objects[name]
 v=[ob.matrix_world@x.co for x in ob.data.vertices]
 bvh=BVHTree.FromPolygons(v,[list(q.vertices)for q in ob.data.polygons])
 x,y,z=positions[f['tag']]
 violations=[]
 for distance in (0,1.5,3.):
  for ang in range(8 if distance else 1):
   xx=x+distance*math.cos(ang*math.pi/4);yy=y+distance*math.sin(ang*math.pi/4)
   hit,n,idx,t=bvh.ray_cast(Vector((xx,yy,f['height']+6)),Vector((0,0,-1)),12)
   if hit is None or abs(hit.z-f['height'])>.03:
    violations.append((round(xx,2),round(yy,2)))
 floors.append(dict(site=f['tag'],grade=f['height'],pts=17,failed=violations,
                    sourceOverlapArea=f['actualOverlapNativeM2']))
for w in m['walls']:
 tag=w['tag'];x,y,z=positions[tag]
 ob=bpy.data.objects[w['meshNames'][0]]
 v=[ob.matrix_world@c.co for c in ob.data.vertices]
 bvh=BVHTree.FromPolygons(v,[list(q.vertices)for q in ob.data.polygons])
 q,n,idx,dist=bvh.find_nearest(Vector((x,y,z)),2.5)
 bm=bmesh.new();bm.from_mesh(ob.data)
 nm=sum(not e.is_manifold for e in bm.edges)
 bm.free()
 walls.append(dict(site=tag,distM=round(dist,3)if q else None,
                   solid=nm==0,insideVerticalExtent=min(k.z for k in v)<z<max(k.z for k in v)))
rock=bpy.data.objects['repair_user_p0_F05_east_rock_taper_B']
v=[rock.matrix_world@q.co for q in rock.data.vertices]
for label,z,name in [('high',155.9,'forecourt_ground'),
                      ('toe',110.4,'repair_royal_east_pocket_integrated_footbed_v9')]:
 ob=bpy.data.objects[name]
 ov=[ob.matrix_world@q.co for q in ob.data.vertices]
 tree=BVHTree.FromPolygons(ov,[list(q.vertices)for q in ob.data.polygons])
 chosen=[q for q in v if (q.x<343 and q.z>155 if label=='high' else q.x>421 and q.z>112)]
 distances=[]
 for q in chosen:
  hit,n,index,dist=tree.find_nearest(q,4)
  distances.append(dist if hit else None)
 print('ROCK_CONTACT',label,name,'near',sum(x is not None and x<.5 for x in distances),'total',len(chosen),
       'closest',min((x for x in distances if x is not None),default=None),flush=True)
 assert sum(x is not None and x<.5 for x in distances)>=4,(label,distances)
result={'status':'PASS' if all(not x['failed']for x in floors) and all(w['distM'] is not None and w['distM']<1.0 and w['solid'] and w['insideVerticalExtent']for w in walls)else'FAIL',
        'siteCount':12,'userGroundSites':9,'userWallSites':4,
        'floorResults':floors,'wallResults':walls,
        'sourceRoutesUnchanged':True,'sourceMeshesUnchanged':True,
        'limitations':['User cursor Z may represent viewpoint not grade; nearby tier sets ground altitude',
        'No game-engine physics or player capsule validation',
        'Visual inspection remains required']}
out=root/'user-p0-12-gaps-eastrock-b-exactsite-qa.json'
out.write_text(json.dumps(result,indent=2),encoding='utf8')
print('EXACT_SITE_ACCEPTANCE',result['status'],flush=True)
for a in floors:print('FLOOR',a,flush=True)
for a in walls:print('WALL',a,flush=True)
assert result['status']=='PASS'
