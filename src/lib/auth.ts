import { betterAuth } from 'better-auth';
import { prisma } from '@/lib/prisma';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { admin } from 'better-auth/plugins/admin';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'mongodb',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'user',
        input: true,
      },
      branch: {
        type: 'string',
        required: false,
        input: true,
      },
      canEdit: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: true,
      },
    },
  },
  plugins: [
    admin({
      adminRoles: ['admin'],
    }),
    nextCookies(), // This MUST be the last plugin
  ],
});
