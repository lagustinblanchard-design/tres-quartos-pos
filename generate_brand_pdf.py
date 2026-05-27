from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import PageBreak
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPDF
import os

# Brand colors
YELLOW = colors.HexColor('#F5C200')
CARBON = colors.HexColor('#3A3A3A')
WHITE = colors.white
GRAY = colors.HexColor('#6B6B6B')
LIGHT_GRAY = colors.HexColor('#F0F0F0')
BLACK = colors.HexColor('#1A1A1A')

W, H = A4

def make_styles():
    s = {}

    s['cover_brand'] = ParagraphStyle(
        'cover_brand',
        fontName='Helvetica-Bold',
        fontSize=52,
        textColor=YELLOW,
        alignment=TA_CENTER,
        leading=56,
    )
    s['cover_sub'] = ParagraphStyle(
        'cover_sub',
        fontName='Helvetica',
        fontSize=14,
        textColor=WHITE,
        alignment=TA_CENTER,
        spaceAfter=4,
    )
    s['cover_tagline'] = ParagraphStyle(
        'cover_tagline',
        fontName='Helvetica-Oblique',
        fontSize=16,
        textColor=YELLOW,
        alignment=TA_CENTER,
        spaceAfter=6,
    )
    s['section_title'] = ParagraphStyle(
        'section_title',
        fontName='Helvetica-Bold',
        fontSize=20,
        textColor=YELLOW,
        spaceBefore=18,
        spaceAfter=6,
    )
    s['subsection'] = ParagraphStyle(
        'subsection',
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=CARBON,
        spaceBefore=10,
        spaceAfter=4,
    )
    s['body'] = ParagraphStyle(
        'body',
        fontName='Helvetica',
        fontSize=10,
        textColor=BLACK,
        leading=15,
        spaceAfter=4,
    )
    s['body_white'] = ParagraphStyle(
        'body_white',
        fontName='Helvetica',
        fontSize=10,
        textColor=WHITE,
        leading=15,
        spaceAfter=4,
    )
    s['label'] = ParagraphStyle(
        'label',
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=GRAY,
        spaceAfter=2,
    )
    s['code'] = ParagraphStyle(
        'code',
        fontName='Courier',
        fontSize=9,
        textColor=CARBON,
        backColor=LIGHT_GRAY,
        leading=14,
        leftIndent=8,
        rightIndent=8,
        spaceBefore=4,
        spaceAfter=4,
    )
    s['bullet'] = ParagraphStyle(
        'bullet',
        fontName='Helvetica',
        fontSize=10,
        textColor=BLACK,
        leading=15,
        leftIndent=12,
        spaceAfter=3,
    )
    s['page_num'] = ParagraphStyle(
        'page_num',
        fontName='Helvetica',
        fontSize=8,
        textColor=GRAY,
        alignment=TA_RIGHT,
    )
    s['highlight_box'] = ParagraphStyle(
        'highlight_box',
        fontName='Helvetica-Bold',
        fontSize=11,
        textColor=CARBON,
        alignment=TA_CENTER,
        leading=16,
    )
    s['phrase'] = ParagraphStyle(
        'phrase',
        fontName='Helvetica-Oblique',
        fontSize=11,
        textColor=CARBON,
        leading=16,
        leftIndent=12,
        spaceAfter=4,
    )
    return s


def header_bar(canvas, doc):
    canvas.saveState()
    # Top bar
    canvas.setFillColor(CARBON)
    canvas.rect(0, H - 12*mm, W, 12*mm, fill=1, stroke=0)
    canvas.setFillColor(YELLOW)
    canvas.setFont('Helvetica-Bold', 9)
    canvas.drawString(20*mm, H - 8*mm, 'TRES QUARTOS — MANUAL DE MARCA')
    canvas.setFont('Helvetica', 9)
    canvas.setFillColor(WHITE)
    canvas.drawRightString(W - 20*mm, H - 8*mm, f'TQ © 2026')
    # Bottom accent line
    canvas.setFillColor(YELLOW)
    canvas.rect(0, 0, W, 3*mm, fill=1, stroke=0)
    # Page number
    canvas.setFillColor(GRAY)
    canvas.setFont('Helvetica', 8)
    canvas.drawCentredString(W / 2, 6*mm, str(doc.page))
    canvas.restoreState()


