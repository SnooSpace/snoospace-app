# capture-homefeed-trace.ps1
# atrace capture + trace_processor_shell SQL analysis for HomeFeedScreen navigation jank.
# Uses atrace -o to write trace to device file, then adb pull (binary-safe).
# Usage:  powershell -ExecutionPolicy Bypass -File .\scripts\capture-homefeed-trace.ps1

$ErrorActionPreference = "Continue"

$ADB          = "C:\Users\sanja\OneDrive\Desktop\platform-tools-latest-windows\platform-tools\adb.exe"
$PACKAGE      = "com.snoospace.app"
$TRACE_SECS   = 8
$DEVICE_OUT   = "/data/local/tmp/homefeed_trace.atrace"
$LOCAL_TRACE  = ".\homefeed-trace.atrace"
$SCRIPTS_DIR  = Split-Path -Parent $MyInvocation.MyCommand.Path
$TPS_EXE      = "$SCRIPTS_DIR\trace_processor\windows-amd64\trace_processor_shell.exe"

# ── Step 1: Prerequisites ────────────────────────────────────────────────────
Write-Host ""
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Cyan

if (-not (Test-Path $ADB)) {
    Write-Host "ERROR: adb not found at: $ADB" -ForegroundColor Red; exit 1
}
$devices = (& $ADB devices 2>&1) -join " "
if ($devices -notmatch "\tdevice") {
    Write-Host "ERROR: No device connected. Output: $devices" -ForegroundColor Red; exit 1
}
Write-Host "  OK - Device connected" -ForegroundColor Green

$sdk = [int](& $ADB shell getprop ro.build.version.sdk 2>&1).Trim()
Write-Host "  OK - API level: $sdk" -ForegroundColor Green

if (-not (Test-Path $TPS_EXE)) {
    Write-Host "ERROR: trace_processor_shell.exe not found at $TPS_EXE" -ForegroundColor Red; exit 1
}
Write-Host "  OK - trace_processor_shell found" -ForegroundColor Green

# ── Step 2: Enable app-level ATrace for our package ─────────────────────────
Write-Host ""
Write-Host "[2/5] Enabling app tracing..." -ForegroundColor Cyan
& $ADB shell "setprop debug.atrace.app_number 1" 2>&1 | Out-Null
& $ADB shell "setprop debug.atrace.app_0 $PACKAGE" 2>&1 | Out-Null
# Clear any stale trace on device
& $ADB shell "rm -f $DEVICE_OUT" 2>&1 | Out-Null
Write-Host "  OK - App tracing enabled for $PACKAGE" -ForegroundColor Green

# ── Step 3: Start async atrace ───────────────────────────────────────────────
Write-Host ""
Write-Host "[3/5] Starting atrace..." -ForegroundColor Cyan
# -b 65536 = 64MB ring buffer; no -z so output is plain text (binary-safe pull)
# Categories: view (RecyclerView/FlashList), gfx (GPU/surface),
#             sched (CPU scheduling), video (MediaCodec/ExoPlayer),
#             am (ActivityManager), wm (WindowManager)
& $ADB shell "atrace --async_start -b 65536 view gfx sched video am wm" 2>&1 | Out-Null
Write-Host "  OK - atrace recording started" -ForegroundColor Green

# ── Step 4: Countdown, stop, write to device file, pull ─────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "  RECORDING FOR $TRACE_SECS SECONDS -- PERFORM REPRO NOW" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. HomeFeedScreen must be visible with feed loaded" -ForegroundColor White
Write-Host "  2. Tap the Messages icon -> enter ConversationsListScreen" -ForegroundColor White
Write-Host "  3. Wait ~1 second for rows to settle" -ForegroundColor White
Write-Host "  4. Tap BACK" -ForegroundColor White
Write-Host "  5. Wait for the transition back to HomeFeedScreen to finish" -ForegroundColor White
Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""

for ($i = $TRACE_SECS; $i -gt 0; $i--) {
    Write-Host "  $i seconds remaining..." -ForegroundColor DarkCyan
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "  Stopping atrace and writing to device file..." -ForegroundColor Green
Write-Host "  (This may take 10-20 seconds for a 64MB buffer)" -ForegroundColor DarkGray

# --async_stop -o writes the trace buffer to a file on the device (no stdout corruption)
$stopOutput = & $ADB shell "atrace --async_stop -o $DEVICE_OUT" 2>&1
Write-Host "  atrace stop: $stopOutput"

# Verify the file exists on device
$lsResult = & $ADB shell "ls -la $DEVICE_OUT 2>&1"
Write-Host "  Device file: $lsResult"

if ($lsResult -notmatch "homefeed_trace") {
    Write-Host "ERROR: Trace file not found on device. atrace may have failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[4/5] Pulling trace from device (binary pull)..." -ForegroundColor Cyan
& $ADB pull $DEVICE_OUT $LOCAL_TRACE
& $ADB shell "rm -f $DEVICE_OUT" 2>&1 | Out-Null

if (-not (Test-Path $LOCAL_TRACE)) {
    Write-Host "ERROR: Trace not found locally after pull." -ForegroundColor Red; exit 1
}
$sizeMB = [math]::Round((Get-Item $LOCAL_TRACE).Length / 1MB, 2)
Write-Host "  OK - Trace saved: $LOCAL_TRACE - $sizeMB MB" -ForegroundColor Green

# ── Step 5: SQL analysis ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "[5/5] Running SQL analysis..." -ForegroundColor Cyan
Write-Host ""

# Verified Perfetto trace_processor schema:
#   slice        - trace events (name, ts ns, dur ns, track_id)
#   thread_track - maps track_id -> utid
#   thread       - utid, name, is_main_thread, upid
#   process      - upid, name
#
# Filter: main thread + RenderThread + ExoPlayer/MediaCodec of our process
# Only events > 1ms (1,000,000 ns) to cut noise

$QUERY = @"
SELECT
  s.name                              AS slice_name,
  COUNT(*)                            AS occurrences,
  CAST(SUM(s.dur) / 1000000 AS INT)  AS total_ms,
  CAST(MAX(s.dur) / 1000000 AS INT)  AS max_ms,
  CAST(AVG(s.dur) / 1000000 AS INT)  AS avg_ms
FROM slice s
JOIN thread_track tt ON s.track_id = tt.id
JOIN thread t USING(utid)
JOIN process p USING(upid)
WHERE
  p.name = '$PACKAGE'
  AND (
    t.is_main_thread = 1
    OR t.name LIKE '%RenderThread%'
    OR t.name LIKE '%ExoPlayer%'
    OR t.name LIKE '%MediaCodec%'
  )
  AND s.dur > 1000000
GROUP BY s.name
ORDER BY total_ms DESC
LIMIT 20;
"@

$queryFile = "$env:TEMP\perfetto_query.sql"
Set-Content -Path $queryFile -Value $QUERY -Encoding ASCII

Write-Host "Top 20 slices (main thread + RenderThread + media threads, dur > 1ms):" -ForegroundColor White
Write-Host "------------------------------------------------------------------------" -ForegroundColor DarkGray
& $TPS_EXE $LOCAL_TRACE --query-file $queryFile
Remove-Item $queryFile -Force

Write-Host ""
Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "Visual: open https://ui.perfetto.dev and drag-drop this file:" -ForegroundColor DarkGray
Write-Host "  $((Resolve-Path $LOCAL_TRACE).Path)" -ForegroundColor DarkGray
Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# Cleanup
& $ADB shell "setprop debug.atrace.app_number 0" 2>&1 | Out-Null
