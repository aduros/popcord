"use strict";

const config = require("./config");
const messaging = require("./messaging");
const videoPlayer = require("./videoPlayer");

const DEBUG = process.env.NODE_ENV != "production";

let socket = null;
let running = false;

let statusCount = 0;

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

        let RPC = {
            // Called by the server to update this client
            update ({currentTime, paused}) {
                // lastUpdateFromServer = Date.now();
                player.update(currentTime, paused);
            },

            setOccupants ({count}) {
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
