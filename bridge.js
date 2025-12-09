/**
 * CKEditor <-> Bubble Minimal Bridge (V1)
 * --------------------------------------
 * Editor → Bubble:
 *   - EDITOR_READY
 *   - CONTENT_UPDATE
 *
 * Bubble → Editor:
 *   - LOAD_CONTENT  { html: "<p>...</p>" }
 */

const BRIDGE_ID = "CKE_BUBBLE_MINI_V1";

/**
 * Global helper: send message to parent (Bubble)
 * Usage in main.js: window.sendToParent("EDITOR_READY", { ... })
 */
window.sendToParent = function (type, payload = {}) {
	try {
		if (!window.parent || window.parent === window) {
			// Not inside an iframe – probably just loaded directly on Netlify.
			return;
		}

		window.parent.postMessage(
			{
				bridge: BRIDGE_ID,
				type,
				payload
			},
			"*"
		);
	} catch (err) {
		console.error("[CKE Bridge] Failed to send message to parent:", err);
	}
};

/**
 * Listen to messages from Bubble (parent → iframe)
 * Expected format:
 *   {
 *     bridge: "CKE_BUBBLE_MINI_V1",
 *     type: "LOAD_CONTENT",
 *     payload: { html: "<p>...</p>" }
 *   }
 */
window.addEventListener("message", (event) => {
	const msg = event.data;
	if (!msg || msg.bridge !== BRIDGE_ID) return;

	if (msg.type === "LOAD_CONTENT") {
		if (window.editor) {
			try {
				// Avoid infinite loops: set a flag so change:data handler can skip echo back
				window.suppressEditorEvents = true;
				window.editor.setData(msg.payload?.html || "");
			} catch (err) {
				console.error("[CKE Bridge] Error loading content into editor:", err);
			} finally {
				// Re-enable events after a brief timeout
				setTimeout(() => {
					window.suppressEditorEvents = false;
				}, 20);
			}
		} else {
			console.warn("[CKE Bridge] Received LOAD_CONTENT but editor is not ready yet.");
		}
	}
});
