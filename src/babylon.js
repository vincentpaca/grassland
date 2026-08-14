// NOTE: the full barrel import is REQUIRED. Deep per-module imports tree-shake away a
// side effect that PBR lighting depends on: materials still compile (identical defines)
// but every lit PBR surface renders black. Do not "optimize" this back into deep imports
// without verifying actual rendered pixels (tools/shots.mjs).
import '@babylonjs/core';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import '@babylonjs/core/Engines/WebGPU/Extensions';
import { Engine } from '@babylonjs/core/Engines/engine';
import '@babylonjs/loaders/glTF';
import { DracoCompression } from '@babylonjs/core/Meshes/Compression/dracoCompression';

export async function createEngine(canvas) {
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const dprCap = isTouch ? Math.min(2, window.devicePixelRatio || 1) : undefined;
  const opts = { antialias: true, adaptToDeviceRatio: true, ...(dprCap != null ? { devicePixelRatio: dprCap } : {}) };
  if (navigator.gpu) {
    try {
      const ad = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (ad) return { engine: await WebGPUEngine.CreateAsync(canvas, opts), webgpu: true };
    } catch (e) { console.warn('WebGPU init failed, falling back to WebGL2:', e); }
  }
  try {
    return { engine: new Engine(canvas, true, opts, true), webgpu: false };
  } catch (e) {
    console.error('WebGL2 init failed:', e);
    throw e;
  }
}

export { Scene, Vector3, Scalar, Color4, UniversalCamera, DynamicTexture, ImageProcessingConfiguration, DefaultRenderingPipeline, DracoCompression };