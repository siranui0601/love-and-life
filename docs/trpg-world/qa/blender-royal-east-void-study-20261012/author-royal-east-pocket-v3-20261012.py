import json,pathlib,math,hashlib
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
raw=(root/'royal-forecourt-east-ascent-20261012.staged.plan.json').read_bytes()
plan=json.loads(raw)
material='stone'
name='repair_royal_east_pocket_graduated_bedrock_20261012'
assert not any(m['name']==name for m in plan['meshes'])
# Coordinates explicitly mapped from rendered white-space pixels back into local world.
# The visible void runs from royal masonry / citadel upper edge to Z112 existing ground.
sections=[
 (982,421,154,468),
 (994,415,160,471),
 (1006,410,175,473),
 (1018,405,184,473),
 (1030,401,195,473),
 (1042,411,201,473),
 (1054,422,204,475),
 (1065,437,201,478)]
verts=[];faces=[]
def append(V,ff):
 k=len(verts);verts.extend([[float(z)for z in v]for v in V]);faces.extend([[k+i for i in f]for f in ff])
for (ya,xa,za,la),(yb,xb,zb,lb) in zip(sections,sections[1:]):
 # Visibly natural inclined foundation: upper rocky lip, skirt at the low urban ground.
 V=[(xa,ya,za),(xb,yb,zb),(lb,yb,112),(la,ya,112),
    (xa,ya,112),(xb,yb,112)]
 ff=[[0,1,2,3],[0,4,5,1],[4,3,2,5],[0,3,4],[1,5,2]]
 append(V,ff)
 # shallow exposed limestone benches reward the high->low grade transition,
 # use restrained tier spacing instead of repeating high slender supports.
 if ya in (994,1018,1042):
  t=.55
  xx=xa+(la-xa)*t;XX=xb+(lb-xb)*t
  Z=za+(112-za)*t;ZZ=zb+(112-zb)*t
  offset=2.1
  append([(xx-1.2,ya,Z-.8),(XX-1.2,yb,ZZ-.8),(XX+offset,yb,ZZ-2.0),(xx+offset,ya,Z-2.0)],
         [[0,1,2,3]])
o=dict(name=name,vertices=verts,faces=faces,material='stone')
plan['meshes'].append(o)
# Native Z112 floors are x>=470 in the critical target; extend under the toe and overlap.
ground=dict(name='repair_royal_east_pocket_low_grade_link_20261012',vertices=[],faces=[],material='ground')
for a,b in zip(sections,sections[1:]):
 ya,xa,za,la=a;yb,xb,zb,lb=b
 k=len(ground['vertices'])
 ground['vertices'].extend([[xx,yy,112.0]for xx,yy in((xa-2,ya),(la+7,ya),(lb+7,yb),(xb-2,yb))])
 ground['faces'].extend([[k,k+1,k+2],[k,k+2,k+3]])
plan['meshes'].append(ground)
plan['royalEastPocketRock20261012']=dict(status='PROVISIONAL_VISUAL_QA',pilotSHA256=hashlib.sha256(raw).hexdigest(),
 newMeshes=[[name,len(verts),len(faces)],[ground['name'],len(ground['vertices']),len(ground['faces'])]],
 rows=sections,assumptions=['Rock cap graduated towards native castle at Z204 and town at Z112',
 'All meshes are visual and static; game collision not yet validated',
 'Do not promote without comparing white-hole screen pixels before/after'])
(root/'royal-east-pocket-20261012.v3.staged.plan.json').write_text(json.dumps(plan,separators=(',',':')),encoding='utf8')
(root/'royal-east-pocket-20261012.v3.study.json').write_text(json.dumps(plan['royalEastPocketRock20261012'],indent=2),encoding='utf8')
print('STAGED_ROCK',len(verts),len(faces),len(ground['vertices']),len(ground['faces']),flush=True)
