import json,pathlib,math
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'architecture-repair-20261011.staged.plan.json').read_text('utf8'))
groups={k:[[],[]]for k in ('limestone','slate','brass','wood','water','grass','paving')}
def face(group,vertices,faces):
 v,f=groups[group];i=len(v);v.extend([[float(z)for z in a]for a in vertices]);f.extend([[i+x for x in c]for c in faces])
def box(g,cx,cy,z0,w,l,z1):
 x0=cx-w/2;x1=cx+w/2;y0=cy-l/2;y1=cy+l/2
 v=[[x,y,z]for z in (z0,z1)for x,y in ((x0,y0),(x1,y0),(x1,y1),(x0,y1))]
 face(g,v,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
def gable(cx,cy,w,l,eave,ridge,along='y'):
 if along=='y':
  v=[(cx-w/2,cy-l/2,eave),(cx+w/2,cy-l/2,eave),(cx+w/2,cy+l/2,eave),(cx-w/2,cy+l/2,eave),
   (cx,cy-l/2,ridge),(cx,cy+l/2,ridge)]
  face('slate',v,[[0,4,5,3],[4,1,2,5],[0,1,4],[3,5,2]])
 else:
  v=[(cx-w/2,cy-l/2,eave),(cx+w/2,cy-l/2,eave),(cx+w/2,cy+l/2,eave),(cx-w/2,cy+l/2,eave),
   (cx-w/2,cy,ridge),(cx+w/2,cy,ridge)]
  face('slate',v,[[0,1,5,4],[4,5,2,3],[0,4,3],[1,2,5]])
def cylinder(g,cx,cy,r,z0,z1,n=14):
 v=[]
 for z in (z0,z1):
  v.extend([(cx+math.cos(2*math.pi*k/n)*r,cy+math.sin(2*math.pi*k/n)*r,z)for k in range(n)])
 f=[list(range(n-1,-1,-1)),list(range(n,n*2))]
 for i in range(n):f.append([i,(i+1)%n,(i+1)%n+n,i+n])
 face(g,v,f)
def ribbon(name,pts,width=3.4):
 v=[];f=[]
 for (x,y,z),(u,t,h) in zip(pts,pts[1:]):
  dx=u-x;dy=t-y;ds=math.hypot(dx,dy)
  if ds<.1:continue
  nx=-dy/ds*width/2;ny=dx/ds*width/2
  i=len(v);v.extend([(x+nx,y+ny,z+.14),(u+nx,t+ny,h+.14),(u-nx,t-ny,h+.14),(x-nx,y-ny,z+.14)])
  f.append([i,i+1,i+2,i+3])
 face('paving',v,f)
# South-to-north municipal landmark: paths + entrance are connected to park record branch.
box('paving',310,638,112.09,62,23,112.19)
box('limestone',312,660,112,34,16,124.5);gable(312,660,35,17,124.5,133.3)
box('limestone',284,663,112,12,14,120);gable(284,663,13,15,120,125.2,'x')
box('limestone',335,661,112,10,17,121);gable(335,661,11,18,121,127.2,'x')
box('limestone',336,666,112,8,8,143)
gable(336,666,9,9,143,151,'x')
# Clock turret: layered stage cornice and vertically stacked lancet accents.
for z in (124.8,132,141.5):box('limestone',336,666,z,9.5,9.5,z+.8)
for x in (299,305,311,317,323):
 for y in (643.5,648.6):box('limestone',x,y,112.18,1.35,1.35,120)
box('wood',311,646.05,119.2,43,9,120.7);gable(311,646.05,43.5,9.5,120.7,124.3,'x')
# Entry arcade with heraldic frontage
for x in (298,304,310,316,322,328):
 box('limestone',x,652,119.0,1.3,.8,123.8)
for x in (304,311,318,325):
 box('brass',x,651.35,116.9,.55,.2,121.5)
# Civic ritual fountain, bounded by dry pedestrian loop and side benches
cylinder('limestone',310,634.5,4.3,112.19,112.8)
cylinder('water',310,634.5,3.45,112.81,112.84)
cylinder('limestone',310,634.5,.9,112.83,115.4)
for x in (284,336):
 for y in (633,640):
  box('limestone',x,y,112.19,4,1.1,112.65)
for x in (281,341):
 for y in (634,648):
  box('wood',x,y,112.19,.7,.7,115.3)
  cylinder('grass',x,y,2.0,114.9,118.6,9)
entry=[[263,619,112],[274,650,112],[294,650,112]]
loop=[[294,646,112],[293,628,112],[327,628,112],[327,646,112],[294,646,112]]
ribbon('entry',entry,3.6);ribbon('loop',loop,2.2)
for id,pts,w in [('current_upper_charter_hall_public_walk',entry,3.6),('current_upper_charter_hall_court_loop',loop,2.2)]:
 p['routes'].append(dict(id=id,points=pts,width=w,kind='life',z0=112,z1=112,
 lengthM=round(sum(math.dist(a,b)for a,b in zip(pts,pts[1:])),2),grade=0))
new=[]
for mat,(verts,faces) in groups.items():
 if not faces:continue
 name='current_upper_charter_hall_'+mat
 p['meshes'].append(dict(name=name,vertices=verts,faces=faces,material=mat))
 new.append((name,len(faces),len(verts)))
p['upperCharterHall20261011']=dict(status='PROVISIONAL_VISUAL_3D_QA_PENDING',anchor=(310,650,112),zone='upper_city',
purpose='Municipal charter hall, public record archive and fountain forecourt, not yet a canonical interactable facility',
newMeshes=new,newRoutes=['current_upper_charter_hall_public_walk','current_upper_charter_hall_court_loop'],
access='existing current_upper_garden_record_branch to (263,619) then 3.6m public walk; no canonical parcel overlaps by site clearance scan',
warnings=['Visual destination / no NPC implementation','Human-eye test and player continuous navigation remain outstanding'])
p['audit']['routeCount']=len(p['routes'])
out=root/'architecture-repair-20261011.stage2.plan.json'
out.write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
print('NEW_UPPER_HALL',len(new),'meshes',len(p['routes']),'routes',new,flush=True)
