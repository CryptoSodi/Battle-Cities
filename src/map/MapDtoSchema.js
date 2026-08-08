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
exports.MapDtoSchema = void 0;
const Joi = __importStar(require("@hapi/joi"));
// TODO: circular deps?
const TankTier_1 = require("../tank/TankTier");
const TerrainType_1 = require("../terrain/TerrainType");
const DEFAULT_VERSION = 2;
exports.MapDtoSchema = Joi.object({
    base: Joi.object({
        x: Joi.number().required(),
        y: Joi.number().required(),
    }).optional(),
    field: Joi.object({
        widthTiles: Joi.number().integer().min(8).max(40).default(20),
        heightTiles: Joi.number().integer().min(8).max(40).default(20),
    }).default(),
    version: Joi.number().default(DEFAULT_VERSION),
    spawn: Joi.object({
        enemy: Joi.object({
            locations: Joi.array()
                .items(Joi.object({
                x: Joi.number().required(),
                y: Joi.number().required(),
            }))
                .default([]),
            list: Joi.array()
                .items(Joi.object({
                tier: Joi.string()
                    .valid(...Object.values(TankTier_1.TankTier))
                    .required(),
                drop: Joi.boolean(),
            }))
                .default([]),
        }).default(),
        player: Joi.object({
            locations: Joi.array()
                .items(Joi.object({
                x: Joi.number().required(),
                y: Joi.number().required(),
            }))
                .default([]),
        }).default(),
    }).default(),
    terrain: Joi.object({
        regions: Joi.array()
            .items(Joi.object({
            type: Joi.string()
                .valid(...Object.values(TerrainType_1.TerrainType))
                .required(),
            x: Joi.number().required(),
            y: Joi.number().required(),
            width: Joi.number().required(),
            height: Joi.number().required(),
        }))
            .default([]),
    }).default(),
});
