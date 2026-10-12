$ErrorActionPreference='Stop'
$p='C:\Users\inaba\Documents\TRPG-Capital-Blender\current'
$meta=Get-Content (Join-Path $p 'royal-east-integrated-v9.accepted.study.json') -Raw | ConvertFrom-Json
$qa=Get-Content (Join-Path $p 'royal-east-integrated-v9.localqa.json') -Raw | ConvertFrom-Json
$roads=Get-Content (Join-Path $p 'royal-east-integrated-v9.road-qa.json') -Raw | ConvertFrom-Json
if($meta.status -ne 'ACCEPTED_STRUCTURAL_FIRST_PASS_20261012'){throw 'Not accepted'}
if($qa.status -ne 'PASS' -or $qa.rockNonManifoldEdges -ne 0 -or $qa.walkwayHits.Count -ne 0){throw 'Local QA fail'}
if($roads.routesVisited -ne 1232 -or $roads.totalFailureRays -ne 14){throw 'Citywide regression'}
$oldPlan=Join-Path $p 'plan.json'
$oldBlend=Join-Path $p 'capital-parcel-review.blend'
$staged=Join-Path $p 'royal-east-integrated-v9.accepted.plan.json'
$pending=Join-Path $p 'royal-east-integrated-v9.pending.blend'
$backup=Join-Path $p 'capital-parcel-review-pre-east-v9-20261012.blend'
$backupPlan=Join-Path $p 'plan-pre-east-v9-20261012.json'
if((Test-Path $backup) -or (Test-Path $backupPlan)){throw 'Backup exists; refusing replacement'}
if((Get-FileHash $oldPlan -Algorithm SHA256).Hash.ToLowerInvariant() -ne $meta.sourcePlanSHA256){throw 'Active plan concurrently changed'}
if((Get-Item $oldBlend).Length -ne 45662768){throw 'Active blend changed'}
if((Get-Item $pending).Length -lt 45700000){throw 'Pilot .blend too small'}
[IO.File]::Replace($pending,$oldBlend,$backup,$true)
try{[IO.File]::Replace($staged,$oldPlan,$backupPlan,$true)}
catch{[IO.File]::Copy($backup,$oldBlend,$true);throw}
Write-Output 'PROMOTED_ROYAL_EAST_V9_FIRST_PASS'
Get-Item $oldBlend,$oldPlan,$backup,$backupPlan| Select Name,Length,LastWriteTime
