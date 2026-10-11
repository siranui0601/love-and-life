import bpy,json,pathlib
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'civic-stairtower-20261012.v6.staged.plan.json').read_text('utf8'))
meta=p['civicStairTower20261012']; old=meta['removed']
missing=[n for n in old if bpy.data.objects.get(n) is None]
if missing:raise RuntimeError('Source object missing: '+str(missing))
for name in old:bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)
# Blender-only decorative winch has no source Plan mesh and would otherwise be orphaned.
winch=bpy.data.objects.get('current_royal_freight_hoist_winch')
if winch:bpy.data.objects.remove(winch,do_unlink=True);print('REMOVED_ORPHAN_WINCH')
colors={
 'stone':(.55,.56,.53,1),'limestone':(.72,.68,.60,1),'Noble iron':(.16,.20,.24,1),
 'slate':(.17,.26,.35,1),'paving':(.49,.48,.42,1)}
for name,nv,nf in meta['newMeshes']:
 objdata=next(o for o in p['meshes']if o['name']==name)
 m=bpy.data.meshes.new(name);m.from_pydata(objdata['vertices'],[],objdata['faces']);m.update()
 if len(m.polygons)!=nf:raise RuntimeError('Mesh count '+name)
 ob=bpy.data.objects.new(name,m);bpy.context.scene.collection.objects.link(ob)
 material=bpy.data.materials.get(objdata['material'])
 if not material:
  material=bpy.data.materials.new(objdata['material']);material.diffuse_color=colors.get(objdata['material'],(.5,.5,.5,1))
 m.materials.append(material)
 print('BUILT',name,len(m.polygons),flush=True)
out=root/'civic-stairtower-20261012.v6.pending.blend'
if out.exists():raise RuntimeError('Staged output exists')
bpy.context.scene['civic_stairtower_20261012']='PROVISIONAL: no terrain physics/capsule or aesthetics approval'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('PENDING',out.stat().st_size,flush=True)
