/**
 * CKEditor 5 + Bubble Bridge — AI + Comments + Realtime Ready
 *  - AI enabled (overlay panel on the right)
 *  - Comments + side annotations sidebar
 *  - Realtime-capable (channelId + webSocketUrl)
 *  - Bubble → Editor LOAD_CONTENT support
 *  - Editor → Bubble CONTENT_UPDATE support
 *  - Decoupled editor + menu bar
 *  - Custom "Fix with AI" action in comment thread dropdown
 *  - LOCAL COMMENTS STORAGE (adapter overrides cloud)
 */

console.log("🟦 MAIN.JS LOADED");

const BRIDGE_ID = "CKE_BUBBLE_BRIDGE_V1";  // For receiving FROM Bubble
const BRIDGE_ID_OUT = "CKE_BUBBLE_MINI_V1";  // For sending TO Bubble

// --------------------------------------------------------
// Intercept custom AI action API calls and execute locally
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
                    console.log("🟦 Intercepted fv-solve-all-comments API call - executing locally");
                    
                    // ⭐ Execute the command locally
                    setTimeout(() => {
                        if (window.editor) {
                            try {
                                const plugin = window.editor.plugins.get("SolveAllCommentsCommandPlugin");
                                if (plugin && plugin._runSolveAllComments) {
                                    plugin._runSolveAllComments();
                                } else {
                                    console.warn("⚠️ SolveAllCommentsCommandPlugin not found or missing method");
                                }
                            } catch (e) {
                                console.error("❌ Failed to execute solve-all-comments:", e);
                            }
                        }
                    }, 100);
                    
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
            
            // Get comments data if provided
            const commentsData = msg.payload?.commentsData || msg.payload?.comments || null;

            console.log("🟦 Applying LOAD_CONTENT to CKEditor…", commentsData ? `(with ${commentsData.length} comments)` : "(no comments data)");

            // ⭐ Populate comments store BEFORE setting HTML
            // This way, when CKEditor parses the markers, the adapter can find the data
            if (commentsData && commentsData.length > 0) {
                window._commentsStore = window._commentsStore || {};
                commentsData.forEach(thread => {
                    window._commentsStore[thread.threadId] = thread;
                    console.log(`📦 Stored thread in _commentsStore: ${thread.threadId}`);
                });
                console.log(`📥 Loaded ${commentsData.length} comment thread(s) into store`);
            }

            try {
                if (!window.editor || typeof window.editor.setData !== "function") {
                    console.warn("⚠️ Editor not ready — caching LOAD_CONTENT");
                    window._pendingLoadContent = safeHtml;
                    window._pendingCommentsData = commentsData;
                    return;
                }

                window.suppressEditorEvents = true;
                window.editor.setData(safeHtml);
                window.suppressEditorEvents = false;

                console.log("✔️ CKEditor content updated by Bubble (early listener)");
            } catch (err) {
                console.error("❌ Failed setData, caching instead:", err);
                window._pendingLoadContent = safeHtml;
                window._pendingCommentsData = commentsData;
            }
        }
        
        // Handle GET_DOCUMENT_ID request from Bubble
        if (msg.type === "GET_DOCUMENT_ID") {
            console.log("📤 Responding with current document ID:", DOCUMENT_ID);
            try {
                window.parent.postMessage({
                    bridge: BRIDGE_ID_OUT,
                    type: "DOCUMENT_ID",
                    payload: { documentId: DOCUMENT_ID }
                }, "*");
            } catch (e) {
                console.error("❌ Failed to send DOCUMENT_ID:", e);
            }
        }
        
        // Handle GET_COMMENTS request from Bubble
        if (msg.type === "GET_COMMENTS") {
            console.log("📤 Responding with current comments data");
            try {
                let commentsData = [];
                if (window.editor) {
                    // Try the function or the window global
                    if (typeof extractCommentsData === 'function') {
                        commentsData = extractCommentsData(window.editor);
                    } else if (window.extractCommentsData) {
                        commentsData = window.extractCommentsData();
                    }
                }
                window.parent.postMessage({
                    bridge: BRIDGE_ID_OUT,
                    type: "COMMENTS_DATA",
                    payload: { commentsData }
                }, "*");
            } catch (e) {
                console.error("❌ Failed to send COMMENTS_DATA:", e);
            }
        }
    });
})();

// Check for pending HTML and comments from a document switch
(function checkPendingData() {
    const pendingHtml = sessionStorage.getItem('pendingHtml');
    const pendingComments = sessionStorage.getItem('pendingComments');
    
    if (pendingHtml) {
        console.log("📄 Found pending HTML from document switch");
        window._pendingLoadContent = pendingHtml;
        sessionStorage.removeItem('pendingHtml');
    }
    
    if (pendingComments) {
        console.log("📄 Found pending comments from document switch");
        try {
            window._pendingCommentsData = JSON.parse(pendingComments);
            // Also populate the store
            window._commentsStore = window._commentsStore || {};
            window._pendingCommentsData.forEach(thread => {
                window._commentsStore[thread.threadId] = thread;
            });
        } catch (e) {
            console.warn("⚠️ Could not parse pending comments:", e);
        }
        sessionStorage.removeItem('pendingComments');
    }
})();

