import { setup } from '../api/endpoints'

export async function getSetupStatus() {
  const response = await setup.status()
  return response.needsSetup
}

export async function shouldRedirectToSetup() {
  return await getSetupStatus()
}
