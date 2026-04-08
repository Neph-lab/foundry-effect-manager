import { MODULE_ID, createDefaultEffect } from "./constants.js";
import { getEffects, setEffects } from "./store.js";
import {
  getActiveEffectModeOptions,
  getActiveEffectPhaseOptions,
  getActiveEffectTypeOptions,
  getShowIconOptions,
  localize,
  nextSortValue,
  normalizeStatuses,
  numericOrNull,
  stringOrEmpty
} from "./helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ActiveEffectTemplateSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: [MODULE_ID, "aem-sheet"],
    tag: "section",
    window: {
      title: "AEM.EffectSheetTitle",
      resizable: true
    },
    position: {
      width: 720,
      height: 760
    }
  });

  static PARTS = {
    body: {
      template: "modules/foundry-effect-manager/templates/effect-sheet.hbs"
    }
  };

  constructor({ effectId = null, folderId = null } = {}) {
    super();
    this.effectId = effectId;
    this.folderId = folderId;
    this.effect = createDefaultEffect();
  }

  #createBlankChange() {
    return {
      key: "",
      mode: CONST.ACTIVE_EFFECT_MODES.ADD ?? 2,
      value: "",
      priority: null,
      phase: ""
    };
  }

  #withDisplayChanges(effect) {
    return {
      ...effect,
      changes: effect.changes?.length ? effect.changes : [this.#createBlankChange()]
    };
  }

  async _prepareContext() {
    const existing = this.effectId ? getEffects().find((effect) => effect.id === this.effectId) : null;
    this.effect = this.#withDisplayChanges(createDefaultEffect(existing ?? { folder: this.folderId }));

    const markSelected = (options, current) => options.map((option) => ({
      ...option,
      selected: option.value === current
    }));

    const modeOptions = getActiveEffectModeOptions();
    const phaseOptions = [{ value: "", label: "", selected: false }, ...getActiveEffectPhaseOptions()];

    return {
      effect: {
        ...this.effect,
        statusesText: (this.effect.statuses ?? []).join(", "),
        changes: (this.effect.changes ?? []).map((change) => ({
          ...change,
          modeOptions: markSelected(modeOptions, change.mode),
          phaseOptions: markSelected(phaseOptions, change.phase ?? "")
        }))
      },
      typeOptions: markSelected(getActiveEffectTypeOptions(), this.effect.type),
      showIconOptions: markSelected(getShowIconOptions(), this.effect.showIcon)
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const element = this.element;
    const form = element.querySelector("form");
    if (!form) return;

    form.addEventListener("submit", this.#onSubmit.bind(this));
    element.querySelector("[data-action='add-change']")?.addEventListener("click", this.#onAddChange.bind(this));
    for (const button of element.querySelectorAll("[data-action='remove-change']")) {
      button.addEventListener("click", this.#onRemoveChange.bind(this));
    }
  }

  async #onSubmit(event) {
    event.preventDefault();

    const effects = getEffects();
    const existing = effects.find((effect) => effect.id === this.effectId);
    const updated = this.#collectEffectData(event.currentTarget);

    if (existing) {
      const index = effects.findIndex((effect) => effect.id === existing.id);
      effects[index] = updated;
    } else {
      const siblings = effects.filter((effect) => (effect.folder ?? null) === (updated.folder ?? null));
      updated.sort = nextSortValue(siblings);
      effects.push(updated);
      this.effectId = updated.id;
    }

    await setEffects(effects);
    ui.notifications.info(localize("AEM.EffectSaved"));
    Hooks.callAll(`${MODULE_ID}.refresh`);
    await this.close();
  }

  async #onAddChange(event) {
    event.preventDefault();
    const form = this.element.querySelector("form");
    const effect = this.#collectEffectData(form);
    effect.changes.push(this.#createBlankChange());
    this.effect = this.#withDisplayChanges(effect);
    await this.render({ force: true });
  }

  async #onRemoveChange(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index);
    const form = this.element.querySelector("form");
    const effect = this.#collectEffectData(form);
    effect.changes.splice(index, 1);
    this.effect = this.#withDisplayChanges(effect);
    await this.render({ force: true });
  }

  #collectEffectData(form) {
    const rows = [...form.querySelectorAll(".aem-change-row")].map((row) => ({
      key: stringOrEmpty(row.querySelector("[name='change-key']")?.value),
      mode: Number(row.querySelector("[name='change-mode']")?.value ?? 0),
      value: row.querySelector("[name='change-value']")?.value ?? "",
      priority: numericOrNull(row.querySelector("[name='change-priority']")?.value),
      phase: stringOrEmpty(row.querySelector("[name='change-phase']")?.value)
    }));

    return createDefaultEffect({
      id: this.effectId ?? foundry.utils.randomID(),
      folder: form.querySelector("[name='folder']")?.value || null,
      sort: this.effect.sort ?? 0,
      name: stringOrEmpty(form.querySelector("[name='name']")?.value),
      img: stringOrEmpty(form.querySelector("[name='img']")?.value),
      description: form.querySelector("[name='description']")?.value ?? "",
      origin: stringOrEmpty(form.querySelector("[name='origin']")?.value),
      tint: stringOrEmpty(form.querySelector("[name='tint']")?.value),
      disabled: form.querySelector("[name='disabled']")?.checked ?? false,
      transfer: form.querySelector("[name='transfer']")?.checked ?? false,
      statuses: normalizeStatuses(form.querySelector("[name='statuses']")?.value),
      type: stringOrEmpty(form.querySelector("[name='type']")?.value),
      showIcon: Number(form.querySelector("[name='showIcon']")?.value ?? 1),
      duration: {
        seconds: numericOrNull(form.querySelector("[name='duration.seconds']")?.value),
        rounds: numericOrNull(form.querySelector("[name='duration.rounds']")?.value),
        turns: numericOrNull(form.querySelector("[name='duration.turns']")?.value)
      },
      start: {
        time: numericOrNull(form.querySelector("[name='start.time']")?.value),
        round: numericOrNull(form.querySelector("[name='start.round']")?.value),
        turn: numericOrNull(form.querySelector("[name='start.turn']")?.value)
      },
      changes: rows.filter((row) => row.key || row.value || row.phase || Number.isFinite(row.priority))
    });
  }
}
