import { ImageSource } from '../../graphics';

import { Matrix4 } from '../../Matrix4';
import { Rect } from '../../Rect';
import { Vector } from '../../Vector';

import { RenderContext } from '../RenderContext';

// A batched-style immediate WebGL2 renderer that implements the full
// RenderContext API (textured quads, solid fills, alpha, lines) at parity with
// the Canvas2D backend. Pixel art uses NEAREST filtering; transparency uses
// straight-alpha blending. World/camera transforms are already baked into each
// object's destination rect by the scene's matrix pass, so this only needs an
// orthographic pixel->clip projection (with a y-flip).
//
// One unit-quad (0..1) is reused for every sprite/fill; per-draw model and
// texture matrices place and sample it. This is the foundation for the later
// additive-glow and lighting passes.

const vertexShaderSource = `
attribute vec2 a_position;
attribute vec2 a_texcoord;
uniform mat4 u_matrix;
uniform mat4 u_textureMatrix;
varying vec2 v_texcoord;
void main() {
  gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
  v_texcoord = (u_textureMatrix * vec4(a_texcoord, 0.0, 1.0)).xy;
}
`;

const fragmentShaderSource = `
precision mediump float;
uniform sampler2D u_texture;
uniform bool u_useTexture;
uniform vec4 u_color;
uniform float u_alpha;
varying vec2 v_texcoord;
void main() {
  vec4 color = u_useTexture ? texture2D(u_texture, v_texcoord) : u_color;
  color.a *= u_alpha;
  gl_FragColor = color;
}
`;

const IDENTITY = new Matrix4();

export class WebglRenderContext extends RenderContext {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private aPosition: number;
  private aTexcoord: number;
  private uMatrix: WebGLUniformLocation;
  private uTextureMatrix: WebGLUniformLocation;
  private uTexture: WebGLUniformLocation;
  private uUseTexture: WebGLUniformLocation;
  private uColor: WebGLUniformLocation;
  private uAlpha: WebGLUniformLocation;
  private quadBuffer: WebGLBuffer;
  private lineBuffer: WebGLBuffer;
  private projection: Matrix4;
  private globalAlpha = 1;
  private viewScale = 1;
  private viewOffsetX = 0;
  private viewOffsetY = 0;
  private textureMap = new Map<TexImageSource, WebGLTexture>();
  private colorCache = new Map<string, [number, number, number, number]>();
  private renderScale: number;

  public constructor(canvas: HTMLCanvasElement | OffscreenCanvas, renderScale = 1) {
    super(canvas);
    this.renderScale = renderScale;
  }

