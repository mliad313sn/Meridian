<#
    Meridian IT-PMO — prérequis de base de données.

    Appelé par setup.cmd, en élévation, avant l'enregistrement du service.
    Son travail : garantir qu'au sortir de l'installation, Meridian a une
    base à lui, avec un mot de passe que personne n'a choisi à sa place.

    Trois chemins, dans cet ordre :

      1. Un PostgreSQL utilisable existe déjà → on s'en sert.
      2. Aucun, mais Internet répond → on télécharge les binaires
         officiels, on initialise une instance qui appartient à Meridian,
         et on l'enregistre comme service.
      3. Ni l'un ni l'autre → PGlite. L'application FONCTIONNE (même SQL,
         PostgreSQL compilé en WebAssembly), et le dit franchement : mieux
         vaut un outil qui démarre et annonce sa limite qu'un installateur
         qui échoue à mi-chemin.

    Ce script ne rend jamais la main sur un échec silencieux : il écrit ce
    qu'il a fait dans meridian.config.json, et l'affiche.

    Node n'est pas un prérequis : Meridian.exe embarque son propre
    interpréteur (Node SEA). Il n'y a donc rien à installer de ce côté.
#>

param(
  [string]$Target = "C:\Apps\Meridian",
  [string]$DbName = "meridian_standalone",
  [string]$DbUser = "meridian",
  [switch]$NoDownload,
  [string]$PgVersion = "17.6-1",
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"
function Say($m) { Write-Host "  $m" }
function Warn($m) { Write-Host "  ! $m" -ForegroundColor Yellow }

# ── un mot de passe que personne n'a choisi ────────────────────────────
# S-11 : le paquet livrait postgres/postgres, l'identifiant le plus deviné
# du monde, et superutilisateur du cluster entier. Un secret généré ici est
# un secret que personne n'a eu à inventer — ni à oublier de changer.
function New-StrongPassword {
  $bytes = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  # base64 sans les caractères qui cassent une URL de connexion
  return ([Convert]::ToBase64String($bytes) -replace '[+/=]', '') + "aA1"
}

# ── où est psql, si PostgreSQL est là ──────────────────────────────────
function Find-PgBin {
  $svc = Get-CimInstance Win32_Service -Filter "Name LIKE 'postgresql%'" -EA SilentlyContinue |
         Select-Object -First 1
  if ($svc -and $svc.PathName -match '"?([^"]+\\bin)\\pg_ctl\.exe') {
    if (Test-Path (Join-Path $Matches[1] "psql.exe")) { return $Matches[1] }
  }
  foreach ($p in @("$env:ProgramFiles\PostgreSQL\17\bin", "$env:ProgramFiles\PostgreSQL\16\bin",
                   "$Target\pgsql\bin")) {
    if (Test-Path (Join-Path $p "psql.exe")) { return $p }
  }
  $cmd = Get-Command psql -EA SilentlyContinue
  if ($cmd) { return (Split-Path $cmd.Source) }
  return $null
}

function Test-PgResponding {
  try {
    $c = New-Object Net.Sockets.TcpClient
    $ok = $c.ConnectAsync("127.0.0.1", 5432).Wait(3000)
    $c.Close()
    return $ok
  } catch { return $false }
}

# ── chemin 2 : installer PostgreSQL pour Meridian ──────────────────────
function Install-PostgresBinaries {
  $zipUrl = "https://get.enterprisedb.com/postgresql/postgresql-$PgVersion-windows-x64-binaries.zip"
  $zip = Join-Path $env:TEMP "meridian-pgsql.zip"
  Say "aucun PostgreSQL trouvé — téléchargement des binaires officiels (environ 350 Mo)"
  Say "source : $zipUrl"
  try {
    $ProgressPreference = "SilentlyContinue"
    Invoke-WebRequest -Uri $zipUrl -OutFile $zip -UseBasicParsing -TimeoutSec 1800
  } catch {
    Warn "téléchargement impossible : $($_.Exception.Message)"
    return $null
  }
  if (-not (Test-Path $zip)) { return $null }
  Say ("téléchargé : {0:N0} Mo" -f ((Get-Item $zip).Length / 1MB))

  Say "extraction dans $Target\pgsql"
  $tmp = Join-Path $env:TEMP "meridian-pgsql-x"
  Remove-Item $tmp -Recurse -Force -EA SilentlyContinue
  Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
  # l'archive contient un dossier pgsql\ ; on le déplace tel quel
  $src = Join-Path $tmp "pgsql"
  if (-not (Test-Path $src)) { Warn "archive inattendue"; return $null }
  Remove-Item (Join-Path $Target "pgsql") -Recurse -Force -EA SilentlyContinue
  Move-Item $src (Join-Path $Target "pgsql")
  Remove-Item $tmp -Recurse -Force -EA SilentlyContinue
  Remove-Item $zip -Force -EA SilentlyContinue

  $bin = Join-Path $Target "pgsql\bin"
  $data = Join-Path $Target "pgdata"
  $superPw = New-StrongPassword
  $pwFile = Join-Path $env:TEMP "mer-pg-init.txt"
  Set-Content -Path $pwFile -Value $superPw -Encoding ascii -NoNewline

  Say "initialisation de l'instance"
  # -E UTF8 : le livre porte des accents et des noms de sites du monde entier
  & (Join-Path $bin "initdb.exe") -D $data -U postgres -A scram-sha-256 `
      --pwfile=$pwFile -E UTF8 --locale=C | Out-Null
  Remove-Item $pwFile -Force -EA SilentlyContinue
  if (-not (Test-Path (Join-Path $data "PG_VERSION"))) { Warn "initdb a échoué"; return $null }

  # un port à nous si 5432 est pris par autre chose
  $port = if (Test-PgResponding) { 5433 } else { 5432 }
  Add-Content -Path (Join-Path $data "postgresql.conf") -Value @"

# Meridian : cette instance ne sert que l'application, sur cette machine.
listen_addresses = '127.0.0.1'
port = $port
"@

  Say "enregistrement du service MeridianPostgres (port $port)"
  & (Join-Path $bin "pg_ctl.exe") register -N "MeridianPostgres" -D $data -S auto | Out-Null
  Start-Service "MeridianPostgres" -EA SilentlyContinue
  Start-Sleep -Seconds 5
  return @{ Bin = $bin; Port = $port; SuperPw = $superPw; Service = "MeridianPostgres" }
}

# ── création du rôle et de la base ─────────────────────────────────────
function Initialize-MeridianDatabase($bin, $port, $superPw) {
  $psql = Join-Path $bin "psql.exe"
  $appPw = New-StrongPassword
  # trust : « pas de mot de passe » est une réponse valide
  if ($null -eq $superPw) { Remove-Item Env:PGPASSWORD -EA SilentlyContinue } else { $env:PGPASSWORD = $superPw }
  $conn = @("-h", "127.0.0.1", "-p", "$port", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-t")

  # Le rôle porte l'application, pas le cluster : il possède sa base et
  # rien d'autre. Un superutilisateur n'a aucune raison de servir un
  # serveur web.
  $sql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$DbUser') THEN
    CREATE ROLE $DbUser LOGIN PASSWORD '$appPw';
  ELSE
    ALTER ROLE $DbUser LOGIN PASSWORD '$appPw';
  END IF;
END
`$`$;
SELECT 'role ok';
"@
  $sql | & $psql @conn | Out-Null
  if ($LASTEXITCODE -ne 0) { Remove-Item Env:PGPASSWORD -EA SilentlyContinue; return $null }

  $exists = (& $psql @conn -c "SELECT 1 FROM pg_database WHERE datname = '$DbName'") -join ""
  if ($exists.Trim() -ne "1") {
    & $psql @conn -c "CREATE DATABASE $DbName OWNER $DbUser ENCODING 'UTF8'" | Out-Null
  } else {
    & $psql @conn -c "ALTER DATABASE $DbName OWNER TO $DbUser" | Out-Null
  }
  & $psql @conn -c "GRANT ALL PRIVILEGES ON DATABASE $DbName TO $DbUser" | Out-Null

  # Une base qui existait déjà appartient à qui l'a créée, et ses TABLES
  # avec elle : donner les droits sur la base ne donne rien sur ce qu'elle
  # contient. Sans ceci, l'application démarre, se connecte, puis échoue à
  # la première lecture — « permission denied for table schema_migration ».
  # REASSIGN OWNED ne convient pas : PostgreSQL refuse de réassigner ce que
  # le superutilisateur possède au titre du système.
  $own = @"
GRANT ALL ON SCHEMA public TO $DbUser;
DO `$`$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO $DbUser', r.tablename);
  END LOOP;
  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO $DbUser', r.sequencename);
  END LOOP;
  FOR r IN SELECT viewname FROM pg_views WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER VIEW public.%I OWNER TO $DbUser', r.viewname);
  END LOOP;
END
`$`$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DbUser;
"@
  $inDb = @("-h", "127.0.0.1", "-p", "$port", "-U", "postgres", "-d", $DbName, "-q", "-t")
  $own | & $psql @inDb | Out-Null

  Remove-Item Env:PGPASSWORD -EA SilentlyContinue
  return $appPw
}

# ── déroulé ────────────────────────────────────────────────────────────
Say "vérification des prérequis"
Say "  · Node : embarqué dans Meridian.exe, rien à installer"

$bin = Find-PgBin
$port = 5432
$superPw = $null
$haveSuper = $false     # « pas de mot de passe » est une réponse, pas une absence
$installed = $null

if ($bin -and (Test-PgResponding)) {
  Say "PostgreSQL trouvé : $bin"
} elseif (-not $NoDownload) {
  $installed = Install-PostgresBinaries
  if ($installed) {
    $bin = $installed.Bin; $port = $installed.Port
    $superPw = $installed.SuperPw; $haveSuper = $true
  }
} else {
  Warn "aucun PostgreSQL et téléchargement refusé"
}

$dsn = $null
if ($bin) {
  if (-not $haveSuper) {
    # Instance préexistante : on a besoin d'un accès superutilisateur pour
    # créer le rôle. On essaie l'authentification implicite (trust/sspi —
    # le cas le plus courant sur un poste), puis ce que l'ancien paquet
    # posait ; on n'invente jamais un accès qu'on n'aurait pas.
    foreach ($try in @($null, "postgres", $env:PGPASSWORD)) {
      if ($null -eq $try) { Remove-Item Env:\PGPASSWORD -EA SilentlyContinue }
      else { $env:PGPASSWORD = $try }
      $probe = (& (Join-Path $bin "psql.exe") -h 127.0.0.1 -p $port -U postgres -d postgres -t -c "SELECT 1") -join ""
      if ($probe.Trim() -eq "1") { $superPw = $try; $haveSuper = $true; break }
    }
    Remove-Item Env:\PGPASSWORD -EA SilentlyContinue
  }
  if ($haveSuper) {
    $appPw = Initialize-MeridianDatabase $bin $port $superPw
    if ($appPw) {
      $dsn = "postgresql://${DbUser}:${appPw}@127.0.0.1:$port/$DbName"
      Say "base $DbName prête, rôle $DbUser, mot de passe généré"
    } else {
      Warn "la base n'a pas pu être préparée"
    }
  } else {
    Warn "PostgreSQL répond mais son mot de passe superutilisateur est inconnu"
    Warn "créez la base à la main, puis renseignez DATABASE_URL dans meridian.config.json"
  }
}

# ── écriture de la configuration ───────────────────────────────────────
$cfgPath = Join-Path $Target "meridian.config.json"
$cfg = if (Test-Path $cfgPath) { Get-Content $cfgPath -Raw | ConvertFrom-Json } else { [PSCustomObject]@{} }
if (-not $cfg.PORT) { $cfg | Add-Member -NotePropertyName PORT -NotePropertyValue 4173 -Force }
# P-02 : la version du paquet suit la mise à jour, même quand la config
# de l'exploitant est préservée par-dessus.
if ($Version) { $cfg | Add-Member -NotePropertyName MERIDIAN_VERSION -NotePropertyValue $Version -Force }
if (-not $cfg.MERIDIAN_SECURE_COOKIES) {
  $cfg | Add-Member -NotePropertyName MERIDIAN_SECURE_COOKIES -NotePropertyValue "0" -Force
}

if ($dsn) {
  $cfg | Add-Member -NotePropertyName DATABASE_URL -NotePropertyValue $dsn -Force
  Say "configuration : PostgreSQL"
} else {
  # Repli assumé : l'application démarre, sert et enregistre. PGlite est le
  # même moteur compilé en WebAssembly ; ce qui manque, c'est un serveur
  # que d'autres machines pourraient interroger.
  $cfg.PSObject.Properties.Remove("DATABASE_URL")
  $cfg | Add-Member -NotePropertyName PGLITE_DIR -NotePropertyValue (Join-Path $Target "data") -Force
  Warn "configuration : PGlite (base embarquée) — l'application fonctionne."
  Warn "pour passer sur un vrai serveur plus tard : renseignez DATABASE_URL et redémarrez le service."
}

# Sans BOM : JSON.parse le refuse, et une configuration ignorée en
# silence est pire qu'une configuration absente.
[IO.File]::WriteAllText($cfgPath, ($cfg | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding $false))
Say "configuration écrite dans $cfgPath"
exit 0
