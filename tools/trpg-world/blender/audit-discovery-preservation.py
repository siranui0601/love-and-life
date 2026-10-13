"""Protect canonical plots, T10 reuse and baseline streets during discoveries."""
import json,pathlib,sys
from shapely.geometry import LineString
src,out=map(pathlib.Path,sys.argv[1:3]);a=json.loads((src/'plan.json').read_text());b=json.loads((out/'plan.json').read_text());pa=json.loads((src/'parcels.json').read_text());pb=json.loads((out/'parcels.json').read_text());fail=[]
old={p['canonicalFacilityId']:p for p in pa['parcels']if p.get('canonicalFacilityId')};new={p['canonicalFacilityId']:p for p in pb['parcels']if p.get('canonicalFacilityId')}
for fid,p in old.items():
 q=new.get(fid)
 if q is None:fail.append({'facility':fid,'issue':'missing'})
 elif any(p.get(key)!=q.get(key)for key in ['geometry','footprints','door','groundM','heightM','T10Reuse']):fail.append({'facility':fid,'issue':'canonical physical site changed'})
if a.get('facilityStudy')!=b.get('facilityStudy'):fail.append({'issue':'canonical event/site metadata changed'})
br={r['id']:r for r in b['routes']}
for r in a['routes']:
 q=br.get(r['id'])
 if q is None or any(q.get(k)!=r.get(k)for k in['points','width','kind','bridgeId','floodClosed']):fail.append({'route':r['id'],'issue':'baseline route changed'})
for r in b['routes']:
 if r['id'].startswith('garden_watchtower_flight_')and not LineString([p[:2]for p in r['points']]).is_simple:fail.append({'route':r['id'],'issue':'ambiguous stacked flight'})
if len(br)!=len(b['routes']):fail.append({'issue':'duplicate route IDs'})
result={'status':'FAIL'if fail else'PRESERVATION_PASS','canonicalPlotsChecked':list(old),'baselineRoutesChecked':len(a['routes']),'routeCount':len(b['routes']),'failures':fail,'limitations':'Preservation only; does not certify discovery value, NPC schedules or transport gameplay.'}
(out/'discovery-preservation-audit.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));sys.exit(bool(fail))
