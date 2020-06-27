"use strict";

const l10n = require("./l10n");
const messaging = require("./messaging");
const config = require("./config");

const DEBUG = process.env.NODE_ENV != "production";

console.log("Hello background");
console.log("Debug build? "+DEBUG);

// if (DEBUG) {
//     chrome.storage.local.clear();
// }

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

function removeChannel (tabId, callback) {
    // Maybe should actually remove?
    setChannel(tabId, null, callback);
}

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
    return config.WEB_URL + "/invite/"+encodeURIComponent(channel)+"?u="+encodeURIComponent(destination);
}

function injectClient (tabId) {
    chrome.tabs.insertCSS(tabId, {
        file: "/vendor/noty/noty.css",
    }, (arg) => {console.log("Got result", arg)});
    chrome.tabs.executeScript(tabId, {
        file: "/client.js",
        // allFrames: true,
    });
}

messaging.exposeFunctions({
    connectFromPopup (sender, args, callback) {
        messaging.getCurrentTab(tab => {
            let destination = tab.url;

            getChannel(tab.id, channel => {
                if (channel != null) {
                    // Already have a channel for this tab
                    injectClient(tab.id);
                } else {
                    // Generate a new channel ID and assign it
                    channel = generateChannelId();
                    setChannel(tab.id, channel, () => {
                        injectClient(tab.id);
                    });
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

    // Called when the user wants to leave the channel
    disconnect (sender, args, callback) {
        removeChannel(sender.tab.id, callback);
    },

    onDisconnect (sender, args, callback) {
        chrome.pageAction.setIcon({ tabId: sender.tab.id, path: "/icons/default16.png" });

        let status = l10n.getStatusText(0);
        chrome.pageAction.setTitle({tabId: sender.tab.id, title: config.TITLE});

        callback();
    },

    setStatus (sender, {count}, callback) {
        let icon = count > 1 ? "together" : "alone";
        chrome.pageAction.setIcon({ tabId: sender.tab.id, path: "/icons/"+icon+"16.png" });

        let status = l10n.getStatusText(count);
        chrome.pageAction.setTitle({tabId: sender.tab.id, title: config.TITLE+" | "+status});

        callback();
    },
});

chrome.tabs.onUpdated.addListener((tabId, {status}) => {
    console.log("chrome.tabs.onUpdated", tabId, status);
    if (status != "loading") {
        return;
    }

    chrome.pageAction.show(tabId);

    getChannel(tabId, function (channel) {
        console.log("Channel for tab", tabId, channel);
        if (channel != null) {
            injectClient(tabId);
        }
    });
});

// chrome.pageAction.onClicked.addListener(tab => {
//     alert("CLICKED");
// });

chrome.runtime.onStartup.addListener(() => {
    removeAllChannels();
});

chrome.runtime.onInstalled.addListener(details => {
    // removeAllChannels();
    console.log("onInstalled");
    chrome.tabs.query({}, tabs => {
        for (let tab of tabs) {
            chrome.pageAction.show(tab.id);
        }
    });

    // chrome.declarativeContent.onPageChanged.removeRules(null, () => {
    //     // let rule = {
    //     //     conditions: [
    //     //         new chrome.declarativeContent.PageStateMatcher({
    //     //             css: ["video"],
    //     //         }),
    //     //     ],
    //     //     actions: [
    //     //         new chrome.declarativeContent.ShowPageAction(),
    //     //     ],
    //     // };
    //     // chrome.declarativeContent.onPageChanged.addRules([rule]);
    // });
});
