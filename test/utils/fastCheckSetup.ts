import fc from 'fast-check'

const DEFAULT_SEED = 20261029
const DEFAULT_NUM_RUNS = 100
const SEED_VARIABLE = 'FC_SEED'
const INTEGER = /^-?\d+$/

const readSeed = (raw: string | undefined): number => {
  if (raw === undefined) return DEFAULT_SEED
  if (!INTEGER.test(raw)) {
    throw new Error(`${SEED_VARIABLE} must be an integer, got "${raw}"`)
  }
  return Number(raw)
}

fc.configureGlobal({
  seed: readSeed(process.env[SEED_VARIABLE]),
  numRuns: DEFAULT_NUM_RUNS,
  includeErrorInReport: true,
})
