"""B98 area-localized real-mesh body/head/floor probes.
This is not an end-to-end player movement or event test.
"""
import bpy,json,pathlib,sys,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
p=json.loads((out/'plan.json').read_text())
rpt=p['discoveryDistrictsB99']
for coll in bpy.data.collections:coll.hide_viewport=False
bpy.context.view_layer.update()
collnames=['Terrain','Retaining','Optional parcel massing - UNACCEPTED',
  'North garden landscape proposal','Life streets','Primary','Stairs',
  'East service block B76 - proposal','Wall gallery proposal','Mage wall quarter',
  'Western short ascents','Distributed Noble Access B96',
  'B99 Discoverable civic spaces']
verts=[];faces=[];owners=[]
for name in collnames:
    coll=bpy.data.collections.get(name)
    if coll is None:continue
    for ob in coll.objects:
        if ob.type!='MESH' or not ob.data.polygons:continue
        i=len(verts);verts.extend([ob.matrix_world@v.co for v in ob.data.vertices])
        for f in ob.data.polygons:faces.append([i+j for j in f.vertices]);owners.append(ob.name)
tree=BVHTree.FromPolygons(verts,faces)
hits=[];floors=[];probes=0;floorcount=0
for route in rpt['newRoutes']:
    for a,b in zip(route['points'],route['points'][1:]):
        dx=b[0]-a[0];dy=b[1]-a[1];ln=math.hypot(dx,dy)
        if ln<1e-5:continue
        ux,uy=dx/ln,dy/ln;nx,ny=-uy,ux
        n=max(1,math.ceil(ln/1.3))
        for i in range(n):
            t=i/n;t1=(i+1)/n
            for offset in (-route['width']/2+.55,0,route['width']/2-.55):
                x=a[0]+dx*t+nx*offset;y=a[1]+dy*t+ny*offset
                xx=a[0]+dx*t1+nx*offset;yy=a[1]+dy*t1+ny*offset
                for h in (1.2,1.9):
                    st=Vector((x,y,14+h));en=Vector((xx,yy,14+h))
                    v=en-st
                    hit,normal,idx,dist=tree.ray_cast(st,v.normalized(),v.length)
                    probes+=1
                    if hit is not None and .005<dist<v.length-.005:
                        hits.append(dict(route=route['id'],object=owners[idx],at=list(hit),height=h))
                hit,normal,idx,dist=tree.ray_cast(Vector((x,y,14+.8)),Vector((0,0,-1)),1.5)
                floorcount+=1
                if hit is None or abs(hit.z-14)>.45:
                    floors.append(dict(route=route['id'],at=[x,y,14],
                        support=list(hit)if hit else None,object=owners[idx]if hit else None))
report=dict(status='LOCAL_PASS' if not hits and not floors else 'FAIL',
    bodyHeadProbeCount=probes,blockedProbeCount=len(hits),floorSamples=floorcount,
    unsupportedSamples=len(floors),routeCount=len(rpt['newRoutes']),
    hits=hits[:40],floorFailures=floors[:40],
    limitations=['Discrete sampling, not swept capsule','Canopy posts and crowd placement are visual only',
     'No manual player walk or real NPC traffic','Older B96 noble stair and cargo floor failures remain'])
(out/'discovery-mesh-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items()if k in ['status','routeCount','bodyHeadProbeCount','blockedProbeCount','floorSamples','unsupportedSamples']}))
