"""Hash authored street geometry at the planner's millimetre precision."""
import json,hashlib,pathlib,sys
p=pathlib.Path(sys.argv[1]);data=json.loads(p.read_text())
rows=[{'id':r['id'],'kind':r['kind'],'width':r['width'],'points':[[round(v,3)for v in q]for q in r['points']]}for r in sorted(data['routes'],key=lambda r:r['id'])]
signature=hashlib.sha256(json.dumps(rows,sort_keys=True,separators=(',',':')).encode()).hexdigest()
result={'routeCount':len(rows),'millimetreRouteSHA256':signature};p.with_name('route-fingerprint.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
