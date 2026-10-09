"""Local real-mesh body/head rays and floor support, not controller certification."""
import bpy,json,pathlib,sys,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=pathlib.Path(sys.argv[sys.argv.index('--')+1]);p=json.loads((out/'plan.json').read_text())
for c in bpy.data.collections:c.hide_viewport=False
bpy.context.view_layer.update()
groups=['Terrain','Retaining','Optional parcel massing - UNACCEPTED','North garden landscape proposal','Life streets','Primary','Stairs','East service block B76 - proposal','Wall gallery proposal','Mage wall quarter']
vertices=[];faces=[];owners=[]
for name in groups:
    c=bpy.data.collections.get(name)
    if not c:continue
    for ob in c.objects:
        if ob.type!='MESH':continue
        k=len(vertices);vertices.extend([ob.matrix_world@v.co for v in ob.data.vertices])
        for f in ob.data.polygons:faces.append([k+i for i in f.vertices]);owners.append(ob.name)
tree=BVHTree.FromPolygons(vertices,faces)
hits=[];floors=[];probes=0;floor_count=0;routes=set()
for r in p['routes']:
    for a,b in zip(r['points'],r['points'][1:]):
        if not ((720<=a[0]<=1520 and 120<=a[1]<=1050)or(530<=a[0]<=720 and 580<=a[1]<=1020)or(140<=a[0]<=375 and 1200<=a[1]<=1300)or(1240<=a[0]<=1470 and -55<=a[1]<=80)or r['id'] in ['market_ascent','noble_service','mage_civic_ramp']):continue
        dx=b[0]-a[0];dy=b[1]-a[1];length=math.hypot(dx,dy)
        if length<1e-5:continue
        routes.add(r['id'])
        for offset in [-r['width']/2+.4,0,r['width']/2-.4]:
            x=a[0]-dy/length*offset;y=a[1]+dx/length*offset
            for h in [1.2,1.9]:
                start=Vector((x,y,a[2]+h));end=Vector((b[0]-dy/length*offset,b[1]+dx/length*offset,b[2]+h));v=end-start
                hit,normal,idx,d=tree.ray_cast(start,v.normalized(),v.length);probes+=1
                if hit is not None and .001<d<v.length-.001:hits.append(dict(route=r['id'],obstacle=owners[idx],at=list(hit),height=h))
            hit,normal,idx,d=tree.ray_cast(Vector((x,y,a[2]+.8)),Vector((0,0,-1)),1.5);floor_count+=1
            if hit is None or abs(hit.z-a[2])>.45:floors.append(dict(route=r['id'],at=[x,y,a[2]],support=list(hit) if hit else None))
report=dict(status='LOCAL_PROBE_PASS' if not hits and not floors else 'FAIL',routeCount=len(routes),bodyHeadProbeCount=probes,blockedProbeCount=len(hits),floorSamples=floor_count,unsupportedSamples=len(floors),hits=hits[:150],floorFailures=floors[:150],routes=sorted(routes),limitations=['Finite torso/head rays and sampled support only','No swept capsule, cart turning envelope or manual player traversal','No distant vista, NPC or event validation'])
(out/'mage-quarter-mesh-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
