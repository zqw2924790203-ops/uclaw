"""
Comprehensive formatting script for paper to match template standards.
Handles page setup, fonts, headings, and more.
"""

import zipfile
import os
import shutil
import re
import codecs
from xml.etree import ElementTree as ET

# Paths
INPUT_FILE = r'C:\Users\zhang\.openclaw\media\outbound\a19e512c-d66e-4706-b4cb-d5417c439e20.docx'
OUTPUT_FILE = r'C:\Users\zhang\.openclaw\workspace\paper_formatted.docx'
UNPACK_DIR = r'C:\Users\zhang\.openclaw\workspace\paper_unpacked'

# Namespaces
NS = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
    'w14': 'http://schemas.microsoft.com/office/word/2010/wordml',
    'w15': 'http://schemas.microsoft.com/office/word/2012/wordml',
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
}

for prefix, uri in NS.items():
    ET.register_namespace(prefix, uri)

W = '{' + NS['w'] + '}'

# Font sizes in half-points (PT * 2)
# 小四 = 12pt = 24 half-points
# 三号 = 16pt = 32 half-points  
# 小三 = 15pt = 30 half-points
# 四号 = 14pt = 28 half-points
# 五号 = 10.5pt = 21 half-points

FONT_SIZES = {
    'body': 24,       # 小四 = 12pt
    'h1': 32,         # 三号 = 16pt
    'h2': 30,         # 小三 = 15pt
    'h3': 28,         # 四号 = 14pt
    'h4': 24,         # 小四 = 12pt
    'caption': 21,    # 五号 = 10.5pt
}

def pt_to_hp(pt):
    """Convert point size to half-points"""
    return int(pt * 2)

def dxa_from_mm(mm):
    """Convert mm to DXA (twips) - 1mm = 56.6929 dxa"""
    return int(mm * 56.6929)

def get_paragraph_text(p):
    """Get all text from a paragraph"""
    texts = []
    for t in p.iter(W + 't'):
        if t.text:
            texts.append(t.text)
    return ''.join(texts)

def get_paragraph_style(p):
    """Get paragraph style name"""
    pPr = p.find(W + 'pPr')
    if pPr is not None:
        pStyle = pPr.find(W + 'pStyle')
        if pStyle is not None:
            return pStyle.get(W + 'val')
    return 'Normal'

def is_heading1(text):
    """Check if text is a level 1 heading (绪论, 结论, etc.)"""
    return False  # We'll determine by content

def analyze_paragraphs(tree):
    """Analyze all paragraphs and their likely types"""
    root = tree.getroot()
    body = root.find(W + 'body')
    
    results = []
    for i, p in enumerate(body.findall(W + 'p')):
        text = get_paragraph_text(p)
        style = get_paragraph_style(p)
        results.append({
            'index': i,
            'text': text,
            'style': style,
            'para': p
        })
    return results

def fix_page_margins(tree):
    """Fix page margins per template: top=30mm, bottom=25mm, left=25mm, right=20mm, header=20mm, footer=15mm"""
    root = tree.getroot()
    body = root.find(W + 'body')
    
    # Find sectPr
    sectPr = body.find(W + 'sectPr')
    if sectPr is None:
        # Create it
        sectPr = ET.SubElement(body, W + 'sectPr')
    
    # Find or create pgMar
    pgMar = sectPr.find(W + 'pgMar')
    if pgMar is None:
        pgMar = ET.SubElement(sectPr, W + 'pgMar')
    
    # Set margins (in DXA)
    # 30mm top, 25mm bottom, 25mm left, 20mm right
    # 20mm header, 15mm footer
    pgMar.set(W + 'top', str(dxa_from_mm(30)))
    pgMar.set(W + 'bottom', str(dxa_from_mm(25)))
    pgMar.set(W + 'left', str(dxa_from_mm(25)))
    pgMar.set(W + 'right', str(dxa_from_mm(20)))
    pgMar.set(W + 'header', str(dxa_from_mm(20)))
    pgMar.set(W + 'footer', str(dxa_from_mm(15)))
    
    # Also fix page size to A4 if needed
    pgSz = sectPr.find(W + 'pgSz')
    if pgSz is None:
        pgSz = ET.SubElement(sectPr, W + 'pgSz')
    # A4: 210mm x 297mm = 11906 x 16838 twips
    pgSz.set(W + 'w', '11906')
    pgSz.set(W + 'h', '16838')
    
    print("  Fixed page margins and size")

