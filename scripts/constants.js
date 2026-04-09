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

const LEGACY_CHANGE_MODE_TYPES = {
  0: "custom",
  1: "multiply",
  2: "add",
  3: "downgrade",
  4: "upgrade",
  5: "override"
};

export function createDefaultEffect(data = {}) {
  const defaultType = CONFIG.ActiveEffect?.defaultType ?? CONST.BASE_DOCUMENT_TYPE ?? "base";
  const documentClass = CONFIG.ActiveEffect?.documentClass;
  const baseSource = documentClass
    ? foundry.utils.deepClone(new documentClass({
      name: game.i18n.localize("AEM.CreateEffect"),
      img: DEFAULT_ICON,
      type: data.type ?? defaultType
    })._source)
    : {
      name: game.i18n.localize("AEM.CreateEffect"),
      img: DEFAULT_ICON,
      type: data.type ?? defaultType,
      system: { changes: [] },
      disabled: false,
      start: null,
      duration: { value: null, units: "seconds", expiry: null, expired: false },
      description: "",
      origin: null,
      tint: "#ffffff",
      transfer: false,
      statuses: [],
      showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON?.CONDITIONAL ?? 1,
      folder: null,
      sort: 0,
      flags: {}
    };

  return foundry.utils.mergeObject(baseSource, {
    _id: foundry.utils.randomID(),
    name: game.i18n.localize("AEM.CreateEffect"),
    img: DEFAULT_ICON,
    type: data.type ?? defaultType,
    system: {
      changes: []
    },
    disabled: false,
    start: null,
    duration: {
      value: null,
      units: "seconds",
      expiry: null,
      expired: false
    },
    description: "",
    origin: null,
    tint: "#ffffff",
    transfer: false,
    statuses: [],
    showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON?.CONDITIONAL ?? 1,
    folder: null,
    sort: 0,
    flags: {}
  }, data, { inplace: false, insertKeys: true, insertValues: true });
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

export function mapLegacyChangeModeToType(mode) {
  return LEGACY_CHANGE_MODE_TYPES[Number(mode)] ?? `custom.${Number(mode) || 0}`;
}

export const SORT_DENSITY = CONST.SORT_INTEGER_DENSITY ?? 100000;
