(function() {
    const canvas = document.getElementById('shaderBg');
    if (!canvas) return;
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;

    let mouseX = 0.5, mouseY = 0.5;
    let targetX = 0.5, targetY = 0.5;
    let time = 0;
    let clickTime = -10;
    let clickX = 0.5, clickY = 0.5;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    document.addEventListener('mousemove', function(e) {
        targetX = e.clientX / window.innerWidth;
        targetY = 1.0 - e.clientY / window.innerHeight;
    });

    document.addEventListener('click', function(e) {
        clickTime = time;
        clickX = e.clientX / window.innerWidth;
        clickY = 1.0 - e.clientY / window.innerHeight;
    });

    const vertSrc = `
        attribute vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;

    const fragSrc = `
        precision mediump float;
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform vec2 u_mouse;
        uniform float u_clickTime;
        uniform vec2 u_clickPos;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
                mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
                f.y
            );
        }

        float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 4; i++) {
                v += a * noise(p);
                p *= 2.0;
                a *= 0.5;
            }
            return v;
        }

        void main() {
            vec2 uv = gl_FragCoord.xy / u_resolution;
            vec2 mouse = u_mouse;
            float t = u_time * 0.04;

            float mouseDist = distance(uv, mouse);
            float proximity = smoothstep(0.5, 0.0, mouseDist);

            vec2 q = uv;
            q.x += sin(q.y * 3.0 + t * 1.5) * 0.008;
            q.y += cos(q.x * 3.0 + t) * 0.008;

            float n1 = fbm(q * 2.5 + t * 0.2);
            float n2 = fbm(q * 4.0 - t * 0.15 + n1 * 0.4);
            float swirl = sin(n1 * 6.28 + t) * 0.5 + 0.5;
            float tendrils = pow(swirl, 2.0) * n2;

            float mouseGlow = exp(-mouseDist * 5.0) * 0.15;
            float mouseCore = exp(-mouseDist * 15.0) * 0.2;

            vec3 bg = vec3(0.047, 0.047, 0.078);
            vec3 accent = vec3(0.545, 0.361, 0.965);
            vec3 white = vec3(0.9, 0.9, 0.95);

            vec3 col = bg;

            float flow = tendrils * (0.3 + proximity * 0.5);
            col += accent * flow * 0.06;

            float dust = fbm(q * 8.0 + t * 0.3) * 0.015;
            col += white * dust * (0.2 + proximity * 0.3);

            col += accent * mouseGlow;
            col += white * mouseCore * 0.15;

            float clickAge = u_time - u_clickTime;
            if (clickAge < 2.5 && clickAge > 0.0) {
                float clickDist = distance(uv, u_clickPos);
                float ringRadius = clickAge * 0.25;
                float ringWidth = 0.01 + clickAge * 0.005;
                float ring = smoothstep(ringWidth, 0.0, abs(clickDist - ringRadius));
                float ringFade = exp(-clickAge * 1.5);
                col += accent * ring * ringFade * 0.2;
                col += white * ring * ringFade * 0.1;
                float burst = exp(-clickDist * 8.0) * exp(-clickAge * 3.0) * 0.15;
                col += white * burst;
            }

            float vignette = 1.0 - length(uv - 0.5) * 0.5;
            col *= vignette;

            col = clamp(col, 0.0, 1.0);
            gl_FragColor = vec4(col, 1.0);
        }
    `;

    function createShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vert = createShader(gl.VERTEX_SHADER, vertSrc);
    const frag = createShader(gl.FRAGMENT_SHADER, fragSrc);
    if (!vert || !frag) return;

    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');
    const uClickTime = gl.getUniformLocation(program, 'u_clickTime');
    const uClickPos = gl.getUniformLocation(program, 'u_clickPos');

    function render() {
        mouseX += (targetX - mouseX) * 0.03;
        mouseY += (targetY - mouseY) * 0.03;
        time += 0.016;
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, time);
        gl.uniform2f(uMouse, mouseX, mouseY);
        gl.uniform1f(uClickTime, clickTime);
        gl.uniform2f(uClickPos, clickX, clickY);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        requestAnimationFrame(render);
    }
    render();
})();
