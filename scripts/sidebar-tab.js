import {
  DRAG_TYPE,
  INTERNAL_FOLDER_DRAG_TYPE,
  MODULE_ID,
  TAB_NAME,
  createDefaultFolder
} from "./constants.js";
import { ActiveEffectTemplateSheet } from "./effect-sheet.js";
import { getEffects, getExpandedFolders, getFolders, setEffects, setExpandedFolders, setFolders } from "./store.js";
import {
  isFolderDescendant,
  localize,
  nextSortValue,
  sortByOrder,
  sortRecord,
  buildTree
} from "./helpers.js";

const { HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const { AbstractSidebarTab } = foundry.applications.sidebar;

export class ActiveEffectsSidebarTab extends HandlebarsApplicationMixin(AbstractSidebarTab) {
  static tabName = TAB_NAME;

  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: [MODULE_ID, "aem-sidebar", "directory", "flexcol"],
    window: {
      icon: "fa-solid fa-wand-magic-sparkles",
      title: "AEM.SidebarTitle"
    }
  });

  static PARTS = {
    content: {
      template: "modules/foundry-effect-manager/templates/sidebar.hbs",
      root: true,
      scrollable: [".aem-directory"]
    }
  };

  constructor(options = {}) {
    super(options);
    this.search = "";
  }

  get title() {
    return localize("AEM.SidebarTitle");
  }

  async _prepareContext() {
    const tree = buildTree({
      folders: getFolders(),
      effects: getEffects(),
      expandedFolders: getExpandedFolders(),
      search: this.search
    });

    return {
      active: this.active,
      canManage: game.user.isGM,
      hasContent: !!(tree.rootFolders.length || tree.rootEffects.length),
      rootFolders: tree.rootFolders,
      rootEffects: tree.rootEffects,
      search: this.search,
      tabName: this.tabName
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const element = this.element;
    element.querySelector("[data-action='create-effect']")?.addEventListener("click", () => this.#openEffectSheet());
    element.querySelector("[data-action='create-folder']")?.addEventListener("click", () => this.#createFolder());

    const searchInput = element.querySelector("[name='aem-search']");
    searchInput?.addEventListener("input", foundry.utils.debounce(async (event) => {
      this.search = event.currentTarget.value ?? "";
      await this.render({ force: true });
    }, 100));

    for (const toggle of element.querySelectorAll("[data-action='toggle-folder']")) {
      toggle.addEventListener("click", (event) => this.#toggleFolder(event.currentTarget.dataset.folderId));
    }

    for (const button of element.querySelectorAll("[data-action='create-effect-in-folder']")) {
      button.addEventListener("click", (event) => this.#openEffectSheet(event.currentTarget.dataset.folderId));
    }

    for (const button of element.querySelectorAll("[data-action='create-subfolder']")) {
      button.addEventListener("click", (event) => this.#createFolder(event.currentTarget.dataset.folderId));
    }

    for (const button of element.querySelectorAll("[data-action='edit-folder']")) {
      button.addEventListener("click", (event) => this.#editFolder(event.currentTarget.dataset.folderId));
    }

    for (const button of element.querySelectorAll("[data-action='delete-folder']")) {
      button.addEventListener("click", (event) => this.#deleteFolder(event.currentTarget.dataset.folderId));
    }

    for (const row of element.querySelectorAll(".aem-entry")) {
      row.addEventListener("click", () => this.#openEffectSheet(null, row.dataset.effectId));
      row.addEventListener("dragstart", (event) => this.#onEffectDragStart(event, row.dataset.effectId));
    }

    for (const button of element.querySelectorAll("[data-action='delete-effect']")) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.#deleteEffect(event.currentTarget.dataset.effectId);
      });
    }

    if (game.user.isGM) {
      for (const folder of element.querySelectorAll(".aem-folder")) {
        folder.setAttribute("draggable", "true");
        folder.addEventListener("dragstart", (event) => this.#onFolderDragStart(event, folder.dataset.folderId));
      }

      for (const target of element.querySelectorAll(".aem-drop-target")) {
        target.addEventListener("dragover", this.#onDragOver.bind(this));
        target.addEventListener("drop", this.#onDrop.bind(this));
      }
    }
  }

  async #openEffectSheet(folderId = null, effectId = null) {
    const sheet = new ActiveEffectTemplateSheet({ effectId, folderId: folderId || null });
    return sheet.render({ force: true });
  }

  async #toggleFolder(folderId) {
    const expanded = getExpandedFolders();
    expanded[folderId] = !(expanded[folderId] ?? true);
    await setExpandedFolders(expanded);
    await this.render({ force: true });
  }

  async #createFolder(parentFolderId = null) {
    if (!game.user.isGM) return;
    const folder = await this.#promptFolder(createDefaultFolder({ folder: parentFolderId }));
    if (!folder) return;

    const folders = getFolders();
    folder.sort = nextSortValue(folders.filter((entry) => (entry.folder ?? null) === (folder.folder ?? null)));
    folders.push(folder);
    await setFolders(folders);
    ui.notifications.info(localize("AEM.FolderSaved"));
    Hooks.callAll(`${MODULE_ID}.refresh`);
  }

  async #editFolder(folderId) {
    if (!game.user.isGM) return;
    const folders = getFolders();
    const folder = folders.find((entry) => entry.id === folderId);
    if (!folder) return;
    const updated = await this.#promptFolder(folder);
    if (!updated) return;

    const index = folders.findIndex((entry) => entry.id === folderId);
    folders[index] = updated;
    await setFolders(folders);
    ui.notifications.info(localize("AEM.FolderSaved"));
    Hooks.callAll(`${MODULE_ID}.refresh`);
  }

  async #deleteFolder(folderId) {
    if (!game.user.isGM) return;
    const folders = getFolders();
    const folder = folders.find((entry) => entry.id === folderId);
    if (!folder) return;

    const confirmed = await DialogV2.confirm({
      window: { title: localize("AEM.DeleteFolder") },
      content: `<p>${localize("AEM.DeleteFolderConfirm", { name: foundry.utils.escapeHTML(folder.name) })}</p>`
    });
    if (!confirmed) return;

    const effects = getEffects();

    for (const childFolder of folders) {
      if (childFolder.folder === folderId) childFolder.folder = folder.folder ?? null;
    }
    for (const effect of effects) {
      if (effect.folder === folderId) effect.folder = folder.folder ?? null;
    }

    await setFolders(folders.filter((entry) => entry.id !== folderId));
    await setEffects(effects);
    ui.notifications.info(localize("AEM.FolderDeleted"));
    Hooks.callAll(`${MODULE_ID}.refresh`);
  }

  async #deleteEffect(effectId) {
    if (!game.user.isGM) return;
    const effects = getEffects();
    const effect = effects.find((entry) => entry.id === effectId);
    if (!effect) return;

    const confirmed = await DialogV2.confirm({
      window: { title: localize("AEM.DeleteEffect") },
      content: `<p>${localize("AEM.DeleteEffectConfirm", { name: foundry.utils.escapeHTML(effect.name) })}</p>`
    });
    if (!confirmed) return;

    await setEffects(effects.filter((entry) => entry.id !== effectId));
    ui.notifications.info(localize("AEM.EffectDeleted"));
    Hooks.callAll(`${MODULE_ID}.refresh`);
  }

  async #promptFolder(folder) {
    return DialogV2.prompt({
      window: { title: localize("AEM.FolderSheetTitle") },
      content: `
        <form class="aem-folder-form">
          <div class="form-group">
            <label>${localize("AEM.FolderName")}</label>
            <input type="text" name="name" value="${foundry.utils.escapeHTML(folder.name ?? "")}" required>
          </div>
          <div class="form-group">
            <label>${localize("AEM.FolderColor")}</label>
            <input type="color" name="color" value="${foundry.utils.escapeHTML(folder.color ?? "#3a6ea5")}">
          </div>
        </form>
      `,
      ok: {
        callback: (...args) => {
          const button = args[1];
          const dialog = args[2];
          const form = button?.form ?? dialog?.element?.querySelector("form");
          if (!form) return null;
          return createDefaultFolder({
            ...folder,
            name: form.elements.name.value.trim(),
            color: form.elements.color.value || "#3a6ea5"
          });
        }
      }
    });
  }

  #onDragOver(event) {
    event.preventDefault();
  }

  #onEffectDragStart(event, effectId) {
    const effect = getEffects().find((entry) => entry.id === effectId);
    if (!effect) return;

    event.stopPropagation();
    event.dataTransfer.effectAllowed = game.user.isGM ? "copyMove" : "copy";
    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: DRAG_TYPE,
      effectId,
      internal: game.user.isGM
    }));
  }

  #onFolderDragStart(event, folderId) {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: INTERNAL_FOLDER_DRAG_TYPE,
      folderId
    }));
  }

  async #onDrop(event) {
    event.preventDefault();
    if (!game.user.isGM) return;

    const data = TextEditor.getDragEventData(event);
    const dropTarget = event.currentTarget;
    const targetFolderId = dropTarget.dataset.folderId || null;
    const targetEffectId = dropTarget.dataset.effectId || null;
    const sortBefore = dropTarget.dataset.sortBefore === "true";

    if (data.type === DRAG_TYPE && data.internal) {
      await this.#moveEffect(data.effectId, { targetFolderId, targetEffectId, sortBefore });
      return;
    }

    if (data.type === INTERNAL_FOLDER_DRAG_TYPE) {
      await this.#moveFolder(data.folderId, { targetFolderId });
    }
  }

  async #moveEffect(effectId, { targetFolderId = null, targetEffectId = null, sortBefore = false } = {}) {
    const effects = getEffects();
    const effect = effects.find((entry) => entry.id === effectId);
    if (!effect) return;

    if (!targetEffectId) {
      effect.folder = targetFolderId;
      effect.sort = nextSortValue(effects.filter((entry) => entry.id !== effect.id && (entry.folder ?? null) === targetFolderId));
      await setEffects(effects);
      Hooks.callAll(`${MODULE_ID}.refresh`);
      return;
    }

    const target = effects.find((entry) => entry.id === targetEffectId);
    if (!target || target.id === effect.id) return;

    effect.folder = target.folder ?? null;
    const siblings = sortByOrder(effects.filter((entry) => (entry.folder ?? null) === (target.folder ?? null) && entry.id !== effect.id));
    sortRecord(effects, effect, siblings, target, { sortBefore });
    await setEffects(effects);
    Hooks.callAll(`${MODULE_ID}.refresh`);
  }

  async #moveFolder(folderId, { targetFolderId = null } = {}) {
    const folders = getFolders();
    const folder = folders.find((entry) => entry.id === folderId);
    if (!folder) return;
    if (targetFolderId && isFolderDescendant(folderId, targetFolderId, folders)) return;

    folder.folder = targetFolderId;
    folder.sort = nextSortValue(folders.filter((entry) => entry.id !== folder.id && (entry.folder ?? null) === targetFolderId));
    await setFolders(folders);
    Hooks.callAll(`${MODULE_ID}.refresh`);
  }
}