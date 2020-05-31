"use strict";

const DEBUG = process.env.NODE_ENV != "production";

exports.TITLE = "Popcord";

if (DEBUG) {
    exports.WEB_URL = "http://localhost:3100";
    exports.SOCKET_URL = "ws://localhost:3101";
} else {
    exports.WEB_URL = "https://popcord.aduros.com";
    exports.SOCKET_URL = "wss://popcord.aduros.com/socketserver/";
}
