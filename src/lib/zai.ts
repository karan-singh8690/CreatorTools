/**
 * z-ai-web-dev-sdk helper.
 *
 * The SDK's ZAI.create() method reads a .z-ai-config file from disk,
 * which doesn't exist on Vercel (read-only filesystem). Instead of
 * writing a config file at runtime, we bypass create() entirely and
 * instantiate the ZAI class directly with our config object.
 *
 * This works because the SDK constructor is:
 *   constructor(config) { this.config = config; ... }
 */

const ZAI_CONFIG = {
  baseUrl: process.env.ZAI_BASE_URL || 'https://internal-api.z.ai/v1',
  apiKey: process.env.ZAI_API_KEY || 'Z.ai',
  chatId: process.env.ZAI_CHAT_ID || 'chat-6d2181a7-c845-4973-b026-79828c02e372',
  userId: process.env.ZAI_USER_ID || '994410df-9d0f-467d-bebf-bda48a9477af',
  token: process.env.ZAI_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiOTk0NDEwZGYtOWQwZi00NjdkLWJlYmYtYmRhNDhhOTQ3N2FmIiwiY2hhdF9pZCI6ImNoYXQtNmQyMTgxYTctYzg0NS00OTczLWIwMjYtNzk4MjhjMDJlMzcyIiwicGxhdGZvcm0iOiJ6YWkifQ.zXHYrh4tvYG3U9D_qIFnO_Ry9nvBqIPUGHUqZCFbGxE',
}

let zaiInstance: InstanceType<typeof import('z-ai-web-dev-sdk').default> | null = null

/**
 * Get a configured z-ai-web-dev-sdk instance.
 * Creates the instance directly with config — no config file needed.
 */
export async function getZai() {
  if (zaiInstance) return zaiInstance

  const ZAI = (await import('z-ai-web-dev-sdk')).default
  // Use the constructor directly instead of ZAI.create()
  // This completely bypasses the loadConfig() file-reading logic
  zaiInstance = new ZAI(ZAI_CONFIG)
  return zaiInstance
}
