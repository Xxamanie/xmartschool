import { defineConfig } from '@prisma/config';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set in the environment.');

export default defineConfig({
  schema: './schema.prisma',
  datasource: {
    url: databaseUrl,
  },
});