/*
 * ============================================================
 * COMMENTS PERSISTENCE DOCUMENTATION
 * ============================================================
 * 
 * Comments are stored locally (in Bubble) via the CommentsAdapter.
 * The adapter intercepts all comment operations and stores them
 * in window._commentsStore, which is synced to Bubble via CONTENT_UPDATE.
 * 
 * SAVING COMMENTS:
 * ----------------
 * When the document changes, CONTENT_UPDATE is sent with:
 * {
 *   bridge: "CKE_BUBBLE_MINI_V1",
 *   type: "CONTENT_UPDATE",
 *   payload: {
 *     html: "<p>Document with <comment-start>markers</comment-end>...</p>",
 *     commentsData: [
 *       {
 *         threadId: "abc123",
 *         comments: [
 *           { id: "c1", content: "Please fix this", authorId: "user-1", createdAt: "..." }
 *         ]
 *       }
 *     ]
 *   }
 * }
 * 
 * LOADING COMMENTS:
 * -----------------
 * When loading a document, send both HTML and comments:
 * {
 *   bridge: "CKE_BUBBLE_BRIDGE_V1",
 *   type: "LOAD_CONTENT",
 *   payload: {
 *     html: "<p>Document with <comment-start>markers</comment-end>...</p>",
 *     commentsData: [ ... same format as saved ... ]
 *   }
 * }
 * 
 * ============================================================
 */

// --------------------------------------------------------
// Apply pending content once the REAL editor exists
// --------------------------------------------------------
function applyPendingLoad() {
    if (!window._pendingLoadContent && !window._pendingCommentsData) {
        console.log("ℹ️ No pending LOAD_CONTENT to apply");
        return;
    }

    if (!window.editor || typeof window.editor.setData !== "function") {
        console.warn("⚠️ Editor still not ready in applyPendingLoad()");
        return;
    }

    console.log("🟦 Applying delayed LOAD_CONTENT...");

    try {
        // Populate comments store BEFORE setting HTML
        if (window._pendingCommentsData && window._pendingCommentsData.length > 0) {
            console.log(`📥 Loading ${window._pendingCommentsData.length} pending comment thread(s) into store`);
            window._commentsStore = window._commentsStore || {};
            window._pendingCommentsData.forEach(thread => {
                window._commentsStore[thread.threadId] = thread;
                console.log(`📦 Stored thread: ${thread.threadId}`);
            });
            window._pendingCommentsData = null;
        }

        if (window._pendingLoadContent) {
            window.suppressEditorEvents = true;
            window.editor.setData(window._pendingLoadContent);
            window.suppressEditorEvents = false;
        }
    } catch (err) {
        console.error("❌ Failed to applyPendingLoad:", err);
        return;
    } finally {
        window._pendingLoadContent = null;
    }
}

// --------------------------------------------------------
// ENV VARIABLES
// --------------------------------------------------------
const LICENSE_KEY =
    'eyJhbGciOiJFUzI1NiJ9.eyJleHAiOjE3NjkxMjYzOTksImp0aSI6IjNkODFjODY3LTU5YzMtNDEyMi05Y2E4LWE0ZGZmYzBiMmQ2YiIsInVzYWdlRW5kcG9pbnQiOiJodHRwczovL3Byb3h5LWV2ZW50LmNrZWRpdG9yLmNvbSIsImRpc3RyaWJ1dGlvbkNoYW5uZWwiOlsiY2xvdWQiLCJkcnVwYWwiLCJzaCJdLCJ3aGl0ZUxhYmVsIjp0cnVlLCJsaWNlbnNlVHlwZSI6InRyaWFsIiwiZmVhdHVyZXMiOlsiKiJdLCJ2YyI6IjI5MGM2MjE4In0.Py_jCZW2O2vLnuwK31B2pBI_VzVW3eeiS8Hq2L1_iBIEhETKVp2aptdYagVhjpsSRtXxPBtsFOYNxJNVdy9jhg';

const TOKEN_URL =
    'https://z8dxtf531r8r.cke-cs.com/token/dev/964182ea8985c7caa8c0a9a9f8d46ea000ed7a80e03b1346dda73b0d1e83?limit=10';

const WEBSOCKET_URL = "wss://z8dxtf531r8r.cke-cs.com/ws";

// Get document ID from URL parameter, or use default
// URL format: ?docId=unique-document-id
function getDocumentId() {
    const urlParams = new URLSearchParams(window.location.search);
    const docId = urlParams.get('docId') || urlParams.get('documentId') || urlParams.get('channelId');
    if (docId) {
        console.log("📄 Document ID from URL:", docId);
        return docId;
    }
    // Fallback to default (for testing)
    console.log("📄 Using default document ID (no URL param)");
    return "fv-doc-default";
}

const DOCUMENT_ID = getDocumentId();

