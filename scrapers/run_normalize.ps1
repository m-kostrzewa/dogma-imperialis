Set-Location $PSScriptRoot
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
& "$PSScriptRoot\.venv\Scripts\python.exe" -u "$PSScriptRoot\llm_normalize.py" 2>&1 | Tee-Object -FilePath "$PSScriptRoot\llm_run_$timestamp.log"
