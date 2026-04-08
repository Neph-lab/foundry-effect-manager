import { MODULE_ID, TAB_NAME } from "./constants.js";
import { registerDropHandlers, applyStoredEffectToDocument } from "./apply-effects.js";
import { ActiveEffectsSidebarTab } from "./sidebar-tab.js";
import { getEffects, getFolders, registerSettings } from "./store.js";

Hooks.once("init", () => {
  registerSettings();
  registerSidebarTab();

  game.modules.get(MODULE_ID).api = {
    applyStoredEffectToDocument,
    getEffects,
    getFolders,
    openTab: () => ui.sidebar?.changeTab?.(TAB_NAME, "primary")
  };
});

Hooks.once("ready", () => {
  ui[TAB_NAME] ??= new ActiveEffectsSidebarTab();
  registerDropHandlers();
  ui.sidebar?.render({ force: true });
});

function registerSidebarTab() {
  CONFIG.ui[TAB_NAME] = ActiveEffectsSidebarTab;
  foundry.applications.sidebar.Sidebar.TABS[TAB_NAME] = {
    icon: "aem-sidebar-icon",
    label: "AEM.SidebarTitle",
    tooltip: "AEM.SidebarTitle"
  };
}
