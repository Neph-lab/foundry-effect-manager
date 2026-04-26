import { MODULE_ID, TAB_NAME } from "./constants.js";
import { registerDropHandlers, applyStoredEffectToDocument } from "./apply-effects.js";
import { openRealEffectsBrowser, registerRealEffectsHooks } from "./real-effects-browser.js";
import { ActiveEffectsSidebarTab } from "./sidebar-tab.js";
import { getEffects, getFolders, migrateEffects, registerSettings } from "./store.js";

Hooks.once("uiExtender.init", (uiExtender) => {
  uiExtender.registerDirectory({
    moduleId: MODULE_ID,
    id: TAB_NAME,
    tooltip: "AEM.SidebarTitle",
    icon: "aem-sidebar-icon",
    applicationClass: ActiveEffectsSidebarTab
  });
});

Hooks.once("init", () => {
  registerSettings();

  game.modules.get(MODULE_ID).api = {
    applyStoredEffectToDocument,
    getEffects,
    getFolders,
    openRealEffectsBrowser,
    openTab: () => ui.sidebar?.changeTab?.(TAB_NAME, "primary")
  };
});

Hooks.once("ready", async () => {
  await migrateEffects();
  registerDropHandlers();
  registerRealEffectsHooks();
});
