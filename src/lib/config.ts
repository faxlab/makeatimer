export const config = {
  origin: 'https://makeatimer.com',
  operator: import.meta.env.PUBLIC_OPERATOR_NAME || 'MB „Faxcorp“',
  email: import.meta.env.PUBLIC_CONTACT_EMAIL || 'hello@faxcorp.dev',
  launchReady: import.meta.env.PUBLIC_LAUNCH_READY === 'true',
  analyticsEnabled:
    import.meta.env.PUBLIC_WEB_ANALYTICS_ENABLED === 'true' &&
    import.meta.env.PUBLIC_LAUNCH_READY === 'true',
  analyticsToken: import.meta.env.PUBLIC_WEB_ANALYTICS_TOKEN || '',
  consent:
    import.meta.env.PUBLIC_CONSENT_ENABLED === 'true' &&
    import.meta.env.PUBLIC_LAUNCH_READY === 'true',
  ads:
    import.meta.env.PUBLIC_ADS_ENABLED === 'true' &&
    import.meta.env.PUBLIC_CONSENT_ENABLED === 'true' &&
    import.meta.env.PUBLIC_CMP_READY === 'true' &&
    import.meta.env.PUBLIC_LAUNCH_READY === 'true',
  client: import.meta.env.PUBLIC_ADS_CLIENT || '',
  slots: {
    side: import.meta.env.PUBLIC_ADS_SIDE_SLOT || '',
    result: import.meta.env.PUBLIC_ADS_RESULT_SLOT || '',
    content: import.meta.env.PUBLIC_ADS_CONTENT_SLOT || '',
  },
};
if (config.analyticsEnabled && !/^[a-f0-9]{32}$/i.test(config.analyticsToken))
  throw new Error(
    'Enabled statistics require a valid Cloudflare Web Analytics token.',
  );
if (config.consent && !/^ca-pub-\d{16}$/.test(config.client))
  throw new Error(
    'Google consent messaging requires a valid public publisher ID.',
  );
if (
  config.launchReady &&
  (!import.meta.env.PUBLIC_OPERATOR_NAME?.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      import.meta.env.PUBLIC_CONTACT_EMAIL || '',
    ))
)
  throw new Error(
    'A public launch requires the confirmed operator name and contact email.',
  );
if (
  config.ads &&
  (!/^ca-pub-\d{16}$/.test(config.client) ||
    Object.values(config.slots).some((s) => !/^\d+$/.test(s)))
)
  throw new Error(
    'Advertising requires a real approved publisher ID and three manual slot IDs.',
  );
