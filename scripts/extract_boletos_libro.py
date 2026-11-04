"""Extrae PAGO BOLETOS 2026.xlsx a JSON para la réplica fiel de /boletos.

Uso: python3 -I scripts/extract_boletos_libro.py "PAGO BOLETOS 2026.xlsx" src/app/pages/boletos-libro.data.json
Cada celda: [valor, formula, estilo, cache]  (formula/cache = null si no aplica)
"""
import sys, json, re, colorsys, datetime
import xml.etree.ElementTree as ET
import openpyxl
from openpyxl.styles.colors import COLOR_INDEX
from openpyxl.utils import get_column_letter

MARGEN_COLS = 3
MARGEN_FILAS = 5
# Ancho predeterminado de Excel según baseColWidth (Calibri 11): 8 -> 8.43, 10 -> 11.43 (Excel en español).
ANCHO_POR_BASE = {8: 9.140625, 10: 11.42578125}
ANCHO_DIGITO = 7  # px del dígito más ancho en Calibri 11, la fuente base del libro


def px_columna(ancho):
    """Ancho de columna de Excel (caracteres) a píxeles, con la fórmula de la especificación OOXML."""
    return int(((256 * ancho + int(128 / ANCHO_DIGITO)) / 256) * ANCHO_DIGITO)

src, out = sys.argv[1], sys.argv[2]
wf = openpyxl.load_workbook(src, data_only=False)
wv = openpyxl.load_workbook(src, data_only=True)

# --- tema (para colores theme + tint) ---
theme = []
try:
    ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
    root = ET.fromstring(wf.loaded_theme)
    scheme = root.find('.//a:clrScheme', ns)
    order = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']
    m = {}
    for el in scheme:
        tag = el.tag.split('}')[1]
        c = el[0]
        m[tag] = c.get('lastClr') or c.get('val')
    theme = [m.get(k, '000000') for k in order]
except Exception as e:
    print('aviso tema:', e, file=sys.stderr)

def tint(hexrgb, t):
    r, g, b = (int(hexrgb[i:i+2], 16) / 255 for i in (0, 2, 4))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    l = l * (1 + t) if t < 0 else l * (1 - t) + t
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return '#%02X%02X%02X' % (round(r * 255), round(g * 255), round(b * 255))

def color(c):
    if c is None:
        return None
    try:
        if c.type == 'rgb' and isinstance(c.rgb, str):
            rgb = c.rgb[-6:]
            if c.rgb in ('00000000',):
                return None
            return tint(rgb, c.tint or 0) if c.tint else '#' + rgb.upper()
        if c.type == 'theme' and theme:
            return tint(theme[c.theme], c.tint or 0)
        if c.type == 'indexed' and c.indexed is not None and c.indexed < len(COLOR_INDEX):
            if c.indexed in (64, 65):
                return None
            return '#' + COLOR_INDEX[c.indexed][-6:].upper()
    except Exception:
        return None
    return None

def numfmt(f):
    if not f or f == 'General':
        return 'g'
    if '$' in f:
        dec = 1 if '0.0;' in f or f.endswith('0.0') or '#,##0.0;' in f else 2
        acct = '_-' in f or '* ' in f
        red = '[Red]' in f
        return f"m{dec}{'a' if acct else ''}{'r' if red else ''}"
    if '0.00' in f:
        return 'n2'
    if '%' in f:
        return 'p'
    return 'g'

