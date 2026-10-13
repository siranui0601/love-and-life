"""B114: consolidate micro-stair decks into continuous, physical stone
step/stairway meshes. No approved long-ramp changes or canonical edits.
"""
import pathlib,json,sys,math,shutil
src,out=map(pathlib.Path,sys.argv[1:3])
if out.exists():raise RuntimeError('Refuse existing B114')
p=json.loads((src/'plan.json').read_text(encoding='utf8'))
d=json.loads((src/'parcels.json').read_text(encoding='utf8'))
micro=[m['name']for m in p['meshes']if m['name'].startswith('distributed_access_noble_east_wall_stair_deck_')]
west=['west_noble_wall_stairs','west_noble_wall_stairs_treads']
old={m['name']for m in p['meshes']}
if len(micro)!=230 or not set(west).issubset(old):raise RuntimeError('Unknown stair source')
removed=set(micro+west)
p['meshes']=[m for m in p['meshes']if m['name']not in removed]
built=[];report=[]
def assembly(id):
 route=next(r for r in p['routes']if r['id']==id)
 vs=[];fs=[];rs=[];rz=[]
 N=len(route['points'])-1
 for index,(a,b)in enumerate(zip(route['points'],route['points'][1:])):
  dx=b[0]-a[0];dy=b[1]-a[1];ll=math.hypot(dx,dy)
  if ll<.001:continue
  nx=-dy/ll;ny=dx/ll;half=route['width']/2+.20
  z=b[2]+.095 if b[2]>a[2]+.001 else a[2]+.095
  # Unified stone stair tread and its sturdy abutment (not floating quads).
  # True flat upper face and riser (riser ~0.16m on rising segments).
  k=len(vs)
  xy=[(a[0]+nx*half,a[1]+ny*half),
      (b[0]+nx*half,b[1]+ny*half),
      (b[0]-nx*half,b[1]-ny*half),
      (a[0]-nx*half,a[1]-ny*half)]
  vs.extend([[x,y,z-1.35]for x,y in xy]+[[x,y,z]for x,y in xy])
  fs.extend([[k+i for i in f]for f in [
    [0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]])
  rs.append(z);rz.append(b[2]-a[2])
 name='b114_'+id+'_unified_structural_stone_stair'
 p['meshes'].append(dict(name=name,vertices=vs,faces=fs,material='stairs'))
 built.append(name)
 report.append(dict(route=id,segmentCount=len(fs)//6,treadFaces=len(fs),
         meshVertices=len(vs),zTopRange=[min(rs),max(rs)],
         maxRiserM=max(rz),separateLegacyObjectsRemoved=len(micro)if id=='noble_east_wall_stair'else 2))
assembly('noble_east_wall_stair')
assembly('west_noble_wall_stairs')
p['integratedNobleStairsB114']=dict(status='WIP_LOCAL_QA_PENDING',base=src.name,
 discardedMeshes=micro+west,unifiedMeshes=built,stairs=report,
 caveats=['Existing western support and landing mesh preserved',
 'B114 stone slabs are temporary world-block geometry until full architectural fit',
 'Continuous capsule traversal, all city support and rail-guard QA still required'])
out.mkdir()
for name,value in [('plan.json',p),('parcels.json',d),('noble-stair-reconstruction.json',p['integratedNobleStairsB114'])]:
 (out/name).write_text(json.dumps(value,separators=(',',':')),encoding='utf8')
print(json.dumps(dict(output=str(out),removedMicro=len(micro),
 newUnifiedObjects=len(built),segments=sum(x['segmentCount']for x in report))))
