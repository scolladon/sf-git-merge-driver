// Build-time constants injected by esbuild `define` in tooling/build-bin.mjs.
// Undefined in ts-node / vitest contexts; callers guard with `typeof`.
declare const __VERSION__: string | undefined
declare const __BUNDLED__: boolean | undefined
