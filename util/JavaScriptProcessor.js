const fs = require("fs");
const path = require("path");
const {promises: fsPromises} = fs;
const babel = require("babel-core");
let uglify;
try {
    // gulp-uglify depends on uglify-js, which we reuse directly when available
    uglify = require("uglify-js");
} catch (err) {
    uglify = null;
}

class JavaScriptProcessor {
    constructor(app) {
        this.app = app;
        this.paths = {
            scripts: {
                built: path.resolve(__dirname, "../public/js/build"),
                src: path.resolve(__dirname, "../client/js")
            }
        };
        this.watchers = [];
        this._buildPromise = Promise.resolve();
    }

    async compileAllScripts() {
        const files = await fsPromises.readdir(this.paths.scripts.src);
        await fsPromises.mkdir(this.paths.scripts.built, {recursive: true});
        const compilations = files.filter(file => file.endsWith(".js")).map(file => this.compileSingleFile(file));
        await Promise.all(compilations);
    }

    async compileSingleFile(file) {
        const sourcePath = path.join(this.paths.scripts.src, file);
        const destinationPath = path.join(this.paths.scripts.built, file);
        const rawSource = await fsPromises.readFile(sourcePath, "utf8");
        const transform = babel.transform(rawSource, {
            presets: ["es2015", "es2016", "es2017"],
            sourceMaps: true,
            filename: file
        });

        let outputCode = transform.code;
        let sourceMap = transform.map;

        if (!this.app.config.debug && uglify) {
            const minified = uglify.minify(outputCode, {
                sourceMap: {
                    content: sourceMap,
                    url: `${path.basename(file)}.map`
                }
            });
            if (minified.error) {
                throw minified.error;
            }
            outputCode = minified.code;
            sourceMap = typeof minified.map === "string" ? JSON.parse(minified.map) : minified.map;
        } else if (!this.app.config.debug && !uglify) {
            this.app.logger.warn("Babel", "Skipping JavaScript minification because uglify-js is unavailable.");
        }

        if (sourceMap && typeof sourceMap === "object") {
            sourceMap.file = path.basename(file);
            if (!Array.isArray(sourceMap.sources) || sourceMap.sources.length === 0) {
                sourceMap.sources = [file];
            }
        }

        const codeWithMapReference = `${outputCode}\n//# sourceMappingURL=${path.basename(file)}.map\n`;
        await fsPromises.writeFile(destinationPath, codeWithMapReference, "utf8");
        if (sourceMap) {
            const mapPayload = typeof sourceMap === "string" ? sourceMap : JSON.stringify(sourceMap);
            await fsPromises.writeFile(`${destinationPath}.map`, mapPayload, "utf8");
        }
    }

    async handleCompilation(action) {
        try {
            if (action === "clean") {
                await fsPromises.rm(this.paths.scripts.built, {recursive: true, force: true});
                return;
            }
            this.app.logger.info('Babel', "Processing JavaScript...");
            await this.compileAllScripts();
            this.app.logger.info('Babel', "Finished processing JavaScript.");
        } catch (error) {
            this.app.reportError("Error while processing JavaScript: " + error);
        }
    }

    scheduleBuild() {
        this._buildPromise = this._buildPromise.then(() => this.handleCompilation("build"));
        return this._buildPromise;
    }

    processJavaScript() {
        return this.scheduleBuild().then(() => this.watchJavaScript());
    }

    cleanJavaScript() {
        return this.handleCompilation("clean");
    }

    watchJavaScript() {
        this.stopWatching();
        try {
            const watcher = fs.watch(this.paths.scripts.src, (eventType, filename) => {
                if (!filename || !filename.endsWith(".js")) {
                    return;
                }
                this.scheduleBuild();
            });
            this.watchers.push(watcher);
            this.app.logger.info('Babel', "Watching JavaScript sources for changes.");
        } catch (error) {
            this.app.reportError("Unable to watch JavaScript sources: " + error);
        }
    }

    stopWatching() {
        while (this.watchers.length) {
            const watcher = this.watchers.pop();
            try {
                watcher.close();
            } catch (err) {
                // ignore watcher cleanup issues
            }
        }
    }
}

JavaScriptProcessor.prototype = Object.create(JavaScriptProcessor.prototype);

module.exports = JavaScriptProcessor;
