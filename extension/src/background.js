"use strict";

const l10n = require("./l10n");
const messaging = require("./messaging");

const DEBUG = process.env.NODE_ENV != "production";
const TITLE = "Video Sync";

console.log("Hello background");
console.log("Debug build? "+DEBUG);

if (DEBUG) {
    chrome.storage.local.clear();
}

function getChannel (tabId, callback) {
    chrome.storage.local.get("tabChannels", ({tabChannels}) => {
        callback(tabChannels != null ? tabChannels[tabId] : null);
    });
}

function setChannel (tabId, channel, callback) {
    console.log("setChannel", tabId, channel);
    chrome.storage.local.get({"tabChannels": {}}, ({tabChannels}) => {
        tabChannels[tabId] = channel;
        chrome.storage.local.set({"tabChannels": tabChannels}, callback);
    });
}

// function removeChannel (tabId, callback) {
// }

function removeAllChannels (callback) {
    chrome.storage.local.remove("tabChannels", callback);
}

function generateChannelId () {
    var ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
    var channelId = "";
    for (var ii = 0; ii < 10; ++ii) {
        var letter = ALPHABET.charAt(Math.floor(Math.random()*ALPHABET.length));
        channelId += letter;
    }
    return channelId;
}

function parseShareUrl (url) {
    let parsed = new URL(url);
    let channel = parsed.pathname.substr(parsed.pathname.lastIndexOf("/")+1);
    let destination = parsed.searchParams.get("u");
    let destParsed = new URL(destination);
    let permissionOrigin = destParsed.host ? "*://"+destParsed.host+"/*" : destination;
    console.log("permissionOrigin", permissionOrigin);

    return { channel, destination, permissionOrigin };
}

function createShareUrl ({channel, destination}) {
    return "http://localhost:3100/share/"+channel+"?u="+encodeURIComponent(destination);
}

messaging.exposeFunctions({
    connectFromPopup (sender, args, callback) {
        messaging.getCurrentTab(tab => {
            let destination = tab.url;

            function injectClient () {
                chrome.tabs.executeScript(tab.id, {
                    file: "/client.js",
                });
            }
            getChannel(tab.id, channel => {
                if (channel != null) {
                    // Already have a channel for this tab
                    injectClient();
                } else {
                    // Generate a new channel ID and assign it
                    channel = generateChannelId();
                    setChannel(tab.id, channel, injectClient);
                }

                let redirectUrl = createShareUrl({channel, destination});
                callback(redirectUrl);
            });
        });
    },

    hasPermission (sender, args, callback) {
        let link = parseShareUrl(sender.url);

        chrome.permissions.contains({
            origins: [link.permissionOrigin],
        }, callback);
    },

    prepareForRedirect (sender, args, callback) {
        var link = parseShareUrl(sender.url);

        chrome.permissions.contains({
            origins: [link.permissionOrigin],
        }, hasPermission => {
            function onGranted () {
                setChannel(sender.tab.id, link.channel, () => {
                    callback(link.destination);
                });
            }
            if (hasPermission) {
                onGranted();
            } else {
                chrome.permissions.request({
                    origins: [link.permissionOrigin],
                }, granted => {
                    if (granted) {
                        onGranted();
                    } else {
                        callback(null);
                    }
                });
            }
        });
    },

    getChannel (sender, args, callback) {
        getChannel(sender.tab.id, callback);
    },

    // onConnect (sender, args, callback) {
    //     callback();
    // },
    //
    // onDisconnect (sender, args, callback) {
    //     chrome.pageAction.setIcon({
    //         tabId: sender.tab.id,
    //         path: "/icons/default16.png",
    //     }, callback);
    // },

    setStatus (sender, {count}, callback) {
        let icon = count > 1 ? "together" : "alone";
        chrome.pageAction.setIcon({ tabId: sender.tab.id, path: "/icons/"+icon+"16.png" });

        let status = l10n.getStatusText(count);
        chrome.pageAction.setTitle({tabId: sender.tab.id, title: TITLE+" | "+status});

        callback();
    },
});

chrome.tabs.onUpdated.addListener((tabId, {status}) => {
    console.log("chrome.tabs.onUpdated", tabId, status);
    if (status != "loading") {
        return;
    }

    getChannel(tabId, function (channel) {
        console.log("Channel for tab", tabId, channel);
        if (channel != null) {
            chrome.tabs.executeScript(tabId, {
                file: "/client.js",
            });
        }
    });
});

// chrome.pageAction.onClicked.addListener(tab => {
// });

chrome.runtime.onStartup.addListener(() => {
    removeAllChannels();
});

chrome.runtime.onInstalled.addListener(details => {
    // removeAllChannels();

    chrome.declarativeContent.onPageChanged.removeRules(null, () => {
        let rule = {
            conditions: [
                new chrome.declarativeContent.PageStateMatcher({
                    css: ["video"],
                }),
            ],
            actions: [
                new chrome.declarativeContent.ShowPageAction(),
            ],
        };
        chrome.declarativeContent.onPageChanged.addRules([rule]);
    });
});
