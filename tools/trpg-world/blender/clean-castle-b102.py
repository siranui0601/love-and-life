"""B102 trim orphaned facade openings after old castle compound removal.
All other district faces and materials remain unchanged.
"""
import bpy,json,pathlib,sys
import numpy as np
source=pathlib.Path(sys.argv[sys.argv.index('--')+1])
out=pathlib.Path(sys.argv[sys.argv.index('--')+2])
if out.exists():raise RuntimeError('Output exists')
out.mkdir()
for name in ['plan.json','parcels.json']:
 src=source/name
 dst=out/name
 import shutil
 shutil.copy2(src,dst)
study=dict(base=source.name,status='WIP_VISUAL_QA',removedOldCastleTowers=[],removedFacadeQuads=0)
mobj=bpy.data.objects.get('District facade openings')
if mobj is None or mobj.type!='MESH':raise RuntimeError('Missing district facade openings')
old=mobj.data
if len(old.vertices)!=4*len(old.polygons):raise RuntimeError('Unexpected shared mesh face topology')
n=len(old.polygons);v=len(old.vertices)
cent=np.zeros((n,3),dtype=np.float32)
old.polygons.foreach_get('center',cent.ravel())
exclude=(cent[:,0]>95)&(cent[:,0]<455)&(cent[:,1]>945)&(cent[:,1]<1225)&(cent[:,2]>203)
keep=np.flatnonzero(~exclude)
study['removedFacadeQuads']=int(exclude.sum())
if not 1000<study['removedFacadeQuads']<15000:raise RuntimeError('Unexpected removed facade area')
coords=np.empty((v,3),dtype=np.float32)
old.vertices.foreach_get('co',coords.ravel())
# Unique quad verts -> four vertices for every kept face. ndarray slicing
# avoids Python loops through >1.7 million coordinates during filtering.
packed=coords.reshape((n,4,3))[keep].reshape((-1,3))
new=bpy.data.meshes.new('District facade openings - without abandoned castle')
new.vertices.add(len(packed))
new.vertices.foreach_set('co',packed.ravel())
new.loops.add(len(keep)*4)
new.loops.foreach_set('vertex_index',np.arange(len(keep)*4,dtype=np.int32))
new.polygons.add(len(keep))
new.polygons.foreach_set('loop_start',(np.arange(len(keep),dtype=np.int32)*4))
new.polygons.foreach_set('loop_total',np.full(len(keep),4,dtype=np.int32))
new.update()
for mat in old.materials:new.materials.append(mat)
mobj.data=new
for ob in list(bpy.data.objects):
 if ob.name.startswith(('Castle corner tower','Castle highest tower')):
  study['removedOldCastleTowers'].append(ob.name)
  bpy.data.objects.remove(ob,do_unlink=True)
for ob in bpy.data.objects:
 if ob.type=='CAMERA':ob.hide_set(True)
(out/'castle-cleanup.json').write_text(json.dumps(study,indent=2),encoding='utf-8')
scene=bpy.context.scene
cam=scene.camera
for name,pos,target,scale in [
 ('B102-castle-clean',(575,650,395),(308,1090,232),535),
 ('B102-castle-close',(530,850,335),(333,1110,220),380)]:
 from mathutils import Vector
 c=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,c);scene.collection.objects.link(ob)
 ob.location=pos
 ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
 c.clip_end=20000
 c.type='ORTHO';c.ortho_scale=scale
 scene.camera=ob;scene.render.filepath=str(out/(name+'.png'))
 scene.render.resolution_x=1300;scene.render.resolution_y=850
 bpy.ops.render.render(write_still=True)
 ob.hide_set(True)
scene.camera=cam
scene['status']='B102 castle legacy facade cleaned; rest of city WIP'
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('Refuse existing B102 blend')
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('B102_SAVED',target,study['removedFacadeQuads'],len(study['removedOldCastleTowers']))
