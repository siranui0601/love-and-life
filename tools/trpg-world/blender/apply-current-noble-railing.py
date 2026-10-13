"""Incrementally update THE SAME CURRENT BLEND. Apply the approved
out-of-corridor stair side rails, lanterns and masonry caps. Idempotent.
NO new numbered .blend path. Scenes from B116 remain untouched otherwise.
"""
import bpy,bmesh,json,pathlib,sys,math
from mathutils import Vector
current=pathlib.Path(sys.argv[sys.argv.index('--')+1])
report=json.loads((current/'rail-design-current.json').read_text('utf8'))
collname='Current noble stone balustrades and night lanterns'
existing=bpy.data.collections.get(collname)
if existing:
 for obj in list(existing.objects):bpy.data.objects.remove(obj,do_unlink=True)
 bpy.data.collections.remove(existing)
col=bpy.data.collections.new(collname)
bpy.context.scene.collection.children.link(col)
palette={
 'ashlar':(.57,.54,.46),
 'pale_stone':(.77,.72,.62),
 'iron':(.105,.112,.123),
 'glass':(.89,.58,.16)
}
materials={}
for name,c in palette.items():
 m=bpy.data.materials.get('Noble '+name)or bpy.data.materials.new('Noble '+name)
 m.diffuse_color=(*c,1)
 materials[name]=m
buffers={name:([],[]) for name in materials}
def faces_for(mat,coords,polys):
 vs,fs=buffers[mat];off=len(vs)
 vs.extend(coords);fs.extend([[off+i for i in face]for face in polys])
def cube(mat,name,ctr,size):
 x,y,z=ctr;w,d,h=size
 coords=[[x-w/2,y-d/2,z-h/2],[x+w/2,y-d/2,z-h/2],
         [x+w/2,y+d/2,z-h/2],[x-w/2,y+d/2,z-h/2],
         [x-w/2,y-d/2,z+h/2],[x+w/2,y-d/2,z+h/2],
         [x+w/2,y+d/2,z+h/2],[x-w/2,y+d/2,z+h/2]]
 faces_for(mat,coords,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
def prism_between(mat,a,b,diameter=.13):
 a=Vector(a);b=Vector(b)
 v=b-a
 if v.length<.1:return
 tangent=v.normalized();across=tangent.cross(Vector((0,0,1)))
 if across.length<.005:across=Vector((1,0,0))
 across.normalize()
 above=across.cross(tangent).normalized()
 if above.z<0:above.negate()
 l=diameter/2
 p=[a-across*l-above*l,a+across*l-above*l,a+across*l+above*l,a-across*l+above*l,
    b-across*l-above*l,b+across*l-above*l,b+across*l+above*l,b-across*l+above*l]
 faces_for(mat,[list(q)for q in p],[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
posts=0;bars=0;lamps=0
for area in report['design']:
 for side,bank in area['anchors'].items():
  for i,a in enumerate(bank):
   x,y,z=a['x'],a['y'],a['z']
   cube('ashlar','pier',(x,y,z+.6),(.62,.62,1.2))
   cube('pale_stone','capital',(x,y,z+1.28),(.94,.94,.20))
   cube('iron','finial',(x,y,z+1.46),(.14,.14,.24))
   posts+=1
   if i%9==5:
    # Lantern acts as nighttime route indicator in a long staircase.
    cube('iron','lantern stem',(x,y,z+1.85),(.22,.22,.9))
    cube('iron','lantern base',(x,y,z+2.35),(.66,.66,.13))
    cube('glass','lantern core',(x,y,z+2.66),(.5,.5,.52))
    cube('iron','lantern roof',(x,y,z+3.01),(.76,.76,.17))
    lamps+=1
 for seg in area['rails']:
  a=seg['a'];b=seg['b']
  for h,diam in ((.83,.12),(1.28,.16)):
   prism_between('iron',(a['x'],a['y'],a['z']+h),(b['x'],b['y'],b['z']+h),diam)
   bars+=1
for name,(vertices,faces) in buffers.items():
 if not faces:continue
 me=bpy.data.meshes.new('Current noble '+name+'_mesh')
 me.from_pydata(vertices,[],faces);me.update()
 bm=bmesh.new();bm.from_mesh(me)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 obj=bpy.data.objects.new('Current NobleRailing '+name,me)
 col.objects.link(obj);me.materials.append(materials[name])
# Render from both side and eye view to assess the stair architecture,
# while never altering the base royal and lower-city route centerlines.
scene=bpy.context.scene
scene.render.resolution_x=1280
scene.render.resolution_y=850
scene.render.resolution_percentage=100
views=[
 ('current-east-noble-rail',(-535,400,174),(-587,554,60),290),
 ('current-west-noble-rail',(-1000,670,175),(-815,810,67),340),
 ('current-east-person-route',(-574,511,45),(-609,553,67),None)]
for name,pos,look,scale in views:
 camdata=bpy.data.cameras.get(name)or bpy.data.cameras.new(name)
 camera=bpy.data.objects.get(name)
 if camera is None:
  camera=bpy.data.objects.new(name,camdata)
  scene.collection.objects.link(camera)
 camera.location=pos
 camera.rotation_euler=(Vector(look)-camera.location).to_track_quat('-Z','Y').to_euler()
 camdata.clip_start=.1;camdata.clip_end=16000;camdata.lens=28
 if scale:camdata.type='ORTHO';camdata.ortho_scale=scale
 else:camdata.type='PERSP'
 scene.camera=camera
 scene.render.filepath=str(current/(name+'.png'))
 bpy.ops.render.render(write_still=True)
 camera.hide_set(True)
scene.camera=bpy.data.objects.get('current-east-noble-rail')
scene['noble_railing']='Stair side piers and iron bars applied; check full gameplay collision before acceptance'
scene['noble_rail_posts']=posts;scene['noble_rail_bars']=bars;scene['noble_rail_lamps']=lamps
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(current/'capital-parcel-review.blend'))
print('CURRENT_OVERWROTE',posts,'piers',bars,'bars',lamps,'lanterns')
