"""F05 structural replacement: connect F05 apron (Z156) to accepted east rock (Z112).
All other 11 priority sites are inherited unchanged from the latest candidate V8.
Nothing here writes to active files.
"""
import json,pathlib,hashlib,math
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
active=(root/'plan.json').read_bytes()
stage=json.loads((root/'user-p0-12-gaps-v8-20261012.staged.plan.json').read_text('utf8'))
study=stage['userReportedPriority12_20261012']
assert hashlib.sha256(active).hexdigest()==study['sourcePlanSHA256']
old='repair_user_p0_F05_integrated_stone_masonry_v7'
before=len(stage['meshes'])
stage['meshes']=[m for m in stage['meshes']if m['name']!=old]
assert len(stage['meshes'])==before-1,'Existing F05 mesh missing'
# Approximate landform in built-up cliff: fully-wetted source and toe overlap.
# The castle forecourt Z156 at the NW end and accepted east rock Z112 at x417.2.
stations=[
 (332.8,942.5,16,156.20),
 (342.0,949.5,20,156.20),
 (353.5,957.8,27,156.18),
 (365.0,959.8,32,156.04),
 (380.0,960.0,35,146.5),
 (396.0,961.0,36,130.5),
 (413.0,962.5,32,114.5),
 (422.0,963.0,24,112.35)]
lateral=(-1,-.5,0,.5,1)
vertices=[];top=[];bottom=[]
for i,(x,cy,w,topz)in enumerate(stations):
 t=[];b=[]
 for j,k in enumerate(lateral):
  # nonlinear ground contour 窶・edges slightly more eroded than centre.
  px=x+(math.sin(i*2.39+j*.9)*.75 if i not in(0,len(stations)-1)else 0)
  yy=cy+w/2*k
  relief=(1-abs(k))*.35*math.sin(i*1.6)
  zz=topz+relief
  t.append(len(vertices));vertices.append([round(px,3),round(yy,3),round(zz,3)])
 for j,k in enumerate(lateral):
  px=x+(.55*math.sin(i*1.5+j)if i not in(0,len(stations)-1)else 0)
  yy=cy+w/2*k
  b.append(len(vertices));vertices.append([round(px,3),round(yy,3),110.4])
 top.append(t);bottom.append(b)
faces=[]
for i in range(len(stations)-1):
 for j in range(len(lateral)-1):
  faces.append([top[i][j],top[i+1][j],top[i+1][j+1],top[i][j+1]])
  faces.append([bottom[i][j+1],bottom[i+1][j+1],bottom[i+1][j],bottom[i][j]])
 # Flanking stone scarp faces
 faces.append([top[i][0],bottom[i][0],bottom[i+1][0],top[i+1][0]])
 faces.append([top[i+1][-1],bottom[i+1][-1],bottom[i][-1],top[i][-1]])
# Closed first and last faces, with nonplanar caps triangulated.
for j in range(len(lateral)-1):
 faces.append([top[0][j+1],bottom[0][j+1],bottom[0][j],top[0][j]])
 faces.append([top[-1][j],bottom[-1][j],bottom[-1][j+1],top[-1][j+1]])
name='repair_user_p0_F05_east_rock_taper_B'
stage['meshes'].append({'name':name,'vertices':vertices,'faces':faces,'material':'stone'})
study['supportWedges']=[{'tag':'F05','meshName':name,'topZ':156,'toeZ':110.4,
 'anchorsNW':[332.8,942.5,155.9],'anchorsEast':[420.5,963,112.35],
 'supportStyle':'continuous earth-linked rock tapered from forecourt to existing east rock'}]
study['status']='V9_F05_ROCK_TAPER_PENDING_GEOMETRIC_AND_VISUAL_QA'
study['reviewNotes']=list(study.get('reviewNotes',[]))+[
 'v8 F05 block only touched original terrain at upper edge, bottom lacked real Z112 rock contact',
 'v9 F05 rock now extends to existing east v9 rock near x417.2, z112',
 'No other P0 floors or walls modified']
study['protectedRoutes']=len(stage['routes'])
out=root/'user-p0-12-gaps-eastrock-b-20261012.staged.plan.json'
assert not out.exists()
out.write_text(json.dumps(stage,separators=(',',':')),encoding='utf8')
(root/'user-p0-12-gaps-eastrock-b-20261012.study.json').write_text(json.dumps(study,indent=2,ensure_ascii=False),encoding='utf8')
print('V9_GEOMETRY_STAGED',name,'faces',len(faces),'vertices',len(vertices),flush=True)
