const envGroups = {
  web: ['VITE_API_BASE_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
  api: [
    'NODE_ENV',
    'PORT',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_DB_URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'APP_BASE_URL',
    'CORS_ORIGIN',
  ],
  supabase: ['SUPABASE_PROJECT_ID', 'SUPABASE_DB_PASSWORD'],
} as const;

const missingEntries = Object.entries(envGroups).flatMap(([group, keys]) =>
  keys
    .filter((key) => !process.env[key])
    .map((key) => ({
      group,
      key,
    })),
);

if (missingEntries.length > 0) {
  console.error('Missing environment variables:');

  for (const entry of missingEntries) {
    console.error(`- [${entry.group}] ${entry.key}`);
  }

  process.exitCode = 1;
} else {
  console.log(
    'Environment variables look complete for web, api, and Supabase scaffolding.',
  );
}
