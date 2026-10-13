"""Identical camera/framing for before-and-after scene comparison."""
import bpy,sys
from mathutils import Vector
scene=bpy.context.scene
mass=bpy.data.collections['Optional parcel massing - UNACCEPTED'];mass.hide_render=False;mass.hide_viewport=False
bpy.data.collections['Parcel footprints'].hide_render=True
ca=bpy.data.cameras.new('Pilot comparison');ob=bpy.data.objects.new('Pilot comparison',ca);scene.collection.objects.link(ob)
ob.location=(-1300,-1800,650);ob.rotation_euler=(Vector((-650,-950,14))-ob.location).to_track_quat('-Z','Y').to_euler()
ca.type='ORTHO';ca.ortho_scale=650;ca.clip_end=20000;scene.camera=ob
scene.render.filepath=sys.argv[sys.argv.index('--')+1];bpy.ops.render.render(write_still=True)
