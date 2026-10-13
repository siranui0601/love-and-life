"""Integration acceptance for subdivision: preserve authored sites and shared routes."""
import json,pathlib,sys,math
from shapely.geometry import shape,LineString,Point
from shapely.ops import unary_union
before=pathlib.Path(sys.argv[1]);after=pathlib.Path(sys.argv[2])
a=json.loads((before/'plan.json').read_text(encoding='utf-8'));b=json.loads((after/'plan.json').read_text(encoding='utf-8'))
p=json.loads((before/'parcels.json').read_text(encoding='utf-8'));q=json.loads((after/'parcels.json').read_text(encoding='utf-8'))
old={r['id']:r for r in a['routes']};new={r['id']:r for r in b['routes']};errors=[]
if len(new)!=len(b['routes']):errors.append('Duplicate route IDs')
for key,value in old.items():
 if new.get(key)!=value:errors.append('Existing route changed: '+key)
protected=unary_union([shape(g)for g in a['negativeSpaces']]+[shape(f['geometry'])for f in p['parcels']if f.get('canonicalFacilityId')])
for key,r in new.items():
 if key in old:continue
 path=LineString([v[:2]for v in r['points']]);corridor=path.buffer(r['width']/2,cap_style=2,join_style=2)
 if corridor.intersection(protected).area>.01:errors.append('Authored space invaded: '+key)
 for point,target in zip([r['points'][0],r['points'][-1]],r['endStreetIds']):
  street=new[target];line=LineString([v[:2]for v in street['points']])
  if Point(point[:2]).distance(line)>.01 or abs(street['z0']-point[2])>.01:errors.append('Endpoint not on same-level street: '+key)
 if abs(r['lengthM']-path.length)>.05:errors.append('Incorrect route length: '+key)
for f in [f for f in p['parcels']if f.get('canonicalFacilityId')]:
 other=next((v for v in q['parcels']if v.get('canonicalFacilityId')==f['canonicalFacilityId']),None)
 if other is None or any(other[k]!=f[k]for k in ['geometry','footprints','door','frontageRouteId']):errors.append('Canonical site changed: '+f['id'])
for site in b['facilityStudy']['facilities']:
 if site['id']=='LOC_CAP_ORPHANAGE'and site['plot']!=site['stateAlternative']['plot']:errors.append('T10 plot mismatch')
ids={v['id']for v in q['blocks']}
if any(v['blockId']not in ids for v in q['parcels']):errors.append('Parcel parent missing')
result=dict(status='FAIL'if errors else 'PASS',addedRoutes=len(new)-len(old),preservedRoutes=len(old),errors=errors,limitations='Geometry/semantic regression only; not visual approval or gameplay certification')
(after/'block-repair-regression.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));sys.exit(bool(errors))
