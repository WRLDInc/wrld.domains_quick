import { useEffect, useRef } from 'react';

/**
 * TopoField — an animated topographic contour map, drawn with a WebGL
 * fragment shader. Inspired by 21st.dev/@mengto/components/topo-field, but
 * written here so it stays on-brand: one ink colour taken from the theme
 * (`color` on the canvas, i.e. `--fg`), no dependencies.
 *
 * The rollover is this site's sibling of the wrld.design hero: the pointer is
 * a survey point. Under it the terrain rises, so the contours close into rings
 * around the cursor (a pin on the map), and the lines nearest the pointer
 * carry the three WRLD accents as a flow that trails the pointer's velocity.
 * Everything else stays monochrome, which is the one place the brand allows
 * the accent gradient: on motion.
 *
 * Behaviour
 * - Contours drift slowly; the survey point eases in when the pointer enters
 *   the hero and fades out when it leaves.
 * - `prefers-reduced-motion` draws one still frame and ignores the pointer.
 * - Pauses while off-screen or when the tab is hidden.
 * - Without WebGL the canvas simply stays empty; the hero copy never depends
 *   on it.
 */

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif
precision highp float;

uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_pointer;   // 0..1, eased
uniform vec2  u_vel;       // pointer velocity, eased
uniform float u_focus;     // 0 = pointer away, 1 = pointer over the hero
uniform vec3  u_ink;
uniform float u_alpha;

// WRLD accents: primary #007fee, secondary #00adee, warm #EE9300
const vec3 A0 = vec3(0.000, 0.498, 0.933);
const vec3 A1 = vec3(0.000, 0.678, 0.933);
const vec3 A2 = vec3(0.933, 0.576, 0.000);

