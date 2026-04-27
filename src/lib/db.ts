import { PrismaClient } from '@prisma/client'

// Global BigInt serialization fix for Prisma
// Prisma BigInt fields cause TypeError when JSON.stringify is called
// @ts-ignore
BigInt.prototype.toJSON = function () { return this.toString() }

// Force rebuild for isOfficial field - v4
const globalForPrisma = globalThis as unknown as {
  prismaV4: PrismaClient | undefined
}

export const db =
  globalForPrisma.prismaV4 ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaV4 = db
