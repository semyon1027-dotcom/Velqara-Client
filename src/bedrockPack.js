import { strToU8, zipSync } from 'fflate';

const BEHAVIOR_UUID = 'b2e0e6f2-9ec1-4f3c-baa8-2d2d2b6db001';
const RESOURCE_UUID = 'b2e0e6f2-9ec1-4f3c-baa8-2d2d2b6db002';

const json = (value) => JSON.stringify(value, null, 2);

function behaviorManifest() {
  return json({
    format_version: 2,
    header: {
      name: 'Velqara Client Behavior',
      description: 'Velqara visual modules for local Bedrock worlds',
      uuid: BEHAVIOR_UUID,
      version: [1, 0, 0],
      min_engine_version: [1, 26, 60],
    },
    modules: [
      { type: 'data', uuid: 'b2e0e6f2-9ec1-4f3c-baa8-2d2d2b6db003', version: [1, 0, 0] },
      {
        type: 'script',
        language: 'javascript',
        uuid: 'b2e0e6f2-9ec1-4f3c-baa8-2d2d2b6db004',
        version: [1, 0, 0],
        entry: 'scripts/main.js',
      },
    ],
    dependencies: [{ module_name: '@minecraft/server', version: '1.16.0' }],
  });
}

function resourceManifest() {
  return json({
    format_version: 2,
    header: {
      name: 'Velqara Client Resources',
      description: 'Velqara fog and HUD resources',
      uuid: RESOURCE_UUID,
      version: [1, 0, 0],
      min_engine_version: [1, 26, 60],
    },
    modules: [{ type: 'resources', uuid: 'b2e0e6f2-9ec1-4f3c-baa8-2d2d2b6db005', version: [1, 0, 0] }],
    dependencies: [{ uuid: BEHAVIOR_UUID, version: [1, 0, 0] }],
  });
}

function settingsJson(config) {
  return json({
    version: 1,
    generatedBy: 'Velqara Client',
    enabled: config.enabled,
    accent: config.accent,
    limits: { esp: 32, tnt: 48, waypoint: 256 },
  });
}

function mainScript(config) {
  const flags = JSON.stringify({
    fulbright: !!config.enabled.Fulbright,
    hitParticles: !!config.enabled['Hit particles'],
    hitSounds: !!config.enabled['Hit sounds'],
    killSounds: !!config.enabled['Kill sounds'],
    jumpCircle: !!config.enabled['Jump circle'],
    tntTimer: !!config.enabled['TNT timer'],
    potionHud: !!config.enabled['Potion HUD'],
    deathPosition: !!config.enabled['Death position'],
    waypoints: !!config.enabled.Waypoints,
  });
  return `import { world, system } from '@minecraft/server';

const FLAGS = ${flags};
const ACCENT = '${config.accent || '#A855F7'}';
const TNT_LIFETIME = 80;
const lastY = new Map();
const lastDeath = new Map();
const tntSeen = new Map();

function tell(player, message) {
  try { player.onScreenDisplay.setActionBar(message); } catch (_) {}
}

function particle(dimension, id, location) {
  try { dimension.spawnParticle(id, location); } catch (_) {}
}

function sound(dimension, id, location, volume = 0.8, pitch = 1) {
  try { dimension.playSound(id, location, { volume, pitch }); } catch (_) {}
}

function ring(dimension, location) {
  const r = 0.75;
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI * 2 * i) / 16;
    particle(dimension, 'minecraft:basic_flame_particle', {
      x: location.x + Math.cos(a) * r,
      y: location.y + 0.03,
      z: location.z + Math.sin(a) * r,
    });
  }
}

function nearestPrimedTnt(player) {
  let closest = null;
  let distance = 48;
  try {
    for (const entity of player.dimension.getEntities({ type: 'minecraft:tnt', location: player.location, maxDistance: 48 })) {
      const dx = entity.location.x - player.location.x;
      const dy = entity.location.y - player.location.y;
      const dz = entity.location.z - player.location.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < distance) { closest = entity; distance = d; }
    }
  } catch (_) {}
  return closest;
}

world.afterEvents.entityHurt.subscribe((event) => {
  if (!FLAGS.hitParticles && !FLAGS.hitSounds) return;
  const victim = event.hurtEntity;
  if (!victim) return;
  if (FLAGS.hitParticles) particle(victim.dimension, 'minecraft:critical_hit_emitter', victim.location);
  if (FLAGS.hitSounds) sound(victim.dimension, 'random.orb', victim.location, 0.65, 1.35);
});

world.afterEvents.entityDie.subscribe((event) => {
  if (!FLAGS.killSounds) return;
  const dead = event.deadEntity;
  if (dead) sound(dead.dimension, 'random.levelup', dead.location, 0.8, 1.1);
});

system.runInterval(() => {
  for (const player of world.getPlayers()) {
    const previousY = lastY.get(player.id);
    const velocityY = previousY == null ? 0 : player.location.y - previousY;
    lastY.set(player.id, player.location.y);

    if (FLAGS.fulbright) {
      try { player.addEffect('night_vision', 260, { amplifier: 0, showParticles: false }); } catch (_) {}
    }
    if (FLAGS.jumpCircle && velocityY > 0.18) ring(player.dimension, player.location);

    const lines = [];
    if (FLAGS.potionHud) {
      try {
        const effects = player.getEffects();
        if (effects.length) lines.push(effects.map((e) => e.typeId.replace('minecraft:', '')).join('  '));
      } catch (_) {}
    }
    if (FLAGS.tntTimer) {
      const tnt = nearestPrimedTnt(player);
      if (tnt) {
        const seenAt = tntSeen.get(tnt.id) || system.currentTick;
        tntSeen.set(tnt.id, seenAt);
        const seconds = Math.max(0, (TNT_LIFETIME - (system.currentTick - seenAt)) / 20).toFixed(1);
        lines.push('TNT  ' + seconds + 's');
      }
    }
    if (FLAGS.deathPosition) {
      const death = lastDeath.get(player.id);
      if (death) lines.push('Death  ' + death.x + ' ' + death.y + ' ' + death.z);
    }
    if (FLAGS.waypoints) lines.push('Velqara  •  local world mode');
    if (lines.length) tell(player, lines.join('  |  '));
  }
}, 5);

world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn && FLAGS.deathPosition) {
    try { lastDeath.set(event.player.id, { x: Math.floor(event.player.location.x), y: Math.floor(event.player.location.y), z: Math.floor(event.player.location.z) }); } catch (_) {}
  }
});

world.afterEvents.playerLeave.subscribe((event) => lastY.delete(event.playerId));
`;
}

function fogJson() {
  return json({
    format_version: '1.16.0',
    'minecraft:fog_settings': {
      description: { identifier: 'velqara:soft_fog' },
      distance: {
        air: { fog_start: 0.8, fog_end: 96, fog_color: '#10131F' },
        weather: { fog_start: 0.4, fog_end: 64, fog_color: '#24253D' },
      },
    },
  });
}

function mcpack(files) {
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, body]) => [name, strToU8(body)])));
}

export function buildVelqaraMcaddon(config) {
  const behavior = mcpack({
    'manifest.json': behaviorManifest(),
    'scripts/main.js': mainScript(config),
    'velqara-settings.json': settingsJson(config),
  });
  const resources = mcpack({
    'manifest.json': resourceManifest(),
    'fogs/velqara_fog.json': fogJson(),
  });
  return zipSync({
    'Velqara_Behavior.mcpack': behavior,
    'Velqara_Resources.mcpack': resources,
  });
}

export function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return globalThis.btoa(binary);
}