def fix_document_xml(tree, analysis):
    """Apply formatting to document.xml based on content analysis"""
    root = tree.getroot()
    body = root.find(W + 'body')
    
    changed = 0
    
    for info in analysis:
        p = info['para']
        text = info['text'].strip()
        
        # Get or create pPr
        pPr = p.find(W + 'pPr')
        if pPr is None:
            pPr = ET.Element(W + 'pPr')
            p.insert(0, pPr)
        
        # Determine what type of paragraph this is
        para_type = classify_paragraph(text, info['style'])
        
        if para_type:
            apply_formatting(p, pPr, para_type)
            changed += 1
    
    print(f"  Applied formatting to {changed} paragraphs")

def classify_paragraph(text, style):
    """Classify paragraph and return type for formatting"""
    if not text:
        return None
    
    # Title page elements (封面)
    if '贵阳人文科技学院' in text and '本科毕业' in text:
        return 'cover_title'
    
    # Main paper title (the actual title after cover)
    if '19世纪英国文学女性意识' in text:
        return 'main_title'
    
    # Section headings based on known structure
    # Level 1: 1 绪论, 2 一级标题, 5 结论, 6 参考文献, 致谢
    if re.match(r'^1\s+(绪论|引言)', text) or text == '1 绪论':
        return 'h1'
    if re.match(r'^5\s+结论', text) or text == '5 结论':
        return 'h1'
    if re.match(r'^6\s+参考文献', text) or text == '6 参考文献':
        return 'h1'
    if '致    谢' in text or text.strip() == '致谢' or text == '致  谢':
        return 'h1'
    if '附录' in text and (text.strip() == '附录' or text.strip().startswith('附录 ')):
        return 'h1'
    if text == '目    录' or text.strip() == '目录':
        return 'h1'
    
    # Section headings with numbers (1, 2, 3, 4 as main sections)
    if re.match(r'^[1-6]\s+[^\d]+$', text.strip()) and len(text.strip()) < 30:
        return 'h1'
    
    # Level 2 headings: 2.1, 2.2, 3.1, etc.
    if re.match(r'^\d+\.\d+', text.strip()):
        # Check if it's just a heading (short) or has content
        if len(text.strip()) < 50 and not text.strip().endswith('。'):
            return 'h2'
    
    # Level 3 headings: 2.1.1, etc.
    if re.match(r'^\d+\.\d+\.\d+', text.strip()):
        if len(text.strip()) < 60:
            return 'h3'
    
    # Figure/table captions
    if text.startswith('图') or text.startswith('表'):
        return 'caption'
    
    # Abstract heading
    if text == '摘    要' or text == '摘要':
        return 'h1'
    
    # Normal body text
    return 'body'

