export const mockAdSummary = {
  source: "mock",
  users: {
    total: 741,
    enabled: 728,
    disabled: 13,
    locked: 3,
  },
  computers: {
    total: 512,
    domainJoined: 486,
    inactive30d: 18,
  },
  groups: {
    total: 284,
    sensitive: 4,
  },
};

export const mockUsers = [
  { cn: "Joao Silva", samAccountName: "j.silva", mail: "j.silva@redeclube.local", department: "Financeiro", enabled: true, locked: true },
  { cn: "Maria Costa", samAccountName: "m.costa", mail: "m.costa@redeclube.local", department: "Atendimento", enabled: true, locked: true },
  { cn: "Rafael Alves", samAccountName: "r.alves", mail: "r.alves@redeclube.local", department: "Compras", enabled: true, locked: true },
  { cn: "Ana Pereira", samAccountName: "a.pereira", mail: "a.pereira@redeclube.local", department: "RH", enabled: true, locked: false },
];

export const mockComputers = [
  { cn: "NOTE-FIN-022", dNSHostName: "NOTE-FIN-022.redeclube.local", operatingSystem: "Windows 11 Pro", lastLogonTimestamp: "Hoje 15:55" },
  { cn: "DESK-COM-014", dNSHostName: "DESK-COM-014.redeclube.local", operatingSystem: "Windows 10 Pro", lastLogonTimestamp: "Hoje 14:21" },
  { cn: "SRV-AD-01", dNSHostName: "SRV-AD-01.redeclube.local", operatingSystem: "Windows Server 2022", lastLogonTimestamp: "Agora" },
];

export const mockGroups = [
  { cn: "GG-Financeiro-Sistema", description: "Acesso ao sistema financeiro", memberCount: 42 },
  { cn: "GG-VPN-Usuarios", description: "Usuarios permitidos na VPN", memberCount: 186 },
  { cn: "GG-WiFi-Corporativo", description: "Acesso Wi-Fi corporativo", memberCount: 612 },
  { cn: "GG-ERP-Administradores", description: "Administradores do ERP", memberCount: 9 },
];

export const mockLockouts = [
  {
    user: "j.silva",
    cn: "Joao Silva",
    department: "Financeiro",
    lockoutTime: "Hoje 16:14",
    source: "mock",
  },
  {
    user: "m.costa",
    cn: "Maria Costa",
    department: "Atendimento",
    lockoutTime: "Hoje 16:09",
    source: "mock",
  },
  {
    user: "r.alves",
    cn: "Rafael Alves",
    department: "Compras",
    lockoutTime: "Hoje 15:58",
    source: "mock",
  },
];
