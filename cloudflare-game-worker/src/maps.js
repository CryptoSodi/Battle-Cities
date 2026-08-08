"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMap = void 0;
const _01_json_1 = __importDefault(require("../../data/maps/original/01.json"));
const _02_json_1 = __importDefault(require("../../data/maps/original/02.json"));
const _03_json_1 = __importDefault(require("../../data/maps/original/03.json"));
const _04_json_1 = __importDefault(require("../../data/maps/original/04.json"));
const _05_json_1 = __importDefault(require("../../data/maps/original/05.json"));
const _06_json_1 = __importDefault(require("../../data/maps/original/06.json"));
const _07_json_1 = __importDefault(require("../../data/maps/original/07.json"));
const _08_json_1 = __importDefault(require("../../data/maps/original/08.json"));
const _09_json_1 = __importDefault(require("../../data/maps/original/09.json"));
const _10_json_1 = __importDefault(require("../../data/maps/original/10.json"));
const _11_json_1 = __importDefault(require("../../data/maps/original/11.json"));
const _12_json_1 = __importDefault(require("../../data/maps/original/12.json"));
const _13_json_1 = __importDefault(require("../../data/maps/original/13.json"));
const _14_json_1 = __importDefault(require("../../data/maps/original/14.json"));
const _15_json_1 = __importDefault(require("../../data/maps/original/15.json"));
const _16_json_1 = __importDefault(require("../../data/maps/original/16.json"));
const _17_json_1 = __importDefault(require("../../data/maps/original/17.json"));
const _18_json_1 = __importDefault(require("../../data/maps/original/18.json"));
const _19_json_1 = __importDefault(require("../../data/maps/original/19.json"));
const _20_json_1 = __importDefault(require("../../data/maps/original/20.json"));
const _21_json_1 = __importDefault(require("../../data/maps/original/21.json"));
const _22_json_1 = __importDefault(require("../../data/maps/original/22.json"));
const _23_json_1 = __importDefault(require("../../data/maps/original/23.json"));
const _24_json_1 = __importDefault(require("../../data/maps/original/24.json"));
const _25_json_1 = __importDefault(require("../../data/maps/original/25.json"));
const _26_json_1 = __importDefault(require("../../data/maps/original/26.json"));
const _27_json_1 = __importDefault(require("../../data/maps/original/27.json"));
const _28_json_1 = __importDefault(require("../../data/maps/original/28.json"));
const _29_json_1 = __importDefault(require("../../data/maps/original/29.json"));
const _30_json_1 = __importDefault(require("../../data/maps/original/30.json"));
const _31_json_1 = __importDefault(require("../../data/maps/original/31.json"));
const _32_json_1 = __importDefault(require("../../data/maps/original/32.json"));
const _33_json_1 = __importDefault(require("../../data/maps/original/33.json"));
const _34_json_1 = __importDefault(require("../../data/maps/original/34.json"));
const _35_json_1 = __importDefault(require("../../data/maps/original/35.json"));
const maps = [
    _01_json_1.default, _02_json_1.default, _03_json_1.default, _04_json_1.default, _05_json_1.default, _06_json_1.default, _07_json_1.default, _08_json_1.default, _09_json_1.default, _10_json_1.default,
    _11_json_1.default, _12_json_1.default, _13_json_1.default, _14_json_1.default, _15_json_1.default, _16_json_1.default, _17_json_1.default, _18_json_1.default, _19_json_1.default, _20_json_1.default,
    _21_json_1.default, _22_json_1.default, _23_json_1.default, _24_json_1.default, _25_json_1.default, _26_json_1.default, _27_json_1.default, _28_json_1.default, _29_json_1.default, _30_json_1.default,
    _31_json_1.default, _32_json_1.default, _33_json_1.default, _34_json_1.default, _35_json_1.default,
];
function getMap(level) {
    const index = (Math.max(1, Math.floor(level)) - 1) % maps.length;
    return maps[index];
}
exports.getMap = getMap;
