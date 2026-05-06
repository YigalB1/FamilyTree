"""Family Tree Profile Form Generator"""
import sys, json, os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

W, H = A4
MARGIN = 15 * mm
FULL_W = W - 2 * MARGIN

BLUE  = colors.HexColor('#1e3a5f')
LBLUE = colors.HexColor('#dbeafe')
LGOLD = colors.HexColor('#fef9c3')
DGOLD = colors.HexColor('#854d0e')
GRAY  = colors.HexColor('#64748b')
LGRAY = colors.HexColor('#f1f5f9')
LINE  = colors.HexColor('#cbd5e1')
WHITE = colors.white

# ── Font setup ────────────────────────────────────────────────────
HE_FONT = 'Helvetica'
HE_BOLD = 'Helvetica-Bold'

for reg_path, bold_path in [
    # NotoHebrew from project (when running inside Next.js)
    (
        os.path.join(os.path.dirname(__file__), '..', 'public', 'fonts', 'NotoSansHebrew-Regular.ttf'),
        os.path.join(os.path.dirname(__file__), '..', 'public', 'fonts', 'NotoSansHebrew-Bold.ttf'),
    ),
    # DejaVu system fallback
    (
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    ),
]:
    if os.path.exists(reg_path):
        try:
            pdfmetrics.registerFont(TTFont('HebReg', reg_path))
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
    """Reverse string for RTL display in reportlab (simple bidi).
    Swaps brackets before reversing so they appear correctly in RTL."""
    if not text:
        return ''
    # Swap brackets before reversing — they will visually correct after reversal
    text = text.replace('(', '\x00').replace(')', '(').replace('\x00', ')'
    )
    return text[::-1]

