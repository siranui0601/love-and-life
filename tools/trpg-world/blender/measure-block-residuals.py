"""Report unassigned block interiors without disguising them as designed refuges."""
import json,pathlib,sys
from shapely.geometry import shape
from shapely.ops import unary_union,polylabel
src=pathlib.Path(sys.argv[1]);data=json.loads((src/'parcels.json').read_text(encoding='utf-8'))
def parts(g):
 if g.is_empty:return []
 if g.geom_type=='Polygon':return [g]
 return [p for q in getattr(g,'geoms',[])for p in parts(q)]
by_block={b['id']:[]for b in data['blocks']}
canonical=[shape(p['geometry'])for p in data['parcels']if p.get('canonicalFacilityId')]
for p in data['parcels']:
 if not p.get('canonicalFacilityId'):by_block[p['blockId']].append(shape(p['geometry']))
plan=json.loads((src/'plan.json').read_text());programs=plan.get('programmedSpacesStudy',[])
large=[];area=0
for b in data['blocks']:
 if b['heightM']not in [14,42,70] or not by_block[b['id']]:continue
 residual=shape(b['geometry']).difference(unary_union(by_block[b['id']]+canonical+[shape(q['geometry'])for q in programs if q['heightM']==b['heightM']]))
 for p in parts(residual):
  area+=p.area
  if p.area<=700:continue
  center=polylabel(p,tolerance=1);radius=center.distance(p.boundary)
  if radius>=13:large.append(dict(blockId=b['id'],areaM2=round(p.area,2),radiusM=round(radius,2),center=[center.x,center.y,b['heightM']]))
report=dict(status='UNASSIGNED_SPACE_INVENTORY',largeVoidCount=len(large),largeVoidAreaM2=round(sum(p['areaM2']for p in large),2),totalResidualAreaM2=round(area,2),largest=sorted(large,key=lambda p:p['areaM2'],reverse=True),programmedSpaceCount=len(programs),programmedSpacesAreAccepted=False,scope='Residential domains 14/42/70m, excluding canonical plots; not all open space is unwanted')
(src/'residual-inventory.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items()if k!='largest'}))
