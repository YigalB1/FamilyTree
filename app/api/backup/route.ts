import { getSession } from '../../lib/auth';
import { exec }       from 'child_process';
import { promisify }  from 'util';
import * as fs        from 'fs';
import * as path      from 'path';

const execAsync = promisify(exec);

export async function POST() {
  try {
    // Admin only
    const user = await getSession();
    if (!user)             return Response.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    // Run backup script
    const scriptPath = path.join(process.cwd(), 'scripts', 'backup.js');
    const { stdout, stderr } = await execAsync(`node "${scriptPath}"`, {
      env: {
        ...process.env,
        DB_PASSWORD: 'familytree123',
      }
    });

    // Get list of backups
    const backupDir = path.join(process.cwd(), 'backups');
    const files = fs.existsSync(backupDir)
      ? fs.readdirSync(backupDir)
          .filter(f => f.startsWith('backup-') && f.endsWith('.sql'))
          .map(f => {
            const stats = fs.statSync(path.join(backupDir, f));
            return {
              name:    f,
              size:    (stats.size / 1024 / 1024).toFixed(2) + ' MB',
              created: stats.mtime.toISOString(),
            };
          })
          .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
      : [];

    return Response.json({
      success: true,
      message: stdout.trim(),
      backups: files,
    });
  } catch (err: any) {
    console.error('Backup API error:', err);
    return Response.json({
      error: err.message || 'Backup failed'
    }, { status: 500 });
  }
}

// GET — list existing backups
export async function GET() {
  try {
    const user = await getSession();
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const backupDir = path.join(process.cwd(), 'backups');
    const files = fs.existsSync(backupDir)
      ? fs.readdirSync(backupDir)
          .filter(f => f.startsWith('backup-') && f.endsWith('.sql'))
          .map(f => {
            const stats = fs.statSync(path.join(backupDir, f));
            return {
              name:    f,
              size:    (stats.size / 1024 / 1024).toFixed(2) + ' MB',
              created: stats.mtime.toISOString(),
            };
          })
          .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
      : [];

    return Response.json({ backups: files });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
