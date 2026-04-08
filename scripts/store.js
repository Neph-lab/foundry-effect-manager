import { MODULE_ID, SETTINGS_KEYS } from "./constants.js";

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
  return foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS_KEYS.effects) ?? []);
}

export function getFolders() {
  return foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS_KEYS.folders) ?? []);
}

export function getExpandedFolders() {
  return foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS_KEYS.expandedFolders) ?? {});
}

export async function setEffects(effects) {
  return game.settings.set(MODULE_ID, SETTINGS_KEYS.effects, effects);
}

export async function setFolders(folders) {
  return game.settings.set(MODULE_ID, SETTINGS_KEYS.folders, folders);
}

export async function setExpandedFolders(expanded) {
  return game.settings.set(MODULE_ID, SETTINGS_KEYS.expandedFolders, expanded);
}