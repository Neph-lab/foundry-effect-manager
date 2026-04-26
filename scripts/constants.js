export const MODULE_ID = "foundry-effect-manager";
export const TAB_NAME = "activeEffects";
export const DRAG_TYPE = `${MODULE_ID}.effect`;
export const INTERNAL_EFFECT_DRAG_TYPE = `${MODULE_ID}.effect-record`;
export const INTERNAL_FOLDER_DRAG_TYPE = `${MODULE_ID}.folder-record`;
export const SETTINGS_KEYS = {
  effects: "effects",
  folders: "folders",
  expandedFolders: "expandedFolders"
};

export function createDefaultFolder(data = {}) {
  return foundry.utils.mergeObject(
    {
      id: foundry.utils.randomID(),
      folder: null,
      sort: 0,
      name: game.i18n.localize("AEM.CreateFolder"),
      color: "#3a6ea5"
    },
    data,
    { inplace: false, insertKeys: true, insertValues: true }
  );
}

export const SORT_DENSITY = CONST.SORT_INTEGER_DENSITY ?? 100000;
