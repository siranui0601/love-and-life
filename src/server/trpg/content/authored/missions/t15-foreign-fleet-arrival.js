const F = Object.freeze;
const L = (entries) => F(entries.map((entry) => F(entry)));
const S = (...entries) => F(entries);
const speech = (actorId, text, emotion) => F({ actorId, text, emotion });
const plan = (entry) => F(entry);
const followup = (id, npcId, narrative, text, emotion) => F({
  id,
  npcId,
  narrative,
  speeches: F([speech(npcId, text, emotion)]),
});
const lead = (entry) => F(entry);

const AUTHORITY = S(
  "T15-EVIDENCE-CEDRIC-INVITATION-SEAL",
  "T15-EVIDENCE-GUILD-EMERGENCY-MINUTES",
  "T15-EVIDENCE-LORD-MANOR-SUCCESSION-REGISTER",
);
const SOVEREIGNTY = S(
  "T15-EVIDENCE-FOREIGN-BERTH-CONTROL-CLAUSE",
  "T15-EVIDENCE-CUSTOMS-IMMUNITY-SCHEDULE",
  "T15-EVIDENCE-WAREHOUSE-COLLATERAL-MAP",
);
const MILITARY_CARGO = S(
  "T15-EVIDENCE-SIEGE-PART-CRATE-LAYERS",
  "T15-EVIDENCE-MERCENARY-ROSTER-AND-PAY",
  "T15-EVIDENCE-SHIPYARD-GUN-DECK-CONVERSION",
);
const LANDING = S(
  "T15-EVIDENCE-DAY72-TIDE-AND-BELL",
  "T15-EVIDENCE-NIGHT-SHIFT-LANDING-ORDER",
  "T15-EVIDENCE-STABLE-REQUISITION-SEQUENCE",
);
const COLLABORATORS = S(
  "T15-EVIDENCE-BERYL-FOREIGN-CREDIT-LINE",
  "T15-EVIDENCE-BAZEL-PROVISION-CONTRACT",
  "T15-EVIDENCE-ALVAREZ-PRIVATE-TERMS",
);
const INVASION = S(
  "T15-EVIDENCE-CAPITAL-ROAD-SURVEY",
  "T15-EVIDENCE-SUPPLY-CALENDAR-TO-DAY90",
  "T15-EVIDENCE-FOREIGN-COMMAND-CIPHER",
);

const ALL_LEAD_IDS = S(
  "cedric_invitation_seal",
  "guild_emergency_minutes",
  "lord_manor_succession_register",
  "foreign_berth_control_clause",
  "customs_immunity_schedule",
  "warehouse_collateral_map",
  "siege_part_crate_layers",
  "mercenary_roster_and_pay",
  "shipyard_gun_deck_conversion",
  "day72_tide_and_bell",
  "night_shift_landing_order",
  "stable_requisition_sequence",
  "beryl_foreign_credit_line",
  "bazel_provision_contract",
  "alvarez_private_terms",
  "capital_road_survey",
  "supply_calendar_to_day90",
  "foreign_command_cipher",
);

