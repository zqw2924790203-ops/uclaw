import zipfile
import re

path = r'C:\Users\zhang\.openclaw\workspace\paper_formatted.docx'
with zipfile.ZipFile(path, 'r') as z:
    with z.open('word/document.xml') as f:
        content = f.read().decode('utf-8')

# Check font size distribution
matches32 = re.findall(r'<w:sz w:val="32"[^>]*/>', content)
print(f'sz=32 (三号 heading 1): {len(matches32)}')

matches30 = re.findall(r'<w:sz w:val="30"[^>]*/>', content)
print(f'sz=30 (小三 heading 2): {len(matches30)}')

matches28 = re.findall(r'<w:sz w:val="28"[^>]*/>', content)
print(f'sz=28 (四号 heading 3): {len(matches28)}')

matches24 = re.findall(r'<w:sz w:val="24"[^>]*/>', content)
print(f'sz=24 (小四 body): {len(matches24)}')

matches21 = re.findall(r'<w:sz w:val="21"[^>]*/>', content)
print(f'sz=21 (五号 caption): {len(matches21)}')

# Check for bold headings (should have <w:b />)
bold_count = len(re.findall(r'<w:b\s*/>', content))
print(f'\nBold elements: {bold_count}')

# Check for 黑体 (Heiti) fonts
heiti_count = content.count('黑体')
print(f'黑体 font references: {heiti_count}')

# Check for 宋体 (Songti) fonts  
songti_count = content.count('宋体')
print(f'宋体 font references: {songti_count}')

# Check margins again
margin_match = re.search(r'<w:pgMar[^>]+>', content)
print(f'\nPage margins: {margin_match.group() if margin_match else "not found"}')

# Check for 1.5 line spacing (360)
line360 = len(re.findall(r'<w:spacing[^>]*w:line="360"[^>]*/>', content))
print(f'1.5 line spacing (360): {line360}')
