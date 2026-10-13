"""B111 regression: canonical IDs, all 1185 base roads, parcel plan integrity,
facilities, and new above-ground object setbacks from public roads.
"""
import json,sys,pathlib,math,collections
from shapely.geometry import Polygon,LineString,shape,Point
from shapely.ops import unary_union
base,out=map(pathlib.Path,sys.argv[1:3])
p=json.loads((out/'plan.json').read_text());oldp=json.loads((base/'plan.json').read_text())
d=json.loads((out/'parcels.json').read_text());oldd=json.loads((base/'parcels.json').read_text())
canon=lambda a:set((q['id'],q['canonicalFacilityId'])for q in a['parcels']if q.get('canonicalFacilityId'))
route=lambda a:{q['id']:q for q in a['routes']}
a,b=route(oldp),route(p)
oldRoadsOk=len(a)==len(b)and set(a)==set(b)and all(a[k]==b[k]for k in a)
canonOk=canon(d)==canon(oldd)
builds=[m for m in p['meshes']if m['name'].startswith('b111_')and not 'square' in m['name']]
conflicts=[];checks=0
for r in p['routes']:
 if r['z0']!=14 or r['z1']!=14:continue
 ln=LineString([v[:2]for v in r['points']])
 for m in builds:
  pts=m['vertices']
  if not pts or max(v[0]for v in pts)<ln.bounds[0]-3 or min(v[0]for v in pts)>ln.bounds[2]+3:continue
  if max(v[1]for v in pts)<ln.bounds[1]-3 or min(v[1]for v in pts)>ln.bounds[3]+3:continue
  g=Polygon([v[:2] for v in pts[:4]])
  if not g.is_valid:continue
  checks+=1
  overlap=g.intersection(ln.buffer(r['width']/2+1))
  if overlap.area>.3:conflicts.append((r['id'],m['name'],round(overlap.area,1)))
meta=p['southernCityB111']
r=dict(passCore=bool(oldRoadsOk and canonOk and not conflicts),
 base=base.name,new=out.name,canonicalIdsPreserved=canonOk,canonicalCount=len(canon(d)),
 routeCountPreserved=oldRoadsOk,routeCount=len(b),removedPlots=meta['removedOrdinaryPlots'],
 scopedNewMeshes=len(meta['addedMeshes']),buildingRoadTested=checks,
 buildingRoadConflicts=conflicts[:50],conflictCount=len(conflicts),
 plazaAreas=[(x['id'],x['pavedSqM'])for x in meta['areas']],
 limitations=['Approximate footprints only','No existing building or player capsule collisions',
 'No pedestrian route through interiors, NPCs, quests or economy implementation',
 'Must inspect screenshots for repetitive props and inauthentic world texture'])
(out/'southern-place-qa.json').write_text(json.dumps(r,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in r.items()if k not in ('buildingRoadConflicts','limitations','plazaAreas')}))

