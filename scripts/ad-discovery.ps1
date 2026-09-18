param(
  [string]$BindUser = ""
)

$ErrorActionPreference = "Stop"

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host "== $Title ==" -ForegroundColor Cyan
}

function Convert-DnsDomainToBaseDn {
  param([string]$DomainName)
  return (($DomainName -split "\.") | ForEach-Object { "DC=$_" }) -join ","
}

Write-Section "Dominio local"

$domainDns = $env:USERDNSDOMAIN
if (-not $domainDns) {
  try {
    $domainDns = ([System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()).Name
  } catch {
    $domainDns = ""
  }
}

if ($domainDns) {
  Write-Host "Dominio DNS: $domainDns"
  Write-Host "Base DN sugerido: $(Convert-DnsDomainToBaseDn $domainDns)"
} else {
  Write-Host "Nao consegui detectar dominio automaticamente."
}

Write-Section "RootDSE"
try {
  $root = [ADSI]"LDAP://RootDSE"
  Write-Host "defaultNamingContext: $($root.defaultNamingContext)"
  Write-Host "configurationNamingContext: $($root.configurationNamingContext)"
  Write-Host "schemaNamingContext: $($root.schemaNamingContext)"
  Write-Host "dnsHostName: $($root.dnsHostName)"
} catch {
  Write-Host "Falha ao consultar LDAP://RootDSE: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Section "Domain Controllers"
try {
  $domain = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
  foreach ($dc in $domain.DomainControllers) {
    Write-Host "DC: $($dc.Name)"
    $ldap389 = Test-NetConnection -ComputerName $dc.Name -Port 389 -InformationLevel Quiet
    $ldaps636 = Test-NetConnection -ComputerName $dc.Name -Port 636 -InformationLevel Quiet
    Write-Host "  LDAP 389: $ldap389"
    Write-Host "  LDAPS 636: $ldaps636"
  }
} catch {
  Write-Host "Falha ao listar DCs: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Section "Usuario atual"
try {
  Write-Host "whoami: $(whoami)"
  Write-Host "UPN: $env:USERDNSDOMAIN\$env:USERNAME"
} catch {
  Write-Host "Falha ao ler usuario atual: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Section "Modelo para .env"
$baseDn = ""
try {
  $baseDn = ([ADSI]"LDAP://RootDSE").defaultNamingContext
} catch {
  if ($domainDns) {
    $baseDn = Convert-DnsDomainToBaseDn $domainDns
  }
}

$dcHost = ""
try {
  $dcHost = ([System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()).DomainControllers[0].Name
} catch {
  if ($domainDns) {
    $dcHost = "dc01.$domainDns"
  }
}

$bindDnExample = $BindUser
if (-not $bindDnExample -and $baseDn) {
  $bindDnExample = "CN=svc-redeclube,OU=Service Accounts,$baseDn"
}

Write-Host "PORT=3333"
Write-Host "AD_USE_MOCK=false"
Write-Host "AD_URL=ldaps://$dcHost`:636"
Write-Host "AD_BASE_DN=$baseDn"
Write-Host "AD_BIND_DN=$bindDnExample"
Write-Host "AD_BIND_PASSWORD=coloque-a-senha-aqui"
