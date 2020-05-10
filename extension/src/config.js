"use strict";

const DEBUG = process.env.NODE_ENV != "production";

exports.TITLE = "Video Sync";

if (DEBUG) {
    exports.WEB_URL = "http://localhost:3100";
    exports.SOCKET_URL = "ws://localhost:3101";
} else {
    exports.WEB_URL = "https://vidsync.aduros.com";
    exports.SOCKET_URL = "wss://vidsync.aduros.com/socketserver/";
}
