const MongooseStore = require("express-brute-mongoose");
const bruteForceSchema = require("express-brute-mongoose/dist/schema");
const mongoose = require("mongoose");

function RatelimitStore(name = null) {
    const modelName = `bruteforce${name ? `-${name}` : ""}`;
    const model = mongoose.models[modelName] || mongoose.model(modelName, bruteForceSchema);
    return new MongooseStore(model);
}

RatelimitStore.prototype = Object.create(RatelimitStore.prototype);

module.exports = RatelimitStore;
