import json, pathlib
from shapely.geometry import box, shape
from shapely.strtree import STRtree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
parcels=json.loads((root/'parcels.json').read_text(encoding='utf8'))['parcels']
polygons=[shape(p['geometry']) for p in parcels]
index=STRtree(polygons)
for x in [-470,-450,-430,-410,-390,-370,-350,-335,-329,-320,-310,-300]:
    corridor=box(x-5,152,x+5,200)
    hits=[]
    for v in index.query(corridor):
        k=int(v)
        area=polygons[k].intersection(corridor).area
        if area<0.05: continue
        details={name: str(val)[:90] for name,val in parcels[k].items() if name!='geometry'}
        hits.append((round(area,1),k,details))
    hits.sort(reverse=True)
    print('STATION',x,'OVERLAP_M2',round(sum(a for a,_,_ in hits),1),'COUNT',len(hits))
    for item in hits[:5]: print('PARCEL',item)
