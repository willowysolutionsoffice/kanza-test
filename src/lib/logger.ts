import { prisma } from './prisma';
import { auth } from './auth';
import { headers } from 'next/headers';
import fs from 'fs';
import path from 'path';

type LogAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'VIEW';

interface LogOptions {
  userId?: string;
  userEmail?: string;
  userName?: string;
  action: LogAction;
  module?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

export async function createLog({
  userId,
  userEmail,
  userName,
  action,
  module,
  details,
  ipAddress: providedIp,
  userAgent: providedAgent,
}: LogOptions) {
  try {
    const hdrs = await headers().catch(() => null);
    let ipAddress = providedIp || '';
    let userAgent = providedAgent || '';

    if (!ipAddress && hdrs) {
      ipAddress = hdrs.get('x-forwarded-for') || '';
    }
    if (!userAgent && hdrs) {
      userAgent = hdrs.get('user-agent') || '';
    }

    // Capture current user if not provided
    let finalUserId = userId;
    let finalUserEmail = userEmail;
    let finalUserName = userName;

    if (!finalUserId && hdrs) {
      const session = await auth.api.getSession({ headers: hdrs }).catch(() => null);
      if (session?.user) {
        finalUserId = session.user.id;
        finalUserEmail = session.user.email;
        finalUserName = session.user.name;
      }
    }

    await prisma.activityLog.create({
      data: {
        userId: finalUserId,
        userEmail: finalUserEmail,
        userName: finalUserName,
        action,
        module,
        details: details ? JSON.stringify(details) : null,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error('Logging failed:', error);
  }
}

// Support for legacy file-based logging (api/logger/route.ts)
const LOG_FILE_PATH = path.join(process.cwd(), 'system-logs.txt');

export async function logToFile(message: string, type: string = 'INFO', source: string = 'SYSTEM') {
    try {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${type}] [${source}]: ${message}\n`;
        await fs.promises.appendFile(LOG_FILE_PATH, logEntry);
    } catch (error) {
        console.error('File logging failed:', error);
    }
}

export async function cleanLogFile() {
    try {
        await fs.promises.writeFile(LOG_FILE_PATH, '');
        return true;
    } catch (error) {
        console.error('Cleaning log file failed:', error);
        return false;
    }
}

export async function getLogs() {
    try {
        if (fs.existsSync(LOG_FILE_PATH)) {
            return await fs.promises.readFile(LOG_FILE_PATH, 'utf-8');
        }
        return '';
    } catch (error) {
        console.error('Reading logs failed:', error);
        return '';
    }
}
