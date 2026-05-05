import { ToolPlugin, ToolRegistry } from '../ToolRegistry';

export const prismaDbTool: ToolPlugin = {
  id: 'db-prisma',
  name: 'Prisma ORM (SQLite/Postgres)',
  description: 'Adds Prisma ORM configuration and an initial schema setup.',
  category: 'Database',
  supportedModes: ['nextjs-app-router', 'node-express'],
  incompatibleModes: ['react-vite', 'php-native', 'laravel'],
  requiredPackages: ['@prisma/client@^5.10.0', 'prisma@^5.10.0'],
  requiredEnvVars: ['DATABASE_URL'],
  filesToCreate: ['/prisma/schema.prisma', '/src/lib/prismaClient.ts'],
  filesToModify: ['/.env', '/package.json'],
  adapterStrategy: 'Backend ORM configuration',
  installSteps: ['Install Prisma', 'Initialize Schema'],
  testSteps: ['Prisma generate'],
  rollbackSteps: ['Remove prisma folder'],
  
  isInstalled: (files) => {
    return Object.keys(files).some(path => path.includes('prisma/schema.prisma') || path.includes('prismaClient.ts'));
  },

  inject: (files, mode) => {
    const newFiles = { ...files };
    
    // Inject Prisma Schema
    newFiles['/prisma/schema.prisma'] = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
}
`;

    // Inject Prisma Client Singleton
    newFiles['/src/lib/prismaClient.ts'] = `import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
`;

    return newFiles;
  }
};

ToolRegistry.register(prismaDbTool);