styles, sidx = [], {}
def style_of(c):
    fill = None
    if c.fill is not None and c.fill.fill_type == 'solid':
        fill = color(c.fill.fgColor)
    f = c.font
    fc = color(f.color) if f is not None and f.color is not None else None
    if fc in ('#000000',):
        fc = None
    b = c.border
    # Cada lado con su grosor: 1 delgado, 2 mediano/doble, 3 grueso. Ej.: "t2r1b1l2"
    grosor = {'medium': 2, 'mediumDashed': 2, 'mediumDashDot': 2, 'mediumDashDotDot': 2, 'double': 2, 'thick': 3}
    bd = ''.join(f"{k}{grosor.get(side.style, 1)}" for k, side in (('t', b.top), ('r', b.right), ('b', b.bottom), ('l', b.left)) if side is not None and side.style)
    al = c.alignment
    sz = float(f.sz) if f is not None and f.sz else None
    fn = f.name if f is not None and f.name else None
    st = {
        'bg': fill,
        'fc': fc,
        'b': bool(f.b) if f is not None else False,
        'i': bool(f.i) if f is not None else False,
        'u': bool(f.u) if f is not None and f.u not in (None, 'none') else False,
        # Calibri 11 es la fuente base del libro: solo se guarda lo que difiere.
        'sz': sz if sz not in (None, 11.0) else None,
        'fn': fn if fn not in (None, 'Calibri') else None,
        'ha': al.horizontal if al is not None and al.horizontal not in (None, 'general') else None,
        'va': al.vertical if al is not None and al.vertical not in (None, 'bottom') else None,
        'wr': bool(al.wrap_text) if al is not None else False,
        'nf': numfmt(c.number_format),
        'bd': bd or None,
    }
    if st['nf'] == 'g':
        st['nf'] = None
    key = json.dumps(st, sort_keys=True)
    if key not in sidx:
        sidx[key] = len(styles)
        styles.append({k: v for k, v in st.items() if v not in (None, False)})
    return sidx[key]

def plain(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.isoformat()
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v

sheets = []
for ws in wf.worksheets:
    wsv = wv[ws.title]
    try:
        tab = ws.sheet_properties.tabColor
        tabc = color(tab) if tab is not None else None
    except Exception:
        tabc = None
    # Excel muestra columnas y filas vacías más allá de los datos: se agrega un margen.
    ver_cols = ws.max_column + MARGEN_COLS
    ver_filas = ws.max_row + MARGEN_FILAS
    fmt = ws.sheet_format
    ancho_def = px_columna(float(fmt.defaultColWidth) if fmt.defaultColWidth else ANCHO_POR_BASE.get(int(fmt.baseColWidth or 8), float(fmt.baseColWidth or 8) + 0.71))
    alto_def = round(float(fmt.defaultRowHeight or 15) * 4 / 3)
    # <col min max width> define rangos (p. ej. A:XFD con un solo ancho): se expanden.
    cols, hcols = {}, []
    for d in ws.column_dimensions.values():
        if d.min is None or d.max is None:
            continue
        for idx in range(d.min, min(d.max, ver_cols) + 1):
            letra = get_column_letter(idx)
            if d.width:
                ancho = px_columna(float(d.width))
                if ancho != ancho_def:
                    cols[letra] = ancho
            if d.hidden:
                hcols.append(letra)
    rows = {str(k): round(d.height * 4 / 3) for k, d in ws.row_dimensions.items() if d.height and round(d.height * 4 / 3) != alto_def}
    hrows = [k for k, d in ws.row_dimensions.items() if d.hidden]
    cells = {}
    for row in ws.iter_rows():
        for c in row:
            v = c.value
            s = style_of(c)
            if v is None and not styles[s]:
                continue
            if isinstance(v, str) and v.startswith('='):
                cells[c.coordinate] = [None, v, s, plain(wsv[c.coordinate].value)]
            else:
                cells[c.coordinate] = [plain(v), None, s, None]
    sheets.append({
        'name': ws.title,
        'tab': tabc,
        'maxRow': ws.max_row,
        'maxCol': ws.max_column,
        'verFilas': ver_filas,
        'verCols': ver_cols,
        'anchoDef': ancho_def,
        'altoDef': alto_def,
        'cols': cols,
        'rows': rows,
        'hiddenCols': hcols,
        'hiddenRows': hrows,
        'freeze': ws.freeze_panes,
        'cells': cells,
    })

json.dump({'version': 1, 'source': 'PAGO BOLETOS 2026.xlsx', 'active': wf.index(wf.active), 'styles': styles, 'sheets': sheets},
          open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('hojas', len(sheets), 'estilos', len(styles), 'celdas', sum(len(s['cells']) for s in sheets))
