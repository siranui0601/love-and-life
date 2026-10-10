"""B106: final localized royal patrol obstruction and remove obsolete
box atop the palace roof. Add stone lookout shaft + steep slate crown.
Preserves B105 file and all semantic entity IDs.
"""
import json,pathlib,sys,math,shutil
src,out=map(pathlib.Path,sys.argv[1:3])
if out.exists():raise RuntimeError('Refuse overwrite B106')
p=json.loads((src/'plan.json').read_text(encoding='utf-8'))
d=json.loads((src/'parcels.json').read_text(encoding='utf-8'))
changed=[]
for m in p['meshes']:
 if m['name'].startswith('b101_eastern_royal_offices'):
  for v in m['vertices']:v[0]-=16.
  changed.append(m['name'])
if len(changed)!=7:raise RuntimeError('Expected 7 eastern office meshes, got '+str(len(changed)))
def tower(name,cx,cy,rad,z,h,roof):
 n=16
 v=[]
 for elev,r in [(z,rad),(z+h,rad),(z+h+1,rad+1)]:
  v.extend([[cx+math.cos(2*math.pi*i/n)*r,cy+math.sin(2*math.pi*i/n)*r,elev] for i in range(n)])
 faces=[[n*k+i,n*k+(i+1)%n,n*(k+1)+(i+1)%n,n*(k+1)+i] for k in range(2) for i in range(n)]
 p['meshes'].append(dict(name=name+'_shaft',vertices=v,faces=faces,material='royal_light_stone'))
 crown=v[n*2:]+[[cx,cy,z+h+roof]]
 p['meshes'].append(dict(name=name+'_roof',vertices=crown,faces=[[i,(i+1)%n,n]for i in range(n)],material='royal_roof_blue'))
tower('b106_royal_central_spire',291,1091,9,240,25,17)
report=dict(base=src.name,status='PROVISIONAL_3D_QA_PENDING',
            oldStructureToRemove='Castle central keep',
            officeShiftX=-16,officeMeshNames=changed,
            newMeshes=['b106_royal_central_spire_shaft','b106_royal_central_spire_roof'],
            geometryReason='Remove non-functional roof chimney, replace with castle tower; clear approach promenade')
p['castleRoofAndAccessB106']=report
out.mkdir()
for name,value in [('plan.json',p),('parcels.json',d),('castle-roof-and-access.json',report)]:
 (out/name).write_text(json.dumps(value,separators=(',',':')),encoding='utf-8')
print(json.dumps(dict(output=str(out),moved=len(changed),newMeshes=len(report['newMeshes']))))