class FormBuilder:
    def __init__(self, output_path, person=None):
        self.c      = canvas.Canvas(output_path, pagesize=A4)
        self.person = person or {}
        self.y      = H - MARGIN

    def val(self, key, default=''):
        return self.person.get(key, default) or default

    def he_str(self, c, font, size, x, y, text, align='left'):
        """Draw Hebrew text with correct font and RTL."""
        c.setFont(font, size)
        display = rtl(text) if HE_FONT != 'Helvetica' else text
        if align == 'right':
            c.drawRightString(x, y, display)
        else:
            c.drawString(x, y, display)

    # ── Header ────────────────────────────────────────────────────

    def header(self):
        c = self.c
        c.setFillColor(BLUE)
        c.rect(MARGIN, H - MARGIN - 16*mm, FULL_W, 16*mm, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 13)
        c.drawCentredString(W/2, H - MARGIN - 9*mm,
            'Family Tree \u2014 Profile Data Collection Form')
        c.setFont('Helvetica', 7.5)
        sub = 'Pre-filled \u2014 Please correct wrong values and add missing ones' \
              if self.person else 'Blank form \u2014 Please fill in all fields you know'
        c.drawCentredString(W/2, H - MARGIN - 14*mm, sub)
        self.y = H - MARGIN - 16*mm - 2*mm

    # ── Instructions ─────────────────────────────────────────────

    def instructions(self):
        """Yellow box — English on left, Hebrew on right, same lines."""
        c = self.c
        h = 11*mm
        c.setFillColor(LGOLD)
        c.rect(MARGIN, self.y - h, FULL_W, h, fill=1, stroke=0)
        c.setFillColor(DGOLD)

        # Line 1: title
        c.setFont('Helvetica-Bold', 7.5)
        c.drawString(MARGIN + 2*mm, self.y - 4*mm, 'Instructions:')
        self.he_str(c, HE_BOLD, 7.5, W - MARGIN - 2*mm, self.y - 4*mm,
                    'הוראות:', 'right')

        # Line 2
        c.setFont('Helvetica', 6.8)
        c.drawString(MARGIN + 2*mm, self.y - 7.5*mm,
            '\u2022 Fill in all fields you know. Leave blank if unknown.')
        self.he_str(c, HE_FONT, 6.8, W - MARGIN - 2*mm, self.y - 7.5*mm,
                    '.מלא/י את כל השדות הידועים. השאר/י ריק אם אינך יודע/ת', 'right')

        # Line 3
        c.setFont('Helvetica', 6.8)
        c.drawString(MARGIN + 2*mm, self.y - 10.5*mm,
            '\u2022 If a pre-filled value is wrong, cross it out and write the correct value.')
        self.he_str(c, HE_FONT, 6.8, W - MARGIN - 2*mm, self.y - 10.5*mm,
                    '.אם ערך מולא מראש שגוי, מחק/י אותו וכתוב/י את הערך הנכון', 'right')

        self.y -= h + 2*mm

    # ── Section header ────────────────────────────────────────────

    def section(self, en_title, he_title=''):
        c = self.c
        h = 7*mm
        c.setFillColor(LBLUE)
        c.rect(MARGIN, self.y - h, FULL_W, h, fill=1, stroke=0)
        c.setFillColor(BLUE)
        c.setFont('Helvetica-Bold', 8.5)
        c.drawString(MARGIN + 2*mm, self.y - 5*mm, en_title)
        if he_title:
            self.he_str(c, HE_BOLD, 8.5,
                        W - MARGIN - 2*mm, self.y - 5*mm, he_title, 'right')
        self.y -= h + 1*mm

    # ── Bilingual field ───────────────────────────────────────────

    def bil_field(self, en_label, he_label, en_val='', he_val=''):
        c = self.c
        half    = FULL_W / 2 - 3*mm
        label_h = 3.5*mm
        gap     = 1.5*mm
        val_h   = 5.5*mm
        row_h   = label_h + gap + val_h + 2.5*mm
        line_y  = self.y - label_h - gap - val_h

        # English left — label
        c.setFillColor(GRAY)
        c.setFont('Helvetica', 6.5)
        c.drawString(MARGIN, self.y - label_h, en_label)
        # underline
        c.setStrokeColor(LINE)
        c.setLineWidth(0.5)
        c.line(MARGIN, line_y, MARGIN + half, line_y)
        # pre-filled value
        if en_val:
            c.setFillColor(BLUE)
            c.setFont('Helvetica-Bold', 9)
            c.drawString(MARGIN + 1.5*mm, line_y + 1.5*mm, str(en_val))

        # Hebrew right — label
        c.setFillColor(GRAY)
        rx = MARGIN + half + 6*mm
        self.he_str(c, HE_FONT, 6.5,
                    W - MARGIN, self.y - label_h, he_label, 'right')
        # underline
        c.setStrokeColor(LINE)
        c.line(rx, line_y, W - MARGIN, line_y)
        # pre-filled value
        if he_val:
            c.setFillColor(BLUE)
            self.he_str(c, HE_BOLD, 9,
                        W - MARGIN - 1.5*mm, line_y + 1.5*mm,
                        str(he_val), 'right')

        self.y -= row_h

    # ── Sex checkboxes ────────────────────────────────────────────

    def sex_checkboxes(self):
        c = self.c
        sex = self.val('sex')

        c.setFillColor(GRAY)
        c.setFont('Helvetica', 6.5)
        c.drawString(MARGIN, self.y - 3.5*mm, 'Sex')
        self.he_str(c, HE_FONT, 6.5,
                    W - MARGIN, self.y - 3.5*mm, 'מין', 'right')

        # Each option: checkbox + English + Hebrew
        opts = [
            ('Male', 'זכר', 'M', 18*mm),
            ('Female', 'נקבה', 'F', 60*mm),
            ('Unknown', 'לא ידוע', '', 108*mm),
        ]
        for en, he, val, xoff in opts:
            bx = MARGIN + xoff
            c.setStrokeColor(LINE)
            c.setLineWidth(0.5)
            c.rect(bx, self.y - 7*mm, 4*mm, 4*mm, fill=0, stroke=1)
            if sex == val:
                c.setFillColor(BLUE)
                c.setFont('ZapfDingbats', 8)
                c.drawString(bx + 0.5*mm, self.y - 5.5*mm, '4')
            # English
            c.setFillColor(GRAY)
            c.setFont('Helvetica', 7.5)
            c.drawString(bx + 5.5*mm, self.y - 5*mm, en)
            # Hebrew — right of English
            c.setFont('Helvetica', 7)
            c.drawString(bx + 5.5*mm + 14*mm, self.y - 5*mm, ' / ')
            self.he_str(c, HE_FONT, 7.5,
                        bx + 5.5*mm + 18*mm, self.y - 5*mm, rtl(he))

        self.y -= 10*mm

    # ── Divorced checkbox ─────────────────────────────────────────

    def divorced_checkbox(self):
        c = self.c
        c.setStrokeColor(LINE)
        c.setLineWidth(0.5)
        c.rect(MARGIN, self.y - 5.5*mm, 3.5*mm, 3.5*mm, fill=0, stroke=1)
        c.setFillColor(GRAY)
        c.setFont('Helvetica', 7.5)
        c.drawString(MARGIN + 5*mm, self.y - 4*mm, 'Divorced / ')
        self.he_str(c, HE_FONT, 7.5,
                    MARGIN + 32*mm, self.y - 4*mm, rtl('נפרד/ה'))
        self.y -= 7.5*mm

    # ── Note lines ────────────────────────────────────────────────

    def note_lines(self, count=3):
        c = self.c
        for _ in range(count):
            c.setStrokeColor(LINE)
            c.setLineWidth(0.3)
            c.line(MARGIN, self.y - 6*mm, W - MARGIN, self.y - 6*mm)
            self.y -= 7*mm

    # ── Photo box ─────────────────────────────────────────────────

    def photo_box(self):
        c = self.c
        c.setStrokeColor(LINE)
        c.setFillColor(LGRAY)
        c.rect(MARGIN, self.y - 28*mm, 26*mm, 26*mm, fill=1, stroke=1)
        c.setFillColor(LINE)
        c.setFont('Helvetica', 7)
        c.drawCentredString(MARGIN + 13*mm, self.y - 15*mm, 'Photo')
        c.setFillColor(GRAY)
        c.setFont('Helvetica', 7)
        c.drawString(MARGIN + 30*mm, self.y - 6*mm,
            'Please attach a photo if available.')
        self.y -= 30*mm

    # ── Footer ────────────────────────────────────────────────────

    def footer(self):
        c = self.c
        fy = 12*mm
        c.setStrokeColor(LINE)
        c.setLineWidth(0.3)
        c.line(MARGIN, fy + 4*mm, W - MARGIN, fy + 4*mm)
        c.setFillColor(GRAY)
        c.setFont('Helvetica', 7)
        c.drawString(MARGIN, fy, 'Filled in by: _______________________')
        c.drawString(MARGIN + 78*mm, fy, 'Date: _______________')
        c.drawString(MARGIN + 130*mm, fy, 'Relation to subject: _______________')
        c.setFillColor(colors.HexColor('#94a3b8'))
        c.setFont('Helvetica', 6)
        c.drawCentredString(W/2, 6*mm,
            'Family Tree Application \u2014 Profile Data Collection Form')

    # ── Build ─────────────────────────────────────────────────────

    def build(self):
        self.header()
        self.instructions()

        # 1. Personal Details
        self.section('1. Personal Details', 'פרטים אישיים .1')
        self.bil_field('First Name (English)', 'שם פרטי (עברית)',
                       self.val('firstNameEn'), self.val('firstNameHe'))
        self.bil_field('Last Name (English)', 'שם משפחה (עברית)',
                       self.val('lastNameEn'), self.val('lastNameHe'))
        self.sex_checkboxes()

        # 2. Birth
        self.section('2. Birth', 'לידה .2')
        self.bil_field('Birth Date  (DD MMM YYYY)', 'תאריך לידה',
                       self.val('birthDate'))
        self.bil_field('Birth Place  (City, Country)', 'מקום לידה',
                       self.val('birthPlace'))

        # 3. Death
        self.section('3. Death  (leave blank if alive)', 'פטירה .3')
        self.bil_field('Death Date  (DD MMM YYYY)', 'תאריך פטירה',
                       self.val('deathDate'))
        self.bil_field('Death Place  (City, Country)', 'מקום פטירה',
                       self.val('deathPlace'))

        # 4. Parents
        self.section('4. Parents', 'הורים .4')
        self.bil_field('Father \u2014 Full Name (English)',
                       'אב \u2014 שם מלא (עברית)')
        self.bil_field('Mother \u2014 Full Name (English)',
                       'אם \u2014 שם מלא (עברית)')

        # 5. Spouses
        self.section('5. Spouses / Marriages', 'בני/בנות זוג .5')
        for i in range(1, 3):
            self.bil_field(f'Spouse {i} \u2014 Name (English)',
                           f'בן/בת זוג {i} \u2014 שם (עברית)')
            self.bil_field(f'Marriage {i} Date', f'תאריך נישואים {i}')
            self.bil_field(f'Marriage {i} Place', f'מקום נישואים {i}')
            self.divorced_checkbox()

        # 6. Children
        self.section('6. Children', 'ילדים .6')
        c = self.c
        third  = FULL_W / 3 - 2*mm
        lh     = 3.5*mm
        gap    = 1.5*mm
        vh     = 5.5*mm
        row_h  = lh + gap + vh + 2.5*mm

        for i in range(1, 5):
            line_y = self.y - lh - gap - vh
            lx = MARGIN
            mx = lx + third + 4*mm
            rx = mx + third + 4*mm

            # Name English
            c.setFillColor(GRAY)
            c.setFont('Helvetica', 6.5)
            c.drawString(lx, self.y - lh, f'{i}. Name (English)')
            c.setStrokeColor(LINE)
            c.setLineWidth(0.5)
            c.line(lx, line_y, lx + third, line_y)

            # Name Hebrew
            self.he_str(c, HE_FONT, 6.5,
                        lx + third, self.y - lh, 'שם (עברית)', 'right')
            c.line(mx, line_y, mx + third, line_y)

            # Born
            c.setFillColor(GRAY)
            c.setFont('Helvetica', 6.5)
            c.drawString(rx, self.y - lh, 'Born')
            c.drawString(rx + 10*mm, self.y - lh, '/')
            self.he_str(c, HE_FONT, 6.5,
                        rx + 13*mm, self.y - lh, rtl('נולד/ה'))
            c.line(rx, line_y, W - MARGIN, line_y)

            self.y -= row_h

        # 7. Notes
        self.section('7. Notes', 'הערות .7')
        self.note_lines(3)

        # 8. Photo
        self.section('8. Photo', 'תמונה .8')
        self.photo_box()

        self.footer()
        self.c.save()


if __name__ == '__main__':
    output_path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/form.pdf'
    person_json = sys.argv[2] if len(sys.argv) > 2 else None
    person = json.loads(person_json) if person_json else None
    FormBuilder(output_path, person).build()
    print(f"OK:{output_path}")
