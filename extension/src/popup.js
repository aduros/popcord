"use strict";

const l10n = require("./l10n");
const messaging = require("./messaging");

function setStatus (connected, count) {
    document.getElementById("status-line").style.display = connected ? "" : "none";
    document.getElementById("status-text").textContent = l10n.getStatusText(count)+".";
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

let share = document.getElementById("share");
share.onclick = () => {
    share.onclick = null;
    messaging.call("connectFromPopup", async url => {
        await navigator.clipboard.writeText(url);
        window.close();
    });
};

// let disconnect = document.getElementById("disconnect");
// disconnect.onclick = () => {
//     disconnect.onclick = null;
//     messaging.call("disconnect"); // background.js
//     messaging.callOnCurrentTab("disconnect"); // client.js
// };

setStatus(false, 0);
messaging.callOnCurrentTab("getStatus", ({connected, count}) => {
    setStatus(connected, count);
});

let noVideoWarning = document.getElementById("no-video-warning");
noVideoWarning.style.display = "none";
chrome.tabs.executeScript({
    code: "document.querySelector('video') != null",
}, ([hasVideo]) => {
    noVideoWarning.style.display = hasVideo ? "none" : "";
});
