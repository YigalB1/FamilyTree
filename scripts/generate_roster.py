"""
Family Tree Roster PDF Generator — Landscape A4
"""
import sys, json, os
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER

PAGE   = landscape(A4)
W, H   = PAGE
MARGIN = 15 * mm

BLUE  = colors.HexColor('#1e3a5f')
LGRAY = colors.HexColor('#f8fafc')
LINE  = colors.HexColor('#e2e8f0')
WHITE = colors.white
BLACK = colors.black
GRAY  = colors.HexColor('#64748b')
DGRAY = colors.HexColor('#374151')

# ── Font setup ────────────────────────────────────────────────────
HE_FONT = 'Helvetica'
HE_BOLD = 'Helvetica-Bold'

for reg_path, bold_path in [
    (
        os.path.join(os.path.dirname(__file__), '..', 'public', 'fonts', 'NotoSansHebrew-Regular.ttf'),
        os.path.join(os.path.dirname(__file__), '..', 'public', 'fonts', 'NotoSansHebrew-Bold.ttf'),
    ),
    (
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    ),
]:
    if os.path.exists(reg_path):
        try:
            pdfmetrics.registerFont(TTFont('HebReg',  reg_path))
            HE_FONT = 'HebReg'
            if os.path.exists(bold_path):
                pdfmetrics.registerFont(TTFont('HebBold', bold_path))
                HE_BOLD = 'HebBold'
            else:
                HE_BOLD = 'HebReg'
            break
        except Exception as e:
            print(f"Font warning: {e}", file=sys.stderr)


def rtl(text):
    if not text: return ''
    text = text.replace('(', '\x00').replace(')', '(').replace('\x00', ')')
    return text[::-1]

def he(text):
    """Return Hebrew text ready for display."""
    if not text: return ''
    return rtl(text) if HE_FONT != 'Helvetica' else text


