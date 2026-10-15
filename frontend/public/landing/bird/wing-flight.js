(function (global) {
  'use strict';

  // The approved PNGs are skinned around a shared, body-aligned flight skeleton.
  // Span moves in a 3D stroke plane, not by rotating the whole feather fan in 2D.
  const WIDTH = 1659;
  const HEIGHT = 1348;
  const PAD = 360;
  const VIEW_WIDTH = WIDTH + PAD * 2;
  const VIEW_HEIGHT = HEIGHT + PAD * 2;
  const ROOT = { x: 738, y: 644 };
  const FAR_ROOT = { x: 712, y: 622 };
  const AXIS = { x: 0.64, y: Math.sqrt(1 - 0.64 * 0.64) };
  const SPAN = { x: AXIS.y, y: -AXIS.x };
  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const unitPhase = (p) => ((p % 1) + 1) % 1;
  const smooth = (a, b, v) => {
    const t = clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  function beatAt(phase) {
    const p = unitPhase(phase);
    const down = p < 0.46;
    const t = down ? p / 0.46 : (p - 0.46) / 0.54;
    // The two wings share this stroke. Their opposite depth-side projections
    // explain the different silhouettes; neither wing beats out of phase.
    const eased = 0.5 - 0.5 * Math.cos(Math.PI * t);
    const shoulder = down ? lerp(68, -52, eased) : lerp(-52, 68, eased);
    const fold = down ? 0 : Math.pow(Math.sin(Math.PI * t), 2);
    return { shoulder, fold, down, progress: t, phase: p };
  }

  function projectedSegment(phase, side) {
    const beat = beatAt(phase);
    const angle = beat.shoulder * DEG;
    const sign = side === 'far' ? -1 : 1;
    // Orthographic span/lift followed by a small depth perspective correction.
    // 0.6/0.8 is the camera's oblique view around the fixed body axis.
    const b = sign * 0.6 * Math.cos(angle) + 0.8 * Math.sin(angle);
    const z = sign * 0.8 * Math.cos(angle) - 0.6 * Math.sin(angle);
    const sweep = side === 'far'
      ? -0.22 - 0.16 * (1 - b * b) + beat.fold * 0.1
      : 0.18 * (1 - b * b) - 0.0135 + beat.fold * 0.16;
    return { b, z, sweep, fold: beat.fold, shoulder: angle };
  }

  function wingPoseAt(phase, amplitude, resting, side) {
    const amp = resting ? 0 : clamp(amplitude, 0, 1);
    const current = beatAt(phase);
    const reference = projectedSegment(0, side);
    const baselineSpan = reference.b;
    const segments = [0, 0.018, 0.036, 0.052].map((lag) => {
      const p = projectedSegment(phase - lag, side);
      return {
        b: lerp(baselineSpan, p.b, amp),
        z: lerp(reference.z, p.z, amp),
        sweep: side === 'far' ? lerp(-0.29, p.sweep, amp) : p.sweep * amp,
        fold: p.fold * amp,
        shoulder: lerp(68 * DEG, p.shoulder, amp)
      };
    });
    const featherPitch = (-8 + 17 * Math.sin(TAU * (phase - 0.035))) * DEG * amp;
    const root = side === 'far' ? FAR_ROOT : ROOT;
    return {
      side, root, sourceRoot: ROOT, segments, baselineSpan, referenceZ: reference.z,
      spanScale: side === 'far' ? 0.84 : 1,
      shoulder: segments[0].shoulder,
      wrist: (segments[2].shoulder - segments[0].shoulder),
      tipLag: (segments[3].shoulder - segments[0].shoulder),
      featherPitch, fold: current.fold * amp, amplitude: amp,
      resting: amp <= 0.00001, phase: unitPhase(phase),
      // A mild axial sweep retains span at the edge-on moment. It remains
      // continuous when the vertical projection changes sign.
      plane: Math.hypot(segments[0].b, segments[0].sweep),
      farOpacity: 1, opacity: 1
    };
  }

  function poseAt(phase, rate, amplitude, resting) {
    const near = wingPoseAt(phase, amplitude, resting, 'near');
    near.far = wingPoseAt(phase, amplitude, resting, 'far');
    return near;
  }

  // The mesh uses this exact function on its CPU vertex positions. A body-axis
  // upper arm, elbow, wrist and feather tip form one continuous shoulder chain.
  function deformPoint(x, y, pose) {
    if (!pose || (pose.resting && pose.side !== 'far')) return { x, y };
    const dx = x - ROOT.x;
    const dy = y - ROOT.y;
    const v = dx * SPAN.x + dy * SPAN.y;
    const u = dx * AXIS.x + dy * AXIS.y;
    if (Math.abs(v) < 0.00001 && Math.abs(u) < 0.00001) return { ...pose.root };
    const physicalSpan = v / pose.baselineSpan * pose.spanScale;
    const sign = physicalSpan < 0 ? -1 : 1;
    const distance = Math.abs(physicalSpan);
    const lengths = [Math.min(distance, 185), clamp(distance - 185, 0, 220),
      clamp(distance - 405, 0, 300), Math.max(distance - 705, 0)];
    let a = 0;
    let b = 0;
    let z = 0;
    for (let i = 0; i < 4; i += 1) {
      const segment = pose.segments[i];
      // Recovery draws the distal wing inward while leaving the root fixed.
      const extension = i < 2 ? 1 : 1 - segment.fold * (i === 2 ? 0.13 : 0.21);
      const span = lengths[i] * extension * sign;
      a += span * segment.sweep;
      b += span * segment.b;
      z += span * (segment.z - pose.referenceZ);
    }
    const distal = smooth(140, 640, distance);
    const chordCompression = 1 - pose.fold * 0.09 * distal;
    a += u * chordCompression * Math.cos(pose.featherPitch * distal);
    b += u * Math.sin(pose.featherPitch * distal) * 0.26;
    // A 3D perspective contribution is limited to avoid disproportionate fans.
    const perspective = clamp(1 / (1 + z / 5200), 0.86, 1.16);
    return {
      x: pose.root.x + (a * AXIS.x + b * SPAN.x) * perspective,
      y: pose.root.y + (a * AXIS.y + b * SPAN.y) * perspective
    };
  }

  const VERTEX_SOURCE = `
    precision highp float;
    attribute vec2 aPosition;
    attribute vec2 aUV;
    varying vec2 vUV;
    void main() {
      vec2 p = aPosition + vec2(360.0);
      gl_Position = vec4(p.x / 2379.0 * 2.0 - 1.0, 1.0 - p.y / 2068.0 * 2.0, 0.0, 1.0);
      vUV = aUV;
    }
  `;

  const FRAGMENT_SOURCE = `
    precision mediump float;
    uniform sampler2D uTexture;
    varying vec2 vUV;
    void main() {
      vec4 color = texture2D(uTexture, vUV);
      if (color.a < 0.0001) discard;
      // The PNG is sampled as straight alpha. The transparent canvas and
      // ONE/ONE_MINUS_SRC_ALPHA blending use a premultiplied result.
      gl_FragColor = vec4(color.rgb * color.a, color.a);
    }
  `;

  function createMesh() {
    const columns = 28;
    const rows = 24;
    const xLines = Array.from({ length: columns + 1 }, (_, i) => WIDTH * i / columns);
    const yLines = Array.from({ length: rows + 1 }, (_, i) => HEIGHT * i / rows);
    // The shoulder is a real vertex, not just a point within a large triangle.
    // This prevents interpolation from letting the attachment drift by pixels.
    xLines[Math.round(ROOT.x / WIDTH * columns)] = ROOT.x;
    yLines[Math.round(ROOT.y / HEIGHT * rows)] = ROOT.y;
    const data = new Float32Array((columns + 1) * (rows + 1) * 4);
    let offset = 0;
    for (let row = 0; row <= rows; row += 1) {
      for (let column = 0; column <= columns; column += 1) {
        data[offset++] = xLines[column];
        data[offset++] = yLines[row];
        data[offset++] = xLines[column] / WIDTH;
        data[offset++] = yLines[row] / HEIGHT;
      }
    }
    const indices = new Uint16Array(columns * rows * 6);
    offset = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const a = row * (columns + 1) + column;
        const b = a + 1;
        const c = a + columns + 1;
        const d = c + 1;
        indices[offset++] = a; indices[offset++] = c; indices[offset++] = b;
        indices[offset++] = b; indices[offset++] = c; indices[offset++] = d;
      }
    }
    return { data, indices };
  }

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'Wing shader compilation failed.';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function imageLoaded(img) {
    if (img.complete && img.naturalWidth) return Promise.resolve(img);
    return new Promise((resolve, reject) => {
      img.addEventListener('load', () => resolve(img), { once: true });
      img.addEventListener('error', () => reject(new Error('Wing texture did not load.')), { once: true });
    });
  }

  class WingCanvas {
    constructor(img, side, host) {
      this.img = img;
      this.canvas = document.createElement('canvas');
      this.canvas.className = `${side}-wing-canvas`;
      this.canvas.setAttribute('aria-hidden', 'true');
      Object.assign(this.canvas.style, {
        position: 'absolute', left: `${-PAD}px`, top: `${-PAD}px`,
        width: `${VIEW_WIDTH}px`, height: `${VIEW_HEIGHT}px`,
        zIndex: side === 'near' ? '3' : '0', pointerEvents: 'none',
        display: 'none', transformOrigin: `${ROOT.x + PAD}px ${ROOT.y + PAD}px`
      });
      host.insertBefore(this.canvas, img);
      this.gl = this.canvas.getContext('webgl', {
        alpha: true, antialias: true, depth: false, stencil: false,
        premultipliedAlpha: true, preserveDrawingBuffer: false,
        powerPreference: 'low-power', desynchronized: true
      });
      if (!this.gl) {
        this.canvas.remove();
        throw new Error('WebGL is unavailable.');
      }
      this.resolution = -1;
      this.lost = false;
      this.canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        this.lost = true;
      });
    }

    initialize() {
      const gl = this.gl;
      const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
      const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
      this.program = gl.createProgram();
      gl.attachShader(this.program, vertex);
      gl.attachShader(this.program, fragment);
      gl.linkProgram(this.program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(this.program) || 'Wing shader linking failed.');
      }
      gl.useProgram(this.program);
      const mesh = createMesh();
      this.sourceVertices = mesh.data;
      this.deformedVertices = new Float32Array(mesh.data);
      this.vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.DYNAMIC_DRAW);
      const position = gl.getAttribLocation(this.program, 'aPosition');
      const uv = gl.getAttribLocation(this.program, 'aUV');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(uv);
      gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
      this.indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
      this.indexCount = mesh.indices.length;
      this.texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(gl.getUniformLocation(this.program, 'uTexture'), 0);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
      this.canvas.style.display = 'block';
    }

    resize(pixelScale) {
      const dpr = clamp(global.devicePixelRatio || 1, 1, 2);
      // Quantized changes avoid reallocating GPU buffers on every scroll frame.
      const factor = clamp(Math.ceil(Math.max(pixelScale, 0.01) * dpr * 4) / 4, 512 / WIDTH, 1);
      if (factor === this.resolution) return;
      this.resolution = factor;
      this.canvas.width = Math.round(VIEW_WIDTH * factor);
      this.canvas.height = Math.round(VIEW_HEIGHT * factor);
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    draw(pose, pixelScale, opacity) {
      this.resize(pixelScale);
      const gl = this.gl;
      this.canvas.style.opacity = String(opacity);
      this.canvas.style.visibility = opacity <= 0.0001 ? 'hidden' : 'visible';
      if (opacity <= 0.0001) return;
      gl.useProgram(this.program);
      for (let i = 0; i < this.sourceVertices.length; i += 4) {
        const p = deformPoint(this.sourceVertices[i], this.sourceVertices[i + 1], pose);
        this.deformedVertices[i] = p.x;
        this.deformedVertices[i + 1] = p.y;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.deformedVertices);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    destroy() {
      const gl = this.gl;
      if (gl && !this.lost) {
        if (this.texture) gl.deleteTexture(this.texture);
        if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
        if (this.indexBuffer) gl.deleteBuffer(this.indexBuffer);
        if (this.program) gl.deleteProgram(this.program);
      }
      this.canvas.remove();
    }
  }

  class IdeaPopWingFlight {
    constructor(host) {
      this.host = typeof host === 'string' ? document.querySelector(host) : host;
      if (!this.host) this.host = document.getElementById('bird');
      if (!this.host) throw new Error('The bird element was not found.');
      this.nearImage = this.host.querySelector('.near-wing');
      this.farImage = this.host.querySelector('.far-wing');
      this.phase = 0;
      this.lastTime = null;
      this.useGL = false;
      this.loading = true;
      this.error = '';
      this.pending = { timeSeconds: 0, amplitude: 0, resting: true, pixelScale: 0.4, flapRateHz: 7.2 };
      this.state = { useGL: false, ready: false, phase: 0, resting: true };
      this.ready = this.initialize();
    }

    async initialize() {
      try {
        if (!this.nearImage || !this.farImage) throw new Error('The registered wing images were not found.');
        await Promise.all([imageLoaded(this.nearImage), imageLoaded(this.farImage)]);
        this.near = new WingCanvas(this.nearImage, 'near', this.host);
        this.far = new WingCanvas(this.farImage, 'far', this.host);
        this.near.initialize();
        this.far.initialize();
        this.useGL = true;
        this.nearImage.style.visibility = 'hidden';
        this.farImage.style.visibility = 'hidden';
      } catch (error) {
        this.error = String(error.message || error);
        if (this.near) this.near.destroy();
        if (this.far) this.far.destroy();
        this.near = null;
        this.far = null;
        this.useGL = false;
      }
      this.loading = false;
      // Initialization draws an identity frame first. The page's only RAF loop
      // continues supplying updates; this helper owns no timers or RAF loop.
      this.update(this.pending);
      return this;
    }

    update(options) {
      options = options || {};
      this.pending = options;
      const time = Number.isFinite(options.timeSeconds) ? options.timeSeconds : 0;
      const rate = clamp(Number.isFinite(options.flapRateHz) ? options.flapRateHz : 7.2, 0.2, 14);
      const amplitude = clamp(Number.isFinite(options.amplitude) ? options.amplitude : 1, 0, 1);
      const resting = Boolean(options.resting) || amplitude <= 0.00001;
      const pixelScale = Math.max(0.01, Number.isFinite(options.pixelScale) ? options.pixelScale : 0.4);
      // Integrate frequency over elapsed time. Route changes never restart or
      // jump the wingbeat when the caller smoothly changes flight speed.
      if (this.lastTime !== null) {
        const delta = clamp(time - this.lastTime, 0, 0.1);
        if (!resting) this.phase = unitPhase(this.phase + delta * rate);
      }
      this.lastTime = time;
      const pose = poseAt(this.phase, rate, amplitude, resting);
      if (this.useGL && (this.near.lost || this.far.lost)) {
        this.error = 'WebGL context was lost; the source images remain available.';
        this.near.canvas.style.display = 'none';
        this.far.canvas.style.display = 'none';
        this.useGL = false;
        this.nearImage.style.visibility = 'visible';
        this.farImage.style.visibility = 'visible';
      }
      if (!this.loading) {
        if (this.useGL) {
          this.near.draw(pose, pixelScale, 1);
          this.far.draw(pose.far, pixelScale, 1);
        } else {
          this.nearImage.style.visibility = 'visible';
          this.farImage.style.visibility = 'visible';
          const applyProjection = (img, p) => {
            const u = deformPoint(ROOT.x + AXIS.x * 400, ROOT.y + AXIS.y * 400, p);
            const v = deformPoint(ROOT.x + SPAN.x * 400, ROOT.y + SPAN.y * 400, p);
            const ux = (u.x - p.root.x) / 400, uy = (u.y - p.root.y) / 400;
            const vx = (v.x - p.root.x) / 400, vy = (v.y - p.root.y) / 400;
            const a = ux * AXIS.x + vx * SPAN.x;
            const b = uy * AXIS.x + vy * SPAN.x;
            const c = ux * AXIS.y + vx * SPAN.y;
            const d = uy * AXIS.y + vy * SPAN.y;
            img.style.transform = `matrix(${a},${b},${c},${d},${p.root.x - ROOT.x},${p.root.y - ROOT.y})`;
          };
          applyProjection(this.nearImage, pose);
          applyProjection(this.farImage, pose.far);
          this.farImage.style.opacity = '1';
        }
      }
      this.state = {
        useGL: this.useGL, ready: !this.loading, error: this.error,
        phase: pose.phase, shoulderAngle: pose.shoulder / DEG,
        wristBend: pose.wrist / DEG, tipLag: pose.tipLag / DEG,
        farOpacity: 1, rearWingVisible: true, planeScale: pose.plane,
        resting: pose.resting, amplitude: pose.amplitude, flapRateHz: rate,
        root: { ...ROOT }, padding: PAD,
        nearPose: { root: { ...pose.root }, shoulderAngle: pose.shoulder / DEG,
          projectedSpan: pose.segments[0].b, axialSweep: pose.segments[0].sweep,
          fold: pose.fold, opacity: 1 },
        farPose: { root: { ...pose.far.root }, shoulderAngle: pose.far.shoulder / DEG,
          projectedSpan: pose.far.segments[0].b, axialSweep: pose.far.segments[0].sweep,
          fold: pose.far.fold, opacity: 1 },
        strokeModel: 'bilateral-body-axis-3d',
        mesh: { columns: 28, rows: 24, triangles: 1344 },
        backing: this.useGL ? [this.near.canvas.width, this.near.canvas.height] : null
      };
      return this.state;
    }

    getState() { return { ...this.state }; }

    destroy() {
      if (this.near) this.near.destroy();
      if (this.far) this.far.destroy();
      if (this.nearImage) { this.nearImage.style.visibility = ''; this.nearImage.style.transform = ''; }
      if (this.farImage) { this.farImage.style.visibility = ''; this.farImage.style.transform = ''; this.farImage.style.opacity = ''; }
      this.useGL = false;
    }
  }

  IdeaPopWingFlight.math = Object.freeze({ beatAt, poseAt, wingPoseAt, deformPoint, createMesh,
    root: { ...ROOT }, farRoot: { ...FAR_ROOT }, bodyAxis: { ...AXIS }, spanAxis: { ...SPAN },
    stage: { width: WIDTH, height: HEIGHT, padding: PAD, viewWidth: VIEW_WIDTH, viewHeight: VIEW_HEIGHT } });
  global.IdeaPopWingFlight = IdeaPopWingFlight;
}(typeof window === 'undefined' ? globalThis : window));
