

const refs = {
  message: document.getElementById("message"),
  homePanel: document.getElementById("homePanel"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  backToTitleBtn: document.getElementById("backToTitleBtn"),
  waitingRoom: document.getElementById("waitingRoom"),
  waitingNote: document.getElementById("waitingNote"),
  loadingProgressText: document.getElementById("loadingProgressText"),
  loadingWaterFill: document.getElementById("loadingWaterFill"),
  roomIdText: document.getElementById("roomIdText"),
  copyRoomIdBtn: document.getElementById("copyRoomIdBtn"),
  memberList: document.getElementById("memberList"),
  startGameBtn: document.getElementById("startGameBtn"),
  deleteRoomBtn: document.getElementById("deleteRoomBtn"),
  leaveRoomBtn: document.getElementById("leaveRoomBtn"),
  page: document.querySelector(".page"),
  battleView: document.getElementById("battleView"),
};

const ORIGIN_TUTORIAL_DISMISSED_KEY = "originMagicCircleTutorialDismissed";





function installMobileZoomBlocker() {
  let lastTouchEndAt = 0;

  document.addEventListener(
    "touchend",
    (event) => {
      const now = Date.now();

      if (now - lastTouchEndAt <= 350) {
        event.preventDefault();
      }

      lastTouchEndAt = now;
    },
    { passive: false }
  );

  document.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches && event.touches.length >= 2) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  document.addEventListener(
    "gesturestart",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "gesturechange",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "gestureend",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );
}

installMobileZoomBlocker();





const summonAssetOptions = [
  "fireball.glb",
  "magic_voxel_skull_flat_shaded.glb",
  "stylized_fire_tornado.glb",
  "phoenix_bird.glb",
  "truth_about_the_dark_side_of_the_moon.glb",
  "broken_steampunk_clock.glb",
  "evanescent_plasma.glb",
  "gun-bot_with_walk_and_idle_animation.glb",
  "soulsucker_-_weaponcraft.glb",
  "bouquet.glb",
  "lance_of_the_primordials_-_dae_weaponcraft.glb",
  "pearl_electron.glb",
  "stranger_star.glb",
  "cube_cascade.glb",
  "cyber_orb.glb",
  "magic_marble.glb",
  "cyber_spore.glb",
  "dark_matter.glb",
  "harlequin_orb.glb",
  "evanescent_smoke.glb",

  "sun.glb",
  "meteorite.glb",
  "rocky_hell_terrain.glb",
  "magic_ring_-_yingyangblue.glb",
  "magic_ring_-_yellow.glb",
  "magic_ring_-_green.glb",
  "magic_ring_-_red.glb",
  "icicle.glb",
  "35b59066261a4a0a8c113da5b5a988e9.glb",
  "2024zhongqiu_4_loop.glb",
  "eff_huanguang.glb",
  "c3d8c3fda1ec45a0bdab896eba97e679.glb",
  "829e78a8ee3548369f3ac92c41a2ee74.glb",
  "67f9a0094a714d258e5c5088fac2a7a4.glb",
  "27444eb10a4f4409b4a2649738ec7441.glb",
  "c7ba0550fe034f29bfb54ca75b7eb1f6.glb",
  "fd37b7bec4ca48a8b6539dc4048787cf.glb",
  "technology_aperture_out.glb",
  "appearance_effect_light_beam.glb",
  "duchess_shield.glb",
  "hojas_verdes_caen.glb",
  "the_cube.glb",
  "armillary.glb",
  "icosahedron_knot.glb",
  "animated_effect.glb",
  "303ac171bafb4998950b741d7c89aa94.glb",
  "torii_gate_lighthouse.glb",
  "sculptjanuary2021_-_day_05_-_magic_gate.glb",
  "executor_warp_gate.glb",
  "japanese_tori_gate.glb",
  "stargate.glb",
  "cute_dragon.glb",
  "dragon.glb",
  "adult_dragon.glb",
  "dragon_walk.glb",
  "dragon_fly.glb",
  "tornado.glb",
  "tree.glb",
  "young_palm.glb",
  "spruce_tree_-_low_poly.glb",
  "creaturespirate_trooper.glb",
  "wing_379.glb",
  "blue_glowing_butterfly.glb",
  "hell_wings.glb",
  "low_poly__wings.glb",
  "wings_03.glb",
  "h6k4_war_thunder.glb",
  "k9_thunder_artillery.glb",
  "looping_snow_2.glb",
  "falling_snow_loop.glb",
  "snowflake_crystal_by_elsa_mmd2005.glb",
  "crystal.glb",
  "crystal_heart.glb",
  "purple_diamond_crystal_gem.glb",

  "lightning",
  "explosion_burst",
  "mist_cloud",
  "light_orb",
  "crystal_shard",
  "simple_ring",
];






const earlyWarmupAssetQueue = [
  "arid_wasteland.glb",
  "ancient_character.glb",
  "pedestal.glb",
];

let earlyWarmupStarted = false;

async function warmupOriginMagicCircleAssetsEarly() {
  if (earlyWarmupStarted) return;
  earlyWarmupStarted = true;

  for (const assetName of earlyWarmupAssetQueue) {
    try {
      await fetch(`/3D素材/${assetName}`, { cache: "force-cache" });
    } catch (error) {
      console.warn("[origin-magic-circle] early warmup failed:", assetName, error);
    }
  }
}

// Safari対策：全素材の事前fetchはメモリ圧迫になりやすいので停止
// setTimeout(() => {
//   warmupOriginMagicCircleAssetsEarly();
// }, 0);

const customEffectNames = new Set([
  "lightning",
  "explosion_burst",
  "mist_cloud",
  "light_orb",
  "crystal_shard",
  "simple_ring",
]);

//変更10
const summonAssetSizePresets = {
  "fireball.glb": {
    small: { scale: 1, y: 1.6 },
    medium: { scale: 2, y: 1.6 },
    large: { scale: 10, y: 1.6 },
  },
  "magic_voxel_skull_flat_shaded.glb": {
    small: { scale: 1, y: 1.75, offsetZ: 3.5 },
    medium: { scale: 2, y: 3.5, offsetZ: 7 },
    large: { scale: 4, y: 7, offsetZ: 14 },
  },
  "stylized_fire_tornado.glb": {
    small: { scale: 0.005, y: 1.6 },
    medium: { scale: 0.01, y: 1.6 },
    large: { scale: 0.03, y: 1.6 },
  },
  "phoenix_bird.glb": {
    small: { scale: 0.002, y: 1.6 },
    medium: { scale: 0.01, y: 1.6 },
    large: { scale: 0.03, y: 1.6 },
  },
  "truth_about_the_dark_side_of_the_moon.glb": {
    small: { scale: 1, y: 0.66 },
    medium: { scale: 3, y: 2 },
    large: { scale: 9, y: 6 },
  },
  "broken_steampunk_clock.glb": {
    small: { scale: 0.02, y: 4 },
    medium: { scale: 0.1, y: 4 },
    large: { scale: 0.15, y: 8 },
  },
  "evanescent_plasma.glb": {
    small: { scale: 1, y: 3 },
    medium: { scale: 2, y: 3 },
    large: { scale: 6, y: 3 },
  },
  "gun-bot_with_walk_and_idle_animation.glb": {
    small: { scale: 0.5, y: 1.6 },
    medium: { scale: 2, y: 1.6 },
    large: { scale: 4, y: 1.6 },
  },
  "soulsucker_-_weaponcraft.glb": {
    small: { scale: 1, y: 1.6 },
    medium: { scale: 2, y: 1.6 },
    large: { scale: 4, y: 1.6 },
  },
  "bouquet.glb": {
    small: { scale: 1.5, y: 1.6 },
    medium: { scale: 2.5, y: 1.6 },
    large: { scale: 5, y: 1.6 },
  },
  "lance_of_the_primordials_-_dae_weaponcraft.glb": {
    small: { scale: 150, y: 1.6 },
    medium: { scale: 300, y: 1.6 },
    large: { scale: 900, y: 1.6 },
  },
  "pearl_electron.glb": {
    small: { scale: 1, y: 1 },
    medium: { scale: 2, y: 2 },
    large: { scale: 4, y: 4 },
  },
  "stranger_star.glb": {
    small: { scale: 1, y: 3 },
    medium: { scale: 2, y: 3 },
    large: { scale: 4, y: 3 },
  },
  "cube_cascade.glb": {
    small: { scale: 0.5, y: 0.8 },
    medium: { scale: 1, y: 1.6 },
    large: { scale: 2, y: 6.2 },
  },
  "cyber_orb.glb": {
    small: { scale: 0.5, y: 0.8 },
    medium: { scale: 1, y: 1.6 },
    large: { scale: 5, y: 8 },
  },
  "magic_marble.glb": {
    small: { scale: 0.75, y: 3 },
    medium: { scale: 1.5, y: 3 },
    large: { scale: 3, y: 3 },
  },
  "cyber_spore.glb": {
    small: { scale: 1, y: 1.5 },
    medium: { scale: 2, y: 3 },
    large: { scale: 4, y: 6 },
  },
  "dark_matter.glb": {
    small: { scale: 2.5, y: 3 },
    medium: { scale: 5, y: 3 },
    large: { scale: 10, y: 3 },
  },
  "harlequin_orb.glb": {
    small: { scale: 0.5, y: 0.8 },
    medium: { scale: 1, y: 1.6 },
    large: { scale: 3, y: 4.8 },
  },
  "evanescent_smoke.glb": {
    small: { scale: 1, y: 3 },
    medium: { scale: 2, y: 5 },
    large: { scale: 4, y: 6 },
  },
  "lightning": {
    small: { scale: 1, y: 2 },
    medium: { scale: 2, y: 2 },
    large: { scale: 3, y: 2 },
  },
  "explosion_burst": {
    small: { scale: 1, y: 1.8 },
    medium: { scale: 2, y: 1.8 },
    large: { scale: 10, y: 1.8 },
  },
  "mist_cloud": {
    small: { scale: 1, y: 1.5 },
    medium: { scale: 2, y: 1.5 },
    large: { scale: 4, y: 1.5 },
  },
  "light_orb": {
    small: { scale: 0.75, y: 2.2 },
    medium: { scale: 1.5, y: 2.2 },
    large: { scale: 6, y: 7 },
  },
  "crystal_shard": {
    small: { scale: 0.8, y: 2.2 },
    medium: { scale: 1.6, y: 2.2 },
    large: { scale: 6.4, y: 3.5 },
  },
  "simple_ring": {
    small: { scale: 1, y: 2.5 },
    medium: { scale: 2, y: 2.5 },
    large: { scale: 5, y: 2.5 },
  },
};


Object.assign(summonAssetSizePresets, {
  "sun.glb": {
    small: { scale: 0.1, y: 3 },
    medium: { scale: 0.5, y: 7 },
    large: { scale: 1, y: 12 },
  },

  "meteorite.glb": {
    small: { scale: 0.1, y: 2, offsetZ: -1 },
    medium: { scale: 0.5, y: 2, offsetZ: -2 },
    large: { scale: 1, y: 5, offsetZ: -6 },
  },

  "rocky_hell_terrain.glb": {
    small: { scale: 0.0005, y: 4, offsetZ: 1 },
    medium: { scale: 0.001, y: 4, offsetZ: 3 },
    large: { scale: 0.002, y: 4, offsetZ: 7 },
  },

  "icicle.glb": {
    small: { scale: 2, y: 6, offsetZ: -0.5 },
    medium: { scale: 4, y: 10, offsetZ: -1 },
    large: { scale: 8, y: 19, offsetZ: -1 },
  },

  "35b59066261a4a0a8c113da5b5a988e9.glb": {
    small: { scale: 0.05, y: 1.6 },
    medium: { scale: 0.25, y: 1.6 },
    large: { scale: 1, y: 1.6 },
  },

  "2024zhongqiu_4_loop.glb": {
    small: { scale: 75, y: 1.6 },
    medium: { scale: 175, y: 1.6 },
    large: { scale: 500, y: 1.6 },
  },

  "eff_huanguang.glb": {
    small: { scale: 75, y: 1.6 },
    medium: { scale: 175, y: 1.6 },
    large: { scale: 500, y: 1.6 },
  },

  "c3d8c3fda1ec45a0bdab896eba97e679.glb": {
    small: { scale: 0.5, y: 3, rotationX: Math.PI / 2, rotationZ: Math.PI / 2 },
    medium: { scale: 1, y: 3, rotationX: Math.PI / 2, rotationZ: Math.PI / 2 },
    large: { scale: 2, y: 3, rotationX: Math.PI / 2, rotationZ: Math.PI / 2 },
  },

  "829e78a8ee3548369f3ac92c41a2ee74.glb": {
    small: { scale: 2, y: 1.6 },
    medium: { scale: 6, y: 1.6 },
    large: { scale: 25, y: 1.6 },
  },

  "67f9a0094a714d258e5c5088fac2a7a4.glb": {
    small: { scale: 1, y: 1.6, rotationY: Math.PI, rotationZ: Math.PI / 2 },
    medium: { scale: 2, y: 1.6, rotationY: Math.PI, rotationZ: Math.PI / 2 },
    large: { scale: 3, y: 1.6, rotationY: Math.PI, rotationZ: Math.PI / 2 },
  },

  "27444eb10a4f4409b4a2649738ec7441.glb": {
    small: { scale: 3, y: 1.6 },
    medium: { scale: 6, y: 1.6 },
    large: { scale: 15, y: 1.6 },
  },

  "c7ba0550fe034f29bfb54ca75b7eb1f6.glb": {
    small: { scale: 4, y: 1.6 },
    medium: { scale: 8, y: 1.6 },
    large: { scale: 25, y: 1.6 },
  },

  "fd37b7bec4ca48a8b6539dc4048787cf.glb": {
    small: { scale: 1.5, y: 1.6 },
    medium: { scale: 3, y: 1.6 },
    large: { scale: 15, y: 1.6 },
  },

  "technology_aperture_out.glb": {
    small: { scale: 0.25, y: 1.6 },
    medium: { scale: 5, y: 1.6 },
    large: { scale: 1, y: 1.6 },
  },

  "appearance_effect_light_beam.glb": {
    small: { scale: 1, y: 2 },
    medium: { scale: 2, y: 2 },
    large: { scale: 4, y: 2 },
  },

  "duchess_shield.glb": {
    small: { scale: 1, y: 1.6, rotationY: Math.PI / 2 },
    medium: { scale: 2, y: 1.6, rotationY: Math.PI / 2 },
    large: { scale: 4, y: 1.6, rotationY: Math.PI / 2 },
  },

  "hojas_verdes_caen.glb": {
    small: { scale: 3, y: 1.6 },
    medium: { scale: 6, y: 1.6 },
    large: { scale: 12, y: 1.6 },
  },

  "the_cube.glb": {
    small: { scale: 0.5, y: 4 },
    medium: { scale: 1, y: 4 },
    large: { scale: 1.5, y: 6 },
  },

  "armillary.glb": {
    small: { scale: 0.05, y: 3 },
    medium: { scale: 0.1, y: 4 },
    large: { scale: 0.2, y: 8 },
  },

  "icosahedron_knot.glb": {
    small: { scale: 0.25, y: 3 },
    medium: { scale: 0.5, y: 3 },
    large: { scale: 1, y: 5 },
  },

  "animated_effect.glb": {
    small: { scale: 1, y: 3 },
    medium: { scale: 3, y: 3 },
    large: { scale: 6, y: 4 },
  },

  "303ac171bafb4998950b741d7c89aa94.glb": {
    small: { scale: 100, y: 2 },
    medium: { scale: 200, y: 2 },
    large: { scale: 500, y: 2 },
  },

  "torii_gate_lighthouse.glb": {
    small: { scale: 0.2, y: 1.6 },
    medium: { scale: 0.5, y: 1.6 },
    large: { scale: 1, y: 1.6 },
  },

  "sculptjanuary2021_-_day_05_-_magic_gate.glb": {
    small: { scale: 0.0025, y: 1.6 },
    medium: { scale: 0.005, y: 1.6 },
    large: { scale: 0.01, y: 1.6 },
  },

  "executor_warp_gate.glb": {
    small: { scale: 0.5, y: 3, rotationY: Math.PI / 2 },
    medium: { scale: 1, y: 4, rotationY: Math.PI / 2 },
    large: { scale: 2, y: 8, rotationY: Math.PI / 2 },
  },

  "japanese_tori_gate.glb": {
    small: { scale: 0.25, y: 3, rotationY: Math.PI / 2 },
    medium: { scale: 0.5, y: 5, rotationY: Math.PI / 2 },
    large: { scale: 0.75, y: 7, rotationY: Math.PI / 2 },
  },

  "stargate.glb": {
    small: { scale: 1, y: 3, rotationY: Math.PI / 2 },
    medium: { scale: 2, y: 7.5, rotationY: Math.PI / 2 },
    large: { scale: 3, y: 10, rotationY: Math.PI / 2 },
  },

  "cute_dragon.glb": {
    small: { scale: 2, y: 3, rotationY: Math.PI / 2 },
    medium: { scale: 4, y: 6, rotationY: Math.PI / 2 },
    large: { scale: 6, y: 6, rotationY: Math.PI / 2 },
  },

  "dragon.glb": {
    small: { scale: 1, y: 1.6, rotationY: Math.PI / 2 },
    medium: { scale: 2, y: 1.6, rotationY: Math.PI / 2 },
    large: { scale: 4, y: 1.6, rotationY: Math.PI / 2 },
  },

  "adult_dragon.glb": {
    small: { scale: 1.5, y: 1.6, rotationY: Math.PI / 2 },
    medium: { scale: 3, y: 1.6, rotationY: Math.PI / 2 },
    large: { scale: 6, y: 1.6, rotationY: Math.PI / 2 },
  },

  "dragon_walk.glb": {
    small: { scale: 0.05, y: 1.6 },
    medium: { scale: 0.1, y: 1.6 },
    large: { scale: 0.2, y: 1.6 },
  },

  "dragon_fly.glb": {
    small: { scale: 0.005, y: 1.6 },
    medium: { scale: 0.01, y: 1.6 },
    large: { scale: 0.03, y: 1.6 },
  },

  "tornado.glb": {
    small: { scale: 0.025, y: 1.6 },
    medium: { scale: 0.05, y: 1.6 },
    large: { scale: 0.2, y: 1.6 },
  },

  "tree.glb": {
    small: { scale: 0.01, y: 1.6 },
    medium: { scale: 0.02, y: 1.6 },
    large: { scale: 0.04, y: 1.6 },
  },

  "young_palm.glb": {
    small: { scale: 0.3, y: 1.6 },
    medium: { scale: 0.6, y: 1.6 },
    large: { scale: 1.2, y: 1.6 },
  },

  "spruce_tree_-_low_poly.glb": {
    small: { scale: 0.004, y: 1.6 },
    medium: { scale: 0.008, y: 1.6 },
    large: { scale: 0.016, y: 1.6 },
  },

  "creaturespirate_trooper.glb": {
    small: { scale: 0.5, y: 1.6, rotationY: (80 * Math.PI) / 180 },
    medium: { scale: 1, y: 1.6, rotationY: (80 * Math.PI) / 180 },
    large: { scale: 2, y: 1.6, rotationY: (80 * Math.PI) / 180 },
  },

  "wing_379.glb": {
    small: { scale: 10, y: 1.6, rotationY: Math.PI / 2 },
    medium: { scale: 20, y: 1.6, rotationY: Math.PI / 2 },
    large: { scale: 90, y: 1.6, rotationY: Math.PI / 2 },
  },

  "blue_glowing_butterfly.glb": {
    small: { scale: 4, y: 0, offsetZ: 20 },
    medium: { scale: 8, y: -5, offsetZ: 40 },
    large: { scale: 32, y: -25, offsetZ: 160 },
  },

  "hell_wings.glb": {
    small: { scale: 1.5, y: 1.6, rotationY: Math.PI / 2 },
    medium: { scale: 3, y: 1.6, rotationY: Math.PI / 2 },
    large: { scale: 5, y: 1.6, rotationY: Math.PI / 2 },
  },

  "low_poly__wings.glb": {
    small: { scale: 3, y: 0, rotationY: Math.PI / 2 },
    medium: { scale: 6, y: -3, rotationY: Math.PI / 2 },
    large: { scale: 9, y: -6, rotationY: Math.PI / 2 },
  },

  "wings_03.glb": {
    small: { scale: 250, y: 4, rotationY: Math.PI / 2 },
    medium: { scale: 400, y: 5.5, rotationY: Math.PI / 2 },
    large: { scale: 800, y: 11, rotationY: Math.PI / 2 },
  },

  "h6k4_war_thunder.glb": {
    small: { scale: 0.1, y: 3, rotationY: Math.PI / 2 },
    medium: { scale: 0.2, y: 3, rotationY: Math.PI / 2 },
    large: { scale: 0.5, y: 3, rotationY: Math.PI / 2 },
  },

  "k9_thunder_artillery.glb": {
    small: { scale: 0.00003, y: 3, rotationY: Math.PI / 2 },
    medium: { scale: 0.00004, y: 3, rotationY: Math.PI / 2 },
    large: { scale: 0.00006, y: 3, rotationY: Math.PI / 2 },
  },

  "looping_snow_2.glb": {
    small: { scale: 0.5, y: 1.6 },
    medium: { scale: 1, y: 1.6 },
    large: { scale: 2, y: 1.6 },
  },

  "falling_snow_loop.glb": {
    small: { scale: 2, y: 1.6 },
    medium: { scale: 4, y: 1.6 },
    large: { scale: 8, y: 1.6 },
  },

  "snowflake_crystal_by_elsa_mmd2005.glb": {
    small: { scale: 0.02, y: 3, rotationZ: Math.PI / 2 },
    medium: { scale: 0.04, y: 4, rotationZ: Math.PI / 2 },
    large: { scale: 0.08, y: 8, rotationZ: Math.PI / 2 },
  },

  "crystal.glb": {
    small: { scale: 1, y: 3, rotationY: (100 * Math.PI) / 180 },
    medium: { scale: 2, y: 5, rotationY: (100 * Math.PI) / 180 },
    large: { scale: 4, y: 5, rotationY: (100 * Math.PI) / 180 },
  },

  "crystal_heart.glb": {
    small: { scale: 1, y: 1.6 },
    medium: { scale: 4, y: 1.6 },
    large: { scale: 8, y: 1.6 },
  },

  "purple_diamond_crystal_gem.glb": {
    small: { scale: 0.05, y: 1.6, rotationY: (100 * Math.PI) / 180 },
    medium: { scale: 0.1, y: 1.6, rotationY: (100 * Math.PI) / 180 },
    large: { scale: 0.2, y: 1.6, rotationY: (100 * Math.PI) / 180 },
  },
});

//変更14
const ENABLE_ORIGIN_DEBUG = false;

function showDebug(text) {
  if (!ENABLE_ORIGIN_DEBUG && !isOriginDebugTestRoom) return;
  
  let panel = document.getElementById("debugPanel");

  if (!panel) {
    panel = document.createElement("div");
    panel.id = "debugPanel";
    panel.style.position = "fixed";
    panel.style.left = "8px";
    panel.style.bottom = "80px";
    panel.style.zIndex = "20000";
    panel.style.maxWidth = "95vw";
    panel.style.maxHeight = "18vh";
    panel.style.overflow = "auto";
    panel.style.background = "rgba(0,0,0,0.8)";
    panel.style.color = "#0f0";
    panel.style.fontSize = "12px";
    panel.style.padding = "8px";
    panel.style.display = "flex";
    panel.style.gap = "8px";
    panel.style.alignItems = "flex-start";

    const pre = document.createElement("pre");
    pre.id = "debugPanelText";
    pre.style.margin = "0";
    pre.style.whiteSpace = "pre-wrap";

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "コピー";
    copyBtn.style.fontSize = "12px";
    copyBtn.style.padding = "4px 8px";
    copyBtn.onclick = async () => {
      await navigator.clipboard.writeText(pre.textContent || "");
      copyBtn.textContent = "コピー済";
      setTimeout(() => {
        copyBtn.textContent = "コピー";
      }, 1000);
    };
    
    
    
    const toggleBtn = document.createElement("button");
toggleBtn.textContent = "折り畳む";
toggleBtn.style.fontSize = "12px";
toggleBtn.style.padding = "4px 8px";

toggleBtn.onclick = () => {
  const collapsed = panel.dataset.collapsed === "1";
  panel.dataset.collapsed = collapsed ? "0" : "1";

  if (pre) {
    pre.style.display = collapsed ? "" : "none";
  }

  toggleBtn.textContent = collapsed ? "折り畳む" : "開く";
};

    panel.append(pre, copyBtn, toggleBtn);
    document.body.appendChild(panel);
  }

  const pre = document.getElementById("debugPanelText");
  if (pre) pre.textContent = text;
}

