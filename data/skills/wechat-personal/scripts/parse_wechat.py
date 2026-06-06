# -*- coding: utf-8 -*-
"""Parse WeChat chat records and generate reference document."""
import os
import re
from pathlib import Path
from collections import defaultdict, Counter

# Use pathlib with os.fsdecode for Windows paths
data_dir = Path(r"F:\Wechat shuju\文案整理\私聊\TXT")
output_file = Path(__file__).parent.parent / "references" / "wechat-summary.md"

def parse_line(line):
    m = re.match(r'^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \'([^\']+)\' (.*)', line, re.DOTALL)
    if m:
        return m.group(1), m.group(2), m.group(3).strip()
    return None

def extract_conversations():
    all_messages = []
    conv_stats = []

    try:
        files = list(data_dir.glob("私聊_*.txt"))
    except Exception as e:
        print(f"Cannot access directory: {e}")
        return [], []

    files_sorted = sorted(files, key=lambda f: f.stat().st_size, reverse=True)
    print(f"Found {len(files_sorted)} files")

    for f in files_sorted:
        try:
            content = f.read_text(encoding="gbk")
        except Exception as e1:
            try:
                content = f.read_text(encoding="utf-8")
            except Exception as e2:
                print(f"Skip {f.name}: {e2}")
                continue

        lines = content.strip().split("\n")
        contact_name = f.stem.replace("私聊_", "")

        messages = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            parsed = parse_line(line)
            if parsed:
                ts, user, msg = parsed
                messages.append({"ts": ts, "user": user, "msg": msg})
                all_messages.append(msg)

        if messages:
            user_counter = Counter(m["user"] for m in messages)
            conv_stats.append({
                "name": contact_name,
                "total": len(messages),
                "users": dict(user_counter.most_common(5)),
                "sample": messages[:3]
            })

    return all_messages, conv_stats

def analyze_style(messages):
    total = len(messages)
    if total == 0:
        return {}

    lengths = [len(m) for m in messages]
    avg_len = sum(lengths) / total

    emoji_pattern = re.compile(
        r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF'
        r'\U0001F1E0-\U0001F1FF\U00002702-\U000027B2\U000024C2-\U0001F251]'
    )
    emojis = []
    for m in messages:
        emojis.extend(emoji_pattern.findall(m))
    emoji_counter = Counter(emojis)

    words = []
    for m in messages:
        parts = re.split(r'[,，.。!！?？\s]', m)
        words.extend([p for p in parts if len(p) >= 2])
    word_counter = Counter(words)

    return {
        "total_messages": total,
        "avg_length": round(avg_len, 1),
        "top_emojis": emoji_counter.most_common(20),
        "top_words": word_counter.most_common(50),
    }

def generate_markdown(conv_stats, style):
    lines = []
    lines.append("# 微信聊天记录摘要")
    lines.append("")
    lines.append("> 数据来源: F:\\Wechat shuju\\文案整理\\私聊\\TXT")
    lines.append("> 统计时间: 2026-04-11")
    lines.append("")
    lines.append("## 风格概览")
    lines.append("")
    lines.append("- 总消息数: " + str(style["total_messages"]))
    lines.append("- 平均消息长度: " + str(style["avg_length"]) + " 字符")
    lines.append("")

    if style["top_emojis"]:
        lines.append("### 常用表情")
        lines.append("")
        emojis = " ".join([e[0] for e in style["top_emojis"][:15]])
        lines.append(emojis)
        lines.append("")

    if style["top_words"]:
        lines.append("### 高频词汇")
        lines.append("")
        words_str = ", ".join(["%s(%d)" % (w, c) for w, c in style["top_words"][:30]])
        lines.append(words_str)
        lines.append("")

    lines.append("## 对话列表")
    lines.append("")
    lines.append("| 联系人 | 消息数 | 用户分布 |")
    lines.append("|--------|--------|----------|")

    for cs in conv_stats[:50]:
        users_str = ", ".join(["%s:%d" % (u, c) for u, c in list(cs["users"].items())[:3]])
        lines.append("| %s | %d | %s |" % (cs["name"], cs["total"], users_str))

    lines.append("")
    lines.append("_共 %d 个对话_" % len(conv_stats))
    lines.append("")
    lines.append("## 主要对话样例")
    lines.append("")

    for cs in conv_stats[:10]:
        lines.append("### %s (%d 条消息)" % (cs["name"], cs["total"]))
        lines.append("")
        for m in cs["sample"][:5]:
            snippet = m["msg"][:100] + "..." if len(m["msg"]) > 100 else m["msg"]
            snippet = snippet.replace("`", "'")
            lines.append("- [%s] %s: %s" % (m["ts"], m["user"], snippet))
        lines.append("")

    return "\n".join(lines)

if __name__ == "__main__":
    print("Scanning WeChat data...")
    messages, conv_stats = extract_conversations()
    print("Found %d messages, %d conversations" % (len(messages), len(conv_stats)))

    if not messages:
        print("No messages found! Check the data directory path.")
        # Try to list the directory
        try:
            files = list(data_dir.glob("*.txt"))
            print("Directory exists, found %d .txt files" % len(files))
            if files:
                print("Sample filename:", files[0].name)
                # Try to read first file
                try:
                    content = files[0].read_text(encoding="gbk")
                    print("First 200 chars:", content[:200])
                except Exception as e:
                    print("Read error:", e)
        except Exception as e:
            print("Directory access error:", e)
        exit(1)

    print("Analyzing style...")
    style = analyze_style(messages)

    print("Generating document...")
    output_file.parent.mkdir(parents=True, exist_ok=True)
    md = generate_markdown(conv_stats, style)
    output_file.write_text(md, encoding="utf-8")
    print("Written: " + str(output_file))
