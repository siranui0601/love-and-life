import json,pathlib,math,hashlib
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
raw=(root/'royal-east-pocket-20261012.v3.staged.plan.json').read_bytes();p=json.loads(raw)
info=p['royalEastPocketRock20261012']
name='repair_royal_east_pocket_graduated_bedrock_20261012'
old=next(m for m in p['meshes']if m['name']==name)
p['meshes']=[m for m in p['meshes']if m['name']!=name]
rows=info['rows'];K=10
xs=[];vv=[];faces=[]
for i,(y,xh,zh,xl)in enumerate(rows):
 line=[]
 for j in range(K+1):
  t=j/K
  x=xh+(xl-xh)*t
  z=112+(zh-112)*(1-t)**1.35
  if 0<j<K:
   # coherent, modest broken rock courses in the artificial wall face
   z+=2.1*math.sin(2.7*i+4.9*t)*math.sin(math.pi*t)
   if .27<t<.38:z-=2.5
   if .61<t<.75:z-=1.8
  line.append(len(vv));vv.append([round(x,3),float(y),round(z,3)])
 xs.append(line)
for i in range(len(rows)-1):
 for j in range(K):
  a=xs[i][j];b=xs[i+1][j];c=xs[i+1][j+1];d=xs[i][j+1]
  if (i+j)%2:faces.extend([[a,b,d],[b,c,d]])
  else:faces.extend([[a,b,c],[a,c,d]])
# Return underside and end caps to the lower Z112 terrain.
for i in range(len(rows)-1):
 a=xs[i][0];b=xs[i+1][0]
 faces.append([a,b,len(vv)+i+1,len(vv)+i])
for (y,xh,zh,xl)in rows:vv.append([xh,y,112.0])
old['vertices']=vv;old['faces']=faces;old['material']='royal_east_bedrock_dark'
p['meshes'].append(old)
# Deliberate retaining terraces interrupt the natural talus with sculpted structure.
name2='repair_royal_east_pocket_retaining_terrace_courses_20261012'
bands=dict(name=name2,vertices=[],faces=[],material='royal_east_limestone')
def push(V):
 offset=len(bands['vertices'])
 bands['vertices'].extend([list(map(float,z))for z in V])
 bands['faces'].extend([[offset,offset+1,offset+2,offset+3],
                        [offset+4,offset+7,offset+6,offset+5],
                        [offset,offset+4,offset+5,offset+1],
                        [offset+1,offset+5,offset+6,offset+2],
                        [offset+2,offset+6,offset+7,offset+3],
                        [offset+3,offset+7,offset+4,offset]])
for f in (.32,.69):
 for i in range(len(rows)-1):
  ya,xa,za,la=rows[i];yb,xb,zb,lb=rows[i+1]
  x0=xa+(la-xa)*f;x1=xb+(lb-xb)*f
  z0=112+(za-112)*(1-f)**1.35;z1=112+(zb-112)*(1-f)**1.35
  w=2.3
  # sloped stone ledge follows each irregular cliff course.
  push([(x0-w,ya,z0-1.1),(x0+w,ya,z0-1.1),(x1+w,yb,z1-1.1),(x1-w,yb,z1-1.1),
        (x0-w,ya,z0+.05),(x0+w,ya,z0+.05),(x1+w,yb,z1+.05),(x1-w,yb,z1+.05)])
p['meshes'].append(bands)
metadata=p['royalEastPocketRock20261012']
metadata.update(status='PROVISIONAL_VISUAL_AND_BODY_QA_V4',studyBaseSHA256=hashlib.sha256(raw).hexdigest(),
 newMeshes=[(m['name'],len(m['vertices']),len(m['faces']))for m in p['meshes']if m['name'].startswith('repair_royal_east_pocket_')],
 designNotes=['Faceted bedrock with two irregular retained limestone courses','Do not accept until perspective renders are visibly better'])
(root/'royal-east-pocket-20261012.v4.staged.plan.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(root/'royal-east-pocket-20261012.v4.study.json').write_text(json.dumps(metadata,indent=2),encoding='utf8')
print('V4_MESHES',metadata['newMeshes'],flush=True)
