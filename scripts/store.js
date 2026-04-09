import { MODULE_ID, SETTINGS_KEYS, createDefaultEffect, mapLegacyChangeModeToType } from "./constants.js";

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS_KEYS.effects, {
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  game.settings.register(MODULE_ID, SETTINGS_KEYS.folders, {
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  game.settings.register(MODULE_ID, SETTINGS_KEYS.expandedFolders, {
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });
}

export function getEffects() {
  return (game.settings.get(MODULE_ID, SETTINGS_KEYS.effects) ?? []).map((effect) => normalizeStoredEffect(effect));
}

export function getFolders() {
  return foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS_KEYS.folders) ?? []);
}

export function getExpandedFolders() {
  return foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS_KEYS.expandedFolders) ?? {});
}

export async function setEffects(effects) {
  return game.settings.set(MODULE_ID, SETTINGS_KEYS.effects, effects.map((effect) => normalizeStoredEffect(effect)));
}

export async function setFolders(folders) {
  return game.settings.set(MODULE_ID, SETTINGS_KEYS.folders, folders);
}

export async function setExpandedFolders(expanded) {
  return game.settings.set(MODULE_ID, SETTINGS_KEYS.expandedFolders, expanded);
}

export async function migrateEffects() {
  const current = game.settings.get(MODULE_ID, SETTINGS_KEYS.effects) ?? [];
  const migrated = current.map((effect) => normalizeStoredEffect(effect));
  const changed = JSON.stringify(current) !== JSON.stringify(migrated);
  if ( changed ) await game.settings.set(MODULE_ID, SETTINGS_KEYS.effects, migrated);
}

function normalizeStoredEffect(effect) {
  if ( !effect ) return createDefaultEffect();

  const isCurrent = Array.isArray(effect?.system?.changes);
  if ( isCurrent ) {
    const normalized = createDefaultEffect(effect);
    normalized.statuses = Array.from(normalized.statuses ?? []);
    normalized.system ??= {};
    normalized.system.changes ??= [];
    normalized.duration ??= {};
    normalized.duration.value ??= null;
    normalized.duration.units ??= "seconds";
    normalized.duration.expiry ??= null;
    normalized.duration.expired ??= false;
    normalized.start ??= null;
    normalized.transfer ??= false;
    return normalized;
  }

  const legacyDuration = effect.duration ?? {};
  let durationValue = null;
  let durationUnits = "seconds";
  for ( const unit of CONST.ACTIVE_EFFECT_DURATION_UNITS ) {
    if ( Number.isFinite(legacyDuration[unit]) ) {
      durationValue = Number(legacyDuration[unit]);
      durationUnits = unit;
      break;
    }
  }

  return createDefaultEffect({
    _id: effect._id ?? effect.id ?? foundry.utils.randomID(),
    folder: effect.folder ?? null,
    sort: effect.sort ?? 0,
    name: effect.name,
    img: effect.img,
    type: effect.type,
    disabled: effect.disabled ?? false,
    start: null,
    duration: {
      value: durationValue,
      units: durationUnits,
      expiry: effect.duration?.expiry ?? null,
      expired: false
    },
    description: effect.description ?? "",
    origin: effect.origin || null,
    tint: effect.tint || "#ffffff",
    transfer: effect.transfer ?? false,
    statuses: Array.from(effect.statuses ?? []),
    showIcon: effect.showIcon,
    system: {
      changes: (effect.changes ?? []).map((change) => ({
        key: change.key ?? "",
        type: change.type ?? mapLegacyChangeModeToType(change.mode),
        value: change.value ?? "",
        priority: Number.isFinite(change.priority) ? change.priority : null
      }))
    },
    flags: foundry.utils.deepClone(effect.flags ?? {})
  });
}