def apply_formatting(p, pPr, para_type):
    """Apply formatting properties to a paragraph"""
    # Remove existing spacing and font properties that we'll replace
    existing_spacing = pPr.find(W + 'spacing')
    existing_ind = pPr.find(W + 'ind')
    existing_jc = pPr.find(W + 'jc')
    
    # Handle alignment
    if para_type in ['h1', 'main_title', 'cover_title']:
        # Centered
        if existing_jc is None:
            existing_jc = ET.SubElement(pPr, W + 'jc')
        existing_jc.set(W + 'val', 'center')
    
    # Handle spacing and fonts based on type
    if para_type in ['h1', 'main_title', 'cover_title']:
        # Spacing before/after for headings
        spacing = pPr.find(W + 'spacing') or ET.Element(W + 'spacing')
        if spacing.get(W + 'before') is None:
            spacing.set(W + 'before', '240')
        if spacing.get(W + 'after') is None:
            spacing.set(W + 'after', '240')
        if spacing.get(W + 'line') is None:
            spacing.set(W + 'line', '360')
        if spacing.get(W + 'lineRule') is None:
            spacing.set(W + 'lineRule', 'auto')
        if spacing.get(W + 'before') is not None or pPr.find(W + 'spacing') is None:
            pass  # Already set above
            
    # Apply font formatting to all runs in paragraph
    for r in p.findall(W + 'r'):
        apply_run_formatting(r, para_type)
    
    # Also apply to rPr in pPr for paragraph-level formatting
    rPr = pPr.find(W + 'rPr')
    if rPr is None and para_type != 'body':
        rPr = ET.Element(W + 'rPr')
        pPr.append(rPr)
    
    if para_type != 'body' and rPr is not None:
        apply_run_props_formatting(rPr, para_type)

def apply_run_formatting(r, para_type):
    """Apply font formatting to a run"""
    rPr = r.find(W + 'rPr')
    if rPr is None:
        rPr = ET.Element(W + 'rPr')
        r.insert(0, rPr)
    
    # Remove existing size
    existing_sz = rPr.find(W + 'sz')
    existing_szac = rPr.find(W + 'szCs')
    if existing_sz is not None:
        rPr.remove(existing_sz)
    if existing_szac is not None:
        rPr.remove(existing_szac)
    
    # Remove existing font
    existing_fonts = rPr.find(W + 'rFonts')
    if existing_fonts is not None:
        rPr.remove(existing_fonts)
    
    # Apply new formatting based on para type
    if para_type == 'body':
        size = FONT_SIZES['body']
        set_run_fonts(rPr, '宋体', 'Times New Roman', size)
    elif para_type == 'h1':
        size = FONT_SIZES['h1']
        set_run_fonts(rPr, '黑体', 'Times New Roman', size, bold=True)
    elif para_type == 'h2':
        size = FONT_SIZES['h2']
        set_run_fonts(rPr, '宋体', 'Times New Roman', size, bold=True)
    elif para_type == 'h3':
        size = FONT_SIZES['h3']
        set_run_fonts(rPr, '宋体', 'Times New Roman', size, bold=False)
    elif para_type == 'h4':
        size = FONT_SIZES['h4']
        set_run_fonts(rPr, '宋体', 'Times New Roman', size, bold=False)
    elif para_type == 'caption':
        size = FONT_SIZES['caption']
        set_run_fonts(rPr, '宋体', 'Times New Roman', size)
    elif para_type == 'main_title':
        size = FONT_SIZES['h1']
        set_run_fonts(rPr, '黑体', 'Times New Roman', size, bold=True)
    else:
        size = FONT_SIZES['body']
        set_run_fonts(rPr, '宋体', 'Times New Roman', size)

def set_run_fonts(rPr, east_asia, ascii_font, size, bold=False):
    """Set font properties on a run properties element"""
    # Remove existing rFonts
    existing = rPr.find(W + 'rFonts')
    if existing is not None:
        rPr.remove(existing)
    
    fonts = ET.Element(W + 'rFonts')
    fonts.set(W + 'ascii', ascii_font)
    fonts.set(W + 'hAnsi', ascii_font)
    fonts.set(W + 'eastAsia', east_asia)
    fonts.set(W + 'cs', ascii_font)
    rPr.insert(0, fonts)
    
    # Set size
    sz = ET.Element(W + 'sz')
    sz.set(W + 'val', str(size))
    rPr.append(sz)
    
    szCs = ET.Element(W + 'szCs')
    szCs.set(W + 'val', str(size))
    rPr.append(szCs)
    
    # Set bold if needed
    if bold:
        existing_b = rPr.find(W + 'b')
        if existing_b is None:
            b = ET.Element(W + 'b')
            rPr.append(b)
    else:
        # Remove bold
        existing_b = rPr.find(W + 'b')
        if existing_b is not None:
            rPr.remove(existing_b)

