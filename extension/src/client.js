"use strict";

const messaging = require("./messaging");

let socket = null;
let running = false;

let statusCount = 0;

function run () {
    if (running) {
        return;
    }
    running = true;

    messaging.exposeFunctions({
        getStatus (sender, args, callback) {
            callback({
                connected: socket != null && socket.readyState == 1,
                count: statusCount,
            });
        },
        disconnect (sender, args, callback) {
            if (socket != null) {
                socket.close();
                socket = null;
            }
            callback();
        },
    });

    messaging.call("getChannel", channel => {
        if (channel == null) {
            return; // Normal?
        }

        // TODO: use MutationObserver to detect dynamically added videos
        let videos = document.getElementsByTagName("video");
        if (videos.length == 0) {
            return;
        }

        // TODO: get the biggest one?
        let video = videos[0];

        let blockUpdates = false;

        // let videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
        // let player = videoPlayer.getVideoPlayerBySessionId(
        //     videoPlayer.getAllPlayerSessionIds()[0]
        // );
        // player.seek(Math.round(Number(event.data.vemosSeekTime)) * 1000);

        socket = new WebSocket("ws://127.0.0.1:8080");
        function callServer (method, args) {
            socket.send(JSON.stringify({ method, args }));
        }

        let RPC = {
            update ({currentTime, paused}) {
                blockUpdates = true;
                video.currentTime = currentTime;
                if (paused) {
                    video.pause();
                } else {
                    video.play();
                }
                setTimeout(() => {
                    blockUpdates = false;
                }, 0);
            },

            setOccupants ({count}) {
                statusCount = count;
                messaging.call("setStatus", {connected: true, count});
            },
        };

        socket.onopen = () => {
            console.log("Connected to server");
            // messaging.call("onConnect");

            function onVideoUpdate () {
                if (blockUpdates) {
                    return;
                }
                console.log("Sending update to server");
                callServer("update", {currentTime: video.currentTime, paused: video.paused});
            }
            video.addEventListener("pause", onVideoUpdate);
            video.addEventListener("play", onVideoUpdate);
            video.addEventListener("seeking", onVideoUpdate);
            // video.addEventListener("playing", onVideoUpdate);
            // video.addEventListener("seeked", onVideoUpdate);

            socket.onmessage = event => {
                let message = JSON.parse(event.data);
                let {method, args} = message;
                let fn = RPC[method];

                console.log("Got message from server", message);
                if (fn == null) {
                    throw new Error("Missing method: "+method);
                }
                fn(args);
            };

            socket.onclose = () => {
                messaging.call("onDisconnect");
            };

            callServer("setChannel", {id: channel});
        };

        socket.onclose = function () {
            messaging.call("setStatus", {connected: false, count: 0});
        };
    });
}

// Init is run only once
if (window.__EXTENSION_CLIENT_INSTANCE_INIT == null) {
    window.__EXTENSION_CLIENT_INSTANCE_INIT = run;
}
window.__EXTENSION_CLIENT_INSTANCE_INIT();