SVG_LOGO_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logo_tq_color.svg')

def draw_svg_logo(canvas, cx, cy, size_mm):
    """Renders the real SVG logo centered at (cx, cy) with given diameter in mm."""
    try:
        drawing = svg2rlg(SVG_LOGO_PATH)
        if drawing:
            scale = (size_mm * mm) / max(drawing.width, drawing.height)
            drawing.width *= scale
            drawing.height *= scale
            drawing.transform = (scale, 0, 0, scale, 0, 0)
            x = cx - drawing.width / 2
            y = cy - drawing.height / 2
            renderPDF.draw(drawing, canvas, x, y)
    except Exception:
        canvas.setFillColor(YELLOW)
        canvas.circle(cx, cy, size_mm * mm / 2 + 6*mm, fill=1, stroke=0)
        canvas.setFillColor(CARBON)
        canvas.circle(cx, cy, size_mm * mm / 2, fill=1, stroke=0)
        canvas.setFillColor(YELLOW)
        canvas.setFont('Helvetica-Bold', 48)
        canvas.drawCentredString(cx, cy - 8*mm, 'TQ')


def cover_page(canvas, doc):
    canvas.saveState()
    # Full background
    canvas.setFillColor(CARBON)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    # Yellow top accent
    canvas.setFillColor(YELLOW)
    canvas.rect(0, H - 6*mm, W, 6*mm, fill=1, stroke=0)
    # Yellow bottom accent
    canvas.rect(0, 0, W, 6*mm, fill=1, stroke=0)
    # Left yellow bar
    canvas.rect(0, 0, 6*mm, H, fill=1, stroke=0)

    # Logo SVG real centrado en la portada
    cx, cy = W / 2, H * 0.62
    draw_svg_logo(canvas, cx, cy, 110)

    # Brand name text block
    canvas.setFillColor(WHITE)
    canvas.setFont('Helvetica-Bold', 36)
    canvas.drawCentredString(W / 2, H * 0.28, 'TRES QUARTOS')

    canvas.setFillColor(YELLOW)
    canvas.setFont('Helvetica-Oblique', 16)
    canvas.drawCentredString(W / 2, H * 0.22, '"Donde el rugby sigue vivo."')

    canvas.setFillColor(GRAY)
    canvas.setFont('Helvetica', 11)
    canvas.drawCentredString(W / 2, H * 0.17, 'MANUAL DE MARCA — VERSIÓN 1.0 — 2026')

    canvas.restoreState()


def color_swatch(canvas, x, y, hex_color, name, hex_text, w=38*mm, h=22*mm):
    c = colors.HexColor(hex_color)
    canvas.setFillColor(c)
    canvas.roundRect(x, y, w, h, 3*mm, fill=1, stroke=0)
    canvas.setFillColor(BLACK if hex_color in ('#F5C200', '#FFFFFF', '#F0F0F0') else WHITE)
    canvas.setFont('Helvetica-Bold', 8)
    canvas.drawCentredString(x + w/2, y + h/2 + 3, name)
    canvas.setFont('Helvetica', 7)
    canvas.drawCentredString(x + w/2, y + h/2 - 6, hex_text)


from reportlab.platypus import Flowable

class LogoFlowable(Flowable):
    """Flowable que embebe el SVG del logo con colores de marca aplicados."""
    def __init__(self, svg_path, size):
        Flowable.__init__(self)
        self.svg_path = svg_path
        self.size = size
        self.width = size
        self.height = size

    def draw(self):
        try:
            drawing = svg2rlg(self.svg_path)
            if drawing:
                scale = self.size / max(drawing.width, drawing.height)
                drawing.width *= scale
                drawing.height *= scale
                drawing.transform = (scale, 0, 0, scale, 0, 0)
                x = (150*mm - self.size) / 2
                renderPDF.draw(drawing, self.canv, x, 0)
        except Exception:
            pass


