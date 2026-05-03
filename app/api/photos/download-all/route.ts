import { getSession } from '../../../lib/auth';
import pool           from '../../../lib/db/client';
import * as fs        from 'fs';
import * as path      from 'path';
import * as https     from 'https';
import * as http      from 'http';

const PHOTOS_DIR = path.join(process.cwd(), 'public', 'photos');

function ensurePhotosDir() {
  if (!fs.existsSync(PHOTOS_DIR)) {
    fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  }
} // end of ensurePhotosDir

// Download a single file from URL to local path
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file     = fs.createWriteStream(destPath);

    const request = protocol.get(url, { timeout: 15000 }, (response) => {
      // Follow redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        downloadFile(response.headers.location!, destPath)
          .then(resolve).catch(reject);
        return;
      } // end if redirect

      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      } // end if not 200

      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', (err) => {
        fs.unlinkSync(destPath);
        reject(err);
      });
    }); // end get

    request.on('error', (err) => {
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
    request.on('timeout', () => {
      request.destroy();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(new Error('Timeout'));
    });
  });
} // end of downloadFile

// GET — get download status (how many have local files vs Geni URLs)
export async function GET() {
  try {
    const user = await getSession();
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    ensurePhotosDir();

    // Count persons with Geni photo URLs
    const geniResult = await pool.query(
      `SELECT COUNT(*) FROM persons WHERE photo_url IS NOT NULL AND photo_url != ''`
    );
    const totalGeni = parseInt(geniResult.rows[0].count);

    // Count how many already have local files
    const allPersons = await pool.query(
      `SELECT id FROM persons WHERE photo_url IS NOT NULL AND photo_url != ''`
    );
    let localCount = 0;
    for (const row of allPersons.rows) {
      const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
      for (const ext of extensions) {
        if (fs.existsSync(path.join(PHOTOS_DIR, `${row.id}${ext}`))) {
          localCount++;
          break;
        } // end if exists
      } // end for extensions
    } // end for persons

    return Response.json({
      totalGeni,
      localCount,
      remaining: totalGeni - localCount,
    });
  } catch (err) {
    console.error('GET download status error:', err);
    return Response.json({ error: 'Failed to get status' }, { status: 500 });
  }
} // end of GET

// POST — download all Geni photos to local storage
export async function POST() {
  try {
    const user = await getSession();
    if (!user)                return Response.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' },       { status: 403 });

    ensurePhotosDir();

    // Get all persons with Geni photo URLs that don't have local files yet
    const result = await pool.query(
      `SELECT id, photo_url, first_name_en, last_name_en
       FROM persons
       WHERE photo_url IS NOT NULL AND photo_url != ''
       ORDER BY last_name_en, first_name_en`
    );

    let downloaded = 0;
    let skipped    = 0;
    let failed     = 0;
    const failures: string[] = [];

    for (const person of result.rows) {
      // Check if local file already exists
      const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
      let hasLocal = false;
      for (const ext of extensions) {
        if (fs.existsSync(path.join(PHOTOS_DIR, `${person.id}${ext}`))) {
          hasLocal = true;
          break;
        } // end if exists
      } // end for extensions

      if (hasLocal) { skipped++; continue; }

      // Determine file extension from URL
      const urlLower = person.photo_url.toLowerCase();
      const ext      = urlLower.includes('.png')  ? '.png'
                     : urlLower.includes('.webp') ? '.webp'
                     : '.jpg';
      const destPath = path.join(PHOTOS_DIR, `${person.id}${ext}`);

      try {
        await downloadFile(person.photo_url, destPath);
        downloaded++;

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 100));
      } catch (err: any) {
        failed++;
        const name = `${person.first_name_en || ''} ${person.last_name_en || ''}`.trim();
        failures.push(`${name}: ${err.message}`);
        console.warn(`Failed to download photo for ${name}:`, err.message);
      } // end try/catch download
    } // end for persons

    return Response.json({
      success:    true,
      downloaded,
      skipped,
      failed,
      failures:   failures.slice(0, 10), // return first 10 failures
      total:      result.rows.length,
    });
  } catch (err) {
    console.error('POST download-all error:', err);
    return Response.json({ error: 'Download failed' }, { status: 500 });
  }
} // end of POST
