import bpy,json,pathlib,bmesh
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
P=json.loads((root/'user-p0-12-gaps-eastrock-b-20261012.staged.plan.json').read_text('utf8'))
old=bpy.data.objects.get('repair_user_p0_F05_integrated_stone_masonry_v7');assert old
bpy.data.objects.remove(old,do_unlink=True)
n=P['userReportedPriority12_20261012']['supportWedges'][0]['meshName']
m=next(x for x in P['meshes']if x['name']==n)
mesh=bpy.data.meshes.new(n);mesh.from_pydata(m['vertices'],[],m['faces']);mesh.update()
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
nm=sum(not e.is_manifold for e in bm.edges)
assert nm==0,nm
bm.to_mesh(mesh);bm.free()
col=bpy.data.collections['PRIORITY_12_LOCATION_REPAIRS_UNVERIFIED']
obj=bpy.data.objects.new(n,mesh);col.objects.link(obj)
mesh.materials.append(bpy.data.materials['stone'])
bpy.context.scene['UserPriority12']='EASTROCK_B_PENDING_ALL_P0_QA'
out=root/'user-p0-12-gaps-eastrock-b-20261012.pending.blend'
assert not out.exists()
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('EASTROCK_B_BUILT',len(mesh.polygons),'SAVED',out.stat().st_size,flush=True)
