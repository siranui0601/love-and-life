import pathlib,json,math
from shapely.geometry import Polygon,shape,Point
from shapely.ops import unary_union
r=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((r/'plan.json').read_text('utf8'))
meshes={m['name']:m for m in p['meshes']}
for dom in p['landDomains']:
 id=dom['id'];mn={'restored_mage_bank_lowland':'mage_quarter_restored_low_ground'}.get(id,id+'_ground')
 if mn not in meshes:continue
 m=meshes[mn];v=m['vertices'];valid=[]
 for face in m['faces']:
  xy=[(v[i][0],v[i][1])for i in face]
  if len(set(xy))<3:continue
  g=Polygon(xy)
  if g.is_valid and g.area>.001:valid.append(g)
 a=unary_union(valid);zone=shape(dom['geometry']);gap=zone.difference(a.buffer(.16))
 polys=[gap]if gap.geom_type=='Polygon'else [x for x in getattr(gap,'geoms',[])if x.geom_type=='Polygon']
 polys=sorted((x for x in polys if x.area>4),key=lambda x:-x.area)
 print('ZONE',id,'ground',mn,'domainArea',round(zone.area),'groundArea',round(a.area),'missing',round(gap.area),'gaps>4',len(polys))
 for g in polys[:9]:print(' GAP',round(g.area,1),'center',tuple(round(z,1)for z in g.centroid.coords[0]),'bounds',tuple(round(z,1)for z in g.bounds),'interior?',g.within(zone.buffer(-4)))
