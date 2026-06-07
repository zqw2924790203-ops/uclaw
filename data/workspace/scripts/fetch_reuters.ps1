# Reuters News Fetcher
# Run at 7:30 AM to collect top news

$outputFile = "C:\Users\zhang\.openclaw\workspace\reuters_news.txt"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"

try {
    # Fetch Reuters RSS feed (World News)
    $rss = Invoke-WebRequest -Uri "https://www.reutersagency.com/feed/?best-topics=world-news" -UserAgent "Mozilla/5.0" -TimeoutSec 30 -UseBasicParsing
    
    # Parse XML
    [xml]$xml = $rss.Content
    
    # Extract recent items
    $items = $xml.rss.channel.item | Select-Object -First 15
    
    $newsContent = "路透社新闻 - $timestamp`n========================================`n`n"
    
    foreach ($item in $items) {
        $title = $item.title -replace '<[^>]+>', ''
        $newsContent += "📰 $title`n"
        if ($item.link) {
            $newsContent += "   🔗 $($item.link)`n"
        }
        $newsContent += "`n"
    }
    
    # Also try BBC if Reuters fails
    if ($items.Count -eq 0) {
        $bbc = Invoke-WebRequest -Uri "https://feeds.bbci.co.uk/news/world/rss.xml" -UserAgent "Mozilla/5.0" -TimeoutSec 30 -UseBasicParsing
        [xml]$bbcXml = $bbc.Content
        $bbcItems = $bbcXml.rss.channel.item | Select-Object -First 15
        
        $newsContent = "路透社新闻 (备用BBC) - $timestamp`n========================================`n`n"
        
        foreach ($item in $bbcItems) {
            $title = $item.title -replace '<[^>]+>', ''
            $newsContent += "📰 $title`n"
            if ($item.link) {
                $newsContent += "   🔗 $($item.link)`n"
            }
            $newsContent += "`n"
        }
    }
    
    $newsContent | Out-File -FilePath $outputFile -Encoding UTF8
    Write-Host "News collected successfully at $timestamp"
    exit 0
    
} catch {
    $errorContent = "Error fetching news at $timestamp : $_`n$(($_.Exception).ToString())"
    $errorContent | Out-File -FilePath $outputFile -Encoding UTF8
    Write-Host $errorContent
    exit 1
}
