import { MODULE_ID, SETTINGS_KEYS } from "./constants.js";
import { createEffectProxy, normalizeStoredEffect } from "./effect-proxy.js";
import { nextSortValue } from "./helpers.js";

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

export async function addEffectProxyFromDocument(effect, { folderId = null } = {}) {
  const source = effect.toObject();
  delete source._id;
  delete source._stats;
  delete source.start;
  delete source.parent;

  const proxy = createEffectProxy({
    ...source,
    _id: foundry.utils.randomID(),
    folder: folderId,
    sort: 0,
    transfer: false
  }).toObject();

  const effects = getEffects();
  proxy.sort = nextSortValue(effects.filter((entry) => (entry.folder ?? null) === (folderId ?? null)));
  effects.push(proxy);
  await setEffects(effects);
  return proxy;
}
