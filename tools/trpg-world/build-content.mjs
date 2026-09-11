import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRegion,createPortal,placeNPC,finalizeRegions} from './region-layout.mjs';
const base=new URL('../../',import.meta.url);
const source=JSON.parse(await fs.readFile(new URL('sources/world.json',import.meta.url),'utf8'));
const combat=JSON.parse(await fs.readFile(new URL('sources/combat.json',import.meta.url),'utf8'));
const rows=name=>source.sheets.find(s=>s.title===name)?.rows||[];
const specs=[
 ['farm','田園の村','meadow','#789656',[0,90],'麦畑と石畳の小さな村。北の柵の向こうから、時折遠吠えが聞こえる。'],
 ['capital','王都','city','#868479',[35,25],'大河沿いの白い都。市場、役所、下層街が王城を囲む。'],
 ['trade','交易都市','coast','#c1ab80',[-65,-35],'西海へ開けた港。船と荷車が穀物、鉱石、噂を運ぶ。'],
 ['crime','犯罪都市','island','#707e73',[-155,-30],'沖合の岩島に築かれた裏港。複雑な路地の奥にも普通の暮らしがある。'],
 ['frontier','辺境の村','desert','#c4ad81',[-65,175],'乾いた畑と巡礼宿。神殿への参道が収入と異変を運んでくる。'],
 ['temple','古代神殿','ruins','#b7b09a',[-45,125],'荒野に残された、種族が共に造った魔力装置。回廊の下で何かが光る。'],
 ['forest','森','forest','#537c62',[115,5],'大河と深い樹林。森の歪みには古い理由があり、外からの噂だけでは分からない。'],
 ['elf','エルフの隠れ里','grove','#709c83',[150,-55],'世界樹を囲む共同体。精霊域と樹の根道が、住まいと評議所を結ぶ。'],
 ['fortress','北陵要塞','snow','#9eabb1',[-15,-120],'北の山道を守る砦。兵舎の窓明かりと補給庫が寒い夜を支える。'],
 ['dwarf','ドワーフ洞窟','cave','#777a82',[-70,-110],'山の腹を掘った工房都市。水音と鍛冶の響きが坑道から届く。'],
 ['blackridge','魔王領','volcanic','#797e91',[95,-135],'黒嶺連合領。角人、翼人、亡命者が水路と市場を共有する、もう一つの国。'],
];
const nameMap=Object.fromEntries(specs.map(s=>[s[1],s[0]]));nameMap['黒嶺連合領']='blackridge';
const regionId=text=>nameMap[text]||Object.entries(nameMap).filter(([n])=>String(text).includes(n)).sort((a,b)=>b[0].length-a[0].length)[0]?.[1];
const regions=specs.map(spec=>createRegion(spec,source.sheets.find(sheet=>sheet.title===spec[1]),source.sourceUrl));
const byRegion=Object.fromEntries(regions.map(r=>[r.id,r]));
const routeRows=rows('距離一覧').filter(r=>/^R\d{2}$/.test(r[0]||''));
const routeSheet=source.sheets.find(s=>s.title==='距離一覧');
const routes=routeRows.map(r=>({id:r[0],from:regionId(r[1]),to:regionId(r[2]),minutes:Math.max(12,Math.round(Number(r[3])*24)),modes:r[5]==='船'?['boat','ship','broom']:['foot','horse','carriage','wagon','broom'],risk:/危険/.test(r[7]||'')?.25:.06,sourceMinutes:Number(r[3])*60,source:{sheet:routeSheet.title,row:routeSheet.rows.indexOf(r)+1,url:routeSheet.url,id:r[0]},description:r[6],sourceCondition:r[7]||'',durationPolicy:'authored-10-day-compression'}));
for(const region of regions){const links=routes.filter(r=>r.from===region.id||r.to===region.id);links.forEach((route,i)=>{
 const to=route.from===region.id?route.to:route.from;
 region.portals.push(createPortal(region,byRegion[to],route));
 });}
