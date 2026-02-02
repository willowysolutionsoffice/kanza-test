import fs from 'fs';
import path from 'path';

const LOG_FILE_PATH = path.join(process.cwd(), 'system-logs.txt');

export type LogType = 'API' | 'SERVER_ACTION' | 'INFO' | 'ERROR';

export async function logToFile(message: string, type: LogType = 'INFO', source: string = 'SYSTEM') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${type}] [${source}] ${message}\n`;

  try {
    await fs.promises.appendFile(LOG_FILE_PATH, logEntry, 'utf8');
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

export async function cleanLogFile() {
  try {
    await fs.promises.writeFile(LOG_FILE_PATH, '', 'utf8');
    return true;
  } catch (error) {
    console.error('Failed to clean log file:', error);
    return false;
  }
}

export async function getLogs() {
    try {
        if (!fs.existsSync(LOG_FILE_PATH)) {
            return "";
        }
        return await fs.promises.readFile(LOG_FILE_PATH, 'utf8');
    } catch (error) {
        console.error('Failed to read logs:', error);
        return "";
    }
}
