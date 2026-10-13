"""Replace 523m east castle ramp with 125m integrated stone escarpment:
two open parallel lanes, one stair (240 unified treads), one winch-assisted
cargo ramp. Actual 3D QA before promoting. No roof or spindly scaffolds.
"""
import bpy,bmesh,json,pathlib,math
from mathutils import Vector
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'))
pending=root/'castle-east-stone-embankment-v6.pending.blend'
if pending.exists():raise RuntimeError('Stage already exists')
legacy=['castle_east_ramp','castle_east_ramp_graded_bench',
 'castle_east_ramp_terrace_support','castle_east_ramp_outer_parapet',
 'castle_east_ramp_treads']
for name in legacy:
 if name not in [m['name'] for m in p['meshes']]:raise RuntimeError('Missing legacy '+name)
 ob=bpy.data.objects.get(name)
 if ob is None:raise RuntimeError('Missing Blender '+name)
 bpy.data.objects.remove(ob,do_unlink=True)
p['meshes']=[m for m in p['meshes']if m['name']not in legacy]
oldR=[r for r in p['routes']if r['id']=='castle_east_ramp']
if len(oldR)!=1:raise RuntimeError('Expected one old 523m route')
p['routes']=[r for r in p['routes']if r['id']!='castle_east_ramp']
coll=bpy.data.collections.new('Current East Castle Escarpment Open Parallel Access')
bpy.context.scene.collection.children.link(coll)
palette={'rock':(.53,.54,.51,1),'stone':(.70,.68,.60,1),
 'treads':(.75,.73,.66,1),'rails':(.61,.60,.55,1),
 'iron':(.23,.24,.23,1),'brass':(.63,.44,.22,1)}
geo={k:([],[])for k in palette}
faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
def emit(k,v,f):
 vv,ff=geo[k];j=len(vv);vv.extend([list(q)for q in v]);ff.extend([[j+i for i in q]for q in f])
def box(k,x,y,z,w,d,h):
 xy=[(x-w/2,y-d/2),(x+w/2,y-d/2),(x+w/2,y+d/2),(x-w/2,y+d/2)]
 emit(k,[[i,j,z0]for z0 in (z-h/2,z+h/2)for i,j in xy],faces)
def slope(k,x0,x1,y0,y1,z0,z1,thick=.5):
 v=[[x0,y0,z0-thick],[x0,y1,z1-thick],[x1,y1,z1-thick],[x1,y0,z0-thick],
    [x0,y0,z0],[x0,y1,z1],[x1,y1,z1],[x1,y0,z0]]
 emit(k,v,faces)
# Solid embankment fills the former unsupported void. East side taper
# rises with both walkways, closes the fall into the underlying void.
# 25 segments support a natural irregular fortified stone face.
N=25
for j in range(N):
 y0=900+116*j/N;y1=900+116*(j+1)/N
 z0=156+48*j/N;z1=156+48*(j+1)/N
 # A connected solid masonry prism down to forecourt 156m.
 v=[[370,y0,156],[370,y1,156],[390,y1,156],[390,y0,156],
    [370,y0,z0],[370,y1,z1],[390,y1,z1],[390,y0,z0]]
 emit('rock',v,faces)
 if j in (2,6,10,14,18,22):
  # Stone ribs are integrated terraces, not individual 50m supports.
  box('stone',369.65,(y0+y1)/2,156+(z0+z1-312)/4,
      1.4,1.8,max(1,(z0+z1)/2-156))
  box('stone',390.35,(y0+y1)/2,156+(z0+z1-312)/4,
      1.4,1.8,max(1,(z0+z1)/2-156))
# Solid level upper apron absorbs the final 8m where castle ground begins.
box('rock',380,1020,180,20,8,48)
box('stone',380,1020,203.75,20,8,.5)
# Continuous geological shoulder rises eastwards to the genuine castle
# plateau, rather than exposing a bottomless dark void beside a narrow
# wedge. The 24m-wide infill is on un-parcelled, route-free terrain;
# QA must reject if existing building masses overlap.
for j in range(N):
 y0=900+116*j/N;y1=900+116*(j+1)/N
 z0=156+48*j/N;z1=156+48*(j+1)/N
 v=[[390,y0,156],[390,y1,156],[414,y1,156],[414,y0,156],
    [390,y0,z0],[390,y1,z1],[414,y1,204],[414,y0,204]]
 emit('rock',v,faces)
