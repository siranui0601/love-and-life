"""Lossless batching of 362 royal-mage-wall stair support meshes.
No realignment / stair geometry redesign is claimed.
"""
import bpy,json,pathlib,hashlib
from mathutils import Vector
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'))
out=root/'mage-stair-abutment-batched.pending.blend'
if out.exists():raise RuntimeError('Existing staged file: refuse clobber')
prefix='mage_quarter_mage_wall_short_stairs_abutment_'
selected=[m for m in p['meshes']if m['name'].startswith(prefix)]
selected.sort(key=lambda m:int(m['name'].rsplit('_',1)[-1]))
if len(selected)!=362:raise RuntimeError('Input count changed '+str(len(selected)))
assert [int(q['name'].rsplit('_',1)[-1])for q in selected]==list(range(362))
vertex=[];polygons=[];metadata=[]
pMeshes={q['name']:q for q in p['meshes']}
source_hash=hashlib.sha256()
for o in selected:
 name=o['name'];ob=bpy.data.objects.get(name)
 if ob is None or ob.type!='MESH':raise RuntimeError('Missing '+name)
 if len(ob.data.vertices)!=len(o['vertices']) or len(ob.data.polygons)!=len(o['faces']):
  raise RuntimeError('Source geometry mismatch '+name)
 if not all(all(abs(float(q)-float(x))<0.00013 for q,x in zip(ob.data.vertices[i].co,o['vertices'][i])) for i in (0,len(o['vertices'])-1)):
  raise RuntimeError('Source vertex mismatch '+name)
 if ob.modifiers or not ob.matrix_world.is_identity:raise RuntimeError('Object uses transform/modifier '+name)
 k=len(vertex)
 vertex.extend([list(v.co) for v in ob.data.vertices])
 polygons.extend([[k+j for j in face.vertices]for face in ob.data.polygons])
 for q in (list(v.co)for v in ob.data.vertices):
  for val in q:source_hash.update(float(val).hex().encode())
 metadata.append(dict(name=name,faces=len(o['faces']),vertices=len(o['vertices'])))
batch='current_mage_wall_stair_abutments_integrated_stone'
if bpy.data.objects.get(batch):raise RuntimeError('Target already exists')
mesh=bpy.data.meshes.new(batch)
mesh.from_pydata(vertex,[],polygons);mesh.update()
coll=bpy.data.collections.new('Mage quarter integrated stair/abutment masonry')
bpy.context.scene.collection.children.link(coll)
obj=bpy.data.objects.new(batch,mesh);coll.objects.link(obj)
mat=bpy.data.materials.get('stone')
if mat:mesh.materials.append(mat)
assert len(obj.data.polygons)==sum(len(q['faces'])for q in selected)
assert len(obj.data.vertices)==sum(len(q['vertices'])for q in selected)
for o in selected:
 old=bpy.data.objects.get(o['name'])
 bpy.data.objects.remove(old,do_unlink=True)
p['meshes']=[m for m in p['meshes']if not m['name'].startswith(prefix)]
p['meshes'].append(dict(name=batch,vertices=vertex,faces=polygons,material='stone'))
meta=dict(status='PENDING_ART_QA',scope='mage quarter stair abutments ONLY',
 oldObjectCount=362,newObjectCount=1,
 totalOriginalFaces=sum(len(q['faces'])for q in selected),
 totalOriginalVertices=len(vertex),newFaces=len(polygons),
 originalGeometryHash=source_hash.hexdigest(),sourceNames=[x['name']for x in selected],
 noRoadAlteration=True,noGeometryRelocation=True,
 caveats=['This is a performance/editability cleanup, not redesign of stairs/landings, wall gaps or level design',
 'Still need player-view and complete corridor geometry validation'])
p['mageStairSupportBatch20261011']=meta
(root/'mage-abutment-plan.staged.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(root/'mage-abutment-study.staged.json').write_text(json.dumps(meta,indent=2),encoding='utf8')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('MAGE_ABUTMENT_STAGE',out.stat().st_size,'old',len(selected),'new',len(obj.data.polygons),'sha',meta['originalGeometryHash'][:16])
