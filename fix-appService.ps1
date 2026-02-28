$content = Get-Content 'backend/src/services/appService.ts' -Raw
$old = 'schoolId: updates.schoolId,'
$new = 'schoolId: updates.schoolId ?? undefined,'
$content = $content.Replace($old, $new)
Set-Content -Path 'backend/src/services/appService.ts' -Value $content -NoNewline
Write-Host "Done"
