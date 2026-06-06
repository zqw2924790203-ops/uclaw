# -*- coding: utf-8 -*-
from pathlib import Path
import re

data_dir = Path(r"F:\Wechat shuju\文案整理\私聊\TXT")
f = list(data_dir.glob("*.txt"))[1]
content = f.read_text(encoding="utf-8")
print("Filename:", f.name)
print()

# Try different patterns to understand the format
lines = content.strip().split("\n")
for i, line in enumerate(lines[:15]):
    print(f"Line {i}: {repr(line)}")
