import { getSession } from '../../../lib/auth';
import pool           from '../../../lib/db/client';
import * as fs        from 'fs';
import * as path      from 'path';

const PHOTOS_DIR = path.join(process.cwd(), 'public', 'photos');

function ensurePhotosDir() {
  if (!fs.existsSync(PHOTOS_DIR)) {
    fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  } // end if not exists
} // end of ensurePhotosDir

// GET — return best available photo URL
// Priority: local file > Geni URL > null
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    ensurePhotosDir();

    // 1. Check for local uploaded photo first
    const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
    for (const ext of extensions) {
      const filepath = path.join(PHOTOS_DIR, `${id}${ext}`);
      if (fs.existsSync(filepath)) {
        return Response.json({
          url:    `/photos/${id}${ext}`,
          source: 'local',
          exists: true,
        });
      } // end if local exists
    } // end for extensions

    // 2. Check for Geni URL in database
    const result = await pool.query(
      'SELECT photo_url FROM persons WHERE id = $1', [id]
    );
    if (result.rows[0]?.photo_url) {
      return Response.json({
        url:    result.rows[0].photo_url,
        source: 'geni',
        exists: true,
      });
    } // end if geni url

    return Response.json({ url: null, source: null, exists: false });
  } catch (err) {
    console.error('GET photo error:', err);
    return Response.json({ error: 'Failed to check photo' }, { status: 500 });
  }
} // end of GET

// POST — upload local photo
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user)             return Response.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role === 'viewer') return Response.json({ error: 'Permission denied' }, { status: 403 });

    const { id } = await params;
    ensurePhotosDir();

    const formData = await request.formData();
    const file     = formData.get('photo') as File;
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: 'Only JPG, PNG and WebP images are allowed' }, { status: 400 });
    } // end if invalid type

    if (file.size > 5 * 1024 * 1024) {
      return Response.json({ error: 'File must be under 5MB' }, { status: 400 });
    } // end if too large

    const ext      = file.type === 'image/png' ? '.png'
                   : file.type === 'image/webp' ? '.webp' : '.jpg';
    const filename = `${id}${ext}`;
    const filepath = path.join(PHOTOS_DIR, filename);

    // Delete any existing local photos
    const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
    for (const e of extensions) {
      const old = path.join(PHOTOS_DIR, `${id}${e}`);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    } // end for extensions

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    return Response.json({ url: `/photos/${filename}`, source: 'local', exists: true });
  } catch (err) {
    console.error('POST photo error:', err);
    return Response.json({ error: 'Failed to upload photo' }, { status: 500 });
  }
} // end of POST

// DELETE — remove local photo (falls back to Geni URL if available)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user)             return Response.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role === 'viewer') return Response.json({ error: 'Permission denied' }, { status: 403 });

    const { id } = await params;
    const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
    let deleted = false;

    for (const ext of extensions) {
      const filepath = path.join(PHOTOS_DIR, `${id}${ext}`);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        deleted = true;
      } // end if exists
    } // end for extensions

    // Check if Geni URL is now the fallback
    const result = await pool.query(
      'SELECT photo_url FROM persons WHERE id = $1', [id]
    );
    const geniUrl = result.rows[0]?.photo_url || null;

    return Response.json({
      success:  true,
      deleted,
      fallback: geniUrl ? { url: geniUrl, source: 'geni' } : null,
    });
  } catch (err) {
    console.error('DELETE photo error:', err);
    return Response.json({ error: 'Failed to delete photo' }, { status: 500 });
  }
} // end of DELETE
