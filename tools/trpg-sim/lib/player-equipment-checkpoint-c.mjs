export const CHECKPOINT_C_EQUIPMENT_COUNT = 142;
export const CHECKPOINT_C_STOCK_COUNT = 149;

const SLOT_SET = new Set(['mainHand', 'offHand', 'body', 'accessory']);
const WEAPON_SLOT_TYPES = new Set(['oneHandedSword', 'twoHandedSword', 'axe', 'spear', 'bow', 'staff', 'book', 'shield']);

const STAT_KEYWORDS = Object.freeze([
  [/物理威力|物理攻撃/u, 'physicalPower'],
  [/魔導威力|魔法攻撃/u, 'magicPower'],
  [/魔法耐性/u, 'magicResistance'],
  [/防御/u, 'defense'],
  [/素早|速度/u, 'agility'],
  [/幸運/u, 'luck'],
  [/命中/u, 'accuracy'],
  [/回避/u, 'evasion'],
  [/会心/u, 'critical'],
  [/デバフ成功/u, 'debuffSuccess'],
  [/デバフ耐性/u, 'debuffResistance'],
  [/最大HP/u, 'maxHp'],
  [/最大MP/u, 'maxMp'],
]);

const CONDITIONAL_TEXT = /命中時|被ダメ|毎ターン|戦闘中|確率|消費|解除|破壊|反射|吸収|軽減|無効|回復|低下時|以下|以上|残り|逃走|開始時|終了時|攻撃時|防御時|回避時|会心時|撃破時/u;

function referencedStats(text) {
  return STAT_KEYWORDS.filter(([pattern]) => pattern.test(text)).map(([, stat]) => stat);
}

export function classifyEquipmentTextRuntime(equipment, text) {
  const normalized = String(text ?? '').trim();
  if (!normalized) return { status: 'NONE', stats: [] };
  const stats = referencedStats(normalized);
  const coveredByColumns = stats.length > 0 && stats.every((stat) => Number(equipment?.[stat] ?? 0) !== 0);
  if (coveredByColumns && !CONDITIONAL_TEXT.test(normalized)) return { status: 'RUNTIME_STAT_COLUMNS', stats };
  return { status: 'NEEDS_RUNTIME_HANDLER', stats };
}

function worldAccess(equipment, data) {
  const stockRows = (data.inventory ?? []).filter((stock) => stock.equipmentId === equipment.id);
  if (stockRows.length) return { reachable: true, routes: stockRows.map((stock) => ({ type: 'shop_stock', stockId: stock.id, sellerId: stock.sellerId, location: stock.location })) };
  if (equipment.status !== 'disabled' && SLOT_SET.has(equipment.slot)) {
    return { reachable: true, routes: [{ type: 'mission_reward_pool', rule: 'equipment-access.rewardCandidates' }] };
  }
  return { reachable: false, routes: [] };
}

export function auditEquipmentCheckpointC(data) {
  const equipmentRows = (data.equipment ?? []).map((equipment) => {
    const passive = classifyEquipmentTextRuntime(equipment, equipment.passive);
    const drawback = classifyEquipmentTextRuntime(equipment, equipment.drawback);
    const access = worldAccess(equipment, data);
    const slotValid = SLOT_SET.has(equipment.slot);
    const weaponTypeValid = equipment.slot === 'mainHand' || equipment.slot === 'offHand'
      ? WEAPON_SLOT_TYPES.has(equipment.weaponType)
      : true;
    const handednessValid = equipment.slot !== 'mainHand' || ['oneHand', 'twoHand'].includes(equipment.grip);
    return {
      equipmentId: equipment.id,
      slot: equipment.slot,
      weaponType: equipment.weaponType,
      grip: equipment.grip,
      grantedSkillId: equipment.grantedSkillId ?? null,
      passive,
      drawback,
      access,
      valid: slotValid && weaponTypeValid && handednessValid && access.reachable,
      invalidReasons: [
        ...(!slotValid ? ['INVALID_SLOT'] : []),
        ...(!weaponTypeValid ? ['INVALID_WEAPON_TYPE'] : []),
        ...(!handednessValid ? ['INVALID_HANDEDNESS'] : []),
        ...(!access.reachable ? ['UNREACHABLE'] : []),
      ],
    };
  });
  const inventoryInvalidEquipmentIds = (data.inventory ?? []).filter((stock) => !data.equipmentById.has(stock.equipmentId)).map((stock) => ({ stockId: stock.id, equipmentId: stock.equipmentId }));
  const unmodeledText = equipmentRows.flatMap((row) => [
    ...(row.passive.status === 'NEEDS_RUNTIME_HANDLER' ? [{ equipmentId: row.equipmentId, field: 'passive', text: data.equipmentById.get(row.equipmentId)?.passive }] : []),
    ...(row.drawback.status === 'NEEDS_RUNTIME_HANDLER' ? [{ equipmentId: row.equipmentId, field: 'drawback', text: data.equipmentById.get(row.equipmentId)?.drawback }] : []),
  ]);
  return {
    equipmentCount: equipmentRows.length,
    stockCount: data.inventory?.length ?? 0,
    equipmentRows,
    invalidEquipment: equipmentRows.filter((row) => !row.valid),
    inventoryInvalidEquipmentIds,
    unmodeledText,
    worldReachableCount: equipmentRows.filter((row) => row.access.reachable).length,
  };
}
