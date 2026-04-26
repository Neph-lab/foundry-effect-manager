import { MODULE_ID } from "./constants.js";
import { localize } from "./helpers.js";
import { addEffectProxyFromDocument } from "./store.js";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
const ActiveEffectConfig = foundry.applications.sheets.ActiveEffectConfig;

export class RealEffectsBrowser extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "aem-real-effects-browser-{id}",
    classes: [MODULE_ID, "aem-real-effects-browser-app"],
    tag: "section",
    window: {
      contentClasses: ["standard-form"],
      icon: "fa-solid fa-list-tree",
      title: "AEM.RealEffectsBrowserTitle",
      resizable: true
    },
    position: {
      width: 760,
      height: 640
    },
    actions: {
      loadSelected: RealEffectsBrowser.#onLoadSelected,
      loadUuid: RealEffectsBrowser.#onLoadUuid,
      openEffect: RealEffectsBrowser.#onOpenEffect,
      deleteEffect: RealEffectsBrowser.#onDeleteEffect
    }
  };

  static PARTS = {
    content: {
      template: "modules/foundry-effect-manager/templates/real-effects-browser.hbs",
      root: true,
      scrollable: [".aem-real-effects-list"]
    }
  };

  constructor(options = {}) {
    super(options);
    this.documentUuid = "";
    this.targetDocument = null;
  }

  get title() {
    return localize("AEM.RealEffectsBrowserTitle");
  }

  _canRender() {
    if (!game.user.isGM) throw new Error(localize("AEM.RealEffectsGmOnly"));
  }

  async _prepareContext() {
    const effects = this.#getSortedEffects().map((effect) => ({
      id: effect.id,
      name: effect.name,
      img: effect.img,
      origin: effect.origin ?? "",
      originDisplay: effect.origin || localize("AEM.NoOrigin")
    }));

    return {
      canManage: game.user.isGM,
      documentUuid: this.documentUuid,
      targetLoaded: !!this.targetDocument,
      targetName: this.targetDocument?.name ?? "",
      targetType: this.targetDocument?.documentName ?? "",
      targetUuid: this.targetDocument?.uuid ?? "",
      hasEffects: effects.length > 0,
      effects
    };
  }

  async loadSelectedTokenActor() {
    if (!game.user.isGM) return;
    const actor = canvas.tokens?.controlled?.[0]?.actor ?? null;
    if (!actor) {
      ui.notifications.warn(localize("AEM.RealEffectsNoSelectedActor"));
      return;
    }

    await this.loadDocument(actor);
  }

  async loadUuidTarget(uuid) {
    if (!game.user.isGM) return;
    const trimmed = String(uuid ?? "").trim();
    if (!trimmed) {
      ui.notifications.warn(localize("AEM.RealEffectsUuidRequired"));
      return;
    }

    const document = await fromUuid(trimmed);
    const target = this.#resolveSupportedTarget(document);
    if (!target) {
      ui.notifications.warn(localize("AEM.RealEffectsInvalidTarget"));
      return;
    }

    await this.loadDocument(target);
  }

  async loadDocument(document) {
    const target = this.#resolveSupportedTarget(document);
    if (!target) {
      ui.notifications.warn(localize("AEM.RealEffectsInvalidTarget"));
      return;
    }

    this.targetDocument = target;
    this.documentUuid = target.uuid;
    await this.render({ force: true });
  }

  refreshForDocument(document) {
    if (!this.targetDocument?.uuid) return;
    if (document?.uuid !== this.targetDocument.uuid) return;
    this.targetDocument = document;
    this.render({ force: true });
  }

  #getSortedEffects() {
    if (!this.targetDocument?.effects) return [];
    return Array.from(this.targetDocument.effects.contents ?? this.targetDocument.effects)
      .sort((a, b) => {
        const originDelta = String(a.origin ?? "").localeCompare(String(b.origin ?? ""), game.i18n.lang);
        if (originDelta !== 0) return originDelta;
        return String(a.name ?? "").localeCompare(String(b.name ?? ""), game.i18n.lang);
      });
  }

  #getEffect(effectId) {
    return this.#getSortedEffects().find((effect) => effect.id === effectId) ?? null;
  }

  #resolveSupportedTarget(document) {
    if (!document) return null;
    if (["Actor", "Item"].includes(document.documentName)) return document;
    if (document.documentName === "Token") return document.actor ?? null;
    return null;
  }

  static async #onLoadSelected() {
    await this.loadSelectedTokenActor();
  }

  static async #onLoadUuid() {
    const input = this.element.querySelector("input[name='documentUuid']");
    await this.loadUuidTarget(input?.value ?? this.documentUuid);
  }

  static async #onOpenEffect(_event, target) {
    const effect = this.#getEffect(target.dataset.effectId);
    if (!effect) return;
    effect.sheet.render({ force: true });
  }

  static async #onDeleteEffect(_event, target) {
    const effect = this.#getEffect(target.dataset.effectId);
    if (!effect) return;

    const confirmed = await DialogV2.confirm({
      window: { title: localize("AEM.DeleteEffect") },
      content: `<p>${localize("AEM.DeleteEffectConfirm", { name: foundry.utils.escapeHTML(effect.name) })}</p>`
    });
    if (!confirmed) return;

    await effect.delete();
    await this.render({ force: true });
  }
}

export function openRealEffectsBrowser(options = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn(localize("AEM.RealEffectsGmOnly"));
    return null;
  }

  const app = new RealEffectsBrowser(options);
  app.render({ force: true });
  const useSelected = options.useSelected ?? true;
  if (useSelected && canvas.tokens?.controlled?.[0]?.actor) app.loadSelectedTokenActor();
  else if (options.uuid) app.loadUuidTarget(options.uuid);
  else if (options.document) app.loadDocument(options.document);
  return app;
}

export function registerRealEffectsHooks() {
  Hooks.on("renderApplicationV2", (app, element) => {
    if (!(app instanceof ActiveEffectConfig)) return;
    if (!game.user.isGM) return;
    if (!["Actor", "Item"].includes(app.document?.parent?.documentName)) return;
    injectCreateProxyButton(app, element);
  });

  for (const hookName of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
    Hooks.on(hookName, (effect) => {
      const parent = effect?.parent;
      if (!parent) return;
      for (const browser of RealEffectsBrowser.instances()) {
        browser.refreshForDocument(parent);
      }
    });
  }
}

function injectCreateProxyButton(app, element) {
  const footer = element.querySelector(".form-footer");
  if (!footer) return;
  if (footer.querySelector(".aem-create-proxy")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "aem-create-proxy";
  button.innerHTML = `<i class="fa-solid fa-copy" inert></i><span>${localize("AEM.CreateProxyFromEffect")}</span>`;
  button.addEventListener("click", async () => {
    const proxy = await addEffectProxyFromDocument(app.document);
    ui.notifications.info(localize("AEM.ProxyCreatedFromEffectNotice", { name: proxy.name }));
    Hooks.callAll(`${MODULE_ID}.refresh`);
  });
  footer.prepend(button);
}
