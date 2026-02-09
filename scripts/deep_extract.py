import zipfile
import xml.etree.ElementTree as ET
import sys
import re

docx_path = "projects/horace_task/national paralegal college lease for testing.docx"

def extract_text(path):
    try:
        with zipfile.ZipFile(path) as z:
            xml_content = z.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            
            # XML namespaces
            namespaces = {
                'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
            }
            
            full_text = []
            
            # Iterate through all paragraphs and tables
            for element in tree.iter():
                if element.tag.endswith('}t'): # Text node
                    if element.text:
                        full_text.append(element.text)
                elif element.tag.endswith('}br'): # Break
                    full_text.append('\n')
                elif element.tag.endswith('}p'): # Paragraph end
                    full_text.append('\n')
                elif element.tag.endswith('}tab'): # Tab
                    full_text.append('\t')
            
            return "".join(full_text)

    except Exception as e:
        return f"Error: {e}"

content = extract_text(docx_path)
print("--- START OF EXTRACTED TEXT ---")
print(content)
print("--- END OF EXTRACTED TEXT ---")

# Specific search for Item 4.3 near "Terms Schedule"
print("\n--- SEARCHING FOR ITEM 4.3 CONTEXT ---")
lines = content.split('\n')
for i, line in enumerate(lines):
    if "Item 4.3" in line or "Item 4.3" in lines[max(0, i-5):min(len(lines), i+5)]:
        print(f"Line {i}: {line}")
        
