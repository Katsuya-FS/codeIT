export function validateEnvironment(values: Record<string, unknown>) {
  const required = ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE', 'JWT_ACCESS_SECRET', 'JWT_ISSUER', 'JWT_AUDIENCE', 'FRONTEND_ORIGIN'];
  const missing = required.filter((key) => typeof values[key] !== 'string' || !values[key]);
  if (missing.length) throw new Error(`Missing required environment values: ${missing.join(', ')}`);
  const secret = String(values.JWT_ACCESS_SECRET);
  if (secret.length < 32) throw new Error('JWT_ACCESS_SECRET must be at least 32 characters.');
  const port = Number(values.DB_PORT ?? 3306);
  const appPort = Number(values.PORT ?? 3000);
  const proxyHops = Number(values.TRUST_PROXY_HOPS ?? 0);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DB_PORT must be a valid TCP port.');
  if (!Number.isInteger(appPort) || appPort < 1 || appPort > 65535) throw new Error('PORT must be a valid TCP port.');
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 10) throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 10.');
  const hasRunnerUrl = typeof values.JAVA_RUNNER_URL === 'string' && values.JAVA_RUNNER_URL.length > 0;
  const hasRunnerToken = typeof values.JAVA_RUNNER_TOKEN === 'string' && values.JAVA_RUNNER_TOKEN.length > 0;
  if (hasRunnerUrl !== hasRunnerToken) throw new Error('JAVA_RUNNER_URL and JAVA_RUNNER_TOKEN must be configured together.');
  if (hasRunnerToken && String(values.JAVA_RUNNER_TOKEN).length < 32) throw new Error('JAVA_RUNNER_TOKEN must be at least 32 characters.');
  values.DB_PORT = port;
  values.PORT = appPort;
  values.TRUST_PROXY_HOPS = proxyHops;
  return values;
}