# 240 contiguous stone stairs, approximately 22.49deg; stage treads
# as ONE material-batched mesh, not 240 separate Blender objects.
steps=240
for i in range(steps):
 y0=900+116*i/steps;y1=900+116*(i+1)/steps
 z=156+48*(i+1)/steps
 box('treads',375.5,(y0+y1)*.5,z-.17,5.2,y1-y0,.35)
# Across the same footprint, freight uses a continuously graded bare
# stone winch lane; no canopy. An 8.3m separation from pedestrian stairs.
slope('stone',381.1,386.8,900,1016,156,204,.60)
slope('stone',381.1,386.8,1016,1024,204,204,.60)
# Wheel curbs and parapets. Keep openings at both landings.
for j in range(31):
 y0=901+114*j/31;y1=901+114*(j+1)/31
 z0=156+48*(y0-900)/116
 z1=156+48*(y1-900)/116
 for x in (371.6,379,388.25):
  mid=(y0+y1)/2
  if x==371.6 and (abs(mid-951)<4.3 or abs(mid-992)<4.3):
   continue  # connect overlooks, not fenced dead-end sights
  slope('rails',x-.20,x+.20,y0,y1,z0+1.32,z1+1.32,.82)
for x in (371.6,379,388.25):
 slope('rails',x-.20,x+.20,1015,1023.4,205.32,205.32,.82)
# 2 safe distributed intermediate overlook bays with a low perimeter.
for yy in (951,992):
 zz=156+48*(yy-900)/116
 box('stone',368.2,yy,zz-.32,5.4,7.6,.63)
 box('stone',371.6,yy,zz-.13,3.2,3.1,.35) # reachable spur bridge
 box('rails',365.8,yy,zz+.62,.7,7.8,1.35)
 for zOff in (0,):
  box('brass',365.35,yy,zz+1.42,.7,1.6,.15)
# A fortified ROYAL WALL PORTAL, not a roof over the slope.
# The original 204m-high crenellations traverse the approach visually;
# these heavy stone jambs and lintel carry that section over the road.
for x in (368.5,393.5):
 box('rock',x,955,177.0,5,4.1,42)
 box('stone',x,955,198.6,6.2,5.0,2.4)
box('stone',381.0,955,201.0,21.8,4.8,6.0)
for x in (372.1,389.8):
 box('stone',x,955,194.5,3.0,4.8,7.5)
box('brass',381.0,952.45,203.0,5.0,.32,2.4)
for x in (378,384):
 box('stone',x,952.4,204.7,.52,.38,3.0)
# Exterior of the ascending fortified ramp: repeated load-bearing
# buttresses and stone bands create a coherent medieval retaining-wall
# rhythm instead of a featureless triangular concrete wedge.
# They stay OUTSIDE both walking lanes, below their surface.
for yy in (914,930,947,965,983,1001):
 top=204.0
 height=48.0
 box('rock',416.1,yy,180.0,4.3,4.5,48)
 box('stone',416.5,yy,157.25,5.3,6,2.5)
 box('stone',416.5,yy,202.9,5.3,5.5,1.3)
 # Recessed blind arch reveals, never free-standing posts
 if height>10:
  left,right=yy-5.0,yy+5.0
  for center in (left,right):
   box('stone',415.8,center,179,1.25,1.5,43.0)
  box('stone',416.0,yy,top-5.0,1.2,10.4,1.0)
# Every other 8m of climb receives two narrow courses. No blocks
# intersect the ramp width x381..387 or the people stair x373..378.
for j in range(3,13):
 y=900+j*8.2
 z=156+48*(y-900)/116
 for dz in (1.7,4.2):
  if z-156>dz+1:
   box('stone',415.25,y,156+dz,1.2,6.1,.44)
# Three continuous stone string-courses break up the 48m-high wall
# and visually integrate the new cliff flank with the castle parapet.
for zz in (168,183,198):
 box('stone',415.2,958,zz,1.9,116,.85)
for yy in (906,922,938,954,970,986,1002):
 # Embrasures are blind stone-lined reliefs, not false doors
 box('iron',415.86,yy,192.0,.18,.75,4.4)
 box('stone',416.0,yy,194.5,1.2,2.1,.65)
