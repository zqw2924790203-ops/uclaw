# 解析微信聊天记录，生成参考文档
# 数据源: F:\Wechat shuju\文案整理\私聊\TXT\私聊_*.txt
# 格式: YYYY-MM-DD HH:MM:SS 'username' message
# 输出: references/wechat-summary.md

$dataDir = "F:\Wechat shuju\文案整理\私聊\TXT"
$outputFile = Join-Path $PSScriptRoot "..\references\wechat-summary.md"

function Parse-Line($line) {
    if ($line -match '^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) ''([^'']+)'' (.*)') {
        return @{
            Timestamp = $Matches[1]
            User = $Matches[2]
            Message = $Matches[3]
        }
    }
    return $null
}

$allMessages = @()
$convStats = @()

Write-Host "扫描微信数据..."
$files = Get-ChildItem -LiteralPath $dataDir -Filter "私聊_*.txt" | Sort-Object Length -Descending

foreach ($f in $files) {
    $content = Get-Content -LiteralPath $f.FullName -Encoding Default -Raw
    if (-not $content) { continue }
    
    $lines = $content.Trim() -split "`n"
    $contactName = $f.Name -replace '^私聊_', '' -replace '\.txt$', ''
    
    $messages = @()
    foreach ($line in $lines) {
        $line = $line.Trim()
        if (-not $line) { continue }
        $parsed = Parse-Line $line
        if ($parsed) {
            $messages += $parsed
            $script:allMessages += $parsed.Message
        }
    }
    
    if ($messages.Count -gt 0) {
        $userCounter = $messages | Group-Object User | ForEach-Object { @{ Name = $_.Name; Count = $_.Count } }
        $script:convStats += @{
            Name = $contactName
            Total = $messages.Count
            Users = $userCounter
            Sample = $messages[0..[Math]::Min(2, $messages.Count-1)]
        }
    }
}

Write-Host "找到 $($allMessages.Count) 条消息，$($convStats.Count) 个对话"

# 分析风格
$total = $allMessages.Count
$avgLen = if ($total -gt 0) { [Math]::Round(($allMessages | Measure-Object -Average).Average, 1) } else { 0 }

# 找 emoji
$emojiPattern = '[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002702-\U000027B2\U000024C2-\U0001F251]'
$allEmojiText = $allMessages | ForEach-Object { [regex]::Matches($_, $emojiPattern) } | ForEach-Object { $_.Value }
$emojiCounter = $allEmojiText | Group-Object | Sort-Object Count -Descending | Select-Object -First 20

# 高频词（按标点和空格分割，取 >=2 字符的词）
$wordCounter = @{}
foreach ($msg in $allMessages) {
    $words = $msg -split '[,.。!！?？\s，、]' | Where-Object { $_.Length -ge 2 }
    foreach ($w in $words) {
        $w = $w.Trim()
        if ($w) {
            if ($wordCounter.ContainsKey($w)) { $wordCounter[$w]++ } else { $wordCounter[$w] = 1 }
        }
    }
}
$topWords = $wordCounter.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 50

# 生成 Markdown
$lines = @()
$lines += "# 微信聊天记录摘要"
$lines += ""
$lines += "> 数据来源: `F:\Wechat shuju\文案整理\私聊\TXT`"
$lines += "> 统计时间: 2026-04-11"
$lines += ""
$lines += "## 风格概览"
$lines += ""
$lines += "- 总消息数: $total"
$lines += "- 平均消息长度: $avgLen 字符"
$lines += ""

if ($emojiCounter.Count -gt 0) {
    $lines += "### 常用表情"
    $lines += ""
    $emojiStr = ($emojiCounter | ForEach-Object { $_.Name } | Select-Object -First 15) -join " "
    $lines += $emojiStr
    $lines += ""
}

if ($topWords.Count -gt 0) {
    $lines += "### 高频词汇"
    $lines += ""
    $wordsStr = ($topWords | ForEach-Object { "$($_.Name)($($_.Value))" } | Select-Object -First 30) -join ", "
    $lines += $wordsStr
    $lines += ""
}

$lines += "## 对话列表"
$lines += ""
$lines += "| 联系人 | 消息数 | 用户分布 |"
$lines += "|--------|--------|----------|"

foreach ($cs in $convStats | Select-Object -First 50) {
    $usersStr = ($cs.Users | Select-Object -First 3 | ForEach-Object { "$($_.Name):$($_.Count)" }) -join ", "
    $lines += "| $($cs.Name) | $($cs.Total) | $usersStr |"
}
$lines += ""
$lines += "_共 $($convStats.Count) 个对话_"
$lines += ""

$lines += "## 主要对话样例"
$lines += ""

foreach ($cs in ($convStats | Select-Object -First 10)) {
    $lines += "### $($cs.Name) ($($cs.Total) 条消息)"
    $lines += ""
    foreach ($m in $cs.Sample) {
        $snippet = if ($m.Message.Length -gt 100) { $m.Message.Substring(0, 100) + "..." } else { $m.Message }
        $snippet = $snippet -replace '[`']', '`'
        $lines += "- [$($m.Timestamp)] $($m.User): $snippet"
    }
    $lines += ""
}

$mdContent = $lines -join "`n"
$outputFile | Set-Content -Encoding UTF8 -Value $mdContent
Write-Host "已写入: $outputFile"
