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

const DEFAULT_ICON = "icons/svg/aura.svg";

export function createDefaultEffect(data = {}) {
  const typeLabels = CONFIG.ActiveEffect?.typeLabels ?? {};
  const defaultType = CONFIG.ActiveEffect?.defaultType ?? Object.keys(typeLabels)[0] ?? "base";

  return foundry.utils.mergeObject(
    {
      id: foundry.utils.randomID(),
      folder: null,
      sort: 0,
      name: game.i18n.localize("AEM.CreateEffect"),
      img: DEFAULT_ICON,
      description: "",
      origin: "",
      tint: "",
      disabled: false,
      transfer: false,
      statuses: [],
      type: defaultType,
      showIcon: 1,
      duration: {
        seconds: null,
        rounds: null,
        turns: null
      },
      start: {
        time: null,
        round: null,
        turn: null
      },
      changes: [],
      flags: {}
    },
    data,
    { inplace: false, insertKeys: true, insertValues: true }
  );
}

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