// 2D simplex noise — Ian McEwan, Ashima Arts (MIT)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * snoise(p);
    p = p * 2.02 + vec2(17.3, 9.1);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 aspect = vec2(u_res.x / u_res.y, 1.0);
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p  = (uv - 0.5) * aspect * 2.4;
  vec2 pp = (u_pointer - 0.5) * aspect * 2.4;   // pointer in the same space

  // Base terrain, drifting slowly and leaning a little toward the pointer.
  p += (u_pointer - 0.5) * vec2(0.10, -0.10) * u_focus;
  float t = u_time * 0.03;
  float h = fbm(p + vec2(t * 0.7, -t * 0.45)) * 0.5 + 0.5;
  h += 0.06 * snoise(p * 3.0 + t);

  // The survey point: a hill under the pointer, dragged slightly by velocity
  // so the rings lean into the direction of travel.
  vec2 lean = u_vel * vec2(aspect.x, 1.0) * 6.0;
  vec2 d = p - pp - lean * 0.15;
  float r2 = dot(d, d);
  float peak = exp(-r2 * 7.0);
  h += 0.55 * peak * u_focus;

  // Iso-lines: one contour per 1/lines of height, every fifth one heavier.
  float lines = 20.0;
  float s = h * lines;
  float f = abs(fract(s) - 0.5);          // 0.5 exactly on a contour
  float w = fwidth(s);
  float halo = exp(-r2 * 2.2) * u_focus;  // wider than the hill: where the accent lives
  float line = smoothstep(0.5 - w * (1.4 + halo * 1.2), 0.5 - w * 0.2, f);
  float idx = floor(s + 0.5);
  float major = mod(idx, 5.0) < 0.5 ? 1.0 : 0.55;

  // Accent flow: primary <-> secondary breathes around the point; warm bleeds
  // in with speed, trailing behind the direction of travel.
  float speed = clamp(length(u_vel) * 40.0, 0.0, 1.0);
  vec2 dir = normalize(u_vel + vec2(1e-4));
  float behind = clamp(0.5 - 0.5 * dot(normalize(d + vec2(1e-4)), dir), 0.0, 1.0);
  float ang = atan(d.y, d.x);
  vec3 accent = mix(A0, A1, 0.5 + 0.5 * sin(u_time * 0.8 + ang * 2.0 + sqrt(r2) * 6.0));
  accent = mix(accent, A2, speed * behind * 0.85);

  float tint = halo * (0.55 + 0.45 * speed);
  vec3 col = mix(u_ink, accent, tint);
  float alpha = line * (major + halo * 0.6) * (u_alpha + tint * 0.6);

  gl_FragColor = vec4(col, min(alpha, 1.0));
}
`;

interface Props {
  className?: string;
}

function parseRgb(value: string): [number, number, number] {
  const m = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (!m) return [0.04, 0.04, 0.04];
  return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255];
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('TopoField shader:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function TopoField({ className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const host = canvas.parentElement ?? canvas;

    const gl =
      (canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false }) as
        | WebGLRenderingContext
        | null) ??
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return;
    gl.getExtension('OES_standard_derivatives');

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('TopoField program:', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    // One triangle that covers the clip space.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = {
      res: gl.getUniformLocation(program, 'u_res'),
      time: gl.getUniformLocation(program, 'u_time'),
      pointer: gl.getUniformLocation(program, 'u_pointer'),
      vel: gl.getUniformLocation(program, 'u_vel'),
      focus: gl.getUniformLocation(program, 'u_focus'),
      ink: gl.getUniformLocation(program, 'u_ink'),
      alpha: gl.getUniformLocation(program, 'u_alpha'),
    };

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Pointer state: target (t*), eased position (x, y), eased velocity (vx, vy), focus.
    const pt = { tx: 0.62, ty: 0.55, x: 0.62, y: 0.55, vx: 0, vy: 0, focus: 0, tFocus: 0 };
    let width = 0;
    let height = 0;
    let visible = true;
    let raf = 0;
    let last = 0;
    const start = performance.now();

    const readTheme = () => {
      const cs = getComputedStyle(canvas);
      const [r, g, b] = parseRgb(cs.color);
      const alpha = parseFloat(cs.getPropertyValue('--topo-alpha')) || 0.12;
      gl.uniform3f(u.ink, r, g, b);
      gl.uniform1f(u.alpha, alpha);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const rect = host.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width * dpr));
      height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.uniform2f(u.res, width, height);
    };

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05) || 0.016;
      last = now;
      // Frame-rate independent easing (momentum ~0.12 per 60fps frame).
      const k = 1 - Math.pow(1 - 0.12, dt * 60);
      const nx = pt.x + (pt.tx - pt.x) * k;
      const ny = pt.y + (pt.ty - pt.y) * k;
      pt.vx = pt.vx * 0.88 + (nx - pt.x);
      pt.vy = pt.vy * 0.88 + (ny - pt.y);
      pt.x = nx;
      pt.y = ny;
      pt.focus += (pt.tFocus - pt.focus) * (1 - Math.pow(1 - 0.06, dt * 60));

      gl.uniform2f(u.pointer, pt.x, pt.y);
      gl.uniform2f(u.vel, pt.vx, pt.vy);
      gl.uniform1f(u.focus, pt.focus);
      gl.uniform1f(u.time, (now - start) / 1000);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || document.hidden || reduceMotion.matches) return;
      draw(now);
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (raf) return;
      if (reduceMotion.matches) {
        pt.focus = 0;
        pt.tFocus = 0;
        draw(performance.now());
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const onPointer = (event: PointerEvent) => {
      if (reduceMotion.matches) return;
      const rect = host.getBoundingClientRect();
      pt.tx = (event.clientX - rect.left) / rect.width;
      pt.ty = 1 - (event.clientY - rect.top) / rect.height;
      pt.tFocus = 1;
    };
    const onLeave = () => {
      pt.tFocus = 0;
    };

    readTheme();
    resize();
    wake();

    const ro = new ResizeObserver(() => {
      resize();
      if (reduceMotion.matches) draw(performance.now());
    });
    ro.observe(host);

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake();
    });
    io.observe(canvas);

    const onTheme = () => {
      readTheme();
      if (reduceMotion.matches) draw(performance.now());
    };
    const themeObserver = new MutationObserver(onTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', onTheme);
    reduceMotion.addEventListener('change', wake);
    document.addEventListener('visibilitychange', wake);
    host.addEventListener('pointermove', onPointer, { passive: true });
    host.addEventListener('pointerleave', onLeave);

    const onLost = (event: Event) => {
      event.preventDefault();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    canvas.addEventListener('webglcontextlost', onLost);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      scheme.removeEventListener('change', onTheme);
      reduceMotion.removeEventListener('change', wake);
      document.removeEventListener('visibilitychange', wake);
      host.removeEventListener('pointermove', onPointer);
      host.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('webglcontextlost', onLost);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
