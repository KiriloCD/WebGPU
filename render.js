import { mat4 } from './libs/wgpu-matrix.min.js';

export async function startRender(canvas, sceneConfig) {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({ device, format });


    const numSpheres = sceneConfig.spheres.length;
    
    const shaderCode = `
        struct Sphere {
            pos: vec3f,
            radius: f32,
        };

        struct MyUniforms {
            time: f32,
            resolution: vec2f,
            lightColor: vec3f,
            fogStepSize: f32,
            fogSteps: f32,
            spheres: array<Sphere, ${numSpheres}>,
        };

        @group(0) @binding(0) var<uniform> uni: MyUniforms;

        struct Out {
            @builtin(position) pos: vec4f,
            @location(0) uv: vec2f
        };

        fn rand(n: vec2f) -> f32 { 
            return fract(sin(dot(n, vec2f(12.9898, 4.1414))) * 43758.5453);
        }

        @vertex
        fn vs(@builtin(vertex_index) idx: u32) -> Out {
            var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
            var out: Out;
            out.pos = vec4f(pos[idx], 0.0, 1.0);
            out.uv = pos[idx] * 0.5 + 0.5;
            return out;
        }

        @fragment
        fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
            let p = (uv * 2.0 - 1.0);
            var ro = vec3f(0.0, 0.0, -2.5); 
            var rd = normalize(vec3f(p, 1.2)); 

            let lightPos = vec3f(sin(uni.time * 0.5) * 1.2, 0.5, cos(uni.time * 0.5) * 1.2);
            var color = vec3f(0.0);
            
            var t = uni.fogStepSize * rand(uv + uni.time);

            for (var i = 0; i < i32(uni.fogSteps); i++) {
                let curPos = ro + rd * t;
                var inShadow = false;
                var hitSphere = false;

                // Перевірка колізій та тіней для всіх сфер
                for (var s = 0; s < ${numSpheres}; s++) {
                    let sphere = uni.spheres[s];
                    let dToSphere = length(curPos - sphere.pos) - sphere.radius;
                    
                    if (dToSphere < 0.005) { 
                        hitSphere = true;
                        break; 
                    }

                    let dirToLight = normalize(lightPos - curPos);
                    let distToLight = length(lightPos - curPos);
                    let L = sphere.pos - curPos;
                    let tc = dot(L, dirToLight);
                    
                    if (tc > 0.0 && tc < distToLight) {
                        let d2 = dot(L, L) - tc * tc;
                        if (d2 < sphere.radius * sphere.radius) {
                            inShadow = true;
                        }
                    }
                }

                if (hitSphere) { break; }

                if (!inShadow) {
                    let distToLight = length(lightPos - curPos);
                    let fog = 0.04 / (distToLight * distToLight + 0.2);
                    color += uni.lightColor * fog;
                }

                t += uni.fogStepSize;
            }

            return vec4f(pow(color, vec3f(1.2)), 1.0);
        }
    `;

    
    const sphereSize = 16; 
    const uniformBufferSize = 48 + (numSpheres * sphereSize);
    
    const uniformBuffer = device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = device.createShaderModule({ code: shaderCode });
    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shaderModule, entryPoint: 'vs' },
        fragment: { module: shaderModule, entryPoint: 'fs', targets: [{ format }] },
        primitive: { topology: 'triangle-list' }
    });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
    });

    function frame(time) {
        const data = new ArrayBuffer(uniformBufferSize);
        const f32 = new Float32Array(data);
        
        f32[0] = time * 0.001;          // 
        f32[1] = canvas.width;          // resolution.x
        f32[2] = canvas.height;         // resolution.y
        
        f32[4] = sceneConfig.lightColor[0];
        f32[5] = sceneConfig.lightColor[1];
        f32[6] = sceneConfig.lightColor[2];
        f32[7] = sceneConfig.fogStepSize;
        f32[8] = sceneConfig.fogSteps;


        sceneConfig.spheres.forEach((s, i) => {
            const offset = 12 + (i * 4); 
            f32[offset] = s.pos[0];
            f32[offset + 1] = s.pos[1];
            f32[offset + 2] = s.pos[2];
            f32[offset + 3] = s.radius;
        });

        device.queue.writeBuffer(uniformBuffer, 0, data);

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: [0, 0, 0, 1],
                loadOp: 'clear', storeOp: 'store'
            }]
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3);
        pass.end();
        device.queue.submit([encoder.finish()]);
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}