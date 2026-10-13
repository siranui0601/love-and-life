import json, pathlib, math, collections
from shapely.geometry import Polygon,LineString,Point,shape
from shapely.ops import unary_union
base=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((base/'plan.json').read_text(encoding='utf8'))
zones={a['id']:shape(a['geometry'])for a in p['landDomains']}
def ground_info(name,domain_id=None):
 m=next(x for x in p['meshes']if x['name']==name)
 v=m['vertices'];poly=[]
 for face in m['faces']:
  xy=[(v[i][0],v[i][1])for i in face]
  if len(set(xy))<3:continue
  g=Polygon(xy)
  if g.is_valid and g.area>1e-4:poly.append(g)
 geom=unary_union(poly)
 info={'mesh':name,'polyFaces':len(poly),'areaM2':round(geom.area,1),'boundaryM':round(geom.boundary.length,1),
 'holes':len(geom.interiors)if geom.geom_type=='Polygon'else None,'parts':len(geom.geoms)if hasattr(geom,'geoms')else 1,
 'bbox':[round(v)for v in geom.bounds]}
 if domain_id:
  dom=zones[domain_id];gap=dom.difference(geom.buffer(.35))
  segments=[gap]if gap.geom_type=='Polygon'else [x for x in getattr(gap,'geoms',[])if x.geom_type=='Polygon']
  segments=sorted(segments,key=lambda x:-x.area)
  info.update(dict(domainArea=round(dom.area,1),missingSqM=round(gap.area,1),
   missingLarge=[{'area':round(g.area,1),'bounds':[round(n)for n in g.bounds],'centroid':[round(g.centroid.x),round(g.centroid.y)]}for g in segments[:20]]))
 return info,geom
targets=[('upper_city_ground','upper_city'),('western_ascent_market_ascent_restored_ground',None),('western_ascent_noble_service_restored_civic_ground',None)]
ret=[]
for n,dom in targets:
 try:
  stats,_=ground_info(n,dom);ret.append(stats)
 except Exception as e:ret.append({'mesh':n,'error':str(e)})
for name in ('west_noble_wall_stairs_support','west_lower_wall_stairs_support','civic_royal_ramp_terrace_support'):
 m=next(x for x in p['meshes']if x['name']==name);v=m['vertices']
 q=collections.Counter(len(set(round(v[j][2],2)for j in f))for f in m['faces'])
 ret.append(dict(mesh=name,faces=len(m['faces']),zFaceVariety=dict(q)))
(base/'ground-gap-audit.json').write_text(json.dumps(ret,indent=2,ensure_ascii=False),encoding='utf8')
print(json.dumps(ret,indent=2,ensure_ascii=False)[:15500])
