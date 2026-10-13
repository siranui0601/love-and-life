import json,pathlib,math,hashlib
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
raw=(root/'royal-forecourt-east-ascent-20261012.staged.plan.json').read_bytes()
p=json.loads(raw)
ms={m['name']:m for m in p['meshes']}
r={r['id']:r for r in p['routes']}
assert all(x in r for x in ('current_castle_east_stone_stairs','current_castle_east_winch_ramp'))
new=[]
def mesh(n,material):
 assert n not in ms
 m={'name':n,'vertices':[],'faces':[],'material':material};new.append(m);return m
def add(m,v,fs):
 k=len(m['vertices']);m['vertices'].extend([list(map(float,x)) for x in v]);m['faces'].extend([[k+i for i in f]for f in fs])
faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
def box(m,x0,x1,y0,y1,low,hi):
 assert hi>low
 V=[(x,y,z)for z in(low,hi)for x,y in((x0,y0),(x1,y0),(x1,y1),(x0,y1))]
 add(m,V,faces)
def slope(m,x0,x1,y0,y1,z0,z1,thickness):
 # Extruded continuous load-bearing masonry stringer or deck with sloped top.
 V=[(x,y,z)for z in(z0-thickness,z1-thickness) for x,y in((x0,y0),(x1,y0),(x1,y1),(x0,y1))]
 # Explicit ordering, lower vertices 0..3, top 4..7
 V=[(x0,y0,z0-thickness),(x1,y0,z0-thickness),(x1,y1,z1-thickness),(x0,y1,z1-thickness),
    (x0,y0,z0),(x1,y0,z0),(x1,y1,z1),(x0,y1,z1)]
 add(m,V,faces)
def roadZ(name,y):
 pts=r[name]['points']
 q=min(range(len(pts)),key=lambda i:abs(pts[i][1]-y))
 for i in (q-1,q):
  if 0<=i<len(pts)-1:
   a,b=pts[i:i+2]
   if min(a[1],b[1])<=y<=max(a[1],b[1]) and abs(b[1]-a[1])>.001:
    t=(y-a[1])/(b[1]-a[1]);return a[2]+t*(b[2]-a[2])
 return pts[q][2]
def lowerDeck(y):
 return min(roadZ('current_castle_east_stone_stairs',y),roadZ('current_castle_east_winch_ramp',y))
deck=mesh('repair_royal_east_ascent_foundation_deck_20261012','stone')
pillars=mesh('repair_royal_east_ascent_foundation_piers_20261012','stone')
ribs=mesh('repair_royal_east_ascent_arch_ribs_20261012','limestone')
# Beneath but never inside the human walking deck, 16.2m wide for two independent routes.
for y in range(905,1025,4):
 y1=min(1025,y+4)
 z0=lowerDeck(y)-1.00;z1=lowerDeck(y1)-1.00
 slope(deck,370.0,390.4,y,y1,z0,z1,2.4)
 # side stringers articulate the wall without enclosing headroom
 for x0,x1 in((369.2,370.6),(389.8,391.2)):
  slope(ribs,x0,x1,y,y1,z0-.12,z1-.12,3.7)
# Foundation piers support the first 65m from the new Z112 terrace.
for y in (911,929,951,968):
 z=lowerDeck(y)-3.65
 for x0,x1 in((368.7,371.4),(389.6,392.3)):
  box(pillars,x0,x1,y-3.5,y+3.5,112,z)
 # broad masonry capital above each pier
 for x0,x1 in((368.2,371.8),(389.2,392.8)):
  box(ribs,x0,x1,y-4.1,y+4.1,z-.25,z+.50)
# 50m vaulted stringers between the final pier and the royal citadel high landing.
# Anchor above the empty low ground by a gravity arch, not another unsupported vertical pillar.
for x0,x1 in((368.7,371.5),(389.7,392.5)):
 a,b=968,1038
 zA=lowerDeck(a)-4.5
 # The crown tracks near the existing stone ramp without entering it.
 zB=201.5
 N=18
 for i in range(N):
  ya=a+(b-a)*i/N;yb=a+(b-a)*(i+1)/N
  t=i/N;u=(i+1)/N
  # Curved intrados: a tapered masonry thrust arch below the continuous deck.
  roofA=zA+(zB-zA)*t-5.0*math.sin(math.pi*t)
  roofB=zA+(zB-zA)*u-5.0*math.sin(math.pi*u)
  slope(ribs,x0,x1,ya,yb,roofA,roofB,2.7)
  if i in (5,10,15):
   box(ribs,x0-.3,x1+.3,ya-.45,ya+.45,roofA-2.7,roofA+.75)
p['meshes'].extend([m for m in new if m['faces']])
p['royalEastAscentFoundation20261012']={
 'status':'PROVISIONAL_REQUIRE_WALK_AND_VISUAL_QA','originalPilotPlanSHA256':hashlib.sha256(raw).hexdigest(),
 'existingStairRoute':'current_castle_east_stone_stairs','existingWinchRoute':'current_castle_east_winch_ramp',
 'foundationFooting':'Z112 apron previously staged and castle high masonry at Z204',
 'newMeshes':[(m['name'],len(m['vertices']),len(m['faces']))for m in new],
 'caveats':['Bridge supports may intersect pre-existing retainer meshes','Need 3D capsule clearance and user visual review',
 'High end x391,y1038 requires special foot anchor check','Cargo winch is only visual and not implemented as gameplay']}
(root/'royal-east-ascent-foundation-20261012.v2.staged.plan.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(root/'royal-east-ascent-foundation-20261012.v2.study.json').write_text(json.dumps(p['royalEastAscentFoundation20261012'],indent=2),encoding='utf8')
print('STAGED_FOUNDATION',p['royalEastAscentFoundation20261012']['newMeshes'])
