import json,pathlib,math,hashlib,collections
from shapely.geometry import Polygon,Point,LineString
from shapely.ops import unary_union
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
raw=(root/'plan.json').read_bytes();plan=json.loads(raw)
targets=('wall_gallery_civic_wall_gallery_stairs_','mage_quarter_mage_wall_freight_abutment_')
old={p:[m for m in plan['meshes'] if m['name'].startswith(p)]for p in targets}
expected=(1741,89)
assert tuple(len(old[p])for p in targets)==expected,tuple(len(old[p])for p in targets)
g=[[],[]];r=[[],[]];c=[[],[]];stone=[[],[]];new=[]
def append(buf,verts,faces):
 v,f=buf;k=len(v);v.extend([[float(x)for x in p]for p in verts]);f.extend([[k+j for j in ff]for ff in faces])
def block(buf,cx,cy,z0,w,l,z1):
 x0,x1=cx-w/2,cx+w/2;y0,y1=cy-l/2,cy+l/2
 pts=[(x,y,z)for z in(z0,z1)for x,y in((x0,y0),(x1,y0),(x1,y1),(x0,y1))]
 append(buf,pts,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
def beam(buf,a,b,width,z0,z1,drop=.0):
 # a/b have 3D centerline; z0/z1 are offsets above centerline, drop reserved
 dx=b[0]-a[0];dy=b[1]-a[1];dist=math.hypot(dx,dy)
 if dist<.02:return
 nx=-dy/dist*width/2;ny=dx/dist*width/2
 xy=((a[0]+nx,a[1]+ny),(b[0]+nx,b[1]+ny),(b[0]-nx,b[1]-ny),(a[0]-nx,a[1]-ny))
 v=[]
 for i,z in enumerate((z0,z1)):
  v.extend([(x,y,(a[2] if j in(0,3)else b[2])+z)for j,(x,y)in enumerate(xy)])
 append(buf,v,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
def side_rail(buf,pts,width,heights=(.15,1.55),every=1,openings=()):
 for i in range(0,len(pts)-1,every):
  a=pts[i];b=pts[min(i+every,len(pts)-1)]
  dx=b[0]-a[0];dy=b[1]-a[1];D=math.hypot(dx,dy)
  if D<.03:continue
  nx=-dy/D;ny=dx/D
  for sign in(-1,1):
   offs=sign*width*.5
   aa=(a[0]+offs*nx,a[1]+offs*ny,a[2]);bb=(b[0]+offs*nx,b[1]+offs*ny,b[2])
   mid=((aa[0]+bb[0])/2,(aa[1]+bb[1])/2,(aa[2]+bb[2])/2)
   if any(math.dist(mid[:2],o[:2])<4.7 and abs(mid[2]-o[2])<3.2 for o in openings):
    continue
   beam(buf,aa,bb,.52,*heights)
byname={m['name']:m for m in plan['meshes']}
floor=sorted((m for m in old[targets[0]] if m['name'].endswith('_floor')),key=lambda v:int(v['name'].split('_')[-2]))
assert len(floor)==451
verts=[];faces=[]
for obj in floor:
 k=len(verts);verts.extend(obj['vertices']);faces.extend([[k+j for j in f]for f in obj['faces']])
new.append(dict(name='repair_civic_gallery_continuous_open_stairs',vertices=verts,faces=faces,material='stairs'))
route=next(x for x in plan['routes']if x['id']=='civic_wall_gallery_stairs')
galleryEntrances=((616.7,690.4,56),(617.8,726.6,70),(620.5,763.2,84),(622.5,799.6,98),(616.7,840.2,112))
side_rail(g,route['points'],route['width']+.7,every=4,openings=galleryEntrances)
# Corbels are anchored into the *actual* fortified rock face at the same elevation.
# No 60m slender stilts beneath this staircase.
def anchored_corbel(buf,walk,anchor,z,width=2.5,underside=4.5):
 x,y=walk;u,v=anchor
 dx=u-x;dy=v-y;L=math.hypot(dx,dy)
 if L<2 or L>27:return False
 nx=-dy/L*width/2;ny=dx/L*width/2
 # Triangular stone flying buttress: tip under the footway, heel embedded in wall.
 vv=[(x+nx,y+ny,z-.8),(u+nx,v+ny,z-.8),(u+nx,v+ny,z-underside),
     (x-nx,y-ny,z-.8),(u-nx,v-ny,z-.8),(u-nx,v-ny,z-underside)]
 append(buf,vv,[[0,1,2],[5,4,3],[0,3,4,1],[1,4,5,2],[2,5,3,0]])
 return True
def wall_surface_points(n):
 obj=byname[n];return [q[:2]for q in obj['vertices']]
galleryWall=wall_surface_points('b107_upper_city_retaining_reconstruction')
galleryCorbels=0
for i in range(22,len(route['points'])-20,26):
 x,y,z=route['points'][i]
 wx,wy=min(galleryWall,key=lambda a:(a[0]-x)**2+(a[1]-y)**2)
 dx=wx-x;dy=wy-y;L=math.hypot(dx,dy)
 if L<.1:continue
 # 3.0m side clearance of existing 6m stairway.
 start=(x+dx*3.05/L,y+dy*3.05/L)
 galleryCorbels+=anchored_corbel(g,start,(wx,wy),z,width=2.8,underside=4.4)
print('GALLERY_TRUE_WALL_CORBELS',galleryCorbels)
# Freight route has unsafe cart grade. Keep named route but never certify for carts.
freight=next(x for x in plan['routes']if x['id']=='mage_wall_freight')
side_rail(r,freight['points'],freight['width']+.8,heights=(.15,1.52),every=3,openings=((1061,348.8,70),))
mageWall=wall_surface_points('mage_east_retaining')
mageCorbels=0
for i in range(7,len(freight['points'])-4,8):
 x,y,z=freight['points'][i]
 wx,wy=min(mageWall,key=lambda a:(a[0]-x)**2+(a[1]-y)**2)
 dx=wx-x;dy=wy-y;L=math.hypot(dx,dy)
 if L<.1:continue
 start=(x+dx*5.1/L,y+dy*5.1/L)
 # Avoid the parallel public stair crossing below each flying buttress.
 publicStair=next(a for a in plan['routes'] if a['id']=='mage_wall_short_stairs')
 rib=LineString([start,(wx,wy)])
 if any(abs(q[2]-z)<9 and rib.distance(Point(q[0],q[1]))<5 for q in publicStair['points'][::2]):
  continue
 mageCorbels+=anchored_corbel(r,start,(wx,wy),z,width=3.0,underside=7.5)
print('MAGE_TRUE_WALL_CORBELS',mageCorbels)
print('OPEN_GALLERY_TREADS',len(faces),'GALLERY_RAIL_FACES',len(g[1]),'FREIGHT_SUPPORT_FACES',len(r[1]),flush=True)
# Castle escarpment: continuous rock revetment from actual 204m footprint to
# nearest lower inhabited tier, with real door gaps at both elevation-change gates.
castle=byname['castle_ground'];v=castle['vertices']
pieces=[]
for f in castle['faces']:
 try:sh=Polygon([v[k][:2]for k in f])
 except:continue
 if sh.is_valid and sh.area>.03:pieces.append(sh)
outline=unary_union(pieces).simplify(.6,preserve_topology=True)
assert outline.geom_type=='Polygon' and outline.area>60000
fc=byname['forecourt_ground'];vv=fc['vertices']
forecourt=unary_union([Polygon([vv[k][:2]for k in f])for f in fc['faces']if len(f)>2 and Polygon([vv[k][:2]for k in f]).area>.05])
gates=[]
for rid in ('castle_wall_stairs','current_castle_east_stone_stairs','current_castle_east_winch_ramp'):
 rr=next((q for q in plan['routes']if q['id']==rid),None)
 if rr:gates.append((rid,LineString([q[:2]for q in rr['points']])))
coords=list(outline.exterior.coords)
sign=-1 if outline.exterior.is_ccw else 1 # right normal outside counterclockwise
covered=0;skipped=0;foundationlength=0;lowerTiers=collections.Counter()
for a,b in zip(coords,coords[1:]):
 length=math.dist(a,b);piecesN=max(1,math.ceil(length/8))
 for i in range(piecesN):
  ax=a[0]+(b[0]-a[0])*i/piecesN;ay=a[1]+(b[1]-a[1])*i/piecesN
  bx=a[0]+(b[0]-a[0])*(i+1)/piecesN;by=a[1]+(b[1]-a[1])*(i+1)/piecesN
  dx=bx-ax;dy=by-ay;L=math.hypot(dx,dy)
  if L<.2:continue
  nx=sign*(-dy/L);ny=sign*(dx/L)
  mid=Point((ax+bx)/2,(ay+by)/2)
  if any(line.distance(mid)<8 for _,line in gates):
   skipped+=1;continue
  # Where the forecourt abuts the royal terrace there is 156m supportive ground;
  # elsewhere create a true lower-tier footing, not a hovering royal slab.
  lower=156 if forecourt.buffer(.7).covers(Point(mid.x+nx*3,mid.y+ny*3)) else 112
  lowerTiers[lower]+=1
  spread=3.7 if lower==112 else 2.2
  thickness=1.7
  vv=[]
  for z in (lower,204):
   aa=(ax+nx*(spread if z==lower else .18),ay+ny*(spread if z==lower else .18))
   bb=(bx+nx*(spread if z==lower else .18),by+ny*(spread if z==lower else .18))
   vv.extend(((aa[0],aa[1],z),(bb[0],bb[1],z),
       (bb[0]-nx*thickness,bb[1]-ny*thickness,z),
       (aa[0]-nx*thickness,aa[1]-ny*thickness,z)))
  append(c,vv,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
  foundationlength+=L;covered+=1
  # Structural supports appear below the rim rather than as flying metal plates.
  if i==0 and int(foundationlength//44)>int((foundationlength-L)//44):
   xx=(ax+bx)/2+nx*1.4;yy=(ay+by)/2+ny*1.4
   block(stone,xx,yy,lower,2.7,3.6,204.5)
  # Height courses and setbacks give readable three-dimensional terraces.
  for z in (156,180,197):
   if z>lower+.5:
    aa=(ax+nx*.45,ay+ny*.45,z);bb=(bx+nx*.45,by+ny*.45,z)
    beam(stone,aa,bb,.85,-.28,.4)
 # Royal windows/gates remain original. Don't seal the ingress.
print('CASTLE_ESCARPMENT',covered,'edge fragments','TOTAL_SUPPORTED_EDGE_M',round(foundationlength),
      'gateCuts',skipped,'baseLevels',dict(lowerTiers),'area',round(outline.area),flush=True)
for name,(buf,mat)in [('repair_civic_gallery_open_parapet', (g,'stone')),
                       ('repair_mage_freight_open_arcade',(r,'stone')),
                       ('repair_royal_cliff_tapered_revetment',(c,'stone')),
                       ('repair_royal_cliff_course_buttresses',(stone,'stone'))]:
 if buf[1]:new.append(dict(name=name,vertices=buf[0],faces=buf[1],material=mat))
plan['meshes']=[m for m in plan['meshes'] if not m['name'].startswith(targets)]+new
meta=dict(status='STAGED_ONLY_VISUAL_QA_REQUIRED',originalSha256=hashlib.sha256(raw).hexdigest(),
 removed=dict((pat,len(old[pat]))for pat in targets),
 preservedRoutes=len(plan['routes']),newMeshFaces=dict((m['name'],len(m['faces']))for m in new),
 castleEdgeSupportedM=round(foundationlength,1),castleGateCuts=skipped,castleGroundBaseCount=dict(lowerTiers),
 caveats=['No road/navmesh acceptance','Freight incline 56m rise/73m run NOT certified for carts','West long stairs unchanged',
         'Royal castle architectural body unchanged','Castle masonry gate openings must be visually verified'])
plan['structuralIntegrityPass20261011']=meta
(root/'structural-rebuild-20261011.v5.staged.plan.json').write_text(json.dumps(plan,separators=(',',':')),encoding='utf8')
(root/'structural-rebuild-20261011.v5.study.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf8')
print('STAGED',json.dumps({k:v for k,v in meta.items()if k!='caveats'},ensure_ascii=False),flush=True)
