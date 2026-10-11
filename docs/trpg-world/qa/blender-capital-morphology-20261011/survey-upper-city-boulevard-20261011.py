import json,pathlib
from shapely.geometry import Point,LineString,shape,box
from shapely.ops import unary_union
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current');q=json.loads((root/'parcels.json').read_text('utf8'))
polys=unary_union([shape(a['geometry'])for a in q['parcels']if a['district']=='upper_city'])
sites=[('hall','forum',(310,650),(-65,710)),('hall','mid',(310,650),(80,700)),('hall','eastern',(310,650),(385,695)),('forum','mid',(-65,710),(80,700)),('park','forum',(263,619),(-65,710))]
for a,b,c,d in sites:
 line=LineString((c,d))
 print('CORRIDOR',a,b,'m',round(line.length),'parcelConflictArea',round(polys.intersection(line.buffer(3)).area),'unbuffered',round(polys.intersection(line).length,1))
