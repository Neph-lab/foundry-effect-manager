import { MODULE_ID } from "./constants.js";
import { createDefaultEffect, createEffectProxy, getInitialChangeData } from "./effect-proxy.js";
import { localize, nextSortValue } from "./helpers.js";
import { getEffects, setEffects } from "./store.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { FormDataExtended } = foundry.applications.ux;

export class ActiveEffectTemplateSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "aem-effect-sheet-{id}",
    tag: "form",
    classes: ["active-effect-config", MODULE_ID, "aem-sheet"],
    window: {
      contentClasses: ["standard-form"],
      icon: "fa-solid fa-person-rays",
      title: "AEM.EffectSheetTitle",
      resizable: true
    },
    position: {
      width: 560
    },
    form: {
      handler: ActiveEffectTemplateSheet.#onSubmitForm,
      closeOnSubmit: true
    },
    actions: {
      editImage: ActiveEffectTemplateSheet.#onEditImage,
      addChange: ActiveEffectTemplateSheet.#onAddChange,
      deleteChange: ActiveEffectTemplateSheet.#onDeleteChange
    }
  };

  static PARTS = {
    header: { template: "templates/sheets/active-effect/header.hbs" },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    details: {
      template: "modules/foundry-effect-manager/templates/effect-sheet-details.hbs",
      scrollable: [""]
    },
    duration: {
      template: "modules/foundry-effect-manager/templates/effect-sheet-duration.hbs"
    },
    changes: {
      template: "templates/sheets/active-effect/changes.hbs",
      templates: ["templates/sheets/active-effect/change.hbs"],
      scrollable: ["ol[data-changes]"]
    },
    footer: { template: "templates/generic/form-footer.hbs" }
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: "details", icon: "fa-solid fa-book" },
        { id: "duration", icon: "fa-solid fa-clock" },
        { id: "changes", icon: "fa-solid fa-gears" }
      ],
      initial: "details",
      labelPrefix: "EFFECT.TABS"
    }
  };

  constructor({ effectId = null, folderId = null } = {}) {
    const existing = effectId ? getEffects().find((effect) => effect._id === effectId) : null;
    const source = existing ?? createDefaultEffect({ folder: folderId ?? null });
    super();

    this.effectId = source._id ?? effectId ?? null;
    this.folderId = source.folder ?? folderId ?? null;
    this.effectSort = source.sort ?? 0;
    this.effect = createEffectProxy(source);
  }

  get title() {
    return localize("AEM.EffectSheetTitle");
  }

  async _prepareContext() {
    return {
      rootId: this.id,
      fields: this.effect.schema.fields,
      source: this.effect.toObject(),
      tabs: this.#prepareTabs(),
      editable: true
    };
  }

  async _preparePartContext(partId, context) {
    const partContext = await super._preparePartContext(partId, context);
    if (partId in partContext.tabs) partContext.tab = partContext.tabs[partId];

    if (partId === "footer") {
      partContext.buttons = [{
        type: "submit",
        icon: "fa-solid fa-floppy-disk",
        label: "AEM.Save"
      }];
    }
    if (partId === "tabs") {
      partContext.tabClasses = "top-tabs";
    }
    if (partId === "details") {
      partContext.statuses = Object.values(CONFIG.statusEffects).map((status) => ({
        value: status.id,
        label: game.i18n.localize(status.name)
      }));
      partContext.showIconOptions = Object.entries(CONST.ACTIVE_EFFECT_SHOW_ICON).map(([key, value]) => ({
        value,
        label: game.i18n.localize(`EFFECT.SHOW_ICON.${key.toLowerCase()}`)
      })).reverse();
    }
    if (partId === "duration") {
      const groups = {
        time: game.i18n.localize("EFFECT.DURATION.UNITS.GROUPS.time"),
        combat: game.i18n.localize("EFFECT.DURATION.UNITS.GROUPS.combat")
      };
      partContext.durationUnits = CONST.ACTIVE_EFFECT_DURATION_UNITS.map((value) => ({
        value,
        label: game.i18n.localize(`EFFECT.DURATION.UNITS.${value}`),
        group: CONST.ACTIVE_EFFECT_TIME_DURATION_UNITS.includes(value) ? groups.time : groups.combat
      }));
      partContext.expiryEvents = Object.entries(CONFIG.ActiveEffect.documentClass.EXPIRY_EVENTS)
        .map(([value, label]) => ({ value, label: game.i18n.localize(label) }))
        .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang))
        .reduce((events, entry) => {
          events[entry.value] = entry.label;
          return events;
        }, {});
    }
    if (partId === "changes") {
      const fields = this.effect.schema.fields.system.fields.changes.element.fields;
      const changeTypes = Object.entries(CONFIG.ActiveEffect.documentClass.CHANGE_TYPES)
        .map(([type, config]) => ({ type, label: game.i18n.localize(config.label) }))
        .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang))
        .reduce((types, entry) => {
          types[entry.type] = entry.label;
          return types;
        }, {});
      partContext.changes = await Promise.all(
        foundry.utils.deepClone(context.source.system?.changes ?? []).map((change, index) => {
          const defaultPriority = CONFIG.ActiveEffect.documentClass.CHANGE_TYPES[change.type]?.defaultPriority;
          return this._renderChange({ change, index, fields, defaultPriority, changeTypes });
        })
      );
    }
    return partContext;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const originInput = this.form?.querySelector("input[name='origin']");
    if (!originInput) return;

    originInput.addEventListener("dragover", (event) => {
      event.preventDefault();
      originInput.classList.add("aem-drop-highlight");
    });

    originInput.addEventListener("dragleave", () => {
      originInput.classList.remove("aem-drop-highlight");
    });

    originInput.addEventListener("drop", (event) => {
      event.preventDefault();
      originInput.classList.remove("aem-drop-highlight");
      const data = TextEditor.getDragEventData(event);
      const uuid = data?.uuid ?? data?.documentUuid ?? null;
      if (!uuid) return;
      originInput.value = uuid;
      originInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  async _processSubmitData(_event, _form, submitData, _options = {}) {
    const stored = this.#prepareSource(submitData);
    const effects = getEffects();
    const existingIndex = effects.findIndex((effect) => effect._id === stored._id);
    if (existingIndex >= 0) {
      effects[existingIndex] = stored;
    } else {
      stored.sort = nextSortValue(effects.filter((effect) => (effect.folder ?? null) === (stored.folder ?? null)));
      effects.push(stored);
      this.effectId = stored._id;
      this.effectSort = stored.sort;
    }

    this.folderId = stored.folder ?? null;
    this.effect = createEffectProxy(stored);
    await setEffects(effects);
    ui.notifications.info(localize("AEM.EffectSaved"));
    Hooks.callAll(`${MODULE_ID}.refresh`);
  }

  _processFormData(_event, _form, formData) {
    const submitData = foundry.utils.expandObject(formData.object);
    if (submitData.duration?.expiry === "") submitData.duration.expiry = null;

    const changes = submitData.system?.changes;
    if (foundry.utils.isPlainObject(changes)) {
      submitData.system.changes = Object.values(changes);
    } else if (!Array.isArray(changes)) {
      submitData.system ??= {};
      submitData.system.changes = [];
    }

    for (const change of submitData.system?.changes ?? []) {
      this._processChangeSubmission(change);
    }

    return submitData;
  }

  _processChangeSubmission(change) {
    change.phase ||= "initial";
    try {
      if (typeof change.value === "string" && change.value !== "") change.value = JSON.parse(change.value);
    } catch {}
  }

  async _renderChange(context) {
    const { change, index } = context;
    if (typeof change.value !== "string") change.value = JSON.stringify(change.value);
    Object.assign(change, ["key", "type", "value", "phase", "priority"].reduce((paths, fieldName) => {
      paths[`${fieldName}Path`] = `system.changes.${index}.${fieldName}`;
      return paths;
    }, {}));
    return CONFIG.ActiveEffect.documentClass.CHANGE_TYPES[change.type]?.render?.(context)
      ?? foundry.applications.handlebars.renderTemplate("templates/sheets/active-effect/change.hbs", context);
  }

  async _addChangeRow() {
    const source = this.#getTransientSource();
    source.system.changes.push(getInitialChangeData());
    this.effect = createEffectProxy(source);
    await this.render({ force: true });
  }

  async _deleteChangeRow(target) {
    const index = Number(target?.closest("li")?.dataset.index ?? -1);
    if (index < 0) return;
    const source = this.#getTransientSource();
    source.system.changes.splice(index, 1);
    this.effect = createEffectProxy(source);
    await this.render({ force: true });
  }

  #getTransientSource() {
    return this.#prepareSource(this.form ? this._processFormData(null, this.form, new FormDataExtended(this.form)) : {});
  }

  #prepareSource(submitData) {
    const source = this.effect.toObject();
    foundry.utils.mergeObject(source, foundry.utils.deepClone(submitData), {
      inplace: true,
      insertKeys: true,
      insertValues: true
    });
    source._id = this.effectId ?? source._id ?? foundry.utils.randomID();
    source.folder = this.folderId ?? source.folder ?? null;
    source.sort = this.effectSort ?? source.sort ?? 0;
    source.transfer = false;
    source.duration ??= {};
    source.duration.expired = false;
    source.system ??= {};
    source.system.changes = (source.system.changes ?? []).filter((change) => {
      return change.key || (change.value !== "") || Number.isFinite(change.priority);
    });
    return createEffectProxy(source).toObject();
  }

  #prepareTabs() {
    const config = this.constructor.TABS.sheet;
    return {
      details: { ...config.tabs[0], group: "sheet", active: this.tabGroups.sheet === "details" },
      duration: { ...config.tabs[1], group: "sheet", active: this.tabGroups.sheet === "duration" },
      changes: { ...config.tabs[2], group: "sheet", active: this.tabGroups.sheet === "changes" }
    };
  }

  static async #onSubmitForm(event, form, formData) {
    const submitData = this._processFormData(event, form, formData);
    await this._processSubmitData(event, form, submitData);
  }

  static async #onEditImage(_event, target) {
    if (target.nodeName !== "IMG") throw new Error("The editImage action is available only for IMG elements.");
    const current = target.getAttribute("src");
    const picker = new foundry.applications.apps.FilePicker.implementation({
      current,
      type: "image",
      callback: (path) => {
        target.src = path;
        target.dispatchEvent(new Event("change", { bubbles: true }));
      },
      position: {
        top: this.position.top + 40,
        left: this.position.left + 10
      }
    });
    await picker.browse();
  }

  static async #onAddChange() {
    return this._addChangeRow();
  }

  static async #onDeleteChange(_event, target) {
    return this._deleteChangeRow(target);
  }
}
