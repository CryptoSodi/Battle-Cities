"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Base = void 0;
const core_1 = require("../core");
const config = __importStar(require("../config"));
const BaseHeart_1 = require("./BaseHeart");
class Base extends core_1.GameObject {
    constructor() {
        super(config.BASE_DEFAULT_SIZE.width, config.BASE_DEFAULT_SIZE.height);
        this.died = new core_1.Subject();
        this.heart = new BaseHeart_1.BaseHeart();
    }
    activateDefence(_duration) {
        // Base fortification bricks are normal terrain now, owned by the level map
        // and authoritative ER board mutations. The old Base-local wall swap is
        // intentionally disabled so the base object represents only the eagle.
    }
    setup() {
        this.heart.position.set(32, 32);
        this.heart.died.addListener(this.died.notify);
        this.add(this.heart);
    }
}
exports.Base = Base;
