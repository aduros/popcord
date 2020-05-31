"use strict";

const TerserPlugin = require("terser-webpack-plugin");

let plugin = new TerserPlugin({
    terserOptions: {
        compress: {
            drop_console: true,
        },
    },
});

module.exports = [{
    entry: "./src/background.js",
    output: {
        filename: "background.js",
        path: __dirname+"/dist",
    },
    optimization: {
        minimizer: [plugin],
    },
}, {
    entry: "./src/client.js",
    output: {
        filename: "client.js",
        path: __dirname+"/dist",
    },
    optimization: {
        minimizer: [plugin],
    },
}, {
    entry: "./src/popup.js",
    output: {
        filename: "popup.js",
        path: __dirname+"/dist",
    },
    optimization: {
        minimizer: [plugin],
    },
}];
