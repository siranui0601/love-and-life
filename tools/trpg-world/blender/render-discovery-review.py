"""Stable eye/context images of discoveries and cargo transfer, from actual meshes."""
import bpy,json,pathlib,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1]);p=json.loads((out/'plan.json').read_text());s=bpy.context.scene;cameras=[]
for site in p.get('discoverySitesStudy',{}).get('destinations',[]):
 if site['id']=='garden_watchtower':
  x,y,z=site['position'];cameras.extend([('Watchtower-context',(x+90,y-125,z+65),(x,y,z+10),180,1),('Watchtower-entry',(x,y-25,z+1.7),(x+8,y-8,z+4),None,1),('Watchtower-prospect',(x+7,y,z+19.7),(200,1050,204),None,1),('Watchtower-city-prospect',(x+7,y,z+19.7),(1400,-100,22),None,1),('Watchtower-river-prospect',(x,y-6,z+19.7),(500,-680,15),None,1)])
 if site['id']=='central_market_stalls':cameras.extend([('Market-stalls-context',(130,-230,130),(0,-50,16),220,1),('Market-stalls-eye',(0,-50,15.7),(35,-30,16),None,1)])
if p.get('backcourtMarketStudy'):
 site=p['backcourtMarketStudy'];x,y,z=site['position'];r=next(r for r in p['routes']if r['id']=='backcourt_market_entry_0');a=r['points'][0]
 cameras.extend([('Backcourt-market-context',(x+65,y-85,z+75),(x,y,z+2),160,1),('Backcourt-market-entry',(a[0],a[1],z+1.7),(x,y,z+2),None,1),('Backcourt-market-inside',(x,y,z+1.7),(x+10,y+4,z+2),None,1)])
for t in p.get('verticalTransportStudy',[]):
 x,y,z=t['position'];cameras.extend([('Hoist-lower',(x+75,y-80,z+45),(x,y,z+24),140,1),('Hoist-upper-docked',(x+75,y-80,z+45),(x,y,z+24),140,1777)])
if p.get('burialCourtStudy'):
 gx,gy,gz=p['burialCourtStudy']['gate'];outside=(gx+15,gy,gz+1.7)if gx>680 else(gx,gy+14,gz+1.7)
 cameras.extend([('Burial-inside-eye',(674,1190,15.7),(630,1183,15.7),None,1),('Burial-entry-eye',outside,(650,1190,15.7),None,1),('Burial-context',(755,1280,105),(650,1190,14),150,1)])
for name,loc,look,scale,frame in cameras:
 ca=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,ca);s.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler();ca.clip_start=.05;ca.clip_end=20000
 if scale:ca.type='ORTHO';ca.ortho_scale=scale
 else:ca.lens=24
 s.frame_set(frame);s.camera=ob;s.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
