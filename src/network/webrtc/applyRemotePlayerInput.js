"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyRemotePlayerInput = void 0;
function applyPlayerInputCommand(tank, input, deltaTime, checkIce = true) {
    if (tank.isStunned()) {
        tank.idle(false);
        return;
    }
    if (input.direction !== null) {
        tank.rotate(input.direction);
    }
    if (input.moving && input.direction !== null) {
        tank.move(deltaTime);
        return;
    }
    tank.idle(checkIce);
}
function applyRemotePlayerInput(tank, input, deltaTime, lastFireSeq) {
    let appliedFireSeq = lastFireSeq;
    if (input.fire && input.seq > lastFireSeq) {
        appliedFireSeq = input.seq;
        tank.fire();
    }
    applyPlayerInputCommand(tank, input, deltaTime);
    return appliedFireSeq;
}
exports.applyRemotePlayerInput = applyRemotePlayerInput;
