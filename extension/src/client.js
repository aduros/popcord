"use strict";

const Noty = require("noty");
const config = require("./config");
const messaging = require("./messaging");
const videoPlayer = require("./videoPlayer");
const l10n = require("./l10n");

const DEBUG = process.env.NODE_ENV != "production";

let socket = null;
let running = false;

let statusCount = -1;

function showNotification (type, text) {
    new Noty({
        type,
        timeout: 4000,
        // progressBar: false,
        theme: "sunset",
        text: "<b>Popcord</b> \u2015 "+text,
        killer: true,
    }).show();
}

function run () {
    console.log("Called run");
    if (running) {
        return;
    }
    running = true;
    console.log("Running!");

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

    messaging.call("getChannel", async channel => {
        if (channel == null) {
            return; // Normal?
        }

        async function createVideoPlayer () {
            let player = await videoPlayer.create();

            let batchingUpdate = false;
            player.setUpdateListener(() => {
                console.log("player update listener fired");
                if (socket == null || socket.readyState != 1) {
                    console.log("Socket not ready yet");
                    return;
                }
                // if (Date.now() - lastUpdateFromServer < 300) {
                //     console.log("TOO SOON");
                //     return; // Too soon, this event probably came from a server update and not the user
                // }
                if (!batchingUpdate) {
                    batchingUpdate = true;
                    setTimeout(() => {
                        batchingUpdate = false;
                        sendUpdate();
                    }, 1000);
                }
            });

            return player;
        }

        let player = await createVideoPlayer();

        function callServer (method, args) {
            socket.send(JSON.stringify({ method, args }));
        }

        function sendUpdate () {
            console.log("Sending update to server");
            callServer("update", {
                currentTime: player.getCurrentTime(),
                paused: player.getPaused(),
            });
        }

        // To prevent too many notifications
        let lastUpdateNotification = 0;

        let RPC = {
            // Called by the server to update this client
            async update ({currentTime, paused, suppressNotification}) {
                // lastUpdateFromServer = Date.now();
                var updateType = await player.update(currentTime, paused);

                if (!suppressNotification && Date.now()-lastUpdateNotification >= 500) {
                    var text = null;
                    switch (updateType) {
                        case "seek":
                            text = "someone seeked the video.";
                            break;
                        case "pause":
                            text = "someone paused the video."
                            break;
                        case "play":
                            text = "someone played the video.";
                            break;
                    }
                    if (text != null) {
                        lastUpdateNotification = Date.now();
                        showNotification("info", text);
                    }
                }
            },

            setOccupants ({count}) {
                if (statusCount < 0) {
                    // First call to setOccupants() since connecting
                    showNotification("info", l10n.getStatusText(count).toLowerCase()+".");
                } else if (count > statusCount) {
                    showNotification("info", "someone joined.");
                } else if (count < statusCount) {
                    showNotification("info", "someone left.");
                }
                statusCount = count;
                messaging.call("setStatus", {connected: true, count});
            },

            // Called by the server when it wants an update from this client
            requestUpdate () {
                sendUpdate();
            },

            // Called by the server when somebody else went to a new episode
            setUrl ({url}) {
                console.log("setUrl()");
                if (location.href != url) {
                    location.href = url;
                }
            },

            setUrlIfFromInviteLink ({url}) {
                console.log("setUrlIfFromInviteLink()");
                if (location.href != url && document.referrer && document.referrer.startsWith(config.WEB_URL)) {
                    location.href = url;
                }
            },
        };

        var url = location.href;
        setInterval(async function () {
            if (location.href != url) {
                url = location.href;
                console.log("URL changed, new episode?", url);
                callServer("setUrl", {url});

                // Recreate our video player because the old one may be invalid
                console.log("Disposing old video player");
                player.dispose();
                player = await createVideoPlayer();
                console.log("Got new video player");
                sendUpdate();
            }
        }, 1000); // Doesn't seem like there's a way besides polling

        var reconnectCount = 0;
        function createSocket () {
            socket = new WebSocket(config.SOCKET_URL);

            statusCount = -1;

            socket.onopen = () => {
                console.log("Connected to server");
                // messaging.call("onConnect");

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

                callServer("setChannel", {id: channel});
            };

            socket.onclose = event => {
                messaging.call("onDisconnect");

                if (!event.wasClean) {
                    console.log("Reconnecting...");
                    ++reconnectCount;
                    setTimeout(createSocket, Math.max(reconnectCount*500, 4000));
                }
            };
        }
        createSocket();
    });
}

// Init is run only once
if (window.__EXTENSION_CLIENT_INSTANCE_INIT == null) {
    window.__EXTENSION_CLIENT_INSTANCE_INIT = run;
}
window.__EXTENSION_CLIENT_INSTANCE_INIT();
