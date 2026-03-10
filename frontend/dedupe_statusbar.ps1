$files = Get-ChildItem -Path "c:\Users\sanja\OneDrive\Documents\Harshith\SnooSpace\frontend\screens" -Recurse -Filter "*.js"
$files += Get-Item "c:\Users\sanja\OneDrive\Documents\Harshith\SnooSpace\frontend\updateAge.js" -ErrorAction SilentlyContinue
$files += Get-Item "c:\Users\sanja\OneDrive\Documents\Harshith\SnooSpace\frontend\updatePronoun.js" -ErrorAction SilentlyContinue

$count = 0
foreach ($f in $files) {
    if (Test-Path $f.FullName) {
        $content = Get-Content $f.FullName -Raw
        
        # Look for the exact problem shown in the screenshot:
        # | StatusBar } from "react-native";
        if ($content -match "\`n.*StatusBar.*} from ['""]react-native['""]" -and $content -match "import.*StatusBar.*\`n") {
            # This file likely has StatusBar on the first line of import and the last line.
            # Let's clean the entire react-native block to only have one StatusBar.
            
            # The regex matches the entire import statement:
            # import ... { ... } from "react-native"
            $newContent = [regex]::Replace($content, "(?s)(import\s+{[^}]*)}\s*from\s*['""]react-native['""]", {
                param($match)
                $block = $match.Groups[1].Value
                
                # Split by commas, trim, get unique
                $parts = $block.Substring($block.IndexOf("{") + 1).Split(",")
                $uniqueParts = @()
                foreach ($p in $parts) {
                    $trimmed = $p.Trim()
                    if ($trimmed -ne "" -and $uniqueParts -notcontains $trimmed) {
                        $uniqueParts += $trimmed
                    }
                }
                
                # Reconstruct
                $prefix = $block.Substring(0, $block.IndexOf("{") + 1)
                $joined = $uniqueParts -join ", "
                
                return "$prefix $joined } from `"react-native`""
            })
            
            if ($content -ne $newContent) {
                Set-Content -Path $f.FullName -Value $newContent -Encoding UTF8
                Write-Host "Fixed duplicates in: $($f.FullName)"
                $count++
            }
        }
    }
}
Write-Host "Total fixed: $count"
