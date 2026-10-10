"""B116 join-aware stair footprints, replaces B114 boxes with true miter
joints. B114 preserved. Stairs have flat treads and one-step vertical risers.
"""
import json,pathlib,sys,math,shutil
src,out=map(pathlib.Path,sys.argv[1:3])
if out.exists():raise RuntimeError('Do not overwrite B116')
p=json.loads((src/'plan.json').read_text(encoding='utf8'))
d=json.loads((src/'parcels.json').read_text(encoding='utf8'))
old=p['nobleStairMiterB115']['newMeshes']
if len(old)!=2:raise RuntimeError('Unexpected B114 inputs')
p['meshes']=[m for m in p['meshes']if m['name']not in old]
# Keep both stair endpoints intact while diverting the high-grade landing
# away from the final flight's cross-height overlap.
east=next(r for r in p['routes']if r['id']=='noble_east_wall_stair')
oldEastRoute=list(east['points'])
east['points'].insert(-1,[-576.5,595.5,78.0])
east['lengthM']=sum(math.dist(a[:2],b[:2])for a,b in zip(east['points'],east['points'][1:]))
new=[];details=[]
def replace(routeid):
 route=next(r for r in p['routes']if r['id']==routeid)
 xyz=route['points'];w=route['width']/2+.23
 norm=[]
 for a,b in zip(xyz,xyz[1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
  norm.append((-dy/L,dx/L)if L>.001 else (0.,1.))
 halves=[]
 for i in range(len(xyz)):
  if i==0: n=norm[0];l=w
  elif i==len(xyz)-1:n=norm[-1];l=w
  else:
   x=norm[i-1][0]+norm[i][0];y=norm[i-1][1]+norm[i][1]
   ll=math.hypot(x,y)
   if ll<.1:
    n=norm[i];l=w
   else:
    n=(x/ll,y/ll)
    denom=abs(n[0]*norm[i][0]+n[1]*norm[i][1])
    l=min(w/max(denom,.27),w*3.7)
  halves.append(((xyz[i][0]+n[0]*l,xyz[i][1]+n[1]*l),
                 (xyz[i][0]-n[0]*l,xyz[i][1]-n[1]*l)))
 vv=[];faces=[]
 for i,(a,b)in enumerate(zip(xyz,xyz[1:])):
  left,right=halves[i];left2,right2=halves[i+1]
  top=b[2]+.09 if b[2]>a[2]+.001 else a[2]+.09
  k=len(vv)
  xy=[left,left2,right2,right]
  vv.extend([[x,y,top-1.25]for x,y in xy]+[[x,y,top]for x,y in xy])
  faces.extend([[k+j for j in f]for f in [
    [0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]])
 name='b116_'+routeid+'_mitered_stone_step_lattice'
 p['meshes'].append(dict(name=name,vertices=vv,faces=faces,material='stairs'))
 new.append(name)
 details.append(dict(route=routeid,steps=len(faces)//6,vertices=len(vv),
                     widthM=route['width'],maxZ=max(v[2]for v in vv)))
for id in ['noble_east_wall_stair','west_noble_wall_stairs']:replace(id)
# Physically grounded stone landing at the previously unsupported western
# foot of the noble-east switchback, one portal into the existing road.
cx,cy=east['points'][0][:2]
a=3.3
vv=[[cx-a,cy-a,40.2],[cx+a,cy-a,40.2],[cx+a,cy+a,40.2],[cx-a,cy+a,40.2],
    [cx-a,cy-a,42.09],[cx+a,cy-a,42.09],[cx+a,cy+a,42.09],[cx-a,cy+a,42.09]]
ff=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
p['meshes'].append(dict(name='b116_east_noble_stair_entry_stone_landing',
 vertices=vv,faces=ff,material='stone'))
new.append('b116_east_noble_stair_entry_stone_landing')
p['nobleStairMiterB116']=dict(base=src.name,status='WIP_PENDING_SUPPORT_AND_CLEARANCE_QA',
 removedB115Meshes=old,newMeshes=new,details=details,
 limitations=['Both paths use width 4m and retain historic centerlines and elevation',
 'Join geometry can overlap sharply folding paths and requires scene review',
 'No exhaustive continuous capsule test, retaining rail and actor traversal pending'])
out.mkdir()
for name,v in [('plan.json',p),('parcels.json',d),('stair-final-landing-study.json',p['nobleStairMiterB116'])]:
 (out/name).write_text(json.dumps(v,separators=(',',':')),encoding='utf8')
print(json.dumps(dict(output=str(out),unifiedMeshes=len(new))))