  public init(): void {
    const opts = { alpha: true, premultipliedAlpha: false, antialias: false };
    const gl = (this.canvas.getContext('webgl2', opts) ||
      this.canvas.getContext('webgl', opts)) as WebGLRenderingContext;
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
    const maxViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
    const maxDim = Math.min(4096, (maxViewport && maxViewport[0]) || 4096);
    const maxScale = Math.min(maxDim / logicalWidth, maxDim / logicalHeight);
    const scale = Math.max(1, Math.min(this.renderScale, maxScale));
    this.canvas.width = Math.round(logicalWidth * scale);
    this.canvas.height = Math.round(logicalHeight * scale);

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
    gl.useProgram(this.program);

    this.aPosition = gl.getAttribLocation(this.program, 'a_position');
    this.aTexcoord = gl.getAttribLocation(this.program, 'a_texcoord');
    this.uMatrix = gl.getUniformLocation(this.program, 'u_matrix');
    this.uTextureMatrix = gl.getUniformLocation(this.program, 'u_textureMatrix');
    this.uTexture = gl.getUniformLocation(this.program, 'u_texture');
    this.uUseTexture = gl.getUniformLocation(this.program, 'u_useTexture');
    this.uColor = gl.getUniformLocation(this.program, 'u_color');
    this.uAlpha = gl.getUniformLocation(this.program, 'u_alpha');

    // Unit quad shared by every sprite/fill (two triangles covering 0..1).
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    // prettier-ignore
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0, 0, 1, 1, 0,
      1, 0, 0, 1, 1, 1,
    ]), gl.STATIC_DRAW);

    this.lineBuffer = gl.createBuffer();

    this.projection = Matrix4.createProjection(logicalWidth, logicalHeight, 1);

    gl.uniform1i(this.uTexture, 0);
  }

  public clear(): void {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  public clearRect(x: number, y: number, width: number, height: number): void {
    const gl = this.gl;
    gl.enable(gl.SCISSOR_TEST);
    // Scissor origin is bottom-left, so flip y from our top-left space.
    gl.scissor(
      Math.round(x),
      Math.round(this.canvas.height - y - height),
      Math.round(width),
      Math.round(height),
    );
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
  }

  public drawImage(
    image: ImageSource,
    sourceRect: Rect,
    destinationRect: Rect,
  ): void {
    const gl = this.gl;
    const element = image.getElement() as TexImageSource;
    const texture = this.getTexture(element);

    const iw = (element as HTMLImageElement).naturalWidth || (element as HTMLCanvasElement).width;
    const ih = (element as HTMLImageElement).naturalHeight || (element as HTMLCanvasElement).height;

    // Row-vector convention (v' = v·M): build S·T·P via premultiplying
    // translate() then scale() onto the projection. The view transform
    // (camera zoom) is folded into the dest coords here — pure numbers, so the
    // matrix convention is unchanged.
    const s = this.viewScale;
    const matrix = this.projection.clone();
    matrix.translate(
      destinationRect.x * s + this.viewOffsetX,
      destinationRect.y * s + this.viewOffsetY,
      0,
    );
    matrix.scale(destinationRect.width * s, destinationRect.height * s, 1);

    const textureMatrix = Matrix4.createTranslation(sourceRect.x / iw, sourceRect.y / ih, 0);
    textureMatrix.scale(sourceRect.width / iw, sourceRect.height / ih, 1);

    this.bindQuad();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.uUseTexture, 1);
    gl.uniform1f(this.uAlpha, this.globalAlpha);
    gl.uniformMatrix4fv(this.uMatrix, false, matrix.elements);
    gl.uniformMatrix4fv(this.uTextureMatrix, false, textureMatrix.elements);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color = '#000',
  ): void {
    const gl = this.gl;
    const s = this.viewScale;
    const matrix = this.projection.clone();
    matrix.translate(x * s + this.viewOffsetX, y * s + this.viewOffsetY, 0);
    matrix.scale(width * s, height * s, 1);

    this.bindQuad();
    gl.uniform1i(this.uUseTexture, 0);
    gl.uniform4fv(this.uColor, this.parseColor(color));
    gl.uniform1f(this.uAlpha, this.globalAlpha);
    gl.uniformMatrix4fv(this.uMatrix, false, matrix.elements);
    gl.uniformMatrix4fv(this.uTextureMatrix, false, IDENTITY.elements);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public getGlobalAlpha(): number {
    return this.globalAlpha;
  }

  public setGlobalAlpha(alpha: number): void {
    this.globalAlpha = alpha;
  }

  public setView(scale: number, offsetX: number, offsetY: number): void {
    this.viewScale = scale;
    this.viewOffsetX = offsetX;
    this.viewOffsetY = offsetY;
  }

  public resetAlpha(): void {
    this.globalAlpha = 1;
  }

  public strokePath(positions: Vector[], color = '#000'): void {
    if (positions.length < 2) {
      return;
    }
    this.drawLines(positions, color, this.gl.LINE_LOOP);
  }

  public strokeRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color = '#000',
  ): void {
    this.drawLines(
      [
        new Vector(x, y),
        new Vector(x + width, y),
        new Vector(x + width, y + height),
        new Vector(x, y + height),
      ],
      color,
      this.gl.LINE_LOOP,
    );
  }

  private drawLines(positions: Vector[], color: string, mode: number): void {
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
    gl.disableVertexAttribArray(this.aTexcoord);
    gl.vertexAttrib2f(this.aTexcoord, 0, 0);

    gl.uniform1i(this.uUseTexture, 0);
    gl.uniform4fv(this.uColor, this.parseColor(color));
    gl.uniform1f(this.uAlpha, this.globalAlpha);
    gl.uniformMatrix4fv(this.uMatrix, false, this.projection.elements);
    gl.uniformMatrix4fv(this.uTextureMatrix, false, IDENTITY.elements);
    gl.drawArrays(mode, 0, positions.length);
  }

  private bindQuad(): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.aPosition);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.aTexcoord);
    gl.vertexAttribPointer(this.aTexcoord, 2, gl.FLOAT, false, 0, 0);
  }

  private getTexture(element: TexImageSource): WebGLTexture {
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

  private parseColor(color: string): [number, number, number, number] {
    const cached = this.colorCache.get(color);
    if (cached !== undefined) {
      return cached;
    }
    let rgba: [number, number, number, number] = [0, 0, 0, 1];
    if (color[0] === '#') {
      let hex = color.slice(1);
      if (hex.length === 3) {
        hex = hex.split('').map((c) => c + c).join('');
      }
      const int = parseInt(hex, 16);
      if (hex.length === 6) {
        rgba = [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255, 1];
      } else if (hex.length === 8) {
        rgba = [((int >> 24) & 255) / 255, ((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
      }
    } else {
      const m = color.match(/rgba?\(([^)]+)\)/);
      if (m !== null) {
        const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
        rgba = [(parts[0] || 0) / 255, (parts[1] || 0) / 255, (parts[2] || 0) / 255, parts[3] === undefined ? 1 : parts[3]];
      }
    }
    this.colorCache.set(color, rgba);
    return rgba;
  }

  private createProgram(vsSource: string, fsSource: string): WebGLProgram {
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

  private createShader(type: number, source: string): WebGLShader {
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
