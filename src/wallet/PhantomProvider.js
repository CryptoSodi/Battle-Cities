"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPhantomProvider = void 0;
function getPhantomProvider() {
    const phantomWindow = window;
    const provider = phantomWindow.phantom?.solana || phantomWindow.solana;
    return provider?.isPhantom === true ? provider : null;
}
exports.getPhantomProvider = getPhantomProvider;
