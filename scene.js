// scene.js
export const sceneConfig = {
    spheres: [
        { pos: [0.0, 0.0, 0.0], radius: 0.4 },
        { pos: [0.8, -0.3, 0.5], radius: 0.25 },
        { pos: [-0.7, 0.4, -0.2], radius: 0.3 },
        { pos: [0.0, -0.8, 0.3], radius: 0.2 }
    ],
    lightColor: [1.0, 0.8, 0.5], // Тепле світло
    fogStepSize: 0.08,
    fogSteps: 64
};