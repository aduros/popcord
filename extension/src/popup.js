"use strict";

const l10n = require("./l10n");
const messaging = require("./messaging");

function setStatus (connected, count) {
    document.getElementById("status-line").style.display = connected ? "" : "none";
    document.getElementById("status-text").textContent = l10n.getStatusText(count);
}

messaging.exposeFunctions({
    setStatus (sender, {connected, count}, callback) {
        setStatus(connected, count);
        callback();
    },

    onDisconnect (sender, _, callback) {
        setStatus(false, 0);
        callback();
    },
});

var share = document.getElementById("share");
share.onclick = function () {
    share.onclick = null;
    messaging.call("connectFromPopup", url => {
        navigator.clipboard.writeText(url);
        window.close();
    });
};

var disconnect = document.getElementById("disconnect");
disconnect.onclick = function () {
    disconnect.onclick = null;
    messaging.callOnCurrentTab("disconnect");
};

setStatus(false, 0);
messaging.callOnCurrentTab("getStatus", ({connected, count}) => {
    setStatus(connected, count);
});
