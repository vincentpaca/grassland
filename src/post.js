import * as B from '@babylonjs/core';

// Post chain + spindrift. (TAA/SSR deviation: using FXAA + SSAO2; see DECISIONS.md)
export function createPost(scene, camera, ctx) {
  const pipeline = new B.DefaultRenderingPipeline('pp', true, scene, [camera]);
  pipeline.fxaaEnabled = true;
  pipeline.samples = 4; // MSAA-ish via engine samples
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.75; pipeline.bloomWeight = 0.45; pipeline.bloomKernel = 64; pipeline.bloomScale = 0.5;
  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.toneMappingEnabled = true;
  pipeline.imageProcessing.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  pipeline.imageProcessing.exposure = 1.15; pipeline.imageProcessing.contrast = 1.12;
  pipeline.imageProcessing.vignetteEnabled = true; pipeline.imageProcessing.vignetteWeight = 1.2; pipeline.imageProcessing.vignetteColor = new B.Color4(0.02, 0.03, 0.06, 1);
  pipeline.depthOfFieldEnabled = true; pipeline.depthOfField.focalLength = 220; pipeline.depthOfField.fStop = 8; pipeline.depthOfField.focusDistance = 6000; pipeline.depthOfField.blurLevel = B.DepthOfFieldEffectBlurLevel.Low;
  pipeline.sharpenEnabled = true; pipeline.sharpen.edgeAmount = 0.25; pipeline.sharpen.colorAmount = 1.0;
  pipeline.grainEnabled = true; pipeline.grain.intensity = 6; pipeline.grain.animated = true;

  let ssao = null;
  try {
    ssao = new B.SSAO2RenderingPipeline('ssao2', scene, { ssaoRatio: 0.5, blurRatio: 1.0 }, [camera]);
    ssao.totalStrength = 1.0; ssao.radius = 0.6; ssao.samples = 12; ssao.beta = 0.04;
    scene.ssao = ssao;
  } catch (e) {}

  // spindrift: low wind-driven surface snow streaming across the field
  const drift = new B.ParticleSystem('drift', 600, scene);
  drift.particleTexture = ctx.sprayTex;
  drift.emitter = new B.Vector3(0, 0.2, 0);
  drift.minEmitBox = new B.Vector3(-30, 0, -30); drift.maxEmitBox = new B.Vector3(30, 1.5, 30);
  drift.color1 = new B.Color4(1, 1, 1, 0.5); drift.color2 = new B.Color4(0.9, 0.93, 1, 0.35);
  drift.colorDead = new B.Color4(1, 1, 1, 0);
  drift.minSize = 0.05; drift.maxSize = 0.18; drift.minLifeTime = 1.5; drift.maxLifeTime = 3.5;
  drift.emitRate = 220; drift.blendMode = B.ParticleSystem.BLENDMODE_STANDARD;
  drift.direction1 = new B.Vector3(4, 0.2, 1.2); drift.direction2 = new B.Vector3(7, 0.6, 2.4);
  drift.minEmitPower = 1; drift.maxEmitPower = 3; drift.gravity = new B.Vector3(0, -0.4, 0);
  drift.updateSpeed = 0.016; drift.start();

  return {
    pipeline, ssao, drift,
    setQuality(q) {
      if (q === 0) { pipeline.bloomEnabled = false; pipeline.depthOfFieldEnabled = false; if (ssao) ssao.dispose(), ssao = null; }
      else { pipeline.bloomEnabled = true; pipeline.depthOfFieldEnabled = q >= 2; }
    }
  };
}
