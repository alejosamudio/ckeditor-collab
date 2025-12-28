/**
 * CKEditor 5 + Bubble Bridge — AI + Comments + Realtime Ready
 *  - AI enabled (overlay panel on the right)
 *  - Comments + side annotations sidebar
 *  - Realtime-capable (channelId + webSocketUrl)
 *  - Bubble → Editor LOAD_CONTENT support
 *  - Editor → Bubble CONTENT_UPDATE support
 *  - Decoupled editor + menu bar
 *  - Custom "Fix with AI" action in comment thread dropdown
 */

console.log("🟦 MAIN.JS LOADED");

const BRIDGE_ID = "CKE_BUBBLE_BRIDGE_V1";

// --------------------------------------------------------
// Intercept custom AI action API calls and block them
// --------------------------------------------------------
(function interceptCustomActions() {
    const originalFetch = window.fetch;
    
    window.fetch = function(...args) {
        const [url, options] = args;
        
        // Intercept custom actions API calls
        if (typeof url === 'string' && url.includes('/v1/actions/custom/calls')) {
            try {
                const body = options?.body ? JSON.parse(options.body) : {};
                const actionId = body?.action_id || body?.actionId;
                
                if (actionId === 'fv-solve-all-comments') {
                    console.log("🟦 Blocked fv-solve-all-comments API call (handled locally)");
                    
                    // Return a mock successful response immediately
                    return Promise.resolve(new Response(JSON.stringify({
                        handled_locally: true,
                        message: "This action is handled locally, not via API"
                    }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }));
                }
            } catch (e) {
                console.warn("⚠️ Error parsing custom action request:", e);
            }
        }
        
        // For all other requests, use original fetch
        return originalFetch.apply(this, args);
    };
    
    console.log("🟦 Custom action fetch interceptor installed");
})();

// --------------------------------------------------------
// EARLY LISTENER: must exist before editor is ready
// --------------------------------------------------------
(function forceMessageListenerBinding() {
    console.log("🧬 Binding LOAD_CONTENT listener inside CKEditor iframe");

    window.addEventListener("message", (event) => {
        const msg = event.data;
        if (!msg || msg.bridge !== BRIDGE_ID) return;

        console.log("📥 main.js received (EARLY LISTENER):", msg);

        if (msg.type === "LOAD_CONTENT") {
            const safeHtml =
                msg.payload && typeof msg.payload.html === "string"
                    ? msg.payload.html
                    : "";

            console.log("🟦 Applying LOAD_CONTENT to CKEditor…");

            try {
                if (!window.editor || typeof window.editor.setData !== "function") {
                    console.warn("⚠️ Editor not ready — caching LOAD_CONTENT");
                    window._pendingLoadContent = safeHtml;
                    return;
                }

                window.suppressEditorEvents = true;
                window.editor.setData(safeHtml);
                window.suppressEditorEvents = false;

                console.log("✔️ CKEditor content updated by Bubble (early listener)");
            } catch (err) {
                console.error("❌ Failed setData, caching instead:", err);
                window._pendingLoadContent = safeHtml;
            }
        }
    });
})();

// --------------------------------------------------------
// Apply pending content once the REAL editor exists
// --------------------------------------------------------
function applyPendingLoad() {
    if (!window._pendingLoadContent) {
        console.log("ℹ️ No pending LOAD_CONTENT to apply");
        return;
    }

    if (!window.editor || typeof window.editor.setData !== "function") {
        console.warn("⚠️ Editor still not ready in applyPendingLoad()");
        return;
    }

    console.log("🟦 Applying delayed LOAD_CONTENT...");

    try {
        window.suppressEditorEvents = true;
        window.editor.setData(window._pendingLoadContent);
    } catch (err) {
        console.error("❌ Failed to applyPendingLoad:", err);
        return;
    } finally {
        window.suppressEditorEvents = false;
        window._pendingLoadContent = null;
    }
}

// --------------------------------------------------------
// ENV VARIABLES
// --------------------------------------------------------
const LICENSE_KEY =
    'eyJhbGciOiJFUzI1NiJ9.eyJleHAiOjE3NjgwMDMxOTksImp0aSI6ImQ5NzFlZjU2LTM1YmItNDljYS1iOGU3LWQzOTY0MWY0NDlhZCIsInVzYWdlRW5kcG9pbnQiOiJodHRwczovL3Byb3h5LWV2ZW50LmNrZWRpdG9yLmNvbSIsImRpc3RyaWJ1dGlvbkNoYW5uZWwiOlsiY2xvdWQiLCJkcnVwYWwiLCJzaCJdLCJ3aGl0ZUxhYmVsIjp0cnVlLCJsaWNlbnNlVHlwZSI6InRyaWFsIiwiZmVhdHVyZXMiOlsiKiJdLCJ2YyI6Ijk3OTIxYjYxIn0.jvsqpRuH9hli-s9U9Uvd-mRyW9jIWsd03-93eZdfjnP39WKvjGKHxaBg6k3XuP1DKRaC3MWd74x7AMGUTTXCCQ';

const TOKEN_URL =
    'https://gww7y1r4wcsk.cke-cs.com/token/dev/f903477084613189d51e5bf1be3d077d0a7dab07d2e606571c52e58a90e0?limit=10';

const WEBSOCKET_URL = "wss://gww7y1r4wcsk.cke-cs.com/ws";

const DOCUMENT_ID = "fv-doc-1";

document.addEventListener("DOMContentLoaded", () => {
    console.log("🟩 DOM READY");
});