class PDFGenerator:
    def __init__(self):
        self.styles = make_styles()
        self.story = []

    def add(self, el):
        self.story.append(el)

    def sp(self, h=6):
        self.story.append(Spacer(1, h))

    def hr(self, color=YELLOW, thickness=1.5, width=1.0):
        self.story.append(HRFlowable(width=f'{int(width*100)}%', thickness=thickness, color=color, spaceAfter=6))

    def section(self, num, title):
        self.add(Paragraph(f'{num}.  {title.upper()}', self.styles['section_title']))
        self.hr()

    def subsection(self, title):
        self.add(Paragraph(title, self.styles['subsection']))

    def body(self, text):
        self.add(Paragraph(text, self.styles['body']))

    def bullet(self, items):
        for item in items:
            self.add(Paragraph(f'• &nbsp; {item}', self.styles['bullet']))

    def table(self, data, col_widths=None, header_bg=CARBON, header_fg=WHITE):
        t = Table(data, colWidths=col_widths)
        style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), header_bg),
            ('TEXTCOLOR', (0, 0), (-1, 0), header_fg),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#DDDDDD')),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ])
        t.setStyle(style)
        self.add(t)

    def yellow_box(self, text):
        data = [[Paragraph(text, ParagraphStyle('yb', fontName='Helvetica-Bold', fontSize=11, textColor=CARBON, alignment=TA_CENTER))]]
        t = Table(data, colWidths=[150*mm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), YELLOW),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('ROUNDEDCORNERS', [4]),
        ]))
        self.add(t)

    def dark_box(self, text):
        data = [[Paragraph(text, ParagraphStyle('db', fontName='Helvetica-Oblique', fontSize=11, textColor=YELLOW, alignment=TA_CENTER, leading=18))]]
        t = Table(data, colWidths=[150*mm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), CARBON),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('LEFTPADDING', (0, 0), (-1, -1), 16),
            ('RIGHTPADDING', (0, 0), (-1, -1), 16),
        ]))
        self.add(t)

    def build(self, output_path):
        doc = SimpleDocTemplate(
            output_path,
            pagesize=A4,
            leftMargin=20*mm,
            rightMargin=20*mm,
            topMargin=20*mm,
            bottomMargin=16*mm,
        )

        # Cover is page 1 — no content, drawn entirely in canvas
        self.story.append(PageBreak())

        # ── SECTION 1: IDENTIDAD ─────────────────────────────────────
        self.section(1, 'Nuestra Identidad')
        self.sp(4)

        self.subsection('¿Quiénes somos?')
        self.body(
            'Tres Quartos es un emprendimiento argentino especializado en la compraventa de '
            'artículos de rugby. Nuestro corazón está en el rugby — deporte de equipo, esfuerzo, '
            'comunidad y valores — y desde ahí expandimos nuestra oferta a todo el mundo deportivo.'
        )
        self.sp(4)
        self.body(
            'El nombre viene del deporte: el <i>three-quarter</i> es la línea de backs que conecta '
            'juego, velocidad e inteligencia. Así somos nosotros: el punto de conexión entre quien '
            'tiene equipamiento y quien lo necesita.'
        )
        self.sp(8)

        self.table(
            [['Misión', 'Visión'],
             [
                 'Facilitar la compraventa de artículos\ndeportivos de calidad, haciendo el deporte\nmás accesible para todos.',
                 'Ser el referente de compraventa de rugby\nen Argentina y expandirnos a todos los deportes.'
             ]],
            col_widths=[75*mm, 75*mm]
        )
        self.sp(10)

        self.subsection('Valores')
        self.table(
            [['Valor', 'Qué significa para TQ'],
             ['Comunidad', 'Somos parte del deporte, no solo un negocio'],
             ['Honestidad', 'Artículos descritos tal cual son'],
             ['Accesibilidad', 'El deporte para todos los bolsillos'],
             ['Pasión', 'Amamos el deporte. Se nota.'],
             ['Confianza', 'Cada transacción respaldada por TQ']],
            col_widths=[45*mm, 105*mm]
        )
        self.sp(12)

        self.subsection('Posicionamiento')
        self.dark_box('"Donde el rugby sigue vivo."')
        self.sp(6)
        self.body(
            'TQ nació en el rugby y habla el idioma del rugby. Eso nos da credibilidad en la '
            'comunidad y nos diferencia de cualquier marketplace genérico. Somos rugbiers '
            'hablando con rugbiers.'
        )

        # ── SECTION 2: LOGOTIPO ──────────────────────────────────────
        self.add(PageBreak())
        self.section(2, 'Logotipo')

        # Logo real embebido en la sección
        self.add(LogoFlowable(SVG_LOGO_PATH, 70*mm))
        self.sp(10)

        self.subsection('Símbolo y Significado')
        self.body(
            'El logo combina un anillo amarillo sobre fondo negro, las siglas <b>TQ</b> en tipografía '
            'geométrica con tratamiento inline, y el nombre completo <b>TRES QUARTOS</b> curvado en la parte superior.'
        )
        self.sp(4)
        self.body(
            '<b>La T:</b> Tipografía geométrica con terminales estilo Art Deco — remates en los extremos del travesaño. '
            'Tratamiento inline (doble línea) en el trazo vertical.'
        )
        self.body(
            '<b>La Q:</b> Construida como una raqueta deportiva: óvalos concéntricos como la cara de la raqueta, '
            'y un mango con líneas de grip hacia la esquina inferior derecha. '
            'Clave visual que conecta la marca directamente con el deporte.'
        )
        self.body(
            '<b>El anillo:</b> Tres capas — negro exterior, amarillo, carbón — que generan profundidad y fuerza visual.'
        )
        self.sp(10)

        self.subsection('Variaciones del Logo')
        self.table(
            [['Variación', 'Descripción', 'Uso principal'],
             ['Principal', 'TQ + TRES QUARTOS sobre círculo carbón/amarillo', 'Presencia de marca completa'],
             ['Positiva', 'TQ amarillo sobre fondo carbón', 'Fondos oscuros'],
             ['Negativa', 'TQ carbón sobre fondo amarillo', 'Promociones, urgencia'],
             ['Monocromática', 'TQ blanco/negro sobre fondo neutro', 'Bordados, serigrafía'],
             ['Ícono', 'Solo siglas TQ sin texto', 'Perfil Instagram, favicon, app']],
            col_widths=[38*mm, 72*mm, 40*mm]
        )
        self.sp(10)

        self.subsection('Reglas de Uso')
        self.table(
            [['Espacio de protección', 'Tamaño mínimo digital', 'Tamaño mínimo impresión'],
             ['Altura de la letra Q en todos los lados', '40 px de ancho', '15 mm de ancho']],
            col_widths=[70*mm, 40*mm, 40*mm]
        )
        self.sp(10)

        self.subsection('❌  Nunca hacer esto con el logo')
        self.bullet([
            'Deformar o estirar el isotipo',
            'Cambiar los colores por colores no aprobados',
            'Agregar sombras, biselados o efectos 3D',
            'Rotar el logo en ningún ángulo',
            'Reducir el espacio de protección',
            'Usar sobre fondos de muy bajo contraste',
            'Separar TQ del nombre TRES QUARTOS para crear un logo nuevo',
            'Reemplazar la tipografía del logo por otra fuente',
        ])

        # ── SECTION 3: COLORES ───────────────────────────────────────
        self.add(PageBreak())
        self.section(3, 'Paleta de Colores')

        self.subsection('Colores Primarios')
        self.table(
            [['Nombre', 'HEX', 'RGB', 'CMYK', 'Uso'],
             ['Amarillo TQ', '#F5C200', '245 / 194 / 0', '0 / 21 / 100 / 4', 'Principal, acentos, CTA'],
             ['Carbón TQ', '#3A3A3A', '58 / 58 / 58', '0 / 0 / 0 / 77', 'Fondos, texto principal']],
            col_widths=[32*mm, 22*mm, 28*mm, 30*mm, 38*mm]
        )
        self.sp(8)

        self.subsection('Colores Secundarios')
        self.table(
            [['Nombre', 'HEX', 'RGB', 'Uso'],
             ['Blanco', '#FFFFFF', '255 / 255 / 255', 'Fondos limpios, texto sobre oscuro'],
             ['Negro', '#1A1A1A', '26 / 26 / 26', 'Textos de alta jerarquía'],
             ['Gris Medio', '#6B6B6B', '107 / 107 / 107', 'Textos secundarios, subtítulos'],
             ['Gris Claro', '#F0F0F0', '240 / 240 / 240', 'Fondos neutros, separadores']],
            col_widths=[32*mm, 22*mm, 35*mm, 61*mm]
        )
        self.sp(10)

        self.subsection('Combinaciones Recomendadas')
        combo_data = [
            ['COMBINACIÓN', 'FONDO', 'TEXTO / ACENTO', 'USO'],
            ['Principal', 'Carbón TQ #3A3A3A', 'Amarillo TQ #F5C200', 'Posts destacados, portadas, banners'],
            ['Energía', 'Amarillo TQ #F5C200', 'Carbón TQ #3A3A3A', 'Promociones, ofertas, urgencia'],
            ['Limpio', 'Blanco #FFFFFF', 'Carbón + Amarillo acento', 'Fichas de producto, contenido info'],
        ]
        self.table(combo_data, col_widths=[30*mm, 38*mm, 40*mm, 42*mm])
        self.sp(8)

        self.subsection('Proporción de Color por Pieza')
        self.body('<b>60%</b> color base (carbón o blanco)  ·  <b>30%</b> color secundario neutro  ·  <b>10%</b> Amarillo TQ')

        # ── SECTION 4: TIPOGRAFÍA ────────────────────────────────────
        self.add(PageBreak())
        self.section(4, 'Tipografía')

        self.subsection('Fuente Principal — Barlow Condensed')
        self.body('Para títulos, taglines y textos de alto impacto visual. Disponible gratis en Google Fonts.')
        self.sp(4)
        self.table(
            [['Peso', 'Uso'],
             ['Bold', 'Títulos principales, precios, nombres de productos'],
             ['SemiBold', 'Subtítulos, categorías'],
             ['Regular', 'Descripciones cortas']],
            col_widths=[35*mm, 115*mm]
        )
        self.sp(8)

        self.subsection('Fuente Secundaria — Inter')
        self.body('Para texto corrido, descripciones largas y contenido digital. Disponible gratis en Google Fonts.')
        self.sp(4)
        self.table(
            [['Peso', 'Uso'],
             ['Bold', 'Encabezados secundarios'],
             ['Regular', 'Cuerpo de texto'],
             ['Light', 'Notas al pie, disclaimers']],
            col_widths=[35*mm, 115*mm]
        )
        self.sp(10)

        self.subsection('Escala Tipográfica (Digital)')
        self.table(
            [['Jerarquía', 'Fuente', 'Tamaño', 'Peso'],
             ['H1 / Título hero', 'Barlow Condensed', '48–72px', 'Bold'],
             ['H2 / Sección', 'Barlow Condensed', '32–40px', 'SemiBold'],
             ['H3 / Subtítulo', 'Barlow Condensed', '24px', 'Regular'],
             ['Cuerpo', 'Inter', '16px', 'Regular'],
             ['Caption / Nota', 'Inter', '12–14px', 'Light']],
            col_widths=[45*mm, 50*mm, 28*mm, 27*mm]
        )
        self.sp(10)

        self.subsection('Reglas Tipográficas')
        self.bullet([
            'TRES QUARTOS siempre en mayúsculas',
            'Nunca usar más de 2 fuentes en una misma pieza',
            'Nunca usar tipografías decorativas o manuscritas en comunicaciones oficiales',
            'El peso Bold de Barlow Condensed es la voz visual principal de TQ',
        ])

        # ── SECTION 5: TONO Y VOZ ────────────────────────────────────
        self.add(PageBreak())
        self.section(5, 'Tono y Voz')

        self.subsection('Personalidad de Marca')
        self.body('TQ habla como un compañero de equipo, no como una marca corporativa. Es directo, apasionado, conoce de rugby y trata al cliente de igual a igual.')
        self.sp(6)
        self.table(
            [['SOMOS', 'NO SOMOS'],
             ['Directos', 'Fríos'],
             ['Apasionados', 'Exagerados'],
             ['Cercanos', 'Informales en exceso'],
             ['Confiables', 'Solemnes'],
             ['Entusiastas', 'Agresivos']],
            col_widths=[75*mm, 75*mm],
            header_bg=YELLOW,
            header_fg=CARBON,
        )
        self.sp(10)

        self.subsection('Tono por Contexto')
        contexts = [
            ('Publicaciones de producto — rugby', '"Botines Canterbury scrum T.42 — tapones completos. $22.000"'),
            ('Publicaciones de producto — otros deportes', '"Zapatillas Nike Air Zoom T.41 — 3 salidas. Como nuevas. $45.000"'),
            ('Stories / Engagement', '"¿Tenés botines guardados? Alguien los necesita para el próximo partido."'),
            ('Respuestas a consultas', '"Hola! Sí están. ¿Te mando más fotos?"'),
            ('Contenido de valor', '"Cómo elegir tapones según la cancha donde jugás 👇"'),
        ]
        for ctx, example in contexts:
            self.body(f'<b>{ctx}:</b>')
            p = Paragraph(f'"{example}"', self.styles['phrase'])
            self.add(p)
            self.sp(4)

        self.sp(6)
        self.subsection('Frases Clave de la Marca')
        self.bullet([
            '"Donde el rugby sigue vivo."',
            '"Jugado. Vendido. Vuelto a jugar."',
            '"Del vestuario a tu equipo."',
            '"Equipate bien. Pagá menos."',
            '"El equipamiento que ya dio todo tiene más para dar."',
        ])

        # ── SECTION 6: REDES SOCIALES ────────────────────────────────
        self.add(PageBreak())
        self.section(6, 'Aplicaciones en Redes Sociales')

        self.subsection('Instagram — Estructura de Contenido')
        self.table(
            [['Pilar', '% del contenido', 'Ejemplo de contenido'],
             ['Producto', '50 %', 'Fotos de artículos en venta con precio'],
             ['Comunidad', '30 %', 'Rugby, clubs, deportistas, historias'],
             ['Marca', '20 %', 'Valores, novedades, detrás de escena']],
            col_widths=[35*mm, 30*mm, 85*mm]
        )
        self.sp(8)

        self.subsection('Highlights — Orden Recomendado')
        self.body('<b>RUGBY</b> → BOTINES → CAMISETAS → FÚTBOL → RUNNING → NOVEDADES')
        self.sp(8)

        self.subsection('Stories')
        self.bullet([
            'Fondo: Carbón TQ o Amarillo TQ',
            'Texto: Barlow Condensed en mayúsculas',
            'Stickers/GIFs: minimalistas, que no compitan con el mensaje',
        ])
        self.sp(8)

        self.subsection('Plantilla de Post de Producto')
        template_text = (
            '[FOTO DEL PRODUCTO]\n'
            '───────────────────────────────\n'
            'NOMBRE DEL PRODUCTO      Barlow Condensed Bold Blanco\n'
            'Marca / Talle / Estado   Inter Regular Gris Claro\n'
            '$PRECIO                  Barlow Condensed Bold #F5C200\n'
            '                      TQ Isotipo esquina inferior derecha'
        )
        self.add(Paragraph(template_text, self.styles['code']))

        self.sp(8)
        self.subsection('WhatsApp Business')
        self.bullet([
            'Foto de perfil: Isotipo TQ',
            'Nombre: Tres Quartos',
            'Descripción: propuesta de valor + categorías principales',
        ])

        # ── SECTION 7: FOTOGRAFÍA ────────────────────────────────────
        self.add(PageBreak())
        self.section(7, 'Fotografía y Estilo Visual')

        self.subsection('Fotografía de Producto')
        self.table(
            [['Aspecto', 'Especificación'],
             ['Fondo', 'Blanco liso o textura neutra (cemento, madera)'],
             ['Iluminación', 'Natural o artificial difusa. Sin sombras duras.'],
             ['Ángulos', 'Principal + detalle + estado de uso'],
             ['Resolución mínima', '1080 × 1080 px para publicación'],
             ['Siempre mostrar', 'Marca, talle, estado real, suela, costuras']],
            col_widths=[45*mm, 105*mm]
        )
        self.sp(10)

        self.subsection('Fotografía de Estilo de Vida')
        self.body(
            'Deportistas reales en contexto real. Sin producción exagerada. '
            '<b>El rugby tiene imágenes poderosas — usarlas a favor.</b>'
        )
        self.sp(4)
        self.bullet([
            'Preferir: canchas de rugby, vestuarios, entrenamientos, partidos, scrums, lineouts',
            'El barro, el esfuerzo y el equipo son parte de la estética',
            'Evitar: imágenes de stock genéricas, fondos artificiales de colores estridentes',
        ])
        self.sp(10)

        self.subsection('Edición de Color')
        self.table(
            [['Ajuste', 'Valor'],
             ['Contraste', 'Ligeramente elevado'],
             ['Saturación', 'Natural (sin filtros fuertes)'],
             ['Temperatura', 'Cálida-neutra'],
             ['Filtros', 'Nunca aplicar filtros que quiten identidad al producto']],
            col_widths=[45*mm, 105*mm]
        )

        # ── SECTION 8: ELEMENTOS GRÁFICOS ───────────────────────────
        self.add(PageBreak())
        self.section(8, 'Elementos Gráficos')

        self.subsection('Formas de Apoyo')
        self.table(
            [['Elemento', 'Descripción', 'Uso'],
             ['Líneas', 'Horizontales finas en Amarillo TQ', 'Dinamismo y velocidad'],
             ['Bloque de color', 'Rectángulos sólidos carbón o amarillo', 'Soporte de texto destacado'],
             ['Círculo', 'Herencia del isotipo', 'Marco o punto focal en composiciones'],
             ['Textura', 'Grilla de cancha o cuero de pelota de rugby — baja opacidad', 'Fondos de stories, packaging'],
             ['Íconos', 'Outline style, trazo 2px, nunca sólidos', 'Categorías, navegación, infografías']],
            col_widths=[28*mm, 72*mm, 50*mm]
        )
        self.sp(10)

        self.subsection('Patrón de Marca')
        self.body(
            'Se puede desarrollar un patrón repitiendo el isotipo TQ en baja opacidad (10–15%) '
            'para uso en packaging, fondos de stories y papelería institucional.'
        )

        # ── RESUMEN FINAL ────────────────────────────────────────────
        self.add(PageBreak())
        self.section(9, 'Resumen de Identidad')
        self.sp(8)

        self.table(
            [['Elemento', 'Definición'],
             ['Nombre', 'TRES QUARTOS'],
             ['Siglas', 'TQ'],
             ['Deporte principal', 'Rugby'],
             ['Color principal', '#F5C200 — Amarillo TQ'],
             ['Color secundario', '#3A3A3A — Carbón TQ'],
             ['Tipografía titular', 'Barlow Condensed Bold'],
             ['Tipografía cuerpo', 'Inter Regular'],
             ['Tono', 'Directo · Apasionado · Peer-to-peer'],
             ['Tagline', '"Donde el rugby sigue vivo."']],
            col_widths=[50*mm, 100*mm]
        )
        self.sp(20)
        self.dark_box('"Jugado. Vendido. Vuelto a jugar."')

        # Build
        def first_page(canvas, doc):
            cover_page(canvas, doc)

        def later_pages(canvas, doc):
            header_bar(canvas, doc)

        doc.build(self.story, onFirstPage=first_page, onLaterPages=later_pages)
        print(f"PDF generado: {output_path}")


if __name__ == '__main__':
    gen = PDFGenerator()
    gen.build('MANUAL_DE_MARCA_TQ.pdf')
