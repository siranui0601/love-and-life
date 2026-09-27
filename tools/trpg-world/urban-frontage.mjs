// Existing occupied sites form the street edge. Width is authored from use,
// not multiplied globally; semantic targets, doors and household IDs stay put.
// These are single-floor accessible grayboxes, not fictitious extra tenants.
export const urbanFrontages={
 capital:{
  LOC_CAP_LOWER_INN:[16,'食堂と長期借室を持つ宿の間口'],
  LOC_CAP_MARKET:[18,'屋根のある市場の売場と荷の整理面'],
  LOC_CAP_WEAPON_SHOP:[18,'武具の陳列と補修の作業面'],
  LOC_CAP_APOTHECARY:[18,'薬の販売と調合の作業面'],
  LOC_CAP_ORPHANAGE:[16,'共同生活の居室と食事の場所'],
  LOC_CAP_AJIN_QUARTER:[18,'河岸住居の共同生活面'],
  'capital:market-house':[16,'別々の借家人が住む長屋'],
  'capital:clerk-house':[14,'行政街の路地に面した長屋'],
  'capital:news-house':[14,'瓦版通りの住居'],
  'capital:stable-house':[12,'駅馬車場に通う世帯の住居'],
  'capital:noble-house':[14,'行政街の屋敷'],
  'capital:guard-quarters':[16,'城番が共同生活する宿舎'],
 },
 crime:{
  LOC_CRIME_BACK_INN:[14,'港の船客と店主が使う宿'],
  LOC_CRIME_WEAPON_MARKET:[14,'売場と職住一体の武具商'],
  LOC_CRIME_INFO_STREET:[16,'通りから奥まった相談と取引の場所'],
  LOC_CRIME_SLAVE_MARKET:[16,'取引場と常駐者の管理区画'],
  LOC_CRIME_FORGER:[16,'書類仕事の工房と住居'],
  LOC_CRIME_WAREHOUSE:[14,'荷を保管する倉庫と当番の住居'],
  LOC_CRIME_STABLE:[16,'荷駄と飼養者の生活区画'],
  LOC_CRIME_GAMBLING:[14,'宿泊街の遊興施設'],
  'crime:quay-tenement':[16,'港で暮らす借家人の長屋'],
  'crime:scribes-tenement':[16,'情報街へ通勤する借家人の長屋'],
 },
};

export function authorUrbanFrontage(region){
 for(const [id,[width,purpose]] of Object.entries(urbanFrontages[region.id]||{})){
  const site=region.objects.find(o=>o.id===id);
  if(!site?.buildingPosition)throw new Error(`Missing urban frontage ${id}`);
  site.width=width;site.frontage={purpose,stage:'occupied-site-graybox'};
  const [x,,z]=site.buildingPosition;
  for(const side of ['left','right','back']){
   const body=region.obstacles.find(o=>o.id===`${id}:${side}`);
   if(!body)throw new Error(`Missing frontage collision ${id}:${side}`);
   if(side==='back')body.width=width;
   else body.x=x+(side==='left'?-1:1)*width/2;
  }
 }
}
