import { forgetAmbientGitContext } from './gitEnv.js'

export const mochaHooks = {
  beforeAll(): void {
    forgetAmbientGitContext()
  },
}
