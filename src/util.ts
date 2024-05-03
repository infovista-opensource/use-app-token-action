import * as core from '@actions/core'
import * as github from '@actions/github'
import isBase64 from 'is-base64'
import sodium from 'libsodium-wrappers'
import { Octokit } from '@octokit/core'
import { createAppAuth } from '@octokit/auth-app'
// import { ProxyAgent } from 'proxy-agent'
// import { fetch as undiciFetch, ProxyAgent } from 'undici';

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
  const octokit = github.getOctokit(jwt, { proxy: process.env.HTTPS_PROXY })
  const install = await octokit.rest.apps.getOrgInstallation({
    org: targetOrg,
  })
  core.info(JSON.stringify(install, null, 4))

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

async function makeSecret(octokit: Octokit, value: string) {
  const { repo } = github.context
  const res = await octokit.request(
    'GET /repos/:owner/:repo/actions/secrets/public-key',
    repo,
  )

  const { key } = res.data

  await sodium.ready

  // Convert Secret & Base64 key to Uint8Array.
  const binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL)
  const binsec = sodium.from_string(value)

  // Encrypt the secret using LibSodium
  const encryptedBytes = sodium.crypto_box_seal(binsec, binkey)

  return {
    key_id: res.data.key_id,
    // Base64 the encrypted secret
    encrypted_value: sodium.to_base64(
      encryptedBytes,
      sodium.base64_variants.ORIGINAL,
    ),
  }
}

export async function createSecret(
  token: string,
  secretName: string,
  secretValue: string,
) {
  const octokit = createOctokit(token)
  const secret = await makeSecret(octokit, secretValue)
  await octokit.request(
    'PUT /repos/:owner/:repo/actions/secrets/:secret_name',
    {
      ...github.context.repo,
      secret_name: secretName,
      data: secret,
    },
  )
}

export async function deleteSecret(token: string, secretName: string) {
  const octokit = createOctokit(token)
  await octokit.request(
    'DELETE /repos/:owner/:repo/actions/secrets/:secret_name',
    {
      ...github.context.repo,
      secret_name: secretName,
    },
  )
}

export async function deleteToken(token: string) {
  const octokit = createOctokit(token)
  await octokit.request('DELETE /installation/token')
}

function createOctokit(token: string): any {
  // const proxy = process.env.HTTPS_PROXY
  // if (proxy) {
  //   core.info(`Using proxy: ${proxy}`)
  //   const myFetch: typeof undiciFetch = (url, opts) => {
  //     return undiciFetch(url, {
  //       ...opts,
  //       dispatcher: new ProxyAgent({
  //         uri: proxy,
  //       }),
  //     })
  //   }
  //   return new Octokit({
  //     auth: token,
  //     request: { fetch: myFetch },
  //   })
  // }
  // return new Octokit({ auth: token })
  return github.getOctokit(token, { proxy: process.env.HTTPS_PROXY })
}
