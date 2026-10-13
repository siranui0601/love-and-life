"""B112 Court Arcane Complex / elevation and architectural identity pass.
No invented canonical location. Royal research, archive, magic corps and
defensive apparatus remain subordinate to the existing official Mage Tower.
B111 base immutable.
"""
import json,pathlib,sys,math,shutil
from shapely.geometry import Point,LineString,box
from shapely.ops import unary_union
src,out=map(pathlib.Path,sys.argv[1:3])
if out.exists():raise RuntimeError('Refuse existing B112')
p=json.loads((src/'plan.json').read_text(encoding='utf-8'))
d=json.loads((src/'parcels.json').read_text(encoding='utf-8'))
Z=70
meshes=[];oldroofs=['b100_scribe_archive_gabled_roof','b100_royal_ritual_annex_gabled_roof','b100_court_guard_station_gabled_roof']
p['meshes']=[m for m in p['meshes']if m['name']not in oldroofs]
def mesh(name,v,f,material):
 full='b112_'+name
 p['meshes'].append(dict(name=full,vertices=v,faces=f,material=material))
 meshes.append(full)
 return full
def prism(name,x,y,w,d,z,h,mat='court_ashlar'):
 left=x-w/2;right=x+w/2;south=y-d/2;north=y+d/2
 v=[[left,south,z],[right,south,z],[right,north,z],[left,north,z]]
 v.extend([[a,b,z+h]for a,b,_ in v])
 f=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
 mesh(name,v,f,mat)
def gable(name,x,y,w,d,z,ridge,mat):
 x0=x-w/2-1;x1=x+w/2+1;y0=y-d/2-1;y1=y+d/2+1
 v=[[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z],
    [x,y0,z+ridge],[x,y1,z+ridge]]
 mesh(name,v,[[0,1,4],[3,5,2],[0,4,5,3],[4,1,2,5]],mat)
def turret(name,x,y,r,z,height,ridge,mat='court_ashlar'):
 n=12;v=[]
 for zz,rr in ((z,r),(z+height,r),(z+height+.8,r+1)):
  v.extend([[x+rr*math.cos(i*2*math.pi/n),y+rr*math.sin(i*2*math.pi/n),zz]for i in range(n)])
 faces=[]
 for j in range(2):
  faces.extend([[j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i]for i in range(n)])
 mesh(name+'_body',v,faces,mat)
 crest=v[2*n:]+[[x,y,z+height+ridge]]
 mesh(name+'_conical_slate_roof',crest,[[i,(i+1)%n,n]for i in range(n)],'court_blue_slate')
def rooftop(name,x,y,w,d,wallbase,upper,ridge):
 # A deliberate two-level stone volume, blue roofs, carved cornice and
 # tall archivist/guard lancets -- cannot be mistaken for generic houses.
 prism(name+'_upper_wall',x,y,w,d,wallbase,upper,'court_ashlar')
 prism(name+'_continuous_cornice',x,y,w+2,d+2,wallbase+upper-1.2,1.1,'court_light_stone')
 gable(name+'_high_roof',x,y,w,d,wallbase+upper,ridge,'court_blue_slate')
 for k,fx in enumerate([x-w*.33,x,x+w*.33]):
  prism(name+'_front_buttress_'+str(k),fx,y-d/2-.8,1.7,1.7,wallbase,upper+.6,'court_light_stone')
  prism(name+'_recessed_lancet_'+str(k),fx,y-d/2-.94,1.15,.22,wallbase+upper*.39,5.2,'court_midnight')
rooftop('crown_archive',1102,658,20,18,82,14,13)
rooftop('summoning_annex',1066,700,20,18,83,18,15)
rooftop('corps_guardhouse',1036,592,20,18,84,16,12)
# Observatory on the royal-ritual wing: separate identifiable role from
# the central spell tower. No fictional school label.
turret('astronomical_observatory',1066,700,5.3,101,12,9)
for idx,(x,y,z) in enumerate([(1094,652,96),(1110,652,96),(1094,664,96),(1110,664,96),
 (1058,694,101),(1074,694,101),(1058,706,101),(1074,706,101)]):
 turret('crest_finial_'+str(idx),x,y,1.6,z,5,5,'court_light_stone')
