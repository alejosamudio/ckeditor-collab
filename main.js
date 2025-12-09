/**
 * CKEditor 5 + Bubble Bridge — AI + Comments + Realtime Ready
 *  - AI enabled (overlay panel on the right)
 *  - Comments + side annotations sidebar
 *  - Realtime-capable (channelId + webSocketUrl)
 *  - Bubble → Editor LOAD_CONTENT support
 *  - Editor → Bubble CONTENT_UPDATE support
 *  - Decoupled editor + menu bar
 */

console.log("🟦 MAIN.JS LOADED");

const BRIDGE_ID = "CKE_BUBBLE_BRIDGE_V1";

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
    "eyJhbGciOiJFUzI1NiJ9.eyJleHAiOjE3NjU0MTExOTksImp0aSI6IjY0MGRjNjNlLWVlOGItNDE1Ny1hZTc2LWVmYzBhNGM3MDVhZSIsInVzYWdlRW5kcG9pbnQiOiJodHRwczovL3Byb3h5LWV2ZW50LmNrZWRpdG9yLmNvbSIsImRpc3RyaWJ1dGlvbkNoYW5uZWwiOlsiY2xvdWQiLCJkcnVwYWwiLCJzaCJdLCJ3aGl0ZUxhYmVsIjp0cnVlLCJsaWNlbnNlVHlwZSI6InRyaWFsIiwiZmVhdHVyZXMiOlsiKiJdLCJ2YyI6ImYxMGQ1MTMyIn0.jsEvYJojhOTd_R0Rdc1KPWrnquUbz0tSdzmvJHldKxoNBWJ3Jl2_TfiqfK_ZNOCVH6um7sgiX_QKwVFG_BYaXw";

const TOKEN_URL =
    "https://8dcvirycnlqo.cke-cs.com/token/dev/be4e0eb6c684c0b6f924971222172b2cad3c53451c5d97bdbe45318d4aec?limit=10";

const WEBSOCKET_URL = "wss://8dcvirycnlqo.cke-cs.com/ws";

// Single document id for now (you can swap this from Bubble later)
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

const {
    AIChat,
    AIEditorIntegration,
    AIQuickActions,
    AIReviewMode,
    PasteFromOfficeEnhanced,
    FormatPainter,
    LineHeight,
    SlashCommand,
    Comments
} = window.CKEDITOR_PREMIUM_FEATURES;

// --------------------------------------------------------
// Users & Comments integration (from builder example)
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

        // TODO: later plug your Bubble user here
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

// You can hook this to your backend later (synchronizing comments).
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
// CONFIGURATION
//  - AI panel = overlay (no external container)
//  - Comments sidebar = #editor-annotations
//  - AI chat groupId = DOCUMENT_ID (fixes ai-chat-missing-channel-id)
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
        // AI + premium
        AIChat,
        AIEditorIntegration,
        AIQuickActions,
        AIReviewMode,
        FormatPainter,
        LineHeight,
        PasteFromOfficeEnhanced,
        SlashCommand,
        Comments,

        // Core + rich text
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

    // AI: overlay panel on the right (OPTION B) + groupId for history
    ai: {
        container: {
            type: "overlay",
            side: "right"
        },
        openOnStart: false,
        chat: {
            // This fixes `ai-chat-missing-channel-id` by grouping by document.
            groupId: DOCUMENT_ID,
            context: {
                document: { enabled: true },
                urls: { enabled: true },
                files: { enabled: true }
            }
        }
    },

    // Inline balloon toolbar for comments + quick AI actions
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
        editorConfig: {
            extraPlugins: [Autoformat, Bold, Italic, List, Mention],
            mention: {
                feeds: [
                    {
                        marker: "@",
                        feed: [
                            // TODO: later plug your Bubble users here
                        ]
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
                feed: [
                    // same as comments feed, you can share later
                ]
            }
        ]
    },

    placeholder: "Type or paste your content here!",

    // Comments sidebar (annotations)
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

        // Attach toolbar + menu bar to external containers
        const toolbarHost = document.querySelector("#editor-toolbar");
        const menuBarHost = document.querySelector("#editor-menu-bar");

        if (toolbarHost) {
            toolbarHost.appendChild(editor.ui.view.toolbar.element);
        }

        if (menuBarHost && editor.ui.view.menuBarView) {
            menuBarHost.appendChild(editor.ui.view.menuBarView.element);
        }

        // Annotations sidebar: use narrow layout as in docs
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

        // Apply any cached LOAD_CONTENT from Bubble
        applyPendingLoad();

        // Close AI panel if it opens by default
        try {
            const aiChat = editor.plugins.get("AIChat");

            if (aiChat && aiChat.ui?.view?.panelView) {
                aiChat.ui.view.panelView.hide();
                console.log("🟪 AI CHAT PANEL HIDDEN (initial)");
            }

            // Some builds may reopen it after first render → close again once
            editor.editing.view.once("render", () => {
                if (aiChat && aiChat.ui?.view?.panelView && aiChat.ui.view.panelView.isVisible) {
                    aiChat.ui.view.panelView.hide();
                    console.log("🟪 AI CHAT PANEL HIDDEN (after render)");
                }
            });
        } catch (e) {
            console.warn("⚠️ Could not hide AI panel:", e);
        }

        // Notify Bubble that iframe + editor are ready
        window.sendToParent("IFRAME_READY", { timestamp: Date.now() });
        window.sendToParent("EDITOR_READY", { timestamp: Date.now() });

        // Editor → Bubble sync
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

// Disable CKEditor "update config" alert (no-op)
function configUpdateAlert() {}