# The two off-route overlooks are distinct navigational discoveries:
# low stone survey markers and different colored relief panels, at the
# EXIT of the side spurs, not at the walking-lane center.
for yy in (951,992):
 zz=156+48*(yy-900)/116
 box('stone',367.7,yy,zz+.55,.85,4.4,1.10)
 box('brass',367.1,yy,zz+1.20,.19,2.1,.70)
# Consolidated ascent/descents, two separate links from the same wide
# bottom loading precinct, preserving legacy landing_0/1 where usable.
def route(name,pts,width,kind):
 for q in p['routes']:
  if q['id']==name:raise RuntimeError('duplicate '+name)
 p['routes'].append(dict(id=name,kind=kind,width=width,
 points=[[float(x),float(y),float(z)]for x,y,z in pts],
 z0=pts[0][2],z1=pts[-1][2],
 lengthM=round(sum(math.dist(a,b)for a,b in zip(pts,pts[1:])),2),
 grade=round(48/124,4)))
foot=[(380,900,156),(375.5,900,156)]
freight=[(380,900,156),(384,900,156)]
for k in range(1,steps+1):
 if k%3==0 or k==steps:
  y=900+116*k/steps;z=156+48*k/steps
  foot.append((375.5,y,z))
for j in range(1,126):
 y=900+116*j/125;z=156+48*j/125
 freight.append((384,y,z))
# At the top, stone apron branches join the *existing castle contour* at
# two locations rather than funneling both lanes into one narrow aperture.
foot += [(375.5,1024,204),(375.5,1026,204),(376.6,1027.0,204)]
freight += [(384,1024,204),(384,1026,204),(386.9,1034.4,204)]
# Build physical short continuous terminal aprons for top/bottom links.
slope('stone',374.5,379,1024,1027,204,204,.38)
slope('stone',382,388.6,1024,1035,204,204,.38)
slope('stone',375.0,385.5,895,900,156,156,.45)
route('current_castle_east_stone_stairs',foot,5.2,'stairs')
route('current_castle_east_winch_ramp',freight,5.7,'winch_service')
for j,yy in enumerate((951,992),1):
 zz=156+48*(yy-900)/116
 route('current_castle_east_overlook_'+str(j),[(375.5,yy,zz),(367.8,yy,zz)],3.1,'discovery')
created=[]
for mat,(verts,ff) in geo.items():
 if not ff:continue
 name='current_east_escarpment_'+mat
 if bpy.data.objects.get(name):raise RuntimeError('name exists '+name)
 m=bpy.data.meshes.new(name);m.from_pydata(verts,[],ff);m.update()
 bm=bmesh.new();bm.from_mesh(m);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(m);bm.free()
 obj=bpy.data.objects.new(name,m);coll.objects.link(obj)
 material=bpy.data.materials.get(name)or bpy.data.materials.new(name)
 material.diffuse_color=palette[mat];m.materials.append(material)
 p['meshes'].append(dict(name=name,vertices=[list(v.co)for v in m.vertices],
 faces=[list(f.vertices)for f in m.polygons],material=name))
 created.append(name)
p['audit']['routeCount']=len(p['routes'])
meta=dict(status='PENDING_VISUAL_COLLISION_QA',
 replacedOldRoute=oldR[0]['id'],oldLengthM=oldR[0]['lengthM'],
 removedOldMeshes=legacy,newMeshes=created,
 newRoutes=['current_castle_east_stone_stairs','current_castle_east_winch_ramp',
 'current_castle_east_overlook_1','current_castle_east_overlook_2'],
 stairRiseM=48,stairRunsM=116,stairTreadCount=steps,
 freightInclinationDeg=round(math.degrees(math.atan(48/116)),1),
 noRoof=True,sideParapets=True,parcelOverlayM2=0,
 scope='east royal terrace only',caveats=['Real in-game winch machinery absent',
 'Stair/masonry terrain may intersect existing castle wall below top until tested',
 'Old landing road geometry and wider connectivity must be audited',
 'Castle west and upper city other ramps not fixed by this pass'])
p['currentEastCastleEscarpment']=meta
(root/'east-escarpment-plan-v6.staged.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(root/'east-escarpment-study-v6.staged.json').write_text(json.dumps(meta,indent=2),encoding='utf8')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(pending))
print('EAST_CASTLE_ESCARPMENT_STAGED',len(created),len(p['routes']),pending.stat().st_size)
