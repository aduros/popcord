"use strict";

const DEBUG = process.env.NODE_ENV != "production";

var extensionId = DEBUG
    ? "mmcfiocbpgbfnboacbaddlofcackkikb"
    : "gaobldoddnlopccjidfbahcofidniohn";

var states = [
    document.getElementById("need-chrome"),
    document.getElementById("need-extension"),
    document.getElementById("need-permission"),
];

function callBackground (method, args, callback) {
    if (typeof args == "function") {
        callback = args;
        args = null;
    }
    chrome.runtime.sendMessage(extensionId, {method: method, args: args}, callback);
}

function redirect () {
    callBackground("prepareForRedirect", function (destination) {
        if (destination != null) {
            location.replace(destination);
        } else {
            setDisplayState("need-permission");
        }
    });
}

function checkPermissionsAndRedirect () {
    callBackground("hasPermission", function (hasPermission) {
        console.log("hasPermission", hasPermission);
        if (chrome.runtime.lastError) {
            setDisplayState("need-extension");

            setTimeout(checkPermissionsAndRedirect, 1000);
            // TODO: Show the permissions prompt only after the initial install? After that show
            // only when user clicks the button?
            return;
        }

        console.log("hasPermission", hasPermission);
        if (hasPermission) {
            redirect();
        } else {
            // alert("You will be prompted");
            setDisplayState("need-permission");
            // redirect();
        }
    });
}

function setDisplayState (state) {
    document.getElementById("share-jumbotron").style.visibility = "visible";

    states.forEach(function (element) {
        element.style.display = (element.id == state) ? "" : "none";
    });
}

function init () {
    document.getElementById("grant-permission").onclick = redirect;

    if (window.chrome != null && chrome.runtime != null) {
        checkPermissionsAndRedirect();
    } else {
        setDisplayState("need-chrome");
    }
}

init();