const npcs=rows('NPC一覧').filter(r=>/^NPC\d{3}$/.test(r[0]||'')).map((r,i)=>{
 const id=regionId(r[9])||regionId(r[8])||'capital',reg=byRegion[id];
 return {id:r[0],name:r[1],region:id,role:r[11],species:r[4],personality:r[13],...placeNPC(reg,r,i),knowledge:[{kind:'background',text:`${r[1]}は${r[11]}として、この土地で暮らしている。`,disclosureTrust:0},{kind:'secret',text:r[17]||'',disclosureTrust:15}],voice:r[20],sourceId:r[0],source:{sheet:'NPC一覧',row:rows('NPC一覧').indexOf(r)+1,url:source.sheets.find(s=>s.title==='NPC一覧').url,id:r[0]}};
});
const jobs=rows('仕事マスター').filter(r=>/^JOB-/.test(r[0]||'')).map(r=>({id:r[0],name:r[3],region:regionId(r[1]),facilityId:r[2],minutes:Math.max(30,Number(r[5])*25),pay:Math.max(22,Number(r[6])*6),xp:32,description:r[11],source:{sheet:'仕事マスター',row:rows('仕事マスター').indexOf(r)+1}})).filter(j=>j.region);
const items=[{id:'supplies',name:'食料と生活物資',kind:'food',price:10,heal:15},{id:'medicine',name:'傷薬',kind:'consumable',price:14,heal:45},{id:'food',name:'旅人の温かい弁当',kind:'food',price:6,heal:20},{id:'rope',name:'丈夫な縄',kind:'tool',price:8},{id:'timber',name:'補修用木材',kind:'material',price:12},{id:'antidote',name:'解毒薬',kind:'consumable',price:25},{id:'crystal',name:'調律結晶',kind:'material',price:28},{id:'horse',name:'街道馬',kind:'mount',price:140},{id:'broom',name:'飛行箒',kind:'mount',price:190}];
const craftingFacilityIds=['LOC_FARM_REPAIR','LOC_TRADE_SHIPYARD','LOC_CAP_APOTHECARY','LOC_TRADE_APOTHECARY','LOC_ELF_HERB_GARDEN','LOC_DWARF_FORGE','LOC_DWARF_ENGINEER','LOC_BLACKRIDGE_FORGE'];
for(const region of regions)for(const object of region.objects||[])if(craftingFacilityIds.includes(object.id))object.crafting=true;
const recipes=[
 {id:'field-kit',name:'野営用キット',description:'木材と縄を組み、危機対応に使える生活物資を整える。',facilityIds:craftingFacilityIds,requirements:{skills:['crafting'],items:{timber:1,rope:1}},outputs:{items:{supplies:3}},minutes:30,xp:24},
 {id:'field-medicine',name:'応急薬',description:'毒袋と物資を調合して傷薬を作る。',facilityIds:['LOC_CAP_APOTHECARY','LOC_TRADE_APOTHECARY','LOC_ELF_HERB_GARDEN','LOC_DWARF_FORGE'],requirements:{skills:['crafting'],items:{supplies:1,MAT_POISON_SAC:1}},outputs:{items:{medicine:1}},minutes:25,xp:30},
 {id:'reinforced-rope',name:'強化縄',description:'蜘蛛糸を撚り込み、通常の縄を二本の強化縄へ仕立てる。',facilityIds:['LOC_FARM_REPAIR','LOC_TRADE_SHIPYARD','LOC_DWARF_FORGE','LOC_DWARF_ENGINEER','LOC_BLACKRIDGE_FORGE'],requirements:{skills:['crafting'],items:{rope:1,MAT_SPIDER_SILK:1}},outputs:{items:{rope:2}},minutes:30,xp:30},
];
const skills=[['combat','武器の扱い',1,0,[],'間合いを取り、打撃と防御で身を守る。'],['investigation','調査',1,0,[],'痕跡を調べ、証拠をつなぐ。'],['riding','乗馬',1,18,[],'所有する馬に乗れる。街道で速く移動する。'],['magic','基礎魔術',1,22,[],'遠距離魔法と古代装置の調査。'],['broom','箒飛行',2,40,['magic'],'所有する箒で高度24mまで飛行。魔力と嵐に注意。'],['negotiation','交渉',1,18,[],'共同体や商人と、条件を整えて取引する。'],['crafting','工作',1,18,[],'鉱山の支保や機構を修理する。'],['tracking','追跡',1,16,[],'獣道や行方不明者の痕跡を読む。'],['stealth','潜入',1,22,[],'密輸や陰謀の証拠を持ち帰る。'],['survival','野外生活',1,16,[],'物資を使って土地の危機へ備える。']].map(([id,name,cost,goldCost,requires,description])=>({id,name,cost,goldCost,requires,description}));
const D=86400,at=(day,h)=>(day-1)*D+h*3600;
const eventSpecs=[
 ['lost-road','北柵の遠吠え','farm',1,9,2,20,['T01','T03'],'村外れで少年の足跡が途絶えた。森から押し出された赤牙狼が、街道へ降りている。','大型魔獣による縄張り移動と少年の単独探検。','NPC002','tracking','捜索隊を組み、少年を家族へ届ける','餌場と避難柵を整え、人と狼の動線を分ける','狼の親個体を追い払い、少年を保護する'],
 ['bread-fire','麦と借金の火種','farm',2,18,4,18,['T02'],'共同穀倉の裏で灯油の匂いがする。穀物の買付契約には、不自然な担保条項がある。','穀物商による収穫権奪取と雇われた放火犯。','NPC005','investigation','管理人と夜警をつなぎ、放火を止める','代替穀物を買い付け、借金契約を不要にする','雇われた男を拘束し、穀倉を警護する'],
 ['harbor','閉ざされる潮路','trade',3,7,6,20,['T05','T06','T14','T15'],'港の賃金が削られ、領主は床に伏せている。荷札の違う武器箱が夜の船へ運ばれる。','毒殺計画、搾取、武器密輸が結びつき外国艦隊の足場となる。','NPC009','negotiation','領主の治療と労働協定を仲介する','解毒薬と未払賃金を届け、港の契約を結び直す','武器倉庫を制圧し、毒殺派を排除する'],
 ['roots','水音を失う森','forest',2,9,7,18,['T07','T08','T13'],'大河の流れが弱い。旅立ったエルフの足跡と、川中の魔力だまりが気に掛かる。','人身売買と結界の防衛反応、川に詰まったキングスライムは独立して悪化する。','NPC038','magic','救出した若者と水路の共同調査を行う','排水資材と結晶を届け、水流を取り戻す','人買いを退け、川を塞ぐ魔物を排除する'],
 ['deep-mine','山の下の呼吸','dwarf',3,10,6,18,['T09'],'坑道から濁った水が流れ出ている。支柱のひびは、作業員の交代ごとに広がる。','過剰な採掘と地下水脈の破断。','NPC042','crafting','技師と坑夫の作業中止・救助計画をまとめる','支保材と排水部品を据え、坑道を安定させる','採掘権者を退け、危険坑道を強制閉鎖する'],
 ['crown','白い都の影','capital',4,8,8,20,['T10','T11','T16'],'孤児院の立退き通知が出された。誰かが暗殺の噂を亜人街のせいにしている。','土地利権、王族暗殺と差別的扇動。','NPC019','investigation','証言者を守り、議場へ立退きと暗殺の証拠を届ける','孤児院の土地と配給を確保し、扇動の足場をなくす','暗殺組織と扇動者を先制して拘束する'],
 ['resonance','重なる召喚の鐘','temple',2,12,9,20,['T04','T17','T18'],'回廊の古代文字が明滅し、巡礼者が消えている。王都では次の召喚が準備される。','不完全な転移装置と追加の召喚実験が、巨神兵へ流れる魔力を増幅する。','NPC033','magic','管理者と術者を集め、三つの装置を停止する','調律結晶と部品を交換し、召喚系統を切り離す','軍の実験拠点と巨神兵の動力を破壊する'],
 ['border','北境に積もる嘘','fortress',5,6,10,20,['T12','T19'],'北門の兵が増えた。越境の報告には食い違いがある。黒嶺側の村でも避難が始まった。','偽旗作戦と黒嶺強硬派が、互いの恐怖を戦争の口実にする。','NPC049','negotiation','両国の使者に偽旗の証拠を渡し、停戦線を引く','両国へ補給を渡し、動員資金を交易へ切り替える','両国の攻戦派を制圧し、軍の進路を封鎖する'],
];
const events=eventSpecs.map((s,i)=>{
 const [id,name,region,sd,sh,dd,dh,sourceIds,description,cause,preferred,skill,cooperate,logistics,force]=s;
 const ally=npcs.find(n=>n.id===preferred&&n.region===region)||npcs.find(n=>n.region===region);
 const reg=byRegion[region],position=[i%2?32:-32,0,-5],proof=`${id}:proof`;
 reg.objects.push({id:`evidence:${id}`,kind:'evidence',name:`${name}の手がかり`,position:[position[0],0,position[2]+10],asset:'crate',eventId:id,evidenceId:proof,description:`${description} 調べた痕跡を手帳へ写した。`});
 const add=(mid,label,kind,requirements,effects)=>({id:mid,label,kind,requirements,effects:{pressure:-120,xp:145,...effects}});
 const material=id==='deep-mine'?{timber:3,rope:2}:id==='harbor'?{antidote:2,supplies:3}:id==='resonance'||id==='roots'?{crystal:2,timber:2}:{supplies:4};
 return {id,name,region,position,startsAt:at(sd,sh),deadline:at(dd,dh),severity:'major',pressure:45,pressurePerDay:6,description,cause,sourceIds,reward:90,
  opposition:{monsterId:['MON-0005','MON-0033','MON-0034','MON-0015','MON-0049','MON-0025','MON-0062','MON-0055'][i],description:'事件の実行勢力。現場で退けた結果を、力による介入の根拠にできる。'},
  mechanisms:[add('community',cooperate,'community',{trust:{[ally.id]:12},evidence:[proof]},{trust:3,setFacts:[`${id}:community-protected`],stock:{[region]:.1}}),
   add('logistics',logistics,'logistics',{items:material,gold:i>4?25:10},{resources:{[`${region}:supplies`]:4},setFacts:[`${id}:supply-secured`],stock:{[region]:.3}}),
   add('investigation','現場証拠と専門技能で、発生原因を除く','information',{skills:[skill],evidence:[proof],items:id==='resonance'?{crystal:1}:{}},{setFacts:[`${id}:cause-removed`]}),
   add('coercion',force,'coercion',{force:20+i*3,evidence:[proof,`${id}:threat-reduced`]},{trust:-6,threat:{[region]:4},setFacts:[`${id}:coerced`]}),
   add('misreading','誤解から生まれた警戒網へ物資を渡す','misunderstanding',{evidence:[`${id}:misread`],facts:[`${id}:public-warning`],items:{supplies:1}},{trust:1,setFacts:[`${id}:unexpected-aversion`],resources:{[`${region}:warnings`]:1}})],
  pressureDependencies:({crown:[{eventId:'bread-fire',perDay:4},{eventId:'roots',perDay:3}],border:[{eventId:'harbor',perDay:5},{eventId:'crown',perDay:3}]}[id]||[]),
  failureEffects:{stock:{[region]:-.55,...(['bread-fire','harbor','roots'].includes(id)?{capital:-.2}: {})},threat:{[region]:18},setFacts:[`${id}:aftermath`],deaths:id==='lost-road'?['NPC001']:[]},signals:[{kind:'local',text:description}],
 };
});
finalizeRegions(regions,npcs,events);
const content={version:1,revision:'pending',time:{days:10,scale:60,startSeconds:25200},regions,routes,npcs,events,skills,items,recipes,jobs,...combat,
 provenance:{sourceUrl:source.sourceUrl,retrievedAt:source.retrievedAt,policy:'Source material, not legacy rules. No Human Virtue ledger or replay used.',eventPolicy:'19 causes regrouped into 8 crises; deadlines and balance authored anew.',assets:'Kenney CC0 Fantasy Town Kit 2.0 and Blocky Characters 2.0.'}};
content.revision='world-10d-'+createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0,12);
const target=new URL('src/server/trpg/world/content/world-content.json',base);await fs.mkdir(new URL('.',target),{recursive:true});await fs.writeFile(target,JSON.stringify(content,null,2)+'\n');
console.log(JSON.stringify({revision:content.revision,regions:regions.length,npcs:npcs.length,sourceFacilities:regions.reduce((n,r)=>n+r.objects.filter(o=>o.source?.id?.startsWith('LOC_')).length,0),buildings:regions.reduce((n,r)=>n+r.objects.filter(o=>o.buildingPosition).length,0),objects:regions.reduce((n,r)=>n+r.objects.length,0),events:events.length,jobs:jobs.length}));
