"""B113 main Mage Tower: real cut-out doors, interior audience hall and
ceremonial access. Mesh boolean runs during Blender build, not as a fake
painted door. Retains B112 for rollback.
"""
import json,sys,pathlib,math,shutil
src,out=map(pathlib.Path,sys.argv[1:3])
if out.exists():raise RuntimeError('Refuse B113 overwrite')
p=json.loads((src/'plan.json').read_text(encoding='utf8'))
d=json.loads((src/'parcels.json').read_text(encoding='utf8'))
new=[]
def deck(name,points,width):
 vs=[];fs=[]
 for a,b in zip(points,points[1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
  if L<.02:continue
  nx=-dy/L*width/2;ny=dx/L*width/2
  k=len(vs)
  vs.extend([[a[0]-nx,a[1]-ny,70.14],[b[0]-nx,b[1]-ny,70.14],
             [b[0]+nx,b[1]+ny,70.14],[a[0]+nx,a[1]+ny,70.14]])
  fs.append([k,k+1,k+2,k+3])
 m='b113_'+name
 p['meshes'].append(dict(name=m,vertices=vs,faces=fs,material='court_approach_paving'))
 new.append(m)
 routes=dict(id=name,points=points,width=width,kind='life',z0=70,z1=70,
    lengthM=sum(math.dist(a[:2],b[:2])for a,b in zip(points,points[1:])),grade=0)
 p['routes'].append(routes)
 return routes
outer=deck('court_mage_tower_southern_entry_road',
 [[1084,572,70],[1080,591,70],[1078,603,70],[1067,613,70],[1050,626,70]],5)
inner=deck('court_mage_tower_interdomestic_audience_hall',
 [[1050,626,70],[1050,642,70],[1050,650,70]],4.5)
east=deck('court_mage_tower_archive_gallery',
 [[1050,650,70],[1065,651,70],[1076,651,70]],4)
p['audit']['routeCount']=len(p['routes'])
report=dict(status='BLENDER_BOOLEAN_AND_EYEVIEW_QA_REQUIRED',base=src.name,
 targetSceneObject='Proposed mage tower',centralOfficialId='LOC_CAP_MAGE_TOWER',
 threeAccessRoutes=[outer['id'],inner['id'],east['id']],
 entryFaceApprox=[1050,626,70],cutoutVoids=[
 dict(id='south_portal',center=[1050,635,78],dims=[8.5,22,20]),
 dict(id='audience_hall',center=[1050,650,80],dims=[20,22,24]),
 dict(id='archive_link',center=[1063.5,651,76],dims=[28,8,16])],
 newMeshes=new,
 limitations=['No fully furnished room or stairs to higher levels',
              'Boolean success and walkability must be verified in saved .blend',
              'No game-engine entrance/portal state or NPC interaction',
              'Other city safety problems remain'])
p['towerEntranceB113']=report
out.mkdir()
for n,v in [('plan.json',p),('parcels.json',d),('tower-entrance.json',report)]:
 (out/n).write_text(json.dumps(v,separators=(',',':')),encoding='utf8')
print(json.dumps(dict(out=str(out),routes=len(report['threeAccessRoutes']))))
