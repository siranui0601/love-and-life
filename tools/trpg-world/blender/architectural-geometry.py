"""Footprint-constrained roof planes and access surfaces; no runtime canon edits."""
import math
from shapely.geometry import Polygon, LineString, Point, mapping
from shapely.ops import split, unary_union, polylabel
from shapely import constrained_delaunay_triangles

def polygons(g):
    if g.is_empty: return []
    if g.geom_type == 'Polygon': return [g]
    return [p for part in getattr(g, 'geoms', []) for p in polygons(part)]

def pitched_roof(footprint, eaves, district):
    rectangle = list(footprint.minimum_rotated_rectangle.exterior.coords)
    a, b = max(zip(rectangle, rectangle[1:]), key=lambda ab: math.dist(*ab))
    length = math.dist(a, b)
    ux, uy = (b[0]-a[0])/length, (b[1]-a[1])/length
    nx, ny = -uy, ux
    center = footprint.minimum_rotated_rectangle.centroid
    half = max(abs((x-center.x)*nx+(y-center.y)*ny) for x,y in rectangle)
    rise = min(7 if district == 'noble_west' else 4.5, half*.65)
    ridge = LineString([(center.x-ux*length*2,center.y-uy*length*2),
                        (center.x+ux*length*2,center.y+uy*length*2)])
    def vertex(x,y):
        return [x,y,eaves+rise*max(0,1-abs((x-center.x)*nx+(y-center.y)*ny)/half)]
    surfaces=[]; gables=[]
    for part in polygons(split(footprint,ridge)):
        for tri in constrained_delaunay_triangles(part).geoms:
            surfaces.append([vertex(x,y) for x,y in list(tri.exterior.coords)[:-1]])
        for a,b in zip(list(part.exterior.coords),list(part.exterior.coords)[1:]):
            edge=LineString([a,b])
            if footprint.boundary.buffer(.001).covers(edge):
                gables.append([[*a,eaves],[*b,eaves],vertex(*b),vertex(*a)])
    return dict(surfaces=surfaces,gables=gables)

def castle_site(plan):
    from shapely.geometry import shape
    land=unary_union([shape(d['geometry'])for d in plan['landDomains']if d['id']=='castle'])
    reserves=[]
    for route in plan['routes']:
        for a,b in zip(route['points'],route['points'][1:]):
            if max(a[2],b[2])>=200:
                reserves.append(LineString([a[:2],b[:2]]).buffer(route['width']/2+4))
    usable=land.buffer(-5).difference(unary_union(reserves))
    candidates=[]
    for part in polygons(usable):
        center=polylabel(part,tolerance=.25)
        candidates.append((center.distance(part.boundary),center))
    radius,center=max(candidates,key=lambda v:v[0])
    return dict(center=[center.x,center.y],radiusM=radius,available=mapping(usable))
