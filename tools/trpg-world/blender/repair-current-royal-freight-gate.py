"""Reposition only 1 lower gateway pier, lengthen its overhead lintel.
Fixes a preexisting 2-ray obstruction on the real 198m freight street.
Staging file only. Existing current is preserved until whole 198m QA PASS.
"""
import bpy,pathlib,json
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
target=root/'royal-freight-gate.pending.blend'
if target.exists():raise RuntimeError('Existing pending gate would be overwritten')
p=json.loads((root/'plan.json').read_text('utf8'))
name='current_civic_upper_short_stone'
m=next(x for x in p['meshes']if x['name']==name)
obj=bpy.data.objects.get(name)
if obj is None:raise RuntimeError('Stone gate absent')
if len(m['vertices'])!=24 or len(obj.data.vertices)!=24 or len(obj.data.polygons)!=18:raise RuntimeError('Gate topology mismatch')
before=[list(v)for v in m['vertices']]
for i in range(8):
 m['vertices'][i][1]-=6.0
 obj.data.vertices[i].co.y-=6.0
for i in range(16,24):
 if before[i][1]<648:
  m['vertices'][i][1]-=6.0
  obj.data.vertices[i].co.y-=6.0
obj.data.update()
after=[list(v)for v in m['vertices']]
if round(min(v[1]for v in after[:8]),2)!=638.90:raise RuntimeError('New south pier unexpected')
if round(min(v[1]for v in after[16:]),2)!=639.10:raise RuntimeError('New lintel unexpected')
audit=dict(status='PENDING_FREIGHT_PATH_QA',modifiedMesh=name,modifiedObjectCount=1,
 priorSouthPierCenter=[619.1,645.5],newSouthPierCenter=[619.1,639.5],
 northPierUnchanged=[619.1,652.5],overheadLintelM=[round(min(v[1]for v in after[16:]),1),round(max(v[1]for v in after[16:]),1)],
 preservedOriginalStairGeometry=True,
 caveat='Ancillary gallery route swept capsule and visual review still pending')
p['royalFreightGateClearance']=audit
(root/'royal-freight-gate-plan.staged.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(root/'royal-freight-gate-design.json').write_text(json.dumps(audit,indent=2),encoding='utf8')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('FREIGHT_GATE_PENDING',audit,'bytes',target.stat().st_size)
