import type { PrismaClientOptions } from '@prisma/client/runtime/library'

import { PrismaClient } from '@prisma/client'

import type { AccelerateEngine } from '@prisma/accelerate-engine'

/**
 * Prisma v7 config:
 * - schema.prisma should not contain datasource url
 * - pass adapter/accelerateUrl via PrismaClient constructor if needed
 *
 * This project uses a normal database connection via DATABASE_URL.
 */
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  // Keep this explicit to fail fast in local/dev environments.
  throw new Error('Missing DATABASE_URL environment variable')
}

const prismaClientOptions: PrismaClientOptions = {}

/**
 * Export a default PrismaClient instance for runtime usage.
 * Existing code imports `prisma` from backend/src/lib/prisma.ts, so this file
 * is only used by Prisma CLI tooling (migrate/validate/generate).
 */
export const prismaConfig = {
  prismaClientOptions,
  // Prisma CLI reads this config when using the new datasource-less schema approach.
}

export default prismaConfig
