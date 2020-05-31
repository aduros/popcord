"use strict";

class HtmlPlayer {
    constructor (element) {
        this.element = element;
        this.ignoreEvents = false;
    }

    addUpdateListener (fn) {
        let onEvent = event => {
            if (!this.ignoreEvents) {
                fn();
            } else {
                console.log("An event was blocked because ignoreEvents was true");
            }
        };
        this.element.addEventListener("pause", onEvent);
        this.element.addEventListener("play", onEvent);
        // this.element.addEventListener("seeking", fn);
        // this.element.addEventListener("playing", fn);
        this.element.addEventListener("seeked", onEvent);
    }

    getCurrentTime () {
        return this.element.currentTime;
    }

    getPaused () {
        return this.element.paused;
    }

    doPlay () {
        return this.element.play();
    }

    doPause () {
        return new Promise(resolve => {
            // if (this.element.paused) {
            //     resolve();
            //     return;
            // }

            let onPause = () => {
                this.element.removeEventListener("pause", onPause);
                resolve();
            };
            this.element.addEventListener("pause", onPause);
            this.element.pause();
        });
    }

    doSeek (currentTime) {
        return new Promise(resolve => {
            let onSeeked = () => {
                this.element.removeEventListener("seeked", onSeeked);
                resolve();
            };
            this.element.addEventListener("seeked", onSeeked);
            this.element.currentTime = currentTime;
        });
    }

    async update (currentTime, paused) {
        console.log("Handling server update, set ignoreEvents=true");
        this.ignoreEvents = true;
        if (currentTime != this.element.currentTime) {
            await this.doSeek(currentTime);
        }
        if (paused) {
            if (!this.element.paused) {
                await this.doPause();
            }
        } else {
            if (this.element.paused) {
                await this.doPlay();
            }
        }
        console.log("Done handling server update, set ignoreEvents=false");
        this.ignoreEvents = false;
    }
}

function evalInParent (js) {
    let script = document.createElement("script");
    script.textContent = "(function(){\n" + js + "\n})();";

    document.documentElement.appendChild(script);
    document.documentElement.removeChild(script);
}

class NetflixPlayer extends HtmlPlayer {
    constructor (element) {
        super(element);
    }

    doSeek (currentTime) {
        return new Promise(resolve => {
            let onSeeked = () => {
                this.element.removeEventListener("seeked", onSeeked);
                resolve();
            };
            this.element.addEventListener("seeked", onSeeked);

            let hack = `
                let videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
                let player = videoPlayer.getVideoPlayerBySessionId(videoPlayer.getAllPlayerSessionIds()[0]);
                player.seek(`+Math.floor(currentTime*1000)+`);
            `;
            evalInParent(hack);
        });
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