# A ceremonial gateway faces the lower approach. Widened portal protects
# foot traffic; placement probes ensure guide pillars are off any carriage lane.
domain=box(992,568,1128,734)
roads=[]
for r in p['routes']:
 if r['z0']!=70 or r['z1']!=70:continue
 ln=LineString([q[:2]for q in r['points']])
 if ln.intersects(domain.buffer(15)):roads.append(ln.buffer(r['width']/2+3.5))
street=unary_union(roads)
placed=[]
def pick(target,r=5):
 tx,ty=target;spots=[]
 for x in range(round(tx-14),round(tx+15),3):
  for y in range(round(ty-12),round(ty+13),3):
   circle=Point(x,y).buffer(r+.65)
   if not domain.contains(circle):continue
   if street.intersects(circle):continue
   if any(Point(x,y).distance(Point(a,b))<r+rr+4 for a,b,rr in placed):continue
   spots.append((math.hypot(x-tx,y-ty),x,y))
 if not spots:return None
 _,x,y=min(spots);placed.append((x,y,r));return(x,y)
gates=[]
for id,target in [('gate_a',(1060,585)),('gate_b',(1107,585)),('watch_c',(994,700)),('watch_d',(1125,680))]:
 v=pick(target,4.5)
 if not v:continue
 x,y=v
 turret('royal_arcane_'+id,x,y,4.5,70,24,12)
 prism('royal_arcane_'+id+'_banner_face',x,y-4.7,2.4,.2,84,7,'court_gold')
 gates.append([id,x,y])
if len(gates)<2:raise RuntimeError('No safe ceremonial gatehouse')
# Emblem on paved court -- flat engraving does not block the level 70 street.
cx,cy=1078,605
n=12;r=9
v=[[cx+r*math.cos(2*math.pi*i/n),cy+r*math.sin(2*math.pi*i/n),70.18]for i in range(n)]
mesh('royal_court_inlaid_twelve_point_seal',v,[[0]+list(range(1,n))],'court_gold')
# Visible masons' crenellations atop original B100 low perimeter wall,
# but skip any location within a street safety buffer.
merlons=0
for m in p['meshes']:
 if not m['name'].startswith('b100_royal_perimeter_'):continue
 q=m['vertices']
 a,b=q[0],q[1]
 length=math.hypot(b[0]-a[0],b[1]-a[1])
 if length<4:continue
 for k in range(1,math.floor(length/6)+1):
  t=k*6/length
  x=a[0]+(b[0]-a[0])*t;y=a[1]+(b[1]-a[1])*t
  if street.distance(Point(x,y))<3:continue
  prism('royal_crest_merlon_'+str(merlons),x,y,1.8,1.8,74.15,2.5,'court_light_stone')
  merlons+=1
report=dict(base=src.name,status='WIP_REQUIRES_3D_QA',
 themes=['royal research archive','summoning and rites annexe','magic corps guard hall',
         'astronomical observatory','guarded processional frontage'],
 centralCanonicalId='LOC_CAP_MAGE_TOWER',noCanonicalParcelChange=True,
 originalSmallRoofsReplaced=oldroofs,newMeshes=meshes,
 gateLocations=gates,perimeterCrestCount=merlons,
 limitations=['Interior rooms and actual functional arcane work are not built',
  'Royal court is still too residential without further public access/architecture pass',
  'Need human-view, roof silhouette and live route checks'])
p['arcaneRoyalB112']=report
out.mkdir()
for name,v in [('plan.json',p),('parcels.json',d),('court-arcane-pass.json',report)]:
 (out/name).write_text(json.dumps(v,separators=(',',':')),encoding='utf-8')
print(json.dumps(dict(output=str(out),objects=len(meshes),gateTowers=len(gates),merlons=merlons)))
