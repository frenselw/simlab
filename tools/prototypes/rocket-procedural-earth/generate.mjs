import {sample, color, generateGlobe} from './terrain.mjs';
self.onmessage = ({data: {width, height}}) => {
  const started = performance.now();
  const result = generateGlobe(width, height, sample, color);
  self.postMessage({...result, ms: performance.now() - started}, [result.pixels.buffer]);
};
