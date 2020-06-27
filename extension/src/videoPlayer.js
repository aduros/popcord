"use strict";

class HtmlPlayer {
    constructor (element) {
        this.element = element;
        this.ignoreEvents = false;
        this._onEvent = null;

        this._lastPaused = this.getPaused();
    }

    setUpdateListener (fn) {
        if (this._onEvent != null) {
            return;
        }

        this._onEvent = event => {
            console.log("Got HTML5 video event: "+event.type);

            if (this.ignoreEvents) {
                console.log("An event was blocked because ignoreEvents was true");
                return;
            }

            // Attempt to filter out redundant play/pause events
            switch (event.type) {
            case "pause":
                if (this._lastPaused) {
                    console.log("Ignoring redundant pause event");
                    return;
                }
                this._lastPaused = true;
                break;
            case "play":
                if (!this._lastPaused) {
                    console.log("Ignoring redundant play event");
                    return;
                }
                this._lastPaused = false;
                break;
            }

            fn();
        };
        this.element.addEventListener("pause", this._onEvent);
        this.element.addEventListener("play", this._onEvent);
        // this.element.addEventListener("seeking", this._onEvent);
        // this.element.addEventListener("playing", this._onEvent);
        this.element.addEventListener("seeked", this._onEvent);
    }

    dispose () {
        if (this._onEvent != null) {
            this.element.removeEventListener("pause", this._onEvent);
            this.element.removeEventListener("play", this._onEvent);
            this.element.removeEventListener("seeked", this._onEvent);
            this._onEvent = null;
        }
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
            console.log("doSeek()");
            await this.doSeek(currentTime);
        }
        if (paused) {
            if (!this.element.paused) {
                console.log("doPause()");
                await this.doPause();
            }
        } else {
            if (this.element.paused) {
                console.log("doPlay()");
                await this.doPlay();
            }
        }
        console.log("Done handling server update, set ignoreEvents=false");
        this.ignoreEvents = false;
        this._lastPaused = paused;
    }
}

class NetflixPlayer extends HtmlPlayer {
    constructor (element) {
        super(element);
    }

    evalPlayer (js) {
        let script = document.createElement("script");
        script.textContent = `(function(){
            let videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
            let player = videoPlayer.getVideoPlayerBySessionId(videoPlayer.getAllPlayerSessionIds()[0]);
            `+js+`
        })();`;

        document.documentElement.appendChild(script);
        document.documentElement.removeChild(script);
    }

    doPlay () {
        return new Promise(resolve => {
            let onPlay = () => {
                this.element.removeEventListener("play", onPlay);
                resolve();
            };
            this.element.addEventListener("play", onPlay);
            this.evalPlayer("player.play()");
        });
    }

    doPause () {
        return new Promise(resolve => {
            let onPause = () => {
                this.element.removeEventListener("pause", onPause);
                resolve();
            };
            this.element.addEventListener("pause", onPause);
            this.evalPlayer("player.pause()");
        });
    }

    doSeek (currentTime) {
        return new Promise(resolve => {
            let onSeeked = () => {
                this.element.removeEventListener("seeked", onSeeked);
                resolve();
            };
            this.element.addEventListener("seeked", onSeeked);
            this.evalPlayer("player.seek("+Math.floor(currentTime*1000)+")");
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
