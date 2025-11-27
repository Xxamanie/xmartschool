import { defineConfig } from 'prisma';

export default defineConfig({
  schema: './backend/prisma/schema.prisma',

  // prisma client config
  client: {
    output: './backend/node_modules/.prisma/client',
    // optional for accelerateUrl, but skip for now
  },
});