def generate_roster(output_path, persons, root_name=''):
    today = __import__('datetime').date.today().strftime('%d %b %Y')

    doc = SimpleDocTemplate(
        output_path, pagesize=PAGE,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN,  bottomMargin=MARGIN + 8*mm,
    )

    # ── Paragraph styles ──────────────────────────────────────────
    # ALL text uses HE_FONT — this avoids garbage characters from
    # mixing Helvetica (no Hebrew glyphs) with Hebrew content
    s_num  = ParagraphStyle('Num',  fontName=HE_BOLD,  fontSize=9,
                textColor=BLUE,  leading=11, alignment=TA_CENTER)
    s_bold = ParagraphStyle('Bold', fontName=HE_BOLD,  fontSize=9,
                textColor=BLACK, leading=11)
    s_reg  = ParagraphStyle('Reg',  fontName=HE_FONT,  fontSize=8,
                textColor=GRAY,  leading=10)
    s_dob  = ParagraphStyle('Dob',  fontName=HE_FONT,  fontSize=8,
                textColor=DGRAY, leading=10)
    s_hdr  = ParagraphStyle('Hdr',  fontName=HE_BOLD,  fontSize=9,
                textColor=WHITE, leading=12)
    s_title = ParagraphStyle('Title', fontName=HE_BOLD, fontSize=15,
                textColor=BLUE, alignment=TA_CENTER, leading=20)
    s_sub   = ParagraphStyle('Sub',   fontName=HE_FONT, fontSize=9,
                textColor=GRAY, alignment=TA_CENTER, leading=13)

    # ── Column widths — landscape A4 usable ≈ 267mm ───────────────
    usable = W - 2 * MARGIN
    # #  | שם עברי | שם אנגלי | תאריכים | אב | אם
    col_w = [
        8*mm,    # #
        46*mm,   # Hebrew name
        46*mm,   # English name
        28*mm,   # Dates (DOB + DOD)
        (usable - 8 - 46 - 46 - 28)*mm / 2,  # Father
        (usable - 8 - 46 - 46 - 28)*mm / 2,  # Mother
    ]
    # Recalculate remainder cleanly
    fixed = 8*mm + 46*mm + 46*mm + 28*mm
    rem   = (usable - fixed) / 2
    col_w = [8*mm, 46*mm, 46*mm, 28*mm, rem, rem]

    # ── Header row — all Hebrew ───────────────────────────────────
    header_row = [
        Paragraph(he('מס׳'),       s_hdr),
        Paragraph(he('שם עברי'),   s_hdr),
        Paragraph(he('שם אנגלי'),  s_hdr),
        [Paragraph(he('תאריך לידה'), s_hdr),
         Paragraph(he('תאריך פטירה'), s_hdr)],
        Paragraph(he('אב'),        s_hdr),
        Paragraph(he('אם'),        s_hdr),
    ]

    # ── Helper: parent name cell ──────────────────────────────────
    def parent_cell(name_he, name_en):
        """Hebrew name bold, English name small gray below — both using HE_FONT."""
        items = []
        if name_he:
            items.append(Paragraph(he(name_he), s_bold))
        if name_en:
            # English uses HE_FONT too — avoids garbage from Helvetica with no-glyph chars
            items.append(Paragraph(name_en, s_reg))
        return items if items else [Paragraph('—', s_reg)]

    # ── Data rows ─────────────────────────────────────────────────
    rows = [header_row]

    for p in persons:
        num = str(p.get('number', ''))

        he_name = f"{p.get('firstNameHe','') or ''} {p.get('lastNameHe','') or ''}".strip()
        en_name = f"{p.get('firstNameEn','') or p.get('firstName','') or ''} " \
                  f"{p.get('lastNameEn','') or p.get('lastName','') or ''}".strip()
        dob = p.get('birthDate','') or ''
        dod = p.get('deathDate','') or ''

        fa_he = (p.get('fatherHe','') or '').strip()
        fa_en = (p.get('fatherEn','') or '').strip()
        mo_he = (p.get('motherHe','') or '').strip()
        mo_en = (p.get('motherEn','') or '').strip()

        # Dates cell: DOB line + DOD line (if exists)
        date_items = []
        if dob:
            date_items.append(Paragraph(f'b. {dob}', s_dob))
        if dod:
            date_items.append(Paragraph(f'd. {dod}', s_dob))
        if not date_items:
            date_items = [Paragraph('—', s_reg)]

        # Name cells: Hebrew name bold, English name below in gray
        # Using HE_FONT for BOTH lines — Helvetica can't render Hebrew
        # and causes garbage; HE_FONT (DejaVu/Noto) handles both scripts
        he_cell = [
            Paragraph(he(he_name) if he_name else '—', s_bold),
        ]
        en_cell = [
            Paragraph(en_name if en_name else '—', s_bold),
        ]

        rows.append([
            Paragraph(num, s_num),
            he_cell,
            en_cell,
            date_items,
            parent_cell(fa_he, fa_en),
            parent_cell(mo_he, mo_en),
        ])

    # ── Table style ───────────────────────────────────────────────
    n = len(rows)
    ts = TableStyle([
        ('BACKGROUND',    (0, 0), (-1, 0),  BLUE),
        ('TOPPADDING',    (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING',   (0, 0), (-1, -1), 4),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 4),
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ('ALIGN',         (0, 0), (0, -1),  'CENTER'),
        ('LINEBELOW',     (0, 0), (-1, 0),  0.5, BLUE),
        ('LINEBELOW',     (0, 1), (-1, -1), 0.3, LINE),
        ('BOX',           (0, 0), (-1, -1), 0.3, LINE),
        *[('BACKGROUND',  (0, i), (-1, i),  LGRAY if i % 2 == 0 else WHITE)
          for i in range(1, n)],
    ])

    table = Table(rows, colWidths=col_w, repeatRows=1, style=ts)

    # ── Assemble document ─────────────────────────────────────────
    elements = []
    elements.append(Paragraph(he('רשימת בני המשפחה — Family Tree Roster'), s_title))
    if root_name:
        sub = f'{he("צאצאי")} {root_name}  ·  {len(persons)} {he("אנשים")}  ·  {today}'
    else:
        sub = f'{len(persons)} {he("אנשים")}  ·  {today}'
    elements.append(Paragraph(sub, s_sub))
    elements.append(Spacer(1, 4*mm))
    elements.append(table)

    def footer(c, d):
        c.saveState()
        c.setFont(HE_FONT, 7)
        c.setFillColor(GRAY)
        c.drawString(MARGIN, 8*mm, f'Family Tree Roster  ·  {today}')
        c.drawRightString(W - MARGIN, 8*mm, f'Page {d.page}')
        c.setStrokeColor(LINE)
        c.setLineWidth(0.3)
        c.line(MARGIN, 10*mm, W - MARGIN, 10*mm)
        c.restoreState()

    doc.build(elements, onFirstPage=footer, onLaterPages=footer)
    print(f"OK:{output_path}")


if __name__ == '__main__':
    output_path  = sys.argv[1] if len(sys.argv) > 1 else '/tmp/roster.pdf'
    persons_json = sys.argv[2] if len(sys.argv) > 2 else '[]'
    root_name    = sys.argv[3] if len(sys.argv) > 3 else ''
    persons = json.loads(persons_json)
    generate_roster(output_path, persons, root_name)