const user = JSON.parse(localStorage.getItem("currentUser") || "null");
const username = String(user?.username || "ゲスト");
const userTrackingId = String(user?.userTrackingId || "");

let currentRoom = null;
let refreshTimer = null;
let battleStarted = false;

let originSocket = null;
let isOriginDebugTestRoom = false;


let onBattleHpReachedZero = null;


const ORIGIN_MAGIC_CIRCLE_MAX_HP = 1000;

let battleState = {
  selfHp: ORIGIN_MAGIC_CIRCLE_MAX_HP,
  enemyHp: ORIGIN_MAGIC_CIRCLE_MAX_HP,
  lastCastAt: 0,
  processedCastIds: new Set(),

  currentTurnOwnerId: "",
  currentTurnSeq: 0,

  gameEnded: false,
  endingStarted: false,
  winnerId: "",
  loserId: "",

  magicLogs: [],
};





let battleSceneCleanup = null;
const battleTimeoutIds = new Set();

function setBattleTimeout(callback, delayMs) {
  const id = setTimeout(() => {
    battleTimeoutIds.delete(id);
    callback();
  }, delayMs);

  battleTimeoutIds.add(id);
  return id;
}

function clearBattleTimeouts() {
  battleTimeoutIds.forEach((id) => clearTimeout(id));
  battleTimeoutIds.clear();
}

function createInitialBattleState() {
  return {
    selfHp: ORIGIN_MAGIC_CIRCLE_MAX_HP,
    enemyHp: ORIGIN_MAGIC_CIRCLE_MAX_HP,
    lastCastAt: 0,
    processedCastIds: new Set(),

    currentTurnOwnerId: "",
    currentTurnSeq: 0,

    gameEnded: false,
    endingStarted: false,
    winnerId: "",
    loserId: "",

    magicLogs: [],
  };
}

function resetBattleClientStateForLobby() {
  clearBattleTimeouts();

  if (typeof battleSceneCleanup === "function") {
    battleSceneCleanup();
    battleSceneCleanup = null;
  }

  battleStarted = false;
  loadingBattleFlowStarted = false;
  onBattleHpReachedZero = null;

  battleState = createInitialBattleState();

  document.getElementById("originWinBanner")?.remove();
  document.getElementById("magicNameCenterOverlay")?.remove();
  document.getElementById("battleTutorialModal")?.remove();
  document.getElementById("originTurnModal")?.remove();

  refs.battleView.innerHTML = "";
  refs.battleView.classList.add("hidden");
  refs.page?.classList.remove("hidden");
}

function enterRematchWaitingRoom(room) {
  resetBattleClientStateForLobby();

  currentRoom = room;
  saveActiveRoomId(room.roomId);

  showWaitingRoom(room);
  setMessage("もう一度遊ぶ準備ができました。開始ボタンを押してください。");

  stopRefresh();
  startRefresh();
}





let tutorialModalDismissed = false;
const ACTIVE_ROOM_STORAGE_KEY = "originMagicCircleActiveRoomId";
let loadingBattleFlowStarted = false;

function setMessage(text) {
  refs.message.textContent = text || "";
}

function updateLoadingProgress(loadedCount, totalCount) {
  showLoadingNote();

  // 以下は今のまま

    const safeLoaded = Number.isFinite(loadedCount) ? Math.max(0, loadedCount) : 0;
  const safeTotal = Number.isFinite(totalCount) ? Math.max(0, totalCount) : 0;

  if (refs.loadingProgressText) {
    refs.loadingProgressText.textContent = safeTotal > 0 ? `素材読み込み中... ${safeLoaded}/${safeTotal}` : "";
  }

  if (refs.loadingWaterFill) {
    const ratio = safeTotal > 0 ? Math.min(safeLoaded / safeTotal, 1) : 0;
    refs.loadingWaterFill.style.height = `${ratio * 100}%`;
  }
}




function showNormalNote(text = "") {
  refs.waitingNote?.classList.remove("hidden", "loading-active");

  if (refs.loadingProgressText) {
    refs.loadingProgressText.textContent = text;
  }

  if (refs.loadingWaterFill) {
    refs.loadingWaterFill.style.height = "0%";
  }
}

function hideWaitingNote() {
  refs.waitingNote?.classList.add("hidden");
  refs.waitingNote?.classList.remove("loading-active");

  if (refs.loadingProgressText) {
    refs.loadingProgressText.textContent = "";
  }

  if (refs.loadingWaterFill) {
    refs.loadingWaterFill.style.height = "0%";
  }
}

function showLoadingNote() {
  refs.waitingNote?.classList.remove("hidden");
  refs.waitingNote?.classList.add("loading-active");
}






function resetLoadingWaterFillVisual() {
  if (!refs.loadingWaterFill) return;
  refs.loadingWaterFill.style.transition = "none";
  refs.loadingWaterFill.style.height = "0%";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (refs.loadingWaterFill) {
        refs.loadingWaterFill.style.transition = "height 0.28s ease";
      }
    });
  });
}

function showOpponentLoadingWaitMessage() {
  if (refs.loadingProgressText) {
    refs.loadingProgressText.textContent = "対戦相手のロードを待っています...";
  }
  setMessage("対戦相手のロードを待っています...");
}

function showHomePanel() {
  refs.homePanel?.classList.remove("hidden");
}

function hideHomePanel() {
  refs.homePanel?.classList.add("hidden");
}

function saveActiveRoomId(roomId) {
  if (!roomId) return;
  localStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, roomId);
}

function clearActiveRoomId() {
  localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
}

function showWaitingRoom(room) {
  
  
  //hideWaitingNote();  

  currentRoom = room;
  if (room?.status !== "loading") {
    loadingBattleFlowStarted = false;
    hideWaitingNote();
  }
  hideHomePanel();
  refs.waitingRoom.classList.remove("hidden");
  //refs.waitingNote.classList.add("hidden");
  refs.roomIdText.textContent = room.roomId;
  refs.memberList.innerHTML = "";
  refs.copyRoomIdBtn?.classList.remove("hidden");
refs.copyRoomIdBtn.onclick = async () => {
  await navigator.clipboard.writeText(String(room.roomId || ""));
  refs.copyRoomIdBtn.textContent = "コピー済";
  setTimeout(() => {
    refs.copyRoomIdBtn.textContent = "コピー";
  }, 1000);
};

  const isHost = room.members.some((member) => member.id === userTrackingId && member.role === "host");
  room.members.forEach((member) => {
    
    
    
    const li = document.createElement("li");
    li.textContent = `${member.name}${member.role === "host" ? "（ホスト）" : ""}`;
    
    
    
    refs.memberList.appendChild(li);
  });

  refs.startGameBtn.disabled = !isHost || room.members.length !== 2;
  refs.deleteRoomBtn.classList.toggle("hidden", !isHost);
  refs.leaveRoomBtn.classList.toggle("hidden", isHost);
}

async function callApi(path, body = undefined, method = "GET") {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "request_failed");
  return data;
}

async function refreshRoom() {
  if (!currentRoom?.roomId || battleStarted) return;

  try {
    const room = await callApi(
      `/api/origin-magic-circle/rooms/${encodeURIComponent(currentRoom.roomId)}`
    );

    currentRoom = room;
    saveActiveRoomId(room.roomId);

    const members = Array.isArray(room.members) ? room.members : [];

    // 2人以上いる待機部屋では、常に最新状態を画面に反映
    showWaitingRoom(room);

    // ホストが開始した結果、status が loading / 対戦中 になったら即移行
    if (members.length >= 2 && room.status === "対戦中") {
  stopRefresh();
  await startThreeBattleScene();
  return;
}

if (members.length >= 2 && room.status === "loading") {
  showLoadingNote();
  showOpponentLoadingWaitMessage();
  return;
}
  } catch {
    stopRefresh();
    clearActiveRoomId();
    currentRoom = null;
    showHomePanel();
    refs.waitingRoom.classList.add("hidden");
    showNormalNote("");
    refs.waitingNote?.classList.add("hidden");
    setMessage("ルームが見つかりませんでした。再作成してください。");
  }
}



function getSocketIoClient() {
  if (typeof window === "undefined" || typeof window.io !== "function") {
    console.warn("[origin-magic-circle] socket.io client is not loaded");
    return null;
  }

  if (!originSocket) {
    originSocket = window.io();
  }

  return originSocket;
}

function emitWithAck(socket, eventName, payload, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error("socket_missing"));
      return;
    }

    socket.timeout(timeoutMs).emit(eventName, payload, (error, response) => {
      if (error) {
        reject(error);
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "socket_request_failed"));
        return;
      }

      resolve(response);
    });
  });
}

function applyHpPayload(hpPayload) {
  if (!hpPayload) return;

  battleState.selfHp = Number.isFinite(Number(hpPayload.selfHp))
  ? Math.max(0, Math.min(ORIGIN_MAGIC_CIRCLE_MAX_HP, Number(hpPayload.selfHp)))
  : ORIGIN_MAGIC_CIRCLE_MAX_HP;

battleState.enemyHp = Number.isFinite(Number(hpPayload.enemyHp))
  ? Math.max(0, Math.min(ORIGIN_MAGIC_CIRCLE_MAX_HP, Number(hpPayload.enemyHp)))
  : ORIGIN_MAGIC_CIRCLE_MAX_HP;

  renderHpBars();

  if (!battleState.gameEnded && (battleState.selfHp <= 0 || battleState.enemyHp <= 0)) {
    onBattleHpReachedZero?.();
  }
}

async function joinOriginSocketRoom() {
  const socket = getSocketIoClient();
  if (!socket || !currentRoom?.roomId || !userTrackingId) return;

  const response = await emitWithAck(socket, "origin:join", {
    roomId: currentRoom.roomId,
    userTrackingId,
  });

  if (response.room) {
    currentRoom = response.room;
  }

  applyHpPayload(response.hp);
}

async function requestLatestHpBySocket() {
  const socket = getSocketIoClient();
  if (!socket || !currentRoom?.roomId || !userTrackingId) return;

  const response = await emitWithAck(socket, "origin:requestHp", {
    roomId: currentRoom.roomId,
    userTrackingId,
  });

  if (response.room) {
    currentRoom = response.room;
  }

  applyHpPayload(response.hp);
}


/*async function syncBattleHp() {
  if (!currentRoom?.roomId) return;
  try {
    const room = await callApi("/api/origin-magic-circle/rooms/hp", {
      roomId: currentRoom.roomId,
      userTrackingId,
      selfHp: battleState.selfHp,
      enemyHp: battleState.enemyHp,
    }, "POST");
    currentRoom = room;
  } catch (error) {
    console.warn("[origin-magic-circle] hp sync failed:", error);
  }
}*/

function showDamageNumber(amount, isEnemyCast) {
  const target = document.createElement("div");
  target.className = "damage-number";
  const safe = Math.max(1, Number(amount) || 1);
  const size = Math.min(92, 24 + Math.sqrt(safe) * 3);
  target.style.fontSize = `${size}px`;
  target.style.left = isEnemyCast ? "24vw" : "74vw";
  target.style.top = "18vh";
  target.textContent = `-${Math.round(safe)}`;
  refs.battleView?.appendChild(target);
  setTimeout(() => target.remove(), 900);
}

function ensureTutorialModal() {
  if (document.getElementById("battleTutorialModal")) return;
  if (localStorage.getItem(ORIGIN_TUTORIAL_DISMISSED_KEY) === "1") return;

  const modal = document.createElement("div");
  modal.id = "battleTutorialModal";
  modal.className = "battle-tutorial-modal";
  modal.textContent = "魔法陣を描き相手を倒せ！";
  refs.battleView?.appendChild(modal);
}

function hideTutorialModal() {
  tutorialModalDismissed = true;
  localStorage.setItem(ORIGIN_TUTORIAL_DISMISSED_KEY, "1");
  document.getElementById("battleTutorialModal")?.remove();
}

function startRefresh() {
  stopRefresh();

  // まず即時確認。これがないと、開始直後に最大1秒待つ
  refreshRoom();

  // 2人以上になった後の開始反映を速く拾いたいので1秒にする
  refreshTimer = setInterval(refreshRoom, 1000);
}

function stopRefresh() {
  if (!refreshTimer) return;
  clearInterval(refreshTimer);
  refreshTimer = null;
}


async function preloadStartAssetsWithLoadingScreen() {
  const preloadTargets = [
    "arid_wasteland.glb",
    "ancient_character.glb",
    "pedestal.glb",
    ...summonAssetOptions.filter((assetName) => assetName.endsWith(".glb")),
  ];

  updateLoadingProgress(0, preloadTargets.length);
  for (let index = 0; index < preloadTargets.length; index += 1) {
    const assetName = preloadTargets[index];
    updateLoadingProgress(index, preloadTargets.length);
    try {
      await fetch(`/3D素材/${assetName}`, { cache: "force-cache" });
    } catch (error) {
      console.warn("[origin-magic-circle] preload failed:", assetName, error);
    }
    updateLoadingProgress(index + 1, preloadTargets.length);
  }
}




function showMagicNameCenter(magicName, isEnemy = false, onComplete = null) {
  const old = document.getElementById("magicNameCenterOverlay");
  if (old) old.remove();
  const overlay = document.createElement("div");
  overlay.id = "magicNameCenterOverlay";
  overlay.className = `magic-name-banner${isEnemy ? " enemy" : ""}`;
  overlay.textContent = magicName || "無名の魔法";
  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.remove();
    if (typeof onComplete === "function") onComplete();
  }, 2200);
}




function showMagicNameCenterAsync(magicName, isEnemy = false) {
  return new Promise((resolve) => {
    showMagicNameCenter(magicName, isEnemy, resolve);
  });
}



