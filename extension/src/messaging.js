"use strict";

function exposeFunctions (functions) {
    function onMessage (message, sender, callback) {
        let {method, args} = message;
        let fn = functions[method];

        console.log("Got message", message);
        console.log("Sender", sender);
        if (fn == null) {
            // throw new Error("Missing method: "+method);
            return;
        }
        fn.call(functions, sender, args, callback);
        return true;
    }

    chrome.runtime.onMessage.addListener(onMessage);
    if (chrome.runtime.onMessageExternal != null) {
        chrome.runtime.onMessageExternal.addListener(onMessage);
    }
}
exports.exposeFunctions = exposeFunctions;

function call (method, args, callback) {
    if (typeof args == "function") {
        callback = args;
        args = null;
    }
    chrome.runtime.sendMessage({method, args}, callback);
}
exports.call = call;

function callOnTab (tabId, method, args, callback) {
    if (typeof args == "function") {
        callback = args;
        args = null;
    }
    chrome.tabs.sendMessage(tabId, {method, args}, callback);
}
exports.callOnTab = callOnTab;

function getCurrentTab (callback) {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        callback(tabs[0]);
    });
}
exports.getCurrentTab = getCurrentTab;

function callOnCurrentTab (method, args, callback) {
    getCurrentTab(tab => {
        callOnTab(tab.id, method, args, callback);
    });
}
exports.callOnCurrentTab = callOnCurrentTab;
