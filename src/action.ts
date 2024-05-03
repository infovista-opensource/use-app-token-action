import * as core from '@actions/core'
import * as util from './util'

export async function run() {
  try {
    const { token, slug } = await util.getAppInfo()
    const appSlugName = util.getAppSlugName()
    const appTokenName = util.getAppTokenName()

    core.setSecret(token)

    core.setOutput('BOT_NAME', slug)
    core.setOutput('BOT_TOKEN', token)
    // save token in state to be used in cleanup
    core.saveState('token', token)

    core.exportVariable(appSlugName, slug)
    core.exportVariable(appTokenName, token)
  } catch (e) {
    core.error(e)
    core.setFailed(e.message)
  }
}

export async function cleanup() {
  try {
    const clean = core.getBooleanInput('clean')
    const token = core.getState('token')
    if (clean) {
      await util.deleteToken(token)
      core.info('Token revoked')
    }
  } catch (e) {
    core.error(e)
    core.setFailed(e.message)
  }
}