// --------------------------------------------------------
// LOAD PLUGINS
// --------------------------------------------------------
const {
    DecoupledEditor,
    Plugin,
    Autosave,
    Essentials,
    Paragraph,
    CloudServices,
    Autoformat,
    TextTransformation,
    LinkImage,
    Link,
    ImageBlock,
    ImageToolbar,
    BlockQuote,
    Bold,
    Bookmark,
    CKBox,
    ImageUpload,
    ImageInsert,
    ImageInsertViaUrl,
    AutoImage,
    PictureEditing,
    CKBoxImageEdit,
    CodeBlock,
    TableColumnResize,
    Table,
    TableToolbar,
    Emoji,
    Mention,
    PasteFromOffice,
    FindAndReplace,
    FontBackgroundColor,
    FontColor,
    FontFamily,
    FontSize,
    Heading,
    HorizontalLine,
    ImageCaption,
    ImageResize,
    ImageStyle,
    Indent,
    IndentBlock,
    Code,
    Italic,
    AutoLink,
    ListProperties,
    List,
    MediaEmbed,
    RemoveFormat,
    SpecialCharactersArrows,
    SpecialCharacters,
    SpecialCharactersCurrency,
    SpecialCharactersEssentials,
    SpecialCharactersLatin,
    SpecialCharactersMathematical,
    SpecialCharactersText,
    Strikethrough,
    Subscript,
    Superscript,
    TableCaption,
    TableCellProperties,
    TableProperties,
    Alignment,
    TodoList,
    Underline,
    BalloonToolbar,
    Fullscreen
} = window.CKEDITOR;

// UI utilities for custom dropdown
const { createDropdown, Collection, addListToDropdown, ButtonView, ListView, ListItemView } = window.CKEDITOR;

console.log("🔍 UI Classes available:", {
    createDropdown: !!createDropdown,
    ButtonView: !!ButtonView,
    ListView: !!ListView,
    ListItemView: !!ListItemView
});

const {
    AIChat,
    AIEditorIntegration,
    AIQuickActions,
    AIReviewMode,
    PasteFromOfficeEnhanced,
    FormatPainter,
    LineHeight,
    SlashCommand,
    Comments,
    BaseCommentThreadView
} = window.CKEDITOR_PREMIUM_FEATURES;

// --------------------------------------------------------
// Users & Comments integration
// --------------------------------------------------------
class UsersIntegration extends Plugin {
    static get requires() {
        return ["Users"];
    }

    static get pluginName() {
        return "UsersIntegration";
    }

    init() {
        const usersPlugin = this.editor.plugins.get("Users");

        const users = [
            { id: "user-1", name: "Demo User 1" },
            { id: "user-2", name: "Demo User 2" }
        ];
        const me = users[0];

        for (const user of users) {
            usersPlugin.addUser(user);
        }

        usersPlugin.defineMe(me.id);
    }
}

class CommentsIntegration extends Plugin {}

// --------------------------------------------------------
// Helper: send message to Bubble parent
// --------------------------------------------------------
if (typeof window.sendToParent !== "function") {
    window.sendToParent = function (type, payload = {}) {
        const message = {
            bridge: BRIDGE_ID,
            type,
            payload
        };

        try {
            window.parent.postMessage(message, "*");
        } catch (e) {
            console.error("❌ main.js parent.postMessage failed:", e);
        }
    };
}

// --------------------------------------------------------
// COMMENTS UTILITY FUNCTIONS
// --------------------------------------------------------
function safeString(x) {
    return typeof x === "string" ? x : x == null ? "" : String(x);
}

function getCommentsRepository(editor) {
    try {
        return editor.plugins.get("CommentsRepository");
    } catch (e) {
        return null;
    }
}

function extractThreadsFromRepository(repo) {
    if (!repo) return [];

    if (typeof repo.getCommentThreads === "function") {
        try {
            const res = repo.getCommentThreads();
            return Array.isArray(res) ? res : res ? Array.from(res) : [];
        } catch (e) {}
    }

    if (repo.commentThreads && typeof repo.commentThreads.get === "function") {
        try {
            const arr = [];
            for (const t of repo.commentThreads) arr.push(t);
            return arr;
        } catch (e) {}
    }

    if (Array.isArray(repo.commentThreads)) return repo.commentThreads;

    return [];
}

function normalizeThreadComments(thread) {
    if (!thread) return [];

    if (typeof thread.getComments === "function") {
        try {
            const c = thread.getComments();
            return Array.isArray(c) ? c : c ? Array.from(c) : [];
        } catch (e) {}
    }

    if (Array.isArray(thread.comments)) return thread.comments;

    if (thread.comments && typeof thread.comments[Symbol.iterator] === 'function') {
        try {
            return Array.from(thread.comments);
        } catch (e) {}
    }

    return [];
}

function formatCommentsForAI(editor) {
    const repo = getCommentsRepository(editor);
    const threads = extractThreadsFromRepository(repo);

    console.log("🔍 Total threads found:", threads.length);

    if (!threads.length) return "No comments found.";

    const lines = [];
    let idx = 0;
    let skippedResolved = 0;

    for (const thread of threads) {
        // Check if resolved
        const isResolved =
            typeof thread.isResolved === "boolean"
                ? thread.isResolved
                : thread.resolvedAt != null
                ? true
                : typeof thread.getAttribute === "function"
                ? !!thread.getAttribute("resolved")
                : false;

        const threadId = thread.id || thread.threadId;

        if (isResolved) {
            skippedResolved++;
            console.log(`⏭️ Skipping resolved thread: ${threadId}`);
            continue;
        }

        // Extract comments
        const comments = normalizeThreadComments(thread);
        const commentLines = [];

        for (const c of comments) {
            let content = safeString(
                c.content || 
                c.text || 
                c.body || 
                c.message || 
                c.data?.content ||
                c.data?.text ||
                ""
            );

            // Strip HTML tags
            content = content.replace(/<[^>]*>/g, '').replace(/\s+/g, " ").trim();

            if (!content) continue;
            commentLines.push(content);
        }

        // Only include threads with actual comments
        if (commentLines.length === 0) {
            console.warn(`⚠️ Thread ${threadId} has no readable comments, skipping`);
            continue;
        }

        idx += 1;

        // Try to get the highlighted text for this thread
        let highlightedText = "";
        try {
            const model = editor.model;
            const markerName = `comment:${threadId}`;
            const marker = model.markers.get(markerName);
            
            if (marker) {
                const range = marker.getRange();
                let text = "";
                for (const item of range.getItems()) {
                    if (item.is('$text') || item.is('$textProxy')) {
                        text += item.data;
                    }
                }
                highlightedText = text.trim();
            }
        } catch (err) {
            // Silently ignore - highlighted text is optional
        }

        // Format with thread ID and highlighted text
        if (highlightedText) {
            lines.push(`${idx}. [Thread: ${threadId}] Anchor: "${highlightedText}" → ${commentLines.join('; ')}`);
        } else {
            lines.push(`${idx}. [Thread: ${threadId}] ${commentLines.join('; ')}`);
        }
        
        console.log(`📝 Including open thread: ${threadId}`);
    }

    console.log(`📊 Comments summary: ${lines.length} open, ${skippedResolved} resolved (skipped)`);

    if (lines.length === 0) {
        return "No open comments found.";
    }

    return lines.join("\n");
}

