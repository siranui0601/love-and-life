import bpy,json,pathlib,sys,math,collections
from mathutils import Vector
cur=pathlib.Path(sys.argv[sys.argv.index('--')+1])
targets=['b107_noble_west_retaining_reconstruction','noble_west_retaining','b107_civic_foot_retaining_reconstruction']
report={}
for name in targets:
 obj=bpy.data.objects.get(name)
 if not obj:continue
 faces=[]
 for face in obj.data.polygons:
  v=[obj.matrix_world@obj.data.vertices[idx].co for idx in face.vertices]
  height=max(p.z for p in v)-min(p.z for p in v)
  if height<8:continue
  lengths=[(v[i+1]-v[i]).length for i in range(len(v)-1)]
  horizontal=math.hypot(max(p.x for p in v)-min(p.x for p in v),max(p.y for p in v)-min(p.y for p in v))
  n=obj.matrix_world.to_3x3()@face.normal
  center=sum(v,Vector())/len(v)
  faces.append(dict(i=face.index,center=[round(q,2)for q in center],z=[round(min(q.z for q in v),1),round(max(q.z for q in v),1)],
                    horiz=round(horizontal,1),normal=[round(q,2)for q in n],vert=round(height,1),
                    coords=[[round(q.x,1),round(q.y,1),round(q.z,1)]for q in v[:4]]))
 report[name]=dict(count=len(faces),tall=sorted(faces,key=lambda f:-f['horiz'])[:45])
(cur/'noble-retaining-vertical-panels.json').write_text(json.dumps(report,indent=2),encoding='utf8')
for name,x in report.items():
 print(name,x['count'])
 for f in x['tall'][:12]:print('   ',f['i'],f['center'],f['z'],'span',f['horiz'],'normal',f['normal'])