def apply_run_props_formatting(rPr, para_type):
    """Apply formatting to paragraph-level run properties"""
    if para_type == 'h1':
        size = FONT_SIZES['h1']
        set_run_fonts(rPr, '黑体', 'Times New Roman', size, bold=True)
    elif para_type == 'main_title':
        size = FONT_SIZES['h1']
        set_run_fonts(rPr, '黑体', 'Times New Roman', size, bold=True)

def fix_styles_xml(tree):
    """Update styles.xml to match template requirements"""
    # This is complex; we'll do targeted fixes
    print("  Styles XML would need comprehensive update - skipping for now")

def process():
    """Main processing function"""
    print(f"Reading: {INPUT_FILE}")
    
    # Unpack
    if os.path.exists(UNPACK_DIR):
        shutil.rmtree(UNPACK_DIR)
    os.makedirs(UNPACK_DIR)
    
    with zipfile.ZipFile(INPUT_FILE, 'r') as z:
        z.extractall(UNPACK_DIR)
    
    print("  Unpacked successfully")
    
    # Parse document.xml
    doc_path = os.path.join(UNPACK_DIR, 'word', 'document.xml')
    tree = ET.parse(doc_path)
    
    # Analyze paragraphs
    print("  Analyzing paragraphs...")
    analysis = analyze_paragraphs(tree)
    
    # Show sample analysis
    print("\n  Sample analysis:")
    for info in analysis[:15]:
        text = info['text'][:40]
        print(f"    [{info['index']}] style={info['style']} | {text}")
    
    # Fix page margins
    print("\n  Fixing page margins...")
    fix_page_margins(tree)
    
    # Apply paragraph formatting
    print("  Applying paragraph formatting...")
    fix_document_xml(tree, analysis)
    
    # Save document.xml
    print("  Saving document.xml...")
    tree.write(doc_path, encoding='UTF-8', xml_declaration=True)
    
    # Also fix page margins in sectPr (need to re-read after write)
    with open(doc_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix sectPr margins directly via string replacement (more reliable)
    # Current: w:top="1701" w:right="1134" w:bottom="1417" w:left="1417" w:header="1134" w:footer="850"
    # Target: top=30mm=1701, right=20mm=1134, bottom=25mm=1417, left=25mm=1417, header=20mm=1134, footer=15mm=850
    # Wait - footer=850 is approximately 15mm. Let me verify: 15*56.69=850.35 ✓
    # Actually the current values look correct. Let me just verify and ensure they're right.
    
    print("\n  Current pgMar values (checking):")
    margin_match = re.search(r'<w:pgMar[^>]+>', content)
    if margin_match:
        print(f"    {margin_match.group()}")
    
    # Fix footer - should be 15mm = 850.35 → 851
    content = re.sub(
        r'(<w:pgMar[^>]+w:footer=")(\d+)(")',
        lambda m: m.group(1) + str(dxa_from_mm(15)) + m.group(3),
        content
    )
    
    # Fix header - should be 20mm = 1133.86 → 1134
    content = re.sub(
        r'(<w:pgMar[^>]+w:header=")(\d+)(")',
        lambda m: m.group(1) + str(dxa_from_mm(20)) + m.group(3),
        content
    )
    
    with open(doc_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("  Saved with updated margins")
    
    # Repack
    print("\n  Repacking...")
    if os.path.exists(OUTPUT_FILE):
        os.remove(OUTPUT_FILE)
    
    with zipfile.ZipFile(OUTPUT_FILE, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(UNPACK_DIR):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, UNPACK_DIR)
                z.write(file_path, arcname)
    
    print(f"\n  Output: {OUTPUT_FILE}")
    print("  Done!")

if __name__ == '__main__':
    process()
