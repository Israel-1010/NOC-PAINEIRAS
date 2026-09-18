# Conexao Active Directory

Esta primeira integracao usa LDAP/LDAPS em modo somente leitura.

## Configuracao

1. Copie `.env.example` para `.env`.
2. Preencha os campos do dominio.
3. Altere `AD_USE_MOCK=false`.
4. Rode `npm run dev`.

Para descobrir os valores no Windows, rode:

```powershell
.\scripts\ad-discovery.ps1
```

O script tenta mostrar:

- Dominio DNS
- `AD_BASE_DN`
- Domain Controllers encontrados
- Teste de porta LDAP `389`
- Teste de porta LDAPS `636`
- Um modelo de `.env`

Exemplo:

```env
PORT=3333
AD_USE_MOCK=false
AD_URL=ldaps://dc01.seudominio.local:636
AD_BASE_DN=DC=seudominio,DC=local
AD_BIND_DN=CN=svc-redeclube,OU=Service Accounts,DC=seudominio,DC=local
AD_BIND_PASSWORD=sua-senha
```

## Como pegar manualmente

No PowerShell de uma maquina no dominio:

```powershell
$root = [ADSI]"LDAP://RootDSE"
$root.defaultNamingContext
```

O resultado vira o `AD_BASE_DN`, por exemplo:

```env
AD_BASE_DN=DC=empresa,DC=local
```

Para descobrir um Domain Controller:

```powershell
[System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain().DomainControllers
```

Se aparecer `dc01.empresa.local`, o `AD_URL` fica:

```env
AD_URL=ldaps://dc01.empresa.local:636
```

## Endpoints

- `GET /api/ad/status`
- `GET /api/ad/summary`
- `GET /api/ad/users?search=joao`
- `GET /api/ad/computers?search=note`
- `GET /api/ad/groups?search=vpn`
- `GET /api/ad/lockouts`

## Observacoes

- `lockouts` via LDAP mostra contas com `lockoutTime`.
- A origem exata do bloqueio normalmente vem dos eventos dos Domain Controllers, especialmente 4740 e 4625.
- Criar usuario e alterar grupos estao bloqueados de proposito nesta fase. Antes disso precisamos auditoria, permissoes e aprovacao.