// --------------------------------------------------------
// AI Chat Helper Functions
// --------------------------------------------------------
function findAIChatRoot() {
    return (
        document.querySelector(".ck-ai-chat") ||
        document.querySelector(".ck .ck-ai-chat") ||
        document.querySelector(".ck-ai-chat__conversation") ||
        document.querySelector(".ck-ai-tabs") ||
        null
    );
}

function findAIChatComposer(aiRoot) {
    if (!aiRoot) return null;

    const textarea = aiRoot.querySelector("textarea");
    if (textarea) return { kind: "textarea", el: textarea };

    const ce =
        aiRoot.querySelector('[contenteditable="true"]') ||
        aiRoot.querySelector(".ck-ai-chat__input [contenteditable='true']");
    if (ce) return { kind: "contenteditable", el: ce };

    return null;
}

// --------------------------------------------------------
// Handle Fix with AI for a specific thread
// --------------------------------------------------------
async function handleFixWithAI(editor, threadId) {
    console.log("🟦 Fix with AI triggered for thread:", threadId);
    
    const repo = getCommentsRepository(editor);
    if (!repo) return;
    
    let thread = null;
    try {
        thread = repo.getCommentThread ? repo.getCommentThread(threadId) : null;
    } catch (err) {
        console.warn("⚠️ Could not get thread:", err);
    }
    
    if (!thread) {
        console.warn("⚠️ Thread not found");
        return;
    }
    
    // Extract comment text
    const comments = normalizeThreadComments(thread);
    const commentLines = [];
    
    for (const c of comments) {
        let content = safeString(
            c.content || c.text || c.body || c.message || 
            c.data?.content || c.data?.text || ""
        );
        content = content.replace(/<[^>]*>/g, '').replace(/\s+/g, " ").trim();
        if (!content) continue;
        commentLines.push(content);
    }
    
    if (commentLines.length === 0) {
        console.warn("⚠️ No comments found");
        return;
    }
    
    const commentText = commentLines.join('; ');
    
    // Get the highlighted text (the text the comment refers to)
    let highlightedText = "";
    try {
        // Get the marker from the document model
        const model = editor.model;
        const markerName = `comment:${threadId}`;
        const marker = model.markers.get(markerName);
        
        if (marker) {
            const range = marker.getRange();
            // Extract text from the range
            let text = "";
            for (const item of range.getItems()) {
                if (item.is('$text') || item.is('$textProxy')) {
                    text += item.data;
                }
            }
            highlightedText = text.trim();
            console.log("🟦 Highlighted text:", highlightedText);
        } else {
            console.warn("⚠️ Could not find marker for thread");
        }
    } catch (err) {
        console.warn("⚠️ Error getting highlighted text:", err);
    }
    
    window._singleThreadToResolve = threadId;
    
    // Build a more structured prompt with thread ID for precise location
    let prompt;
    if (highlightedText) {
        prompt = `Address this document comment:

Thread ID: ${threadId}
Anchor text: "${highlightedText}"
Comment: ${commentText}

Rules:
- Find the text "${highlightedText}" in the document (marked by comment thread ${threadId})
- Apply only the change needed to address this comment at that specific location
- Keep all other content exactly as is
- Preserve the document's tone and style`;
    } else {
        prompt = `Address this document comment:

Thread ID: ${threadId}
Comment: ${commentText}

Rules:
- Find the comment marker for thread ${threadId} in the document
- Apply only the change needed to address this comment at that specific location
- Keep all other content exactly as is
- Preserve the document's tone and style`;
    }
    
    console.log("🟦 Prompt:", prompt);
    
    try {
        window._skipNextCommentsInjection = true;
        
        const aiChat = editor.plugins.get("AIChat");
        if (!aiChat) return;
        
        if (aiChat.ui?.view?.panelView && !aiChat.ui.view.panelView.isVisible) {
            editor.execute('toggleAi');
            await new Promise(resolve => setTimeout(resolve, 500));
        } else {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const aiRoot = findAIChatRoot();
        if (!aiRoot) return;
        
        const composer = findAIChatComposer(aiRoot);
        if (!composer) return;
        
        if (composer.kind === "textarea") {
            composer.el.value = prompt;
            composer.el.dispatchEvent(new Event('input', { bubbles: true }));
            composer.el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            composer.el.textContent = prompt;
            composer.el.dispatchEvent(new Event('input', { bubbles: true }));
            composer.el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const sendButton = 
            aiRoot.querySelector('button[type="submit"]') ||
            aiRoot.querySelector('button[aria-label*="send" i]') ||
            Array.from(aiRoot.querySelectorAll('button')).find(btn => {
                const label = (btn.getAttribute('aria-label') || btn.title || btn.textContent || '').toLowerCase();
                return label.includes('send') || label.includes('submit');
            });
        
        if (sendButton && !sendButton.disabled) {
            sendButton.click();
            console.log("🟩 Single comment AI request sent");
        }
    } catch (err) {
        console.error("❌ Failed to trigger AI:", err);
    }
}

// --------------------------------------------------------
// 🧩 CUSTOM COMMENT THREAD VIEW with "Fix with AI" action
// --------------------------------------------------------
// --------------------------------------------------------
// 🧩 CUSTOM COMMENT THREAD VIEW - with Fix with AI dropdown
// --------------------------------------------------------
class CustomCommentThreadView extends BaseCommentThreadView {
    constructor(...args) {
        super(...args);

        const bind = this.bindTemplate;

        console.log("🟦 CustomCommentThreadView constructor called");
        console.log("🟦 Thread length:", this.length);

        // The template definition based on the default comment thread view
        // We'll add a placeholder for the dropdown that gets populated later
        this.setTemplate({
            tag: 'div',

            attributes: {
                class: [
                    'ck',
                    'ck-thread',
                    'ck-reset_all-excluded',
                    'ck-rounded-corners',
                    bind.if('isActive', 'ck-thread--active')
                ],
                tabindex: 0,
                role: 'listitem',
                'aria-label': bind.to('ariaLabel'),
                'aria-describedby': this.ariaDescriptionView.id
            },

            children: [
                // Placeholder for dropdown - will be populated when comments exist
                {
                    tag: 'div',
                    attributes: {
                        class: 'ck-thread-top-bar-placeholder'
                    }
                },
                {
                    tag: 'div',
                    attributes: {
                        class: 'ck-thread__container'
                    },
                    children: [
                        this.commentsListView,
                        this.commentThreadInputView
                    ]
                }
            ]
        });

        // Add dropdown after render if comments exist
        this.on('render', () => {
            if (this.length > 0) {
                this._injectDropdown();
            }
        });

        // Add dropdown when first comment is added
        this.listenTo(this.commentsListView.commentViews, 'add', () => {
            console.log("🟦 Comment added to thread, length now:", this.length);
            this._injectDropdown();
            this._modifyFirstCommentView();
        });

        // Modify first comment view if comments exist
        if (this.length > 0) {
            // Need to wait for render
            this.on('render', () => {
                this._modifyFirstCommentView();
            });
        }
    }

    _injectDropdown() {
        if (!this.element) return;
        
        // Check if already injected
        if (this.element.querySelector('.ck-thread-top-bar')) {
            return;
        }
        
        const placeholder = this.element.querySelector('.ck-thread-top-bar-placeholder');
        if (!placeholder) return;
        
        // Create the dropdown
        const dropdown = this._createActionsDropdown();
        if (!dropdown) return;
        
        // Render the dropdown
        dropdown.render();
        
        // Create the top bar wrapper
        const topBar = document.createElement('div');
        topBar.className = 'ck-thread-top-bar';
        topBar.appendChild(dropdown.element);
        
        // Replace placeholder with top bar
        placeholder.replaceWith(topBar);
        
        console.log("✅ Dropdown injected into thread");
    }

    _createActionsDropdown() {
        if (!createDropdown || !ListView || !ListItemView || !ButtonView) {
            console.error("❌ Missing UI classes:", {
                createDropdown: !!createDropdown,
                ListView: !!ListView,
                ListItemView: !!ListItemView,
                ButtonView: !!ButtonView
            });
            return null;
        }

        const dropdown = createDropdown(this.locale);
        
        dropdown.buttonView.set({
            label: 'Actions',
            withText: true,
            tooltip: true
        });

        // Create list view for dropdown items
        const listView = new ListView(this.locale);
        
        // Create Fix with AI button
        const fixWithAIItem = new ListItemView(this.locale);
        const fixWithAIButton = new ButtonView(this.locale);
        fixWithAIButton.set({
            label: '✨ Fix with AI',
            withText: true
        });
        fixWithAIButton.on('execute', () => {
            const threadId = this._model.id;
            console.log("🟦 Fix with AI clicked for thread:", threadId);
            if (window.editor) {
                handleFixWithAI(window.editor, threadId);
            }
            dropdown.isOpen = false;
        });
        fixWithAIItem.children.add(fixWithAIButton);
        listView.items.add(fixWithAIItem);

        // Create Edit button
        const editItem = new ListItemView(this.locale);
        const editButton = new ButtonView(this.locale);
        editButton.set({
            label: 'Edit',
            withText: true
        });
        editButton.on('execute', () => {
            const firstComment = this.commentsListView.commentViews.get(0);
            if (firstComment?.switchToEditMode) {
                firstComment.switchToEditMode();
            }
            dropdown.isOpen = false;
        });
        editItem.children.add(editButton);
        listView.items.add(editItem);

        // Create Resolve button
        const resolveItem = new ListItemView(this.locale);
        const resolveButton = new ButtonView(this.locale);
        resolveButton.set({
            label: 'Resolve',
            withText: true
        });
        resolveButton.on('execute', () => {
            this.fire('resolveCommentThread');
            dropdown.isOpen = false;
        });
        resolveItem.children.add(resolveButton);
        listView.items.add(resolveItem);

        // Create Delete button
        const deleteItem = new ListItemView(this.locale);
        const deleteButton = new ButtonView(this.locale);
        deleteButton.set({
            label: 'Delete',
            withText: true
        });
        deleteButton.on('execute', () => {
            this.fire('removeCommentThread');
            dropdown.isOpen = false;
        });
        deleteItem.children.add(deleteButton);
        listView.items.add(deleteItem);

        dropdown.panelView.children.add(listView);

        console.log("✅ Actions dropdown created with", listView.items.length, "items");
        return dropdown;
    }

    _modifyFirstCommentView() {
        const commentView = this.commentsListView.commentViews.get(0);
        if (!commentView) return;

        // Hide the default edit/remove buttons since we have them in dropdown
        if (commentView.removeButton) {
            commentView.removeButton.unbind('isVisible');
            commentView.removeButton.isVisible = false;
        }

        if (commentView.editButton) {
            commentView.editButton.unbind('isVisible');
            commentView.editButton.isVisible = false;
        }
    }
}

// --------------------------------------------------------
// 🧩 Solve-All-Comments Command Plugin
// --------------------------------------------------------
class SolveAllCommentsCommandPlugin extends Plugin {
    static get pluginName() {
        return "SolveAllCommentsCommandPlugin";
    }

    init() {
        const editor = this.editor;

        editor.commands.add("fv-solve-all-comments", {
            execute: () => {
                console.log("🟦 fv-solve-all-comments command executed");
                this._runSolveAllComments();
            },
            refresh() {
                this.isEnabled = true;
            }
        });

        console.log("🧩 fv-solve-all-comments command registered via plugin");
    }

    async _runSolveAllComments() {
        const editor = this.editor;

        const commentsContext = formatCommentsForAI(editor);

        if (!commentsContext || commentsContext === "No comments found." || commentsContext === "No open comments found.") {
            console.log("ℹ️ No OPEN comments to solve");
            alert("No open comments found to solve.");
            return;
        }

        console.log("📋 Comments context extracted:", commentsContext);

        // Store the thread IDs we're solving so we can resolve them later
        const repo = getCommentsRepository(editor);
        const threads = extractThreadsFromRepository(repo);
        const openThreadIds = threads
            .filter(t => {
                const isResolved = 
                    typeof t.isResolved === "boolean" ? t.isResolved :
                    t.resolvedAt != null ? true :
                    typeof t.getAttribute === "function" ? !!t.getAttribute("resolved") : false;
                return !isResolved;
            })
            .map(t => t.id || t.threadId);

        console.log("📋 Open thread IDs to resolve after AI applies changes:", openThreadIds);
        
        window._threadsToResolve = openThreadIds;

        const prompt = `Address these document comments:

${commentsContext}

Rules:
- Each comment shows [Thread: ID] and Anchor: "text" to identify the exact location
- Find each anchor text in the document and apply the requested change at that specific location
- Apply only the changes needed to address each comment
- Keep all other content exactly as is
- Preserve the document's tone and style`;

        console.log("🟦 Triggering AI chat with solve-all-comments prompt");

        try {
            window._skipNextCommentsInjection = true;
            
            const aiChat = editor.plugins.get("AIChat");
            
            if (!aiChat) {
                console.error("❌ AIChat plugin not available");
                return;
            }

            if (aiChat.ui?.view?.panelView && !aiChat.ui.view.panelView.isVisible) {
                editor.execute('toggleAi');
                console.log("🟪 Opened AI panel");
                await new Promise(resolve => setTimeout(resolve, 500));
            } else {
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            const aiRoot = findAIChatRoot();
            if (!aiRoot) {
                console.warn("⚠️ Could not find AI chat root element");
                return;
            }

            const composer = findAIChatComposer(aiRoot);
            if (!composer) {
                console.warn("⚠️ Could not find AI chat composer");
                return;
            }

            if (composer.kind === "textarea") {
                composer.el.value = prompt;
                composer.el.dispatchEvent(new Event('input', { bubbles: true }));
                composer.el.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                composer.el.textContent = prompt;
                composer.el.dispatchEvent(new Event('input', { bubbles: true }));
                composer.el.dispatchEvent(new Event('change', { bubbles: true }));
            }

            console.log("🟪 Injected prompt into AI chat");

            await new Promise(resolve => setTimeout(resolve, 150));

            const sendButton = 
                aiRoot.querySelector('button[type="submit"]') ||
                aiRoot.querySelector('button[aria-label*="send" i]') ||
                aiRoot.querySelector('button[aria-label*="submit" i]') ||
                Array.from(aiRoot.querySelectorAll('button')).find(btn => {
                    const label = (btn.getAttribute('aria-label') || btn.title || btn.textContent || '').toLowerCase();
                    return label.includes('send') || label.includes('submit');
                });

            if (sendButton && !sendButton.disabled) {
                console.log("🟪 Clicking send button:", sendButton);
                sendButton.click();
                console.log("🟩 AI chat prompt sent successfully");
            } else if (sendButton && sendButton.disabled) {
                console.warn("⚠️ Send button is disabled - waiting for it to enable");
                await new Promise(resolve => setTimeout(resolve, 500));
                if (!sendButton.disabled) {
                    sendButton.click();
                    console.log("🟩 AI chat prompt sent successfully (after wait)");
                } else {
                    console.warn("⚠️ Send button still disabled - user needs to click send manually");
                }
            } else {
                console.warn("⚠️ Could not find send button - user needs to click send manually");
            }

        } catch (e) {
            console.error("❌ Failed to trigger AI chat:", e);
        }
    }
}

// --------------------------------------------------------
// AI CHAT COMMENTS INJECTION (only when user types "comment")
// --------------------------------------------------------
const FV_COMMENTS_CONTEXT_START = "<!--FV_COMMENTS_CONTEXT_START-->";
const FV_COMMENTS_CONTEXT_END = "<!--FV_COMMENTS_CONTEXT_END-->";

function stripPreviousInjectedCommentsBlock(text) {
    const start = text.indexOf(FV_COMMENTS_CONTEXT_START);
    const end = text.indexOf(FV_COMMENTS_CONTEXT_END);

    if (start === -1 || end === -1 || end < start) return text;

    const afterEnd = end + FV_COMMENTS_CONTEXT_END.length;
    return (text.slice(0, start) + text.slice(afterEnd)).trimStart();
}

function buildInjectedCommentsBlock(editor) {
    const commentsText = formatCommentsForAI(editor);

    const MAX_CHARS = 8000;
    const clipped =
        commentsText.length > MAX_CHARS ? commentsText.slice(0, MAX_CHARS) + "\n…(clipped)" : commentsText;

    return (
        `${FV_COMMENTS_CONTEXT_START}\n` +
        `[Document comments]\n` +
        `${clipped}\n` +
        `${FV_COMMENTS_CONTEXT_END}\n\n`
    );
}

function injectCommentsIntoComposer(editor, aiRoot) {
    try {
        if (window._skipNextCommentsInjection) {
            console.log("🟪 Skipping comments injection (solve-all-comments action)");
            window._skipNextCommentsInjection = false;
            return true;
        }
        
        const composer = findAIChatComposer(aiRoot);
        if (!composer) {
            console.warn("⚠️ AI chat input not found; cannot inject comments");
            return false;
        }

        const current =
            composer.kind === "textarea"
                ? safeString(composer.el.value)
                : safeString(composer.el.textContent || "");

        // Only inject if user mentions "comments" in their prompt
        if (!current.toLowerCase().includes('comment')) {
            console.log("🟪 No 'comment' keyword found - skipping comments injection");
            return false;
        }

        const cleaned = stripPreviousInjectedCommentsBlock(current);
        const injected = buildInjectedCommentsBlock(editor) + cleaned;

        if (composer.kind === "textarea") {
            composer.el.value = injected;
        } else {
            composer.el.textContent = injected;
        }

        console.log("🟪 Injected comments context into AI chat input (user mentioned 'comment')");
        return true;
    } catch (e) {
        console.warn("⚠️ Failed injecting comments into AI chat:", e);
        return false;
    }
}

function tryBindAIChatSubmitInjection(editor) {
    const aiRoot = findAIChatRoot();
    if (!aiRoot) return false;

    if (aiRoot.__fvCommentsInjectionBound) return true;
    aiRoot.__fvCommentsInjectionBound = true;

    console.log("🟪 Bound AI chat events → will inject comments context when user mentions 'comment'");

    const form = aiRoot.querySelector("form");
    if (form) {
        form.addEventListener(
            "submit",
            () => {
                console.log("🟪 AI chat submit detected");
                injectCommentsIntoComposer(editor, aiRoot);
            },
            true
        );
    }

    aiRoot.addEventListener(
        "keydown",
        (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                console.log("🟪 AI chat Enter detected");
                injectCommentsIntoComposer(editor, aiRoot);
            }
        },
        true
    );

    aiRoot.addEventListener(
        "click",
        (e) => {
            const t = e.target;
            if (!t) return;

            const btn = t.closest && t.closest("button");
            if (!btn) return;

            const label = (btn.getAttribute("aria-label") || btn.title || btn.textContent || "").toLowerCase();

            const looksLikeSend =
                label.includes("send") ||
                label.includes("submit") ||
                label.includes("enter") ||
                btn.type === "submit";

            if (looksLikeSend) {
                console.log("🟪 AI chat send-click detected");
                injectCommentsIntoComposer(editor, aiRoot);
            }
        },
        true
    );

    return true;
}

function enableAIChatCommentsInjection(editor) {
    if (tryBindAIChatSubmitInjection(editor)) return;

    const observer = new MutationObserver(() => {
        if (tryBindAIChatSubmitInjection(editor)) {
            observer.disconnect();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
        try {
            observer.disconnect();
        } catch (e) {}
    }, 60000);
}

// --------------------------------------------------------
// CONFIGURATION
// --------------------------------------------------------
const editorConfig = {
    toolbar: {
        items: [
            "undo",
            "redo",
            "|",
            "comment",
            "|",
            "toggleAi",
            "aiQuickActions",
            "|",
            "formatPainter",
            "findAndReplace",
            "|",
            "heading",
            "|",
            "fontSize",
            "fontFamily",
            "fontColor",
            "fontBackgroundColor",
            "|",
            "bold",
            "italic",
            "underline",
            "strikethrough",
            "subscript",
            "superscript",
            "code",
            "removeFormat",
            "|",
            "emoji",
            "specialCharacters",
            "horizontalLine",
            "link",
            "bookmark",
            "insertImage",
            "insertImageViaUrl",
            "ckbox",
            "mediaEmbed",
            "insertTable",
            "blockQuote",
            "codeBlock",
            "|",
            "alignment",
            "lineHeight",
            "|",
            "bulletedList",
            "numberedList",
            "todoList",
            "outdent",
            "indent"
        ],
        shouldNotGroupWhenFull: false
    },

    plugins: [
        AIChat,
        AIEditorIntegration,
        AIQuickActions,
        AIReviewMode,
        FormatPainter,
        LineHeight,
        PasteFromOfficeEnhanced,
        SlashCommand,
        Comments,
        SolveAllCommentsCommandPlugin,
        Alignment,
        Autoformat,
        AutoImage,
        AutoLink,
        Autosave,
        BalloonToolbar,
        BlockQuote,
        Bold,
        Bookmark,
        CKBox,
        CKBoxImageEdit,
        CloudServices,
        Code,
        CodeBlock,
        Emoji,
        Essentials,
        FindAndReplace,
        FontBackgroundColor,
        FontColor,
        FontFamily,
        FontSize,
        Fullscreen,
        Heading,
        HorizontalLine,
        ImageBlock,
        ImageCaption,
        ImageInsert,
        ImageInsertViaUrl,
        ImageResize,
        ImageStyle,
        ImageToolbar,
        ImageUpload,
        Indent,
        IndentBlock,
        Italic,
        Link,
        LinkImage,
        List,
        ListProperties,
        MediaEmbed,
        Mention,
        Paragraph,
        PasteFromOffice,
        PictureEditing,
        RemoveFormat,
        SpecialCharacters,
        SpecialCharactersArrows,
        SpecialCharactersCurrency,
        SpecialCharactersEssentials,
        SpecialCharactersLatin,
        SpecialCharactersMathematical,
        SpecialCharactersText,
        Strikethrough,
        Subscript,
        Superscript,
        Table,
        TableCaption,
        TableCellProperties,
        TableColumnResize,
        TableProperties,
        TableToolbar,
        TextTransformation,
        TodoList,
        Underline
    ],

    extraPlugins: [UsersIntegration, CommentsIntegration],

    ai: {
        container: {
            type: "overlay",
            side: "right"
        },
        openOnStart: false,
        chat: {
            groupId: DOCUMENT_ID,
            context: {
                document: { enabled: true },
                urls: { enabled: true },
                files: { enabled: true }
            }
        },
        quickActions: {
            extraCommands: [
                {
                    id: "fv-solve-all-comments",
                    displayedPrompt: "Solve all comments",
                    prompt: "Solve all open comments in the document",
                    type: "ACTION",
                    requiresContent: false
                }
            ]
        }
    },

    balloonToolbar: [
        "comment",
        "|",
        "aiQuickActions",
        "|",
        "bold",
        "italic",
        "|",
        "link",
        "|",
        "bulletedList",
        "numberedList"
    ],

    cloudServices: {
        tokenUrl: TOKEN_URL,
        webSocketUrl: WEBSOCKET_URL
    },

    collaboration: {
        channelId: DOCUMENT_ID
    },

    // ⭐ USE CUSTOM COMMENT THREAD VIEW
    comments: {
        CommentThreadView: CustomCommentThreadView,
        editorConfig: {
            extraPlugins: [Autoformat, Bold, Italic, List, Mention],
            mention: {
                feeds: [
                    {
                        marker: "@",
                        feed: []
                    }
                ]
            }
        }
    },

    fontFamily: {
        supportAllValues: true
    },

    fontSize: {
        options: [10, 12, 14, "default", 18, 20, 22],
        supportAllValues: true
    },

    fullscreen: {
        onEnterCallback: (container) =>
            container.classList.add(
                "editor-container",
                "editor-container_document-editor",
                "editor-container_include-annotations",
                "editor-container_contains-wrapper",
                "editor-container_include-fullscreen",
                "main-container"
            )
    },

    heading: {
        options: [
            { model: "paragraph", title: "Paragraph", class: "ck-heading_paragraph" },
            { model: "heading1", view: "h1", title: "Heading 1", class: "ck-heading_heading1" },
            { model: "heading2", view: "h2", title: "Heading 2", class: "ck-heading_heading2" },
            { model: "heading3", view: "h3", title: "Heading 3", class: "ck-heading_heading3" },
            { model: "heading4", view: "h4", title: "Heading 4", class: "ck-heading_heading4" },
            { model: "heading5", view: "h5", title: "Heading 5", class: "ck-heading_heading5" },
            { model: "heading6", view: "h6", title: "Heading 6", class: "ck-heading_heading6" }
        ]
    },

    image: {
        toolbar: [
            "toggleImageCaption",
            "|",
            "imageStyle:alignBlockLeft",
            "imageStyle:block",
            "imageStyle:alignBlockRight",
            "|",
            "resizeImage"
        ],
        styles: {
            options: ["alignBlockLeft", "block", "alignBlockRight"]
        }
    },

    lineHeight: {
        supportAllValues: true
    },

    link: {
        addTargetToExternalLinks: true,
        defaultProtocol: "https://",
        decorators: {
            toggleDownloadable: {
                mode: "manual",
                label: "Downloadable",
                attributes: {
                    download: "file"
                }
            }
        }
    },

    mention: {
        feeds: [
            {
                marker: "@",
                feed: []
            }
        ]
    },

    placeholder: "Type or paste your content here!",

    sidebar: {
        container: document.querySelector("#editor-annotations")
    },

    licenseKey: LICENSE_KEY
};

// --------------------------------------------------------
// CREATE EDITOR
// --------------------------------------------------------
console.log("🟦 Creating editor...");

DecoupledEditor.create(document.querySelector("#editor"), editorConfig)
    .then((editor) => {
        console.log("🟩 EDITOR CREATED SUCCESSFULLY", editor);

        const toolbarHost = document.querySelector("#editor-toolbar");
        const menuBarHost = document.querySelector("#editor-menu-bar");

        if (toolbarHost) {
            toolbarHost.appendChild(editor.ui.view.toolbar.element);
        }

        if (menuBarHost && editor.ui.view.menuBarView) {
            menuBarHost.appendChild(editor.ui.view.menuBarView.element);
        }

        try {
            const annotationsUIs = editor.plugins.get("AnnotationsUIs");
            if (annotationsUIs) {
                annotationsUIs.switchTo("narrowSidebar");
            }
        } catch (e) {
            console.warn("⚠️ AnnotationsUIs not available:", e);
        }

        window.editor = editor;
        window.suppressEditorEvents = false;

        const cmd = editor.commands.get("fv-solve-all-comments");
        if (cmd) {
            console.log("✅ fv-solve-all-comments command verified:", cmd);
        } else {
            console.log("ℹ️ Command not found (expected for ACTION type quick actions)");
        }

        applyPendingLoad();

        // CLOSE AI panel on initial load
        try {
            const aiChat = editor.plugins.get("AIChat");

            const forceHidePanel = () => {
                if (aiChat && aiChat.ui?.view?.panelView) {
                    if (aiChat.ui.view.panelView.isVisible) {
                        aiChat.ui.view.panelView.hide();
                        console.log("🟪 AI CHAT PANEL HIDDEN");
                        
                        const toggleCmd = editor.commands.get('toggleAi');
                        if (toggleCmd) {
                            toggleCmd.value = false;
                            toggleCmd.refresh();
                        }
                        
                        return true;
                    }
                }
                return false;
            };

            forceHidePanel();

            setTimeout(() => {
                forceHidePanel();
            }, 100);

            editor.editing.view.once("render", () => {
                forceHidePanel();
                setTimeout(() => {
                    forceHidePanel();
                    setTimeout(() => {
                        console.log("🟪 Initial load complete - AI panel can now be opened by user");
                    }, 500);
                }, 200);
            });

        } catch (e) {
            console.warn("⚠️ Could not hide AI panel:", e);
        }

        // ⭐ Listen for solve-all-comments action clicks and trigger our logic
        try {
            document.addEventListener('click', (e) => {
                const target = e.target;
                if (!target) return;
                
                const button = target.closest('button');
                if (!button) return;
                
                const text = button.textContent || button.getAttribute('aria-label') || '';
                
                if (text.toLowerCase().includes('solve all comments')) {
                    console.log("🟦 Solve all comments button clicked - intercepting");
                    
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    setTimeout(() => {
                        const plugin = editor.plugins.get("SolveAllCommentsCommandPlugin");
                        if (plugin) {
                            plugin._runSolveAllComments();
                        }
                    }, 50);
                    
                    return false;
                }
            }, true);
            
            console.log("✅ Click listener registered for solve-all-comments");
        } catch (e) {
            console.warn("⚠️ Could not register click listener:", e);
        }

        try {
            enableAIChatCommentsInjection(editor);
        } catch (e) {
            console.warn("⚠️ Could not enable AI chat comments injection:", e);
        }

        // ⭐ Listen for "Apply all changes" / "Accept" and auto-resolve comments
        try {
            document.addEventListener('click', async (e) => {
                const target = e.target;
                if (!target) return;
                
                const button = target.closest('button');
                if (!button) return;
                
                const text = (button.textContent || '').toLowerCase().trim();
                const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
                const title = (button.title || '').toLowerCase();
                const allText = `${text} ${ariaLabel} ${title}`;
                
                // Detect various "apply/accept" button patterns
                const isApplyButton = 
                    allText.includes('apply all') ||
                    allText.includes('apply change') ||
                    allText.includes('accept all') ||
                    allText.includes('accept change') ||
                    (allText.includes('apply') && !allText.includes('cancel')) ||
                    (allText.includes('accept') && !allText.includes('cancel')) ||
                    // CKEditor specific patterns
                    button.classList.contains('ck-ai-apply-button') ||
                    button.closest('.ck-ai-form__actions')?.contains(button);
                
                if (isApplyButton) {
                    console.log("🟦 Detected apply/accept button click:", text || ariaLabel);
                    
                    // Wait for changes to be applied
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
                    const repo = getCommentsRepository(editor);
                    if (!repo) {
                        console.warn("⚠️ CommentsRepository not available");
                        return;
                    }
                    
                    // Check if we're resolving a single thread or multiple
                    let threadsToResolve = [];
                    if (window._singleThreadToResolve) {
                        threadsToResolve = [window._singleThreadToResolve];
                        console.log("🟦 Resolving single thread:", window._singleThreadToResolve);
                        window._singleThreadToResolve = null;
                    } else if (window._threadsToResolve && window._threadsToResolve.length > 0) {
                        threadsToResolve = [...window._threadsToResolve];
                        console.log("🟦 Resolving multiple threads:", threadsToResolve);
                        window._threadsToResolve = [];
                    }
                    
                    if (threadsToResolve.length === 0) {
                        console.log("ℹ️ No threads to resolve");
                        return;
                    }
                    
                    let resolved = 0;
                    for (const threadId of threadsToResolve) {
                        try {
                            const thread = repo.getCommentThread ? repo.getCommentThread(threadId) : null;
                            
                            if (thread) {
                                // Try resolve() method first
                                if (typeof thread.resolve === 'function') {
                                    thread.resolve();
                                    resolved++;
                                    console.log(`✅ Resolved thread ${threadId} via resolve()`);
                                    continue;
                                }
                                
                                // Try isResolved property
                                if ('isResolved' in thread) {
                                    thread.isResolved = true;
                                    resolved++;
                                    console.log(`✅ Resolved thread ${threadId} via isResolved`);
                                    continue;
                                }
                                
                                // Try setAttribute
                                if (typeof thread.setAttribute === 'function') {
                                    thread.setAttribute('resolved', true);
                                    thread.setAttribute('resolvedAt', new Date().toISOString());
                                    resolved++;
                                    console.log(`✅ Resolved thread ${threadId} via setAttribute`);
                                    continue;
                                }
                            }
                            
                            // Try repository method
                            if (typeof repo.resolveCommentThread === 'function') {
                                repo.resolveCommentThread(threadId);
                                resolved++;
                                console.log(`✅ Resolved thread ${threadId} via repo.resolveCommentThread`);
                                continue;
                            }
                            
                            console.warn(`⚠️ Could not find resolve method for thread ${threadId}`);
                        } catch (err) {
                            console.warn(`⚠️ Failed to resolve thread ${threadId}:`, err);
                        }
                    }
                    
                    console.log(`🟩 Resolved ${resolved}/${threadsToResolve.length} comment thread(s)`);
                }
            }, true);
            
            console.log("✅ Auto-resolve listener registered");
        } catch (e) {
            console.warn("⚠️ Could not register auto-resolve listener:", e);
        }

        window.sendToParent("IFRAME_READY", { timestamp: Date.now() });
        window.sendToParent("EDITOR_READY", { timestamp: Date.now() });

        editor.model.document.on("change:data", () => {
            if (window.suppressEditorEvents) return;

            const html = editor.getData();
            console.log("🟧 CONTENT_UPDATE:", html.slice(0, 120));
            window.sendToParent("CONTENT_UPDATE", { html });
        });
    })
    .catch((err) => {
        console.error("❌ EDITOR INIT FAILED:", err);
    });

function configUpdateAlert() {}