document.addEventListener("DOMContentLoaded", () => {
    console.log("🟩 DOM READY");
    
    // ⭐ Inject CSS for comment styling
    const style = document.createElement('style');
    style.textContent = `
        /* Remove grey background from annotations sidebar */
        .ck-sidebar,
        .ck-sidebar__wrapper,
        #editor-annotations,
        .ck-annotation-wrapper,
        .ck-annotations__container {
            background: transparent !important;
            background-color: transparent !important;
            border: none !important;
            box-shadow: none !important;
        }
        
        /* Make comment thread background white */
        .ck-thread,
        .ck-comment,
        .ck-annotation {
            background: #ffffff !important;
            background-color: #ffffff !important;
        }
        
        /* Make comment edit field white when editing */
        .ck-comment__input-wrapper,
        .ck-comment__input,
        .ck-comment-input,
        .ck-thread .ck-editor__editable,
        .ck-comment .ck-editor__editable,
        .ck-annotation .ck-editor__editable,
        .ck-comment__input-wrapper .ck-editor__editable,
        .ck-editor__editable.ck-editor__editable_inline {
            background-color: #ffffff !important;
            background: #ffffff !important;
        }
        
        /* Ensure focused state is also white */
        .ck-editor__editable:focus,
        .ck-editor__editable_focused {
            background-color: #ffffff !important;
            background: #ffffff !important;
        }
    `;
    document.head.appendChild(style);
    console.log("🎨 Comment styling CSS injected");
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

// --------------------------------------------------------
// ⭐ COMMENTS ADAPTER - Stores comments locally instead of cloud
// --------------------------------------------------------
class CommentsIntegration extends Plugin {
    static get requires() {
        return ['CommentsRepository'];
    }

    static get pluginName() {
        return 'CommentsIntegration';
    }

    init() {
        const editor = this.editor;
        const commentsRepository = editor.plugins.get('CommentsRepository');

        // Initialize the store
        window._commentsStore = window._commentsStore || {};

        console.log("🔧 Setting up CommentsAdapter...");

        /**
         * Helper: Find the actual key in _commentsStore using flexible matching
         * Handles cases where IDs have/don't have suffixes
         */
        function findThreadKey(threadId) {
            // Try exact match first
            if (window._commentsStore[threadId]) {
                return threadId;
            }
            
            // Flexible matching
            for (const key of Object.keys(window._commentsStore)) {
                // Check if stored key starts with requested ID
                if (key.startsWith(threadId + ':') || key.startsWith(threadId)) {
                    return key;
                }
                // Check if requested ID starts with stored key
                if (threadId.startsWith(key + ':') || threadId.startsWith(key)) {
                    return key;
                }
                // Check base ID match (everything before first colon)
                const storedBase = key.split(':')[0];
                const requestedBase = threadId.split(':')[0];
                if (storedBase === requestedBase) {
                    return key;
                }
            }
            
            return null;
        }

        // Set up the adapter - this overrides cloud storage
        commentsRepository.adapter = {
            /**
             * Called when CKEditor needs comment thread data
             * This happens when HTML contains comment markers
             */
            getCommentThread: ({ threadId }) => {
                console.log(`🔍 Adapter: getCommentThread(${threadId})`);
                
                // Try exact match first
                let stored = window._commentsStore[threadId];
                
                // If not found, try flexible matching
                if (!stored) {
                    // CKEditor might ask for base ID, but we stored with suffix
                    // Or vice versa
                    for (const key of Object.keys(window._commentsStore)) {
                        // Check if stored key starts with requested ID
                        if (key.startsWith(threadId + ':') || key.startsWith(threadId)) {
                            stored = window._commentsStore[key];
                            console.log(`🔍 Flexible match: ${threadId} → ${key}`);
                            break;
                        }
                        // Check if requested ID starts with stored key
                        if (threadId.startsWith(key + ':') || threadId.startsWith(key)) {
                            stored = window._commentsStore[key];
                            console.log(`🔍 Flexible match: ${threadId} → ${key}`);
                            break;
                        }
                        // Check base ID match (everything before first colon)
                        const storedBase = key.split(':')[0];
                        const requestedBase = threadId.split(':')[0];
                        if (storedBase === requestedBase) {
                            stored = window._commentsStore[key];
                            console.log(`🔍 Base ID match: ${threadId} → ${key}`);
                            break;
                        }
                    }
                }
                
                if (stored) {
                    console.log(`✅ Found stored thread: ${threadId}`, stored);
                    return Promise.resolve({
                        threadId: threadId, // Return the ID that was requested
                        comments: (stored.comments || []).map(c => ({
                            commentId: c.id || c.commentId,
                            authorId: c.authorId || 'user-1',
                            content: c.content || '',
                            createdAt: c.createdAt ? new Date(c.createdAt) : new Date()
                        })),
                        resolvedAt: stored.resolvedAt ? new Date(stored.resolvedAt) : null,
                        resolvedBy: stored.resolvedBy || null,
                        attributes: stored.attributes || {}
                    });
                }
                
                console.log(`⚠️ Thread not found in store: ${threadId}`);
                // Return null to indicate thread doesn't exist
                return Promise.resolve(null);
            },

            /**
             * Called when a new comment thread is created
             */
            addCommentThread: (data) => {
                console.log('📝 Adapter: addCommentThread', data);
                
                const threadId = data.threadId;
                
                // ⭐ Extract anchor text from the marker
                let anchorText = "";
                try {
                    let marker = null;
                    
                    // Try exact match first
                    const markerName = `comment:${threadId}`;
                    marker = editor.model.markers.get(markerName);
                    
                    // If not found, search for marker containing this threadId
                    if (!marker) {
                        for (const m of editor.model.markers) {
                            if (m.name.includes(threadId) || m.name.includes(threadId.split(':')[0])) {
                                marker = m;
                                console.log(`📝 Found marker by search: ${m.name}`);
                                break;
                            }
                        }
                    }
                    
                    if (marker) {
                        const range = marker.getRange();
                        let text = "";
                        for (const item of range.getItems()) {
                            if (item.is('$text') || item.is('$textProxy')) {
                                text += item.data;
                            }
                        }
                        anchorText = text.trim();
                        console.log(`📝 Anchor text for new thread: "${anchorText}"`);
                    } else {
                        console.log(`⚠️ No marker found for thread: ${threadId}`);
                    }
                } catch (err) {
                    console.warn("⚠️ Could not extract anchor text:", err);
                }
                
                // Store locally
                window._commentsStore[threadId] = {
                    threadId: threadId,
                    anchorText: anchorText,
                    comments: (data.comments || []).map(c => ({
                        id: c.commentId,
                        content: c.content,
                        authorId: c.authorId || 'user-1',
                        authorName: 'Demo User 1',
                        createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString()
                    })),
                    isResolved: false,
                    resolvedAt: null,
                    resolvedBy: null,
                    attributes: data.attributes || {}
                };
                
                // Trigger update to Bubble
                triggerContentUpdate(editor);
                
                return Promise.resolve({
                    threadId: threadId,
                    comments: data.comments || []
                });
            },

            /**
             * Called when a comment is added to existing thread
             */
            addComment: (data) => {
                console.log('📝 Adapter: addComment', data);
                
                // Flexible matching for threadId
                const threadKey = findThreadKey(data.threadId);
                const thread = threadKey ? window._commentsStore[threadKey] : null;
                
                if (thread) {
                    const newComment = {
                        id: data.commentId,
                        content: data.content,
                        authorId: data.authorId || 'user-1',
                        authorName: 'Demo User 1',
                        createdAt: new Date().toISOString()
                    };
                    thread.comments = thread.comments || [];
                    thread.comments.push(newComment);
                    console.log(`✅ Added comment to thread ${threadKey}`);
                }
                
                // Trigger update to Bubble
                triggerContentUpdate(editor);
                
                return Promise.resolve({
                    createdAt: new Date()
                });
            },

            /**
             * Called when a comment is updated
             */
            updateComment: (data) => {
                console.log('📝 Adapter: updateComment', data);
                
                // Flexible matching for threadId
                const threadKey = findThreadKey(data.threadId);
                const thread = threadKey ? window._commentsStore[threadKey] : null;
                
                if (thread && thread.comments) {
                    const comment = thread.comments.find(c => c.id === data.commentId);
                    if (comment && data.content !== undefined) {
                        comment.content = data.content;
                        console.log(`✅ Updated comment in thread ${threadKey}`);
                    }
                }
                
                // Trigger update to Bubble
                triggerContentUpdate(editor);
                
                return Promise.resolve();
            },

            /**
             * Called when a comment is removed
             */
            removeComment: (data) => {
                console.log('📝 Adapter: removeComment', data);
                
                // Flexible matching for threadId
                const threadKey = findThreadKey(data.threadId);
                const thread = threadKey ? window._commentsStore[threadKey] : null;
                
                if (thread && thread.comments) {
                    thread.comments = thread.comments.filter(c => c.id !== data.commentId);
                    console.log(`✅ Removed comment ${data.commentId} from thread ${threadKey}`);
                }
                
                // Trigger update to Bubble
                triggerContentUpdate(editor);
                
                return Promise.resolve();
            },

            /**
             * Called when a thread is removed
             */
            removeCommentThread: (data) => {
                console.log('📝 Adapter: removeCommentThread', data);
                
                // Flexible matching for threadId
                const threadKey = findThreadKey(data.threadId);
                if (threadKey) {
                    delete window._commentsStore[threadKey];
                    console.log(`✅ Removed thread ${threadKey}`);
                }
                
                // Trigger update to Bubble
                triggerContentUpdate(editor);
                
                return Promise.resolve();
            },

            /**
             * Called when a thread is resolved
             */
            resolveCommentThread: (data) => {
                console.log('📝 Adapter: resolveCommentThread', data);
                
                // Flexible matching for threadId
                const threadKey = findThreadKey(data.threadId);
                const thread = threadKey ? window._commentsStore[threadKey] : null;
                
                if (thread) {
                    thread.isResolved = true;
                    thread.resolvedAt = new Date().toISOString();
                    thread.resolvedBy = 'user-1';
                    console.log(`✅ Resolved thread ${threadKey}`);
                }
                
                // Trigger update to Bubble
                triggerContentUpdate(editor);
                
                return Promise.resolve({
                    resolvedAt: new Date(),
                    resolvedBy: 'user-1'
                });
            },

            /**
             * Called when a resolved thread is reopened
             */
            reopenCommentThread: (data) => {
                console.log('📝 Adapter: reopenCommentThread', data);
                
                // Flexible matching for threadId
                const threadKey = findThreadKey(data.threadId);
                const thread = threadKey ? window._commentsStore[threadKey] : null;
                
                if (thread) {
                    thread.isResolved = false;
                    thread.resolvedAt = null;
                    thread.resolvedBy = null;
                    console.log(`✅ Reopened thread ${threadKey}`);
                }
                
                // Trigger update to Bubble
                triggerContentUpdate(editor);
                
                return Promise.resolve();
            },

            /**
             * Called to update thread attributes
             */
            updateCommentThread: (data) => {
                console.log('📝 Adapter: updateCommentThread', data);
                
                // Flexible matching for threadId
                const threadKey = findThreadKey(data.threadId);
                const thread = threadKey ? window._commentsStore[threadKey] : null;
                
                if (thread && data.attributes) {
                    thread.attributes = { ...thread.attributes, ...data.attributes };
                    console.log(`✅ Updated attributes for thread ${threadKey}`);
                }
                
                // Trigger update to Bubble
                triggerContentUpdate(editor);
                
                return Promise.resolve();
            }
        };

        console.log('✅ CommentsAdapter configured - comments will be stored locally');
    }
}

/**
 * Helper to trigger CONTENT_UPDATE after comment changes
 * Only sends unresolved comments to Bubble
 */
function triggerContentUpdate(editor) {
    // Small delay to let CKEditor finish its internal updates
    setTimeout(() => {
        if (editor && typeof editor.getData === 'function') {
            const html = editor.getData();
            // Filter to only unresolved comments
            const allComments = Object.values(window._commentsStore || {});
            const unresolvedComments = allComments.filter(t => !t.isResolved);
            
            window.sendToParent("CONTENT_UPDATE", { 
                html: html,
                commentsData: unresolvedComments
            });
            
            console.log(`🟧 CONTENT_UPDATE: ${html.slice(0, 80)}... (${unresolvedComments.length} unresolved / ${allComments.length} total comments)`);
        }
    }, 100);
}

// --------------------------------------------------------
// Helper: send message to Bubble parent
// --------------------------------------------------------
if (typeof window.sendToParent !== "function") {
    window.sendToParent = function (type, payload = {}) {
        const message = {
            bridge: BRIDGE_ID_OUT,  // Use outgoing bridge ID
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

// --------------------------------------------------------
// COMMENTS PERSISTENCE - Extract for external use
// --------------------------------------------------------

/**
 * Extract all comments data for external storage
 * Returns an array of thread objects that can be JSON.stringify'd
 */
function extractCommentsData(editor) {
    // Use the local store directly since that's our source of truth
    const commentsData = Object.values(window._commentsStore || {});
    console.log(`📤 Extracted ${commentsData.length} comment thread(s) from store`);
    return commentsData;
}

// Make functions available globally for Bubble
window.extractCommentsData = function() {
    if (window.editor) {
        return extractCommentsData(window.editor);
    }
    return Object.values(window._commentsStore || {});
};

window.loadCommentsData = function(data) {
    if (!data || !Array.isArray(data)) return;
    window._commentsStore = window._commentsStore || {};
    data.forEach(thread => {
        window._commentsStore[thread.threadId] = thread;
    });
    console.log(`📥 Loaded ${data.length} threads into store`);
};

function formatCommentsForAI(editor) {
    const threads = Object.values(window._commentsStore || {});

    console.log("🔍 Total threads found:", threads.length);

    if (!threads.length) return "No comments found.";

    const lines = [];
    let idx = 0;
    let skippedResolved = 0;

    for (const thread of threads) {
        const isResolved = thread.isResolved === true;
        const threadId = thread.threadId;

        if (isResolved) {
            skippedResolved++;
            console.log(`⏭️ Skipping resolved thread: ${threadId}`);
            continue;
        }

        const comments = thread.comments || [];
        const commentLines = [];

        for (const c of comments) {
            let content = safeString(c.content || "");
            content = content.replace(/<[^>]*>/g, '').replace(/\s+/g, " ").trim();
            if (!content) continue;
            commentLines.push(content);
        }

        if (commentLines.length === 0) {
            console.warn(`⚠️ Thread ${threadId} has no readable comments, skipping`);
            continue;
        }

        idx += 1;

        // Try to get the highlighted text for this thread
        let highlightedText = thread.anchorText || "";
        if (!highlightedText && editor) {
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
                // Silently ignore
            }
        }

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
    
    // ⭐ Use flexible matching to find the thread
    let thread = window._commentsStore[threadId];
    if (!thread) {
        // Try flexible matching
        for (const key of Object.keys(window._commentsStore)) {
            const storedBase = key.split(':')[0];
            const requestedBase = threadId.split(':')[0];
            if (storedBase === requestedBase || key.startsWith(threadId) || threadId.startsWith(key)) {
                thread = window._commentsStore[key];
                console.log(`🔍 Found thread by flexible match: ${key}`);
                break;
            }
        }
    }
    
    if (!thread) {
        console.warn("⚠️ Thread not found in store");
        return;
    }
    
    // Extract comment text
    const comments = thread.comments || [];
    const commentLines = [];
    
    for (const c of comments) {
        let content = safeString(c.content || "");
        content = content.replace(/<[^>]*>/g, '').replace(/\s+/g, " ").trim();
        if (!content) continue;
        commentLines.push(content);
    }
    
    if (commentLines.length === 0) {
        console.warn("⚠️ No comments found");
        return;
    }
    
    const commentText = commentLines.join('; ');
    
    // Get the highlighted text
    let highlightedText = thread.anchorText || "";
    if (!highlightedText) {
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
                console.log("🟦 Highlighted text:", highlightedText);
            }
        } catch (err) {
            console.warn("⚠️ Error getting highlighted text:", err);
        }
    }
    
    window._singleThreadToResolve = threadId;
    
    // Build prompt
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
        if (!aiChat) {
            console.warn("⚠️ AIChat plugin not available");
            return;
        }
        
        // ⭐ Check if AI panel is actually visible in DOM
        const aiRootBefore = findAIChatRoot();
        const isActuallyVisible = aiRootBefore && aiRootBefore.offsetParent !== null;
        
        console.log("🟪 AI Panel state:", { 
            aiRootExists: !!aiRootBefore,
            isActuallyVisible: isActuallyVisible
        });
        
        // ⭐ Only open if NOT actually visible in DOM
        if (!isActuallyVisible) {
            console.log("🟪 Opening AI panel...");
            editor.execute('toggleAi');
            await new Promise(resolve => setTimeout(resolve, 800));
        } else {
            console.log("🟪 AI panel already visible, skipping toggle");
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Verify panel is now open
        let aiRoot = findAIChatRoot();
        if (!aiRoot || aiRoot.offsetParent === null) {
            console.log("🟪 AI panel still not visible, trying to open...");
            editor.execute('toggleAi');
            await new Promise(resolve => setTimeout(resolve, 800));
            aiRoot = findAIChatRoot();
        }
        
        if (!aiRoot) {
            console.warn("⚠️ AI chat root not found after multiple attempts");
            return;
        }
        
        const composer = findAIChatComposer(aiRoot);
        if (!composer) {
            console.warn("⚠️ AI chat composer not found");
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
class CustomCommentThreadView extends BaseCommentThreadView {
    constructor(...args) {
        super(...args);

        const bind = this.bindTemplate;

        console.log("🟦 CustomCommentThreadView constructor called");
        console.log("🟦 Thread length:", this.length);

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

        this.on('render', () => {
            if (this.length > 0) {
                this._injectDropdown();
            }
        });

        this.listenTo(this.commentsListView.commentViews, 'add', () => {
            console.log("🟦 Comment added to thread, length now:", this.length);
            this._injectDropdown();
            this._modifyFirstCommentView();
        });

        if (this.length > 0) {
            this.on('render', () => {
                this._modifyFirstCommentView();
            });
        }
    }

    _injectDropdown() {
        if (!this.element) return;
        
        if (this.element.querySelector('.ck-thread-top-bar')) {
            return;
        }
        
        const placeholder = this.element.querySelector('.ck-thread-top-bar-placeholder');
        if (!placeholder) return;
        
        const dropdown = this._createActionsDropdown();
        if (!dropdown) return;
        
        dropdown.render();
        
        const topBar = document.createElement('div');
        topBar.className = 'ck-thread-top-bar';
        topBar.appendChild(dropdown.element);
        
        placeholder.replaceWith(topBar);
        
        console.log("✅ Dropdown injected into thread");
    }

    _createActionsDropdown() {
        if (!createDropdown || !ListView || !ListItemView || !ButtonView) {
            console.error("❌ Missing UI classes");
            return null;
        }

        const dropdown = createDropdown(this.locale);
        
        dropdown.buttonView.set({
            label: 'Actions',
            withText: true,
            tooltip: true
        });

        const listView = new ListView(this.locale);
        
        // Fix with AI button
        const fixWithAIItem = new ListItemView(this.locale);
        const fixWithAIButton = new ButtonView(this.locale);
        fixWithAIButton.set({
            label: '✨ Fix with AI',
            withText: true
        });
        fixWithAIButton.on('execute', () => {
            const threadId = this._model.id;
            console.log("🟦 Fix with AI clicked for thread:", threadId);
            dropdown.isOpen = false;
            
            if (window.editor) {
                // ⭐ Hide the comment thread by moving selection away
                try {
                    // Move cursor to start of document to deselect the comment
                    window.editor.model.change(writer => {
                        const root = window.editor.model.document.getRoot();
                        const position = writer.createPositionAt(root, 0);
                        writer.setSelection(position);
                    });
                    console.log("🟦 Moved selection to deselect comment thread");
                } catch (e) {
                    console.warn("⚠️ Could not deselect thread:", e);
                }
                
                handleFixWithAI(window.editor, threadId);
            }
        });
        fixWithAIItem.children.add(fixWithAIButton);
        listView.items.add(fixWithAIItem);

        // Edit button
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

        // Resolve button
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

        // Delete button
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

        // Store the thread IDs we're solving
        const threads = Object.values(window._commentsStore || {});
        const openThreadIds = threads
            .filter(t => !t.isResolved)
            .map(t => t.threadId);

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

            // ⭐ Hide the quick actions menu/dropdown
            try {
                const dropdowns = document.querySelectorAll('.ck-dropdown__panel, .ck-balloon-panel');
                dropdowns.forEach(panel => {
                    if (panel.classList.contains('ck-dropdown__panel')) {
                        panel.classList.add('ck-hidden');
                    }
                });
                
                // Also try clicking outside to close any open menus
                const quickActionsDropdown = document.querySelector('.ck-ai-quick-actions-dropdown');
                if (quickActionsDropdown) {
                    const dropdown = quickActionsDropdown.closest('.ck-dropdown');
                    if (dropdown && dropdown._dropdown) {
                        dropdown._dropdown.isOpen = false;
                    }
                }
                
                console.log("🟪 Attempted to close quick actions menu");
            } catch (e) {
                console.warn("⚠️ Could not close quick actions menu:", e);
            }

            // ⭐ Check if AI panel is actually visible in DOM (same as Fix with AI)
            const aiRootBefore = findAIChatRoot();
            const isActuallyVisible = aiRootBefore && aiRootBefore.offsetParent !== null;
            
            console.log("🟪 AI Panel state:", { 
                aiRootExists: !!aiRootBefore,
                isActuallyVisible: isActuallyVisible
            });
            
            // ⭐ Only open if NOT actually visible in DOM
            if (!isActuallyVisible) {
                console.log("🟪 Opening AI panel...");
                editor.execute('toggleAi');
                await new Promise(resolve => setTimeout(resolve, 800));
            } else {
                console.log("🟪 AI panel already visible, skipping toggle");
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // Verify panel is now open
            let aiRoot = findAIChatRoot();
            if (!aiRoot || aiRoot.offsetParent === null) {
                console.log("🟪 AI panel still not visible, trying to open...");
                editor.execute('toggleAi');
                await new Promise(resolve => setTimeout(resolve, 800));
                aiRoot = findAIChatRoot();
            }
            
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
                console.warn("⚠️ Send button is disabled");
            } else {
                console.warn("⚠️ Could not find send button");
            }

        } catch (e) {
            console.error("❌ Failed to trigger AI chat:", e);
        }
    }
}

// --------------------------------------------------------
// AI CHAT COMMENTS INJECTION
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
            console.log("🟪 Skipping comments injection");
            window._skipNextCommentsInjection = false;
            return true;
        }
        
        const composer = findAIChatComposer(aiRoot);
        if (!composer) return false;

        const current =
            composer.kind === "textarea"
                ? safeString(composer.el.value)
                : safeString(composer.el.textContent || "");

        if (!current.toLowerCase().includes('comment')) {
            console.log("🟪 No 'comment' keyword found - skipping injection");
            return false;
        }

        const cleaned = stripPreviousInjectedCommentsBlock(current);
        const injected = buildInjectedCommentsBlock(editor) + cleaned;

        if (composer.kind === "textarea") {
            composer.el.value = injected;
        } else {
            composer.el.textContent = injected;
        }

        console.log("🟪 Injected comments context");
        return true;
    } catch (e) {
        console.warn("⚠️ Failed injecting comments:", e);
        return false;
    }
}

function tryBindAIChatSubmitInjection(editor) {
    const aiRoot = findAIChatRoot();
    if (!aiRoot) return false;

    if (aiRoot.__fvCommentsInjectionBound) return true;
    aiRoot.__fvCommentsInjectionBound = true;

    console.log("🟪 Bound AI chat events");

    const form = aiRoot.querySelector("form");
    if (form) {
        form.addEventListener("submit", () => injectCommentsIntoComposer(editor, aiRoot), true);
    }

    aiRoot.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            injectCommentsIntoComposer(editor, aiRoot);
        }
    }, true);

    aiRoot.addEventListener("click", (e) => {
        const btn = e.target?.closest?.("button");
        if (!btn) return;
        const label = (btn.getAttribute("aria-label") || btn.title || btn.textContent || "").toLowerCase();
        if (label.includes("send") || label.includes("submit") || btn.type === "submit") {
            injectCommentsIntoComposer(editor, aiRoot);
        }
    }, true);

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
        try { observer.disconnect(); } catch (e) {}
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
console.log("📄 Using Document/Channel ID:", DOCUMENT_ID);

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
        }

        applyPendingLoad();

        // ⭐ Trigger initial CONTENT_UPDATE to populate Bubble state
        setTimeout(() => {
            const html = editor.getData();
            const commentsData = Object.values(window._commentsStore || {});
            console.log("🟧 INITIAL CONTENT_UPDATE:", html.slice(0, 80), `(${commentsData.length} comments)`);
            window.sendToParent("CONTENT_UPDATE", { 
                html,
                commentsData
            });
        }, 500);

        // Close AI panel on initial load
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
            setTimeout(() => forceHidePanel(), 100);

            editor.editing.view.once("render", () => {
                forceHidePanel();
                setTimeout(() => {
                    forceHidePanel();
                    setTimeout(() => {
                        console.log("🟪 Initial load complete - AI panel can now be opened by user");
                    }, 500);
                }, 200);
            });

            // ⭐ Watch for AI panel visibility changes and toggle class
            const editorContainer = document.querySelector('.editor-container_document-editor') || 
                                   document.querySelector('#editor-container');
            
            if (editorContainer) {
                const checkAIPanelVisibility = () => {
                    const aiPanel = document.querySelector('.ck-ai-tabs__overlay');
                    
                    // Check multiple ways if panel is visible
                    let isVisible = false;
                    if (aiPanel) {
                        const style = window.getComputedStyle(aiPanel);
                        const hasWidth = aiPanel.offsetWidth > 0;
                        const hasHeight = aiPanel.offsetHeight > 0;
                        const notHidden = style.display !== 'none' && style.visibility !== 'hidden';
                        isVisible = hasWidth && hasHeight && notHidden;
                    }
                    
                    const currentlyOpen = editorContainer.classList.contains('ai-panel-open');
                    
                    if (isVisible && !currentlyOpen) {
                        editorContainer.classList.add('ai-panel-open');
                        console.log("🟪 AI panel OPENED - sidebar expanded");
                    } else if (!isVisible && currentlyOpen) {
                        editorContainer.classList.remove('ai-panel-open');
                        console.log("🟪 AI panel CLOSED - sidebar narrowed");
                    }
                };
                
                // Check periodically
                setInterval(checkAIPanelVisibility, 200);
                
                // Also check on mutations
                const observer = new MutationObserver(() => {
                    setTimeout(checkAIPanelVisibility, 50);
                });
                observer.observe(document.body, { 
                    childList: true, 
                    subtree: true, 
                    attributes: true,
                    attributeFilter: ['class', 'style']
                });
                
                // Initial check
                checkAIPanelVisibility();
                
                console.log("🟪 AI panel visibility watcher installed");
            } else {
                console.warn("⚠️ Could not find editor container for AI panel watcher");
            }

        } catch (e) {
            console.warn("⚠️ Could not hide AI panel:", e);
        }

        // Listen for solve-all-comments clicks
        try {
            document.addEventListener('click', (e) => {
                const button = e.target?.closest('button');
                if (!button) return;
                
                const text = button.textContent || button.getAttribute('aria-label') || '';
                
                if (text.toLowerCase().includes('solve all comments')) {
                    console.log("🟦 Solve all comments button clicked");
                    
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

        // Auto-resolve comments after AI applies changes
        try {
            document.addEventListener('click', async (e) => {
                const button = e.target?.closest('button');
                if (!button) return;
                
                const text = (button.textContent || '').toLowerCase().trim();
                const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
                const title = (button.title || '').toLowerCase();
                const allText = `${text} ${ariaLabel} ${title}`;
                
                const isApplyButton = 
                    allText.includes('apply all') ||
                    allText.includes('apply change') ||
                    allText.includes('accept all') ||
                    allText.includes('accept change') ||
                    (allText.includes('apply') && !allText.includes('cancel')) ||
                    (allText.includes('accept') && !allText.includes('cancel')) ||
                    button.classList.contains('ck-ai-apply-button') ||
                    button.closest('.ck-ai-form__actions')?.contains(button);
                
                if (isApplyButton) {
                    console.log("🟦 Detected apply/accept button click:", text || ariaLabel);
                    
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
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
                    const repo = getCommentsRepository(editor);
                    
                    for (const threadId of threadsToResolve) {
                        try {
                            // Update the store
                            if (window._commentsStore[threadId]) {
                                window._commentsStore[threadId].isResolved = true;
                                window._commentsStore[threadId].resolvedAt = new Date().toISOString();
                                window._commentsStore[threadId].resolvedBy = 'user-1';
                                resolved++;
                                console.log(`✅ Resolved thread ${threadId} in store`);
                            }
                            
                            // Also try to resolve via repository
                            if (repo) {
                                const thread = repo.getCommentThread ? repo.getCommentThread(threadId) : null;
                                if (thread && typeof thread.resolve === 'function') {
                                    thread.resolve();
                                }
                            }
                        } catch (err) {
                            console.warn(`⚠️ Failed to resolve thread ${threadId}:`, err);
                        }
                    }
                    
                    console.log(`🟩 Resolved ${resolved}/${threadsToResolve.length} comment thread(s)`);
                    
                    // Trigger update to Bubble
                    triggerContentUpdate(editor);
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
            const commentsData = Object.values(window._commentsStore || {});
            
            console.log("🟧 CONTENT_UPDATE:", html.slice(0, 120), `(${commentsData.length} comments)`);
            window.sendToParent("CONTENT_UPDATE", { 
                html,
                commentsData
            });
        });
    })
    .catch((err) => {
        console.error("❌ EDITOR INIT FAILED:", err);
    });

function configUpdateAlert() {}