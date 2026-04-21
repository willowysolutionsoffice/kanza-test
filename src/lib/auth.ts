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
  events: {
    async onSessionCreate({ session, user }: { session: any, user: any }) {
      try {
        await prisma.activityLog.create({
          data: {
            userId: user.id,
            userEmail: user.email,
            userName: user.name,
            action: 'LOGIN',
            module: 'AUTH',
            ipAddress: session.ipAddress || '',
            userAgent: session.userAgent || '',
          }
        });
      } catch (e) {
        console.error('Login logging failed:', e);
      }
    },
    async onSessionDelete({ session }: { session: any }) {
        try {
          // Note: user might be harder to get here directly depending on better-auth version
          // but session usually has userId
          if (session.userId) {
            const user = await prisma.user.findUnique({ where: { id: session.userId } });
            await prisma.activityLog.create({
                data: {
                  userId: session.userId,
                  userEmail: user?.email || '',
                  userName: user?.name || '',
                  action: 'LOGOUT',
                  module: 'AUTH',
                  ipAddress: session.ipAddress || '',
                  userAgent: session.userAgent || '',
                }
            });
          }
        } catch (e) {
          console.error('Logout logging failed:', e);
        }
    }
  }
});