export const T15_FOREIGN_FLEET_ARRIVAL_PACK = F({
  id: "foreign-fleet-arrival",
  missionId: "MSN-T15",
  troubleId: "T15",
  title: "å¤–å›½èˆ¹å›£ã®å…¥æ¸¯",
  persistResolutionBranch: true,
  branching: F({
    openingChoices: 3,
    evidenceDimensions: 6,
    alternativesPerDimension: 3,
    evidenceProfiles: 729,
    orderingPermutationsPerProfile: 720,
    topLevelResolutions: 3,
    deterministicSignatureCombinationsBeforePriorState: 4723920,
    evidenceOrderPersisted: true,
    persistentBranchSignature: true,
    signatureCountIsNarrativeBranchCount: false,
    note: "ä¸‰å°Žå…¥ã€å…­åˆ†é¡žÃ—ä¸‰ä»£æ›¿è¨¼æ‹ ã€å–å¾—é †ã€ä¸‰è§£æ±ºãŒæ±ºå®šè«–çš„ç½²åã‚’ä½œã‚‹ã€‚T05/T06/T09/T14ã¨ä»‹å…¥æ—¥ã€å‰¯ç›®æ¨™ãŒæœ¬æ–‡ã¨æ‰€è¦æ™‚é–“ã‚’ã•ã‚‰ã«å¤‰ãˆã‚‹ã€‚",
  }),
  catalogOverride: F({
    hearing: F({
      targetLocation: "äº¤æ˜“éƒ½å¸‚",
      targetFacilityId: "LOC_TRADE_CUSTOMS",
      label: "ç¨Žé–¢ã®å·®æ›¿ãˆè²¨ç‰©ç¥¨ã‹ã‚‰ã€å¤–å›½èˆ¹å›£ã‚’æ‹›ã„ãŸæ¨©é™ã€ç©è·ã€ä¸Šé™¸äºˆå®šã®ã©ã“ã‚’å…ˆã«è¿½ã†ã‹æ±ºã‚ã‚‹",
    }),
    investigation: F({ required: 6 }),
    battle: F({
      targetLocation: "äº¤æ˜“éƒ½å¸‚",
      targetFacilityId: "LOC_TRADE_PORT",
      encounterId: "ENC-0035",
      actionType: "missionBattle",
      label: "å¤–å›½å‚­å…µã®ä¸Šé™¸ç·šã‚’æ­¢ã‚ã€å¥‘ç´„åŽŸæœ¬ã€è»äº‹ç©è·ã€æ¸¯ã®é€€è·¯ã‚’åˆ¥ã€…ã«ç¢ºä¿ã™ã‚‹",
      timelineVariants: L([
        {
          minDay: 55,
          maxDay: 71,
          targetLocation: "äº¤æ˜“éƒ½å¸‚",
          targetFacilityId: "LOC_TRADE_CUSTOMS",
          actionType: "investigate",
          encounterId: null,
          minutes: 58,
          suppressRandomEncounter: true,
          label: "Day72å‰ã«å¯„æ¸¯è¨±å¯ã¨ä¿‚ç•™é †ã‚’å°å°ã—ã€è»äº‹ç©è·ã ã‘ã‚’é€šå¸¸è²¨ç‰©ã‹ã‚‰åˆ‡ã‚Šé›¢ã™",
          discoveryId: "T15-INTERVENTION-BERTH-AND-CARGO-SEALED",
          discoveryText: "å¯„æ¸¯è¨±å¯ã®åŽŸæœ¬ã€è»äº‹ç©è·ã®å°å°ç•ªå·ã€Day72ã®ä¿‚ç•™é †ã‚’åˆ¥ã€…ã®ä¿ç®¡åº«ã¸ç§»ã—ã€é€šå¸¸è²¨ç‰©ã‚’æ­¢ã‚ãšã«ä¸Šé™¸æº–å‚™ã ã‘ã‚’å‡çµã—ãŸã€‚",
        },
        {
          minDay: 72,
          maxDay: 89,
          troubleId: "T14",
          troubleStatuses: S("failed"),
          targetLocation: "äº¤æ˜“éƒ½å¸‚",
          targetFacilityId: "LOC_TRADE_PORT",
          actionType: "missionBattle",
          encounterId: "ENC-0036",
          minutes: 96,
          label: "æ”»åŸŽå¼©å°ã®çµ„ç«‹å‰ã«è­·è¡›éšŠã‚’åˆ†æ–­ã—ã€æ¸¯ã®æ°‘é–“è·å½¹ã‚’ç›¾ã«ã•ã›ãšè»äº‹ç©è·ã‚’æ­¢ã‚ã‚‹",
        },
        {
          minDay: 72,
          maxDay: 89,
          targetLocation: "äº¤æ˜“éƒ½å¸‚",
          targetFacilityId: "LOC_TRADE_PORT",
          actionType: "missionBattle",
          encounterId: "ENC-0035",
          minutes: 78,
          label: "å¤–å›½å‚­å…µã®ä¸Šé™¸éƒ¨éšŠã‚’æ­¢ã‚ã€ä½¿ç¯€ã€å…µã€å›½å†…å”åŠ›è€…ã‚’ä¸€æ‹¬å‡¦ç½°ã›ãšåˆ†ã‘ã¦ç¢ºä¿ã™ã‚‹",
        },
      ]),
    }),
    resolution: F({
      targetLocation: "äº¤æ˜“éƒ½å¸‚",
      targetFacilityId: "LOC_TRADE_GUILD",
      label: "å•†äººã‚®ãƒ«ãƒ‰ä¼šé¤¨ã§ã€å¥‘ç´„ç„¡åŠ¹ã€å½æ³Šåœ°ã€åˆ†æ–­äº¤æ¸‰ã®ã©ã‚Œã§å¤–å›½èˆ¹å›£ã‚’é€€ã‹ã›ã‚‹ã‹æ±ºã‚ã‚‹",
    }),
  }),
  hearing: F({
    stepId: "hear",
    targetLocation: "äº¤æ˜“éƒ½å¸‚",
    targetFacilityId: "LOC_TRADE_CUSTOMS",
    npcId: "NPC075",
    npcName: "ã‚¨ãƒ«ãƒã‚¹ãƒˆ",
    guidance: F({
      kicker: "å•†èˆ¹ã®é¡”ã‚’ã—ãŸä¸Šé™¸è¨ˆç”»",
      title: "æ‹›è‡´æ¨©é™ã€è»äº‹ç©è·ã€Day72ã®ä¸Šé™¸æ™‚åˆ»ã®ã©ã“ã‹ã‚‰ç¢ºã‹ã‚ã‚‹ã‹æ±ºã‚ã‚‹",
      detail: "èª°ãŒå‘¼ã‚“ã ã‹ã ã‘ã§ã¯å…µå™¨ã‚’æ­¢ã‚ã‚‰ã‚Œãšã€ç©è·ã ã‘ã‚’æŠ¼ã•ãˆã¦ã‚‚æ¸¯æ¹¾æ¨©ã®è­²æ¸¡å¥‘ç´„ãŒæ®‹ã‚‹ã€‚å…­ã¤ã®ç‹¬ç«‹äº‹å®Ÿã‚’çµã°ãªã‘ã‚Œã°èˆ¹å›£ã¯åˆ¥åç¾©ã§æˆ»ã‚‹ã€‚",
    }),
    choices: L([
      {
        id: "authority_and_contract",
        dialogueTopic: "mission_flow_t15_authority_and_contract",
        label: "èª°ã®å°ã§å¯„æ¸¯ãŒè¨±å¯ã•ã‚Œã€é ˜ä¸»æ¨©é™ã¨ã‚®ãƒ«ãƒ‰æ±ºè£ãŒã©ã†ä½¿ã‚ã‚ŒãŸã‹ç¢ºã‹ã‚ã‚‹",
        playerUtterance: "å¤–å›½èˆ¹ã‚’å‘¼ã‚“ã æ¨©é™ã‚’åˆ†ã‘ã¦ãã ã•ã„ã€‚é ˜ä¸»ã€ç¶™æ‰¿å€™è£œã€ã‚®ãƒ«ãƒ‰ã®èª°ãŒã€ã©ã®å°ã‚’ä½¿ã„ã¾ã—ãŸã‹ã€‚",
        requiredDisclosure: "ã‚»ãƒ‰ãƒªãƒƒã‚¯åç¾©ã®ç·Šæ€¥æ‹›è‡´çŠ¶ã¸ã‚®ãƒ«ãƒ‰ã®ä¿¡ç”¨ä¿è¨¼ãŒä»˜ãã€ç¾é ˜ä¸»ã®æ­£å¼ãªæ¸¯æ¹¾å°ã¯ä½¿ã‚ã‚Œã¦ã„ãªã„",
        factId: "T15-FACT-INVITATION-AUTHORITY-DISPUTED",
        preferredFocusId: "law_and_sovereignty",
        unlockedLeadIds: ALL_LEAD_IDS,
        minutes: 15,
        narrative: "ã‚¨ãƒ«ãƒã‚¹ãƒˆã¯å¯„æ¸¯è¨±å¯ã‚’ç½²åé †ã«ä¸¦ã¹ãŸã€‚æœ€åˆã«ã‚ã‚‹ã¹ãé ˜ä¸»å°ãŒãªãã€ç¶™æ‰¿å€™è£œã®ç·Šæ€¥å°ã¨å•†äººã‚®ãƒ«ãƒ‰ã®ä¿è¨¼ã ã‘ãŒå…ˆã¸é€²ã‚“ã§ã„ã‚‹ã€‚",
        speeches: F([speech("NPC075", "æ­£å¼ãªé ˜ä¸»å°ãŒãªã„ã€‚ã‚»ãƒ‰ãƒªãƒƒã‚¯ã®ç·Šæ€¥å°ã¨ã‚®ãƒ«ãƒ‰ä¿è¨¼ã§ã€ç¨Žé–¢ãŒã€Žå¾Œã‹ã‚‰è¿½èªã•ã‚Œã‚‹ã€å‰æã«ã•ã‚ŒãŸã€‚èª°ãŒæ¨©é™ã‚’å€Ÿã‚Šã€èª°ãŒåˆ©ç›Šã‚’ä¿è¨¼ã—ãŸã‹ã¯åˆ†ã‘ã¦è¿½ãˆã‚‹ã€‚", "å®˜åƒšçš„ãªå±æ©Ÿæ„Ÿ")]),
      },
      {
        id: "cargo_and_landing",
        dialogueTopic: "mission_flow_t15_cargo_and_landing",
        label: "å•†ç”¨ç”³å‘Šã®ç®±ã«ä½•ãŒå…¥ã‚Šã€ã©ã®æ½®ã¨å¤œå‹¤ç­ã§Day72ä¸Šé™¸ã‚’å§‹ã‚ã‚‹ã‹ç¢ºã‹ã‚ã‚‹",
        playerUtterance: "å“åã§ã¯ãªãã€é‡ã•ã€èˆ¹å€‰ã€è·ä¸‹ã‚ã—é †ã‚’æ•™ãˆã¦ãã ã•ã„ã€‚å…µã¨å…µå™¨ãŒã„ã¤é™¸ã¸å‡ºã‚‹ã‹ã‚’æ­¢ã‚ã¾ã™ã€‚",
        requiredDisclosure: "è¾²å…·éƒ¨å“åç¾©ã®é‡é‡è¶…éŽç®±ã€å‚­å…µåç°¿ã€å¤œæ˜Žã‘å‰ã®å°‚ç”¨è·å½¹ç­ãŒåŒã˜Day72ã®æ½®ã¸é›†ç´„ã•ã‚Œã¦ã„ã‚‹",
        factId: "T15-FACT-MILITARY-LANDING-SCHEDULED",
        preferredFocusId: "cargo_and_clock",
        unlockedLeadIds: ALL_LEAD_IDS,
        minutes: 16,
        narrative: "ç”³å‘Šå“åã¯è¾²å…·ã€èˆ¹å…·ã€æ²»ç™‚ç”¨å“ã«åˆ†ã‹ã‚Œã¦ã„ãŸãŒã€èˆ¹å€‰ã®é…ç½®ã¨å¤œå‹¤å‰²å½“ã¯ä¸€ã¤ã®ä¸Šé™¸ä½œæˆ¦ã¨ã—ã¦å¬ãåˆã£ã¦ã„ãŸã€‚",
        speeches: F([speech("NPC075", "è¾²å…·ã«ã—ã¦ã¯é‡ã™ãŽã‚‹ç®±ã€åç°¿ã«ãªã„å››åäººã€å¤œæ˜Žã‘å‰ã ã‘å¢—ãˆãŸè·å½¹ã€‚å…¨éƒ¨ã€ay72ã®åŒã˜æ½®ã‚’æŒ‡ã—ã¦ã„ã‚‹ã€‚æ­¢ã‚ã‚‹ãªã‚‰ç““ãŒéŒ²ã‚‹å‰ã ã€‚", "æŠ¼ãˆãŸç„¦ã‚Š")]),
      },
      {
        id: "collaborators_and_destination",
        dialogueTopic: "mission_flow_t15_collaborators_and_destination",
        label: "å›½å†…ã®èª°ãŒé£Ÿã€ç¦¸à y`"ynªøà¤¹å*9¡#øàeøà z".yfèøàc9®+øàk¹«(øàjøàjxàdøàn9d$xàbøàa¸àbùè®¸àbøà xà¢È‹ˆ^Y\•]\˜[˜ÙNˆ¹."ºfn9o£8àkº(ç9íi¹ab8àj:`døà¤º/ïxàa8ào¸àfxà º*¬8àc:hçù¥¦xà zi«8à y`"ynªøà¤¹aî¸àeøà xàjxàdøào¸àiú`,¸ào¸àføà¢ùidyí!8àiøàfxàbøà ˆ‹ˆ™\]Z\™Y\ØÛÜÝ\™Nˆ¸àä8àï8à¯8àêøàkºhçúaãùidyí!8à xàæxàê¸àêùí­9/èyã¬8à yã¢ú`ïz(eú`døàk¹®+:aãùfìøàc9. 8ài8àk¹.gyc`y¥éz(ç9íi¹i"9å.øàn9§gøàj¸à£8ài¸àa8à¢È‹ˆ˜XÝYˆ•MKQPÕQÓQTÕPËTÕTÔ•PS‘PÐTUST“ÕUH‹ˆ™Y™\œ™Y›ØÝ\ÒYˆœ[ÜWØ[™Ú[[‹ˆ[›ØÚÙYXYYÎˆSÓPQÒQËˆZ[]\ÎˆMËˆ˜\œ˜]]™Nˆ¹®+øàh8àdxàk¹çëy§'ùidyí!8àjú)¢øàb8àgù¦î:hg¸àk¹§*ùl/¸àjøàkøà yã¢ú`ïz(eú`døàk¹k¯ùe­¹g,8à zi«8àk¹.©9.èù¢`8à Q^NL8î8~8îš9þiiž˜xþ8ÎŠ‰Ž8^8(Î8n8N8þ8""À¢7VV6†W3¢b…·7VV6‚‚$å3sR"Â.ZøNkŠþ888®8(ž8xè¾˜;ÞŠ~˜>8îj˜¾[˜^8(.Kˆž8¾iÈŽXˆn8îš;ÎiYž8(.8N8(ž8®8N8.Y»ÞXh^XN8ÎkŠþ8).™h¾88ˆ‹žYº>XN8þ8Þ8îXXŽ8î8~KÛþ8n8N8(.8(®88""Â.z+®Kú‰h~ZèžŠÂ"•Ò’À¢ÒÀ¢Ò’À¢Ò’À¢–çfW7F–vF–öã¢b‡°¢7FW–C¢&–çfW7F–vFR"À¢&WV—&VDWf–FVæ6T6÷VçC¢bÀ¢&WV—&VDWf–FVæ6Tw&÷W3¢b…´UD„õ$•E’Â4õdU$T”tåE’ÂÔ”Ä•D%•ô4$tòÂÄäD”ärÂ4ôÄÄ$õ$Dõ%2Â”åd4”ôåÒ’À¢fö7W6W3¢Â…°¢°¢–C¢&ÆuöæE÷6÷fW&V–vçG’"À¢Æ&VÃ¢.h¹¾ˆ{NjŠž™™8ŽkŠþk›îK‹¾jŠž8).Xˆn88xJX«ž8¾8~8Þ8(¾ZY{HN{y®8).z+®Zé®8ž8(²"À¢Ö–çWFW3¢BÀ¢æ'&F—fS¢.Š«8Îˆ‹ž8).[Ý~8)>8¾8Ž8ZInY»ÞXN8ŽKÙ^8).kŠ8ž9ëžiÙþ8¾8).XŠ^8	>8¾Š«þ8ž8(¾8.8šikž888~8þ8XŠ^8î{Û.YÞˆ^8ÎZY{HN8).{iž8îy»N8ž8""À¢w&÷W3¢Â…°¢²–C¢&–çf—FF–öâÖWF†÷&—G’"ÂÆ&VÃ¢.h¹¾ˆ{Ny«®8ŽiÈžX«ž8®jŠž™™8Î8.8>8þ8¾8).Kˆž{XÎ‹zþ8~z+®8¾8(8(²"ÂWf–FVæ6T–G3¢UD„õ$•E’ÒÀ¢²–C¢'÷'B×6÷fW&V–vçG’"ÂÆ&VÃ¢.[Šþ8zˆî™j.8Xž[ª¾8î8ž8îjŠžzøzw!Û9QMˆqªà¡©ÝrZ’V›zY¢žë^³‰Ú®¶­Š÷ ®‹©°¸š)bµªòqªà¢V›zW¯‰×§qâ°Â!0` è•©ÝŠx–‡$•¦Þ”6²ïg¯‰×§qâ°°ƒF‰Ú^¢™^jwbž×§¶V›zY¢žë^³‰Ú®¶­Š÷ ®‹©°¸v‰ž²Øœr‰eiº+jÚ+²V›zW¯‰×§qâ°#‹, NDÎE(qªbµ©bžö¬Š‰âž×§¶V›zW¯‰×§qâ°ƒU"6)â¶&¥èjwHœ‘êíŠÙ^uëZŠW(žØ§¹çFº'ZÇ…’'$z»b¶WzÖ¢–Ç¥yË^t·štk¢u©ÜxY"rG«uëZŠW^}êÅ‰×^}êåi·¥š)îµë9uçÞ¬È§º×¬×Í,ºiš¯ ÚË½§jºÚ¶+Þ•æ°¹^iØqçk‰È§¾+Z¶*'±æ¥}§"–+r!ÒÎ	4@BÎD3 4ämj¸´ºjØ¨×¬¶)Ú¶*'5©ž•¦Þ•ªi®†œ„‡m×—v¸œŠ{âµ«b¢{jWb±Ê/z¼ˆtäHMŠÇ(½êòMìmš)îµë8òWštÖ«­«b½é^iØ‚è¥uéž®§s)¢žë^±öœŠX­È‡K8$Ñ 1P‚ÃµªàzÒèq«b¢w^²Ø§jØ¨œÖ¦zV›zV©¦ºr·^`º)]zg«éÜÊh§º×¬v+¢÷«È‡@Q1ÎD„ØÕØ¬r‹Þ¯$ÞÆÙ¢žë^³Ž¥y§MjºÚ¶+Þ•æ‰Ùh­ÙšžŠì¹Ç²È¨ž· ŠË^­öœŠX­È‡K8$Ñ 19Ì Ó‘µªàzÒèq«b¢w^²Ø§jØ¨œÖ¦zV›zV©¦ºr·^e¢·fjz+²çzË"¢zÞ‚+-z·b±Ê/z¼ˆtäHMŠÇ(½êòMìmš)îµë8âWštÖ«­«b½é^iØ~ŠÞŠ	Ûz»ar‰í®‰\•«¬yöœŠX­È‡K8$Ñ 1P‚ÃµªàzÒèq«b¢w^²Ø§jØ¨œÖ¦zV›zV©¦ºr·^_¢·¢‚vÞ®Ø\¢{k¢W%jëv+¢÷«È‡R9QMŠÇ(½êòMìmš)îµë9ÒWštÖ«­«b½é^iØrë-¢k"šk§ŠÜ¬rºWŸiÈ¥ŠÜˆt³‚M%LãµªàzÒèq«b¢w^²Ø§jØ¨œÖ¦zV›zV©¦ºr·^\ºËhšÈ¦šéâ·+…çn•çb±Ê/z¼ˆu#•ÔØÕØ¬r‹Þ¯$ÞÆÐÚË½¦Š{­zÎ6•æ5ªëjØ¯zWšv'pj·¡¢ër‰ej×«jYš¥öœŠX­È‡K8$Ñ 19D„µªàzÒèq«b¢w^²Ø§jØ¨œÖ¦zV›zV©¦ºr·^pj·¡¢ër‰ej×«jYš¥Ø¬r‹Þ¯"HåDDB566v+¢÷«É7±¶h§º×¬ã¹^iÓZ®¶­Š÷¥y§bvÈžêZ®×+j×¥k'«±öœŠX­È‡K8$Ñ 19D„µªàzÒèq«b¢w^²Ø§jØ¨œÖ¦zV›zV©¦ºr·^l‰è¥ªír¶­zV²z»ŠÇ(½êò!Ó,„ÀE€€Dc´v+¢÷«É7±¶h§º×¬ãÙ^iÓZ®¶­Š÷¥y§bvg«qéÚ¯*è²×«jwik'Úr)b·",à“D Ä Ómj¸´ºjØ¨×¬¶)Ú¶*'5©ž•¦Þ•ªi®†œ„‡m×™ž­Ç§j¼«¢Ë^­©Ý¥¬ŠÇ(½êò!Ó,„ÀE€€Dcµv+¢÷«É7±¶h§º×¬ã™^iÓZ®¶­Š÷¥y§bvÈb§&«v§uç$r‰ïz»"¢wÚr)b·",à“D ÄHr`CµªàzÒèq«b¢w^²Ø§jØ¨œÖ¦zV›zV©¦ºr·^l†*rj·`ºw^rG(ž÷«²*'v+¢÷«È‡L ²ŽÙØ¬r‹Þ¯$ÞÆÙ¢žë^³åy§MjºÚ¶+Þ•æ‰×ZË½­‰×šÖÞ–WÚr)b·",à“D Ä	D“8Ä­j¸´ºjØ¨×¬¶)Ú¶*'5©ž•¦Þ”6²ïf©¦ºr·^]k.ö¶'^jw[zY]ŠÇ(½êò!ÒÀ42Gb±Ê/z¼“{Ck.öã9×NvÛùš)îµë8ÒWštÖ«­«b½é^iØž(!¶Èb~ÙZØ§‚ŠÝz·Úr)b·",à“D Ä<äSµªàzÒèq«b¢w^²Ø§jØ¨œÖ¦zV›zV©¦ºr·^gŠm²Ÿ¶V§v)à¢·^­Ø¬r‹Þ¯",C Ñµv+¢÷«É7±¶h§º×¬ãy^iÓZ®¶­Š÷¥y§bvËZnW«z«¢²+b¢{ªç§qçÚr)b·",à“D ÄI0,KZ®­.‡¶*'uë-Šv­Š‰Íjg¥i·¥jšk¡§!!ÛuæËZnW«z«¢²+b¢{ªç§qçb±Ê/z¼ˆt°ƒFÙØ¬r‹Þ¯$ÞÆÐÚË½ºîh§º×¬ã‰^iÓZ®¶­Š÷¥y§bu·«ÊWè­è ÊÞv+eŠwŸiÈ¥ŠÜˆt³‚Me,;Z®­.‡¶*'uë-Šv­Š‰Íjg¥i·¥jšk¡§!!Ûuå·«ÊWè­è ÊÞv+eŠwŠÇ(½êò!ÐŽ,°99´v+¢÷«É7±¶h§º×¬ãÉ^iÓZ®¶­Š÷¥y§bu¶³zZk¢ø¬Š‰Ü¢{kiË_iÈ¥ŠÜˆt³‚Me,;Z®­.‡¶*'uë-Šv­Š‰Íjg¥i·¥jšk¡§!!Ûuå¶³zZk¢ø¬Š‰Ü¢{kiË]ŠÇ(½êò!ÐŽ,°99µv+¢÷«É7±¶h§º×¬çI^iÓZ®¶­Š÷ƒk/t•æ‰Ö¥½ªÞÎšâ½«^µêæ±öœŠX­È‡K8$Ñ 19íj¸´ºjØ¨×¬¶)Ú¶*'5©ž•¦Þ•ªi®†œ„‡m×–¥½ªÞÎšâ½«^µêæ±Ø¬r‹Þ¯"âË ‘3‘Kgb±Ê/z¼“{fŠ{­zÎv•æ5ªëjØ¯zWšv'\j˜­jZèiÛ.®÷²}§"–+r!ÒÎ	4@D“ ÄµªàzÒèq«b¢w^²Ø§jØ¨œÖ¦zV›zV©¦ºr·^\j˜­jZèiÛ.®÷²v+¢÷«È‡H5P ãtv+¢÷«É7±¶h§º×¬ã©^iÓZ®¶­Š÷¥y§bvË©¦\œjW§uªí¡Ö²÷GÚr)b·",à“D ÄXDåÖ«ëK¡Æ­Š‰ÝzËb«b¢sZ™éZméCk/tjšk¡§!!ÛuæË©¦\œjW§uªí¡Ö²÷Gb±Ê/z¼ˆtƒU"7Wb±Ê/z¼“{Ck.ö¬½Òh§º×¬ã¹^iÓZ®¶­Š÷¥y§buú+z('r‰¦jw\Š˜^­öœŠX­È‡K8$Ñ 1Q$Î1+Z®­.‡¶*'uë-Šv­Š‰Íjg¥i·¥jšk¡§!!Ûuåú+z('r‰¦jw\Š˜^­Ø¬r‹Þ¯" Õ@HƒÙØ¬r‹Þ¯$ÞÆÙ¢žë^³ž%y§MjºÚ¶+Þ¦·¦jÛ«y¬¢[­Š‰Å‰ÚÞç-¢w¡Ë¦z{pŠØhºÛ"Åöœ¶ÉZméfŠ{­zÍº²é¦j¼§jºÚ¶+Þ¦‹-"{Þ²Ø jØ¨œk¢u©ÜxY"rG«¶+ey×­j)SÓ”ôé==O^,µêFº'ZÇ…m«m•ád‰É¬6²ïkb¶WzÖ¢•=x­ë(–÷…’'$z»b¶WzÖ¢–·¬¢[­Š‰Å²×©!ÚÞ²‰oyÈh‰Ç¬.'bžö¥‰Ö­z)ïŠÖ­Š‰Ú×è®hZ­º+r†¥ŠØ¨Ê'µìmøzw2+,Š‰ÈtÄO^ei·¥š)îµë5ßÊÞiØ§zËš)âšé’ºšh®Þh¥éâž ¡¢'!Ûjëa¢¸­É©Ýr‰í­§-¢—§Šxºšh®Ýkz«¢­çD¾'^Ç†®‹©°PLs‘!69QM‹.¦š+¶)àøzw!ÛDÇ9cDŽTDD cScC,„ÀE€€Dc´,C Ñ´âË ‘3‘KBTˆ8Ý)­êZ­«b¢s"žë^³Êkz–«jØ¨œ¶›zZkz–«jØ¨+¦™ªò¦·©j¶­Š‰ÍjºÚ¶+Þr‰í{Uj¸šžÛr‰í{HuÊâ¶'–Ýx}¨¥y×¦z¸Ì¡j¶è­Ê–+b¢{k¢æåx*'v+b¢{¶º.nWˆu=y¶º.nW’µ«n±Êâ¶'–Úè¹¹^!ÔõâÚè¹¹^JÖ­ºÇÚŠWš)îµë6ÛÉZmé\¢{^ÆÒ·^)¹¹bq«ŠØ§½©bu«^²uéÜ•«¬zÇåjžÊÝxEë(–ëb¢thº×Ÿ•¨j[ž¦æå‰Ë.¦™rjçbµ©Ý•è—­r¢žë^³Þ¥i·¥O^¢{^ÆÒ·N°¢¹­Ê(¥êÚ¶+Þ®éì…ªÛ¢·åjžÊÝ:Eë(–ëb¢thº×Ÿ•¨j[žÂŠäz·(¢—«jØ¯y©Ý²k ‚X§ƒ­r¢žë^³Ï%i·¥ONœ¢{^ÆÒ·Nlº»â¾)à–ŠÝ­ëè‘ë"žø­jØ¨ùZ€§²·NQzÊ%ºØ¨.µçåjZ–ç©®‹^rÙâr‰Z±©Ý¶·š¶h§º×¬÷YZmélºiš¯+.šf«È“®‹›•ä­jÛ¬Êâ¶'–v«­«b½éÚ®¶­Š÷É:è¹¹^JÖ­ºÁ\®+bq©p¢¹]÷ÞrÑ_•¨
{+uå¬¢[­Š‰Ñ¢ë^}§-!Úek'«O^bžø­jØ¨ž)ïjXj×…ªÛ¢·(jX­Š‰ßiËHt“®‹›•ä­jÛ¬Êâ¶'–™ZÉêÓ×—+ŠØœjYZØ§Ê'µ¨§yØZ­º+r†¥ŠØ¨ž×±¶×±´“®‹›•ä­jÛ¬Êâ¶'•öœŠX­È‡K8$Ñ 1P‚Ã¦º)j­Š‰ÃzV²‹«³VŸµêæjØO•©ì™Zž'm×—(jX­Š‰à•éì†'ír«µêç¥Â±#OMw‚†¥®éáj¶è­Ê–+b¢{!‰ûliËb¢zîž«nŠÜ¡©b¶*'²Ÿ¶ËZ®­æíj¸´VœŠX­È‡K8$Ñ 19ÝzV²‹«³K-jÛ¬Mìm­æ¬¢|(®G«²ÈZ­èZ­º+jëa¢¸­Ê™Zž'm×—(jX­Š‰Þ®w¬¶ˆèŠ{ly©lž—vÄ<-;æ
–f¢žÖ¢ž:"ž×.²Ú&²Çš–Æœ¶*'™¨§µ¨§Žˆ§µË¬¶‰¬±æ¥²Ö«ëG¹»Z®­§"–+r!ÒÎ	4@@”I3ŒI×¥k!èº»4²Ö­ºÄÞÆÚÞjÊ'rë-¢k'yçl²«y×!j)è}Ë¬¶‡r~‰e£©°Wè–Z0º˜%zzh®Ø¬ž‹ZmªëiÉ,4ð´×wè–Z0º—«ë-¢Økyëj[<-;æ'_j[jw!¢¶ y©Ýv+®gåyë\¢{^ÆÑ/‰×§qã"²È¨œ‡LHÔõæV›zY¢žë^³]º­æŠw¬°Y¢ž)®™+©¦ŠíæŠ^ž)à
"qâ±'®
ÙZØ§‚Š^ž)àJêi¢»u­ê®Š·øzwº.¦ÁL ²Ž,C Ñ¬ºšh®Ø§€KâuéÜx‡lHäHMR9QML ²ŽÔ°ƒFÔ#‹, NDÎE-H5P ãu¦·©j¶­Š‰ÌŠ{­zÏ)­êZ­«b¢rÚméi­êZ­«b¢t®šf«ÊšÞ¥ªÚ¶*'5ªëjØ¯yÊ'µìmUªâj{l-Ê'µìm!×+ŠØœj[uáö¢•çl‰è¥ªí±×œ£&Ú²)í®‹›•à¨Ø­Š‰ì.Úè¹¹^!ÔõæÚè¹¹^JÖ­ºÇ+ŠØœj[k¢æåx‡S×‹k¢æåy+Z¶ëj)^vh§º×¬Û^%i·¥r‰í{HvÝx­ëÞ®ÇzX¯z¼Ÿ¢·¢‚z+uêÜ¡×Ÿ•¨
{+uá¬¢[­Š‰Ñ¢ë^~V U©nz·¯z»uéb½êòjwmº¹Üjºâz»&Š{­zÏ6•¦Þ•=xr‰í{HvÝx{­²Çš•ç[yú+y·¥–†ãyËb½à¨Ø­Š‰ì.h¬²*'!Ó5=x¡¸ÞrØ¯x‡ly©lšè –)à{­²ËZ¶ë,¹Ç²É¢žë^³]5•¦Þ•=xr‰í{HvÝ=}¨¥y×+¹×š®kz—§uéÜÊÚè¹¹^!ÔôöÚè¹¹^JÖ­ºÇÚŠWš)îµë5ç‰Zmélºiš¯+.šf«È“®‹›•ä­jÛ¬Êâ¶'–v«­«b½éÚ®¶­Š÷É:è¹¹^JÖ­ºÁ\®+bq©p¢¹]÷ÞrÑ_•¨
{+uå¬¢[­Š‰Ñ¢ë^}§-!Úek'«O^_j[jw!¢¶ yù^z×b±ªæy×ÚrÒ$ë¢æåy+Z¶ër¸­‰Æ¥¦V²z´õåÊâ¶'–ÈžêZ®ÛyÊ2yÖ§uØ¬j¹žv×±¶×±´“®‹›•ä­jÛ¬Êâ¶'•öœŠX­È‡K8$Ñ 19é®ŠZ«b¢pÞ•¬‡¢êìÕ§íz¹š¶åj{¦V§‰Ûuå×œ£'­ë)ŠZ-­ën®yép‡lHÓÂÓ ¡©iŠZ-v+®g²©²&y§-Š‰éŠZ-v+®g²©²&zÖ«ëG¹»Z®­§"–+r!ÒÎ	4@CÎE7^•¬‡¢êìÒËZ¶ë{ky«(Ø¬j¹žuù^zÙÞyÛ,i÷°ŠØ]­¬–™Zž'm×—^rŒ¨®)ìz–«j×¬‰è¥ªí²z\!Û4ð´ïØ(j[¥ªÚµë"zœ¢jhéí±§-Š‰ìz–«j×¬‰èr‰©¢w§¶ËZ®­æíj¸´VœŠX­È‡K8$Ñ 1ƒØÝzV²‹«³K-jÛ¬Mìm­æ¬¢w¦Û«yÛ"z©j»lšë-ž‹[z·š²Ç¦nW~‰e£©°Wè–Z0º—­ë+zÛ«žØxÓÂÓŸ¢YhÂêh®)éj»lëÞ®gž´ÓÂÓ¿bvÊeŠ×§¾Œ¦z·ªâzÆ§vw ¢Øšµì"¶kk¥r‰í{D¾'^ÇŒŠË"¢r1#S×™ZméfŠ{­zÍuò·šv)Þ²ÁfŠx¦ºd®¦š+·š)zx§€(h‰ÇˆvÄœ¢YZnŠÚ¶Šìjw]zËb«b¢z)zx§+©¦ŠíÖ·ªº*ÞtKâuéÜxjèº›âË ‘3‘HƒU"6Ë©¦ŠíŠx¾'^ÇˆvÄ€Q1ÎD„ØÙ#•ÔØØÂ!0` í‹ ÐÈ4m‚8²Àä@LäRØƒU"7jkz–«jØ¨œÈ§º×¬òšÞ¥ªÚ¶*'-¦Þ–šÞ¥ªÚ¶*'Jé¦j¼©­êZ­«b¢sZ®¶­Š÷œ¢{^ÆÕZ®&§¶ÂÜ¢{^ÆÒr¸­‰Æ¥·^j)^vÊeŠÖŸµêåjwbžk¢æåx*'v+b¢{¶º.nWˆu=y¶º.nW’µ«n±Êâ¶'–Úè¹¹^!ÔõâÚè¹¹^JÖ­ºÇÚŠWš)îµë6Ó©Zmé\¢{^ÆÒ·^¢ŠÝŠv­yÛ‹;«z·¦¢÷¬nìž®ÇåjžÊÝxEë(–ëb¢thº×Ÿ•¨j[žrŠ+v)Úµçlz,î­æ§u»²z¶«­ë-²h§º×¬ó™ZméS×‡(ž×±´‡mÓšèÉ©i¹¹br)Ý‰Ëfz{[®)à²j'ŠÚ+±ùZ€§²·NQzÊ%ºØ¨.µçåjZ–ç«£&¥¦¬‰Èšž››–'"Øœ¶g§¶h§º×¬÷iZméSÓ—(ž×±´‡mÓ«^šš+j¼­®çç²w®¶¶¥Â+av¶°jWåjžÊÝ:Eë(–ëb¢thº×Ÿ•¨j[žµé©¢¶«Ë zÚîqé¢žë^³]=•¦Þ–Ë¦™ªò²é¦j¼É:è¹¹^JÖ­ºÁ\®+bq©gjºÚ¶+ÞªëjØ¯x“®‹›•ä­jÛ¬Êâ¶'—
+•Ñ}ç-ùZ€§²·^QzÊ%ºØ¨.µçÚrÒ¦V²z´õåéï£)ž­Ç§j¸ž²ÊeŠÜ"¶kk¥è(¶&­y×ÚrÒ$ë¢æåy+Z¶ër¸­‰Æ¥¦V²z´õåÊâ¶'–V§uçfz·ªâzË¥ªÚµçpŠØ]­¬–×±¶×±´“®‹›•ä­jÛ¬Êâ¶'•öœŠX­È‡K8$Ñ 14Úk¢– jØ¨œ7¥k!èº»6iû^®f­„ùZžÁi•©âvÝyÂ+av¶°jV¥½ªÞÎ·­º¹è®("©lž—vÄ<-5æ
–·­º¹ß¢·¢‚w(žÚÚrÚ+Š§j[rØ¨ž·­º¹ß¢·¢‚w(žÚÚrÚ+Š§j[-j¸´{›µªàzÑZr)b·",à“D Ä<äSuéZÈz.®Í,µ«n±7±¶·š²‰Þžú2šë-½êâ*ajÇÂ+av¶°jZejx·^pŠØ]­¬–f®­«^Ü(ºw^vz\!Û4ð´ïx(j[.¦š+·­…ÚÚÂ)àÂ‹§uçZrØ¨žË©¦ŠíÂ+av¶°Šx0¢éÝyÛZ®­æíj¸´VœŠX­È‡K8$Ñ 14×^•¬‡¢êìÒËZ¶ë{ky«(Ÿ­…ÚÚÁ©gyçlë­­©\jËš–Üœj·Ÿ¢YhÂêlú%–Œ.¥©oj·³žˆè‘é^~ÓOMy~‰e£©™««j‰Þ–+-¡ü(ºw^tÓÂÓ½