"use strict";

class HtmlPlayer {
    constructor (element) {
        this.element = element;
    }

    addUpdateListener (fn) {
        console.log("Adding listeners");
        this.element.addEventListener("pause", fn);
        this.element.addEventListener("play", fn);
        // this.element.addEventListener("seeking", fn);
        // this.element.addEventListener("playing", fn);
        this.element.addEventListener("seeked", fn);
    }

    getCurrentTime () {
        return this.element.currentTime;
    }

    getPaused () {
        return this.element.paused;
    }

    update (currentTime, paused) {
        this.element.currentTime = currentTime;
        if (paused) {
            this.element.pause();
        } else {
            this.element.play();
        }
    }
}

// function evalInParent (expr) {
//     return new Promise(resolve => {
//         let eventType = "__vidsync_"+Math.random();
//         function onEvent (event) {
//             document.removeEventListener(eventType, onEvent);
//             resolve(event.detail);
//         }
//         document.addEventListener(eventType, onEvent);
//
//         let script = document.createElement("script");
//         script.textContent = "document.dispatchEvent(new CustomEvent('"+eventType+"', {detail: "+expr+"}))";
//
//         document.documentElement.appendChild(script);
//         document.documentElement.removeChild(script);
//     });
// }
function evalInParent (js) {
    let script = document.createElement("script");
    script.textContent = "(function(){\n" + js + "\n})();";

    document.documentElement.appendChild(script);
    document.documentElement.removeChild(script);
}

function callNetflix (method, params) {
    let code = `
        let videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
        let player = videoPlayer.getVideoPlayerBySessionId(videoPlayer.getAllPlayerSessionIds()[0]);
        player.`+method+`(`+params+`);
    `;
}

class NetflixPlayer extends HtmlPlayer {
    constructor (element) {
        super(element);
    }

    // getCurrentTime () {
    //     return this.player.getCurrentTime() / 1000;
    // }
    //
    // getPaused () {
    //     return this.player.isPaused();
    // }

    update (currentTime, paused) {
        let hack = `
            let videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
            let player = videoPlayer.getVideoPlayerBySessionId(videoPlayer.getAllPlayerSessionIds()[0]);
            player.seek(`+Math.floor(currentTime*1000)+`);
            player.` + (paused ? "pause" : "play") + `();
        `;
        evalInParent(hack);
    }
}

function getVideoElement () {
    function findVideoElement () {
        // Get the largest video element, or null if none
        let videos = Array.prototype.slice.call(document.getElementsByTagName("video"));
        return videos.reduce((a, b) => {
            return a == null || b.offsetWidth*b.offsetHeight > a.offsetWidth*a.offsetHeight ? b : a;
        }, null);
    }

    return new Promise(resolve => {
        let video = findVideoElement();
        if (video != null) {
            resolve(video);
            return;
        }

        let observer = new MutationObserver(() => {
            let video = findVideoElement();
            if (video != null) {
                observer.disconnect();
                resolve(video);
            }
        });
        observer.observe(document.documentElement, {attributes: false, childList: true, subtree: true});
    });
}

async function create () {
    let element = await getVideoElement();

    if (location.hostname.indexOf("netflix.com") >= 0) {
        return new NetflixPlayer(element);
    }

    return new HtmlPlayer(element);
}
exports.create = create;
