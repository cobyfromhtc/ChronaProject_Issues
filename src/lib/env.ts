// Environment configuration
export const env = {
  get nodeEnv() {
    return process.env.NODE_ENV || 'development'
  },
  get isDev() {
    return this.nodeEnv === 'development'
  },
  get isProd() {
    return this.nodeEnv === 'production'
  },
  get firstSetupKey() {
    return process.env.FIRST_SETUP_KEY
  },
  get cronSecret() {
    return process.env.CRON_SECRET
  },
}
