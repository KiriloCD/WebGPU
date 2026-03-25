
import { mat4 } from 'https://cdn.jsdelivr.net/npm/wgpu-matrix@3.4.0/dist/3.x/wgpu-matrix.module.min.js';
import * as webgpuUtils from 'https://cdn.jsdelivr.net/npm/webgpu-utils@2.0.2/dist/2.x/webgpu-utils.module.min.js';

async function init() {
    const canvas = document.querySelector('canvas');
    if (!navigator.gpu) return alert("WebGPU не підтримується");

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({ device, format });

    const sampler = device.createSampler({
        magFilter: 'nearest',
        minFilter: 'nearest',
    });

    const shaderModule = device.createShaderModule({
        label: 'Main Shader',
        code: `
            struct Uniforms {
                matrix: mat4x4f,
            };
            @group(0) @binding(0) var<uniform> uniforms: Uniforms;

            struct VertexOut {
                @builtin(position) pos: vec4f,
                @location(0) uv: vec2f,
            };

            @vertex
            fn vs(@location(0) pos: vec2f, @location(1) uv: vec2f) -> VertexOut {
                var out: VertexOut;
                out.pos = uniforms.matrix * vec4f(pos, 0.0, 1.0);
                out.uv = uv;
                return out;
            }

            @fragment
            fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
                // Малюємо "шахівницю" 8x8 для перевірки чіткості пікселів
                let check = floor(uv * 8.0);
                let pattern = (u32(check.x) + u32(check.y)) % 2;
                if (pattern == 0u) {
                    return vec4f(0.2, 0.2, 0.2, 1.0);
                }
                return vec4f(0.8, 0.4, 0.1, 1.0);
            }
        `
    });

    const vertexData = new Float32Array([
        -0.8, -0.8,  0, 1,
         0.8, -0.8,  1, 1,
        -0.8,  0.8,  0, 0,
         0.8,  0.8,  1, 0,
    ]);


    const vertexBuffer = webgpuUtils.createBuffer(device, {
        data: vertexData,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    const projection = mat4.ortho(-1, 1, -1, 1, -1, 1);
    const uniformBuffer = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniformBuffer, 0, projection);

    // --- Pipeline ---
    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: shaderModule,
            entryPoint: 'vs',
            buffers: [{
                arrayStride: 16,
                attributes: [
                    { shaderLocation: 0, offset: 0, format: 'float32x2' }, // pos
                    { shaderLocation: 1, offset: 8, format: 'float32x2' }, // uv
                ]
            }]
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs',
            targets: [{ format }]
        },
        primitive: { topology: 'triangle-strip' }
    });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: sampler },
        ]
    });

    function render() {
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: [0.05, 0.05, 0.05, 1],
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });

        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, vertexBuffer);
        pass.draw(4);
        pass.end();

        device.queue.submit([encoder.finish()]);
        requestAnimationFrame(render);
    }

    render();
}

init();