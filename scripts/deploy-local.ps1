# Déploiement du service Windows, en une commande.
#
# Le paquet d'installation est un exécutable auto-extractible IExpress :
# lancé seul avec /Q il extrait et ne déploie rien. Il faut l'extraire
# (/Q /C /T:dossier) puis lancer setup.cmd en tant qu'administrateur.
# Ce script fait les deux, et vérifie que le service répond après coup.
#
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-local.ps1
#
# Une invite UAC s'affiche : c'est voulu, et c'est la seule raison pour
# laquelle ce geste ne peut pas être automatisé de bout en bout. Le
# répertoire d'installation n'est PAS accessible en écriture à un compte
# ordinaire — c'est le correctif d'élévation de privilèges de la campagne
# de sécurité, et il tient.

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$exe  = Join-Path $repo "dist\MeridianSetup.exe"

if (-not (Test-Path $exe)) {
    Write-Host "  Pas de paquet. Construisez-le d'abord :" -ForegroundColor Yellow
    Write-Host "      npm run package:installer"
    exit 2
}

$built = (Get-Item $exe).LastWriteTime
Write-Host ""
Write-Host "  paquet      $([IO.Path]::GetFileName($exe))  ($([math]::Round((Get-Item $exe).Length / 1MB, 1)) Mo, $built)"

# État d'avant, pour pouvoir dire ce qui a changé.
try {
    $before = (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4173/api/health -TimeoutSec 5).Content
    Write-Host "  avant       $before"
} catch {
    Write-Host "  avant       le service ne répond pas (première installation ?)"
}

$stage = Join-Path $env:TEMP ("meridian-deploy-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force $stage | Out-Null

Write-Host "  extraction  $stage"
& $exe /Q /C /T:$stage
if (-not (Test-Path (Join-Path $stage "setup.cmd"))) {
    Write-Host "  L'extraction n'a pas produit setup.cmd." -ForegroundColor Red
    exit 1
}

Write-Host "  installation (une invite UAC va s'afficher)"
$p = Start-Process -FilePath (Join-Path $stage "setup.cmd") -ArgumentList "/quiet" `
        -Verb RunAs -Wait -PassThru
if ($p.ExitCode -ne 0) {
    Write-Host "  setup.cmd a rendu $($p.ExitCode)." -ForegroundColor Red
    Write-Host "  Le dossier d'installation est conservé : $stage"
    exit $p.ExitCode
}

# Le service redémarre et rejoue les migrations ; on lui laisse le temps
# plutôt que de conclure trop tôt à un échec.
$ok = $null
foreach ($try in 1..20) {
    Start-Sleep -Seconds 3
    try {
        $ok = (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4173/api/health -TimeoutSec 5).Content
        break
    } catch { }
}

Write-Host ""
if ($ok) {
    Write-Host "  après       $ok" -ForegroundColor Green
    Write-Host ""
    Write-Host "  La migration 023 a renommé la colonne du jeton de session et vidé"
    Write-Host "  la table : tout le monde se reconnecte une fois. C'est prévu."
} else {
    Write-Host "  Le service ne répond pas après une minute." -ForegroundColor Red
    Write-Host "  Regardez :  Get-Service MeridianITPMO"
    Write-Host "              Get-Content C:\Apps\Meridian\logs\*.log -Tail 40"
    exit 1
}

Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
Write-Host ""
