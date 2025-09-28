const markedModule = require("marked");
const markedInstance = markedModule.marked || markedModule;
const renderer = new markedModule.Renderer();

markedModule.setOptions({
    renderer
});

function renderMarkdown(src, opts, callback) {
    if (typeof opts === "function") {
        callback = opts;
        opts = undefined;
    }

    if (callback) {
        return markedModule.parse(src, opts || {}, callback);
    }

    if (typeof markedInstance.parse === "function") {
        return markedInstance.parse(src, opts);
    }

    return markedInstance(src, opts);
}

Object.assign(renderMarkdown, markedModule);
renderMarkdown.parse = (src, opts, callback) => markedModule.parse(src, opts, callback);

module.exports = renderMarkdown;
