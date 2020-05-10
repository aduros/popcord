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

        let player = await videoPlayer.create();

        let blockUpdates = false;
        let lastUpdateFromServer = -1;

        socket = new WebSocket(config.SOCKET_URL);
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
                lastUpdateFromServer = Date.now();
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
        };

        socket.onopen = () => {
            console.log("Connected to server");
            // messaging.call("onConnect");

            let batchingUpdate = false;
            player.addUpdateListener(() => {
                console.log("player update listener fired");
                if (Date.now() - lastUpdateFromServer < 300) {
                    console.log("TOO SOON");
                    return; // Too soon, this event probably came from a server update and not the user
                }
                // sendUpdate();
                if (!batchingUpdate) {
                    batchingUpdate = true;
                    setTimeout(() => {
                        batchingUpdate = false;
                        sendUpdate();
                    }, 1000);
                }
            });

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
