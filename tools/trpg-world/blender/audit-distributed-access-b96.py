"""B95 localized mesh verification, limited probes; not a controller certification."""
import bpy,json,pathlib,sys,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
p=json.loads((out/'plan.json').read_text())
for c in bpy.data.collections:c.hide_viewport=False
bpy.context.view_layer.update()
groups=['Terrain','Retaining','Optional parcel massing - UNACCEPTED',
    'North garden landscape proposal','Life streets','Primary','Stairs',
    'East service block B76 - proposal','Wall gallery proposal','Mage wall quarter',
    'Western short ascents','Distributed Noble Access B96']
verts=[];faces=[];owner=[]
for name in groups:
 c=bpy.data.collections.get(name)
 if not c:continue
 for ob in c.objects:
    if ob.type!='MESH' or not ob.data.polygons:continue
    ofs=len(verts)
    verts.extend([ob.matrix_world@v.co for v in ob.data.vertices])
    for face in ob.data.polygons:
        faces.append([ofs+i for i in face.vertices])
        owner.append(ob.name)
tree=BVHTree.FromPolygons(verts,faces)
ids={'noble_east_winch_incline','noble_east_wall_stair'}
hits=[];floor=[];probes=0;floorcount=0
for r in p['routes']:
 if r['id'] not in ids:continue
 for a,b in zip(r['points'],r['points'][1:]):
    dx=b[0]-a[0];dy=b[1]-a[1];length=math.hypot(dx,dy)
    if length<1e-5:continue
    for offset in (-r['width']/2+.6,0,r['width']/2-.6):
        x=a[0]-dy/length*offset;y=a[1]+dx/length*offset
        ex=b[0]-dy/length*offset;ey=b[1]+dx/length*offset
        for h in (1.2,1.9):
            start=Vector((x,y,a[2]+h));end=Vector((ex,ey,b[2]+h))
            vec=end-start;hit,n,idx,dist=tree.ray_cast(start,vec.normalized(),vec.length)
            probes+=1
            if hit is not None and .002<dist<vec.length-.002:
                hits.append(dict(route=r['id'],obstacle=owner[idx],at=list(hit),height=h))
        hit,n,idx,dist=tree.ray_cast(Vector((x,y,a[2]+.8)),Vector((0,0,-1)),1.6)
        floorcount+=1
        if hit is None or abs(hit.z-a[2])>.45:
            floor.append(dict(route=r['id'],at=[x,y,a[2]],support=list(hit) if hit else None,
              object=owner[idx] if hit else None))
result=dict(status='LOCAL_PASS' if not hits and not floor else 'FAIL',
    routeIds=sorted(ids),bodyHeadProbeCount=probes,blockedProbeCount=len(hits),
    floorSamples=floorcount,unsupportedSamples=len(floor),
    hits=hits[:30],floorFailures=floor[:30],
    limitations=['Discrete ray probe only; no swept capsule','Not a goods-cart clearance test',
                 'Requires visual and guided-walking inspection in the game runtime'])
(out/'distributed-mesh-audit.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
