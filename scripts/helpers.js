import { MODULE_ID, SORT_DENSITY } from "./constants.js";
import { createEffectProxy } from "./effect-proxy.js";

export function localize(key, data) {
  return data ? game.i18n.format(key, data) : game.i18n.localize(key);
}

export function canManageActiveEffects(user = game.user) {
  return !!user && (user.isGM || user.hasRole?.(CONST.USER_ROLES.ASSISTANT));
}

export function titleCase(value) {
  return String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function numericOrNull(value) {
  if ((value === "") || (value === null) || (value === undefined)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function stringOrEmpty(value) {
  return String(value ?? "").trim();
}

export function sortByOrder(items) {
  return [...items].sort((a, b) => {
    const sortDelta = (a.sort ?? 0) - (b.sort ?? 0);
    if (sortDelta !== 0) return sortDelta;
    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });
}

export function sortAlphabetically(items) {
  return [...items].sort((a, b) => {
    const nameDelta = String(a.name ?? "").localeCompare(String(b.name ?? ""));
    if (nameDelta !== 0) return nameDelta;
    return (a.sort ?? 0) - (b.sort ?? 0);
  });
}

export function nextSortValue(items) {
  if (!items.length) return SORT_DENSITY;
  return Math.max(...items.map((item) => item.sort ?? 0)) + SORT_DENSITY;
}

export function buildTree({ folders, effects, expandedFolders, search = "", searchMode = "name", sortMode = "manual" }) {
  const query = search.trim().toLowerCase();
  const sorter = sortMode === "alpha" ? sortAlphabetically : sortByOrder;
  const foldersByParent = new Map();
  const effectsByFolder = new Map();

  for (const folder of folders) {
    const parentId = folder.folder ?? "root";
    const siblings = foldersByParent.get(parentId) ?? [];
    siblings.push(folder);
    foldersByParent.set(parentId, siblings);
  }

  for (const effect of effects) {
    const folderId = effect.folder ?? "root";
    const siblings = effectsByFolder.get(folderId) ?? [];
    siblings.push(effect);
    effectsByFolder.set(folderId, siblings);
  }

  const effectMatches = (effect) => {
    if (!query) return true;
    const fields = searchMode === "full"
      ? [
        effect.name,
        effect.description,
        effect.origin,
        effect.system?.changes?.map((change) => `${change.key} ${change.value}`).join(" ")
      ]
      : [effect.name];

    return fields
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  };

  const buildFolderNode = (folder, depth = 0) => {
    const childFolders = sorter(foldersByParent.get(folder.id) ?? [])
      .map((child) => buildFolderNode(child, depth + 1))
      .filter(Boolean);

    const childEffects = sorter(effectsByFolder.get(folder.id) ?? [])
      .filter((effect) => effectMatches(effect))
      .map((effect) => ({
        ...effect,
        id: effect._id,
        depth: depth + 1
      }));

    const folderMatches = !query || String(folder.name ?? "").toLowerCase().includes(query);
    if (!folderMatches && !childFolders.length && !childEffects.length) return null;

    return {
      ...folder,
      depth,
      expanded: query ? true : (expandedFolders[folder.id] ?? true),
      folders: childFolders,
      effects: childEffects
    };
  };

  const rootFolders = sorter(foldersByParent.get("root") ?? [])
    .map((folder) => buildFolderNode(folder, 0))
    .filter(Boolean);

  const rootEffects = sorter(effectsByFolder.get("root") ?? [])
    .filter((effect) => effectMatches(effect))
    .map((effect) => ({
      ...effect,
      id: effect._id,
      depth: 0
    }));

  return {
    rootFolders,
    rootEffects
  };
}

export function collectFolderIds(folderId, folders) {
  const childrenByParent = new Map();
  for (const folder of folders) {
    const siblings = childrenByParent.get(folder.folder ?? null) ?? [];
    siblings.push(folder.id);
    childrenByParent.set(folder.folder ?? null, siblings);
  }

  const collected = new Set([folderId]);
  const queue = [folderId];
  while (queue.length) {
    const current = queue.shift();
    for (const childId of childrenByParent.get(current) ?? []) {
      if (collected.has(childId)) continue;
      collected.add(childId);
      queue.push(childId);
    }
  }
  return collected;
}

export function isFolderDescendant(folderId, potentialParentId, folders) {
  if (!potentialParentId) return false;
  return collectFolderIds(folderId, folders).has(potentialParentId);
}

export function applySortUpdate(records, updates) {
  for (const { target, update } of updates) {
    const record = records.find((entry) => entry._id === target._id);
    if (record) record.sort = update.sort;
  }
}

export function sortRecord(records, source, siblings, target, { sortBefore = false } = {}) {
  const updates = foundry.utils.performIntegerSort(source, {
    target,
    siblings,
    sortBefore,
    sortKey: "sort"
  });
  applySortUpdate(records, updates);
}

export function sanitizeEffectForApply(effect) {
  const proxy = createEffectProxy(effect);
  const prepared = proxy.toObject();
  delete prepared._id;
  delete prepared.folder;
  delete prepared.sort;
  delete prepared.start;
  prepared.start = null;
  prepared.duration = foundry.utils.mergeObject(prepared.duration ?? {}, { expired: false }, { inplace: false });
  prepared.transfer = false;
  prepared.flags = foundry.utils.mergeObject(prepared.flags ?? {}, {
    [MODULE_ID]: {
      sourceEffectId: proxy._id,
      sourceEffectName: proxy.name
    }
  }, { inplace: false });
  return new CONFIG.ActiveEffect.documentClass(prepared, { strict: false }).toObject();
}

export function getActiveEffectChangeTypeOptions() {
  const documentClass = CONFIG.ActiveEffect?.documentClass;
  return Object.entries(documentClass?.CHANGE_TYPES ?? {})
    .map(([value, config]) => ({ value, label: game.i18n.localize(config.label ?? titleCase(value)) }))
    .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
}

export function getShowIconOptions() {
  return Object.entries(CONST.ACTIVE_EFFECT_SHOW_ICON ?? {}).map(([key, value]) => ({
    value,
    label: localize(`EFFECT.SHOW_ICON.${key.toLowerCase()}`)
  })).reverse();
}
