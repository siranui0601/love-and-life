"""Measure actual discovery sightlines; visibility counts are not visual acceptance."""
import bpy,json,pathlib,sys,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=pathlib.Path(sys.argv[sys.argv.index('--')+1]);plan=json.loads((out/'plan.json').read_text())
for collection in bpy.data.collections:collection.hide_viewport=False
bpy.context.view_layer.update()
vs=[];fs=[];owners=[]
for ob in bpy.context.scene.objects:
 if ob.type!='MESH' or any(c.name=='Parcel footprints'for c in ob.users_collection):continue
 start=len(vs);vs.extend([ob.matrix_world@v.co for v in ob.data.vertices])
 for f in ob.data.polygons:fs.append([start+i for i in f.vertices]);owners.append(ob.name)
tree=BVHTree.FromPolygons(vs,fs)
water=bpy.data.objects['river_16m_channel'];targets={}
# Triangle centroids lie inside actual water, unlike a guessed blue line.
for face in water.data.polygons:
 point=water.matrix_world@(sum((water.data.vertices[i].co for i in face.vertices),Vector())/len(face.vertices))
 targets.setdefault((round(point.x/50),round(point.y/50)),list(point))
river=list(targets.values());results=[]
def landmark(name):
 ob=bpy.data.objects[name]
 return list(ob.matrix_world@(sum((v.co for v in ob.data.vertices),Vector())/len(ob.data.vertices)))
castle=landmark('Castle highest tower_roof');mage=landmark('Proposed mage tower_roof')
def probe(eye,target,accepted=()):
 direction=Vector(target)-Vector(eye);distance=direction.length
 hit,normal,index,d=tree.ray_cast(Vector(eye),direction.normalized(),distance+.05)
 owner=None if index is None else owners[index]
 return {'visible':hit is None or d>=distance-.1 or owner in accepted,'firstObstacle':owner,'distanceM':distance}
for site in plan.get('discoverySitesStudy',{}).get('destinations',[]):
 if site['id']not in ['garden_watchtower','mage_river_watchtower']:continue
 x,y,z=site['position'];eye=[x+5,y-6.5,z+site['heightM']+1.86] if site['id']=='mage_river_watchtower' else [x,y-6,z+site['heightM']+1.86]
 observations=[dict(target=p,**probe(eye,p,('river_16m_channel',)))for p in river]
 visible=[p for p in observations if p['visible']]
 results.append({'site':site['id'],'eye':eye,'riverSamples':len(observations),'visibleRiverSamples':len(visible),'visibleRiverTargets':[p['target']for p in visible[:20]],'market':probe(eye,[0,-50,14.3]),'castle':dict(target=castle,**probe(eye,castle,('Castle highest tower','Castle highest tower_roof'))), 'mageTower':dict(target=mage,**probe(eye,mage,('Proposed mage tower','Proposed mage tower_roof'))),'riverBlockers':sorted(set(p['firstObstacle']for p in observations if not p['visible']and p['firstObstacle']))[:20]})
report={'status':'MEASURED_NOT_ACCEPTED','sites':results,'limitations':'Point rays from real deck eye height; no field-of-view, silhouette quality, player controller or whole-landmark visibility certification.'}
(out/'discovery-vista-audit.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
