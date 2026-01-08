import process from 'node:process';
import { drizzleD1Config } from '@deox/drizzle-d1-utils';

export default drizzleD1Config(
  {
    out: './drizzle/migrations',
    schema: './src/db/schema.ts',
  },
  {
    accountId: process.env.CLOUDFLARE_D1_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_D1_API_TOKEN,
    databaseId: '95b55368-e9b1-4830-a073-75e9a9903058',
    binding: 'DB',
    remote: process.env.REMOTE === 'true' || process.env.REMOTE === '1',
  }
);
