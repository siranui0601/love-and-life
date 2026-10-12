import bpy,json,pathlib,hashlib
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
plan=json.loads((root/'user-p0-12-gaps-eastrock-b-20261012.accepted.plan.json').read_text('utf8'))
orig=json.loads((root/'plan.json').read_text('utf8'))
mesh_old={m['name']for m in orig['meshes']}
new=[m for m in plan['meshes']if m['name']not in mesh_old]
assert len(new)==24, len(new)
assert plan['userReportedPriority12_20261012']['status']=='ACCEPTED_USER_P0_12_STRUCTURAL_FIRST_PASS_20261012'
for mesh in new:
 ob=bpy.data.objects.get(mesh['name'])
 assert ob and ob.type=='MESH',('Missing',mesh['name'])
 assert len(ob.data.vertices)==len(mesh['vertices']),('Vertex count',mesh['name'])
 assert len(ob.data.polygons)==len(mesh['faces']),('Face count',mesh['name'])
 for i in range(len(mesh['vertices'])):
  a=ob.data.vertices[i].co;b=mesh['vertices'][i]
  assert max(abs(a[j]-b[j])for j in range(3))<.0008,('Geometry drift',mesh['name'],i)
print('MESH_MATCH',len(new),'ROUTES',len(plan['routes']),flush=True)
S=bpy.context.scene
S['UserPriority12']='ACCEPTED_USER_P0_12_STRUCTURAL_FIRST_PASS_20261012'
S['UserPriority12Audit']='9 requested floors; 4 requested walls; 12 unique spots. Static collision clear. 14 old citywide anomalies remain.'
S['UserPriority12AcceptedPlanSHA256']=hashlib.sha256((root/'user-p0-12-gaps-eastrock-b-20261012.accepted.plan.json').read_bytes()).hexdigest()
out=root/'user-p0-12-gaps-eastrock-b-20261012.accepted.blend'
assert not out.exists(),'Refusing overwrite'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('ACCEPTED_BLEND',out.stat().st_size,flush=True)
