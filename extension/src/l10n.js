"use strict";

function getStatusText (count) {
    let others = count-1;
    if (others <= 0) {
        return "Connected and waiting for others";
    }
    if (others == 1) {
        return "Connected with 1 other person";
    }
    return "Connected with "+others+" other people";
}
exports.getStatusText = getStatusText;
