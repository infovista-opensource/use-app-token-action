import * as core from '@actions/core'
import * as github from '@actions/github'
import isBase64 from 'is-base64'
import { createAppAuth } from '@octokit/auth-app'

export function getAppSlugName() {
  return core.getInput('app_slug_name') || 'BOT_NAME'
}

export function getAppTokenName() {
  return core.getInput('app_token_name') || 'BOT_TOKEN'
}

export function getOrganization() {
  return core.getInput('target-organization') || process.env.GITHUB_OWNER
}

export async function getAppInfo() {
  const fallback = core.getInput('fallback')
  const required = fallback == null
  const appId = Number(core.getInput('app_id', { required }))
  const privateKeyInput = core.getInput('private_key', { required })
  const targetOrg =
    core.getInput('target-organization') || github.context.repo.owner

  if (appId == null || privateKeyInput == null) {
    return Promise.resolve({ token: fallback, slug: '' })
  }

  const privateKey = isBase64(privateKeyInput)
    ? Buffer.from(privateKeyInput, 'base64').toString('utf8')
    : privateKeyInput

  const auth = createAppAuth({ appId, privateKey })

  // 1. Retrieve JSON Web Token (JWT) to authenticate as app
  core.info(`Authenticating as app ${appId}...`)
  const { token: jwt } = await auth({ type: 'app' })

  // 2. Get installationId of the app
  core.info(`Getting installationId for ${targetOrg}...`)
  const octokit = createOctokit(jwt)
  const install = await octokit.rest.apps.getOrgInstallation({
    org: targetOrg,
  })
  core.debug(JSON.stringify(install, null, 4))

  // 3. Retrieve installation access token
  core.info(
    `Getting installation access token for ${install.data.id}/${install.data.app_slug}...`,
  )
  const { data } = await octokit.request(
    `POST ${install.data.access_tokens_url}`,
    {
      installation_id: install.data.id,
    },
  )
  core.info('token created successfully')
  core.debug(JSON.stringify(data, null, 4))
  return { token: data.token, slug: install.data.app_slug }
}

export async function deleteToken(token: string) {
  core.info(`deleting token ${token}`)
  const octokit = createOctokit(token)
  await octokit.request('DELETE /installation/token')
}

function createOctokit(token: string): any {
  return github.getOctokit(token, { proxy: process.env.HTTPS_PROXY })
}
