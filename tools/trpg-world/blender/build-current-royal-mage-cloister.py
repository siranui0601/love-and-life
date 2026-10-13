"""Royal court mages: actual connected archive cloister and summoning
garden portal. Trial only, promote after geometry+visual acceptance.
"""
import bpy,bmesh,json,pathlib,math
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'))
stage=root/'mage-royal-cloister-v1.pending.blend'
if stage.exists():raise RuntimeError('Existing trial')
remove=['b100_scribe_archive_wall_3','b100_royal_ritual_annex_wall_0']
for name in remove:
 match=[m for m in p['meshes']if m['name']==name]
 o=bpy.data.objects.get(name)
 if len(match)!=1 or not o or len(o.data.polygons)!=6:raise RuntimeError('Changed portal structure '+name)
 bpy.data.objects.remove(o,do_unlink=True)
p['meshes']=[m for m in p['meshes']if m['name'] not in remove]
col=bpy.data.collections.new('Royal Arcane Cloister / Archive / Summoning Court')
bpy.context.scene.collection.children.link(col)
P={'stone':(.68,.65,.59,1),'basalt':(.43,.45,.48,1),'bronze':(.66,.48,.23,1),
   'slate':(.20,.31,.43,1),'garden':(.25,.42,.28,1),'oak':(.38,.26,.17,1)}
G={k:([],[])for k in P}
faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
def emit(mat,vs,ps):
 a,b=G[mat];j=len(a);a.extend([list(q)for q in vs]);b.extend([[j+i for i in f]for f in ps])
def block(mat,x,y,z,w,d,h):
 xy=[(x-w/2,y-d/2),(x+w/2,y-d/2),(x+w/2,y+d/2),(x-w/2,y+d/2)]
 emit(mat,[[i,j,zz]for zz in(z-h/2,z+h/2) for i,j in xy],faces)
def road(name,xy,width=3.3):
 pts=[[x,y,70]for x,y in xy]
 if any(r['id']==name for r in p['routes']):raise RuntimeError('Duplicate road')
 for a,b in zip(pts,pts[1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
  if L<.1:continue
  nx=-dy/L*width/2;ny=dx/L*width/2
  v=[[a[0]+nx,a[1]+ny,70.08],[b[0]+nx,b[1]+ny,70.08],
     [b[0]-nx,b[1]-ny,70.08],[a[0]-nx,a[1]-ny,70.08]]
  emit('stone',v,[[0,1,2,3]])
 p['routes'].append(dict(id=name,kind='palace',width=width,points=pts,
 z0=70,z1=70,grade=0,lengthM=round(sum(math.dist(a,b)for a,b in zip(pts,pts[1:])),2)))
# Western archive wall rebuilt into REAL, sheltered-but-open walking gate,
# continuous below its existing clerestory with 7m wide opening.
block('stone',1092,652,75.75,1,6,11.5)   # y=649...655
block('stone',1092,664,75.75,1,6,11.5)   # y=661...667
block('stone',1092,658,80.4,1.45,6.3,2.2) # arch/lintel above Z79.3
for y in (654.5,661.5):
 block('basalt',1091.4,y,76.0,1.0,1.25,12)
 block('bronze',1090.7,y,81.8,.45,1.5,.35)
# Existing south ritual facade (1056..1076, y690.5..691.5)
# becomes two wings, a north-central six metre entry and high lintel.
block('stone',1059.1,691,76.5,6.2,1,13.0)
block('stone',1072.9,691,76.5,6.2,1,13.0)
block('stone',1066,691,81.9,7.4,1.65,2.4)
for x in (1062.7,1069.3):
 block('basalt',x,689.9,76.5,1.2,1.3,13)
 block('bronze',x,689.5,83.1,1.3,1.5,.35)
# Main archive passage from the existing tower gallery's east end.
# Continuous stone road with open 4.5m character, never a long
# inaccessible "fake" walkway ending at the archive wall.
road('royal_arcane_tower_archive_open_cloister',[(1076,651),(1082,657),(1092,658),(1095,658)],3.25)
road('royal_arcane_summoning_garden_route',[(1073,678),(1068,682),(1066,691),(1066,696)],3.2)
# Eastern stone cloister: three bays; freestanding pillars outside main
# walkway widths, no walls that could obstruct an existing district route.
for x,y in ((1080,663),(1085,664),(1090,664)):
 block('stone',x,y,74.9,.8,.8,9.6)
 block('bronze',x,y,79.8,1.0,1.05,.5)
for x,y in ((1082.5,663.5),(1087.5,664)):
 block('slate',x,y,79.9,5.6,.8,.5)
# An interior-ready register courtyard: benches off path, illuminated
# rune plinth and herbarium beds south of the summoning annex.
block('basalt',1086.0,671.8,70.15,9.5,5.2,.25)
for xx in(1083.8,1088.2):
 block('oak',xx,674.9,70.8,3.8,.8,.65)
for x,y in ((1082,682),(1087,682),(1092,682)):
 block('garden',x,y,70.3,3.1,3.2,.25)
block('stone',1086,677,71.1,1.8,1.8,1.8)
block('bronze',1086,677,72.2,.45,.45,.5)
# High ceremonial marker readable from courtyard without blocking portals.
block('bronze',1066,690.0,84.0,3.1,.35,.7)
created=[]
for k,(vs,fs)in G.items():
 if not fs:continue
 name='current_royal_mage_cloister_'+k
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],fs);mesh.update()
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
 o=bpy.data.objects.new(name,mesh);col.objects.link(o)
 mat=bpy.data.materials.get(name)or bpy.data.materials.new(name)
 mat.diffuse_color=P[k];mesh.materials.append(mat)
 p['meshes'].append(dict(name=name,vertices=[list(v.co)for v in mesh.vertices],
 faces=[list(q.vertices)for q in mesh.polygons],material=name))
 created.append(name)
p['audit']['routeCount']=len(p['routes'])
meta=dict(status='PENDING_QA_ART',oldWallMeshes=remove,newMeshes=created,
 newRoutes=['royal_arcane_tower_archive_open_cloister','royal_arcane_summoning_garden_route'],
 plotOverlapM2=0,realArchivePortal=True,realSummoningPortal=True,
 purpose='Court mages controlled archive, summoning research and security district',
 caveats=['Tower interior and archive library room remain conceptual, not game-navigable',
 'No NPC guard/summoning actions, no complete precinct layout acceptance',
 'Two annex wall cuts and nearby street obstruction must pass Blender QA'])
p['currentRoyalMageCloister']=meta
(root/'mage-royal-cloister-plan.staged.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(root/'mage-royal-cloister-study.staged.json').write_text(json.dumps(meta,indent=2),encoding='utf8')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(stage))
print('MAGE_ROYAL_CLOISTER_STAGED',len(created),'newRoutes',meta['newRoutes'],stage.stat().st_size)
