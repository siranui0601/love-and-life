"""B109 integrated stair structure, genuine side-overlooks and corner-safe
parapets. B108 untouched. This is an authoring study, not final game walkway.
"""
import json,pathlib,sys,math,shutil
src,out=map(pathlib.Path,sys.argv[1:3])
if out.exists():raise RuntimeError('Refuse overwrite B109')
p=json.loads((src/'plan.json').read_text())
d=json.loads((src/'parcels.json').read_text())
report=p['shortRoyalAccessB108']
controls=[
 [610.6,650,42],[656,645,42],
 [639,634,56],[634,639,56],
 [613,628,70],[609,633,70],
 [589,621,84],[585,626,84],
 [603,652,98],[598,656,98],
 [575,632,112],[573.5,631.3,112]]
removeIds=['b108_royal_gate_integrated_parapets'] + [
 'b108_royal_stair_belvedere_'+str(z) for z in [56,70,84,98]]
p['meshes']=[m for m in p['meshes'] if m['name'] not in removeIds]
def mesh(name,verts,faces,mat='stone'):
 obj=dict(name='b109_'+name,vertices=verts,faces=faces,material=mat)
 p['meshes'].append(obj)
 return obj['name']
def slab(name,a,b,width,zoff=-.07,mat='stone'):
 dx=b[0]-a[0];dy=b[1]-a[1];ln=math.hypot(dx,dy)
 if ln<.001:return
 nx=-dy/ln*width/2;ny=dx/ln*width/2
 v=[[a[0]-nx,a[1]-ny,a[2]+zoff],
    [b[0]-nx,b[1]-ny,b[2]+zoff],
    [b[0]+nx,b[1]+ny,b[2]+zoff],
    [a[0]+nx,a[1]+ny,a[2]+zoff]]
 return mesh(name,v,[[0,1,2,3]],mat)
def box(name,x0,y0,z0,x1,y1,z1,mat='stone'):
 v=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],
 [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]
 f=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
 return mesh(name,v,f,mat)
# One under-stair integrated stone spine (with mitered corner overlap at landing).
v=[];f=[]
for a,b in zip(controls,controls[1:]):
 dx=b[0]-a[0];dy=b[1]-a[1];ln=math.hypot(dx,dy)
 if ln<.001:continue
 nx=-dy/ln*2.8;ny=dx/ln*2.8
 k=len(v)
 for offset in (-.43,-.07):
  v.extend([[a[0]-nx,a[1]-ny,a[2]+offset],
    [b[0]-nx,b[1]-ny,b[2]+offset],
    [b[0]+nx,b[1]+ny,b[2]+offset],
    [a[0]+nx,a[1]+ny,a[2]+offset]])
 f.extend([[k+i for i in j]for j in
    [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]]])
mesh('continuous_rockcut_stair_spine',v,f,'stone')
for i,x in enumerate(controls[1:-1]):
 if i%2==1: # true intermediate flat approach at each bend
  box('stair_turn_land_'+str(i),x[0]-3.4,x[1]-3.4,x[2]-.52,
      x[0]+3.4,x[1]+3.4,x[2]-.04)
# Guard rails follow uphill flights only, stop 2m before every sharp turn;
# these are entire unified geometries, not one object per step.
v=[];f=[]
for a,b in zip(controls,controls[1:]):
 if b[2]-a[2]<.1:continue
 dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
 if L<5:continue
 ux=dx/L;uy=dy/L;nx=-uy;ny=ux
 trim=1.8/L
 for side in [-1,1]:
  q=[a[k]+(b[k]-a[k])*trim for k in range(3)]
  e=[a[k]+(b[k]-a[k])*(1-trim)for k in range(3)]
  bx=nx*side*2.65;by=ny*side*2.65
  j=len(v)
  for zz in (0,1.2):
   v.extend([[q[0]+bx-.23*nx,q[1]+by-.23*ny,q[2]+zz],
             [e[0]+bx-.23*nx,e[1]+by-.23*ny,e[2]+zz],
             [e[0]+bx+.23*nx,e[1]+by+.23*ny,e[2]+zz],
             [q[0]+bx+.23*nx,q[1]+by+.23*ny,q[2]+zz]])
  f.extend([[j+k for k in ix]for ix in [[0,1,5,4],[2,3,7,6],[4,5,6,7],[1,2,6,5],[3,0,4,7]]])
mesh('corner_safe_integrated_parapets',v,f,'stone')
bay=[]
for z,idx in [(56,3),(70,5),(84,7),(98,9)]:
 x,y,_=controls[idx]
 before=controls[idx-1];after=controls[idx+1]
 dx=after[0]-before[0];dy=after[1]-before[1]
 ll=math.hypot(dx,dy)
 nx=-dy/ll;ny=dx/ll
 side=-1 if z in (56,84) else 1
 cx=x+nx*side*10;cy=y+ny*side*10
 # Bridge to actual overhang bay at z; platform has a visible foundation.
 sl=box('overlook_'+str(z)+'_deck',cx-3.7,cy-3.7,z-.6,cx+3.7,cy+3.7,z-.03)
 slab('overlook_'+str(z)+'_entrance',[x,y,z],[cx,cy,z],3.0,-.05,'stone')
 box('overlook_'+str(z)+'_stone_pier',cx-1.0,cy-1.0,42,cx+1.,cy+1.,z-.55)
 for j,(xx,yy) in enumerate([(cx-3.7,cy-3.7),(cx+3.7,cy-3.7),(cx-3.7,cy+3.7)]):
  box('overlook_'+str(z)+'_parapet_post_'+str(j),xx-.35,yy-.35,z,xx+.35,yy+.35,z+1.2)
 r=dict(id='royal_short_stairs_overlook_'+str(z),points=[[x,y,z],[cx,cy,z]],
   width=3,kind='life',z0=z,z1=z,lengthM=math.hypot(cx-x,cy-y),grade=0)
 p['routes'].append(r)
 bay.append(dict(z=z,center=[cx,cy],routeId=r['id']))
p['audit']['routeCount']=len(p['routes'])
study=dict(status='UNACCEPTED_PENDING_3D_QA',base=src.name,
 deletedMeshes=removeIds,
 newMeshes=[m['name']for m in p['meshes']if m['name'].startswith('b109_')],
 bayRoutes=bay,
 limits=['Stair route has 415 risers and requires alternate usable hoist',
        'All-in-one spine still needs collision/mesh and human viewpoint audit',
        'No gameplay transport/road graph rework of old 1170m ramp'])
p['reformedRoyalAccessB109']=study
out.mkdir()
for name,val in [('plan.json',p),('parcels.json',d),('reformed-royal-access.json',study)]:
 (out/name).write_text(json.dumps(val,separators=(',',':')),encoding='utf-8')
print(json.dumps(dict(output=str(out),deleted=len(removeIds),
  built=len(study['newMeshes']),overlooks=len(bay))))
