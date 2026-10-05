export const productionEnv = {
  ...process.env,
  PUBLIC_LAUNCH_READY: 'true',
  PUBLIC_OPERATOR_NAME: process.env.PUBLIC_OPERATOR_NAME || 'MB „Faxcorp“',
  PUBLIC_CONTACT_EMAIL: process.env.PUBLIC_CONTACT_EMAIL || 'hello@faxcorp.dev',
  PUBLIC_ADS_ENABLED: process.env.PUBLIC_ADS_ENABLED || 'false',
  PUBLIC_WEB_ANALYTICS_ENABLED:
    process.env.PUBLIC_WEB_ANALYTICS_ENABLED || 'false',
};
