import { DRAG_TYPE, MODULE_ID, TAB_NAME } from "./constants.js";
import { getEffects } from "./store.js";
import { localize, sanitizeEffectForApply } from "./helpers.js";

export function registerDropHandlers() {
  Hooks.on("dropActorSheetData", async (actor, _sheet, data) => {
    if (data?.type !== DRAG_TYPE) return;
    await applyStoredEffectToDocument(data.effectId, actor);
  });

  Hooks.on("dropCanvasData", async (_canvas, data, event) => {
    if (data?.type !== DRAG_TYPE) return;
    const token = getTokenFromDropEvent(event);
    if (!token?.actor) {
      ui.notifications.warn(localize("AEM.NoTokenTarget"));
      return;
    }
    await applyStoredEffectToDocument(data.effectId, token.actor, token.name ?? token.actor.name);
  });

  Hooks.on("renderApplicationV2", (app, element) => {
    const document = app.document;
    if (document?.documentName !== "Item") return;
    bindSheetDropListener(element, document);
  });

  Hooks.on(`${MODULE_ID}.refresh`, () => {
    ui[TAB_NAME]?.render?.({ force: true });
  });
}

function bindSheetDropListener(element, targetDocument) {
  if (!element || element.dataset.aemDropBound === "true") return;
  element.dataset.aemDropBound = "true";
  element.addEventListener("drop", async (event) => {
    const data = TextEditor.getDragEventData(event);
    if (data?.type !== DRAG_TYPE) return;
    event.preventDefault();
    event.stopPropagation();
    await applyStoredEffectToDocument(data.effectId, targetDocument);
  }, true);
}

function getTokenFromDropEvent(event) {
  const point = canvas.canvasCoordinatesFromClient({
    x: event.clientX,
    y: event.clientY
  });

  const tokens = [...(canvas.tokens?.placeables ?? [])].reverse();
  return tokens.find((token) => token.bounds?.contains(point.x, point.y)) ?? null;
}

export async function applyStoredEffectToDocument(effectId, targetDocument, displayName = null) {
  const effect = getEffects().find((entry) => entry._id === effectId);
  if (!effect) {
    ui.notifications.warn(localize("AEM.NoEffectFound"));
    return false;
  }

  if (!targetDocument?.canUserModify?.(game.user, "update")) {
    ui.notifications.error(localize("AEM.PermissionError"));
    return false;
  }

  try {
    await targetDocument.createEmbeddedDocuments("ActiveEffect", [sanitizeEffectForApply(effect)]);
    ui.notifications.info(localize("AEM.EffectApplied", {
      name: effect.name,
      target: displayName ?? targetDocument.name
    }));
    return true;
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to apply effect`, error);
    ui.notifications.error(localize("AEM.ApplyError"));
    return false;
  }
}
