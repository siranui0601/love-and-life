import pathlib,json,math
from shapely.geometry import Polygon,LineString,shape
from shapely.ops import unary_union
r=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current');p=json.loads((r/'plan.json').read_text('utf8'))
ms={m['name']:m for m in p['meshes']}
for dom in p['landDomains']:
 id=dom['id']
 if id not in ('low_city','civic_foot','mage_east','noble_west','castle'):continue
 m=ms[id+'_ground'];v=m['vertices'];tiles=[]
 for f in m['faces']:
  poly=Polygon([(v[i][0],v[i][1]) for i in f])
  if poly.is_valid and poly.area>.001:tiles.append(poly)
 gap=shape(dom['geometry']).difference(unary_union(tiles).buffer(.16))
 gs=[gap] if gap.geom_type=='Polygon' else [a for a in getattr(gap,'geoms',[]) if a.geom_type=='Polygon']
 for g in sorted(gs,key=lambda x:-x.area):
  if g.area<150:continue
  print('GAP',id,'area',round(g.area),'center',tuple(round(q,1)for q in g.centroid.coords[0]))
  intersects=[]
  for road in p['routes']:
   pts=road.get('points',[])
   if len(pts)<2:continue
   line=LineString([(z[0],z[1])for z in pts])
   length=g.intersection(line).length
   if length>1:intersects.append((round(length),road['id'],road['z0'],road['z1'],road.get('kind')))
  for z in sorted(intersects,reverse=True)[:20]:print(' ROUTE',z)
