import { MODULE_ID, createDefaultEffect } from "./constants.js";
import { localize, nextSortValue } from "./helpers.js";
import { getEffects, setEffects } from "./store.js";

const { ActiveEffectConfig } = foundry.applications.sheets;
const { FormDataExtended } = foundry.applications.ux;

export class ActiveEffectTemplateSheet extends ActiveEffectConfig {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: [...super.DEFAULT_OPTIONS.classes, MODULE_ID, "aem-sheet"],
    window: {
      title: "AEM.EffectSheetTitle"
    },
    actions: {
      addChange: ActiveEffectTemplateSheet.#onAddChange,
      deleteChange: ActiveEffectTemplateSheet.#onDeleteChange
    },
    sheetConfig: false,
    ownershipConfig: false,
    position: {
      width: 560,
      height: 760
    }
  }, { inplace: false });

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

  constructor({ effectId = null, folderId = null } = {}) {
    const existing = effectId ? getEffects().find((effect) => effect._id === effectId) : null;
    const source = createDefaultEffect(existing ?? { folder: folderId ?? null });
    const temporarySource = foundry.utils.deepClone(source);
    delete temporarySource._id;

    super({
      document: new CONFIG.ActiveEffect.documentClass(temporarySource),
      sheetConfig: false,
      ownershipConfig: false,
      canCreate: false
    });

    this.effectId = existing?._id ?? effectId ?? null;
    this.folderId = existing?.folder ?? folderId ?? null;
    this.effectSort = existing?.sort ?? 0;
  }

  get title() {
    return localize("AEM.EffectSheetTitle");
  }

  async _preparePartContext(partId, context) {
    const partContext = await super._preparePartContext(partId, context);
    if ( partId === "footer" ) {
      partContext.buttons = [{
        type: "submit",
        icon: "fa-solid fa-floppy-disk",
        label: "AEM.Save"
      }];
    }
    return partContext;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const originInput = this.form?.querySelector("input[name='origin']");
    if ( !originInput ) return;

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
      if ( !uuid ) return;
      originInput.value = uuid;
      originInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  async _processSubmitData(event, form, submitData, options = {}) {
    const source = this.#prepareSource(submitData);
    this.document.updateSource(source);
    return source;
  }

  async _updateObject(_event, submitData) {
    const stored = foundry.utils.deepClone(this.document._source);
    stored._id = this.effectId ?? foundry.utils.randomID();
    stored.folder = this.folderId;

    const effects = getEffects();
    const existingIndex = effects.findIndex((effect) => effect._id === stored._id);
    if ( existingIndex >= 0 ) {
      effects[existingIndex] = stored;
    } else {
      stored.sort = nextSortValue(effects.filter((effect) => (effect.folder ?? null) === (stored.folder ?? null)));
      effects.push(stored);
      this.effectId = stored._id;
      this.effectSort = stored.sort;
    }

    await setEffects(effects);
    ui.notifications.info(localize("AEM.EffectSaved"));
    Hooks.callAll(`${MODULE_ID}.refresh`);
  }

  async _addChangeRow() {
    const source = this.#getTransientSource();
    source.system.changes.push(this.document.system.schema.fields.changes.element.getInitialValue());
    this.document.updateSource(source);
    await this.render({ force: true });
  }

  async _deleteChangeRow(target) {
    const index = Number(target?.closest("li")?.dataset.index ?? -1);
    if ( index < 0 ) return;
    const source = this.#getTransientSource();
    source.system.changes.splice(index, 1);
    this.document.updateSource(source);
    await this.render({ force: true });
  }

  #getTransientSource() {
    const source = foundry.utils.deepClone(this.document._source);
    const form = this.form;
    if ( !form ) {
      source.system.changes ??= [];
      return source;
    }

    const formData = new FormDataExtended(form);
    const submitData = this._processFormData(null, form, formData);
    const prepared = this.#prepareSource(submitData);
    return foundry.utils.mergeObject(source, prepared, { inplace: false, insertKeys: true, insertValues: true });
  }

  #prepareSource(submitData) {
    const source = foundry.utils.deepClone(submitData);
    source.system ??= {};
    source.system.changes = foundry.utils.isPlainObject(source.system.changes)
      ? Object.values(source.system.changes)
      : Array.isArray(source.system.changes)
        ? source.system.changes
        : [];

    source.system.changes = source.system.changes.filter((change) => {
      return change.key || (change.value !== "") || Number.isFinite(change.priority);
    });

    source.statuses = Array.from(source.statuses ?? []);
    source.origin ||= null;
    source.duration ??= {};
    source.duration.value ??= null;
    source.duration.units ??= "seconds";
    source.duration.expiry ??= null;
    source.duration.expired = false;
    source.start = null;
    source.transfer = false;
    source.folder = this.folderId;
    source.sort = this.effectSort;
    const prepared = createDefaultEffect(source);
    delete prepared._id;
    return prepared;
  }

  static async #onAddChange() {
    return this._addChangeRow();
  }

  static async #onDeleteChange(_event, target) {
    return this._deleteChangeRow(target);
  }
}