function showRoomIdModal() {
  return new Promise((resolve) => {
    const old = document.getElementById("roomIdInputModal");
    if (old) old.remove();

    const modal = document.createElement("div");
    modal.id = "roomIdInputModal";
    modal.className = "room-id-modal";
    modal.innerHTML = `
      <div class="room-id-modal__backdrop"></div>
      <div class="room-id-modal__card">
        <h3>ルーム入室</h3>
        <p>6桁のルームIDを入力してください</p>
        <input class="room-id-modal__input" inputmode="numeric" maxlength="6" placeholder="123456" />
        <div class="room-id-modal__actions">
          <button type="button" class="room-id-modal__cancel">キャンセル</button>
          <button type="button" class="room-id-modal__ok">入室</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector(".room-id-modal__input");
    const okBtn = modal.querySelector(".room-id-modal__ok");
    const cancelBtn = modal.querySelector(".room-id-modal__cancel");

    const close = (value) => {
      modal.remove();
      resolve(value);
    };

    input.focus();

    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 6);
    });

    const submitRoomId = () => {
  const value = input.value.trim();
  close(value || null);
};

okBtn.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  submitRoomId();
});

cancelBtn.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  close(null);
});


    modal.querySelector(".room-id-modal__backdrop").addEventListener("click", () => close(null));

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        close(input.value.trim() || null);
      }
      if (event.key === "Escape") {
        close(null);
      }
    });
  });
}




function createOriginDebugTestRoom() {
  return {
    roomId: "000000",
    members: [
      {
        name: username || "player",
        id: userTrackingId,
        role: "host",
        hp: ORIGIN_MAGIC_CIRCLE_MAX_HP,
      },
      {
        name: "bot",
        id: "origin-debug-bot",
        role: "guest",
        hp: ORIGIN_MAGIC_CIRCLE_MAX_HP,
      },
    ],
    status: "対戦中",
    expiresAt: Date.now() + 60 * 60 * 1000,
    isDebugTestRoom: true,
  };
}




function setupMagicCircleUi(container, options = {}) {
  const {
    onMagicJsonReady = null,
    hideTopModalOnce = null,
    hideDebugOnce = null,
  } = options;
  const overlay = document.createElement("canvas");
  overlay.className = "magic-circle-overlay";
  const ctx = overlay.getContext("2d");

  const controlsLeft = document.createElement("div");
  controlsLeft.className = "magic-circle-controls left";
  const undoBtn = document.createElement("button");
  undoBtn.type = "button";
  undoBtn.textContent = "↩︎";
  const redoBtn = document.createElement("button");
  redoBtn.type = "button";
  redoBtn.textContent = "↪︎";
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.textContent = "🗑";
  controlsLeft.append(undoBtn, redoBtn, clearBtn);

  const controlsRight = document.createElement("div");
  controlsRight.className = "magic-circle-controls right";
  const chantBtn = document.createElement("button");
  chantBtn.type = "button";
  chantBtn.className = "chant-btn";
  chantBtn.textContent = "魔法陣詠唱🪄ྀི";
  controlsRight.appendChild(chantBtn);

const history = [];
let historyIndex = -1;
let activePointerId = null;
let lastPoint = null;
let isChanting = false;
let isInputEnabled = true;

// 追加：一筆ごとの座標保存
const strokeList = [];
let currentStroke = null;


  let ritualController = null;
  //let spinStartTs = 0;

  const resultModal = document.createElement("div");
  resultModal.className = "chant-result-modal hidden";
  resultModal.innerHTML = `
    <div class="chant-result-modal__backdrop"></div>
    <div class="chant-result-modal__card">
      <h3 class="chant-result-modal__title">魔法陣の真名</h3>
      <p class="chant-result-modal__text"></p>
      <button type="button" class="chant-result-modal__close">閉じる</button>
    </div>
  `;
  const resultText = resultModal.querySelector(".chant-result-modal__text");
  const closeModalBtn = resultModal.querySelector(".chant-result-modal__close");

  const updateButtons = () => {
  if (isChanting || !isInputEnabled) {
    undoBtn.disabled = true;
    redoBtn.disabled = true;
    clearBtn.disabled = true;
    chantBtn.disabled = true;
    return;
  }

  undoBtn.disabled = historyIndex <= 0;
  redoBtn.disabled = historyIndex >= history.length - 1;
  clearBtn.disabled = historyIndex <= 0;
  chantBtn.disabled = false;
};

  const restoreState = () => {
  if (!ctx) return;

  ctx.clearRect(0, 0, overlay.width, overlay.height);

  const snapshot = history[historyIndex];

  if (!snapshot?.image) {
    restoreStrokeList([]);
    updateButtons();
    return;
  }

  restoreStrokeList(snapshot.strokes || []);

  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.drawImage(img, 0, 0, overlay.width, overlay.height);
    updateButtons();
  };
  img.src = snapshot.image;
};



  const commitState = () => {
  const snapshot = {
    image: overlay.toDataURL("image/png"),
    strokes: cloneStrokeList(),
  };

  history.splice(historyIndex + 1);
  history.push(snapshot);
  historyIndex = history.length - 1;
  updateButtons();
};

  const getPos = (event) => {
    const rect = overlay.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  
  
  
  
  
  const normalizeStrokePoint = (point) => {
  return [
    Math.round(point.x),
    Math.round(point.y),
  ];
};

const appendPointToCurrentStroke = (point) => {
  if (!currentStroke) return;

  const [x, y] = normalizeStrokePoint(point);

  // 直前と同じ座標なら保存しない
  const len = currentStroke.length;
  if (len >= 2) {
    const lastX = currentStroke[len - 2];
    const lastY = currentStroke[len - 1];

    const dx = x - lastX;
    const dy = y - lastY;

    // 近すぎる点は間引く。保存量をかなり減らせる
    if (dx * dx + dy * dy < 9) return;
  }

  currentStroke.push(x, y);
};

const cloneStrokeList = () => {
  return strokeList.map((stroke) => stroke.slice());
};

const restoreStrokeList = (strokes) => {
  strokeList.length = 0;

  if (!Array.isArray(strokes)) return;

  strokes.forEach((stroke) => {
    if (Array.isArray(stroke) && stroke.length >= 4) {
      strokeList.push(stroke.slice());
    }
  });
};

const createShape64FromCanvas = (sourceCanvas) => {
  const size = 64;
  const square = document.createElement("canvas");
  square.width = size;
  square.height = size;

  const sctx = square.getContext("2d");
  if (!sctx) return "";

  sctx.fillStyle = "#fff";
  sctx.fillRect(0, 0, size, size);

  const sourceW = sourceCanvas.width;
  const sourceH = sourceCanvas.height;
  const scale = Math.min(size / sourceW, size / sourceH);
  const drawW = sourceW * scale;
  const drawH = sourceH * scale;
  const dx = (size - drawW) / 2;
  const dy = (size - drawH) / 2;

  sctx.drawImage(sourceCanvas, dx, dy, drawW, drawH);

  const imageData = sctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  let result = "";

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const alpha = data[i + 3] / 255;
    const brightness = (r + g + b) / 3;
    const darkness = (255 - brightness) * alpha;
    const level = Math.max(0, Math.min(15, Math.round((darkness / 255) * 15)));
    result += level.toString(16);
  }

  return result;
};

const getTrimmedMagicCircleData = () => {
  if (!ctx) {
    return {
      base64ImageFile: "",
      strokeJson: "",
      shape64: "",
    };
  }

  const imageData = ctx.getImageData(0, 0, overlay.width, overlay.height);
  const { data, width, height } = imageData;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha === 0) continue;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      base64ImageFile: "",
      strokeJson: "",
      shape64: "",
    };
  }

  const padding = 12;

  const trimLeft = Math.max(0, minX - padding);
  const trimTop = Math.max(0, minY - padding);
  const trimRight = Math.min(width - 1, maxX + padding);
  const trimBottom = Math.min(height - 1, maxY + padding);

  const trimWidth = trimRight - trimLeft + 1;
  const trimHeight = trimBottom - trimTop + 1;

  const cropped = document.createElement("canvas");
  cropped.width = trimWidth;
  cropped.height = trimHeight;

  const croppedCtx = cropped.getContext("2d");
  if (!croppedCtx) {
    return {
      base64ImageFile: "",
      strokeJson: "",
      shape64: "",
    };
  }

  croppedCtx.fillStyle = "#ffffff";
  croppedCtx.fillRect(0, 0, trimWidth, trimHeight);
  croppedCtx.putImageData(
    ctx.getImageData(trimLeft, trimTop, trimWidth, trimHeight),
    0,
    0
  );

  const trimmedStrokes = strokeList
    .map((stroke) => {
      if (!Array.isArray(stroke)) return [];

      const next = [];
      const usableLength = stroke.length - (stroke.length % 2);

      for (let i = 0; i < usableLength; i += 2) {
        const x = Math.round(Number(stroke[i]) - trimLeft);
        const y = Math.round(Number(stroke[i + 1]) - trimTop);

        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

        const clampedX = Math.max(0, Math.min(trimWidth - 1, x));
        const clampedY = Math.max(0, Math.min(trimHeight - 1, y));

        next.push(clampedX, clampedY);
      }

      return next;
    })
    .filter((stroke) => stroke.length >= 4);

  const strokePayload = {
    w: trimWidth,
    h: trimHeight,
    strokes: trimmedStrokes,
  };

  const shape64 = createShape64FromCanvas(cropped);

  return {
    base64ImageFile: cropped
      .toDataURL("image/png")
      .replace(/^data:image\/png;base64,/, ""),
    strokeJson: JSON.stringify(strokePayload),
    shape64,
  };
};







  const configureCtx = () => {
    if (!ctx) return;
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#000";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

const resizeOverlay = () => {
  const activeSnapshot = history[historyIndex] || null;

  overlay.width = window.innerWidth;
  overlay.height = window.innerHeight;
  configureCtx();

  if (!activeSnapshot?.image) {
    ctx?.clearRect(0, 0, overlay.width, overlay.height);
    return;
  }

  const img = new Image();
  img.onload = () => {
    ctx?.clearRect(0, 0, overlay.width, overlay.height);
    ctx?.drawImage(img, 0, 0, overlay.width, overlay.height);
  };
  img.src = activeSnapshot.image;
};

  overlay.addEventListener("pointerdown", (event) => {
    if (!isInputEnabled) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (activePointerId !== null) return;
    activePointerId = event.pointerId;
    overlay.setPointerCapture(event.pointerId);
    configureCtx();
    lastPoint = getPos(event);
    
    
    
    currentStroke = [];
appendPointToCurrentStroke(lastPoint);



    ctx?.beginPath();
    ctx?.moveTo(lastPoint.x, lastPoint.y);
    ctx?.lineTo(lastPoint.x + 0.01, lastPoint.y + 0.01);
    ctx?.stroke();
  });

  overlay.addEventListener("pointermove", (event) => {
    if (!isInputEnabled) return;
    if (event.pointerId !== activePointerId || !lastPoint) return;
    const point = getPos(event);

appendPointToCurrentStroke(point);

ctx?.beginPath();
ctx?.moveTo(lastPoint.x, lastPoint.y);
ctx?.lineTo(point.x, point.y);
ctx?.stroke();
lastPoint = point;
  });

  const finishStroke = (event) => {
  if (event.pointerId !== activePointerId) return;

  if (lastPoint) {
    appendPointToCurrentStroke(lastPoint);
  }

  if (currentStroke && currentStroke.length >= 4) {
    strokeList.push(currentStroke);
  }

  currentStroke = null;
  activePointerId = null;
  lastPoint = null;

  commitState();
};

  overlay.addEventListener("pointerup", finishStroke);
  overlay.addEventListener("pointercancel", finishStroke);

  
  
  
  
  undoBtn.addEventListener("click", () => {
  if (isChanting) return;
  if (historyIndex <= 0) return;
  historyIndex -= 1;
  restoreState();
});

redoBtn.addEventListener("click", () => {
  if (isChanting) return;
  if (historyIndex >= history.length - 1) return;
  historyIndex += 1;
  restoreState();
});

clearBtn.addEventListener("click", () => {
  if (isChanting) return;
  if (historyIndex <= 0) return;

  ctx?.clearRect(0, 0, overlay.width, overlay.height);

  strokeList.length = 0;
  currentStroke = null;

  commitState();
});

  
  
  
  
  
  
  const resetCanvasAndHistory = () => {
  if (!ctx) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  overlay.style.transition = "";
  overlay.style.transform = "";


strokeList.length = 0;
currentStroke = null;


  history.length = 0;
  historyIndex = -1;
  commitState();
  updateButtons();
};

const sampleDrawnPixels = (maxParticles = 900) => {
  if (!ctx) return [];

  const imageData = ctx.getImageData(0, 0, overlay.width, overlay.height);
  const { data, width, height } = imageData;

  const points = [];
  const step = Math.max(2, Math.floor(Math.sqrt((width * height) / maxParticles) / 2));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];

      if (alpha > 20) {
        points.push({
          x: x + (Math.random() - 0.5) * 2,
          y: y + (Math.random() - 0.5) * 2,
        });
      }
    }
  }

  if (points.length <= maxParticles) return points;

  const sampled = [];
  for (let i = 0; i < maxParticles; i += 1) {
    sampled.push(points[Math.floor(Math.random() * points.length)]);
  }

  return sampled;
};





//ここから

const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};

const randomBetween = (min, max) => {
  return min + Math.random() * (max - min);
};

const lerp = (a, b, t) => {
  return a + (b - a) * t;
};

const easeSmooth = (t) => {
  const v = clamp(Number(t) || 0, 0, 1);
  return v * v * (3 - 2 * v);
};






// 魔法陣詠唱演出の調整値

// 魔法陣として最低限成立する外円の点数
const RITUAL_MIN_CIRCLE_POINTS = 12;

// 入力された線の量が多いほど、点数や記号を増やす
const RITUAL_MAX_POINTS = 180;

// ピンク発光＋魔法名表示後、この時間だけそのまま見せる
const RITUAL_FINAL_HOLD_MS = 3000;

// 消える時のフェード時間
const RITUAL_FADE_MS = 620;

const makePointKey = (() => {
  let counter = 0;

  return (prefix) => {
    counter += 1;
    return `${prefix}-${counter}`;
  };
})();

const pointOnCircle = (cx, cy, radius, angle) => {
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
};

const addPoint = (model, x, y, prefix) => {
  const key = makePointKey(prefix);

  model.points.push({
    key,
    x,
    y,
  });

  return key;
};

const addConnection = (model, fromKey, toKey, groupId = "default") => {
  model.connections.push({
    fromKey,
    toKey,
    groupId,
  });
};

const addClosedCircle = (model, cx, cy, radius, pointCount, prefix, rotation = 0) => {
  const keys = [];

  for (let i = 0; i < pointCount; i += 1) {
    const angle = rotation + (Math.PI * 2 * i) / pointCount;
    const p = pointOnCircle(cx, cy, radius, angle);
    keys.push(addPoint(model, p.x, p.y, prefix));
  }

  for (let i = 0; i < keys.length; i += 1) {
    addConnection(model, keys[i], keys[(i + 1) % keys.length], prefix);
  }

  return keys;
};

const addPolygon = (model, cx, cy, radius, pointCount, prefix, rotation = -Math.PI / 2) => {
  return addClosedCircle(model, cx, cy, radius, pointCount, prefix, rotation);
};

const addPentagram = (model, cx, cy, radius, prefix, rotation = -Math.PI / 2) => {
  const keys = [];

  for (let i = 0; i < 5; i += 1) {
    const angle = rotation + (Math.PI * 2 * i) / 5;
    const p = pointOnCircle(cx, cy, radius, angle);
    keys.push(addPoint(model, p.x, p.y, prefix));
  }

  const order = [0, 2, 4, 1, 3, 0];

  for (let i = 0; i < order.length - 1; i += 1) {
    addConnection(model, keys[order[i]], keys[order[i + 1]], prefix);
  }

  return keys;
};

const addHexagram = (model, cx, cy, radius, prefix, rotation = -Math.PI / 2) => {
  const keys = [];

  for (let i = 0; i < 6; i += 1) {
    const angle = rotation + (Math.PI * 2 * i) / 6;
    const p = pointOnCircle(cx, cy, radius, angle);
    keys.push(addPoint(model, p.x, p.y, prefix));
  }

  const triA = [0, 2, 4, 0];
  const triB = [1, 3, 5, 1];

  for (let i = 0; i < triA.length - 1; i += 1) {
    addConnection(model, keys[triA[i]], keys[triA[i + 1]], `${prefix}-a`);
  }

  for (let i = 0; i < triB.length - 1; i += 1) {
    addConnection(model, keys[triB[i]], keys[triB[i + 1]], `${prefix}-b`);
  }

  return keys;
};

const addRadialLines = (
  model,
  cx,
  cy,
  innerRadius,
  outerRadius,
  count,
  prefix,
  rotation = 0
) => {
  for (let i = 0; i < count; i += 1) {
    const angle = rotation + (Math.PI * 2 * i) / count;

    const inner = pointOnCircle(cx, cy, innerRadius, angle);
    const outer = pointOnCircle(cx, cy, outerRadius, angle);

    const innerKey = addPoint(model, inner.x, inner.y, `${prefix}-inner`);
    const outerKey = addPoint(model, outer.x, outer.y, `${prefix}-outer`);

    addConnection(model, innerKey, outerKey, prefix);
  }
};

const addSmallOrbitCircles = (
  model,
  cx,
  cy,
  orbitRadius,
  smallRadius,
  circleCount,
  pointCount,
  prefix,
  rotation = 0
) => {
  for (let i = 0; i < circleCount; i += 1) {
    const angle = rotation + (Math.PI * 2 * i) / circleCount;
    const center = pointOnCircle(cx, cy, orbitRadius, angle);

    addClosedCircle(
      model,
      center.x,
      center.y,
      smallRadius,
      pointCount,
      `${prefix}-${i}`,
      rotation + angle
    );
  }
};


const getDrawnStrokeStats = () => {
  let pointCount = 0;
  let totalLength = 0;
  let strokeCount = 0;

  strokeList.forEach((stroke) => {
    if (!Array.isArray(stroke) || stroke.length < 4) return;

    strokeCount += 1;
    pointCount += Math.floor(stroke.length / 2);

    const usableLength = stroke.length - (stroke.length % 2);

    for (let i = 2; i < usableLength; i += 2) {
      const x1 = Number(stroke[i - 2]);
      const y1 = Number(stroke[i - 1]);
      const x2 = Number(stroke[i]);
      const y2 = Number(stroke[i + 1]);

      if (
        !Number.isFinite(x1) ||
        !Number.isFinite(y1) ||
        !Number.isFinite(x2) ||
        !Number.isFinite(y2)
      ) {
        continue;
      }

      totalLength += Math.hypot(x2 - x1, y2 - y1);
    }
  });

  return {
    strokeCount,
    pointCount,
    totalLength,
  };
};

const addOpenArc = (
  model,
  cx,
  cy,
  radius,
  pointCount,
  prefix,
  startAngle = 0,
  arcRate = 0.72
) => {
  const keys = [];
  const safePointCount = Math.max(2, Math.round(pointCount));
  const arcAngle = Math.PI * 2 * clamp(arcRate, 0.12, 0.95);

  for (let i = 0; i < safePointCount; i += 1) {
    const t = safePointCount <= 1 ? 0 : i / (safePointCount - 1);
    const angle = startAngle + arcAngle * t;
    const p = pointOnCircle(cx, cy, radius, angle);
    keys.push(addPoint(model, p.x, p.y, prefix));
  }

  for (let i = 0; i < keys.length - 1; i += 1) {
    addConnection(model, keys[i], keys[i + 1], prefix);
  }

  return keys;
};





const countDrawnStrokePoints = () => {
  return strokeList.reduce((sum, stroke) => {
    if (!Array.isArray(stroke)) return sum;
    return sum + Math.floor(stroke.length / 2);
  }, 0);
};






  const createMagicCircleModel = () => {
  const width = overlay.width;
  const height = overlay.height;

  const cx = width / 2;
  const cy = height / 2;

  const minSide = Math.min(width, height);
  const radius = minSide * randomBetween(0.23, 0.31);
  const rotation = randomBetween(0, Math.PI * 2);

  const stats = getDrawnStrokeStats();

  /*
    入力線の長さから、作れる線の量を決める。
    45pxにつき接続線1本くらい。
    少ない入力では本当にスカスカにする。
  */
  const lineBudget = clamp(
    Math.round(stats.totalLength / 45),
    2,
    90
  );

  const model = {
    points: [],
    connections: [],
  };

  // かなり少ない入力：円未満。短い弧だけ。
  if (lineBudget <= 7) {
    addOpenArc(
      model,
      cx,
      cy,
      radius,
      Math.max(3, lineBudget + 1),
      "weak-arc",
      rotation,
      randomBetween(0.22, 0.48)
    );

    return model;
  }

  // 少なめ：外周だけ。星は出さない。
  if (lineBudget <= 16) {
    const outerPointCount = clamp(lineBudget, 8, 14);

    addClosedCircle(
      model,
      cx,
      cy,
      radius,
      outerPointCount,
      "outer-circle",
      rotation
    );

    return model;
  }

  // 普通以上：まず外円
  const outerPointCount = clamp(
    Math.round(lineBudget * 0.42),
    12,
    28
  );

  addClosedCircle(
    model,
    cx,
    cy,
    radius,
    outerPointCount,
    "outer-circle",
    rotation
  );

  // ここから先は、線量に応じて段階追加
  if (lineBudget >= 22) {
    if (Math.random() < 0.5) {
      addPentagram(
        model,
        cx,
        cy,
        radius * randomBetween(0.70, 0.86),
        "pentagram",
        rotation - Math.PI / 2
      );
    } else {
      addHexagram(
        model,
        cx,
        cy,
        radius * randomBetween(0.70, 0.86),
        "hexagram",
        rotation - Math.PI / 2
      );
    }
  }

  if (lineBudget >= 34) {
    addClosedCircle(
      model,
      cx,
      cy,
      radius * randomBetween(0.54, 0.68),
      clamp(Math.round(lineBudget * 0.22), 12, 22),
      "inner-circle",
      rotation * 0.5
    );
  }

  if (lineBudget >= 46) {
    addClosedCircle(
      model,
      cx,
      cy,
      radius * randomBetween(0.20, 0.34),
      12,
      "core-circle",
      rotation * 0.2
    );
  }

  if (lineBudget >= 58) {
    const polygonCount = Math.random() < 0.5 ? 8 : 12;

    addPolygon(
      model,
      cx,
      cy,
      radius * randomBetween(0.42, 0.54),
      polygonCount,
      "polygon",
      rotation + Math.PI / polygonCount
    );
  }

  if (lineBudget >= 72) {
    const radialCount = Math.random() < 0.5 ? 8 : 12;

    addRadialLines(
      model,
      cx,
      cy,
      radius * 0.18,
      radius * 0.95,
      radialCount,
      "radial",
      rotation
    );
  }

  if (lineBudget >= 84) {
    const smallCircleCount = Math.random() < 0.5 ? 5 : 6;

    addSmallOrbitCircles(
      model,
      cx,
      cy,
      radius * randomBetween(0.82, 0.92),
      radius * randomBetween(0.055, 0.085),
      smallCircleCount,
      8,
      "small-circle",
      rotation
    );
  }

  if (model.points.length > RITUAL_MAX_POINTS) {
    const allowed = new Set(
      model.points.slice(0, RITUAL_MAX_POINTS).map((point) => point.key)
    );

    model.points = model.points.slice(0, RITUAL_MAX_POINTS);
    model.connections = model.connections.filter((connection) => {
      return allowed.has(connection.fromKey) && allowed.has(connection.toKey);
    });
  }

  return model;
};








const createMagicCircleTargets = () => {
  const model = createMagicCircleModel();

  const pointMap = new Map();
  model.points.forEach((point, index) => {
    pointMap.set(point.key, {
      ...point,
      index,
    });
  });

  const targets = model.points.map((point, index) => ({
    x: point.x,
    y: point.y,
    key: point.key,
    targetIndex: index,
  }));

  const connections = model.connections
    .map((connection) => {
      const from = pointMap.get(connection.fromKey);
      const to = pointMap.get(connection.toKey);

      if (!from || !to) return null;

      return {
        fromIndex: from.index,
        toIndex: to.index,
        groupId: connection.groupId,
      };
    })
    .filter(Boolean);

  return {
    targets,
    connections,
  };
};

const assignTargetsToParticles = (particles, targetData) => {
  const targets = targetData.targets || [];
  const connections = targetData.connections || [];

  /*
    particles数とtargets数が違う場合に備える。
    今回は「図形側が必要な点数を決める」ので、
    particlesはtargets数に合わせるのが自然。
  */
  particles.length = targets.length;

  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];

    if (!particles[i]) {
      particles[i] = {
        x: overlay.width / 2,
        y: overlay.height / 2,
        sx: overlay.width / 2,
        sy: overlay.height / 2,
        mx: overlay.width / 2,
        my: overlay.height / 2,
        tx: target.x,
        ty: target.y,
        fromX: overlay.width / 2,
        fromY: overlay.height / 2,
        nextX: target.x,
        nextY: target.y,
        size: 2.4,
        alpha: 0.88,
      };
    }

    particles[i].fromX = particles[i].x;
    particles[i].fromY = particles[i].y;
    particles[i].nextX = target.x;
    particles[i].nextY = target.y;
    particles[i].tx = target.x;
    particles[i].ty = target.y;
    particles[i].targetIndex = i;
  }

  particles.connections = connections;
};

const createMagicNameRitualOverlay = (magicName) => {
  const old = document.getElementById("ritualMagicNameOverlay");
  old?.remove();

  const overlayName = document.createElement("div");
  overlayName.id = "ritualMagicNameOverlay";
  overlayName.className = "ritual-magic-name-overlay";
  overlayName.textContent = magicName || "無名の魔法";

  refs.battleView?.appendChild(overlayName);

  return overlayName;
};






const startMagicCircleRitualAnimation = () => {
  if (!ctx) return null;

  const rawSourcePoints = sampleDrawnPixels(950);
if (!rawSourcePoints.length) return null;

const startedAt = performance.now();

const initialTargetData = createMagicCircleTargets();
const sourcePoints = rawSourcePoints.length
  ? rawSourcePoints
  : [{ x: overlay.width / 2, y: overlay.height / 2 }];
  
  
  


const particles = initialTargetData.targets.map((target, index) => {
  const source = sourcePoints[index % sourcePoints.length] || {
    x: overlay.width / 2,
    y: overlay.height / 2,
  };

  const angle = Math.random() * Math.PI * 2;
  const scatterDistance = 60 + Math.random() * 150;

  return {
    x: source.x,
    y: source.y,

    sx: source.x,
    sy: source.y,

    mx: source.x + Math.cos(angle) * scatterDistance,
    my: source.y + Math.sin(angle) * scatterDistance,

    tx: target.x,
    ty: target.y,

    fromX: source.x,
    fromY: source.y,
    nextX: target.x,
    nextY: target.y,

    targetIndex: index,

    size: 2.2 + Math.random() * 1.2,
    alpha: 0.82 + Math.random() * 0.18,
  };
});

particles.connections = initialTargetData.connections;






  let rafId = null;
  let finished = false;

  let isMorphing = false;
  let morphStartedAt = 0;
  let morphDuration = 650;
  let nextMorphAt = startedAt + 1200 + Math.random() * 1100;

  let finishing = false;
  let finishStartedAt = 0;
  let finishResolve = null;
  let magicNameNode = null;

  const beginMorphToNewMagicCircle = (now) => {
  const targetData = createMagicCircleTargets();

  assignTargetsToParticles(particles, targetData);

  morphStartedAt = now;
  morphDuration = 520 + Math.random() * 620;
  isMorphing = true;

  nextMorphAt = now + morphDuration + 650 + Math.random() * 1400;
};









  const drawMagicCircleLines = (finalGlowRate, vanishRate) => {
  const visibleAlpha = Math.max(0, 1 - vanishRate);

  if (finishing) {
    ctx.strokeStyle = `rgba(255, 95, 210, ${0.62 * visibleAlpha})`;
    ctx.shadowColor = "rgba(255, 80, 215, 0.98)";
    ctx.shadowBlur = 12 + finalGlowRate * 26;
    ctx.lineWidth = 2.1;
  } else {
    ctx.strokeStyle = `rgba(12, 8, 22, ${0.72 * visibleAlpha})`;
    ctx.shadowColor = "rgba(110, 70, 180, 0.25)";
    ctx.shadowBlur = 2;
    ctx.lineWidth = 1.8;
  }

  const connections = particles.connections || [];

  connections.forEach((connection) => {
    const a = particles[connection.fromIndex];
    const b = particles[connection.toIndex];

    if (!a || !b) return;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });

  ctx.shadowBlur = 0;
};

  const drawParticle = (p, finalGlowRate, vanishRate) => {
    const alpha = Math.max(0, p.alpha * (1 - vanishRate));

    if (finishing) {
      ctx.fillStyle = `rgba(255, 130, 225, ${alpha})`;
      ctx.shadowColor = "rgba(255, 90, 220, 1)";
      ctx.shadowBlur = 10 + finalGlowRate * 22;
    } else {
      ctx.fillStyle = `rgba(8, 6, 16, ${alpha})`;
      ctx.shadowColor = "rgba(95, 60, 150, 0.24)";
      ctx.shadowBlur = 1.5;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  };

  const draw = (now) => {
    if (!ctx || finished) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const elapsed = now - startedAt;

    let finalGlowRate = 0;
    let vanishRate = 0;

    if (finishing) {
  finalGlowRate = easeSmooth((now - finishStartedAt) / 460);

  // ピンク発光＋魔法名表示後、3秒は消えずに待機。
  // その後 RITUAL_FADE_MS で魔法陣と魔法名が同時に消える。
  vanishRate = easeSmooth(
    Math.max(0, now - finishStartedAt - RITUAL_FINAL_HOLD_MS) / RITUAL_FADE_MS
  );

  if (magicNameNode) {
    magicNameNode.style.opacity = String(Math.max(0, 1 - vanishRate));
    magicNameNode.style.transform = `translate(-50%, -50%) scale(${1 + finalGlowRate * 0.04})`;
  }
}

    if (!finishing && now >= nextMorphAt) {
      beginMorphToNewMagicCircle(now);
    }

    // 最初だけ：描いた魔法陣 → 散る → 新しい魔法陣へ整列
    const formT = easeSmooth(elapsed / 1200);

    particles.forEach((p) => {
      if (formT < 0.36) {
        const t = easeSmooth(formT / 0.36);
        p.x = lerp(p.sx, p.mx, t);
        p.y = lerp(p.sy, p.my, t);
        return;
      }

      if (!isMorphing) {
        const t = easeSmooth((formT - 0.36) / 0.64);
        p.x = lerp(p.mx, p.tx, t);
        p.y = lerp(p.my, p.ty, t);
      }
    });

    // 不定期に魔法陣の形を変える。
    // この時以外は点を揺らさず、完全に静止させる。
    if (isMorphing) {
      const t = easeSmooth((now - morphStartedAt) / morphDuration);

      particles.forEach((p) => {
        p.x = lerp(p.fromX, p.nextX, t);
        p.y = lerp(p.fromY, p.nextY, t);

        if (t >= 1) {
          p.tx = p.nextX;
          p.ty = p.nextY;
        }
      });

      if (t >= 1) {
        isMorphing = false;
      }
    } else if (formT >= 1) {
      particles.forEach((p) => {
        p.x = p.tx;
        p.y = p.ty;
      });
    }

    drawMagicCircleLines(finalGlowRate, vanishRate);

    particles.forEach((p) => {
      drawParticle(p, finalGlowRate, vanishRate);
    });

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    if (finishing && vanishRate >= 1) {
      finished = true;

      if (rafId) cancelAnimationFrame(rafId);

      ctx.clearRect(0, 0, overlay.width, overlay.height);
      magicNameNode?.remove();
      magicNameNode = null;

      finishResolve?.();
      return;
    }

    rafId = requestAnimationFrame(draw);
  };

  ctx.clearRect(0, 0, overlay.width, overlay.height);
  rafId = requestAnimationFrame(draw);

  return {
    finish(magicName) {
      return new Promise((resolve) => {
        if (finished) {
          resolve();
          return;
        }

        finishing = true;
        finishStartedAt = performance.now();
        finishResolve = resolve;

        magicNameNode = createMagicNameRitualOverlay(magicName);
      });
    },

    cancel() {
      finished = true;

      if (rafId) cancelAnimationFrame(rafId);

      ctx?.clearRect(0, 0, overlay.width, overlay.height);
      magicNameNode?.remove();
      magicNameNode = null;
    },
  };
};

const finishMagicCircleRitualAnimation = async (magicName = "") => {
  if (!ritualController) {
    resetCanvasAndHistory();
    return;
  }

  try {
    await ritualController.finish(magicName);
  } finally {
    ritualController = null;
    resetCanvasAndHistory();
  }
};

const cancelMagicCircleRitualAnimation = () => {
  ritualController?.cancel();
  ritualController = null;
  resetCanvasAndHistory();
};








  chantBtn.addEventListener("click", async () => {
  hideTutorialModal();

  if (isChanting) return;
  isChanting = true;
  updateButtons();

  try {
    const {
  base64ImageFile,
  strokeJson,
  shape64,
} = getTrimmedMagicCircleData();

if (!base64ImageFile) {
  alert("魔法陣を描いてください。");
  return;
}

ritualController = startMagicCircleRitualAnimation();

const res = await fetch("/api/origin-magic-circle/chant-title", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    base64ImageFile,
    strokeJson,
    shape64,
  }),
});

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "chant_failed");

    const magicEffectJson = data.magicEffectJson || null;
const magicName = String(magicEffectJson?.magicName || "無名の魔法");

await finishMagicCircleRitualAnimation(magicName);


    if (typeof onMagicJsonReady === "function" && magicEffectJson) {
  await onMagicJsonReady(magicEffectJson, {
    strokeJson: data.strokeJson || strokeJson,

    // 類似キャッシュヒット時は data.spellHash がキャッシュ元のG列hash。
    // 新規生成時は data.spellHash === data.imageHash。
    spellHash: data.spellHash || data.imageHash || "",
  });
      hideTopModalOnce?.();
      hideTutorialModal();
      hideDebugOnce?.();
    } else {
      resultText.textContent = data.title || "無題";
      resultModal.classList.remove("hidden");
    }
  } catch (error) {
    console.error("[origin-magic-circle] chant failed:", error);
    //cancelGlyphRitualAnimation();
    cancelMagicCircleRitualAnimation();
    
    alert("詠唱に失敗しました。");
  } finally {
    isChanting = false;
    overlay.style.transition = "";
    overlay.style.transform = "";
    updateButtons();
  }
});







  closeModalBtn?.addEventListener("click", () => {
    resultModal.classList.add("hidden");
  });

  container.append(overlay, controlsLeft, controlsRight, resultModal);
  resizeOverlay();
  commitState();
  updateButtons();

  return {
  resizeOverlay,

  setInputEnabled(enabled) {
    isInputEnabled = Boolean(enabled);

    overlay.style.pointerEvents = isInputEnabled ? "auto" : "none";
    overlay.style.opacity = isInputEnabled ? "1" : "0.72";

    updateButtons();
  },
};
  
}



function ensureHpBars() {
  if (document.getElementById("hpBars")) return;

  const enemy = (currentRoom?.members || []).find((m) => m.id !== userTrackingId);
  const wrap = document.createElement("div");
  wrap.id = "hpBars";
  wrap.className = "hp-bars";
  wrap.innerHTML = `
    <div class="hp-card">
      <div class="hp-label">${username}</div>
      <div class="hp-track">
        <div id="selfHpFill" class="hp-fill self"></div>
        <div id="selfHpValue" class="hp-value">${ORIGIN_MAGIC_CIRCLE_MAX_HP}/${ORIGIN_MAGIC_CIRCLE_MAX_HP}</div>
      </div>
    </div>
    <div class="hp-card">
      <div class="hp-label">${enemy?.name || "相手"}</div>
      <div class="hp-track">
        <div id="enemyHpFill" class="hp-fill enemy"></div>
        <div id="enemyHpValue" class="hp-value">${ORIGIN_MAGIC_CIRCLE_MAX_HP}/${ORIGIN_MAGIC_CIRCLE_MAX_HP}</div>
      </div>
    </div>
  `;
  refs.battleView.appendChild(wrap);
}

function renderHpBars() {
  ensureHpBars();

  const sf = document.getElementById("selfHpFill");
  const ef = document.getElementById("enemyHpFill");
  const sv = document.getElementById("selfHpValue");
  const ev = document.getElementById("enemyHpValue");

  if (sf) sf.style.width = `${(battleState.selfHp / ORIGIN_MAGIC_CIRCLE_MAX_HP) * 100}%`;
if (ef) ef.style.width = `${(battleState.enemyHp / ORIGIN_MAGIC_CIRCLE_MAX_HP) * 100}%`;
if (sv) sv.textContent = `${battleState.selfHp}/${ORIGIN_MAGIC_CIRCLE_MAX_HP}`;
if (ev) ev.textContent = `${battleState.enemyHp}/${ORIGIN_MAGIC_CIRCLE_MAX_HP}`;

}



let magicCircleUiController = null;

let isTurnActionLocked = false;

function setTurnActionLocked(locked) {
  isTurnActionLocked = Boolean(locked);
  renderTurnUi();
}

function isMyTurn() {
  if (isOriginDebugTestRoom) return true;
  return String(battleState.currentTurnOwnerId || "") === String(userTrackingId || "");
}

function ensureTurnModal() {
  let modal = document.getElementById("originTurnModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "originTurnModal";
    modal.style.position = "fixed";
modal.style.left = "50%";
modal.style.bottom = "calc(env(safe-area-inset-bottom) + 2dvh)";
modal.style.transform = "translateX(-50%)";
    modal.style.zIndex = "40000000";
    modal.style.padding = "14px 22px";
    modal.style.borderRadius = "999px";
    modal.style.background = "linear-gradient(135deg, rgba(10,14,35,0.88), rgba(70,36,110,0.82))";
    modal.style.color = "#fff";
    modal.style.fontWeight = "800";
    modal.style.fontSize = "16px";
    modal.style.letterSpacing = "0.08em";
    modal.style.boxShadow = "0 12px 36px rgba(0,0,0,0.36), inset 0 0 18px rgba(255,255,255,0.14)";
    modal.style.backdropFilter = "blur(10px)";
    modal.style.pointerEvents = "none";
    modal.style.transition = "opacity 0.25s ease, transform 0.25s ease";
    refs.battleView?.appendChild(modal);
  }

  return modal;
}

function renderTurnUi() {
  const modal = ensureTurnModal();

  if (battleState.gameEnded) {
    modal.style.opacity = "0";
    return;
  }

  if (!battleState.currentTurnOwnerId) {
    modal.textContent = "先攻を決定中...";
    modal.style.opacity = "1";
    modal.style.transform = "translateX(-50%) scale(1)";
    magicCircleUiController?.setInputEnabled?.(false);
    return;
  }

  const myTurn = isMyTurn();

 if (myTurn) {
  modal.textContent = "";
  modal.style.opacity = "0";
  modal.style.transform = "translateX(-50%) scale(0.96)";
} else {
  modal.textContent = "相手のターン";
  modal.style.opacity = "1";
  modal.style.transform = "translateX(-50%) scale(1)";
}

  magicCircleUiController?.setInputEnabled?.(myTurn && !isTurnActionLocked);
}

function applyRoomTurnState(room) {
  currentRoom = room || currentRoom;

  const next = room?.battleState || {};
  battleState.currentTurnOwnerId = String(next.turnOwnerId || "");
  battleState.currentTurnSeq = Math.max(0, Math.round(Number(next.turnSeq) || 0));

  renderTurnUi();
}





function calculateMagicTotalDamage(effectJson) {
  const totalDamage = Number.isFinite(Number(effectJson?.totalDamage))
    ? Math.max(0, Math.round(Number(effectJson.totalDamage)))
    : null;

  const legacyMaxDamage = Math.min(
    ORIGIN_MAGIC_CIRCLE_MAX_HP,
    Math.max(0, Number(effectJson?.artScore) || 0)
  );

  const damageTimings = Array.isArray(effectJson?.damageTimings)
    ? effectJson.damageTimings
    : [];

  const total = damageTimings.reduce((sum, timing) => {
    const weight = Math.max(0, Number(timing?.damageWeight) || 0);
    return sum + Math.round((totalDamage !== null ? totalDamage : legacyMaxDamage) * (weight / 100));
  }, 0);

  return Math.max(0, total);
}





function extractMagicMaterialNames(magicEffectJson) {
  const names = [];
  const pushName = (value) => {
    const name = String(value || "").trim();
    if (!name || names.includes(name)) return;
    names.push(name);
  };

  for (const timed of magicEffectJson?.timeline || []) {
    for (const action of timed?.actions || []) {
      if (action?.action === "spawn") pushName(action?.assetFileName);
    }
  }

  for (const timed of magicEffectJson?.timedVisualEffects || []) {
    for (const visualObject of timed?.visualObjects || []) {
      pushName(visualObject?.assetFileName);
    }
  }

  return names;
}


function addMagicLogFromCast(cast) {
  if (!cast?.id) return;

  if (battleState.magicLogs.some((log) => log.id === cast.id)) return;

  const magicEffectJson = cast.magicEffectJson || null;

  battleState.magicLogs.push({
    id: cast.id,
    at: Number(cast.at) || Date.now(),
    casterId: String(cast.casterId || ""),
    casterName: String(cast.casterName || "unknown"),
    spellHash: String(cast.spellHash || cast.imageHash || "").trim(),
    magicName: String(magicEffectJson?.magicName || "無名の魔法"),
    artScore: Math.max(0, Math.round(Number(magicEffectJson?.artScore) || 0)),
    totalDamage: calculateMagicTotalDamage(magicEffectJson),
    materialNames: extractMagicMaterialNames(magicEffectJson),
    strokeJson: String(cast.strokeJson || ""),
  });

  battleState.magicLogs.sort((a, b) => a.at - b.at);
}






function hydrateBattleHpFromRoom() {
  const members = currentRoom?.members || [];
  const self = members.find((member) => member.id === userTrackingId);
  const enemy = members.find((member) => member.id !== userTrackingId);

  battleState.selfHp = Number.isFinite(Number(self?.hp))
  ? Math.max(0, Math.min(ORIGIN_MAGIC_CIRCLE_MAX_HP, Number(self.hp)))
  : ORIGIN_MAGIC_CIRCLE_MAX_HP;

battleState.enemyHp = Number.isFinite(Number(enemy?.hp))
  ? Math.max(0, Math.min(ORIGIN_MAGIC_CIRCLE_MAX_HP, Number(enemy.hp)))
  : ORIGIN_MAGIC_CIRCLE_MAX_HP;
}




function isBattleAlreadyFinished() {
  return battleState.selfHp <= 0 || battleState.enemyHp <= 0;
}

function getSelfWonFromCurrentHp() {
  return battleState.selfHp > 0 && battleState.enemyHp <= 0;
}




async function startThreeBattleScene() {
  if (battleStarted) return;
  battleStarted = true;
  stopRefresh();

  refs.page?.classList.add("hidden");
  refs.battleView?.classList.remove("hidden");
  //hydrateBattleHpFromRoom();

  // 再読込時に、過去の魔法を再処理しない
  battleState.lastCastAt = Date.now();
  battleState.processedCastIds = new Set();

  //ensureTutorialModal();



let THREE;
let GLTF;
let POST;
try {
  [THREE, GLTF, POST] = await Promise.all([
    import("https://esm.sh/three@0.166.1"),
    import("https://esm.sh/three@0.166.1/examples/jsm/loaders/GLTFLoader.js"),
    Promise.all([
      import("https://esm.sh/three@0.166.1/examples/jsm/postprocessing/EffectComposer.js"),
      import("https://esm.sh/three@0.166.1/examples/jsm/postprocessing/RenderPass.js"),
      import("https://esm.sh/three@0.166.1/examples/jsm/postprocessing/UnrealBloomPass.js"),
      import("https://esm.sh/three@0.166.1/examples/jsm/utils/SkeletonUtils.js"),
    ]),
  ]);
} catch (e) {
  console.error(e);
  alert("3D描画ライブラリの読み込みに失敗しました。");
  return;
}

const [
  { EffectComposer },
  { RenderPass },
  { UnrealBloomPass },
  { clone: skeletonClone },
] = POST;

const {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Color,
  HemisphereLight,
  DirectionalLight,
  Group,
  Box3,
  Vector3,
  AnimationMixer,
  Clock,
  MeshBasicMaterial,
  AdditiveBlending,
  NormalBlending,
  DoubleSide,
  SRGBColorSpace,
  Vector2,
  BufferGeometry,
  LineBasicMaterial,
  Line,
  Float32BufferAttribute,
  
  
  
  Mesh,
SphereGeometry,
ConeGeometry,
CylinderGeometry,
TorusGeometry,
RingGeometry,
PlaneGeometry,
TetrahedronGeometry,
CatmullRomCurve3,
TubeGeometry,


Sprite,
SpriteMaterial,
CanvasTexture,
} = THREE;

const { GLTFLoader } = GLTF;

  const scene = new Scene();
  scene.background = new Color("#87ceeb");

  const camera = new PerspectiveCamera(45/*変更4　60→45*/, window.innerWidth / window.innerHeight, 0.1, 2000);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  
  
  
  
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSafari ? 1.25 : 1.75));




        
  refs.battleView.innerHTML = "";
  refs.battleView.appendChild(renderer.domElement);



hydrateBattleHpFromRoom();
renderHpBars();

if (!isOriginDebugTestRoom) {
  try {
    await joinOriginSocketRoom();
    await requestLatestHpBySocket();

    if (isBattleAlreadyFinished()) {
      await showReloadedBattleResultScreen();
      return;
    }
  } catch (error) {
    console.warn("[origin-magic-circle] socket hp init failed:", error);

    if (isBattleAlreadyFinished()) {
      await showReloadedBattleResultScreen();
      return;
    }
  }
}



ensureTutorialModal();
  
  const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new Vector2(window.innerWidth, window.innerHeight),
  0.6,  // strength: 発光の強さ
  0.3,  // radius: にじみの広さ
  0.65   // threshold: どれくらい明るい部分だけ光らせるか
);

composer.addPass(bloomPass);
  let topControls = null;
  let hasHiddenDebugPanel = false;
  let hasHiddenTopModal = false;
  
  
  
  const magicCircleUi = setupMagicCircleUi(refs.battleView, {
  onMagicJsonReady: async (effectJson, meta = {}) => {
    const spellHash = String(meta.spellHash || "").trim();
    const strokeJson = String(meta.strokeJson || "");

    // テスト部屋はサーバーに送らず、ローカルだけでログ保存
    if (isOriginDebugTestRoom) {
      const localCast = {
        id: `${Date.now()}_${Math.random()}`,
        at: Date.now(),
        roomId: currentRoom?.roomId || "",
        casterId: userTrackingId,
        casterName: username,
        magicEffectJson: effectJson,
        strokeJson,
        spellHash,
      };

      addMagicLogFromCast(localCast);

      if (battleState.gameEnded) return;

await showMagicNameCenterAsync(effectJson?.magicName, false);

if (battleState.gameEnded) return;

await playMagicVisualEffects(effectJson, false);
      if (!battleState.gameEnded) {
  try {
    const nextRoom = await callApi("/api/origin-magic-circle/turn/end", {
      roomId: currentRoom?.roomId,
      userTrackingId,
    }, "POST");

    currentRoom = nextRoom;
    applyRoomTurnState(nextRoom);
  } catch (error) {
    console.warn("[origin-magic-circle] turn end failed:", error);
  }
}

      return;
    }

    const socket = getSocketIoClient();
    let sentCast = null;

    try {
      const response = await emitWithAck(socket, "origin:cast", {
        roomId: currentRoom?.roomId,
        casterId: userTrackingId,
        casterName: username,
        magicEffectJson: effectJson,
        strokeJson,
        spellHash,
        imageHash: spellHash,
      });

      sentCast = response.cast || null;
    } catch (error) {
      console.warn("[origin-magic-circle] socket cast failed, fallback to fetch:", error);

      const res = await fetch("/api/origin-magic-circle/casts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: currentRoom?.roomId,
          casterId: userTrackingId,
          casterName: username,
          magicEffectJson: effectJson,
          strokeJson,
          spellHash,
          imageHash: spellHash,
        }),
      });

      const data = await res.json().catch(() => ({}));
      sentCast = data.cast || null;
    }

    if (sentCast) {
      addMagicLogFromCast(sentCast);
    }

    if (battleState.gameEnded) return;

setTurnActionLocked(true);

try {
  await playMagicCastWithName(effectJson, false);

  if (!battleState.gameEnded) {
    const nextRoom = await callApi("/api/origin-magic-circle/turn/end", {
      roomId: currentRoom?.roomId,
      userTrackingId,
    }, "POST");

    currentRoom = nextRoom;
    applyRoomTurnState(nextRoom);
  }
} catch (error) {
  console.warn("[origin-magic-circle] own magic flow failed:", error);

  try {
    const latestRoom = await callApi(
      `/api/origin-magic-circle/rooms/${encodeURIComponent(currentRoom?.roomId || "")}`
    );
    currentRoom = latestRoom;
    applyRoomTurnState(latestRoom);
  } catch (refreshError) {
    console.warn("[origin-magic-circle] room refresh after magic failed:", refreshError);
  }
} finally {
  setTurnActionLocked(false);
}

    
  },

  hideTopModalOnce: () => {
    if (hasHiddenTopModal || !topControls) return;
    topControls.style.display = "none";
    hasHiddenTopModal = true;
  },

  hideDebugOnce: () => {
    if (hasHiddenDebugPanel) return;
    const debugPanel = document.getElementById("debugPanel");
    if (debugPanel) debugPanel.style.display = "none";
    hasHiddenDebugPanel = true;
  },
});
magicCircleUiController = magicCircleUi;
applyRoomTurnState(currentRoom);






  const hemiLight = new HemisphereLight(0xbad8ff, 0x5d4430, 1.1);
  scene.add(hemiLight);

  const dirLight = new DirectionalLight(0xffffff, 1.35);
  dirLight.position.set(40, 60, 15);
  scene.add(dirLight);

const loader = new GLTFLoader();

let wastelandGltf;
let characterGltf;
let pedestalGltf;

const summonAssetRoots = new Map();
const summonAssetSources = new Map();
const activeMagicObjects = [];
const activeMagicMixers = [];
const summonAssetAnimationInfo = new Map();
const summonAssetMixers = [];
const assetLoadPromises = new Map();
const clock = new Clock();

async function ensureSummonAssetLoaded(assetName, { urgent = false } = {}) {
  if (customEffectNames.has(assetName)) {
    if (!summonAssetSources.has(assetName)) {
      summonAssetSources.set(assetName, {
        assetName,
        gltf: null,
        isCustom: true,
      });
    }
    return null;
  }

  const existing = summonAssetSources.get(assetName);
  if (existing?.gltf) return existing.gltf;

  if (assetLoadPromises.has(assetName)) {
    return assetLoadPromises.get(assetName);
  }
  
  
  

  const promise = loader.loadAsync(`/3D素材/${assetName}`)
  .then((gltf) => {
    assetLoadPromises.delete(assetName);

    summonAssetSources.set(assetName, {
      assetName,
      gltf,
      isCustom: false,
    });

    summonAssetAnimationInfo.set(
      assetName,
      gltf.animations.map((clip) => ({
        name: clip.name,
        duration: clip.duration,
        trackCount: clip.tracks.length,
        trackNames: clip.tracks.slice(0, 10).map((track) => track.name),
      }))
    );

    return gltf;
  })
  .catch((error) => {
    assetLoadPromises.delete(assetName);
    summonAssetSources.delete(assetName);
    throw error;
  });

assetLoadPromises.set(assetName, promise);
return promise;
}
  
  
  
  
  

function getAssetNamesFromMagicJson(effectJson) {
  const names = new Set();

  for (const timed of effectJson?.timedVisualEffects || []) {
    for (const obj of timed?.visualObjects || []) {
      if (summonAssetOptions.includes(obj?.assetFileName)) {
        names.add(obj.assetFileName);
      }
    }
  }

  return [...names];
}

async function ensureMagicJsonAssetsLoaded(effectJson) {
  const names = getAssetNamesFromMagicJson(effectJson);

  await Promise.all(
    names.map((name) => ensureSummonAssetLoaded(name, { urgent: true }))
  );
}



try {
  wastelandGltf = await loader.loadAsync("/3D素材/arid_wasteland.glb");
  characterGltf = await loader.loadAsync("/3D素材/ancient_character.glb");
  pedestalGltf = await loader.loadAsync("/3D素材/pedestal.glb");

  //preloadSummonAssetsOneByOne();
} catch (e) {
  console.error("GLB読み込み失敗", e);
  alert("3D素材の読み込みに失敗しました。");
  return;
}

  const tileRoot = new Group();
  //変更5　グリッド間隔
  const tileSpacing = 22;

  for (let z = -25; z <= 25; z += 1) {
    for (let x = -25; x <= 25; x += 1) {
      const tile = wastelandGltf.scene.clone(true);
      tile.position.set(x * tileSpacing, 0, z * tileSpacing);
      tile.scale.setScalar(1/*変更6　2.8→1*/);
      tileRoot.add(tile);
    }
  }

  scene.add(tileRoot);

  const makeSceneObject = (gltfScene, scale) => {
    const object = gltfScene.clone(true);
    object.scale.setScalar(scale);
    return object;
  };
  
  //変更13
function applyFireTornadoMaterialFix(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    materials.forEach((mat) => {
      // 黒で乗算されているのを白に戻す
      if (mat.color) {
        mat.color.set(0xffffff);
      }

      if (mat.map) {
        mat.map.colorSpace = SRGBColorSpace;
        mat.map.needsUpdate = true;
      }

      mat.transparent = true;
      mat.side = DoubleSide;
      mat.depthWrite = true;//お試し
      mat.alphaTest = 0.01;
      mat.toneMapped = true;//お試し
      mat.needsUpdate = true;
    });
  });
}

//変更18　ファイアーボール修正
function applyFireballMaterialFix(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];

    mats.forEach((mat) => {
      if (mat.color) mat.color.set(0xffffff);
      if (mat.emissive) mat.emissive.set(0xff8700);

      mat.emissiveIntensity = 2.5;
      mat.transparent = true;
      mat.opacity = 0.9;
      mat.depthWrite = false;
      mat.alphaTest = 0.01;
      mat.toneMapped = false;
      mat.needsUpdate = true;
    });
  });
}



function applyCommonGlbMaterialFix(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const mats = Array.isArray(child.material) ? child.material : [child.material];

    mats.forEach((mat) => {
      if (mat.color && mat.color.getHexString?.() === "000000" && mat.map) {
        mat.color.set(0xffffff);
      }

      if (mat.map) {
        mat.map.colorSpace = SRGBColorSpace;
        mat.map.needsUpdate = true;
      }

      mat.side = DoubleSide;
      mat.needsUpdate = true;
    });
  });
}

function applyGlbEffectVisibilityFix(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const mats = Array.isArray(child.material) ? child.material : [child.material];

    mats.forEach((mat) => {
      if (mat.color && mat.color.getHexString?.() === "000000" && mat.map) {
        mat.color.set(0xffffff);
      }

      if (mat.map) {
        mat.map.colorSpace = SRGBColorSpace;
        mat.map.needsUpdate = true;
      }

      mat.transparent = true;
      mat.depthWrite = false;
      mat.side = DoubleSide;
      mat.toneMapped = false;

      if (mat.emissive) {
        mat.emissive.set(0xffffff);
        mat.emissiveIntensity = Math.max(mat.emissiveIntensity || 0, 1.8);
      }

      mat.needsUpdate = true;
    });
  });
}

function applySoftEffectMaterialFix(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];

    mats.forEach((mat) => {
      if (mat.map) {
        mat.map.colorSpace = SRGBColorSpace;
        mat.map.needsUpdate = true;
      }

      mat.transparent = true;
      mat.depthWrite = false;
      mat.side = DoubleSide;

      // 元気玉化の主原因。Bloomに拾われすぎないよう戻す
      mat.toneMapped = true;

      // 白飛びしやすい加算表現を避ける
      mat.blending = NormalBlending;

      if (mat.emissive) {
        mat.emissive.set(0x000000);
        mat.emissiveIntensity = 0;
      }

      // alphaTestが高すぎる素材はエフェクトが欠けるので少し下げる
      if (typeof mat.alphaTest === "number" && mat.alphaTest > 0.5) {
        mat.alphaTest = 0.15;
      }

      mat.needsUpdate = true;
    });
  });
}


  
  
  
  
  function applyAssetSpecificTransform(root, assetName) {
  if (assetName === "broken_steampunk_clock.glb") {
    root.rotation.y = Math.PI / 2;
  }

  if (assetName === "gun-bot_with_walk_and_idle_animation.glb") {
    root.rotation.y = Math.PI;
  }

  if (assetName === "soulsucker_-_weaponcraft.glb") {
    root.rotation.z = -Math.PI / 2;
  }
}





function applyAssetSpecificMaterialFix(root, assetName) {
  applyCommonGlbMaterialFix(root);

  const strongBloomAssets = new Set([
    "evanescent_plasma.glb",
    "cyber_spore.glb",
    "dark_matter.glb",
    "evanescent_smoke.glb",
  ]);

  const softEffectAssets = new Set([
    "pearl_electron.glb",
    "stranger_star.glb",
    "magic_marble.glb",
  ]);

  const brightUnlitAssets = new Set([
    "magic_ring_-_yingyangblue.glb",
    "magic_ring_-_yellow.glb",
    "magic_ring_-_green.glb",
    "magic_ring_-_red.glb",
  ]);

  if (strongBloomAssets.has(assetName)) {
    applyGlbEffectVisibilityFix(root);
  }

  if (softEffectAssets.has(assetName)) {
    applySoftEffectMaterialFix(root);
  }

  if (brightUnlitAssets.has(assetName)) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const oldMaterials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    const nextMaterials = oldMaterials.map((mat) => {
      const color = mat.color ? mat.color.clone() : new Color(0xffffff);
      const map = mat.map || null;

      if (map) {
        map.colorSpace = SRGBColorSpace;
        map.needsUpdate = true;
      }

      return new MeshBasicMaterial({
        color,
        map,
        transparent: true,
        opacity: typeof mat.opacity === "number" ? mat.opacity : 1,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      });
    });

    child.material = Array.isArray(child.material)
      ? nextMaterials
      : nextMaterials[0];
  });
}
}

function createLightningEffect() {
  const root = new Group();

  const createBolt = (offsetX = 0) => {
    const geometry = new BufferGeometry();
    const points = [];

    const segmentCount = 12;
    const height = 4;

    for (let i = 0; i <= segmentCount; i += 1) {
      const t = i / segmentCount;
      const y = height * (1 - t);
      const x = offsetX + (Math.random() - 0.5) * 0.35;
      const z = (Math.random() - 0.5) * 0.35;
      points.push(x, y, z);
    }

    geometry.setAttribute("position", new Float32BufferAttribute(points, 3));

    const material = new LineBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    return new Line(geometry, material);
  };

  root.add(createBolt(0));
  root.add(createBolt(-0.25));
  root.add(createBolt(0.25));

  root.userData.effectType = "lightning";
  root.userData.lastUpdate = 0;

  return root;
}
function getPreferredAnimationClip(assetName, animations = []) {
  if (!animations.length) return null;

  if (assetName === "sphere_bot.glb") {
    const sphereBotPriority = [
      "05_Sphere_bot_WalkCycle",
      "02_Sphere_bot_Run_Cycle",
      "01_Sphere_bot_Roll",
      "04_Sphere_bot_Attack",
      "03_Sphere_bot_Open",
      "06_Sphere_bot_Run_Attack",
      "07_Sphere_bot_Jump",
    ];

    for (const clipName of sphereBotPriority) {
      const clip = animations.find((item) => item.name === clipName);
      if (clip) return clip;
    }
  }

  return animations.find((clip) => clip.name === "attack a") || animations[0] || null;
}

function makeGlowMaterial(color, opacity = 1) {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
}

function createFogTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );

  gradient.addColorStop(0.0, "rgba(255,255,255,0.55)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.28)");
  gradient.addColorStop(0.7, "rgba(255,255,255,0.08)");
  gradient.addColorStop(1.0, "rgba(255,255,255,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}


function createCrescentSlashTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");

  const gradient = ctx.createRadialGradient(86, 128, 0, 96, 128, 116);
  gradient.addColorStop(0.0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.28, "rgba(160,240,255,0.95)");
  gradient.addColorStop(0.62, "rgba(50,170,255,0.62)");
  gradient.addColorStop(1.0, "rgba(0,110,255,0)");

  // 外側の円
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(112, 128, 94, 0, Math.PI * 2);
  ctx.fill();

  // 内側を大きめの円でくり抜く
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(156, 128, 104, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function makeLineMaterial(color, opacity = 1) {
  return new LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}
function updateCustomEffect(root, elapsed, delta) {
  const type = root.userData.effectType;
  if (!type) return;

  if (type === "lightning") {
  if (elapsed - root.userData.lastUpdate < 0.05) return;
  root.userData.lastUpdate = elapsed;

  root.children.forEach((line, lineIndex) => {
    const position = line.geometry.attributes.position;
    const segmentCount = position.count - 1;
    const height = 4;
    const offsetX = lineIndex === 1 ? -0.25 : lineIndex === 2 ? 0.25 : 0;

    for (let i = 0; i <= segmentCount; i += 1) {
      const t = i / segmentCount;
      const y = height * (1 - t);
      const x = offsetX + (Math.random() - 0.5) * 0.45;
      const z = (Math.random() - 0.5) * 0.45;
      position.setXYZ(i, x, y, z);
    }

    position.needsUpdate = true;

    if (line.material) {
      line.material.opacity = 0.55 + Math.random() * 0.45;
    }
  });

  return;
}

  if (type === "explosion_burst") {
  root.userData.age = (root.userData.age || 0) + delta;
  const age = root.userData.age;

  // 爆発は短命。1.5秒で自然に消える
  const totalLife = 1.5;

  root.children.forEach((child) => {
    const role = child.userData.role;

    if (role === "flash") {
      // 0.0〜0.25秒：一瞬の白い閃光
      const t = Math.min(age / 0.25, 1);
      child.scale.setScalar(0.2 + t * 3.2);

      if (child.material) {
        child.material.opacity = Math.max(0, 1 - t);
      }
      return;
    }

    if (role === "fireCore") {
      // 0.0〜0.7秒：中心の熱球が膨らんで消える
      const t = Math.min(age / 0.7, 1);
      const pulse = 1 + Math.sin(age * 30) * 0.05;
      child.scale.setScalar((0.35 + t * 1.8) * pulse);

      if (child.material) {
        child.material.opacity = Math.max(0, 0.9 * (1 - t));
      }
      return;
    }

    if (role === "fireOuter") {
      // 0.1〜0.9秒：外側の赤い爆炎
      const t = Math.min(Math.max((age - 0.1) / 0.8, 0), 1);
      child.scale.setScalar(0.5 + t * 2.4);

      if (child.material) {
        child.material.opacity = Math.max(0, 0.42 * (1 - t));
      }
      return;
    }

    if (role === "shockwave") {
      // 0.05〜0.8秒：地面方向へ衝撃波
      const t = Math.min(Math.max((age - 0.05) / 0.75, 0), 1);
      child.scale.setScalar(0.4 + t * 4.5);

      if (child.material) {
        child.material.opacity = Math.max(0, 0.85 * (1 - t));
      }
      return;
    }

    if (role === "ray") {
      // 0.0〜0.45秒：光線が外側へ走って消える
      const delay = child.userData.lifeOffset || 0;
      const t = Math.min(Math.max((age - delay) / 0.45, 0), 1);

      const dir = child.userData.dir || new Vector3(0, 1, 0);
      const speed = child.userData.speed || 3;

      child.position.copy(dir.clone().multiplyScalar(t * speed));
      child.scale.setScalar(1 + t * 1.4);

      if (child.material) {
        child.material.opacity = Math.max(0, 0.9 * (1 - t));
      }
      return;
    }

    if (role === "spark") {
      // 0.0〜1.1秒：火花が放射状に飛び散る
      const velocity = child.userData.velocity || new Vector3();
      const gravity = child.userData.gravity || 1.5;

      child.position.addScaledVector(velocity, delta);
      velocity.y -= gravity * delta;

      child.rotation.x += delta * 8;
      child.rotation.y += delta * 6;

      const t = Math.min(age / 1.1, 1);
      child.scale.setScalar(Math.max(0.15, 1 - t * 0.75));

      if (child.material) {
        child.material.opacity = Math.max(0, 0.95 * (1 - t));
      }
      return;
    }

    if (role === "smoke") {
      // 0.25〜1.5秒：煙が遅れて膨らむ
      const t = Math.min(Math.max((age - 0.25) / 1.25, 0), 1);
      const dir = child.userData.dir || new Vector3(0, 1, 0);
      const speed = child.userData.speed || 0.6;
      const phase = child.userData.phase || 0;

      child.position.addScaledVector(dir, delta * speed);
      child.position.x += Math.sin(age * 4 + phase) * delta * 0.15;
      child.position.z += Math.cos(age * 3 + phase) * delta * 0.15;

      child.scale.setScalar(0.4 + t * 2.2);

      if (child.material) {
        const fadeIn = Math.min(t * 4, 1);
        const fadeOut = 1 - t;
        child.material.opacity = Math.max(0, 0.32 * fadeIn * fadeOut);
      }
      return;
    }
  });

  // 1.5秒後は消す。テスト画面では再表示用に自動リセットしたいなら下の reset を使う
  if (age >= totalLife) {
    root.visible = false;
    root.userData.finished = true;
  }

  return;
}

  if (type === "mist_cloud") {
  root.rotation.y += delta * 0.05;

  root.children.forEach((child, index) => {
    const phase = child.userData.phase || 0;
    const speed = child.userData.driftSpeed || 0.3;
    const floatRange = child.userData.floatRange || 0.1;

    const baseX = child.userData.baseX || 0;
    const baseY = child.userData.baseY || 0;
    const baseZ = child.userData.baseZ || 0;

    // 上に登って消えるのではなく、その場でゆっくり漂わせる
    child.position.x = baseX + Math.sin(elapsed * speed + phase) * 0.25;
    child.position.y = baseY + Math.sin(elapsed * speed * 0.8 + phase) * floatRange;
    child.position.z = baseZ + Math.cos(elapsed * speed + phase) * 0.25;

    const breath = 1 + Math.sin(elapsed * 1.2 + phase) * 0.06;
    const baseScale = child.userData.baseScale || 1;

    if (!child.userData.initialScaleX) {
      child.userData.initialScaleX = child.scale.x;
      child.userData.initialScaleY = child.scale.y;
    }

    child.scale.set(
      child.userData.initialScaleX * breath,
      child.userData.initialScaleY * breath,
      1
    );

    if (child.material) {
      const baseOpacity = child.userData.baseOpacity || 0.2;
      child.material.opacity =
        baseOpacity + Math.sin(elapsed * 1.5 + index) * 0.035;
    }
  });

  return;
}

  if (type === "wind_blade") {
  root.children.forEach((child, index) => {
    const role = child.userData.role;

    if (role === "crescent_body") {
      // 本体は回転させない。軽く呼吸するだけ。
      child.material.opacity = 0.82 + Math.sin(elapsed * 2.2) * 0.08;
      child.scale.set(
        3.2 + Math.sin(elapsed * 1.8) * 0.05,
        2.0 + Math.sin(elapsed * 1.8) * 0.03,
        1
      );
      return;
    }

    if (role === "crescent_wave") {
  const cycle = 1.65;
  const local = (elapsed * child.userData.speed + child.userData.delay) % cycle;

  if (local > 1.0) {
    child.visible = false;
    return;
  }

  child.visible = true;

  const t = local;
  const angle = -Math.PI * 0.78 + Math.PI * 1.56 * t;

  // 三日月の外縁に沿う座標
  let x = Math.cos(angle) * 0.62 - 0.12;
  let y = Math.sin(angle) * 1.05;

  // 三日月本体を -90° 回したので、光の軌道も同じだけ回す
  const rotatedX = y;
  const rotatedY = -x;

  child.position.set(rotatedX, rotatedY, 0.08);

  const fade = Math.sin(t * Math.PI);
  const flicker = 0.75 + Math.sin(elapsed * 35 + index * 3) * 0.25;

  child.material.opacity = 0.95 * fade * flicker;
  child.scale.set(0.18 + fade * 0.28, 0.18 + fade * 0.28, 1);

  return;
}
  });

  return;
}

    

  if (type === "light_orb") {
    root.rotation.y += delta * 1.5;
    root.rotation.x += delta * 0.35;
    root.children.forEach((child, index) => {
      if (child.material && child.userData.kind === "mist") {
        child.material.opacity = 0.24 + Math.sin(elapsed * 3 + index) * 0.12;
      }
    });

    const pulse = 1 + Math.sin(elapsed * 4) * 0.08;
    root.scale.setScalar(root.userData.currentScale ? root.userData.currentScale * pulse : pulse);
    return;
  }

  if (type === "crystal_shard") {
  // 本体は相手方向、つまりX方向に向かってドリル回転
  root.children.forEach((child) => {
    if (
      child.userData.kind === "main_shard" ||
      child.userData.kind === "main_shard_glow"
    ) {
      child.rotation.x += delta * 12;
    }

    if (child.userData.kind === "drill_ring") {
      const index = child.userData.ringIndex || 0;

      // 0→1→2→3の順に出現、その後0→1→2→3の順に消える
      const cycle = 1.6;
      const local = (elapsed % cycle) / cycle;

      const appearStart = index * 0.11;
      const appearEnd = appearStart + 0.18;

      const disappearStart = 0.55 + index * 0.11;
      const disappearEnd = disappearStart + 0.18;

      let opacity = 0;

      if (local >= appearStart && local < appearEnd) {
        opacity = (local - appearStart) / (appearEnd - appearStart);
      } else if (local >= appearEnd && local < disappearStart) {
        opacity = 1;
      } else if (local >= disappearStart && local < disappearEnd) {
        opacity = 1 - (local - disappearStart) / (disappearEnd - disappearStart);
      }

      child.visible = opacity > 0.02;

      if (child.material) {
        child.material.opacity = opacity * (child.userData.baseOpacity || 0.65);
      }

      // リング自体は回転させない。少しだけ脈動
      const pulse = 1 + Math.sin(elapsed * 8 + index) * 0.04;
      child.scale.setScalar(pulse);
    }
  });

  return;
}

  if (type === "simple_ring") {
    const s = 1 + (Math.sin(elapsed * 3) + 1) * 0.15;
    root.children.forEach((child) => {
      child.scale.setScalar(s);
      if (child.material) {
        child.material.opacity = 0.45 + Math.sin(elapsed * 5) * 0.2;
      }
    });
  }
}





function createExplosionBurstEffect() {
  const root = new Group();

  // 爆発の経過時間
  root.userData.effectType = "explosion_burst";
  root.userData.age = 0;
  root.userData.finished = false;

  // 1. 中心閃光：爆発の「ドン！」の核
  const flash = new Mesh(
    new SphereGeometry(0.45, 32, 16),
    makeGlowMaterial(0xffffff, 1)
  );
  flash.userData.role = "flash";
  root.add(flash);

  // 2. 熱球：中心から膨らむオレンジの爆炎
  const fireCore = new Mesh(
    new SphereGeometry(0.7, 32, 18),
    makeGlowMaterial(0xffaa22, 0.85)
  );
  fireCore.userData.role = "fireCore";
  root.add(fireCore);

  // 3. 外側の赤い爆炎
  const fireOuter = new Mesh(
    new SphereGeometry(1.0, 32, 18),
    makeGlowMaterial(0xff3300, 0.38)
  );
  fireOuter.userData.role = "fireOuter";
  root.add(fireOuter);

  // 4. 衝撃波リング：地面・空間に広がる波
  const shockwave = new Mesh(
    new RingGeometry(0.25, 0.35, 96),
    makeGlowMaterial(0xffe6aa, 0.85)
  );
  shockwave.rotation.x = -Math.PI / 2;
  shockwave.userData.role = "shockwave";
  root.add(shockwave);

  // 5. 放射状の光線：爆発の鋭さ
  for (let i = 0; i < 18; i += 1) {
    const rayGeometry = new BufferGeometry();

    const dir = new Vector3(
      Math.random() - 0.5,
      Math.random() * 0.8 + 0.1,
      Math.random() - 0.5
    ).normalize();

    const length = 0.8 + Math.random() * 1.4;

    rayGeometry.setAttribute(
      "position",
      new Float32BufferAttribute([
        0, 0, 0,
        dir.x * length,
        dir.y * length,
        dir.z * length,
      ], 3)
    );

    const ray = new Line(
      rayGeometry,
      makeLineMaterial(i % 2 === 0 ? 0xffffff : 0xffcc55, 0.9)
    );

    ray.userData.role = "ray";
    ray.userData.dir = dir;
    ray.userData.speed = 2.5 + Math.random() * 3.5;
    ray.userData.lifeOffset = Math.random() * 0.15;

    root.add(ray);
  }

  // 6. 火花・破片：弾け飛ぶ粒
  for (let i = 0; i < 32; i += 1) {
    const spark = new Mesh(
      new SphereGeometry(0.035 + Math.random() * 0.035, 8, 6),
      makeGlowMaterial(i % 3 === 0 ? 0xffffff : 0xffaa22, 0.95)
    );

    const dir = new Vector3(
      Math.random() - 0.5,
      Math.random() * 0.9,
      Math.random() - 0.5
    ).normalize();

    spark.position.copy(dir.clone().multiplyScalar(0.15));
    spark.userData.role = "spark";
    spark.userData.velocity = dir.multiplyScalar(2.5 + Math.random() * 4.5);
    spark.userData.gravity = 1.2 + Math.random() * 0.8;

    root.add(spark);
  }

  // 7. 煙：遅れて広がる余韻
  for (let i = 0; i < 14; i += 1) {
    const smoke = new Mesh(
      new SphereGeometry(0.22 + Math.random() * 0.22, 12, 8),
      new MeshBasicMaterial({
        color: i % 2 === 0 ? 0x555555 : 0x777777,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      })
    );

    const dir = new Vector3(
      Math.random() - 0.5,
      Math.random() * 0.6 + 0.2,
      Math.random() - 0.5
    ).normalize();

    smoke.position.copy(dir.clone().multiplyScalar(0.2));
    smoke.userData.role = "smoke";
    smoke.userData.dir = dir;
    smoke.userData.speed = 0.45 + Math.random() * 0.6;
    smoke.userData.phase = Math.random() * Math.PI * 2;

    root.add(smoke);
  }

  return root;
}

function resetExplosionBurst(root) {
  root.userData.age = 0;
  root.userData.finished = false;
  root.visible = true;

  root.children.forEach((child) => {
    const role = child.userData.role;

    child.position.set(0, 0, 0);
    child.scale.setScalar(1);

    if (role === "flash") {
      child.scale.setScalar(0.2);
      if (child.material) child.material.opacity = 1;
    }

    if (role === "fireCore") {
      child.scale.setScalar(0.35);
      if (child.material) child.material.opacity = 0.9;
    }

    if (role === "fireOuter") {
      child.scale.setScalar(0.5);
      if (child.material) child.material.opacity = 0.42;
    }

    if (role === "shockwave") {
      child.scale.setScalar(0.4);
      if (child.material) child.material.opacity = 0.85;
    }

    if (role === "ray") {
      if (child.material) child.material.opacity = 0.9;
    }

    if (role === "spark") {
      if (child.material) child.material.opacity = 0.95;
    }

    if (role === "smoke") {
      if (child.material) child.material.opacity = 0;
    }
  });
}

function createMistCloudEffect() {
  const root = new Group();
  const fogTexture = createFogTexture();

  root.userData.effectType = "mist_cloud";

  // 広い霧の層
  for (let i = 0; i < 34; i += 1) {
    const material = new SpriteMaterial({
      map: fogTexture,
      color: i % 3 === 0 ? 0xdde7ff : 0xffffff,
      transparent: true,
      opacity: 0.18 + Math.random() * 0.12,
      depthWrite: false,
      depthTest: true,
      blending: NormalBlending,
      toneMapped: false,
    });

    const sprite = new Sprite(material);

    const radius = 1.8 + Math.random() * 1.6;
    const angle = Math.random() * Math.PI * 2;

    sprite.position.set(
      Math.cos(angle) * radius * Math.random(),
      0.2 + Math.random() * 1.7,
      Math.sin(angle) * radius * Math.random()
    );

    const size = 1.2 + Math.random() * 1.8;
    sprite.scale.set(size, size, 1);

    sprite.userData.role = "fog_layer";
    sprite.userData.baseX = sprite.position.x;
    sprite.userData.baseY = sprite.position.y;
    sprite.userData.baseZ = sprite.position.z;
    sprite.userData.baseOpacity = material.opacity;
    sprite.userData.driftSpeed = 0.25 + Math.random() * 0.45;
    sprite.userData.phase = Math.random() * Math.PI * 2;
    sprite.userData.floatRange = 0.08 + Math.random() * 0.18;

    root.add(sprite);
  }

  // 奥に濃い霧の芯を作る
  for (let i = 0; i < 8; i += 1) {
    const material = new SpriteMaterial({
      map: fogTexture,
      color: 0xbfc8ff,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      toneMapped: false,
    });

    const sprite = new Sprite(material);

    sprite.position.set(
      (Math.random() - 0.5) * 1.5,
      0.7 + Math.random() * 1.2,
      (Math.random() - 0.5) * 1.5
    );

    const size = 1.4 + Math.random() * 1.2;
    sprite.scale.set(size, size, 1);

    sprite.userData.role = "mist_core";
    sprite.userData.baseX = sprite.position.x;
    sprite.userData.baseY = sprite.position.y;
    sprite.userData.baseZ = sprite.position.z;
    sprite.userData.baseOpacity = material.opacity;
    sprite.userData.driftSpeed = 0.4 + Math.random() * 0.5;
    sprite.userData.phase = Math.random() * Math.PI * 2;
    sprite.userData.floatRange = 0.05 + Math.random() * 0.12;

    root.add(sprite);
  }

  return root;
}

function createLightOrbEffect() {
  const root = new Group();

  const orb = new Mesh(
    new SphereGeometry(0.75, 32, 20),
    new MeshBasicMaterial({
      color: 0xffffcc,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );

  const halo = new Mesh(
    new TorusGeometry(1.05, 0.035, 8, 64),
    new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );

  halo.rotation.x = Math.PI / 2;

  root.add(orb, halo);
  root.userData.effectType = "light_orb";

  return root;
}

function createShardEffect() {
  const root = new Group();

  const shardMaterial = makeGlowMaterial(0x99ddff, 0.85);
  const glowMaterial = makeGlowMaterial(0x66ccff, 0.25);

  const shard = new Mesh(
    new ConeGeometry(0.35, 2.2, 6),
    shardMaterial
  );

  // ConeGeometryはY方向に伸びるので、X方向へ寝かせる
  shard.rotation.z = -Math.PI / 2;
  shard.userData.kind = "main_shard";
  root.add(shard);

  const glow = new Mesh(
    new ConeGeometry(0.48, 2.35, 6),
    glowMaterial
  );

  glow.rotation.z = -Math.PI / 2;
  glow.userData.kind = "main_shard_glow";
  root.add(glow);

  // 指輪状リング。根元側が大きく、先端側ほど小さい
  const ringData = [
    { x: -0.65, radius: 0.46 },
    { x: -0.25, radius: 0.36 },
    { x: 0.18, radius: 0.27 },
    { x: 0.58, radius: 0.18 },
  ];

  ringData.forEach((data, index) => {
    const ring = new Mesh(
      new TorusGeometry(data.radius, 0.012, 8, 48),
      makeGlowMaterial(0xdaf6ff, 0.65)
    );

    // X方向に進むドリルに対して、指輪のように垂直配置
    ring.rotation.y = Math.PI / 2;
    ring.position.x = data.x;

    ring.userData.kind = "drill_ring";
    ring.userData.ringIndex = index;
    ring.userData.baseOpacity = 0.65;

    root.add(ring);
  });

  root.userData.effectType = "crystal_shard";
  return root;
}

function createWindBladeEffect() {
  const root = new Group();

  const geometry = new TorusGeometry(1.25, 0.035, 8, 64, Math.PI * 1.15);
  const material = new MeshBasicMaterial({
    color: 0xccffee,
    transparent: true,
    opacity: 0.65,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });

  const blade = new Mesh(geometry, material);
  blade.scale.set(1.4, 0.55, 1);
  blade.rotation.set(Math.PI / 2.2, 0, -Math.PI / 8);

  root.add(blade);
  root.userData.effectType = "wind_blade";

  return root;
}

function createSimpleRingEffect() {
  const root = new Group();

  const ring = new Mesh(
    new RingGeometry(0.6, 0.72, 64),
    new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    })
  );

  ring.rotation.x = -Math.PI / 2;

  root.add(ring);
  root.userData.effectType = "simple_ring";
  root.userData.baseScale = 1;

  return root;
}




function createCustomEffectByName(assetName) {
  if (assetName === "lightning") return createLightningEffect();
  if (assetName === "explosion_burst") return createExplosionBurstEffect();
  if (assetName === "mist_cloud") return createMistCloudEffect();
  if (assetName === "light_orb") return createLightOrbEffect();
  if (assetName === "crystal_shard") return createShardEffect();
  if (assetName === "simple_ring") return createSimpleRingEffect();

  return new Group();
}



  const getHeight = (object3d) => {
    const box = new Box3().setFromObject(object3d);
    return box.max.y - box.min.y;
  };

  const setCameraForMatchup = (myId, members, fighterA, fighterB) => {
  const isPlayerTwo = members.findIndex((member) => member.id === myId) === 1;
  const ownFighter = isPlayerTwo ? fighterB : fighterA;
  const enemyFighter = isPlayerTwo ? fighterA : fighterB;

  const ownPos = ownFighter.position.clone();
  const enemyPos = enemyFighter.position.clone();

  // 自分 → 敵 の方向
  const forward = new Vector3().subVectors(enemyPos, ownPos).normalize();

  // 右方向
  const right = new Vector3(forward.z, 0, -forward.x).normalize();

  const cameraPosition = ownPos.clone()
    .addScaledVector(forward, -13) // 後ろへ
    .addScaledVector(right, 2)    // 右へ
    .add(new Vector3(0, 2, 0));   // 上へ

  camera.position.copy(cameraPosition);

  // 敵の少し上を見る
  camera.lookAt(enemyPos.clone().add(new Vector3(0, 3.5, 0)));
};


  const pedestalA = makeSceneObject(pedestalGltf.scene, 0.0024);
const pedestalB = makeSceneObject(pedestalGltf.scene, 0.0024);
pedestalA.position.set(-16, 2, 0);
pedestalB.position.set(16, 2, 0);
scene.add(pedestalA, pedestalB);

const fighterA = makeSceneObject(characterGltf.scene, 1.5);
const fighterB = makeSceneObject(characterGltf.scene, 1.5);

const pedestalHeight = getHeight(pedestalA);
const characterHeight = getHeight(fighterA);
const fighterYOffset = pedestalHeight + characterHeight * 0.5 +2;

fighterA.position.set(-16, fighterYOffset, 0);
fighterB.position.set(16, fighterYOffset, 0);
  fighterA.lookAt(fighterB.position.clone().add(new Vector3(0, 1.5, 0)));
  fighterB.lookAt(fighterA.position.clone().add(new Vector3(0, 1.5, 0)));
  scene.add(fighterA, fighterB);
  
  
  
  onBattleHpReachedZero = () => {
  startBattleEndSequence();
};
  
  //大改革
function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function getAssetSizePreset(assetName, objectSize = "medium") {
  const medium = summonAssetSizePresets[assetName]?.medium || {
    scale: 1,
    y: 1.6,
    offsetX: 0,
    offsetZ: 0,
  };

  const preset =
    summonAssetSizePresets[assetName]?.[objectSize] ||
    medium;

  return {
  scale: preset.scale ?? medium.scale ?? 1,
  y: preset.y ?? medium.y ?? 1.6,
  offsetX: preset.offsetX ?? medium.offsetX ?? 0,
  offsetZ: preset.offsetZ ?? medium.offsetZ ?? 0,
  rotationX: preset.rotationX ?? medium.rotationX ?? 0,
  rotationY: preset.rotationY ?? medium.rotationY ?? 0,
  rotationZ: preset.rotationZ ?? medium.rotationZ ?? 0,
};
}
function getBattleActors(casterSide = "self") {
  const members = currentRoom?.members || [];
  const isPlayerTwo = members.findIndex((member) => member.id === userTrackingId) === 1;

  const viewerActors = {
    self: isPlayerTwo ? fighterB : fighterA,
    enemy: isPlayerTwo ? fighterA : fighterB,
  };

  if (casterSide === "enemy") {
    return {
      self: viewerActors.enemy,
      enemy: viewerActors.self,
    };
  }

  return viewerActors;
}

function getForwardAndRight(self, enemy) {
  const forward = new Vector3()
    .subVectors(enemy.position, self.position)
    .setY(0)
    .normalize();

  const right = new Vector3(forward.z, 0, -forward.x).normalize();

  return { forward, right };
}
function applySpawnSpread(base, forward, right, objectIndex, objectCount, spreadPattern) {
  const pos = base.clone();

  if (objectCount <= 1 || spreadPattern === "none") {
    return pos;
  }

  const centerIndex = (objectCount - 1) / 2;
  const n = objectIndex - centerIndex;

  if (spreadPattern === "horizontal_line") {
    pos.addScaledVector(right, n * 2.4);
    return pos;
  }

  if (spreadPattern === "vertical_line") {
    pos.y += n * 2.0;
    return pos;
  }

  if (spreadPattern === "circle") {
    const radius = 2.5;
    const angle = (Math.PI * 2 * objectIndex) / objectCount;

    pos.addScaledVector(right, Math.cos(angle) * radius);
    pos.addScaledVector(forward, Math.sin(angle) * radius);
    return pos;
  }

  if (spreadPattern === "random_scatter") {
    pos.addScaledVector(right, (Math.random() - 0.5) * 5);
    pos.addScaledVector(forward, (Math.random() - 0.5) * 5);
    pos.y += (Math.random() - 0.5) * 2;
    return pos;
  }

  return pos;
}





function applyRelativeOffsetToPosition(position, offset = {}, casterSide = "self") {
  if (!offset || typeof offset !== "object") return position;

  const { self, enemy } = getBattleActors(casterSide);
  const { forward, right } = getForwardAndRight(self, enemy);

  const result = position.clone();

  result.addScaledVector(forward, Number(offset.forward) || 0);
  result.addScaledVector(right, Number(offset.right) || 0);
  result.y += Number(offset.y) || 0;

  return result;
}

function applyVisualObjectRotationOptions(root, visualObject, casterSide = "self") {
  if (!root || !visualObject) return;

  if (visualObject.faceEnemy) {
    const { enemy } = getBattleActors(casterSide);
    root.lookAt(enemy.position.clone().add(new Vector3(0, 3, 0)));
  }

  const offset = visualObject.rotationOffset || {};
  root.rotation.x += Number(offset.x) || 0;
  root.rotation.y += Number(offset.y) || 0;
  root.rotation.z += Number(offset.z) || 0;
}





function getOrbitCenterPositionByName(positionName, assetName, objectSize = "medium", casterSide = "self") {
  return getTargetPositionByName(
    positionName || "self_position",
    assetName,
    objectSize,
    casterSide
  );
}

function normalizeVisualOrbitConfig(
  visualObject,
  assetName,
  objectSize,
  casterSide,
  objectIndex = 0,
  objectCount = 1
) {
  const orbit = visualObject?.orbit;
  if (!orbit || typeof orbit !== "object") return null;

  const center = getOrbitCenterPositionByName(
    orbit.centerPosition || "self_position",
    assetName,
    objectSize,
    casterSide
  );

  const radius = Math.max(1.2, Number(orbit.radius) || 3.5);
  const height = Number(orbit.height) || 0;
  const speed = Number(orbit.speed) || 1.2;
  const verticalWobble = Math.max(0, Number(orbit.verticalWobble) || 0);

  const angleStep = objectCount > 0 ? (Math.PI * 2) / objectCount : 0;
  const startAngle =
    Number(orbit.startAngle) ||
    objectIndex * angleStep ||
    Math.random() * Math.PI * 2;

  return {
    center,
    radius,
    height,
    speed,
    verticalWobble,
    startAngle,
    clockwise: orbit.clockwise !== false,
  };
}

function applyStationaryOrbitMotion(active, age) {
  if (!active?.orbit) return;

  const orbit = active.orbit;
  const direction = orbit.clockwise ? 1 : -1;
  const angle = orbit.startAngle + age * orbit.speed * direction;

  active.root.position.set(
    orbit.center.x + Math.cos(angle) * orbit.radius,
    orbit.center.y + orbit.height + Math.sin(age * orbit.speed * 1.7) * orbit.verticalWobble,
    orbit.center.z + Math.sin(angle) * orbit.radius
  );
}




  
function getSpawnPositionByName(
  positionName,
  assetName,
  objectSize = "medium",
  objectIndex = 0,
  objectCount = 1,
  spreadPattern = "none",
  casterSide = "self"
) {
  const { self, enemy } = getBattleActors(casterSide);
  const { forward, right } = getForwardAndRight(self, enemy);
  const preset = getAssetSizePreset(assetName, objectSize);

  const centerPos = new Vector3(0, 0, 0);
  let base;

  if (positionName === "in_front_of_self") {
    base = self.position
      .clone()
      .addScaledVector(forward, 6)
      .setY(preset.y);
  } else if (positionName === "behind_self") {
    base = self.position
      .clone()
      .addScaledVector(forward, -6)
      .setY(preset.y);
  } else if (positionName === "above_self") {
    base = self.position
      .clone()
      .setY(preset.y + 6);
  } else if (positionName === "battlefield_center") {
    base = centerPos
      .clone()
      .setY(preset.y);
  } else if (positionName === "above_battlefield_center") {
    base = centerPos
      .clone()
      .setY(preset.y + 8);
  } else if (positionName === "enemy_position") {
    base = enemy.position
      .clone()
      .setY(preset.y);
  } else if (positionName === "above_enemy") {
    base = enemy.position
      .clone()
      .setY(preset.y + 6);
  } else {
    base = centerPos
      .clone()
      .setY(preset.y);
  }

  base.x += preset.offsetX || 0;
  base.z += preset.offsetZ || 0;

  return applySpawnSpread(
    base,
    forward,
    right,
    objectIndex,
    objectCount,
    spreadPattern
  );
}
function getTargetPositionByName(positionName, assetName, objectSize = "medium", casterSide = "self") {
  const { self, enemy } = getBattleActors(casterSide);
  const preset = getAssetSizePreset(assetName, objectSize);

  const centerPos = new Vector3(0, 0, 0);

  if (positionName === "self_position") {
    return self.position.clone().setY(preset.y);
  }

  if (positionName === "battlefield_center") {
    return centerPos.clone().setY(preset.y);
  }

  if (positionName === "above_battlefield_center") {
    return centerPos.clone().setY(preset.y + 8);
  }

  if (positionName === "enemy_position") {
    return enemy.position.clone().setY(preset.y);
  }

  if (positionName === "above_enemy") {
    return enemy.position.clone().setY(preset.y + 6);
  }

  return centerPos.clone().setY(preset.y);
}
function createMagicObjectRoot(assetName) {
  const source = summonAssetSources.get(assetName);

  if (!source) {
    console.warn("[origin-magic-circle] unknown asset:", assetName);
    return null;
  }

  let root;

  if (source.isCustom) {
    root = createCustomEffectByName(assetName);
  } else {
    root = skeletonClone(source.gltf.scene);

    applyAssetSpecificTransform(root, assetName);
    applyAssetSpecificMaterialFix(root, assetName);

    if (assetName === "fireball.glb") {
      applyFireballMaterialFix(root);
    }

    if (assetName === "stylized_fire_tornado.glb") {
      applyFireTornadoMaterialFix(root);
    }

    if (source.gltf?.animations?.length > 0) {
      const mixer = new AnimationMixer(root);
      const clip = getPreferredAnimationClip(assetName, source.gltf.animations);

      if (clip) {
        const action = mixer.clipAction(clip);
        action.reset();
        action.play();
      }

      activeMagicMixers.push({
        root,
        mixer,
      });
    }
  }

  root.visible = true;
  return root;
}
function getRotationSpeedValue(rotationSpeed) {
  if (rotationSpeed === "slow") return 0.8;
  if (rotationSpeed === "normal") return 1.8;
  if (rotationSpeed === "fast") return 4.0;
  return 1.8;
}


function normalizeEnterEffect(value) {
  if (value === "fall_from_sky") return "fall_from_sky";
  if (value === "rise_from_ground") return "rise_from_ground";
  if (value === "scale_up") return "scale_up";
  return "scale_up";
}

function normalizeExitEffect(value) {
  if (value === "rise_to_sky") return "rise_to_sky";
  if (value === "sink_into_ground") return "sink_into_ground";
  if (value === "scale_down") return "scale_down";
  return "scale_down";
}

function smoothStep01(value) {
  const t = Math.max(0, Math.min(1, Number(value) || 0));
  return t * t * (3 - 2 * t);
}

function getBaseMagicPosition(item, age) {
  if (item.movePathType !== "none" && item.moveDuration > 0) {
    return getPositionOnPath(
      item.spawnPosition,
      item.targetPosition,
      age / item.moveDuration,
      item.movePathType
    );
  }

  return item.spawnPosition.clone();
}

function applyMagicLifecycleTransform(item, age) {
  const root = item.root;
  let pos = getBaseMagicPosition(item, age);
  let scaleRate = 1;

  const enterDuration = Math.max(0.01, item.enterDuration || 0.75);
  const exitDuration = Math.max(0.01, item.exitDuration || 0.75);

  const enterT = smoothStep01(age / enterDuration);

  if (enterT < 1) {
    if (item.enterEffect === "fall_from_sky") {
      pos.y += (1 - enterT) * 12;
    }

    if (item.enterEffect === "rise_from_ground") {
      pos.y -= (1 - enterT) * 6;
    }

    if (item.enterEffect === "scale_up") {
      scaleRate *= enterT;
    }
  }

  const exitStart = Math.max(0, item.lifeTime - exitDuration);

  if (age >= exitStart) {
    const exitT = smoothStep01((age - exitStart) / exitDuration);

    if (item.exitEffect === "rise_to_sky") {
      pos.y += exitT * 12;
    }

    if (item.exitEffect === "sink_into_ground") {
      pos.y -= exitT * 6;
    }

    if (item.exitEffect === "scale_down") {
      scaleRate *= 1 - exitT;
    }
  }

  root.position.copy(pos);
  root.scale.setScalar((item.baseScale || item.root.userData.currentScale || 1) * Math.max(0.001, scaleRate));
}


function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function getPositionOnPath(start, target, t, pathType) {
  const clamped = Math.max(0, Math.min(t, 1));
  const eased = easeOutCubic(clamped);

  if (pathType === "fall_from_above") {
    const highStart = start.clone();
    highStart.y = Math.max(start.y, target.y + 10);
    return highStart.lerp(target, eased);
  }

  if (pathType === "rise_from_below") {
    const lowStart = start.clone();
    lowStart.y = Math.min(start.y, target.y - 5);
    return lowStart.lerp(target, eased);
  }

  const pos = start.clone().lerp(target, eased);

  if (pathType === "arc") {
    pos.y += Math.sin(Math.PI * eased) * 5;
  }

  if (pathType === "orbit") {
    const radius = Math.max(start.distanceTo(target), 3);
    const angle = eased * Math.PI * 2;

    pos.x = target.x + Math.cos(angle) * radius * (1 - eased);
    pos.z = target.z + Math.sin(angle) * radius * (1 - eased);
    pos.y += Math.sin(Math.PI * eased) * 3;
  }

  return pos;
}
function applyMagicColor(root, colorHexCode) {
  if (!/^#[0-9a-fA-F]{6}$/.test(String(colorHexCode || ""))) return;

  const color = new Color(colorHexCode);

  root.traverse((child) => {
    if (!child.material) return;

    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];

    mats.forEach((mat) => {
      if (mat.color) {
        mat.color.lerp(color, 0.35);
      }

      if (mat.emissive) {
        mat.emissive.lerp(color, 0.5);
      }

      mat.needsUpdate = true;
    });
  });
}
function spawnMagicVisualObject(visualObject, objectIndex = 0, objectCount = 1, casterSide = "self") {
  const assetName = visualObject.assetFileName;

  if (!summonAssetOptions.includes(assetName)) {
    console.warn("[origin-magic-circle] rejected asset:", assetName);
    return null;
  }

  const objectSize = visualObject.objectSize || "medium";
  const preset = getAssetSizePreset(assetName, objectSize);

  const root = createMagicObjectRoot(assetName);
  if (!root) return null;


const baseSpawnPosition = getSpawnPositionByName(
  visualObject.spawnPosition,
  assetName,
  objectSize,
  objectIndex,
  objectCount,
  visualObject.spawnSpreadPattern || "none",
  casterSide
);

const spawnPosition = applyRelativeOffsetToPosition(
  baseSpawnPosition,
  visualObject.positionOffset,
  casterSide
);

const movement = visualObject.movement || {};

const baseTargetPosition = getTargetPositionByName(
  movement.targetPosition || "enemy_position",
  assetName,
  objectSize,
  casterSide
);

const targetPosition = applyRelativeOffsetToPosition(
  baseTargetPosition,
  movement.targetOffset,
  casterSide
);

root.position.copy(spawnPosition);
root.scale.setScalar(preset.scale);
root.userData.currentScale = preset.scale;

root.rotation.x += preset.rotationX || 0;
root.rotation.y += preset.rotationY || 0;
root.rotation.z += preset.rotationZ || 0;

applyVisualObjectRotationOptions(root, visualObject, casterSide);

applyMagicColor(root, visualObject.colorHexCode);

  if (assetName === "explosion_burst") {
    resetExplosionBurst(root);
  }

  scene.add(root);

  const moveDuration = clampNumber(
    movement.moveDurationSeconds,
    0,
    10,
    0
  );

  const movePathType = movement.movePathType || "none";



  const orbitConfig = normalizeVisualOrbitConfig(
  visualObject,
  assetName,
  objectSize,
  casterSide,
  objectIndex,
  objectCount
);

  const active = {
  root,
  assetName,
  startTime: clock.elapsedTime,
  lifeTime: clampNumber(visualObject.lifeTimeSeconds, 0.5, 10, 8),

  spawnPosition: spawnPosition.clone(),
  targetPosition: targetPosition.clone(),

  moveDuration,
  movePathType,

  orbit: orbitConfig,

  baseScale: preset.scale,
  enterEffect: normalizeEnterEffect(visualObject.enterEffect),
  exitEffect: normalizeExitEffect(visualObject.exitEffect),
  enterDuration: 0.75,
  exitDuration: 0.75,

  shouldRotate: !!visualObject.rotation?.shouldRotate,
  rotationSpeed: getRotationSpeedValue(visualObject.rotation?.rotationSpeed),
};


  applyMagicLifecycleTransform(active, 0);
  activeMagicObjects.push(active);
  return active;
}
function getMagicEffectEndSeconds(effectJson) {
  let end = 0;

  for (const timedEffect of effectJson?.timedVisualEffects || []) {
    const start = Math.max(0, Number(timedEffect?.startTimeSeconds) || 0);

    for (const visualObject of timedEffect?.visualObjects || []) {
      const life = Math.max(0.5, Number(visualObject?.lifeTimeSeconds) || 0);
      end = Math.max(end, start + life);
    }
  }

  for (const timing of effectJson?.damageTimings || []) {
    end = Math.max(end, Math.max(0, Number(timing?.timeSeconds) || 0));
  }

  return Math.min(Math.max(end, 1), 12);
}






function triggerOriginSceneEffect(sceneEffect, casterSide = "self") {
  if (!sceneEffect || typeof sceneEffect !== "object") return;

  if (sceneEffect.type === "sky_color") {
    const originalBackground = scene.background?.clone?.() || new Color("#87ceeb");
    const nextColor = new Color(sceneEffect.color || "#101020");
    const durationMs = Math.max(300, Number(sceneEffect.durationSeconds || 3) * 1000);

    scene.background = nextColor;

    setBattleTimeout(() => {
      if (!battleState.gameEnded) {
        scene.background = originalBackground;
      }
    }, durationMs);

    return;
  }

  if (sceneEffect.type === "camera_shake") {
    const durationMs = Math.max(100, Number(sceneEffect.durationSeconds || 0.8) * 1000);
    const strength = Math.max(0, Number(sceneEffect.strength || 0.4));
    const startedAt = performance.now();
    const basePosition = camera.position.clone();

    const shake = () => {
      if (battleState.gameEnded) {
        camera.position.copy(basePosition);
        return;
      }

      const elapsed = performance.now() - startedAt;
      const t = elapsed / durationMs;

      if (t >= 1) {
        camera.position.copy(basePosition);
        return;
      }

      const fade = 1 - t;
      camera.position.set(
        basePosition.x + (Math.random() - 0.5) * strength * fade,
        basePosition.y + (Math.random() - 0.5) * strength * fade,
        basePosition.z + (Math.random() - 0.5) * strength * fade
      );

      requestAnimationFrame(shake);
    };

    shake();
    return;
  }

  if (sceneEffect.type === "camera_pulse") {
    const durationMs = Math.max(100, Number(sceneEffect.durationSeconds || 0.8) * 1000);
    const strength = Math.max(0, Number(sceneEffect.strength || 0.35));
    const startedAt = performance.now();
    const baseFov = camera.fov;

    const pulse = () => {
      if (battleState.gameEnded) {
        camera.fov = baseFov;
        camera.updateProjectionMatrix();
        return;
      }

      const elapsed = performance.now() - startedAt;
      const t = elapsed / durationMs;

      if (t >= 1) {
        camera.fov = baseFov;
        camera.updateProjectionMatrix();
        return;
      }

      const wave = Math.sin(Math.PI * t);
      camera.fov = baseFov - wave * strength * 10;
      camera.updateProjectionMatrix();

      requestAnimationFrame(pulse);
    };

    pulse();
  }

  if (sceneEffect.type === "camera_move") {
  const durationMs = Math.max(200, Number(sceneEffect.durationSeconds || 1.2) * 1000);
  const holdMs = Math.max(0, Number(sceneEffect.holdSeconds || 0.4) * 1000);

  const { self, enemy } = getBattleActors(casterSide);
  const { forward, right } = getForwardAndRight(self, enemy);

  const basePosition = camera.position.clone();
  const baseQuaternion = camera.quaternion.clone();

  const lookTarget = (() => {
    if (sceneEffect.lookAt === "enemy") {
      return enemy.position.clone().add(new Vector3(0, 3, 0));
    }

    if (sceneEffect.lookAt === "self") {
      return self.position.clone().add(new Vector3(0, 3, 0));
    }

    return new Vector3(0, 3, 0);
  })();

  const targetPosition = basePosition
    .clone()
    .addScaledVector(forward, Number(sceneEffect.forward) || 0)
    .addScaledVector(right, Number(sceneEffect.right) || 0);

  targetPosition.y += Number(sceneEffect.y) || 0;

  const startedAt = performance.now();

  const move = () => {
    if (battleState.gameEnded) {
      camera.position.copy(basePosition);
      camera.quaternion.copy(baseQuaternion);
      return;
    }

    const elapsed = performance.now() - startedAt;
    const t = Math.min(elapsed / durationMs, 1);
    const eased = 1 - Math.pow(1 - t, 3);

    camera.position.lerpVectors(basePosition, targetPosition, eased);
    camera.lookAt(lookTarget);

    if (typeof controls !== "undefined" && controls?.target) {
      controls.target.copy(lookTarget);
      controls.update?.();
    }

    if (t < 1) {
      requestAnimationFrame(move);
      return;
    }

    setBattleTimeout(() => {
      const backStartedAt = performance.now();
      const currentPosition = camera.position.clone();
      const currentQuaternion = camera.quaternion.clone();

      const back = () => {
        if (battleState.gameEnded) {
          camera.position.copy(basePosition);
          camera.quaternion.copy(baseQuaternion);
          return;
        }

        const backElapsed = performance.now() - backStartedAt;
        const backT = Math.min(backElapsed / durationMs, 1);
        const backEased = 1 - Math.pow(1 - backT, 3);

        camera.position.lerpVectors(currentPosition, basePosition, backEased);
        camera.quaternion.slerpQuaternions(currentQuaternion, baseQuaternion, backEased);

        if (typeof controls !== "undefined" && controls?.target) {
          controls.target.copy(lookTarget.clone().lerp(new Vector3(0, 2, 0), backEased));
          controls.update?.();
        }

        if (backT < 1) {
          requestAnimationFrame(back);
        }
      };

      back();
    }, holdMs);
  };

  move();
  return;
}
  
}

function scheduleOriginSceneEffects(effectJson, casterSide = "self") {
  const sceneEffects = Array.isArray(effectJson?.sceneEffects)
    ? effectJson.sceneEffects
    : [];

  sceneEffects.forEach((sceneEffect) => {
    const delay = Math.max(0, Number(sceneEffect.timeSeconds || 0)) * 1000;

    setBattleTimeout(() => {
      if (battleState.gameEnded) return;
      triggerOriginSceneEffect(sceneEffect, casterSide);
    }, delay);
  });
}






async function playMagicVisualEffects(effectJson, isEnemyCast = false, options = {}) {
  if (battleState.gameEnded) return;

  if (!effectJson || !Array.isArray(effectJson.timedVisualEffects)) {
    console.warn("[origin-magic-circle] invalid magic effect json:", effectJson);
    return;
  }

  function isSafariBrowser() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }

  if (!options.assetsAlreadyLoaded) {
  await ensureMagicJsonAssetsLoaded(effectJson);
}

  const casterSide = isEnemyCast ? "enemy" : "self";

  scheduleOriginSceneEffects(effectJson, casterSide);



  // 以下そのまま


  const totalDamage = Number.isFinite(Number(effectJson?.totalDamage))
    ? Math.max(0, Math.round(Number(effectJson.totalDamage)))
    : null;
  const legacyMaxDamage = Math.min(ORIGIN_MAGIC_CIRCLE_MAX_HP, Math.max(0, Number(effectJson?.artScore) || 0));
  const damageTimings = Array.isArray(effectJson?.damageTimings) ? effectJson.damageTimings : [];
  damageTimings.forEach((timing) => {
    const delay = Math.max(0, Number(timing.timeSeconds) || 0) * 1000;
    setBattleTimeout(() => {
      
      
      if (battleState.gameEnded) return;
      
      
      //ここ自信ない↓
      const weight = Math.max(0, Number(timing.damageWeight) || 0);
      const amount = totalDamage !== null
        ? Math.round(totalDamage * (weight / 100))
        : Math.round(legacyMaxDamage * (weight / 100));

     showDamageNumber(amount, isEnemyCast);

      // 自分が撃った魔法のダメージだけサーバーへ確定送信する。
      // 相手から受けた魔法側では送らない。二重減算防止。
      if (!isEnemyCast && !isOriginDebugTestRoom) {
        const members = currentRoom?.members || [];
        const enemy = members.find((member) => member.id !== userTrackingId);
        const socket = getSocketIoClient();

        if (enemy?.id && socket) {
          emitWithAck(socket, "origin:damage", {
            roomId: currentRoom?.roomId,
            attackerId: userTrackingId,
            targetId: enemy.id,
            damage: amount,
          }).catch((error) => {
            console.warn("[origin-magic-circle] socket damage failed:", error);
          });
        }
      }
      
      
    }, delay);
  });
  effectJson.timedVisualEffects.forEach((timedEffect) => {
    const delaySeconds = clampNumber(timedEffect.startTimeSeconds, 0, 6, 0);

    setBattleTimeout(() => {
      if (battleState.gameEnded) return;
      const visualObjects = Array.isArray(timedEffect.visualObjects)
        ? timedEffect.visualObjects
        : [];

      visualObjects.forEach((visualObject) => {
        //const safari = isSafariBrowser();
const objectCount = Math.max(
  1,
  Math.min(Number(visualObject.objectCount) || 1, 12)
);

        for (let i = 0; i < objectCount; i += 1) {
          spawnMagicVisualObject(visualObject, i, objectCount, casterSide);
        }
      });
    }, delaySeconds * 1000);
  });

    const endMs = getMagicEffectEndSeconds(effectJson) * 1000 + 350;

  await new Promise((resolve) => {
    setBattleTimeout(resolve, endMs);
  });
}




  async function playMagicCastWithName(effectJson, isEnemyCast = false) {
  if (battleState.gameEnded) return;

  await ensureMagicJsonAssetsLoaded(effectJson);

  if (battleState.gameEnded) return;

  await showMagicNameCenterAsync(effectJson?.magicName, isEnemyCast);

  if (battleState.gameEnded) return;

  await playMagicVisualEffects(effectJson, isEnemyCast, {
    assetsAlreadyLoaded: true,
  });
}





function updateActiveMagicObjects(elapsed, delta) {
  for (let i = activeMagicObjects.length - 1; i >= 0; i -= 1) {
    const item = activeMagicObjects[i];
    const age = elapsed - item.startTime;

    updateCustomEffect(item.root, elapsed, delta);

    if (item.assetName === "explosion_burst" && item.root.userData.finished) {
      removeActiveMagicObject(i);
      continue;
    }

    if (age >= item.lifeTime) {
      removeActiveMagicObject(i, false);
      continue;
    }

    applyMagicLifecycleTransform(item, age);

// 公転指定がある場合は、通常移動後に位置だけ上書きする
// scale_up / exitEffect などのライフサイクル演出は維持される
if (item.orbit) {
  applyStationaryOrbitMotion(item, age);
}

if (item.shouldRotate) {
  item.root.rotation.y += delta * item.rotationSpeed;
}
  }
}

function removeActiveMagicObject(index, withShrink = false) {
  const item = activeMagicObjects[index];
  if (!item) return;

  if (withShrink && !item.shrinking) {
    item.shrinking = true;
    item.shrinkStartedAt = clock.elapsedTime;
    item.shrinkDuration = 0.35;
    return;
  }
  scene.remove(item.root);
removeMixerForRoot(item.root);
activeMagicObjects.splice(index, 1);

if (customEffectNames.has(item.assetName)) {
  disposeObject3DResources(item.root);
} else {
  releaseSummonAssetIfUnused(item.assetName);
}

}

function removeMixerForRoot(root) {
  for (let i = activeMagicMixers.length - 1; i >= 0; i -= 1) {
    if (activeMagicMixers[i].root === root) {
      activeMagicMixers.splice(i, 1);
    }
  }
}




function disposeObject3DResources(root) {
  if (!root) return;

  root.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose?.();
    }

    if (!child.material) return;

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    materials.forEach((mat) => {
      if (!mat) return;

      [
        "map",
        "normalMap",
        "roughnessMap",
        "metalnessMap",
        "emissiveMap",
        "alphaMap",
        "aoMap",
      ].forEach((key) => {
        mat[key]?.dispose?.();
      });

      mat.dispose?.();
    });
  });
}

function releaseSummonAssetIfUnused(assetName) {
  if (!assetName || customEffectNames.has(assetName)) return;

  const stillUsed = activeMagicObjects.some((item) => {
    return item.assetName === assetName;
  });

  if (stillUsed) return;

  const source = summonAssetSources.get(assetName);
  if (source?.gltf?.scene) {
    disposeObject3DResources(source.gltf.scene);
  }

  summonAssetSources.delete(assetName);
  assetLoadPromises.delete(assetName);
  summonAssetAnimationInfo.delete(assetName);
}




  

  topControls = document.createElement("div");
topControls.style.maxHeight = "28vh";
topControls.style.overflowY = "auto";
topControls.style.maxWidth = "96vw";
topControls.style.fontSize = "12px";
topControls.style.padding = "8px";
topControls.style.zIndex = "30000000";
topControls.className = "summon-test-controls";
  
      topControls.innerHTML = `
  <div class="summon-test-controls__header">
    <strong>3D素材テスト</strong>
    <button class="summon-test-controls__toggle" type="button">折り畳む</button>
  </div>

  <div class="summon-test-controls__body">
    <label class="summon-test-controls__field">
      3D素材
      <select class="summon-asset-select"></select>
    </label>

    <div class="summon-test-controls__fields">
    
    <label class="summon-test-controls__field">
  素材パーツ
  <select class="summon-material-select"></select>
</label>

<label class="summon-test-controls__field">
  色
  <input class="summon-material-color" type="color" value="#ffffff" />
</label>

<label class="summon-test-controls__field">
  透明度
  <input class="summon-material-opacity" type="number" min="0" max="1" step="0.05" value="1" />
</label>

<label class="summon-test-controls__field">
  <input class="summon-material-transparent" type="checkbox" />
  transparent
</label>

<label class="summon-test-controls__field">
  <input class="summon-material-depthwrite" type="checkbox" />
  depthWrite
</label>

      <label class="summon-test-controls__field">
        スケール倍率
        <input class="summon-scale-input" type="number" min="0.01" step="0.1" value="1" />
      </label>

      <label class="summon-test-controls__field">
        Y高さ
      <input class="summon-y-input" type="number" step="0.1" value="1.6" />
  
      <label class="summon-test-controls__field">
        Z補正
      <input class="summon-z-input" type="number" step="0.1" value="0" />
      </label>

      <label class="summon-test-controls__field">
        向きX(度)
        <input class="summon-rotation-x-input" type="number" step="1" value="0" />
      </label>

      <label class="summon-test-controls__field">
        向きY(度)
        <input class="summon-rotation-y-input" type="number" step="1" value="0" />
      </label>

      <label class="summon-test-controls__field">
        向きZ(度)
        <input class="summon-rotation-z-input" type="number" step="1" value="0" />
      </label>

<label class="summon-test-controls__field">
  表示位置
  <select class="summon-preview-position-select">
    <option value="center">中央</option>
    <option value="self">自キャラ前</option>
  </select>
</label>

<label class="summon-test-controls__field">
  魔法演出テスト種別
  <select class="magic-effect-test-pattern">
    <option value="comet_blast">彗星弾</option>
    <option value="spiral_guard">螺旋ガード</option>
    <option value="rain_storm">流星雨</option>
  </select>
</label>
<button class="magic-effect-test-btn" type="button">魔法演出テスト実行</button>
    </div>
  </div>
`;

  const topControlsBody = topControls.querySelector(".summon-test-controls__body");
  const topControlsToggle = topControls.querySelector(".summon-test-controls__toggle");


  const assetSelect = topControls.querySelector(".summon-asset-select");
  const scaleInput = topControls.querySelector(".summon-scale-input");
  const yInput = topControls.querySelector(".summon-y-input");
  const zInput = topControls.querySelector(".summon-z-input");
  const rotationXInput = topControls.querySelector(".summon-rotation-x-input");
  const rotationYInput = topControls.querySelector(".summon-rotation-y-input");
  const rotationZInput = topControls.querySelector(".summon-rotation-z-input");

  const effectTestBtn = topControls.querySelector(".magic-effect-test-btn");
  const effectPatternSelect = topControls.querySelector(".magic-effect-test-pattern");




const materialSelect = topControls.querySelector(".summon-material-select");
const materialColorInput = topControls.querySelector(".summon-material-color");
const materialOpacityInput = topControls.querySelector(".summon-material-opacity");
const materialTransparentInput = topControls.querySelector(".summon-material-transparent");
const materialDepthWriteInput = topControls.querySelector(".summon-material-depthwrite");

let previewMaterialItems = [];




const positionSelect = topControls.querySelector(".summon-preview-position-select");

function getSelectedPreviewMaterialItem() {
  const index = Number(materialSelect?.value);
  if (!Number.isInteger(index)) return null;
  return previewMaterialItems[index] || null;
}

function syncMaterialEditorInputs() {
  const item = getSelectedPreviewMaterialItem();
  const mat = item?.material;
  if (!mat) return;

  if (materialColorInput && mat.color) {
    materialColorInput.value = `#${mat.color.getHexString()}`;
  }

  if (materialOpacityInput) {
    materialOpacityInput.value = String(
      Number.isFinite(Number(mat.opacity)) ? mat.opacity : 1
    );
  }

  if (materialTransparentInput) materialTransparentInput.checked = !!mat.transparent;
  if (materialDepthWriteInput) materialDepthWriteInput.checked = !!mat.depthWrite;
}

function applyMaterialEditorToSelected() {
  const item = getSelectedPreviewMaterialItem();
  const mat = item?.material;
  if (!mat) return;

  if (mat.color && materialColorInput?.value) {
    mat.color.set(materialColorInput.value);
  }

  if (materialOpacityInput) {
    const opacity = Math.max(0, Math.min(1, Number(materialOpacityInput.value)));
    mat.opacity = Number.isFinite(opacity) ? opacity : 1;
  }

  if (materialTransparentInput) mat.transparent = materialTransparentInput.checked;
  if (materialDepthWriteInput) mat.depthWrite = materialDepthWriteInput.checked;
  mat.needsUpdate = true;

  if (previewAssetRoot && previewAssetName) {
    showDebug(getMaterialDebugText(previewAssetRoot, previewAssetName));
  }
}

function rebuildMaterialEditor(root, assetName) {
  previewMaterialItems = collectPreviewMaterials(root);

  if (!materialSelect) return;

  materialSelect.innerHTML = "";

  previewMaterialItems.forEach((item, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${item.meshName} / ${item.material.name || item.material.type} [${item.materialIndex}]`;
    materialSelect.appendChild(option);
  });

  materialSelect.value = "0";
  syncMaterialEditorInputs();
}


materialSelect?.addEventListener("change", syncMaterialEditorInputs);
materialColorInput?.addEventListener("input", applyMaterialEditorToSelected);
materialOpacityInput?.addEventListener("input", applyMaterialEditorToSelected);
materialTransparentInput?.addEventListener("change", applyMaterialEditorToSelected);
materialDepthWriteInput?.addEventListener("change", applyMaterialEditorToSelected);





const initialPreset = getAssetSizePreset("fireball.glb", "medium");
scaleInput.value = initialPreset.scale;
  yInput.value = initialPreset.y;
  zInput.value = initialPreset.offsetZ || 0;


topControlsToggle?.addEventListener("click", () => {
  const collapsed = topControls.classList.toggle("is-collapsed");
  if (topControlsBody) {
    topControlsBody.style.display = collapsed ? "none" : "";
  }
  topControlsToggle.textContent = collapsed ? "開く" : "折り畳む";
});



  summonAssetOptions.forEach((assetName, index) => {
    const option = document.createElement("option");
    option.value = assetName;
    option.textContent = assetName;
    if (index === 0) option.selected = true;
    assetSelect?.appendChild(option);
  });


//変更16
function getMaterialDebugText(root, assetName) {
  const animations = summonAssetAnimationInfo.get(assetName) || [];

  const lines = [
    `asset: ${assetName}`,
    `animationCount: ${animations.length}`,
    JSON.stringify({ animations }, null, 2),
  ];

  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];

    mats.forEach((mat, index) => {
      lines.push(JSON.stringify({
        mesh: child.name,
        materialIndex: index,
        material: mat.name,
        type: mat.type,
        hasMap: !!mat.map,
        transparent: mat.transparent,
        opacity: mat.opacity,
        color: mat.color?.getHexString?.(),
        blending: mat.blending,
        depthWrite: mat.depthWrite,
        alphaTest: mat.alphaTest,
        toneMapped: mat.toneMapped,
      }, null, 2));
    });
  });

  return lines.join("\n");
}





let previewAssetRoot = null;
let previewAssetName = "";
let previewRequestId = 0;

function removePreviewAssetRoot() {
  if (!previewAssetRoot) return;

  scene.remove(previewAssetRoot);
  removeMixerForRoot(previewAssetRoot);

  previewAssetRoot = null;
  previewAssetName = "";
}

function getPreviewPosition(assetName, appliedY, appliedZ = null) {
  const mode = positionSelect?.value || "center";
  const preset = getAssetSizePreset(assetName, "medium");
  const z = Number.isFinite(Number(appliedZ)) ? Number(appliedZ) : (preset.offsetZ || 0);

  if (mode === "self") {
    const { self, enemy } = getBattleActors("self");
    const { forward } = getForwardAndRight(self, enemy);

    return self.position
      .clone()
      .addScaledVector(forward, 6)
      .setY(appliedY)
      .add(new Vector3(0, 0, z));
  }

  return new Vector3(
    preset.offsetX || 0,
    appliedY,
    z
  );
}





function detachMaterialsForPreview(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    if (Array.isArray(child.material)) {
      child.material = child.material.map((mat) => mat.clone());
    } else {
      child.material = child.material.clone();
    }
  });
}

function collectPreviewMaterials(root) {
  const items = [];

  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const mats = Array.isArray(child.material) ? child.material : [child.material];

    mats.forEach((mat, materialIndex) => {
      items.push({
        mesh: child,
        meshName: child.name || "(no name)",
        material: mat,
        materialIndex,
      });
    });
  });

  return items;
}





async function showPreviewAsset(assetName) {
  const requestId = ++previewRequestId;

  if (!assetName || !summonAssetOptions.includes(assetName)) return;

  removePreviewAssetRoot();

  const scaleValue = Number(scaleInput?.value);
  const appliedScale = Number.isFinite(scaleValue) && scaleValue > 0 ? scaleValue : 1;

  const yValue = Number(yInput?.value);
  const appliedY = Number.isFinite(yValue) ? yValue : 1.6;

  const zValue = Number(zInput?.value);
  const appliedZ = Number.isFinite(zValue) ? zValue : 0;

  await ensureSummonAssetLoaded(assetName, { urgent: true });

  // 重要：ロード中に別素材へ切り替わっていたら、この表示処理を破棄
  const currentSelectedName = assetSelect?.value || "";

  if (requestId !== previewRequestId || currentSelectedName !== assetName) {
    return;
  }

  const root = createMagicObjectRoot(assetName);
  if (!root) return;

  detachMaterialsForPreview(root);

  root.visible = true;
  root.scale.setScalar(appliedScale);
  root.position.copy(getPreviewPosition(assetName, appliedY, appliedZ));
  root.rotation.set(
    (Number(rotationXInput?.value) || 0) * Math.PI / 180,
    (Number(rotationYInput?.value) || 0) * Math.PI / 180,
    (Number(rotationZInput?.value) || 0) * Math.PI / 180
  );
  root.userData.currentScale = appliedScale;

  if (root.userData.effectType === "explosion_burst") {
    resetExplosionBurst(root);
  }

  scene.add(root);

  previewAssetRoot = root;
  previewAssetName = assetName;

  //rebuildMaterialEditor(root, assetName);
  rebuildMaterialEditor(root);

  showDebug(getMaterialDebugText(root, assetName));
}




effectTestBtn?.addEventListener("click", () => {
  const selectedName = assetSelect?.value || "fireball.glb";
  const pattern = effectPatternSelect?.value || "comet_blast";
  const patternVisualMap = {
    comet_blast: [
      {
        startTimeSeconds: 0,
        visualObjects: [{
          assetFileName: selectedName, objectCount: 3, spawnPosition: "in_front_of_self", spawnSpreadPattern: "horizontal_line", colorHexCode: "#88ccff", objectSize: "medium", lifeTimeSeconds: 4, movement: { targetPosition: "enemy_position", moveDurationSeconds: 2, movePathType: "arc" }, rotation: { shouldRotate: true, rotationSpeed: "normal" },
        }],
      },
      {
        startTimeSeconds: 2,
        visualObjects: [{
          assetFileName: "explosion_burst", objectCount: 1, spawnPosition: "enemy_position", spawnSpreadPattern: "none", colorHexCode: "#ff8844", objectSize: "medium", lifeTimeSeconds: 1.5, movement: { targetPosition: "enemy_position", moveDurationSeconds: 0, movePathType: "none" }, rotation: { shouldRotate: false, rotationSpeed: "normal" },
        }],
      },
    ],
    spiral_guard: [
      { startTimeSeconds: 0, visualObjects: [{ assetFileName: selectedName, objectCount: 1, spawnPosition: "battlefield_center", spawnSpreadPattern: "none", colorHexCode: "#66ddff", objectSize: "medium", lifeTimeSeconds: 2.8, movement: { targetPosition: "battlefield_center", moveDurationSeconds: 0, movePathType: "none" }, rotation: { shouldRotate: true, rotationSpeed: "normal" } }] },
      { startTimeSeconds: 0.6, visualObjects: [{ assetFileName: selectedName, objectCount: 1, spawnPosition: "above_battlefield_center", spawnSpreadPattern: "none", colorHexCode: "#66ddff", objectSize: "medium", lifeTimeSeconds: 2.8, movement: { targetPosition: "enemy_position", moveDurationSeconds: 1.6, movePathType: "straight_line" }, rotation: { shouldRotate: true, rotationSpeed: "normal" } }] },
      { startTimeSeconds: 1.2, visualObjects: [{ assetFileName: selectedName, objectCount: 2, spawnPosition: "self_position", spawnSpreadPattern: "circle", colorHexCode: "#b388ff", objectSize: "small", lifeTimeSeconds: 2.4, movement: { targetPosition: "enemy_position", moveDurationSeconds: 1.1, movePathType: "arc" }, rotation: { shouldRotate: true, rotationSpeed: "normal" } }] },
    ],
    rain_storm: [
      { startTimeSeconds: 0, visualObjects: [{ assetFileName: selectedName, objectCount: 10, spawnPosition: "above_enemy", spawnSpreadPattern: "random_scatter", colorHexCode: "#7fb3ff", objectSize: "small", lifeTimeSeconds: 2.6, movement: { targetPosition: "enemy_position", moveDurationSeconds: 1.6, movePathType: "straight_line" }, rotation: { shouldRotate: true, rotationSpeed: "normal" } }] },
      { startTimeSeconds: 1.1, visualObjects: [{ assetFileName: selectedName, objectCount: 4, spawnPosition: "in_front_of_self", spawnSpreadPattern: "horizontal_line", colorHexCode: "#ff99dd", objectSize: "small", lifeTimeSeconds: 2.1, movement: { targetPosition: "above_battlefield_center", moveDurationSeconds: 1.3, movePathType: "orbit" }, rotation: { shouldRotate: true, rotationSpeed: "normal" } }] },
      { startTimeSeconds: 2.1, visualObjects: [{ assetFileName: selectedName, objectCount: 2, spawnPosition: "enemy_position", spawnSpreadPattern: "vertical_line", colorHexCode: "#99ffbb", objectSize: "medium", lifeTimeSeconds: 2.8, movement: { targetPosition: "enemy_position", moveDurationSeconds: 0, movePathType: "none" }, rotation: { shouldRotate: false, rotationSpeed: "normal" } }] },
    ],
  };

  playMagicVisualEffects({
    magicName: `テスト魔法:${pattern}`,
    artScore: 0,
    timedVisualEffects: patternVisualMap[pattern] || patternVisualMap.comet_blast,
    damageTimings: [
      {
        timeSeconds: 2,
        damageWeight: 0,
        target: "enemy",
      },
    ],
  });
});


  const applySummonState = () => {
  if (!isOriginDebugTestRoom) return;

  const selectedName = assetSelect?.value || "fireball.glb";

  showPreviewAsset(selectedName).catch((error) => {
    console.warn("[origin-magic-circle] preview asset failed:", error);
  });
};

assetSelect?.addEventListener("change", () => {
  const selectedName = assetSelect?.value || "";
  const preset = getAssetSizePreset(selectedName, "medium");

  scaleInput.value = preset.scale;
  yInput.value = preset.y;
  zInput.value = preset.offsetZ || 0;

  applySummonState();
});


  //topControls.addEventListener("change", applySummonState);
  scaleInput?.addEventListener("input", applySummonState);
  yInput?.addEventListener("input", applySummonState);
  zInput?.addEventListener("input", applySummonState);
  rotationXInput?.addEventListener("input", applySummonState);
  rotationYInput?.addEventListener("input", applySummonState);
  rotationZInput?.addEventListener("input", applySummonState);
  
  
  
  positionSelect?.addEventListener("change", applySummonState);
  
  
  //refs.battleView.appendChild(topControls);
  //applySummonState();

if (isOriginDebugTestRoom) {
  refs.battleView.appendChild(topControls);
  applySummonState();
}




function getViewerActors() {
  const members = currentRoom?.members || [];
  const isPlayerTwo = members.findIndex((member) => member.id === userTrackingId) === 1;

  return {
    self: isPlayerTwo ? fighterB : fighterA,
    enemy: isPlayerTwo ? fighterA : fighterB,
  };
}

function getMemberBySide(side) {
  const members = currentRoom?.members || [];
  if (side === "self") {
    return members.find((member) => member.id === userTrackingId) || null;
  }

  return members.find((member) => member.id !== userTrackingId) || null;
}

function showWinBanner(winnerName) {
  const old = document.getElementById("originWinBanner");
  old?.remove();

  const banner = document.createElement("div");
  banner.id = "originWinBanner";
  banner.className = "origin-win-banner";
  banner.textContent = `${winnerName || "PLAYER"} WIN`;

  refs.battleView.appendChild(banner);
}

function hideWinBanner() {
  document.getElementById("originWinBanner")?.remove();
}

function animateLoserFall(loserActor) {
  return new Promise((resolve) => {
    const start = performance.now();
    const duration = 1000;

    const initialRotZ = loserActor.rotation.z;
    const targetRotZ = initialRotZ + Math.PI / 2;

    const initialY = loserActor.position.y;
    const targetY = Math.max(1.5, initialY - 1.8);

    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);

      loserActor.rotation.z = initialRotZ + (targetRotZ - initialRotZ) * eased;
      loserActor.position.y = initialY + (targetY - initialY) * eased;

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(step);
  });
}

function moveCameraToWinnerFront(winnerActor, duration = 1000) {
  return new Promise((resolve) => {
    const start = performance.now();

    const startPos = camera.position.clone();

    const winnerPos = winnerActor.position.clone();
    const targetLookAt = winnerPos.clone().add(new Vector3(0, 2.8, 0));

    // 各キャラは中央(0,0,0)を向いているので、
// キャラ位置 → 中央 の方向がキャラの正面方向。
const front = new Vector3(0, winnerPos.y, 0)
  .sub(winnerPos)
  .setY(0)
  .normalize();

const targetPos = winnerPos
  .clone()
  .addScaledVector(front, 10)
  .add(new Vector3(0, 3.2, 0));

    const ease = (t) => {
      const v = Math.max(0, Math.min(1, t));
      return v * v * (3 - 2 * v);
    };

    const step = (now) => {
      const t = ease((now - start) / duration);

      camera.position.lerpVectors(startPos, targetPos, t);
      camera.lookAt(targetLookAt);

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        camera.position.copy(targetPos);
        camera.lookAt(targetLookAt);
        resolve();
      }
    };

    requestAnimationFrame(step);
  });
}

function orbitCameraAroundWinner(winnerActor) {
  return new Promise((resolve) => {
    const start = performance.now();
    const duration = 2600;
    const radius = 10;
    const baseY = 3.2;

    const center = winnerActor.position.clone().add(new Vector3(0, 2.2, 0));

    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const angle = t * Math.PI * 2;

      camera.position.set(
        center.x + Math.sin(angle) * radius,
        center.y + baseY,
        center.z + Math.cos(angle) * radius
      );

      camera.lookAt(center);

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(step);
  });
}




function parseStrokePayload(strokeJson) {
  try {
    const parsed = JSON.parse(String(strokeJson || ""));
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.strokes)) return null;

    return {
      w: Math.max(1, Math.round(Number(parsed.w) || 1)),
      h: Math.max(1, Math.round(Number(parsed.h) || 1)),
      strokes: parsed.strokes.filter((stroke) => Array.isArray(stroke) && stroke.length >= 4),
    };
  } catch {
    return null;
  }
}




function getResultCanvasInternalSize(strokeJson) {
  const payload = parseStrokePayload(strokeJson);

  if (!payload) {
    return {
      width: 700,
      height: 480,
    };
  }

  const aspect = payload.w / payload.h;

  const width = 700;

  // 極端に縦長・横長だと崩れるので、見た目用に制限する
  const minHeight = 260;
  const maxHeight = 620;

  let height = width / aspect;
  height = Math.max(minHeight, Math.min(maxHeight, height));

  return {
    width,
    height: Math.round(height),
  };
}



function resizeResultCanvasToPayload(canvas, strokeJson) {
  const payload = parseStrokePayload(strokeJson);

  /*
    まずCSS上の実横幅を測る。
    canvasは .origin-result-bubble の中で width:100% なので、
    ここで得られる値が「コメント枠内で実際に使える横幅」になる。
  */
  const measuredWidth = canvas.clientWidth || canvas.getBoundingClientRect().width || 260;
  const cssWidth = Math.max(1, Math.round(measuredWidth));

  let sourceW = Number(payload?.w);
  let sourceH = Number(payload?.h);

  if (!Number.isFinite(sourceW) || sourceW <= 0) sourceW = 1;
  if (!Number.isFinite(sourceH) || sourceH <= 0) sourceH = 1;

  /*
    ユーザーの言っている式そのもの。

    キャンバスが置ける横幅 : y
    =
    保存されてるキャンバスの横幅 : 保存されてるキャンバスの縦幅

    y = cssWidth * sourceH / sourceW
  */
  const rawCssHeight = cssWidth * (sourceH / sourceW);

  /*
    極端な縦長/横長で画面を破壊しないための最低限の保険。
    ただし、今回の目的は「途切れない」なので、
    maxを低くしすぎない。
  */
  const minCssHeight = 120;
  const maxCssHeight = Math.max(260, window.innerHeight * 0.62);

  const cssHeight = Math.round(
    Math.max(minCssHeight, Math.min(rawCssHeight, maxCssHeight))
  );

  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  /*
    CSS上の表示サイズ。
    CSS変数にも入れるし、style.heightにも直接入れる。
    どちらか片方だけより事故りにくい。
  */
  canvas.style.width = "100%";
  canvas.style.height = `${cssHeight}px`;
  canvas.style.setProperty("--result-canvas-height", `${cssHeight}px`);

  /*
    canvas内部解像度。
    表示サイズと同じ比率にする。
  */
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);

  return {
    payload,
    cssWidth,
    cssHeight,
    dpr,
  };
}




function drawStrokePayloadToCanvas(canvas, strokeJson) {
  const {
    payload,
    dpr,
  } = resizeResultCanvasToPayload(canvas, strokeJson);

  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) return;

  ctx2d.setTransform(1, 0, 0, 1, 0, 0);
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);

  ctx2d.fillStyle = "#fff";
  ctx2d.fillRect(0, 0, canvas.width, canvas.height);

  if (!payload) {
    ctx2d.fillStyle = "#999";
    ctx2d.font = `${14 * dpr}px sans-serif`;
    ctx2d.textAlign = "center";
    ctx2d.textBaseline = "middle";
    ctx2d.fillText("魔法陣データなし", canvas.width / 2, canvas.height / 2);
    return;
  }

  const sourceW = Math.max(1, Number(payload.w) || 1);
  const sourceH = Math.max(1, Number(payload.h) || 1);

  /*
    線の太さ分の余白。
    保存座標が範囲内でも、線は座標を中心に太さを持つので、
    端ギリギリに線があると切れる。
  */
  const padding = Math.max(18 * dpr, Math.min(canvas.width, canvas.height) * 0.055);

  const drawableWidth = Math.max(1, canvas.width - padding * 2);
  const drawableHeight = Math.max(1, canvas.height - padding * 2);

  /*
    表示canvas自体が sourceW:sourceH と同じ比率なので、
    基本的にはこのscaleで綺麗に収まる。
  */
  const scale = Math.min(
    drawableWidth / sourceW,
    drawableHeight / sourceH
  );

  const drawnWidth = sourceW * scale;
  const drawnHeight = sourceH * scale;

  const offsetX = (canvas.width - drawnWidth) / 2;
  const offsetY = (canvas.height - drawnHeight) / 2;

  ctx2d.strokeStyle = "#111";
  ctx2d.lineWidth = Math.max(2.5 * dpr, 4 * scale);
  ctx2d.lineCap = "round";
  ctx2d.lineJoin = "round";

  payload.strokes.forEach((stroke) => {
    if (!Array.isArray(stroke) || stroke.length < 4) return;

    const usableLength = stroke.length - (stroke.length % 2);

    ctx2d.beginPath();

    ctx2d.moveTo(
      offsetX + Number(stroke[0]) * scale,
      offsetY + Number(stroke[1]) * scale
    );

    for (let i = 2; i < usableLength; i += 2) {
      const x = Number(stroke[i]);
      const y = Number(stroke[i + 1]);

      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

      ctx2d.lineTo(
        offsetX + x * scale,
        offsetY + y * scale
      );
    }

    ctx2d.stroke();
  });
}





function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}




function createResultMagicBubble(log, index) {
  const isSelf = log.casterId === userTrackingId;

  const bubble = document.createElement("div");
  bubble.className = `origin-result-bubble ${isSelf ? "self" : "enemy"}`;
  bubble.style.animationDelay = `${index * 1}s`;

  const title = document.createElement("div");
  title.className = "origin-result-bubble__title";

  const damage = Number.isFinite(Number(log.totalDamage))
    ? Math.max(0, Math.round(Number(log.totalDamage)))
    : Math.max(0, Math.round(Number(log.artScore) || 0));

  const artScore = Number.isFinite(Number(log.artScore))
  ? Math.max(0, Math.round(Number(log.artScore)))
  : 0;

title.textContent = `${log.magicName}\n\n【芸術点:${artScore}　${damage}ダメージ】`;

  
   const canvas = document.createElement("canvas");
canvas.className = "origin-result-bubble__canvas";

bubble.append(title, canvas);

requestAnimationFrame(() => {
  drawStrokePayloadToCanvas(canvas, log.strokeJson);
});

  return bubble;
}




async function hydrateMagicLogsFromRoomCastLogs() {
  if (!currentRoom?.roomId || isOriginDebugTestRoom) return;

  try {
    const data = await callApi(
      `/api/origin-magic-circle/rooms/${encodeURIComponent(currentRoom.roomId)}/cast-logs`
    );

    const logs = Array.isArray(data.logs) ? data.logs : [];

    logs.forEach((log) => {
      addMagicLogFromCast({
        id: log.id,
        at: log.at,
        casterId: log.casterId,
        casterName: log.casterName,
        spellHash: log.spellHash,
        magicEffectJson: log.magicEffectJson,
        strokeJson: log.strokeJson,
      });
    });
  } catch (error) {
    console.warn("[origin-magic-circle] hydrate magic logs failed:", error);
  }
}





function showBattleResultScreen({ selfWon }) {
  refs.battleView.innerHTML = "";

  const result = document.createElement("div");
  result.className = `origin-result-screen ${selfWon ? "win" : "lose"}`;

  const title = document.createElement("div");
  title.className = "origin-result-title";
  title.textContent = selfWon ? "VICTORY" : "DEFEAT";

  const sub = document.createElement("div");
  sub.className = "origin-result-subtitle";
  sub.textContent = "発動した魔法陣";

  const list = document.createElement("div");
  list.className = "origin-result-chat";

  const logs = [...battleState.magicLogs].sort((a, b) => a.at - b.at);

  logs.forEach((log, index) => {
    list.appendChild(createResultMagicBubble(log, index));
  });

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "origin-result-back-btn";
  backBtn.textContent = "もう一度遊ぶ";

  backBtn.addEventListener("click", async () => {
  if (!currentRoom?.roomId || !userTrackingId) return;

  backBtn.disabled = true;

  try {
    const room = await callApi("/api/origin-magic-circle/rooms/rematch", {
      roomId: currentRoom.roomId,
      userTrackingId,
    }, "POST");

    enterRematchWaitingRoom(room);
  } catch (error) {
    backBtn.disabled = false;
    setMessage(`再戦の準備に失敗しました: ${error.message}`);
  }
});

  result.append(title, sub, list, backBtn);
  refs.battleView.appendChild(result);

  setTimeout(() => {
    list.scrollTo({
      top: list.scrollHeight,
      behavior: "smooth",
    });
  }, Math.max(1000, logs.length * 1000 + 300));
}




async function showReloadedBattleResultScreen() {
  if (battleState.endingStarted) return;

  battleState.endingStarted = true;
  battleState.gameEnded = true;

  const selfWon = getSelfWonFromCurrentHp();

  hideTutorialModal();

  await hydrateMagicLogsFromRoomCastLogs();

  showBattleResultScreen({ selfWon });
}





async function startBattleEndSequence() {
  if (battleState.endingStarted) return;

  battleState.endingStarted = true;
  battleState.gameEnded = true;

  const selfMember = getMemberBySide("self");
  const enemyMember = getMemberBySide("enemy");

  const selfWon = battleState.selfHp > 0 && battleState.enemyHp <= 0;

  const winnerMember = selfWon ? selfMember : enemyMember;
  const loserMember = selfWon ? enemyMember : selfMember;

  battleState.winnerId = winnerMember?.id || "";
  battleState.loserId = loserMember?.id || "";

  const actors = getViewerActors();
  const winnerActor = selfWon ? actors.self : actors.enemy;
  const loserActor = selfWon ? actors.enemy : actors.self;

  hideTutorialModal();

  // 操作UIを消す
  document.querySelector(".magic-circle-overlay")?.remove();
  document.querySelector(".magic-circle-controls.left")?.remove();
  document.querySelector(".magic-circle-controls.right")?.remove();
  document.querySelector(".chant-result-modal")?.remove();

  await moveCameraToWinnerFront(winnerActor, 1000);

showWinBanner(winnerMember?.name || "PLAYER");

await animateLoserFall(loserActor);

  await new Promise((resolve) => setTimeout(resolve, 2000));

  await orbitCameraAroundWinner(winnerActor);

  hideWinBanner();

await hydrateMagicLogsFromRoomCastLogs();

showBattleResultScreen({ selfWon });}






  setCameraForMatchup(userTrackingId, currentRoom?.members || [], fighterA, fighterB);
  //renderHpBars();
  /*setInterval(async () => {
    try {
      const r = await fetch(`/api/origin-magic-circle/casts/${encodeURIComponent(currentRoom?.roomId || "")}?since=${battleState.lastCastAt}`);
      const d = await r.json();
      for (const cast of d.casts || []) {
        battleState.lastCastAt = Math.max(battleState.lastCastAt, cast.at || 0);
        if (battleState.processedCastIds.has(cast.id) || cast.casterId === userTrackingId) continue;
        battleState.processedCastIds.add(cast.id);
        showMagicNameCenter(cast.magicEffectJson?.magicName, true, () => playMagicVisualEffects(cast.magicEffectJson, true));
      }
    } catch {}
  }, 1200);*/
//代わりにこれを入れるよ〜
const socket = getSocketIoClient();

if (socket) {
  socket.off("origin:cast");
  socket.on("origin:cast", (cast) => {
  if (!cast?.id) return;

  battleState.lastCastAt = Math.max(battleState.lastCastAt, Number(cast.at) || 0);

  if (battleState.processedCastIds.has(cast.id)) return;
  battleState.processedCastIds.add(cast.id);

  addMagicLogFromCast(cast);

  // HP0後に届いた魔法はログには残しても、演出は出さない
  if (battleState.gameEnded) return;

  // 自分が撃った魔法は、自分側ではすでに演出開始しているので再生しない
  if (cast.casterId === userTrackingId) return;

  playMagicCastWithName(cast.magicEffectJson, true).catch((error) => {
  console.warn("[origin-magic-circle] enemy magic flow failed:", error);
});
});

  socket.off("origin:hp");
  socket.on("origin:hp", (hpPayload) => {
    applyHpPayload(hpPayload);
  });


  socket.off("origin:room");
socket.on("origin:room", (room) => {
  if (!room?.roomId) return;
  if (currentRoom?.roomId && room.roomId !== currentRoom.roomId) return;

  currentRoom = room;
  applyRoomTurnState(room);
  applyHpPayload({
    selfHp: (room.members || []).find((member) => member.id === userTrackingId)?.hp,
    enemyHp: (room.members || []).find((member) => member.id !== userTrackingId)?.hp,
  });
});
}

  const onResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  magicCircleUi?.resizeOverlay();
};
  window.addEventListener("resize", onResize);





  let sceneDisposed = false;
let animationFrameId = null;

function disposeMaterial(material) {
  if (!material) return;

  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }

  if (material.map) material.map.dispose?.();
  if (material.normalMap) material.normalMap.dispose?.();
  if (material.emissiveMap) material.emissiveMap.dispose?.();
  material.dispose?.();
}

function disposeObject3D(root) {
  root.traverse?.((obj) => {
    if (obj.geometry) obj.geometry.dispose?.();
    if (obj.material) disposeMaterial(obj.material);
  });
}

battleSceneCleanup = () => {
  sceneDisposed = true;

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  window.removeEventListener("resize", onResize);

  activeMagicObjects.splice(0);
  activeMagicMixers.splice(0);
  summonAssetMixers.splice(0);

  disposeObject3D(scene);
  composer?.dispose?.();
  renderer?.dispose?.();

  renderer?.domElement?.remove();
};

//変更8
const animate = () => {
  if (sceneDisposed) return;

  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;

  summonAssetMixers.forEach((mixer) => {
    mixer.update(delta);
  });

  summonAssetRoots.forEach((root) => {
    updateCustomEffect(root, elapsed, delta);
  });

  activeMagicMixers.forEach((item) => {
    item.mixer.update(delta);
  });

  updateActiveMagicObjects(elapsed, delta);

  composer.render();
  animationFrameId = requestAnimationFrame(animate);
};


  animate();
}

refs.createRoomBtn?.addEventListener("click", async () => {
  if (!userTrackingId) {
    alert("ログイン情報が見つかりません。タイトルに戻って再ログインしてください。");
    return;
  }

  try {
    const room = await callApi("/api/origin-magic-circle/rooms/create", { username, userTrackingId }, "POST");
    saveActiveRoomId(room.roomId);
    showWaitingRoom(room);
    setMessage("ルームを作成しました。対戦相手の入室を待ってください。");
    startRefresh();
  } catch (error) {
    setMessage(`ルーム作成に失敗しました: ${error.message}`);
  }
});

refs.joinRoomBtn?.addEventListener("click", async () => {
  if (!userTrackingId) {
    alert("ログイン情報が見つかりません。タイトルに戻って再ログインしてください。");
    return;
  }
  const roomId = await showRoomIdModal();
  if (!roomId) return;
  
  
  
  if (roomId === "0") {
  isOriginDebugTestRoom = true;

  const room = createOriginDebugTestRoom();
  currentRoom = room;

  // テスト部屋は再読み込み復帰もできるように保存する
  //saveActiveRoomId("000000");

  showWaitingRoom(room);
  setMessage("テスト部屋に入室しました。対戦相手 bot を追加します。");

  await startThreeBattleScene();
  return;
}







  try {
    const room = await callApi("/api/origin-magic-circle/rooms/join", { roomId, username, userTrackingId }, "POST");
    saveActiveRoomId(room.roomId);
    showWaitingRoom(room);
    setMessage("ルームに入室しました。");
    startRefresh();
  } catch (error) {
    if (error.message === "room_full") {
      setMessage("このルームは満員です（最大2名）。");
      return;
    }
    setMessage(`入室に失敗しました: ${error.message}`);
  }
});

refs.deleteRoomBtn?.addEventListener("click", async () => {
  if (!currentRoom?.roomId) return;
  try {
    await callApi("/api/origin-magic-circle/rooms/delete", { roomId: currentRoom.roomId, userTrackingId }, "POST");
    stopRefresh();
    clearActiveRoomId();
    currentRoom = null;
    showHomePanel();
    refs.waitingRoom.classList.add("hidden");
    refs.waitingNote.classList.remove("hidden");
    setMessage("ルームを削除しました。");
  } catch (error) {
    setMessage(`ルーム削除に失敗しました: ${error.message}`);
  }
});

refs.leaveRoomBtn?.addEventListener("click", async () => {
  if (!currentRoom?.roomId) return;
  try {
    await callApi("/api/origin-magic-circle/rooms/leave", { roomId: currentRoom.roomId, userTrackingId }, "POST");
    stopRefresh();
    clearActiveRoomId();
    currentRoom = null;
    showHomePanel();
    refs.waitingRoom.classList.add("hidden");
    refs.waitingNote.classList.remove("hidden");
    setMessage("ルームを退出しました。");
  } catch (error) {
    setMessage(`ルーム退出に失敗しました: ${error.message}`);
  }
});

refs.startGameBtn?.addEventListener("click", async () => {
  if (!currentRoom?.roomId) return;

  refs.startGameBtn.disabled = true;

  try {
    const room = await callApi("/api/origin-magic-circle/rooms/start", {
      roomId: currentRoom.roomId,
      userTrackingId,
    }, "POST");

    currentRoom = room;
    saveActiveRoomId(room.roomId);
    showWaitingRoom(room);
    setMessage("対戦を開始します...");

    if (room.status === "対戦中") {
      await startThreeBattleScene();
      return;
    }

    startRefresh();
    await refreshRoom();
  } catch (error) {
    refs.startGameBtn.disabled = false;
    setMessage(`ゲーム開始に失敗しました: ${error.message}`);
  }
});

refs.backToTitleBtn?.addEventListener("click", () => {
  window.location.href = "/";
});

async function restoreActiveRoomIfExists() {
  const activeRoomId = localStorage.getItem(ACTIVE_ROOM_STORAGE_KEY);
if (activeRoomId === "000000") {
  isOriginDebugTestRoom = true;

  const room = createOriginDebugTestRoom();
  currentRoom = room;

  showWaitingRoom(room);
  setMessage("テスト部屋に再接続しました。");

  await startThreeBattleScene();
  return;
}

if (!activeRoomId) {
  try {
    const room = await callApi(
      `/api/origin-magic-circle/rooms/active?userTrackingId=${encodeURIComponent(userTrackingId)}`
    );

    if (room?.roomId) {
      saveActiveRoomId(room.roomId);
      currentRoom = room;
      showWaitingRoom(room);

      if (room.status === "loading" || room.status === "対戦中") {
        await startThreeBattleScene();
        return;
      }

      startRefresh();
      return;
    }
  } catch {
    // 進行中ルームがなければ普通にトップを表示
  }

  showHomePanel();
  refs.waitingRoom.classList.add("hidden");
  showNormalNote("");
  refs.waitingNote?.classList.add("hidden");
  return;
}

  setMessage("前回の待機部屋に再接続中...");
  try {
    const room = await callApi(`/api/origin-magic-circle/rooms/${encodeURIComponent(activeRoomId)}`);
    const joined = room.members?.some((member) => member.id === userTrackingId);

    if (!joined) {
      clearActiveRoomId();
      showHomePanel();
      refs.waitingRoom.classList.add("hidden");
      refs.waitingNote.classList.remove("hidden");
      setMessage("前回の待機部屋には再接続できませんでした。");
      return;
    }

    showWaitingRoom(room);
    if (room.status === "loading" || room.status === "対戦中") {
      await startThreeBattleScene();
      return;
    }

    startRefresh();
    setMessage(`ルーム ${room.roomId} に再接続しました。`);
  } catch (error) {
    clearActiveRoomId();
    showHomePanel();
    refs.waitingRoom.classList.add("hidden");
    refs.waitingNote.classList.remove("hidden");
    if (error.message === "room_not_found") {
      setMessage("前回の待機部屋は見つかりませんでした。");
      return;
    }
    setMessage("待機部屋の再接続に失敗しました。");
  }
}

restoreActiveRoomIfExists();
