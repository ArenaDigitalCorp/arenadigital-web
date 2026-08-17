import { registerOTel } from '@vercel/otel'

export function register() {
  registerOTel({
    serviceName: process.env.LOGFIRE_SERVICE_NAME ?? 'arenadigital-web',
  })
}
