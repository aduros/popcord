"use strict";

module.exports = [{
    entry: "./src/background.js",
    output: {
        filename: "background.js",
        path: __dirname+"/dist",
    },
}, {
    entry: "./src/client.js",
    output: {
        filename: "client.js",
        path: __dirname+"/dist",
    },
}, {
    entry: "./src/popup.js",
    output: {
        filename: "popup.js",
        path: __dirname+"/dist",
    },
}];
