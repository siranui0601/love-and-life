"""Guard and structurally line the newly opened upper castle stair mouth
with solid segmented stone walls rising to the upper terrace.
One batched mesh; no canopy and no footway-blocking lintel.
"""
import bpy,bmesh,json,pathlib,math
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'castle-stair-upper-cut-plan.staged.json').read_text('utf8'))
r=next(q for q in p['routes']if q['id']=='castle_wall_stairs')
seg=[v for v in r['points']if 200.8<=v[2]<=203.62]
if len(seg)<10:raise RuntimeError('Upper stair shape unexpected')
verts=[];faces=[]
def prism(A,B,offset,width=.55):
 dx=B[0]-A[0];dy=B[1]-A[1];L=math.hypot(dx,dy)
 if L<.002:return
 nx=-dy/L;ny=dx/L
 q=[]
 for x,y,z in(A,B):
  cx=x+nx*offset;cy=y+ny*offset
  q.append(((cx-nx*width/2,cy-ny*width/2,z-.17),
            (cx+nx*width/2,cy+ny*width/2,z-.17),
            (cx-nx*width/2,cy-ny*width/2,205.32),
            (cx+nx*width/2,cy+ny*width/2,205.32)))
 start=len(verts)
 verts.extend((q[0][0],q[1][0],q[1][1],q[0][1],q[0][2],q[1][2],q[1][3],q[0][3]))
 faces.extend([[start+j for j in ids] for ids in
  ((0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7))])
for A,B in zip(seg,seg[1:]):
 for offset in (-2.84,2.84):
  prism(A,B,offset)
name='current_castle_west_stair_cut_stone_liners'
if bpy.data.objects.get(name):raise RuntimeError('Refuse duplicate')
mesh=bpy.data.meshes.new(name)
mesh.from_pydata(verts,[],faces);mesh.update()
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
coll=bpy.data.collections.new('Royal West Stair Recessed Portal Guard')
bpy.context.scene.collection.children.link(coll)
obj=bpy.data.objects.new(name,mesh);coll.objects.link(obj)
material=bpy.data.materials.get('current_castle_stair_royal_limestone') or bpy.data.materials.new('current_castle_stair_royal_limestone')
material.diffuse_color=(.69,.67,.59,1)
mesh.materials.append(material)
p['meshes'].append(dict(name=name,vertices=[list(q.co)for q in mesh.vertices],
 faces=[list(q.vertices)for q in mesh.polygons],material=material.name))
p['currentCastleWestStairTopCut'].update(status='PENDING_ACTUAL_3D_QA',
 guardName=name,guardBatchedMeshFaces=len(mesh.polygons),
 levelTopM=205.32,ledgeProtection=True)
(root/'castle-stair-upper-guard-plan.staged.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
pending=root/'castle-stair-upper-guard.pending.blend'
if pending.exists():raise RuntimeError('Pending stage exists')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(pending))
print('CASTLE_STAIR_GUARD_STAGED',len(mesh.polygons),pending.stat().st_size)
