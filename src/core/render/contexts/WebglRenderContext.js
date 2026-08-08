"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebglRenderContext = void 0;
const Matrix4_1 = require("../../Matrix4");
const Vector_1 = require("../../Vector");
const CanvasText_1 = require("../../text/CanvasText");
const RenderContext_1 = require("../RenderContext");
// A batched WebGL renderer that implements the full RenderContext API
// (textured quads, solid fills, alpha, lines) at parity with the Canvas2D
// backend. Pixel art uses NEAREST filtering; transparency uses straight-alpha
// blending.
//
// Quads are NOT drawn immediately: drawImage/fillRect/drawText append vertices
// (position, uv, color, flash) to a shared CPU-side buffer, and the whole run
// is submitted as ONE drawArrays call when the batch flushes — on a texture
// switch, on buffer overflow, before any non-quad draw (lines, scissor clear),
// and at end of frame via flush(). Since nearly every sprite comes from the
// single atlas and solid fills all use a shared 1x1 white texture, a typical
// gameplay frame collapses from ~1500 draw calls into a handful. Everything
// (color tint, per-sprite alpha, hit flash) rides along as vertex attributes,
// so no per-quad uniform changes or matrix math are needed — the view
// transform is folded into the vertex positions on the CPU (pure scale +
// translate; destination rects are always axis-aligned).
const vertexShaderSource = `
attribute vec2 a_position;
attribute vec2 a_texcoord;
attribute vec4 a_color;
attribute vec4 a_tint;
attribute float a_flash;
uniform mat4 u_projection;
varying vec2 v_texcoord;
varying vec4 v_color;
varying vec4 v_tint;
varying float v_flash;
void main() {
  gl_Position = u_projection * vec4(a_position, 0.0, 1.0);
  v_texcoord = a_texcoord;
  v_color = a_color;
  v_tint = a_tint;
  v_flash = a_flash;
}
`;
const fragmentShaderSource = `
precision mediump float;
uniform sampler2D u_texture;
varying vec2 v_texcoord;
varying vec4 v_color;
varying vec4 v_tint;
varying float v_flash;
void main() {
  vec4 texel = texture2D(u_texture, v_texcoord);
  // Tint toward white for the hit flash; alpha is left untouched so
  // transparent texels stay transparent (white silhouette, not a box).
  // Solid fills sample the 1x1 white texture, so their color comes entirely
  // from v_color.
  vec3 tinted = mix(texel.rgb * v_color.rgb, v_tint.rgb, v_tint.a);
  gl_FragColor = vec4(
    mix(tinted, vec3(1.0), v_flash),
    texel.a * v_color.a
  );
}
`;
// x, y, u, v, r, g, b, a, tintR, tintG, tintB, tintA, flash
const FLOATS_PER_VERTEX = 13;
const VERTICES_PER_QUAD = 6;
const FLOATS_PER_QUAD = FLOATS_PER_VERTEX * VERTICES_PER_QUAD;
const MAX_QUADS = 2048;
class WebglRenderContext extends RenderContext_1.RenderContext {
    constructor(canvas, renderScale = 1) {
        super(canvas);
        this.batchData = new Float32Array(MAX_QUADS * FLOATS_PER_QUAD);
        this.quadCount = 0;
        this.batchTexture = null;
        this.globalAlpha = 1;
        this.viewScale = 1;
        this.viewOffsetX = 0;
        this.viewOffsetY = 0;
        this.logicalWidth = 1;
        this.logicalHeight = 1;
        this.backingScaleX = 1;
        this.backingScaleY = 1;
        this.textureMap = new Map();
        this.textCanvasMap = new Map();
        this.colorCache = new Map();
        this.renderScale = renderScale;
    }
    init() {
        const opts = { alpha: true, premultipliedAlpha: false, antialias: false };
        const gl = (this.canvas.getContext('webgl2', opts) ||
            this.canvas.getContext('webgl', opts));
        if (gl === null) {
            throw new Error('WebGL is not supported');
        }
        this.gl = gl;
        // Backing store renders at up to renderScale x the logical size for HD,
        // but capped so it never exceeds the GL/canvas size limit — exceeding it
        // (e.g. 4x a large fullscreen viewport) makes the browser clamp the buffer
        // while the viewport/projection still assume full size, rendering zoomed
        // and cropped. Projection stays in logical units regardless.
        const logicalWidth = this.canvas.width;
        const logicalHeight = this.canvas.height;
        this.logicalWidth = logicalWidth;
        this.logicalHeight = logicalHeight;
        const maxViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
        const maxDim = Math.min(4096, (maxViewport && maxViewport[0]) || 4096);
        const maxScale = Math.min(maxDim / logicalWidth, maxDim / logicalHeight);
        const scale = Math.max(1, Math.min(this.renderScale, maxScale));
        this.resizeBackingStore(Math.round(logicalWidth * scale), Math.round(logicalHeight * scale));
        // eslint-disable-next-line no-console
        console.info('[renderer] WebGL backing canvas', {
            logical: `${logicalWidth}x${logicalHeight}`,
            backing: `${this.canvas.width}x${this.canvas.height}`,
            requestedScale: this.renderScale,
            effectiveScale: scale,
            devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
        });
        gl.clearColor(0, 0, 0, 0);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
        gl.useProgram(this.program);
        this.aPosition = gl.getAttribLocation(this.program, 'a_position');
        this.aTexcoord = gl.getAttribLocation(this.program, 'a_texcoord');
        this.aColor = gl.getAttribLocation(this.program, 'a_color');
        this.aTint = gl.getAttribLocation(this.program, 'a_tint');
        this.aFlash = gl.getAttribLocation(this.program, 'a_flash');
        this.uProjection = gl.getUniformLocation(this.program, 'u_projection');
        this.uTexture = gl.getUniformLocation(this.program, 'u_texture');
        this.batchBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.batchBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.batchData.byteLength, gl.DYNAMIC_DRAW);
        this.lineBuffer = gl.createBuffer();
        // Shared texel for solid fills and lines, so they batch together with
        // sprites under the one shader (color rides in as a vertex attribute).
        this.whiteTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.whiteTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        // Projection never changes (logical-pixel top-left space -> clip space),
        // so it is uploaded exactly once.
        const projection = Matrix4_1.Matrix4.createProjection(logicalWidth, logicalHeight, 1);
        gl.uniformMatrix4fv(this.uProjection, false, new Float32Array(projection.elements));
        gl.uniform1i(this.uTexture, 0);
    }
    resizeBackingStore(width, height) {
        const backingWidth = Math.max(1, Math.round(width));
        const backingHeight = Math.max(1, Math.round(height));
        if (this.canvas.width === backingWidth &&
            this.canvas.height === backingHeight) {
            return;
        }
        this.flush();
        this.canvas.width = backingWidth;
        this.canvas.height = backingHeight;
        this.backingScaleX = backingWidth / this.logicalWidth;
        this.backingScaleY = backingHeight / this.logicalHeight;
        this.gl.viewport(0, 0, backingWidth, backingHeight);
    }
    // Submit all batched quads in a single draw call. Public so the frame driver
    // (GameRenderer) can end the frame; also called internally before any state
    // change that would break draw ordering (texture switch, lines, clears).
    flush() {
        if (this.quadCount === 0) {
            return;
        }
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.batchBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.batchData.subarray(0, this.quadCount * FLOATS_PER_QUAD));
        const stride = FLOATS_PER_VERTEX * 4;
        gl.enableVertexAttribArray(this.aPosition);
        gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(this.aTexcoord);
        gl.vertexAttribPointer(this.aTexcoord, 2, gl.FLOAT, false, stride, 8);
        gl.enableVertexAttribArray(this.aColor);
        gl.vertexAttribPointer(this.aColor, 4, gl.FLOAT, false, stride, 16);
        gl.enableVertexAttribArray(this.aTint);
        gl.vertexAttribPointer(this.aTint, 4, gl.FLOAT, false, stride, 32);
        gl.enableVertexAttribArray(this.aFlash);
        gl.vertexAttribPointer(this.aFlash, 1, gl.FLOAT, false, stride, 48);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.batchTexture);
        gl.drawArrays(gl.TRIANGLES, 0, this.quadCount * VERTICES_PER_QUAD);
        this.quadCount = 0;
    }
    clear() {
        this.flush();
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
    clearRect(x, y, width, height) {
        this.flush();
        const gl = this.gl;
        gl.enable(gl.SCISSOR_TEST);
        // Scissor origin is bottom-left, so flip y from our top-left space.
        gl.scissor(Math.round(x * this.backingScaleX), Math.round(this.canvas.height - (y + height) * this.backingScaleY), Math.round(width * this.backingScaleX), Math.round(height * this.backingScaleY));
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.disable(gl.SCISSOR_TEST);
    }
    drawImage(image, sourceRect, destinationRect, flash = 0, tintColor = null, tintAlpha = 0) {
        if (!image.isLoaded()) {
            return;
        }
        const element = image.getElement();
        const texture = this.getTexture(element);
        const iw = element.naturalWidth ||
            element.width;
        const ih = element.naturalHeight ||
            element.height;
        this.pushQuad(texture, destinationRect.x, destinationRect.y, destinationRect.width, destinationRect.height, sourceRect.x / iw, sourceRect.y / ih, (sourceRect.x + sourceRect.width) / iw, (sourceRect.y + sourceRect.height) / ih, 1, 1, 1, this.globalAlpha, tintColor === null ? 0 : this.parseColor(tintColor)[0], tintColor === null ? 0 : this.parseColor(tintColor)[1], tintColor === null ? 0 : this.parseColor(tintColor)[2], tintColor === null ? 0 : Math.min(1, tintAlpha) * this.parseColor(tintColor)[3], flash);
    }
    fillRect(x, y, width, height, color = '#000') {
        const rgba = this.parseColor(color);
        this.pushQuad(this.whiteTexture, x, y, width, height, 0, 0, 1, 1, rgba[0], rgba[1], rgba[2], rgba[3] * this.globalAlpha, 0, 0, 0, 0, 0);
    }
    drawText(text, x, y, maxWidth, fontSize, fontFamily, fontWeight, color, align = 'left', strokeColor = null, strokeWidth = 0, letterSpacing = 1) {
        const canvas = this.getTextCanvas(text, maxWidth, fontSize, fontFamily, fontWeight, color, align, strokeColor, strokeWidth, letterSpacing);
        const texture = this.getTexture(canvas);
        this.pushQuad(texture, x, y, canvas.width, canvas.height, 0, 0, 1, 1, 1, 1, 1, this.globalAlpha, 0, 0, 0, 0, 0);
    }
    pushClip(x, y, width, height) {
        this.flush();
        const gl = this.gl;
        const left = (x * this.viewScale + this.viewOffsetX) * this.backingScaleX;
        const top = (y * this.viewScale + this.viewOffsetY) * this.backingScaleY;
        const clipWidth = width * this.viewScale * this.backingScaleX;
        const clipHeight = height * this.viewScale * this.backingScaleY;
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(Math.round(left), Math.round(this.canvas.height - top - clipHeight), Math.round(clipWidth), Math.round(clipHeight));
    }
    popClip() {
        this.flush();
        this.gl.disable(this.gl.SCISSOR_TEST);
    }
    getGlobalAlpha() {
        return this.globalAlpha;
    }
    setGlobalAlpha(alpha) {
        this.globalAlpha = alpha;
    }
    setView(scale, offsetX, offsetY) {
        this.viewScale = scale;
        this.viewOffsetX = offsetX;
        this.viewOffsetY = offsetY;
    }
    resetAlpha() {
        this.globalAlpha = 1;
    }
    strokePath(positions, color = '#000') {
        if (positions.length < 2) {
            return;
        }
        this.drawLines(positions, color, this.gl.LINE_LOOP);
    }
    strokeRect(x, y, width, height, color = '#000') {
        this.drawLines([
            new Vector_1.Vector(x, y),
            new Vector_1.Vector(x + width, y),
            new Vector_1.Vector(x + width, y + height),
            new Vector_1.Vector(x, y + height),
        ], color, this.gl.LINE_LOOP);
    }
    // Append one axis-aligned quad to the batch. Flushes first if the texture
    // differs from the current run's or the buffer is full. The view transform
    // (camera zoom) is applied here on the CPU — pure scale + translate.
    pushQuad(texture, x, y, width, height, u0, v0, u1, v1, r, g, b, a, tintR, tintG, tintB, tintA, flash) {
        if (texture !== this.batchTexture || this.quadCount >= MAX_QUADS) {
            this.flush();
            this.batchTexture = texture;
        }
        const s = this.viewScale;
        const x0 = x * s + this.viewOffsetX;
        const y0 = y * s + this.viewOffsetY;
        const x1 = x0 + width * s;
        const y1 = y0 + height * s;
        const data = this.batchData;
        const offset = this.quadCount * FLOATS_PER_QUAD;
        this.quadCount += 1;
        // Two triangles: (x0,y0) (x0,y1) (x1,y0) / (x1,y0) (x0,y1) (x1,y1).
        // Written out flat (no temporaries) — this runs for every quad on screen.
        this.writeVertex(data, offset, x0, y0, u0, v0, r, g, b, a, tintR, tintG, tintB, tintA, flash);
        this.writeVertex(data, offset + 13, x0, y1, u0, v1, r, g, b, a, tintR, tintG, tintB, tintA, flash);
        this.writeVertex(data, offset + 26, x1, y0, u1, v0, r, g, b, a, tintR, tintG, tintB, tintA, flash);
        this.writeVertex(data, offset + 39, x1, y0, u1, v0, r, g, b, a, tintR, tintG, tintB, tintA, flash);
        this.writeVertex(data, offset + 52, x0, y1, u0, v1, r, g, b, a, tintR, tintG, tintB, tintA, flash);
        this.writeVertex(data, offset + 65, x1, y1, u1, v1, r, g, b, a, tintR, tintG, tintB, tintA, flash);
    }
    writeVertex(data, offset, x, y, u, v, r, g, b, a, tintR, tintG, tintB, tintA, flash) {
        data[offset] = x;
        data[offset + 1] = y;
        data[offset + 2] = u;
        data[offset + 3] = v;
        data[offset + 4] = r;
        data[offset + 5] = g;
        data[offset + 6] = b;
        data[offset + 7] = a;
        data[offset + 8] = tintR;
        data[offset + 9] = tintG;
        data[offset + 10] = tintB;
        data[offset + 11] = tintA;
        data[offset + 12] = flash;
    }
    drawLines(positions, color, mode) {
        // Lines use a different vertex layout, so the pending quads must be
        // submitted first to keep draw ordering intact.
        this.flush();
        const gl = this.gl;
        const s = this.viewScale;
        const data = new Float32Array(positions.length * 2);
        positions.forEach((p, i) => {
            data[i * 2] = p.x * s + this.viewOffsetX;
            data[i * 2 + 1] = p.y * s + this.viewOffsetY;
        });
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.aPosition);
        gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);
        // Constant attributes: sample the white texture at a fixed texel and put
        // the whole color into a_color, matching the fill path.
        const rgba = this.parseColor(color);
        gl.disableVertexAttribArray(this.aTexcoord);
        gl.vertexAttrib2f(this.aTexcoord, 0.5, 0.5);
        gl.disableVertexAttribArray(this.aColor);
        gl.vertexAttrib4f(this.aColor, rgba[0], rgba[1], rgba[2], rgba[3] * this.globalAlpha);
        gl.disableVertexAttribArray(this.aTint);
        gl.vertexAttrib4f(this.aTint, 0, 0, 0, 0);
        gl.disableVertexAttribArray(this.aFlash);
        gl.vertexAttrib1f(this.aFlash, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.whiteTexture);
        gl.drawArrays(mode, 0, positions.length);
    }
    getTexture(element) {
        const existing = this.textureMap.get(element);
        if (existing !== undefined) {
            return existing;
        }
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, element);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        this.textureMap.set(element, texture);
        return texture;
    }
    getTextCanvas(text, maxWidth, fontSize, fontFamily, fontWeight, color, align, strokeColor, strokeWidth, letterSpacing) {
        const width = Math.max(1, Math.ceil(maxWidth));
        const height = Math.max(1, Math.ceil(fontSize * 1.35));
        const key = [
            text,
            width,
            height,
            fontSize,
            fontFamily,
            fontWeight,
            color,
            align,
            strokeColor,
            strokeWidth,
            letterSpacing,
        ].join('|');
        const existing = this.textCanvasMap.get(key);
        if (existing !== undefined) {
            return existing;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (context !== null) {
            context.clearRect(0, 0, width, height);
            context.fillStyle = color;
            context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
            context.textAlign = align;
            context.textBaseline = 'top';
            const textX = align === 'center' ? width / 2 : align === 'right' ? width : 0;
            if (strokeColor !== null && strokeWidth > 0) {
                context.strokeStyle = strokeColor;
                context.lineWidth = strokeWidth;
                context.lineJoin = 'round';
                (0, CanvasText_1.drawTrackedText)(context, text, textX, 0, width, align, letterSpacing, true);
            }
            (0, CanvasText_1.drawTrackedText)(context, text, textX, 0, width, align, letterSpacing);
        }
        this.textCanvasMap.set(key, canvas);
        return canvas;
    }
    parseColor(color) {
        const cached = this.colorCache.get(color);
        if (cached !== undefined) {
            return cached;
        }
        let rgba = [0, 0, 0, 1];
        if (color[0] === '#') {
            let hex = color.slice(1);
            if (hex.length === 3) {
                hex = hex.split('').map((c) => c + c).join('');
            }
            const int = parseInt(hex, 16);
            if (hex.length === 6) {
                rgba = [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255, 1];
            }
            else if (hex.length === 8) {
                rgba = [((int >> 24) & 255) / 255, ((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
            }
        }
        else {
            const m = color.match(/rgba?\(([^)]+)\)/);
            if (m !== null) {
                const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
                rgba = [(parts[0] || 0) / 255, (parts[1] || 0) / 255, (parts[2] || 0) / 255, parts[3] === undefined ? 1 : parts[3]];
            }
        }
        this.colorCache.set(color, rgba);
        return rgba;
    }
    createProgram(vsSource, fsSource) {
        const gl = this.gl;
        const vs = this.createShader(gl.VERTEX_SHADER, vsSource);
        const fs = this.createShader(gl.FRAGMENT_SHADER, fsSource);
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`Failed to link program: ${log}`);
        }
        return program;
    }
    createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Failed to compile shader: ${log}`);
        }
        return shader;
    }
}
exports.WebglRenderContext = WebglRenderContext;
