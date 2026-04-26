const DEFAULT_ICON = "icons/svg/aura.svg";

const { DataModel } = foundry.abstract;
const fields = foundry.data.fields;

export class ActiveEffectProxy extends DataModel {
  static defineSchema() {
    return {
      _id: new fields.StringField({
        required: true,
        blank: false,
        initial: foundry.utils.randomID
      }),
      name: new fields.StringField({
        required: true,
        blank: false,
        textSearch: true,
        initial: () => game.i18n.localize("AEM.CreateEffect")
      }),
      img: new fields.FilePathField({
        categories: ["IMAGE"],
        initial: DEFAULT_ICON
      }),
      type: new fields.StringField({
        required: true,
        blank: false,
        initial: () => CONFIG.ActiveEffect?.defaultType ?? CONST.BASE_DOCUMENT_TYPE ?? "base"
      }),
      description: new fields.HTMLField({ textSearch: true, initial: "" }),
      disabled: new fields.BooleanField({ initial: false }),
      origin: new fields.DocumentUUIDField({ relative: true, nullable: true, initial: null }),
      tint: new fields.ColorField({ nullable: false, initial: "#ffffff" }),
      statuses: new fields.SetField(new fields.StringField({ required: true, blank: false }), { initial: [] }),
      showIcon: new fields.NumberField({
        required: true,
        nullable: false,
        choices: Object.values(CONST.ACTIVE_EFFECT_SHOW_ICON),
        initial: CONST.ACTIVE_EFFECT_SHOW_ICON.CONDITIONAL
      }),
      duration: new fields.SchemaField({
        value: new fields.NumberField({ required: true, nullable: true, integer: true, min: 0, initial: null }),
        units: new fields.StringField({
          required: true,
          choices: CONST.ACTIVE_EFFECT_DURATION_UNITS,
          initial: "seconds"
        }),
        expiry: new fields.StringField({ required: true, blank: false, nullable: true, initial: null }),
        expired: new fields.BooleanField({ initial: false })
      }),
      system: new fields.SchemaField({
        changes: new fields.ArrayField(new fields.SchemaField({
          key: new fields.StringField({ required: true, initial: "" }),
          type: new fields.StringField({
            required: true,
            blank: false,
            initial: "add",
            validate: ActiveEffectProxy.#validateChangeType
          }),
          value: new fields.AnyField({ required: true, nullable: true, serializable: true, initial: "" }),
          phase: new fields.StringField({ required: true, blank: false, initial: "initial" }),
          priority: new fields.NumberField({ required: true, nullable: true, initial: null })
        }), { initial: [] })
      }),
      transfer: new fields.BooleanField({ initial: false }),
      folder: new fields.StringField({ required: true, nullable: true, initial: null }),
      sort: new fields.IntegerSortField(),
      flags: new fields.DocumentFlagsField()
    };
  }

  static #validateChangeType(type) {
    if (type.length < 3) throw new Error("must be at least three characters long");
    if (!/^custom\.-?\d+$/.test(type) && !type.split(".").every((segment) => /^[a-z0-9]+$/i.test(segment))) {
      throw new Error(
        "A change type must either be a sequence of dot-delimited, alpha-numeric substrings or of the form"
        + ' "custom.{number}"'
      );
    }
    return true;
  }
}

export function createEffectProxy(data = {}) {
  return new ActiveEffectProxy(data, { strict: false });
}

export function createDefaultEffect(data = {}) {
  return createEffectProxy(data).toObject();
}

export function getInitialChangeData() {
  return ActiveEffectProxy.schema.fields.system.fields.changes.element.getInitialValue();
}

export function normalizeStoredEffect(effect) {
  if (!effect) return createDefaultEffect();
  return createEffectProxy(migrateLegacyEffectSource(effect)).toObject();
}

function migrateLegacyEffectSource(effect) {
  if (Array.isArray(effect?.system?.changes)) {
    return foundry.utils.mergeObject(createDefaultEffect(), effect, {
      inplace: false,
      insertKeys: true,
      insertValues: true
    });
  }

  const legacyDuration = effect.duration ?? {};
  let durationValue = null;
  let durationUnits = "seconds";
  for (const unit of CONST.ACTIVE_EFFECT_DURATION_UNITS) {
    if (Number.isFinite(legacyDuration[unit])) {
      durationValue = Number(legacyDuration[unit]);
      durationUnits = unit;
      break;
    }
  }

  return {
    _id: effect._id ?? effect.id ?? foundry.utils.randomID(),
    name: effect.name,
    img: effect.img,
    type: effect.type,
    description: effect.description ?? "",
    disabled: effect.disabled ?? false,
    origin: effect.origin || null,
    tint: effect.tint || "#ffffff",
    statuses: Array.from(effect.statuses ?? []),
    showIcon: effect.showIcon ?? CONST.ACTIVE_EFFECT_SHOW_ICON.CONDITIONAL,
    duration: {
      value: durationValue,
      units: durationUnits,
      expiry: effect.duration?.expiry ?? null,
      expired: false
    },
    system: {
      changes: (effect.changes ?? []).map((change) => ({
        key: change.key ?? "",
        type: change.type ?? mapLegacyChangeModeToType(change.mode),
        value: change.value ?? "",
        phase: change.phase ?? "initial",
        priority: Number.isFinite(change.priority) ? change.priority : null
      }))
    },
    transfer: effect.transfer ?? false,
    folder: effect.folder ?? null,
    sort: effect.sort ?? 0,
    flags: foundry.utils.deepClone(effect.flags ?? {})
  };
}

function mapLegacyChangeModeToType(mode) {
  const legacyTypes = {
    0: "custom",
    1: "multiply",
    2: "add",
    3: "downgrade",
    4: "upgrade",
    5: "override"
  };
  return legacyTypes[Number(mode)] ?? `custom.${Number(mode) || 0}`;
}
