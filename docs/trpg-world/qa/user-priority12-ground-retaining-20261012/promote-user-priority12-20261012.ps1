$ErrorActionPreference='Stop'
$p='C:\Users\inaba\Documents\TRPG-Capital-Blender\current'
$activeBlend=Join-Path $p 'capital-parcel-review.blend'
$activePlan=Join-Path $p 'plan.json'
$acceptedBlend=Join-Path $p 'user-p0-12-gaps-eastrock-b-20261012.accepted.blend'
$acceptedPlan=Join-Path $p 'user-p0-12-gaps-eastrock-b-20261012.accepted.plan.json'
$backupBlend=Join-Path $p 'capital-parcel-review-pre-user-P0-12-20261012.blend'
$backupPlan=Join-Path $p 'plan-pre-user-P0-12-20261012.json'
if((Test-Path $backupBlend)-or(Test-Path $backupPlan)){throw 'Existing backups: refusing replacement'}
if(-not(Test-Path $acceptedBlend) -or -not(Test-Path $acceptedPlan)){throw 'Missing accepted files'}
$meta=Get-Content (Join-Path $p 'user-p0-12-gaps-eastrock-b-20261012.study.json') -Raw |ConvertFrom-Json
if((Get-FileHash $activePlan -Algorithm SHA256).Hash.ToLowerInvariant() -ne $meta.sourcePlanSHA256.ToLowerInvariant()){throw 'Plan concurrently modified'}
if((Get-Item $activeBlend).Length -ne 45749832){throw 'Blend concurrently modified'}
if((Get-Item $acceptedBlend).Length -ne 45789109){throw 'Unexpected accepted .blend'}
$acceptedMeta=(Get-Content $acceptedPlan -Raw |ConvertFrom-Json).userReportedPriority12_20261012
if($acceptedMeta.status -ne 'ACCEPTED_USER_P0_12_STRUCTURAL_FIRST_PASS_20261012'){throw 'Not accepted'}
$qa=Get-Content (Join-Path $p 'user-p0-12-gaps-eastrock-b-exactsite-qa.json') -Raw |ConvertFrom-Json
$road=Get-Content (Join-Path $p 'user-p0-12-gaps-eastrock-b-20261012.roads-qa.json') -Raw |ConvertFrom-Json
$wall=Get-Content (Join-Path $p 'user-p0-12-gaps-eastrock-b-allwall-clearance.json') -Raw |ConvertFrom-Json
if($qa.status -ne 'PASS' -or $road.totalFailureRays -ne 14 -or $wall.candidateCount -ne 0){throw 'QA regression'}
$blenders=@(Get-Process blender -ErrorAction SilentlyContinue)
if($blenders.Count -gt 0){throw 'Blender running; do not overwrite user work'}
[IO.File]::Replace($acceptedBlend,$activeBlend,$backupBlend,$true)
try{[IO.File]::Replace($acceptedPlan,$activePlan,$backupPlan,$true)}
catch{
 [IO.File]::Copy($backupBlend,$activeBlend,$true)
 throw
}
'PROMOTED_USER_P0_12_STRUCTURAL_FIRST_PASS'
Get-Item $activeBlend,$activePlan,$backupBlend,$backupPlan |Select Name,Length,LastWriteTime
