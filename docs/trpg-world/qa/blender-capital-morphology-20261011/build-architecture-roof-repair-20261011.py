import bpy,collections,hashlib,math,json,pathlib
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
plan=json.loads((root/'architecture-repair-20261011.staged.plan.json').read_text('utf8'))
study=json.loads((root/'architecture-repair-20261011.study.json').read_text('utf8'))
oldPrefixes=tuple(study['removed'])
old=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith(oldPrefixes)]
if len(old)!=sum(study['removed'].values()):raise RuntimeError('Unexpected old object count '+str(len(old)))
homeCollections={p.name:next(iter([c for c in bpy.data.objects.get(p.name).users_collection]),bpy.context.scene.collection)for p in old[:0]}
for o in old:bpy.data.objects.remove(o,do_unlink=True)
for name,nFaces in study['added']:
 m=next(q for q in plan['meshes']if q['name']==name)
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(m['vertices'],[],m['faces']);mesh.update()
 ob=bpy.data.objects.new(name,mesh)
 bpy.context.scene.collection.objects.link(ob)
 mat=bpy.data.materials.get(m.get('material','stone'))
 if mat:mesh.materials.append(mat)
 if len(mesh.polygons)!=nFaces:raise RuntimeError('Mesh face mismatch '+name)
 print('INSTALLED',name,len(mesh.vertices),len(mesh.polygons),flush=True)
palette={
'lower':[(.29,.31,.33,1),(.43,.34,.28,1),(.35,.38,.32,1),(.32,.33,.38,1)],
'ajin':[(.33,.30,.25,1),(.30,.39,.42,1),(.49,.34,.28,1),(.35,.33,.42,1)],
'market':[(.55,.33,.26,1),(.37,.38,.41,1),(.47,.30,.22,1),(.32,.42,.38,1)],
'quay':[(.32,.35,.40,1),(.44,.29,.24,1),(.29,.41,.41,1),(.47,.38,.29,1)]}
def key3(v):return (round(v[0],3),round(v[1],3),round(v[2],3))
details=[];accents={}
for zone in ('lower','ajin','market','quay'):
 walls=bpy.data.objects[zone+' building walls'].data
 roofs=bpy.data.objects[zone+' roofs'].data
 wall_faces=list(walls.polygons)
 start=0;was_ground=False;spans=[]
 for f in walls.polygons:
  is_ground=sum(abs(walls.vertices[i].co.z-14)<.01 for i in f.vertices)>=2
  if is_ground and not was_ground and f.index>start:spans.append((start,f.index));start=f.index
  was_ground=is_ground
 spans.append((start,len(walls.polygons)))
 keys={};conflicts=set();buildingColors={};groupsChanged=0;changedWall=0
 chimV=[];chimF=[]
 def addChimney(pt,size,height):
  x,y,z=pt; w=size/2
  pts=[[x+u*w,y+v*w,z+zz]for zz in(-.8,height)for u,v in[(-1,-1),(1,-1),(1,1),(-1,1)]]
  base=len(chimV);chimV.extend(pts)
  for q in ([0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]):chimF.append([base+i for i in q])
 for gid,(a,b) in enumerate(spans):
  vertIds={i for f in wall_faces[a:b]for i in f.vertices}
  coords=[walls.vertices[i].co for i in vertIds]
  if not coords:continue
  up=[v.z for v in coords if v.z>14.1]
  if not up:continue
  eave=min(up);ridge=max(up)
  cx=sum(v.x for v in coords)/len(coords);cy=sum(v.y for v in coords)/len(coords)
  rnd=int(hashlib.sha256(('%s|%.1f|%.1f'%(zone,cx,cy)).encode()).hexdigest()[:8],16)
  roll=rnd%100
  shift=(0. if roll>=42 else([-1.4,1.3,2.7,4.0][rnd//100%4]))
  if eave+shift-14<4.2:shift=max(0,shift)
  if zone=='market' and ridge+shift>40:shift=max(0,40-ridge)
  pitch=(0 if rnd%5>=2 or ridge-eave<1.2 else (0.9 if rnd%7<4 else -.3))
  groupShift=abs(shift)+abs(pitch)
  if groupShift>.05:groupsChanged+=1
  buildingColors[gid]=rnd%4
  for k in vertIds:
   v=walls.vertices[k].co
   if v.z<14.1:continue
   extra=pitch if v.z>eave+.3 else 0
   old=key3(v);change=shift+extra
   if old in keys and abs(keys[old][0]-change)>.02:conflicts.add(old)
   else:keys[old]=(change,gid)
   if change: v.z+=change;changedWall+=1
  if rnd%113==2 and ridge+shift>22.5:
   peak=max(coords,key=lambda v:v.z)
   addChimney((peak.x,peak.y,peak.z),.9+(rnd%3)*.17,1.8+(rnd%5)*.24)
 for vkey in conflicts:keys.pop(vkey,None)
 matching=0;changedRoof=0;assignments={}
 for vert in roofs.vertices:
  old=key3(vert.co);entry=keys.get(old)
  if entry:
   matching+=1;delta,gid=entry
   if delta:vert.co.z+=delta;changedRoof+=1
   assignments[vert.index]=gid
 mats=[]
 for idx,color in enumerate(palette[zone]):
  name='Capital 20261011 '+zone+' roof '+str(idx)
  mat=bpy.data.materials.get(name) or bpy.data.materials.new(name)
  mat.diffuse_color=color;mats.append(len(roofs.materials));roofs.materials.append(mat)
 colored=0
 for f in roofs.polygons:
  gs=[assignments.get(i)for i in f.vertices]
  if gs and gs[0] is not None and all(k==gs[0]for k in gs):
   f.material_index=mats[buildingColors[gs[0]]];colored+=1
 if matching/len(roofs.vertices)<.96:raise RuntimeError('Roof coupling insufficient '+zone+' '+str(matching/len(roofs.vertices)))
 if chimF:
  me=bpy.data.meshes.new(zone+' rooftop stone chimneys mesh');me.from_pydata(chimV,[],chimF);me.update()
  oo=bpy.data.objects.new('current_'+zone+'_roofline_chimney_variation',me);bpy.context.scene.collection.objects.link(oo)
  stone=bpy.data.materials.get('stone')
  if stone:me.materials.append(stone)
 summary=dict(zone=zone,buildingGroups=len(spans),heightAndPitchChanged=groupsChanged,wallVerticesChanged=changedWall,roofVerticesMatched=matching,roofVerticesChanged=changedRoof,roofFacesColored=colored,chimneys=len(chimF)//6,conflictVertices=len(conflicts))
 details.append(summary);print('ROOFLINE_REBALANCE',json.dumps(summary),flush=True)
out=root/'architecture-repair-20261011.pending.blend'
if out.exists():raise RuntimeError('Pending build already exists. Refusing overwrite.')
bpy.context.scene['architecture_20261011']='SCOPED_PILOT pending visual/floor QA; not entire city accepted'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out))
study['rooflineVariation']=details
study['pendingBlendFile']=out.name
(root/'architecture-repair-20261011.build.json').write_text(json.dumps(study,indent=2,ensure_ascii=False),encoding='utf8')
print('STAGED_BLEND_READY',out.stat().st_size,'removedOldMeshes',len(old),flush=True)
