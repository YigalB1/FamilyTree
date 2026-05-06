// app/api/persons/[id]/form/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { execFile }                  from 'child_process';
import { promisify }                 from 'util';
import { readFile, unlink }          from 'fs/promises';
import { existsSync }                from 'fs';
import path                          from 'path';
import os                            from 'os';
import { randomUUID }                from 'crypto';
import pool                          from '@/app/lib/db/client';

const execFileAsync = promisify(execFile);

// Windows uses 'python', Linux/Mac uses 'python3'
const PYTHON = process.platform === 'win32' ? 'python' : 'python3';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id }  = await params;
  const type    = request.nextUrl.searchParams.get('type') || 'prefilled';
  const isBlank = type === 'blank';

  try {
    // ── Fetch person from DB ──────────────────────────────────
    const result = await pool.query(
      `SELECT
         id,
         first_name_en  AS "firstNameEn",
         last_name_en   AS "lastNameEn",
         first_name_he  AS "firstNameHe",
         last_name_he   AS "lastNameHe",
         sex,
         birth_date     AS "birthDate",
         birth_place    AS "birthPlace",
         death_date     AS "deathDate",
         death_place    AS "deathPlace"
       FROM persons
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    } // end if not found

    const person = result.rows[0];

    // ── Paths ─────────────────────────────────────────────────
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate_form.py');
    // Use OS temp dir — works on both Windows and Linux
    const tmpPath    = path.join(os.tmpdir(), `form-${randomUUID()}.pdf`);

    if (!existsSync(scriptPath)) {
      return NextResponse.json(
        { error: `Form script not found at ${scriptPath}` },
        { status: 500 }
      );
    } // end if script missing

    // ── Run Python script ─────────────────────────────────────
    const args = isBlank
      ? [scriptPath, tmpPath]
      : [scriptPath, tmpPath, JSON.stringify(person)];

    await execFileAsync(PYTHON, args, { timeout: 15000 });

    // ── Read and stream PDF ───────────────────────────────────
    const pdfBuffer = await readFile(tmpPath);
    await unlink(tmpPath).catch(() => {});

    const namePart = isBlank
      ? 'blank'
      : `${person.firstNameEn || person.firstNameHe || 'person'}-${person.lastNameEn || person.lastNameHe || ''}`.trim();
    const filename = `family-tree-form-${namePart}.pdf`
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9\-_.]/g, '');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      String(pdfBuffer.length),
      },
    });

  } catch (error: any) {
    console.error('Form generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate form', detail: error.message },
      { status: 500 }
    );
  } // end try/catch
} // end of GET
