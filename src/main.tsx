import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  CircleGauge,
  ClipboardList,
  Clock3,
  BookOpen,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  FolderOpen,
  KeyRound,
  LockKeyhole,
  LogOut,
  Monitor,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  RadioTower,
  Router,
  Save,
  Search,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  Signal,
  Table as TableIcon,
  Trash2,
  Tv,
  UserCheck,
  Users,
  Wifi,
  X,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./styles.css";

type Status = "online" | "warning" | "offline";

type Asset = {
  name: string;
  ip: string;
  group: string;
  vendor: "UniFi" | "Fortinet" | "Core" | "ISP";
  status: Status;
  latency: string;
  uptime: string;
};

type Lockout = {
  user: string;
  department: string;
  source: string;
  controller: string;
  attempts: number;
  reason: string;
  lastSeen: string;
  ticket: string;
  severity: "Critico" | "Atencao" | "Info";
};

type AdGroup = {
  name: string;
  members: number;
  owner: string;
  risk: "Baixo" | "Medio" | "Alto";
  lastChange: string;
};

type AccessRequest = {
  user: string;
  action: "Criar usuario" | "Adicionar grupo" | "Remover grupo";
  target: string;
  requestedBy: string;
  status: "Pendente" | "Aprovado" | "Executando";
};

type AdSummary = {
  source: string;
  users: {
    total: number;
    enabled: number;
    disabled: number;
    locked: number;
  };
  computers: {
    total: number;
    domainJoined: number;
    inactive30d: number;
  };
  groups: {
    total: number;
    sensitive: number;
  };
};

type AdStatus = {
  ok: boolean;
  source: string;
  configured: boolean;
  message: string;
};

type AdUser = {
  cn: string;
  samAccountName: string;
  displayName?: string;
  mail: string;
  department: string;
  title?: string;
  company?: string;
  telephoneNumber?: string;
  mobile?: string;
  office?: string;
  managerDn?: string;
  description?: string;
  employeeID?: string;
  employeeNumber?: string;
  enabled: boolean;
  locked: boolean;
  distinguishedName: string;
};

type AdComputer = {
  cn: string;
  dNSHostName: string;
  operatingSystem: string;
  lastLogonTimestamp: string;
  distinguishedName: string;
};

type ApiAdGroup = {
  cn: string;
  description: string;
  memberCount: number;
  distinguishedName: string;
};

type ApiLockout = {
  user: string;
  cn: string;
  department: string;
  lockoutTime: string;
  distinguishedName: string;
  source: string;
};

type LockoutEvent = {
  domainController: string;
  timeCreated: string;
  targetUser: string;
  targetDomain: string;
  callerComputer: string;
  subjectUser: string;
};

type AdDetails = {
  users: AdUser[];
  computers: AdComputer[];
  groups: ApiAdGroup[];
  lockouts: ApiLockout[];
  lockoutEvents: LockoutEvent[];
  lockoutEventErrors: string[];
};

type UserStandardItem = {
  user: AdUser;
  missingFields: string[];
};

type IntuneStatus = {
  ok: boolean;
  source: string;
  configured: boolean;
  message: string;
};

type IntuneSummary = {
  source: string;
  total: number;
  compliant: number;
  nonCompliant: number;
  unknown: number;
  staleSync: number;
};

type IntuneDevice = {
  id: string;
  deviceName: string;
  userDisplayName: string;
  userPrincipalName: string;
  emailAddress: string;
  operatingSystem: string;
  osVersion: string;
  complianceState: string;
  managementAgent: string;
  managementState: string;
  managedDeviceOwnerType: string;
  deviceEnrollmentType: string;
  deviceCategoryDisplayName: string;
  lastSyncDateTime: string;
  enrolledDateTime: string;
  azureADDeviceId: string;
  azureADRegistered: boolean;
  manufacturer: string;
  model: string;
  serialNumber: string;
  isEncrypted: boolean;
  jailBroken: string;
  wiFiMacAddress: string;
  ethernetMacAddress: string;
  totalStorageSpaceInBytes: number;
  freeStorageSpaceInBytes: number;
  partnerReportedThreatState: string;
};

type IntuneDetails = {
  devices: IntuneDevice[];
};

type IntuneLapsCredential = {
  deviceId: string;
  deviceName: string;
  lastBackupDateTime: string;
  refreshDateTime: string;
  accountName: string;
  accountSid: string;
  backupDateTime: string;
  password: string;
};

type SnmpVersion = "1" | "2c" | "3";

type SnmpDevice = {
  id: string;
  name: string;
  host: string;
  port: number;
  type: "Fortinet" | "UniFi" | "Switch" | "Firewall" | "Servidor" | "Outro";
  version: SnmpVersion;
  community: string;
  username: string;
  authProtocol: "none" | "md5" | "sha";
  authKey: string;
  privProtocol: "none" | "des" | "aes";
  privKey: string;
  timeoutMs: number;
  retries: number;
  enabled: boolean;
  notes: string;
  updatedAt: string;
};

type SnmpMetric = {
  deviceId: string;
  ok: boolean;
  checkedAt: string;
  latencyMs: number | null;
  message: string;
  sysName: string;
  sysDescr: string;
  sysObjectId: string;
  uptime: string;
  contact: string;
  location: string;
  interfaces: number | null;
};

type SnmpDetails = {
  devices: SnmpDevice[];
  metrics: SnmpMetric[];
};

type SnmpSummary = {
  total: number;
  enabled: number;
  online: number;
  offline: number;
};

type WifiKind = "associados" | "colaboradores";

type WifiColumn = {
  name: string;
  type: string;
  nullable: boolean;
  key: string;
  defaultValue: unknown;
  extra: string;
  primary: boolean;
  autoIncrement: boolean;
  writable: boolean;
};

type WifiStatus = {
  ok: boolean;
  configured: boolean;
  database: string;
  message: string;
};

type WifiListPayload = {
  kind: WifiKind;
  database: string;
  table: string;
  columns: WifiColumn[];
  primaryKey: string;
  page: number;
  pageSize: number;
  total: number;
  hasMore?: boolean;
  exactTotal?: boolean;
  items: Array<Record<string, unknown>>;
};

type PopDocument = {
  id: string;
  name: string;
  kind: "folder" | "file";
  webUrl: string;
  size: number;
  extension: string;
  mimeType: string;
  category: string;
  path: string;
  modifiedAt: string;
  modifiedBy: string;
};

type PopPayload = {
  ok: boolean;
  configured: boolean;
  source: string;
  message: string;
  siteName: string;
  driveName: string;
  total: number;
  items: PopDocument[];
};

type TicketsStatus = {
  ok: boolean;
  source: string;
  configured: boolean;
  message: string;
};

type TicketsSummary = {
  source: string;
  total: number;
  open: number;
  pending: number;
  closed: number;
  highPriority: number;
};

type TicketFilter = "open" | "closed" | "all";

type ServiceTicket = {
  id: string;
  code: string;
  title: string;
  description: string;
  requester: string;
  contact: string;
  requesterEmail: string;
  team: string;
  assignee: string;
  category: string;
  subcategory: string;
  priority: string;
  status: string;
  sla: string;
  solution: string;
  tasksTotal: number;
  tasksDone: number;
  createdAt: string;
  updatedAt: string;
};

type TicketsDetails = {
  tickets: ServiceTicket[];
};

type CreateTicketForm = {
  title: string;
  description: string;
  requester: string;
  requesterEmail: string;
  team: string;
  category: string;
  priority: string;
};

type IpInventoryItem = {
  id: string;
  ip: string;
  name: string;
  location: string;
  category: string;
  vlan: string;
  network: string;
  status: "Usado" | "Livre" | "Reservado";
  sourceSheet: string;
  notes: string;
  updatedAt: string;
};

type IpInventoryLink = {
  id: string;
  provider: string;
  type: "Circuito" | "Uso";
  name: string;
  url: string;
  category: string;
  speed: string;
  fortinetIp: string;
  port: string;
  gateway: string;
  mask: string;
  ipCount: string;
  range: string;
  usedIp: string;
  location: string;
  service: string;
  ports: string;
  status: "Ativo" | "Atencao" | "Inativo";
  notes: string;
  updatedAt: string;
};

type IpNetworkSummary = {
  key: string;
  network: string;
  category: string;
  vlan: string;
  sourceSheet: string;
  total: number;
  used: number;
  free: number;
  reserved: number;
};

type InternetLinkGroup = {
  circuit: IpInventoryLink;
  services: IpInventoryLink[];
};

type IpSummary = {
  total: number;
  used: number;
  free: number;
  reserved: number;
  categories: number;
};

type IpDetails = {
  items: IpInventoryItem[];
  categories: string[];
  links: IpInventoryLink[];
};

type TopologyNodeType = "core" | "switch" | "firewall" | "fiber" | "server" | "internet";

type TopologyNode = {
  id: string;
  name: string;
  type: TopologyNodeType;
  ip: string;
  vendor: string;
  network: string;
  imageUrl: string;
  x: number;
  y: number;
};

type TopologyLink = {
  id: string;
  from: string;
  to: string;
  label: string;
  medium: "fibra" | "utp" | "wan" | "trunk";
};

type TopologyNetwork = {
  id: string;
  name: string;
  cidr: string;
  vlan: string;
  gateway: string;
  notes: string;
};

type TopologyState = {
  networks: TopologyNetwork[];
  nodes: TopologyNode[];
  links: TopologyLink[];
};

type TopologyPingResult = {
  ip: string;
  ok: boolean;
  latencyMs: number | null;
  checkedAt: string;
  message: string;
};

type AdUserDetails = {
  source: string;
  profile: {
    cn: string;
    displayName: string;
    samAccountName: string;
    mail: string;
    department: string;
    title: string;
    company: string;
    telephoneNumber: string;
    mobile: string;
    office: string;
    description: string;
    employeeID: string;
    employeeNumber: string;
    manager: { name: string; distinguishedName: string } | null;
    enabled: boolean;
    locked: boolean;
    distinguishedName: string;
  };
  account: {
    userAccountControl: string;
    lockoutTime: string;
    lastLogonTimestamp: string;
    pwdLastSet: string;
    accountExpires: string;
    whenCreated: string;
    whenChanged: string;
  };
  groups: Array<{
    name: string;
    distinguishedName: string;
  }>;
};

type AdComputerDetails = {
  source: string;
  profile: {
    cn: string;
    dNSHostName: string;
    operatingSystem: string;
    operatingSystemVersion: string;
    operatingSystemServicePack: string;
    description: string;
    location: string;
    managedBy: { name: string; distinguishedName: string } | null;
    distinguishedName: string;
  };
  account: {
    userAccountControl: string;
    lastLogonTimestamp: string;
    pwdLastSet: string;
    whenCreated: string;
    whenChanged: string;
  };
  organizationalUnit: {
    name: string;
    distinguishedName: string;
  };
  groups: Array<{
    name: string;
    distinguishedName: string;
  }>;
  servicePrincipalNames: string[];
};

type EditableUserProfile = {
  displayName: string;
  mail: string;
  department: string;
  title: string;
  company: string;
  telephoneNumber: string;
  mobile: string;
  office: string;
  description: string;
  employeeID: string;
  employeeNumber: string;
  managerDn: string;
};

type EditableComputerProfile = {
  description: string;
  location: string;
  managedBy: string;
};

type ResolvedUserIdentity = {
  source: string;
  found: boolean;
  profile: {
    cn: string;
    displayName: string;
    samAccountName: string;
    department: string;
    title: string;
    employeeID: string;
    employeeNumber: string;
    distinguishedName: string;
  };
};

type CreateUserForm = {
  samAccountName: string;
  userPrincipalName: string;
  initialPassword: string;
  enableOnCreate: string;
  displayName: string;
  givenName: string;
  sn: string;
  mail: string;
  webPage: string;
  department: string;
  title: string;
  company: string;
  telephoneNumber: string;
  mobile: string;
  office: string;
  employeeID: string;
  employeeNumber: string;
  managerDn: string;
  targetOu: string;
  groups: string;
  description: string;
  profilePath: string;
  scriptPath: string;
  homeDirectory: string;
  homeDrive: string;
};

type AdOu = {
  ou: string;
  description: string;
  distinguishedName: string;
};

type AdDomainOption = {
  name: string;
  baseDn: string;
};

type AdOuPayload = {
  source: string;
  domains: AdDomainOption[];
  items: AdOu[];
};

type AuthUser = {
  login: string;
  name: string;
  domain: string;
  department: string;
};

type AuthSession = {
  token: string;
  user: AuthUser;
};

function getApiBase() {
  return (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
}

const API_BASE = getApiBase();
const AUTH_STORAGE_KEY = "rede-clube-session";
const AUTH_EXPIRED_EVENT = "rede-clube-auth-expired";
const ACTIVE_VIEW_STORAGE_KEY = "rede-clube-active-view";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "rede-clube-sidebar-collapsed";
const AD_UPN_SUFFIX = "clubepaineiras.com.br";

function getStoredView(): View {
  try {
    const value = window.localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY);
    if (value === "tickets") return "milvusPortal";
    return value === "ad" || value === "tv" || value === "topology" || value === "intune" || value === "milvusPortal" || value === "ips" || value === "snmp" || value === "wifi" || value === "pop" ? value : "tv";
  } catch {
    return "tv";
  }
}

function getStoredSession() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

function getStoredSidebarCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function saveSession(session: AuthSession) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function removeSession() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

function getAuthToken() {
  return getStoredSession()?.token || "";
}

async function authFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const token = getAuthToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }

  return response;
}

const latencyHistory = [
  { time: "08:00", core: 12, unifi: 18, fortinet: 9 },
  { time: "09:00", core: 11, unifi: 21, fortinet: 10 },
  { time: "10:00", core: 15, unifi: 24, fortinet: 11 },
  { time: "11:00", core: 13, unifi: 22, fortinet: 12 },
  { time: "12:00", core: 16, unifi: 29, fortinet: 15 },
  { time: "13:00", core: 14, unifi: 25, fortinet: 12 },
  { time: "14:00", core: 13, unifi: 20, fortinet: 10 },
  { time: "15:00", core: 12, unifi: 19, fortinet: 9 },
];

const wanTraffic = [
  { link: "WAN 1", download: 684, upload: 182, color: "#16a085" },
  { link: "WAN 2", download: 298, upload: 86, color: "#277da1" },
  { link: "Backup", download: 74, upload: 22, color: "#d9902f" },
];

const sites = [
  { name: "Matriz", health: 98, devices: 42, clients: 312, alerts: 1 },
  { name: "Filial Norte", health: 93, devices: 18, clients: 147, alerts: 2 },
  { name: "Filial Sul", health: 88, devices: 21, clients: 164, alerts: 3 },
];

const assets: Asset[] = [
  {
    name: "FortiGate Borda",
    ip: "10.0.0.1",
    group: "Firewall",
    vendor: "Fortinet",
    status: "online",
    latency: "8 ms",
    uptime: "99.99%",
  },
  {
    name: "UDM Controller",
    ip: "10.0.10.2",
    group: "UniFi",
    vendor: "UniFi",
    status: "online",
    latency: "14 ms",
    uptime: "99.94%",
  },
  {
    name: "Switch Core 01",
    ip: "10.0.20.1",
    group: "Core",
    vendor: "UniFi",
    status: "warning",
    latency: "36 ms",
    uptime: "98.72%",
  },
  {
    name: "Link ISP Backup",
    ip: "189.44.10.2",
    group: "WAN",
    vendor: "ISP",
    status: "offline",
    latency: "--",
    uptime: "96.40%",
  },
  {
    name: "Servidor Monitor",
    ip: "10.0.30.8",
    group: "Infra",
    vendor: "Core",
    status: "online",
    latency: "5 ms",
    uptime: "99.97%",
  },
];

const incidents = [
  {
    title: "Conta j.silva bloqueada por senha invalida",
    area: "Active Directory",
    severity: "Critico",
    age: "2 min",
  },
  {
    title: "Link ISP Backup sem resposta",
    area: "WAN",
    severity: "Critico",
    age: "4 min",
  },
  {
    title: "Switch Core 01 com latencia acima do normal",
    area: "UniFi",
    severity: "Atencao",
    age: "13 min",
  },
  {
    title: "Pico de sessoes no FortiGate",
    area: "Fortinet",
    severity: "Info",
    age: "28 min",
  },
];

const adCompliance = [
  { label: "Maquinas no dominio", current: 486, expected: 512, status: "Atencao" },
  { label: "Usuarios com cadastro OK", current: 728, expected: 741, status: "OK" },
  { label: "Usuarios fora do padrao", current: 13, expected: 0, status: "Revisar" },
  { label: "Maquinas inativas 30d", current: 18, expected: 0, status: "Limpar" },
];

const lockouts: Lockout[] = [
  {
    user: "j.silva",
    department: "Financeiro",
    source: "NOTE-FIN-022",
    controller: "DC-MTZ-01",
    attempts: 12,
    reason: "Senha invalida repetida",
    lastSeen: "16:14",
    ticket: "#42822",
    severity: "Critico",
  },
  {
    user: "m.costa",
    department: "Atendimento",
    source: "VPN-FGT-01",
    controller: "DC-MTZ-02",
    attempts: 6,
    reason: "Tentativa via VPN",
    lastSeen: "16:09",
    ticket: "Abrir",
    severity: "Atencao",
  },
  {
    user: "r.alves",
    department: "Compras",
    source: "DESK-COM-014",
    controller: "DC-FIL-SUL",
    attempts: 4,
    reason: "Credencial salva antiga",
    lastSeen: "15:58",
    ticket: "#42817",
    severity: "Info",
  },
];

const adGroups: AdGroup[] = [
  { name: "GG-Financeiro-Sistema", members: 42, owner: "Financeiro", risk: "Medio", lastChange: "Hoje 15:41" },
  { name: "GG-VPN-Usuarios", members: 186, owner: "Seguranca", risk: "Alto", lastChange: "Hoje 14:18" },
  { name: "GG-WiFi-Corporativo", members: 612, owner: "Infra", risk: "Baixo", lastChange: "Ontem 18:22" },
  { name: "GG-ERP-Administradores", members: 9, owner: "Sistemas", risk: "Alto", lastChange: "Ontem 11:04" },
];

const accessRequests: AccessRequest[] = [
  {
    user: "a.pereira",
    action: "Criar usuario",
    target: "OU=Usuarios,OU=Matriz",
    requestedBy: "RH",
    status: "Pendente",
  },
  {
    user: "m.costa",
    action: "Adicionar grupo",
    target: "GG-VPN-Usuarios",
    requestedBy: "Service Desk",
    status: "Aprovado",
  },
  {
    user: "r.alves",
    action: "Remover grupo",
    target: "GG-ERP-Administradores",
    requestedBy: "Seguranca",
    status: "Executando",
  },
];

const ticketQueue = [
  { code: "#42822", title: "Usuario j.silva bloqueado por tentativas invalidas", team: "Seguranca", sla: "11 min", status: "Novo" },
  { code: "#42819", title: "Cadastro AD divergente do RH", team: "Service Desk", sla: "23 min", status: "Novo" },
  { code: "#42813", title: "VPN usuario financeiro sem MFA", team: "Seguranca", sla: "41 min", status: "Em andamento" },
  { code: "#42802", title: "AP Filial Sul oscilando", team: "Redes", sla: "1h 12m", status: "Aguardando" },
];

const callVolume = [
  { hour: "08h", opened: 7, closed: 5 },
  { hour: "09h", opened: 11, closed: 8 },
  { hour: "10h", opened: 16, closed: 12 },
  { hour: "11h", opened: 10, closed: 14 },
  { hour: "12h", opened: 8, closed: 9 },
  { hour: "13h", opened: 13, closed: 10 },
  { hour: "14h", opened: 18, closed: 15 },
  { hour: "15h", opened: 12, closed: 16 },
];

const fallbackAdSummary: AdSummary = {
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

const fallbackAdDetails: AdDetails = {
  users: [],
  computers: [],
  groups: [],
  lockouts: [],
  lockoutEvents: [],
  lockoutEventErrors: [],
};

const fallbackIntuneStatus: IntuneStatus = {
  ok: true,
  source: "mock",
  configured: false,
  message: "Intune aguardando configuracao",
};

const fallbackIntuneSummary: IntuneSummary = {
  source: "mock",
  total: 0,
  compliant: 0,
  nonCompliant: 0,
  unknown: 0,
  staleSync: 0,
};

const fallbackIntuneDetails: IntuneDetails = {
  devices: [],
};

const fallbackSnmpSummary: SnmpSummary = {
  total: 0,
  enabled: 0,
  online: 0,
  offline: 0,
};

const fallbackSnmpDetails: SnmpDetails = {
  devices: [],
  metrics: [],
};

const fallbackTicketsStatus: TicketsStatus = {
  ok: true,
  source: "mock",
  configured: false,
  message: "Milvus aguardando configuracao",
};

const fallbackTicketsSummary: TicketsSummary = {
  source: "mock",
  total: 0,
  open: 0,
  pending: 0,
  closed: 0,
  highPriority: 0,
};

const fallbackTicketsDetails: TicketsDetails = {
  tickets: [],
};

const fallbackIpSummary: IpSummary = {
  total: 0,
  used: 0,
  free: 0,
  reserved: 0,
  categories: 0,
};

const fallbackIpDetails: IpDetails = {
  items: [],
  categories: [],
  links: [],
};

const fallbackTopology: TopologyState = {
  networks: [
    { id: "net-mgmt", name: "Gerencia UniFi", cidr: "192.168.9.0/24", vlan: "9", gateway: "192.168.9.1", notes: "Rede inicial para catracas/trielo e switches UniFi." },
    { id: "net-core", name: "Core / Servidores", cidr: "10.200.1.0/24", vlan: "1", gateway: "10.200.1.1", notes: "Backbone principal." },
  ],
  nodes: [
    { id: "node-internet", name: "Internet", type: "internet", ip: "", vendor: "ISP", network: "WAN", imageUrl: "", x: 50, y: 12 },
    { id: "node-fortinet", name: "Fortinet", type: "firewall", ip: "10.200.1.1", vendor: "Fortinet", network: "Core / Servidores", imageUrl: "", x: 50, y: 30 },
    { id: "node-core", name: "Core", type: "core", ip: "10.200.1.2", vendor: "Core", network: "Core / Servidores", imageUrl: "", x: 50, y: 50 },
    { id: "node-unifi", name: "UniFi Switch", type: "switch", ip: "192.168.9.2", vendor: "UniFi", network: "Gerencia UniFi", imageUrl: "", x: 28, y: 70 },
    { id: "node-fiber", name: "Fibra CFTV", type: "fiber", ip: "", vendor: "Fibra", network: "Backbone", imageUrl: "", x: 72, y: 70 },
  ],
  links: [
    { id: "link-internet-fw", from: "node-internet", to: "node-fortinet", label: "WAN", medium: "wan" },
    { id: "link-fw-core", from: "node-fortinet", to: "node-core", label: "LAN", medium: "trunk" },
    { id: "link-core-unifi", from: "node-core", to: "node-unifi", label: "Trunk UniFi", medium: "utp" },
    { id: "link-core-fiber", from: "node-core", to: "node-fiber", label: "Fibra", medium: "fibra" },
  ],
};

const pageSize = 3;

const requiredUserProfileFields: Array<{ field: keyof EditableUserProfile; label: string }> = [
  { field: "displayName", label: "Nome exibido" },
  { field: "mail", label: "E-mail" },
  { field: "department", label: "Departamento" },
  { field: "title", label: "Cargo" },
  { field: "company", label: "Empresa" },
  { field: "office", label: "Escritorio" },
  { field: "managerDn", label: "Responsavel" },
  { field: "description", label: "Descricao" },
];

const requiredCreateUserFields: Array<{ field: keyof CreateUserForm; label: string }> = [
  { field: "samAccountName", label: "Registro/Login" },
  { field: "displayName", label: "Nome exibido" },
  { field: "givenName", label: "Nome" },
  { field: "sn", label: "Sobrenome" },
  { field: "mail", label: "E-mail" },
  { field: "department", label: "Departamento" },
  { field: "title", label: "Cargo" },
  { field: "company", label: "Empresa" },
  { field: "office", label: "Escritorio" },
  { field: "managerDn", label: "Responsavel" },
  { field: "targetOu", label: "OU destino" },
  { field: "description", label: "Descricao" },
];

const navItems = [
  { label: "TV Geral", icon: Tv, view: "tv" },
  { label: "Topologia", icon: Network, view: "topology" },
  { label: "Ativos", icon: Server },
  { label: "AD", icon: Users, view: "ad" },
  { label: "IPs", icon: Network, view: "ips" },
  { label: "SNMP", icon: Signal, view: "snmp" },
  { label: "Intune", icon: ShieldCheck, view: "intune" },
  { label: "Bloqueios", icon: LockKeyhole },
  { label: "Chamado Milvus", icon: ClipboardList, view: "milvusPortal" },
  { label: "WiFi", icon: Wifi, view: "wifi" },
  { label: "POP", icon: BookOpen, view: "pop" },
  { label: "Fortinet", icon: Shield },
  { label: "Alertas", icon: Bell },
  { label: "Ajustes", icon: Settings },
];

type View = "tv" | "topology" | "ad" | "intune" | "tickets" | "milvusPortal" | "ips" | "snmp" | "wifi" | "pop";

function statusLabel(status: Status) {
  return {
    online: "Online",
    warning: "Atencao",
    offline: "Offline",
  }[status];
}

function viewEyebrow(view: View) {
  if (view === "tv") return "Operacao de TI ao vivo";
  if (view === "intune") return "Gerenciamento de dispositivos";
  if (view === "tickets") return "Atendimento e SLA";
  if (view === "milvusPortal") return "Portal oficial";
  if (view === "ips") return "Inventario de rede";
  if (view === "snmp") return "Monitoramento de equipamentos";
  if (view === "wifi") return "Portal WiFi";
  if (view === "pop") return "Procedimento operacional padrao";
  if (view === "topology") return "Mapa e monitoramento";
  return "Administracao de identidade";
}

function viewTitle(view: View) {
  if (view === "tv") return "Painel da TV";
  if (view === "intune") return "Microsoft Intune";
  if (view === "tickets") return "Chamados Milvus";
  if (view === "milvusPortal") return "Chamado Milvus";
  if (view === "ips") return "IPs";
  if (view === "snmp") return "SNMP";
  if (view === "wifi") return "WiFi";
  if (view === "pop") return "POP";
  if (view === "topology") return "Topologia";
  return "Active Directory";
}

async function parseApiPayload<T>(response: Response, fallback: T) {
  try {
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

function App() {
  const [activeView, setActiveView] = useState<View>(() => getStoredView());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => getStoredSidebarCollapsed());
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [adSummaryState, setAdSummaryState] = useState<AdSummary>(fallbackAdSummary);
  const [adDetails, setAdDetails] = useState<AdDetails>(fallbackAdDetails);
  const [adStatus, setAdStatus] = useState<AdStatus>({
    ok: true,
    source: "mock",
    configured: false,
    message: "Aguardando API AD",
  });
  const [intuneStatus, setIntuneStatus] = useState<IntuneStatus>(fallbackIntuneStatus);
  const [intuneSummary, setIntuneSummary] = useState<IntuneSummary>(fallbackIntuneSummary);
  const [intuneDetails, setIntuneDetails] = useState<IntuneDetails>(fallbackIntuneDetails);
  const [snmpSummary, setSnmpSummary] = useState<SnmpSummary>(fallbackSnmpSummary);
  const [snmpDetails, setSnmpDetails] = useState<SnmpDetails>(fallbackSnmpDetails);
  const [ticketsStatus, setTicketsStatus] = useState<TicketsStatus>(fallbackTicketsStatus);
  const [ticketsSummary, setTicketsSummary] = useState<TicketsSummary>(fallbackTicketsSummary);
  const [ticketsDetails, setTicketsDetails] = useState<TicketsDetails>(fallbackTicketsDetails);
  const [ipSummary, setIpSummary] = useState<IpSummary>(fallbackIpSummary);
  const [ipDetails, setIpDetails] = useState<IpDetails>(fallbackIpDetails);
  const [topology, setTopology] = useState<TopologyState>(fallbackTopology);
  const [topologyLoaded, setTopologyLoaded] = useState(false);
  const [topologySaveStatus, setTopologySaveStatus] = useState("Aguardando arquivo");
  const skipNextTopologySaveRef = useRef(false);
  const topologySaveTimerRef = useRef<number | null>(null);

  const clearSession = useCallback(() => {
    removeSession();
    setSession(null);
    setAdSummaryState(fallbackAdSummary);
    setAdDetails(fallbackAdDetails);
    setIntuneStatus(fallbackIntuneStatus);
    setIntuneSummary(fallbackIntuneSummary);
    setIntuneDetails(fallbackIntuneDetails);
    setSnmpSummary(fallbackSnmpSummary);
    setSnmpDetails(fallbackSnmpDetails);
    setTicketsStatus(fallbackTicketsStatus);
    setTicketsSummary(fallbackTicketsSummary);
    setTicketsDetails(fallbackTicketsDetails);
    setIpSummary(fallbackIpSummary);
    setIpDetails(fallbackIpDetails);
    setTopology(fallbackTopology);
    setTopologyLoaded(false);
    setTopologySaveStatus("Aguardando arquivo");
  }, []);

  const handleLogin = useCallback((nextSession: AuthSession) => {
    saveSession(nextSession);
    setSession(nextSession);
  }, []);

  const loadAd = useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      const statusResponse = await authFetch("/api/ad/status");

      if (statusResponse.status === 401) {
        clearSession();
        return;
      }

      const statusPayload = await parseApiPayload<Partial<AdStatus>>(statusResponse, {});

      setAdStatus(
        statusResponse.ok
          ? (statusPayload as AdStatus)
          : {
              ok: false,
              source: "ldap",
              configured: true,
              message: statusPayload.message || `API AD retornou erro ${statusResponse.status}.`,
            },
      );

      const summaryTask = authFetch("/api/ad/summary").then(async (summaryResponse) => {
        if (summaryResponse.ok) {
          setAdSummaryState(await summaryResponse.json());
        }
      });

      const directoryTask = Promise.all([
        authFetch("/api/ad/users?limit=1000"),
        authFetch("/api/ad/computers?limit=1000"),
        authFetch("/api/ad/groups?limit=1000"),
        authFetch("/api/ad/lockouts?limit=1000"),
      ]).then(async ([usersResponse, computersResponse, groupsResponse, lockoutsResponse]) => {
        const [usersPayload, computersPayload, groupsPayload, lockoutsPayload] = await Promise.all([
          usersResponse.ok ? usersResponse.json() : Promise.resolve({ items: [] }),
          computersResponse.ok ? computersResponse.json() : Promise.resolve({ items: [] }),
          groupsResponse.ok ? groupsResponse.json() : Promise.resolve({ items: [] }),
          lockoutsResponse.ok ? lockoutsResponse.json() : Promise.resolve({ items: [] }),
        ]);

        setAdDetails((current) => ({
          ...current,
          users: usersPayload.items || [],
          computers: computersPayload.items || [],
          groups: groupsPayload.items || [],
          lockouts: lockoutsPayload.items || [],
        }));
      });

      const eventTask = authFetch("/api/ad/lockout-events?hours=24").then(async (lockoutEventsResponse) => {
        const lockoutEventsPayload = lockoutEventsResponse.ok
          ? await lockoutEventsResponse.json()
          : { items: [], errors: [] };

        setAdDetails((current) => ({
          ...current,
          lockoutEvents: lockoutEventsPayload.items || [],
          lockoutEventErrors: lockoutEventsPayload.errors || [],
        }));
      });

      await Promise.allSettled([
        summaryTask,
        directoryTask,
        eventTask,
      ]);
    } catch {
      setAdStatus({
        ok: false,
        source: "offline",
        configured: false,
        message: "API AD offline. Exibindo dados mockados.",
      });
    }
  }, [clearSession, session]);

  const loadIps = useCallback(async () => {
    if (!session) return;

    try {
      const [summaryResponse, listResponse] = await Promise.all([
        authFetch("/api/ips/summary"),
        authFetch("/api/ips"),
      ]);

      if (summaryResponse.status === 401 || listResponse.status === 401) {
        clearSession();
        return;
      }

      if (summaryResponse.ok) {
        setIpSummary(await summaryResponse.json());
      }

      if (listResponse.ok) {
        const payload = await listResponse.json();
        setIpDetails({ items: payload.items || [], categories: payload.categories || [], links: payload.links || [] });
      }
    } catch {
      setIpSummary(fallbackIpSummary);
      setIpDetails(fallbackIpDetails);
    }
  }, [clearSession, session]);

  const loadTopology = useCallback(async () => {
    if (!session) return;

    try {
      const response = await authFetch("/api/topology");

      if (response.status === 401) {
        clearSession();
        return;
      }

      const payload = await parseApiPayload<{ topology?: TopologyState; message?: string }>(response, {});

      if (!response.ok || !payload.topology) {
        throw new Error(payload.message || "Nao foi possivel carregar a topologia.");
      }

      skipNextTopologySaveRef.current = true;
      setTopology(payload.topology);
      setTopologyLoaded(true);
      setTopologySaveStatus("Carregado do arquivo");
    } catch (error) {
      setTopologyLoaded(false);
      setTopologySaveStatus(error instanceof Error ? error.message : "Erro ao carregar arquivo");
    }
  }, [clearSession, session]);

  const loadTickets = useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      const statusResponse = await authFetch("/api/tickets/status");

      if (statusResponse.status === 401) {
        clearSession();
        return;
      }

      const statusPayload = await parseApiPayload<Partial<TicketsStatus>>(statusResponse, {});
      setTicketsStatus(
        statusResponse.ok
          ? (statusPayload as TicketsStatus)
          : {
              ok: false,
              source: "milvus",
              configured: true,
              message: statusPayload.message || `API Milvus retornou erro ${statusResponse.status}.`,
            },
      );

      const [summaryResponse, ticketsResponse] = await Promise.all([
        authFetch("/api/tickets/summary"),
        authFetch("/api/tickets?limit=500"),
      ]);

      if (summaryResponse.ok) {
        setTicketsSummary(await summaryResponse.json());
      }

      if (ticketsResponse.ok) {
        const payload = await ticketsResponse.json();
        setTicketsDetails({ tickets: payload.items || [] });
      }
    } catch {
      setTicketsStatus({
        ok: false,
        source: "offline",
        configured: false,
        message: "API de chamados offline. Exibindo dados locais.",
      });
    }
  }, [clearSession, session]);

  const loadIntune = useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      const statusResponse = await authFetch("/api/intune/status");

      if (statusResponse.status === 401) {
        clearSession();
        return;
      }

      const statusPayload = await parseApiPayload<Partial<IntuneStatus>>(statusResponse, {});
      setIntuneStatus(
        statusResponse.ok
          ? (statusPayload as IntuneStatus)
          : {
              ok: false,
              source: "graph",
              configured: true,
              message: statusPayload.message || `API Intune retornou erro ${statusResponse.status}.`,
            },
      );

      const [summaryResponse, devicesResponse] = await Promise.all([
        authFetch("/api/intune/summary"),
        authFetch("/api/intune/devices?limit=500"),
      ]);

      if (summaryResponse.ok) {
        setIntuneSummary(await summaryResponse.json());
      } else {
        const payload = await parseApiPayload<{ message?: string }>(summaryResponse, {});
        setIntuneSummary(fallbackIntuneSummary);
        setIntuneStatus({
          ok: false,
          source: "graph",
          configured: statusPayload.configured ?? true,
          message: payload.message || `Resumo Intune retornou erro ${summaryResponse.status}.`,
        });
      }

      if (devicesResponse.ok) {
        const payload = await devicesResponse.json();
        setIntuneDetails({ devices: payload.items || [] });
      } else {
        const payload = await parseApiPayload<{ message?: string }>(devicesResponse, {});
        setIntuneDetails(fallbackIntuneDetails);
        setIntuneStatus({
          ok: false,
          source: "graph",
          configured: statusPayload.configured ?? true,
          message: payload.message || `Dispositivos Intune retornaram erro ${devicesResponse.status}.`,
        });
      }
    } catch (error) {
      setIntuneSummary(fallbackIntuneSummary);
      setIntuneDetails(fallbackIntuneDetails);
      setIntuneStatus({
        ok: false,
        source: "offline",
        configured: false,
        message: error instanceof Error ? error.message : "API Intune offline.",
      });
    }
  }, [clearSession, session]);

  const loadSnmp = useCallback(async () => {
    if (!session) return;

    try {
      const [summaryResponse, listResponse] = await Promise.all([
        authFetch("/api/snmp/summary"),
        authFetch("/api/snmp"),
      ]);

      if (summaryResponse.status === 401 || listResponse.status === 401) {
        clearSession();
        return;
      }

      if (summaryResponse.ok) {
        setSnmpSummary(await summaryResponse.json());
      }

      if (listResponse.ok) {
        const payload = await listResponse.json();
        setSnmpDetails({ devices: payload.devices || [], metrics: payload.metrics || [] });
      }
    } catch {
      setSnmpSummary(fallbackSnmpSummary);
      setSnmpDetails(fallbackSnmpDetails);
    }
  }, [clearSession, session]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    loadAd();
    const interval = window.setInterval(loadAd, 30000);
    return () => window.clearInterval(interval);
  }, [loadAd, session]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    loadIntune();
    const interval = window.setInterval(loadIntune, 60000);
    return () => window.clearInterval(interval);
  }, [loadIntune, session]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    loadSnmp();
    const interval = window.setInterval(loadSnmp, 60000);
    return () => window.clearInterval(interval);
  }, [loadSnmp, session]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    loadTickets();
    const interval = window.setInterval(loadTickets, 30000);
    return () => window.clearInterval(interval);
  }, [loadTickets, session]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    loadIps();
    const interval = window.setInterval(loadIps, 60000);
    return () => window.clearInterval(interval);
  }, [loadIps, session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    loadTopology();
  }, [loadTopology, session]);

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, clearSession);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, clearSession);
  }, [clearSession]);

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, activeView);
  }, [activeView]);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!session || !topologyLoaded) {
      return undefined;
    }

    if (skipNextTopologySaveRef.current) {
      skipNextTopologySaveRef.current = false;
      return undefined;
    }

    setTopologySaveStatus("Salvando no arquivo...");

    if (topologySaveTimerRef.current) {
      window.clearTimeout(topologySaveTimerRef.current);
    }

    topologySaveTimerRef.current = window.setTimeout(async () => {
      try {
        const response = await authFetch("/api/topology", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topology }),
        });
        const payload = await parseApiPayload<{ message?: string }>(response, {});

        if (!response.ok) {
          throw new Error(payload.message || "Nao foi possivel salvar a topologia.");
        }

        setTopologySaveStatus("Salvo no arquivo");
      } catch (error) {
        setTopologySaveStatus(error instanceof Error ? error.message : "Erro ao salvar arquivo");
      }
    }, 250);

    return () => {
      if (topologySaveTimerRef.current) {
        window.clearTimeout(topologySaveTimerRef.current);
      }
    };
  }, [session, topology, topologyLoaded]);

  useEffect(() => {
    if (activeView === "milvusPortal") {
      setSidebarCollapsed(true);
    }
  }, [activeView]);

  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <main className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar" aria-label="Navegacao principal">
        <div className="sidebar-head">
          <div className="brand">
            <div className="brand-mark">
              <Network size={24} strokeWidth={2.2} />
            </div>
            <div>
              <strong>Rede Clube</strong>
              <span>NOC interno</span>
            </div>
          </div>
          <button
            className="sidebar-toggle"
            type="button"
            onClick={() => setSidebarCollapsed((value) => !value)}
            title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.view === activeView || (!item.view && activeView === "tv" && item.label === "TV Geral");
            return (
              <button
                className={`nav-item ${isActive ? "active" : ""}`}
                key={item.label}
                onClick={() => item.view && setActiveView(item.view as View)}
                type="button"
                title={item.label}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-status">
          <span className={`pulse ${adStatus.ok ? "" : "offline"}`} />
          <div>
            <strong>{adStatus.ok ? "Coleta ativa" : "Coleta parcial"}</strong>
            <span>AD {adStatus.source} / 30s</span>
          </div>
        </div>
      </aside>

      <section className={`workspace workspace-${activeView}`}>
        <header className="topbar">
          <div>
            <p className="eyebrow">{viewEyebrow(activeView)}</p>
            <h1>{viewTitle(activeView)}</h1>
          </div>

          <div className="topbar-actions">
            <label className="search-box">
              <Search size={17} />
              <input placeholder="Buscar IP, usuario, maquina ou chamado" />
            </label>
            <button className="icon-button" type="button" title="Notificacoes">
              <Bell size={18} />
            </button>
            <button className="action-button" type="button" onClick={() => setActiveView("milvusPortal")}>
              <Plus size={17} />
              Abrir chamado
            </button>
            <div className="session-chip" title={session.user.domain || session.user.login}>
              <ShieldCheck size={16} />
              <span>{session.user.name || session.user.login}</span>
            </div>
            <button className="icon-button" type="button" title="Sair" onClick={clearSession}>
              <LogOut size={18} />
            </button>
            <button className="select-button" type="button">
              Hoje
              <ChevronDown size={16} />
            </button>
          </div>
        </header>

        {activeView === "tv" ? (
          <TvDashboard adSummary={adSummaryState} adStatus={adStatus} adDetails={adDetails} onRefreshAd={loadAd} />
        ) : activeView === "topology" ? (
          <TopologyDashboard topology={topology} onChange={setTopology} ipDetails={ipDetails} onRefreshIps={loadIps} saveStatus={topologySaveStatus} />
        ) : activeView === "intune" ? (
          <IntuneDashboard intuneStatus={intuneStatus} intuneSummary={intuneSummary} intuneDetails={intuneDetails} onRefreshIntune={loadIntune} />
        ) : activeView === "snmp" ? (
          <SnmpDashboard snmpSummary={snmpSummary} snmpDetails={snmpDetails} onRefreshSnmp={loadSnmp} />
        ) : activeView === "tickets" ? (
          <TicketsDashboard ticketsStatus={ticketsStatus} ticketsSummary={ticketsSummary} ticketsDetails={ticketsDetails} onRefreshTickets={loadTickets} sessionUser={session.user} />
        ) : activeView === "milvusPortal" ? (
          <MilvusPortalView />
        ) : activeView === "ips" ? (
          <IpsDashboard ipSummary={ipSummary} ipDetails={ipDetails} onRefreshIps={loadIps} />
        ) : activeView === "wifi" ? (
          <WifiPortalDashboard />
        ) : activeView === "pop" ? (
          <PopDashboard />
        ) : (
          <AdDashboard adSummary={adSummaryState} adStatus={adStatus} adDetails={adDetails} onRefreshAd={loadAd} />
        )}
      </section>
    </main>
  );
}

function LoginPage({ onLogin }: { onLogin: (session: AuthSession) => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const payload = await parseApiPayload<Partial<AuthSession> & { message?: string }>(response, {});

      if (!response.ok || !payload.token || !payload.user) {
        throw new Error(payload.message || "Registro ou senha invalidos.");
      }

      onLogin({ token: payload.token, user: payload.user });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Nao foi possivel autenticar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-label="Login do portal">
        <div className="login-brand">
          <div className="brand-mark">
            <Network size={26} strokeWidth={2.2} />
          </div>
          <div>
            <strong>Rede Clube</strong>
            <span>Portal protegido</span>
          </div>
        </div>

        <div className="login-heading">
          <p className="eyebrow">Autenticacao AD</p>
          <h1>Entrar no portal</h1>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Registro</span>
            <input
              autoComplete="username"
              autoFocus
              inputMode="text"
              onChange={(event) => setLogin(event.target.value)}
              placeholder="6008"
              value={login}
            />
          </label>

          <label>
            <span>Senha do AD</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sua senha"
              type="password"
              value={password}
            />
          </label>

          {error ? <div className="login-error">{error}</div> : null}

          <button className="login-button" disabled={loading || !login.trim() || !password} type="submit">
            <KeyRound size={18} />
            {loading ? "Validando..." : "Entrar"}
          </button>
        </form>

        <div className="login-domain-strip">
          <span>paineiras.com.br</span>
          <span>clubepaineiras.com.br</span>
        </div>
      </section>

      <aside className="login-status" aria-label="Status">
        <div>
          <ShieldCheck size={22} />
          <span>AD</span>
          <strong>Protegido</strong>
        </div>
        <div>
          <Monitor size={22} />
          <span>TV</span>
          <strong>Dashboard</strong>
        </div>
        <div>
          <LockKeyhole size={22} />
          <span>Sessao</span>
          <strong>8 horas</strong>
        </div>
      </aside>
    </main>
  );
}

function TvDashboard({
  adSummary,
  adStatus,
  adDetails,
  onRefreshAd,
}: {
  adSummary: AdSummary;
  adStatus: AdStatus;
  adDetails: AdDetails;
  onRefreshAd: () => Promise<void>;
}) {
  const activeUsers = adDetails.users.filter((user) => user.enabled);
  const standardIssues = activeUsers
    .map((user) => ({ user, missingFields: missingRequiredUserFields(user) }))
    .filter((item) => item.missingFields.length);
  const standardOk = Math.max(activeUsers.length - standardIssues.length, 0);
  const groupsTotal = adSummary.groups.total || adDetails.groups.length;
  const lockoutEventsTotal = adDetails.lockoutEvents.length;
  const overallTone = !adStatus.ok || adSummary.users.locked ? "danger" : standardIssues.length || adSummary.computers.inactive30d ? "warn" : "good";
  const sourceLabel = adSummary.source === "ldap" ? "AD real" : "Modo mock";

  return (
    <>
      <section className="tv-hero" aria-label="Resumo operacional da TV">
        <div className={`tv-overall ${overallTone}`}>
          <span>Saude do Active Directory</span>
          <strong>{overallTone === "danger" ? "Atencao" : overallTone === "warn" ? "Observando" : "Estavel"}</strong>
          <small>{adStatus.ok ? `${sourceLabel} conectado` : adStatus.message}</small>
        </div>
        <div className="tv-health-strip">
          <HealthTile icon={Users} label="AD" value={adStatus.ok ? "Online" : "Falha"} tone={adStatus.ok ? "good" : "danger"} />
          <HealthTile icon={UserCheck} label="Usuarios" value={`${adSummary.users.enabled}/${adSummary.users.total}`} tone="good" />
          <HealthTile icon={Monitor} label="Maquinas" value={String(adSummary.computers.total)} tone={adSummary.computers.inactive30d ? "warn" : "good"} />
          <HealthTile icon={Users} label="Grupos" value={String(groupsTotal)} tone="good" />
          <HealthTile icon={KeyRound} label="Eventos 4740" value={String(lockoutEventsTotal)} tone={adDetails.lockoutEventErrors.length ? "warn" : "good"} />
        </div>
      </section>

      <section className="tv-metric-grid" aria-label="Indicadores principais">
        <TvMetric icon={LockKeyhole} label="Bloqueios agora" value={String(adSummary.users.locked)} detail={`${adDetails.lockouts.length} em destaque`} tone={adSummary.users.locked ? "danger" : "good"} />
        <TvMetric icon={Monitor} label="Maquinas AD" value={String(adSummary.computers.total)} detail={`${adSummary.computers.domainJoined} no dominio`} tone="good" />
        <TvMetric icon={Users} label="Usuarios ativos" value={String(adSummary.users.enabled)} detail={`${adSummary.users.disabled} desativados`} tone="calm" />
        <TvMetric icon={AlertTriangle} label="Fora do padrao" value={String(standardIssues.length)} detail={`${standardOk} usuarios OK`} tone={standardIssues.length ? "warn" : "good"} />
        <TvMetric icon={Users} label="Grupos AD" value={String(groupsTotal)} detail={`${adSummary.groups.sensitive} sensiveis`} tone={adSummary.groups.sensitive ? "warn" : "good"} />
        <TvMetric icon={KeyRound} label="Eventos 4740" value={String(lockoutEventsTotal)} detail={adDetails.lockoutEventErrors.length ? "coleta parcial" : "ultimas 24h"} tone={adDetails.lockoutEventErrors.length ? "warn" : "calm"} />
      </section>

      <section className="tv-board">
        <article className="panel tv-main-panel">
          <PanelHeader icon={Activity} title="Resumo AD em tempo real" meta={sourceLabel} />
          <TvAdOverviewPanel adSummary={adSummary} adDetails={adDetails} standardIssues={standardIssues.length} />
        </article>

        <article className="panel tv-lockout-panel">
          <PanelHeader icon={KeyRound} title="Bloqueios de senha" meta="AD Security" />
          <LockoutPanel adSummary={adSummary} lockouts={adDetails.lockouts} events={adDetails.lockoutEvents} eventErrors={adDetails.lockoutEventErrors} onRefreshAd={onRefreshAd} />
        </article>

        <article className="panel tv-sites-panel">
          <PanelHeader icon={AlertTriangle} title="Usuarios fora do padrao" meta={`${standardIssues.length} ativos`} />
          <TvStandardUsersPanel items={standardIssues} />
        </article>

        <article className="panel tv-wan-panel">
          <PanelHeader icon={Monitor} title="Maquinas do dominio" meta={`${adDetails.computers.length} carregadas`} />
          <TvComputersPanel computers={adDetails.computers} />
        </article>

        <article className="panel tv-ad-panel">
          <PanelHeader icon={Users} title="AD e cadastro" meta="RH x Inventario" />
          <AdCompliancePanel adSummary={adSummary} />
        </article>

        <article className="panel tv-tickets-panel">
          <PanelHeader icon={Users} title="Grupos do AD" meta={`${adDetails.groups.length} carregados`} />
          <TvGroupsPanel groups={adDetails.groups} />
        </article>

        <article className="panel tv-events-panel">
          <PanelHeader icon={AlertTriangle} title="Eventos recentes" meta="Agora" />
          <TvEventFeed adSummary={adSummary} adDetails={adDetails} />
        </article>

        <article className="panel tv-assets-panel">
          <PanelHeader icon={KeyRound} title="Eventos 4740" meta="Ultimas 24h" />
          <TvLockoutEventsPanel events={adDetails.lockoutEvents} errors={adDetails.lockoutEventErrors} />
        </article>
      </section>
    </>
  );
}

function TopologyDashboard({
  topology,
  onChange,
  ipDetails,
  onRefreshIps,
  saveStatus,
}: {
  topology: TopologyState;
  onChange: React.Dispatch<React.SetStateAction<TopologyState>>;
  ipDetails: IpDetails;
  onRefreshIps: () => Promise<void>;
  saveStatus: string;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [networkForm, setNetworkForm] = useState<TopologyNetwork>(emptyTopologyNetwork());
  const [nodeForm, setNodeForm] = useState<TopologyNode>(emptyTopologyNode());
  const [activePanel, setActivePanel] = useState<"network" | "node" | "editNode" | "inventory" | "monitor" | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkMedium, setLinkMedium] = useState<TopologyLink["medium"]>("fibra");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [draggingNodeId, setDraggingNodeId] = useState("");
  const [pingResults, setPingResults] = useState<Record<string, TopologyPingResult>>({});
  const [pingLoading, setPingLoading] = useState(false);
  const [pingError, setPingError] = useState("");
  const dragStateRef = useRef<{ id: string; x: number; y: number; moved: boolean }>({ id: "", x: 0, y: 0, moved: false });
  const ipByAddress = new Map(ipDetails.items.map((item) => [item.ip, item]));
  const monitoredNodes = topology.nodes.filter((node) => node.ip);
  const onlineNodes = monitoredNodes.filter((node) => topologyNodeStatus(node, ipByAddress, pingResults).tone === "online").length;
  const ipSignature = monitoredNodes.map((node) => node.ip).sort().join("|");

  async function refreshTopologyPing() {
    const ips = monitoredNodes.map((node) => node.ip).filter(Boolean);
    if (!ips.length) return;

    setPingLoading(true);
    setPingError("");

    try {
      const payload = await adRequest<{ items: TopologyPingResult[] }>("/api/topology/ping", {
        method: "POST",
        body: { ips },
      });
      setPingResults(Object.fromEntries((payload.items || []).map((item) => [item.ip, item])));
      await onRefreshIps();
    } catch (error) {
      setPingError(error instanceof Error ? error.message : "Nao foi possivel executar ping.");
    } finally {
      setPingLoading(false);
    }
  }

  useEffect(() => {
    refreshTopologyPing();
    const interval = window.setInterval(refreshTopologyPing, 10000);
    return () => window.clearInterval(interval);
  }, [ipSignature]);

  function addNetwork(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!networkForm.name.trim() || !networkForm.cidr.trim()) return;

    onChange((current) => ({
      ...current,
      networks: [...current.networks, { ...networkForm, id: makeTopologyId("net") }],
    }));
    setNetworkForm(emptyTopologyNetwork());
    setActivePanel(null);
  }

  function addNode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nodeForm.name.trim()) return;

    onChange((current) => ({
      ...current,
      nodes: [...current.nodes, { ...nodeForm, id: makeTopologyId("node") }],
    }));
    setNodeForm(emptyTopologyNode());
    setActivePanel(null);
  }

  function updateNode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nodeForm.id || !nodeForm.name.trim()) return;

    onChange((current) => ({
      ...current,
      nodes: current.nodes.map((node) => node.id === nodeForm.id ? { ...nodeForm } : node),
    }));
    setNodeForm(emptyTopologyNode());
    setActivePanel(null);
  }

  function openNodeEditor(node: TopologyNode) {
    setNodeForm({ ...node });
    setActivePanel("editNode");
  }

  function removeNetwork(id: string) {
    onChange((current) => ({
      ...current,
      networks: current.networks.filter((network) => network.id !== id),
    }));
  }

  function removeNode(id: string) {
    onChange((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => node.id !== id),
      links: current.links.filter((link) => link.from !== id && link.to !== id),
    }));
  }

  function removeLink(id: string) {
    onChange((current) => ({
      ...current,
      links: current.links.filter((link) => link.id !== id),
    }));
  }

  function updateNodePosition(nodeId: string, clientX: number, clientY: number) {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.max(4, Math.min(96, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100));

    onChange((current) => ({
      ...current,
      nodes: current.nodes.map((node) => node.id === nodeId ? { ...node, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 } : node),
    }));
  }

  function handleNodeClick(node: TopologyNode) {
    if (!linkMode) {
      if (!dragStateRef.current.moved) {
        openNodeEditor(node);
      }
      return;
    }

    if (!selectedNodeId) {
      setSelectedNodeId(node.id);
      return;
    }

    if (selectedNodeId === node.id) {
      setSelectedNodeId("");
      return;
    }

    const fromNode = topology.nodes.find((item) => item.id === selectedNodeId);
    const label = linkMedium === "fibra" ? "Fibra" : linkMedium === "wan" ? "WAN" : linkMedium === "utp" ? "Cabo de rede" : "Trunk";

    onChange((current) => ({
      ...current,
      links: [
        ...current.links,
        {
          id: makeTopologyId("link"),
          from: selectedNodeId,
          to: node.id,
          label: fromNode ? `${label}: ${fromNode.name} / ${node.name}` : label,
          medium: linkMedium,
        },
      ],
    }));
    setSelectedNodeId("");
  }

  function handleNodePointerDown(event: React.PointerEvent<HTMLButtonElement>, node: TopologyNode) {
    if (linkMode) return;
    setDraggingNodeId(node.id);
    dragStateRef.current = { id: node.id, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleNodePointerMove(event: React.PointerEvent<HTMLButtonElement>, node: TopologyNode) {
    if (draggingNodeId !== node.id || linkMode) return;
    const dragState = dragStateRef.current;
    if (Math.abs(event.clientX - dragState.x) > 4 || Math.abs(event.clientY - dragState.y) > 4) {
      dragStateRef.current = { ...dragState, moved: true };
    }
    updateNodePosition(node.id, event.clientX, event.clientY);
  }

  function handleNodePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    if (draggingNodeId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDraggingNodeId("");
  }

  return (
    <section className="topology-page topology-canvas-page">
      <div className="topology-toolbar">
        <div className="topology-toolbar-title">
          <p className="eyebrow">Mapa e monitoramento</p>
          <h1>Topologia</h1>
        </div>
        <div className="topology-toolbar-actions">
          <div className="topology-toolbar-group">
            <button className="primary-action" type="button" onClick={() => {
              setNodeForm(emptyTopologyNode());
              setActivePanel("node");
            }}>
              <Plus size={16} />
              Equipamento
            </button>
            <button className="secondary-action" type="button" onClick={() => setActivePanel("network")}>
              <Network size={16} />
              Rede
            </button>
            <button className={linkMode ? "primary-action" : "secondary-action"} type="button" onClick={() => {
              setLinkMode((value) => !value);
              setSelectedNodeId("");
            }}>
              <Zap size={16} />
              Ligar
            </button>
            <select className="topology-medium-select" value={linkMedium} onChange={(event) => setLinkMedium(event.target.value as TopologyLink["medium"])} disabled={!linkMode}>
              <option value="fibra">Fibra</option>
              <option value="utp">Cabo de rede</option>
              <option value="trunk">Trunk</option>
              <option value="wan">WAN</option>
            </select>
          </div>
          <div className="topology-toolbar-group">
            <span className="topology-live-pill">{onlineNodes}/{monitoredNodes.length} online</span>
            <span className="topology-save-pill">{saveStatus}</span>
            {pingError ? <span className="topology-error-pill">{pingError}</span> : null}
            <button className="secondary-action" type="button" onClick={refreshTopologyPing} disabled={pingLoading}>
              <RefreshCw size={16} />
              {pingLoading ? "Pingando" : "Ping agora"}
            </button>
            <button className="secondary-action" type="button" onClick={() => setActivePanel("monitor")}>
              <Activity size={16} />
              Monitor
            </button>
            <button className="secondary-action" type="button" onClick={() => setActivePanel("inventory")}>
              <Server size={16} />
              Inventario
            </button>
          </div>
        </div>
      </div>

      <div className={`topology-map topology-map-full ${linkMode ? "link-mode" : ""}`} ref={mapRef} aria-label="Mapa visual da topologia">
        <svg className="topology-links" viewBox="0 0 100 100" preserveAspectRatio="none">
          {topology.links.map((link) => {
            const from = topology.nodes.find((node) => node.id === link.from);
            const to = topology.nodes.find((node) => node.id === link.to);
            if (!from || !to) return null;
            const linkStatus = topologyLinkStatus(from, to, ipByAddress, pingResults);
            return <line key={link.id} className={`topology-line ${link.medium} ${linkStatus}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
          })}
          {topology.links.map((link) => {
            const from = topology.nodes.find((node) => node.id === link.from);
            const to = topology.nodes.find((node) => node.id === link.to);
            if (!from || !to) return null;
            const linkStatus = topologyLinkStatus(from, to, ipByAddress, pingResults);
            if (linkStatus !== "online") return null;

            return (
              <circle className="topology-flow-dot online" key={`${link.id}-flow`} r="0.72">
                <animateMotion dur={link.medium === "fibra" ? "1.8s" : "2.4s"} path={`M ${from.x} ${from.y} L ${to.x} ${to.y}`} repeatCount="indefinite" />
              </circle>
            );
          })}
        </svg>

        {topology.links.map((link) => {
          const from = topology.nodes.find((node) => node.id === link.from);
          const to = topology.nodes.find((node) => node.id === link.to);
          if (!from || !to) return null;
          return (
            <span className={`topology-link-label ${link.medium}`} key={`${link.id}-label`} style={{ left: `${(from.x + to.x) / 2}%`, top: `${(from.y + to.y) / 2}%` }}>
              {link.medium === "utp" ? "Cabo" : link.medium}
            </span>
          );
        })}

        {topology.nodes.map((node) => {
          const status = topologyNodeStatus(node, ipByAddress, pingResults);
          const Icon = topologyNodeIcon(node.type);
          const isSelected = selectedNodeId === node.id;
          return (
            <button
              className={`topology-node ${status.tone} ${isSelected ? "selected" : ""}`}
              key={node.id}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              type="button"
              title={`${node.name} - ${status.label}`}
              onClick={() => handleNodeClick(node)}
              onPointerDown={(event) => handleNodePointerDown(event, node)}
              onPointerMove={(event) => handleNodePointerMove(event, node)}
              onPointerUp={handleNodePointerUp}
            >
              {node.imageUrl ? (
                <span className="topology-node-media">
                  <img alt="" className="topology-node-image" draggable={false} src={node.imageUrl} />
                </span>
              ) : <Icon size={20} />}
              <strong>{node.name}</strong>
              <span>{node.ip || node.vendor}</span>
              <small>{status.label}</small>
            </button>
          );
        })}

        <div className="topology-canvas-hint">
          {linkMode ? (selectedNodeId ? "Clique no destino para concluir a ligacao." : "Clique no equipamento de origem.") : "Arraste para organizar. Clique no equipamento para editar nome, tipo e IP."}
        </div>
      </div>

      {activePanel ? (
        <div className="topology-drawer">
          <header className="modal-header">
            <div>
              <p className="eyebrow">Topologia</p>
              <h2>{activePanel === "node" ? "Adicionar equipamento" : activePanel === "editNode" ? "Editar equipamento" : activePanel === "network" ? "Adicionar rede" : activePanel === "monitor" ? "Monitoramento de IP" : "Inventario"}</h2>
            </div>
            <button className="icon-button" type="button" onClick={() => setActivePanel(null)} aria-label="Fechar painel">
              <X size={18} />
            </button>
          </header>

          {activePanel === "network" ? (
            <form className="topology-form" onSubmit={addNetwork}>
              <label>
                <span>Nome da rede</span>
                <input value={networkForm.name} onChange={(event) => setNetworkForm({ ...networkForm, name: event.target.value })} placeholder="Ex: Catracas Trielo" />
              </label>
              <label>
                <span>Rede / CIDR</span>
                <input value={networkForm.cidr} onChange={(event) => setNetworkForm({ ...networkForm, cidr: event.target.value })} placeholder="192.168.9.0/24" />
              </label>
              <div className="topology-form-grid">
                <label>
                  <span>VLAN</span>
                  <input value={networkForm.vlan} onChange={(event) => setNetworkForm({ ...networkForm, vlan: event.target.value })} placeholder="9" />
                </label>
                <label>
                  <span>Gateway</span>
                  <input value={networkForm.gateway} onChange={(event) => setNetworkForm({ ...networkForm, gateway: event.target.value })} placeholder="192.168.9.1" />
                </label>
              </div>
              <label>
                <span>Observacoes</span>
                <textarea value={networkForm.notes} onChange={(event) => setNetworkForm({ ...networkForm, notes: event.target.value })} placeholder="Detalhes da rede" />
              </label>
              <button className="primary-action" type="submit">
                <Plus size={16} />
                Adicionar rede
              </button>
            </form>
          ) : null}

          {activePanel === "node" || activePanel === "editNode" ? (
            <form className="topology-form" onSubmit={activePanel === "editNode" ? updateNode : addNode}>
              <label>
                <span>Nome do equipamento</span>
                <input value={nodeForm.name} onChange={(event) => setNodeForm({ ...nodeForm, name: event.target.value })} placeholder="Ex: Switch Catracas" />
              </label>
              <div className="topology-form-grid">
                <label>
                  <span>Tipo</span>
                  <select value={nodeForm.type} onChange={(event) => setNodeForm({ ...nodeForm, type: event.target.value as TopologyNodeType })}>
                    <option value="switch">Switch</option>
                    <option value="core">Core</option>
                    <option value="firewall">Firewall</option>
                    <option value="fiber">Fibra</option>
                    <option value="server">Servidor</option>
                    <option value="internet">Internet</option>
                  </select>
                </label>
                <label>
                  <span>Fabricante</span>
                  <input value={nodeForm.vendor} onChange={(event) => setNodeForm({ ...nodeForm, vendor: event.target.value })} placeholder="UniFi, Fortinet..." />
                </label>
              </div>
              <label>
                <span>IP de gerenciamento</span>
                <input value={nodeForm.ip} onChange={(event) => setNodeForm({ ...nodeForm, ip: event.target.value })} placeholder="10.200.1.10" />
              </label>
              <label>
                <span>Imagem do equipamento</span>
                <input value={nodeForm.imageUrl} onChange={(event) => setNodeForm({ ...nodeForm, imageUrl: event.target.value })} placeholder="URL da imagem ou logo" />
              </label>
              <label>
                <span>Rede</span>
                <select value={nodeForm.network} onChange={(event) => setNodeForm({ ...nodeForm, network: event.target.value })}>
                  <option value="">Selecionar rede</option>
                  {topology.networks.map((network) => (
                    <option key={network.id} value={network.name}>{network.name}</option>
                  ))}
                </select>
              </label>
              <button className="primary-action" type="submit">
                <Save size={16} />
                {activePanel === "editNode" ? "Salvar equipamento" : "Adicionar equipamento"}
              </button>
              {activePanel === "editNode" ? (
                <button className="danger-action" type="button" onClick={() => {
                  removeNode(nodeForm.id);
                  setActivePanel(null);
                  setNodeForm(emptyTopologyNode());
                }}>
                  <Trash2 size={16} />
                  Remover equipamento
                </button>
              ) : null}
            </form>
          ) : null}

          {activePanel === "monitor" ? (
            <div className="topology-monitor-list">
              {topology.nodes.filter((node) => node.ip).map((node) => {
                const status = topologyNodeStatus(node, ipByAddress, pingResults);
                const ping = pingResults[node.ip];
                return (
                  <div className={`topology-monitor-row ${status.tone}`} key={node.id}>
                    <div>
                      <strong>{node.name}</strong>
                      <span>{node.ip} - {node.vendor}</span>
                    </div>
                    <small>{ping?.latencyMs !== null && ping?.latencyMs !== undefined ? `${ping.latencyMs} ms` : status.label}</small>
                  </div>
                );
              })}
            </div>
          ) : null}

          {activePanel === "inventory" ? (
            <TopologyInventory topology={topology} onRemoveNetwork={removeNetwork} onRemoveNode={removeNode} onRemoveLink={removeLink} />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function AdDashboard({
  adSummary,
  adStatus,
  adDetails,
  onRefreshAd,
}: {
  adSummary: AdSummary;
  adStatus: AdStatus;
  adDetails: AdDetails;
  onRefreshAd: () => Promise<void>;
}) {
  const [userSearch, setUserSearch] = useState("");
  const [computerSearch, setComputerSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [lockoutSearch, setLockoutSearch] = useState("");
  const [standardSearch, setStandardSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [computerPage, setComputerPage] = useState(1);
  const [groupPage, setGroupPage] = useState(1);
  const [lockoutPage, setLockoutPage] = useState(1);
  const [standardPage, setStandardPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<AdUser | null>(null);
  const [userDetails, setUserDetails] = useState<AdUserDetails | null>(null);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);
  const [userDetailsError, setUserDetailsError] = useState("");
  const [selectedComputer, setSelectedComputer] = useState<AdComputer | null>(null);
  const [computerDetails, setComputerDetails] = useState<AdComputerDetails | null>(null);
  const [computerDetailsLoading, setComputerDetailsLoading] = useState(false);
  const [computerDetailsError, setComputerDetailsError] = useState("");
  const [createUserForm, setCreateUserForm] = useState<CreateUserForm>(emptyCreateUserForm());
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserMessage, setCreateUserMessage] = useState("");
  const [createUserError, setCreateUserError] = useState("");
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [listGroupsOpen, setListGroupsOpen] = useState(false);
  const [standardUsersOpen, setStandardUsersOpen] = useState(false);
  const [adOus, setAdOus] = useState<AdOu[]>([]);
  const [adDomains, setAdDomains] = useState<AdDomainOption[]>([]);
  const [adOusLoading, setAdOusLoading] = useState(false);
  const [adOusError, setAdOusError] = useState("");

  async function openUserDetails(user: AdUser) {
    setSelectedUser(user);
    setUserDetails(null);
    setUserDetailsError("");
    setUserDetailsLoading(true);

    try {
      const response = await authFetch(`/api/ad/users/${encodeURIComponent(user.samAccountName)}/details`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Falha ao carregar usuario.");
      }

      setUserDetails(payload);
    } catch (error) {
      setUserDetailsError(error instanceof Error ? error.message : "Falha ao carregar usuario.");
    } finally {
      setUserDetailsLoading(false);
    }
  }

  function closeUserDetails() {
    setSelectedUser(null);
    setUserDetails(null);
    setUserDetailsError("");
    setUserDetailsLoading(false);
  }

  function updateCreateUserForm(field: keyof CreateUserForm, value: string) {
    setCreateUserForm((current) => {
      const next = { ...current, [field]: value };

      if (field === "samAccountName") {
        const login = value.trim();
        next.userPrincipalName = login ? `${login}@${AD_UPN_SUFFIX}` : "";
      }

      if (field === "givenName" || field === "sn") {
        const currentAutoName = [current.givenName, current.sn].filter(Boolean).join(" ").trim();
        const nextAutoName = [next.givenName, next.sn].filter(Boolean).join(" ").trim();

        if (!current.displayName.trim() || current.displayName.trim() === currentAutoName) {
          next.displayName = nextAutoName;
        }
      }

      return next;
    });
  }

  async function ensureOusLoaded() {
    if (adOus.length) return;

    setAdOusLoading(true);
    setAdOusError("");

    try {
      const response = await authFetch("/api/ad/ous?limit=2000");
      const payload = (await response.json()) as AdOuPayload & { message?: string };

      if (!response.ok) {
        throw new Error(payload.message || "Falha ao carregar OUs.");
      }

      setAdOus(payload.items || []);
      setAdDomains(payload.domains || []);
    } catch (error) {
      setAdOusError(error instanceof Error ? error.message : "Falha ao carregar OUs.");
    } finally {
      setAdOusLoading(false);
    }
  }

  async function openCreateUserModal() {
    setCreateUserOpen(true);
    setCreateUserMessage("");
    setCreateUserError("");
    await ensureOusLoaded();
  }

  function closeCreateUserModal() {
    if (isCreateUserFormDirty(createUserForm) && !window.confirm("Fechar a criacao de usuario? Os dados preenchidos ainda nao foram salvos.")) {
      return;
    }

    setCreateUserOpen(false);
  }

  async function copyUserToCreate(details: AdUserDetails) {
    setCreateUserForm(createUserFormFromDetails(details));
    setCreateUserMessage(`Modelo copiado de ${details.profile.samAccountName}. Preencha os dados unicos do novo usuario.`);
    setCreateUserError("");
    setCreateUserOpen(true);
    closeUserDetails();
    await ensureOusLoaded();
  }

  function openAddGroupModal() {
    setAddGroupOpen(true);
  }

  function closeAddGroupModal() {
    setAddGroupOpen(false);
  }

  function openListGroupsModal() {
    setListGroupsOpen(true);
  }

  function closeListGroupsModal() {
    setListGroupsOpen(false);
  }

  function openStandardUsersModal() {
    setStandardUsersOpen(true);
    setStandardSearch("");
    setStandardPage(1);
  }

  function closeStandardUsersModal() {
    setStandardUsersOpen(false);
  }

  function openStandardUserDetails(user: AdUser) {
    setStandardUsersOpen(false);
    openUserDetails(user);
  }

  async function openComputerDetails(computer: AdComputer) {
    setSelectedComputer(computer);
    setComputerDetails(null);
    setComputerDetailsError("");
    setComputerDetailsLoading(true);

    try {
      const [detailsResponse] = await Promise.all([
        authFetch(`/api/ad/computers/${encodeURIComponent(computer.cn)}/details`),
        ensureOusLoaded(),
      ]);
      const payload = await detailsResponse.json();

      if (!detailsResponse.ok) {
        throw new Error(payload.message || "Falha ao carregar maquina.");
      }

      setComputerDetails(payload);
    } catch (error) {
      setComputerDetailsError(error instanceof Error ? error.message : "Falha ao carregar maquina.");
    } finally {
      setComputerDetailsLoading(false);
    }
  }

  function closeComputerDetails() {
    setSelectedComputer(null);
    setComputerDetails(null);
    setComputerDetailsError("");
    setComputerDetailsLoading(false);
  }

  async function submitCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateUserLoading(true);
    setCreateUserMessage("");
    setCreateUserError("");

    const missingFields = missingRequiredFields(createUserForm, requiredCreateUserFields);
    if (missingFields.length) {
      setCreateUserLoading(false);
      setCreateUserError(`Preencha os campos obrigatorios: ${formatMissingFields(missingFields)}.`);
      return;
    }

    try {
      const payload = {
        ...createUserForm,
        userPrincipalName: createUserForm.samAccountName ? `${createUserForm.samAccountName.trim()}@${AD_UPN_SUFFIX}` : "",
      };
      const created = await adRequest<{ message: string; details?: AdUserDetails }>("/api/ad/users", {
        method: "POST",
        body: payload,
      });
      setCreateUserMessage(created.message || "Usuario criado no AD.");
      setCreateUserForm(emptyCreateUserForm());
      await onRefreshAd();
    } catch (error) {
      setCreateUserError(error instanceof Error ? error.message : "Nao foi possivel criar o usuario.");
    } finally {
      setCreateUserLoading(false);
    }
  }

  const filteredUsers = filterItems(adDetails.users, userSearch, (user) => [
    user.cn,
    user.samAccountName,
    user.displayName,
    user.mail,
    user.department,
    user.title,
    user.company,
    user.distinguishedName,
  ]);
  const activeUsersForStandard = adDetails.users.filter((user) => user.enabled);
  const userStandardItems = activeUsersForStandard
    .map((user) => ({ user, missingFields: missingRequiredUserFields(user) }))
    .filter((item) => item.missingFields.length);
  const standardUsersOk = Math.max(activeUsersForStandard.length - userStandardItems.length, 0);
  const filteredStandardItems = filterItems(userStandardItems, standardSearch, (item) => [
    item.user.cn,
    item.user.samAccountName,
    item.user.displayName,
    item.user.mail,
    item.user.department,
    item.user.title,
    item.user.company,
    item.user.distinguishedName,
    item.missingFields.join(" "),
  ]);
  const filteredComputers = filterItems(adDetails.computers, computerSearch, (computer) => [
    computer.cn,
    computer.dNSHostName,
    computer.operatingSystem,
    computer.distinguishedName,
  ]);
  const filteredGroups = filterItems(adDetails.groups, groupSearch, (group) => [
    group.cn,
    group.description,
    group.distinguishedName,
    String(group.memberCount),
  ]);
  const filteredLockoutEvents = filterItems(adDetails.lockoutEvents, lockoutSearch, (event) => [
    event.targetUser,
    event.callerComputer,
    event.domainController,
    event.subjectUser,
  ]);

  return (
    <>
      {!adStatus.ok ? (
        <section className="ad-alert">
          <AlertTriangle size={20} />
          <div>
            <strong>AD nao esta retornando usuarios</strong>
            <span>{adStatus.message}</span>
          </div>
        </section>
      ) : null}

      <section className="kpi-grid" aria-label="Resumo Active Directory">
        <MetricCard
          icon={Users}
          label="Usuarios ativos"
          value={String(adSummary.users.total)}
          detail={`${adSummary.users.enabled} habilitados`}
          tone="good"
        />
        <MetricCard
          icon={LockKeyhole}
          label="Bloqueios hoje"
          value={String(adSummary.users.locked)}
          detail={adStatus.source === "ldap" ? "LDAP conectado" : "API em mock"}
          tone="danger"
        />
        <MetricCard icon={UserCheck} label="Grupos AD" value={String(adSummary.groups.total)} detail={`${adDetails.groups.length} em destaque`} tone="calm" />
        <MetricCard icon={Monitor} label="Maquinas dominio" value={String(adSummary.computers.total)} detail={`${adDetails.computers.length} em destaque`} tone="warn" />
      </section>

      <section className="dashboard-grid ad-dashboard-grid">
        <article className="panel ad-ops-panel">
          <PanelHeader icon={UserCheck} title="Provisionamento AD" meta="Criacao, grupos e auditoria" />
          <div className="ad-ops-grid">
            <div className="quick-actions" aria-label="Acoes de Active Directory">
              <button type="button" onClick={openCreateUserModal}>
                <Plus size={17} />
                Criar usuario
              </button>
              <button type="button" onClick={openAddGroupModal}>
                <Users size={17} />
                Adicionar em grupo
              </button>
              <button type="button" onClick={openListGroupsModal}>
                <Search size={17} />
                Listar grupos
              </button>
            </div>
          </div>
        </article>

        <article className="panel ad-users-panel">
          <PanelHeader
            icon={Users}
            title="Usuarios do AD"
            meta={`${filteredUsers.length}/${adDetails.users.length} registros`}
            action={
              <div className="standard-header-actions">
                <span className="standard-counter ok">{standardUsersOk} OK</span>
                <button type="button" className="standard-counter warn" onClick={openStandardUsersModal}>
                  {userStandardItems.length} ativos fora do padrao
                </button>
              </div>
            }
          />
          <DirectoryTools
            value={userSearch}
            onChange={(value) => {
              setUserSearch(value);
              setUserPage(1);
            }}
            page={userPage}
            total={filteredUsers.length}
            onPageChange={setUserPage}
            placeholder="Procurar usuario, e-mail, setor ou OU"
          />
          <AdUsersList users={paginate(filteredUsers, userPage)} onSelect={openUserDetails} />
        </article>

        <article className="panel ad-lockouts-panel">
          <PanelHeader icon={KeyRound} title="Bloqueios de senha" meta="AD Security" />
          <LockoutPanel
            adSummary={adSummary}
            lockouts={adDetails.lockouts}
            events={paginate(filteredLockoutEvents, lockoutPage)}
            allEvents={adDetails.lockoutEvents}
            eventErrors={adDetails.lockoutEventErrors}
            search={lockoutSearch}
            onSearchChange={(value) => {
              setLockoutSearch(value);
              setLockoutPage(1);
            }}
            page={lockoutPage}
            totalEvents={filteredLockoutEvents.length}
            onPageChange={setLockoutPage}
            onRefreshAd={onRefreshAd}
          />
        </article>

        <article className="panel ad-computers-panel">
          <PanelHeader icon={Monitor} title="Maquinas do dominio" meta={`${filteredComputers.length}/${adDetails.computers.length} registros`} />
          <DirectoryTools
            value={computerSearch}
            onChange={(value) => {
              setComputerSearch(value);
              setComputerPage(1);
            }}
            page={computerPage}
            total={filteredComputers.length}
            onPageChange={setComputerPage}
            placeholder="Procurar maquina, DNS, SO ou OU"
          />
          <AdComputersList computers={paginate(filteredComputers, computerPage)} onSelect={openComputerDetails} />
        </article>

        <article className="panel ad-groups-panel">
          <PanelHeader icon={Users} title="Grupos do AD" meta={`${adSummary.groups.total} grupos`} />
          <DirectoryTools
            value={groupSearch}
            onChange={(value) => {
              setGroupSearch(value);
              setGroupPage(1);
            }}
            page={groupPage}
            total={filteredGroups.length}
            onPageChange={setGroupPage}
            placeholder="Procurar grupo, descricao, membros ou OU"
          />
          <AdGroupsList groups={paginate(filteredGroups, groupPage)} />
        </article>
      </section>
      {selectedUser ? (
        <UserDetailsModal
          user={selectedUser}
          details={userDetails}
          loading={userDetailsLoading}
          error={userDetailsError}
          onClose={closeUserDetails}
          onCopyUser={copyUserToCreate}
        />
      ) : null}
      {selectedComputer ? (
        <ComputerDetailsModal
          computer={selectedComputer}
          details={computerDetails}
          loading={computerDetailsLoading}
          error={computerDetailsError}
          ous={adOus}
          ousLoading={adOusLoading}
          ousError={adOusError}
          onClose={closeComputerDetails}
          onRefreshAd={onRefreshAd}
        />
      ) : null}
      {createUserOpen ? (
        <CreateUserModal
          form={createUserForm}
          loading={createUserLoading}
          message={createUserMessage}
          error={createUserError}
          ous={adOus}
          domains={adDomains}
          groups={adDetails.groups}
          ousLoading={adOusLoading}
          ousError={adOusError}
          onChange={updateCreateUserForm}
          onSubmit={submitCreateUser}
          onClose={closeCreateUserModal}
        />
      ) : null}
      {addGroupOpen ? (
        <AddUserToGroupModal
          groups={adDetails.groups}
          onClose={closeAddGroupModal}
          onRefreshAd={onRefreshAd}
        />
      ) : null}
      {listGroupsOpen ? (
        <GroupsDirectoryModal
          groups={adDetails.groups}
          onClose={closeListGroupsModal}
        />
      ) : null}
      {standardUsersOpen ? (
        <UserStandardModal
          items={paginate(filteredStandardItems, standardPage)}
          total={filteredStandardItems.length}
          overallTotal={userStandardItems.length}
          search={standardSearch}
          page={standardPage}
          onSearchChange={(value) => {
            setStandardSearch(value);
            setStandardPage(1);
          }}
          onPageChange={setStandardPage}
          onSelect={openStandardUserDetails}
          onClose={closeStandardUsersModal}
        />
      ) : null}
    </>
  );
}

function IntuneDashboard({
  intuneStatus,
  intuneSummary,
  intuneDetails,
  onRefreshIntune,
}: {
  intuneStatus: IntuneStatus;
  intuneSummary: IntuneSummary;
  intuneDetails: IntuneDetails;
  onRefreshIntune: () => Promise<void>;
}) {
  const [deviceSearch, setDeviceSearch] = useState("");
  const [devicePage, setDevicePage] = useState(1);
  const [deviceFilter, setDeviceFilter] = useState<"all" | "risk" | "stale" | "windows" | "mobile">("all");
  const [selectedDevice, setSelectedDevice] = useState<IntuneDevice | null>(null);
  const [deviceDetails, setDeviceDetails] = useState<IntuneDevice | null>(null);
  const [deviceDetailsLoading, setDeviceDetailsLoading] = useState(false);
  const [deviceDetailsError, setDeviceDetailsError] = useState("");

  const devicesByFilter = intuneDetails.devices.filter((device) => intuneDeviceMatchesFilter(device, deviceFilter));
  const filteredDevices = filterItems(devicesByFilter, deviceSearch, (device) => [
    device.deviceName,
    device.userDisplayName,
    device.userPrincipalName,
    device.emailAddress,
    device.operatingSystem,
    device.osVersion,
    device.complianceState,
    device.manufacturer,
    device.model,
    device.serialNumber,
  ]);
  const riskDevices = intuneDetails.devices.filter((device) => intuneDeviceRiskReasons(device).length);
  const staleDevices = intuneDetails.devices.filter((device) => intuneDeviceIsStale(device));
  const windowsDevices = intuneDetails.devices.filter((device) => intuneDeviceIsWindows(device));
  const mobileDevices = intuneDetails.devices.filter((device) => !intuneDeviceIsWindows(device));
  const storageAlerts = intuneDetails.devices.filter((device) => intuneFreeStoragePercent(device) <= 15);

  async function openDeviceDetails(device: IntuneDevice) {
    setSelectedDevice(device);
    setDeviceDetails(device);
    setDeviceDetailsError("");
    setDeviceDetailsLoading(true);

    try {
      const response = await authFetch(`/api/intune/devices/${encodeURIComponent(device.id)}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Falha ao carregar dispositivo.");
      }

      setDeviceDetails(payload.device || device);
    } catch (error) {
      setDeviceDetailsError(error instanceof Error ? error.message : "Falha ao carregar dispositivo.");
    } finally {
      setDeviceDetailsLoading(false);
    }
  }

  function closeDeviceDetails() {
    setSelectedDevice(null);
    setDeviceDetails(null);
    setDeviceDetailsError("");
    setDeviceDetailsLoading(false);
  }

  return (
    <>
      {!intuneStatus.ok ? (
        <section className="ad-alert">
          <AlertTriangle size={20} />
          <div>
            <strong>Intune nao esta retornando dados</strong>
            <span>{intuneStatus.message}</span>
          </div>
        </section>
      ) : null}

      <section className="kpi-grid" aria-label="Resumo Intune">
        <MetricCard icon={Monitor} label="Dispositivos" value={String(intuneSummary.total)} detail={intuneStatus.source === "graph" ? "Microsoft Graph" : "Modo mock"} tone="calm" />
        <MetricCard icon={CheckCircle2} label="Conformes" value={String(intuneSummary.compliant)} detail="Compliance OK" tone="good" />
        <MetricCard icon={AlertTriangle} label="Nao conformes" value={String(intuneSummary.nonCompliant)} detail={`${intuneSummary.unknown} sem status claro`} tone="danger" />
        <MetricCard icon={Clock3} label="Sem sync 7d" value={String(intuneSummary.staleSync)} detail="Ultima sincronizacao" tone="warn" />
      </section>

      <section className="intune-filter-board" aria-label="Filtros Intune">
        <IntuneFilterCard active={deviceFilter === "all"} count={intuneDetails.devices.length} icon={Monitor} label="Todos" tone="calm" onClick={() => { setDeviceFilter("all"); setDevicePage(1); }} />
        <IntuneFilterCard active={deviceFilter === "risk"} count={riskDevices.length} icon={AlertTriangle} label="Risco" tone="danger" onClick={() => { setDeviceFilter("risk"); setDevicePage(1); }} />
        <IntuneFilterCard active={deviceFilter === "stale"} count={staleDevices.length} icon={Clock3} label="Sem sync" tone="warn" onClick={() => { setDeviceFilter("stale"); setDevicePage(1); }} />
        <IntuneFilterCard active={deviceFilter === "windows"} count={windowsDevices.length} icon={Monitor} label="Windows" tone="good" onClick={() => { setDeviceFilter("windows"); setDevicePage(1); }} />
        <IntuneFilterCard active={deviceFilter === "mobile"} count={mobileDevices.length} icon={Wifi} label="Mobile" tone="calm" onClick={() => { setDeviceFilter("mobile"); setDevicePage(1); }} />
      </section>

      <section className="dashboard-grid intune-dashboard-grid">
        <article className="panel intune-devices-panel">
          <PanelHeader
            icon={ShieldCheck}
            title="Dispositivos Intune"
            meta={`${filteredDevices.length}/${devicesByFilter.length} registros`}
            action={
              <button className="secondary-action" type="button" onClick={onRefreshIntune}>
                <RefreshCw size={15} />
                Atualizar
              </button>
            }
          />
          <DirectoryTools
            value={deviceSearch}
            onChange={(value) => {
              setDeviceSearch(value);
              setDevicePage(1);
            }}
            page={devicePage}
            total={filteredDevices.length}
            onPageChange={setDevicePage}
            placeholder="Procurar dispositivo, usuario, SO ou serial"
          />
          <IntuneDevicesList devices={paginate(filteredDevices, devicePage)} onSelect={openDeviceDetails} />
        </article>

        <article className="panel intune-insights-panel">
          <PanelHeader icon={CircleGauge} title="Operacao" meta="Riscos e inventario" />
          <div className="compliance-stack">
            <ComplianceBar label="Dispositivos conformes" current={intuneSummary.compliant} expected={Math.max(intuneSummary.total, 1)} status="OK" />
            <ComplianceBar label="Nao conformes" current={intuneSummary.nonCompliant} expected={0} status="Corrigir" />
            <ComplianceBar label="Sem sync em 7 dias" current={intuneSummary.staleSync} expected={0} status="Revisar" />
            <ComplianceBar label="Pouco armazenamento" current={storageAlerts.length} expected={0} status="Limpar" />
          </div>

          <div className="intune-risk-list">
            {riskDevices.slice(0, 6).map((device) => (
              <button type="button" key={device.id || device.deviceName} onClick={() => openDeviceDetails(device)}>
                <strong>{device.deviceName || "Sem nome"}</strong>
                <span>{intuneDeviceRiskReasons(device).join(", ")}</span>
              </button>
            ))}
            {!riskDevices.length ? <EmptyState title="Sem riscos criticos" detail="Nenhum dispositivo com alerta nesta coleta." /> : null}
          </div>
        </article>
      </section>

      {selectedDevice ? (
        <IntuneDeviceModal
          device={deviceDetails || selectedDevice}
          loading={deviceDetailsLoading}
          error={deviceDetailsError}
          onClose={closeDeviceDetails}
        />
      ) : null}
    </>
  );
}

function TicketsDashboard({
  ticketsStatus,
  ticketsSummary,
  ticketsDetails,
  onRefreshTickets,
  sessionUser,
}: {
  ticketsStatus: TicketsStatus;
  ticketsSummary: TicketsSummary;
  ticketsDetails: TicketsDetails;
  onRefreshTickets: () => Promise<void>;
  sessionUser: AuthUser;
}) {
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketPage, setTicketPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState<ServiceTicket | null>(null);
  const [ticketDetails, setTicketDetails] = useState<ServiceTicket | null>(null);
  const [ticketDetailsLoading, setTicketDetailsLoading] = useState(false);
  const [ticketDetailsError, setTicketDetailsError] = useState("");
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>("open");
  const [ticketActionLoading, setTicketActionLoading] = useState("");
  const [ticketActionError, setTicketActionError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createMessage, setCreateMessage] = useState("");
  const [createForm, setCreateForm] = useState<CreateTicketForm>(() => emptyCreateTicketForm(sessionUser));

  const ticketsByFilter = ticketsDetails.tickets.filter((ticket) => ticketMatchesFilter(ticket, ticketFilter));
  const filteredTickets = filterItems(ticketsByFilter, ticketSearch, (ticket) => [
    ticket.code,
    ticket.title,
    ticket.description,
    ticket.requester,
    ticket.contact,
    ticket.requesterEmail,
    ticket.team,
    ticket.assignee,
    ticket.category,
    ticket.subcategory,
    ticket.priority,
    ticket.status,
    ticket.solution,
  ]);

  function openTicketDetails(ticket: ServiceTicket) {
    setSelectedTicket(ticket);
    setTicketDetails(ticket);
    setTicketDetailsError("");
    setTicketDetailsLoading(false);
    setTicketActionError("");
    setTicketActionLoading("");
  }

  function closeTicketDetails() {
    setSelectedTicket(null);
    setTicketDetails(null);
    setTicketDetailsError("");
    setTicketDetailsLoading(false);
    setTicketActionError("");
    setTicketActionLoading("");
  }

  function updateTicketFilter(filter: TicketFilter) {
    setTicketFilter(filter);
    setTicketPage(1);
  }

  function updateCreateForm(field: keyof CreateTicketForm, value: string) {
    setCreateForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateModal() {
    setCreateOpen(true);
    setCreateError("");
    setCreateMessage("");
    setCreateForm(emptyCreateTicketForm(sessionUser));
  }

  function closeCreateModal() {
    setCreateOpen(false);
  }

  async function submitTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateLoading(true);
    setCreateError("");
    setCreateMessage("");

    const missing = missingRequiredFields(createForm, [
      { field: "title", label: "Titulo" },
      { field: "description", label: "Descricao" },
      { field: "requester", label: "Solicitante" },
    ]);

    if (missing.length) {
      setCreateLoading(false);
      setCreateError(`Preencha os campos obrigatorios: ${formatMissingFields(missing)}.`);
      return;
    }

    try {
      const payload = await adRequest<{ message: string; ticket: ServiceTicket }>("/api/tickets", {
        method: "POST",
        body: createForm,
      });
      setCreateMessage(payload.message || "Chamado criado.");
      setCreateOpen(false);
      await onRefreshTickets();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Nao foi possivel abrir o chamado.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function closeTicket(ticket: ServiceTicket) {
    const id = ticket.id || ticket.code.replace(/^#/, "");
    setTicketActionLoading("close");
    setTicketActionError("");

    try {
      const payload = await adRequest<{ message: string; ticket: ServiceTicket }>(`/api/tickets/${encodeURIComponent(id)}/close`, {
        method: "POST",
        body: {
          status: "Fechado",
          resolution: "Fechado pelo portal Rede Clube.",
        },
      });
      const updated = payload.ticket?.id ? payload.ticket : { ...ticket, status: "Fechado", updatedAt: new Date().toISOString() };
      setTicketDetails(updated);
      setSelectedTicket(updated);
      await onRefreshTickets();
    } catch (error) {
      setTicketActionError(error instanceof Error ? error.message : "Nao foi possivel fechar o chamado.");
    } finally {
      setTicketActionLoading("");
    }
  }

  return (
    <>
      {!ticketsStatus.ok ? (
        <section className="ad-alert">
          <AlertTriangle size={20} />
          <div>
            <strong>Milvus nao esta retornando chamados</strong>
            <span>{ticketsStatus.message}</span>
          </div>
        </section>
      ) : null}

      <section className="ticket-status-board" aria-label="Resumo de chamados">
        <TicketStatusCard icon={Clock3} label="Abertos" value={ticketsSummary.open} detail="Fila de atendimento" tone="warn" active={ticketFilter === "open"} onClick={() => updateTicketFilter("open")} />
        <TicketStatusCard icon={CheckCircle2} label="Resolvidos" value={ticketsSummary.closed} detail="Fechados/finalizados" tone="good" active={ticketFilter === "closed"} onClick={() => updateTicketFilter("closed")} />
        <TicketStatusCard icon={ClipboardList} label="Todos" value={ticketsSummary.total} detail={ticketsStatus.source === "milvus" ? "Milvus API" : "Modo mock"} tone="neutral" active={ticketFilter === "all"} onClick={() => updateTicketFilter("all")} />
        <TicketStatusCard icon={AlertTriangle} label="Alta prioridade" value={ticketsSummary.highPriority} detail="SLA em observacao" tone="danger" active={false} onClick={() => updateTicketFilter("all")} />
      </section>

      <section className="dashboard-grid tickets-dashboard-grid">
        <article className="panel tickets-list-panel">
          <PanelHeader
            icon={ClipboardList}
            title={ticketFilterTitle(ticketFilter)}
            meta={`${filteredTickets.length}/${ticketsByFilter.length} registros`}
            action={
              <div className="tickets-header-actions">
                <button className="secondary-action" type="button" onClick={onRefreshTickets}>
                  <RefreshCw size={15} />
                  Atualizar
                </button>
                <button className="primary-action" type="button" onClick={openCreateModal}>
                  <Plus size={15} />
                  Novo chamado
                </button>
              </div>
            }
          />
          <DirectoryTools
            value={ticketSearch}
            onChange={(value) => {
              setTicketSearch(value);
              setTicketPage(1);
            }}
            page={ticketPage}
            total={filteredTickets.length}
            onPageChange={setTicketPage}
            placeholder="Procurar chamado, solicitante, equipe ou status"
            pageSizeOverride={8}
          />
          <ServiceTicketsList tickets={paginate(filteredTickets, ticketPage, 8)} onSelect={openTicketDetails} />
        </article>

        <article className="panel tickets-insights-panel">
          <PanelHeader icon={CircleGauge} title="Operacao" meta="SLA e fila" />
          <div className="compliance-stack">
            <ComplianceBar label="Chamados abertos" current={ticketsSummary.open} expected={Math.max(ticketsSummary.total, 1)} status="Fila" />
            <ComplianceBar label="Alta prioridade" current={ticketsSummary.highPriority} expected={0} status="Atencao" />
            <ComplianceBar label="Pendentes" current={ticketsSummary.pending} expected={0} status="Revisar" />
          </div>
        </article>
      </section>

      {selectedTicket ? (
          <TicketDetailsModal
          ticket={ticketDetails || selectedTicket}
          loading={ticketDetailsLoading}
          error={ticketDetailsError}
          actionError={ticketActionError}
          actionLoading={ticketActionLoading === "close"}
          onCloseTicket={closeTicket}
          onClose={closeTicketDetails}
        />
      ) : null}

      {createOpen ? (
        <CreateTicketModal
          form={createForm}
          loading={createLoading}
          error={createError}
          message={createMessage}
          onChange={updateCreateForm}
          onSubmit={submitTicket}
          onClose={closeCreateModal}
        />
      ) : null}
    </>
  );
}

function MilvusPortalView() {
  return (
    <section className="milvus-portal-shell">
      <iframe
        className="milvus-portal-frame"
        src="https://app.milvus.com.br/login"
        title="Portal oficial Milvus"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </section>
  );
}

function PopDashboard() {
  const [payload, setPayload] = useState<PopPayload>({
    ok: false,
    configured: false,
    source: "sharepoint",
    message: "Carregando POP...",
    siteName: "SharePoint",
    driveName: "POP",
    total: 0,
    items: [],
  });
  const [search, setSearch] = useState("");
  const [currentFolder, setCurrentFolder] = useState<PopDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadPop = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ search });
      const response = await authFetch(`/api/pop/documents?${params.toString()}`);
      if (response.status === 401) return;

      const nextPayload = await parseApiPayload<PopPayload | { message?: string }>(response, {});
      if (!response.ok || !("items" in nextPayload)) {
        throw new Error("message" in nextPayload ? nextPayload.message || "Falha ao carregar POP." : "Falha ao carregar POP.");
      }

      setPayload(nextPayload);
      setCurrentFolder((current) => current && nextPayload.items.some((item) => item.id === current.id) ? current : null);
      if (!nextPayload.ok && nextPayload.message) {
        setError(nextPayload.message);
      }
    } catch (loadError) {
      setPayload((current) => ({ ...current, ok: false, items: [], total: 0 }));
      setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar documentos POP.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadPop();
  }, [loadPop]);

  const folders = payload.items.filter((item) => item.kind === "folder").length;
  const files = payload.items.filter((item) => item.kind === "file").length;
  const recent = payload.items[0];
  const folderItems = payload.items.filter((item) => item.kind === "folder");
  const folderDepths = folderItems.map((item) => popPathDepth(item.path));
  const rootDepth = folderDepths.length ? Math.min(...folderDepths) : 0;
  const rootFolders = folderItems.filter((item) => popPathDepth(item.path) === rootDepth);
  const visibleItems = search.trim()
    ? payload.items
    : currentFolder
      ? payload.items.filter((item) => isPopChildOfFolder(item, currentFolder))
      : rootFolders.length
        ? rootFolders
        : payload.items;
  const visibleTitle = search.trim() ? "Resultados da pesquisa" : currentFolder?.name || "Pastas do POP";

  return (
    <>
      <section className="kpi-grid" aria-label="Resumo POP">
        <MetricCard icon={BookOpen} label="POP" value={payload.ok ? "Online" : "Pendente"} detail={payload.message} tone={payload.ok ? "good" : "warn"} />
        <MetricCard icon={FolderOpen} label="Pastas" value={String(folders)} detail={payload.driveName || "Biblioteca"} tone="calm" />
        <MetricCard icon={FileText} label="Documentos" value={String(files)} detail={payload.siteName || "SharePoint"} tone="calm" />
        <MetricCard icon={Clock3} label="Atualizado" value={recent ? formatDateTime(recent.modifiedAt) : "-"} detail={recent?.name || "Sem documentos"} tone="warn" />
      </section>

      <section className="panel pop-panel">
        <PanelHeader
          icon={BookOpen}
          title={visibleTitle}
          meta={loading ? "Sincronizando..." : `${visibleItems.length} de ${payload.total} itens`}
          action={
            <button className="secondary-action" type="button" onClick={loadPop} disabled={loading}>
              <RefreshCw size={15} />
              Atualizar
            </button>
          }
        />

        <div className="pop-toolbar">
          <label className="search-field">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentFolder(null);
              }}
              placeholder="Pesquisar procedimento, categoria, arquivo ou responsavel"
            />
          </label>
        </div>

        <div className="pop-breadcrumb">
          <button type="button" onClick={() => setCurrentFolder(null)} disabled={!currentFolder && !search.trim()}>
            POP
          </button>
          {currentFolder ? (
            <>
              <span>/</span>
              <strong>{currentFolder.name}</strong>
            </>
          ) : null}
          {search.trim() ? (
            <>
              <span>/</span>
              <strong>Pesquisa</strong>
            </>
          ) : null}
        </div>

        {error ? <div className={payload.configured ? "form-error" : "form-success"}>{error}</div> : null}

        <div className="pop-grid">
          {visibleItems.map((item) => (
            <article className={`pop-card ${item.kind}`} key={item.id}>
              <div className="pop-card-icon">
                {item.kind === "folder" ? <FolderOpen size={24} /> : <FileText size={24} />}
              </div>
              <div className="pop-card-body">
                <div className="pop-card-title">
                  <h3>{item.name}</h3>
                  <span>{item.extension || (item.kind === "folder" ? "PASTA" : "DOC")}</span>
                </div>
                <p>{item.category}</p>
                <div className="pop-meta">
                  <span>{formatDateTime(item.modifiedAt)}</span>
                  <span>{item.modifiedBy}</span>
                  {item.kind === "file" ? <span>{formatBytes(item.size)}</span> : null}
                </div>
              </div>
              {item.kind === "folder" ? (
                <button className="secondary-action pop-open" type="button" onClick={() => setCurrentFolder(item)}>
                  <FolderOpen size={15} />
                  Entrar
                </button>
              ) : (
                <a className="secondary-action pop-open" href={item.webUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={15} />
                  Abrir
                </a>
              )}
            </article>
          ))}

          {!visibleItems.length ? (
            <EmptyState
              title={payload.configured ? "Nenhum item encontrado" : "SharePoint aguardando configuracao"}
              detail={payload.configured ? "Volte uma pasta, ajuste a pesquisa ou confira a estrutura no SharePoint." : "Configure Microsoft Graph e a pasta do SharePoint no ambiente do servidor."}
            />
          ) : null}
        </div>
      </section>
    </>
  );
}

function WifiPortalDashboard() {
  const [kind, setKind] = useState<WifiKind>("associados");
  const [status, setStatus] = useState<WifiStatus>({ ok: false, configured: false, database: "wifi_portal", message: "Carregando MySQL..." });
  const [payload, setPayload] = useState<WifiListPayload | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const columns = payload?.columns || [];
  const primaryKey = payload?.primaryKey || columns.find((column) => column.primary)?.name || columns[0]?.name || "";
  const writableColumns = columns.filter((column) => column.writable && !column.autoIncrement);
  const visibleColumns = pickWifiVisibleColumns(columns, primaryKey);
  const totalPages = Math.max(1, Math.ceil((payload?.total || 0) / (payload?.pageSize || 20)));

  const loadWifi = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        search,
        page: String(page),
        pageSize: "20",
      });
      const listResponse = await authFetch(`/api/wifi/${kind}?${params.toString()}`);
      if (listResponse.status === 401) return;

      const listPayload = await parseApiPayload<WifiListPayload | { message?: string }>(listResponse, {});
      if (!listResponse.ok || !("items" in listPayload)) {
        throw new Error("message" in listPayload ? listPayload.message || "Falha ao carregar tabela WiFi." : "Falha ao carregar tabela WiFi.");
      }

      setPayload(listPayload);
      setStatus({
        ok: true,
        configured: true,
        database: listPayload.database,
        message: `MySQL conectado em ${listPayload.table}.`,
      });
      setForm((current) => Object.keys(current).length ? current : emptyWifiRecord(listPayload.columns));
    } catch (loadError) {
      setPayload(null);
      setStatus((current) => ({
        ...current,
        ok: false,
        configured: true,
        database: kind === "associados" ? "wifi_portal" : "radius",
        message: loadError instanceof Error ? loadError.message : "Falha MySQL.",
      }));
      setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar dados WiFi.");
    } finally {
      setLoading(false);
    }
  }, [kind, page, search]);

  useEffect(() => {
    loadWifi();
  }, [loadWifi]);

  function changeKind(nextKind: WifiKind) {
    setKind(nextKind);
    setPage(1);
    setSearch("");
    setForm({});
    setEditingId("");
    setMessage("");
    setError("");
  }

  function newRecord() {
    setForm(emptyWifiRecord(columns));
    setEditingId("");
    setMessage("");
    setError("");
  }

  function editRecord(record: Record<string, unknown>) {
    setForm({ ...record });
    setEditingId(String(record[primaryKey] ?? ""));
    setMessage("");
    setError("");
  }

  async function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const path = editingId
        ? `/api/wifi/${kind}/${encodeURIComponent(editingId)}`
        : `/api/wifi/${kind}`;
      const result = await adRequest<{ message: string }>(path, {
        method: editingId ? "PATCH" : "POST",
        body: form,
      });
      setMessage(result.message || "Registro salvo.");
      setEditingId("");
      setForm(emptyWifiRecord(columns));
      await loadWifi();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel salvar registro WiFi.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRecord() {
    if (!editingId) return;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const result = await adRequest<{ message: string }>(`/api/wifi/${kind}/${encodeURIComponent(editingId)}`, { method: "DELETE" });
      setMessage(result.message || "Registro removido.");
      setEditingId("");
      setForm(emptyWifiRecord(columns));
      await loadWifi();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Nao foi possivel remover registro WiFi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="kpi-grid" aria-label="Resumo WiFi">
        <MetricCard icon={Wifi} label="MySQL" value={status.ok ? "Online" : "Offline"} detail={status.message} tone={status.ok ? "good" : "danger"} />
        <MetricCard icon={Server} label="Base" value={status.database || "wifi_portal"} detail={status.configured ? "Configurada" : "Sem variaveis"} tone="calm" />
        <MetricCard icon={Users} label={kind === "associados" ? "Associados" : "Colaboradores"} value={String(payload?.total || 0)} detail={payload ? `${payload.database}.${payload.table}` : "-"} tone="warn" />
        <MetricCard icon={TableIcon} label="Campos" value={String(columns.length)} detail={primaryKey ? `Chave: ${primaryKey}` : "Schema dinamico"} tone="calm" />
      </section>

      <section className="panel wifi-panel">
        <PanelHeader
          icon={Wifi}
          title="Portal WiFi"
          meta={loading ? "Carregando..." : payload?.hasMore ? `${payload.total}+ registros` : `${payload?.total || 0} registros`}
          action={
            <button className="secondary-action" type="button" onClick={loadWifi} disabled={loading}>
              <RefreshCw size={15} />
              Atualizar
            </button>
          }
        />

        <div className="wifi-submenu" role="tablist" aria-label="Cadastros WiFi">
          <button className={kind === "associados" ? "active" : ""} type="button" onClick={() => changeKind("associados")}>
            Associados
          </button>
          <button className={kind === "colaboradores" ? "active" : ""} type="button" onClick={() => changeKind("colaboradores")}>
            Colaboradores
          </button>
        </div>

        {error ? <div className="form-error">{error}</div> : null}
        {message ? <div className="form-success">{message}</div> : null}

        <div className="wifi-layout">
          <section className="wifi-list">
            <DirectoryTools
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              page={page}
              total={payload?.total || 0}
              onPageChange={setPage}
              placeholder="Pesquisar nome, e-mail, CPF, matricula ou qualquer campo"
              pageSizeOverride={payload?.pageSize || 20}
            />

            <div className="wifi-table">
              <div className="wifi-table-head" style={{ gridTemplateColumns: wifiGridTemplate(visibleColumns.length) }}>
                {visibleColumns.map((column) => (
                  <span key={column.name}>{column.name}</span>
                ))}
                <span>Acoes</span>
              </div>
              {(payload?.items || []).map((record, index) => {
                const recordId = String(record[primaryKey] ?? index);
                return (
                  <button className="wifi-table-row" key={recordId} onClick={() => editRecord(record)} style={{ gridTemplateColumns: wifiGridTemplate(visibleColumns.length) }} type="button">
                    {visibleColumns.map((column) => (
                      <span key={column.name}>{formatWifiValue(record[column.name])}</span>
                    ))}
                    <strong>{editingId === String(record[primaryKey] ?? "") ? "Editando" : "Editar"}</strong>
                  </button>
                );
              })}
              {!payload?.items?.length ? (
                <EmptyState title="Nenhum registro encontrado" detail="Use o formulario ao lado para inserir ou ajuste a pesquisa." />
              ) : null}
            </div>
          </section>

          <section className="wifi-editor">
            <div className="wifi-editor-head">
              <div>
                <p className="eyebrow">{editingId ? "Editar registro" : "Novo registro"}</p>
                <h2>{kind === "associados" ? "Associado" : "Colaborador"}</h2>
              </div>
              <button className="secondary-action" type="button" onClick={newRecord}>
                <Plus size={15} />
                Novo
              </button>
            </div>

            <form className="wifi-form" onSubmit={saveRecord}>
              {writableColumns.map((column) => (
                <label key={column.name}>
                  <span>{wifiFieldLabel(kind, column)}{column.nullable ? "" : " *"}</span>
                  <input
                    disabled={saving}
                    onChange={(event) => setForm((current) => ({ ...current, [column.name]: event.target.value }))}
                    placeholder={column.type}
                    value={String(form[column.name] ?? "")}
                  />
                </label>
              ))}
              {!writableColumns.length ? (
                <EmptyState title="Tabela sem campos editaveis" detail="Confira permissoes e estrutura da tabela." />
              ) : null}
              <div className="wifi-actions">
                <button className="primary-action" type="submit" disabled={saving || !writableColumns.length}>
                  <Save size={15} />
                  Salvar
                </button>
                <button className="danger-action" type="button" onClick={removeRecord} disabled={saving || !editingId}>
                  <Trash2 size={15} />
                  Remover
                </button>
              </div>
            </form>
          </section>
        </div>
      </section>
    </>
  );
}

function SnmpDashboard({
  snmpSummary,
  snmpDetails,
  onRefreshSnmp,
}: {
  snmpSummary: SnmpSummary;
  snmpDetails: SnmpDetails;
  onRefreshSnmp: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<SnmpDevice>(emptySnmpDevice());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [testMetric, setTestMetric] = useState<SnmpMetric | null>(null);

  const metricByDevice = new Map(snmpDetails.metrics.map((metric) => [metric.deviceId, metric]));
  const filteredDevices = filterItems(snmpDetails.devices, search, (device) => {
    const metric = metricByDevice.get(device.id);
    return [device.name, device.host, device.type, device.version, device.notes, metric?.sysName, metric?.sysDescr, metric?.message];
  });
  const pagedDevices = paginate(filteredDevices, page, 8);

  function editDevice(device: SnmpDevice) {
    setForm({ ...device });
    setMessage("");
    setError("");
    setTestMetric(metricByDevice.get(device.id) || null);
  }

  function newDevice() {
    setForm(emptySnmpDevice());
    setMessage("");
    setError("");
    setTestMetric(null);
  }

  async function saveDevice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = await adRequest<{ message: string; device: SnmpDevice }>("/api/snmp/devices", {
        method: "POST",
        body: form,
      });
      setForm(payload.device);
      setMessage(payload.message || "Dispositivo SNMP salvo.");
      await onRefreshSnmp();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel salvar o dispositivo SNMP.");
    } finally {
      setSaving(false);
    }
  }

  async function testDevice() {
    setSaving(true);
    setMessage("");
    setError("");
    setTestMetric(null);

    try {
      const payload = await adRequest<{ metric: SnmpMetric }>("/api/snmp/test", {
        method: "POST",
        body: form,
      });
      setTestMetric(payload.metric);
      setMessage(payload.metric.ok ? "SNMP respondeu." : payload.metric.message);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Nao foi possivel testar SNMP.");
    } finally {
      setSaving(false);
    }
  }

  async function autoDetectVersion() {
    setSaving(true);
    setMessage("");
    setError("");
    setTestMetric(null);

    try {
      const attempts: SnmpVersion[] = ["2c", "1"];

      for (const version of attempts) {
        const candidate = { ...form, version };
        const payload = await adRequest<{ metric: SnmpMetric }>("/api/snmp/test", {
          method: "POST",
          body: candidate,
        });

        if (payload.metric.ok) {
          setForm(candidate);
          setTestMetric(payload.metric);
          setMessage(`SNMP respondeu usando v${version}. Salve o dispositivo com essa versao.`);
          return;
        }

        setTestMetric(payload.metric);
      }

      setMessage("Nao respondeu em SNMP v2c nem v1. Confira community, UDP/161 e acesso do container ate o equipamento.");
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Nao foi possivel detectar a versao SNMP.");
    } finally {
      setSaving(false);
    }
  }

  async function collectDevice(device: SnmpDevice) {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = await adRequest<{ metric: SnmpMetric }>(`/api/snmp/devices/${encodeURIComponent(device.id)}/collect`, {
        method: "POST",
      });
      setMessage(payload.metric.ok ? `${device.name || device.host}: coleta OK.` : payload.metric.message);
      await onRefreshSnmp();
    } catch (collectError) {
      setError(collectError instanceof Error ? collectError.message : "Nao foi possivel coletar SNMP.");
    } finally {
      setSaving(false);
    }
  }

  async function collectAll() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = await adRequest<{ metrics: SnmpMetric[] }>("/api/snmp/collect", { method: "POST" });
      const online = payload.metrics.filter((metric) => metric.ok).length;
      setMessage(`Coleta concluida: ${online}/${payload.metrics.length} online.`);
      await onRefreshSnmp();
    } catch (collectError) {
      setError(collectError instanceof Error ? collectError.message : "Nao foi possivel coletar SNMP.");
    } finally {
      setSaving(false);
    }
  }

  async function removeDevice(device: SnmpDevice) {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await adRequest(`/api/snmp/devices/${encodeURIComponent(device.id)}`, { method: "DELETE" });
      if (form.id === device.id) newDevice();
      setMessage("Dispositivo removido.");
      await onRefreshSnmp();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Nao foi possivel remover o dispositivo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="kpi-grid" aria-label="Resumo SNMP">
        <MetricCard icon={Signal} label="Dispositivos" value={String(snmpSummary.total)} detail={`${snmpSummary.enabled} habilitados`} tone="calm" />
        <MetricCard icon={CheckCircle2} label="Online" value={String(snmpSummary.online)} detail="Responderam SNMP" tone="good" />
        <MetricCard icon={XCircle} label="Offline" value={String(snmpSummary.offline)} detail="Sem resposta SNMP" tone={snmpSummary.offline ? "danger" : "calm"} />
        <MetricCard icon={Clock3} label="Intervalo" value="60s" detail="Atualizacao da tela" tone="warn" />
      </section>

      <section className="dashboard-grid snmp-dashboard-grid">
        <section className="panel snmp-form-panel">
          <PanelHeader
            icon={Signal}
            title={form.id ? "Editar dispositivo" : "Novo dispositivo SNMP"}
            meta={form.version === "3" ? "SNMPv3" : `SNMPv${form.version}`}
            action={
              <button className="secondary-action" type="button" onClick={newDevice}>
                <Plus size={15} />
                Novo
              </button>
            }
          />

          {error ? <div className="form-error">{error}</div> : null}
          {message ? <div className="form-success">{message}</div> : null}

          <form className="snmp-form" onSubmit={saveDevice}>
            <div className="snmp-form-grid">
              <label>
                <span>Nome</span>
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Fortinet borda" />
              </label>
              <label>
                <span>IP ou DNS</span>
                <input value={form.host} onChange={(event) => setForm({ ...form, host: event.target.value })} placeholder="10.200.1.1" required />
              </label>
              <label>
                <span>Tipo</span>
                <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as SnmpDevice["type"] })}>
                  <option value="Fortinet">Fortinet</option>
                  <option value="UniFi">UniFi</option>
                  <option value="Switch">Switch</option>
                  <option value="Firewall">Firewall</option>
                  <option value="Servidor">Servidor</option>
                  <option value="Outro">Outro</option>
                </select>
              </label>
              <label>
                <span>Porta</span>
                <input type="number" min={1} max={65535} value={form.port} onChange={(event) => setForm({ ...form, port: Number(event.target.value) })} />
              </label>
              <label>
                <span>Versao</span>
                <select value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value as SnmpVersion })}>
                  <option value="2c">SNMP v2c</option>
                  <option value="1">SNMP v1</option>
                  <option value="3">SNMP v3</option>
                </select>
              </label>
              {form.version !== "3" ? (
                <label>
                  <span>Community</span>
                  <input value={form.community} onChange={(event) => setForm({ ...form, community: event.target.value })} placeholder="public" />
                </label>
              ) : (
                <label>
                  <span>Usuario v3</span>
                  <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="snmp-user" />
                </label>
              )}
              {form.version === "3" ? (
                <>
                  <label>
                    <span>Auth</span>
                    <select value={form.authProtocol} onChange={(event) => setForm({ ...form, authProtocol: event.target.value as SnmpDevice["authProtocol"] })}>
                      <option value="none">Sem auth</option>
                      <option value="md5">MD5</option>
                      <option value="sha">SHA</option>
                    </select>
                  </label>
                  <label>
                    <span>Senha auth</span>
                    <input value={form.authKey} onChange={(event) => setForm({ ...form, authKey: event.target.value })} type="password" />
                  </label>
                  <label>
                    <span>Privacidade</span>
                    <select value={form.privProtocol} onChange={(event) => setForm({ ...form, privProtocol: event.target.value as SnmpDevice["privProtocol"] })}>
                      <option value="none">Sem priv</option>
                      <option value="des">DES</option>
                      <option value="aes">AES</option>
                    </select>
                  </label>
                  <label>
                    <span>Senha priv</span>
                    <input value={form.privKey} onChange={(event) => setForm({ ...form, privKey: event.target.value })} type="password" />
                  </label>
                </>
              ) : null}
              <label>
                <span>Timeout ms</span>
                <input type="number" min={500} max={15000} value={form.timeoutMs} onChange={(event) => setForm({ ...form, timeoutMs: Number(event.target.value) })} />
              </label>
              <label>
                <span>Tentativas</span>
                <input type="number" min={0} max={5} value={form.retries} onChange={(event) => setForm({ ...form, retries: Number(event.target.value) })} />
              </label>
            </div>
            <label className="snmp-enabled">
              <input checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} type="checkbox" />
              <span>Coletar este dispositivo</span>
            </label>
            <label>
              <span>Observacoes</span>
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Portas importantes, local fisico, link..." />
            </label>
            <div className="snmp-actions">
              <button className="secondary-action" type="button" onClick={testDevice} disabled={saving || !form.host.trim()}>
                <Activity size={15} />
                Testar SNMP
              </button>
              <button className="secondary-action" type="button" onClick={autoDetectVersion} disabled={saving || !form.host.trim() || form.version === "3"}>
                <Signal size={15} />
                Auto v2c/v1
              </button>
              <button className="primary-action" type="submit" disabled={saving || !form.host.trim()}>
                <Save size={15} />
                Salvar
              </button>
            </div>
          </form>

          {testMetric ? <SnmpMetricPreview metric={testMetric} /> : null}
        </section>

        <section className="panel snmp-list-panel">
          <PanelHeader
            icon={Server}
            title="Dispositivos monitorados"
            meta={`${filteredDevices.length}/${snmpDetails.devices.length} dispositivos`}
            action={
              <button className="secondary-action" type="button" onClick={collectAll} disabled={saving || !snmpDetails.devices.length}>
                <RefreshCw size={15} />
                Coletar todos
              </button>
            }
          />
          <DirectoryTools
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            page={page}
            total={filteredDevices.length}
            onPageChange={setPage}
            placeholder="Procurar IP, nome, tipo ou descricao"
            pageSizeOverride={8}
          />
          <div className="snmp-device-list">
            {pagedDevices.map((device) => {
              const metric = metricByDevice.get(device.id);
              const tone = !device.enabled ? "idle" : metric?.ok ? "online" : metric ? "offline" : "warn";
              return (
                <article className={`snmp-device-row ${tone}`} key={device.id}>
                  <div>
                    <strong>{device.name || device.host}</strong>
                    <span>{device.host}:{device.port} - {device.type} - SNMPv{device.version}</span>
                    <small>{metric?.sysName || metric?.message || "Ainda sem coleta"}</small>
                  </div>
                  <div className="snmp-device-meta">
                    <span>{metric?.latencyMs !== null && metric?.latencyMs !== undefined ? `${metric.latencyMs} ms` : device.enabled ? "Aguardando" : "Desativado"}</span>
                    <button className="secondary-action" type="button" onClick={() => collectDevice(device)} disabled={saving || !device.enabled}>
                      <RefreshCw size={14} />
                      Coletar
                    </button>
                    <button className="secondary-action" type="button" onClick={() => editDevice(device)}>
                      <Settings size={14} />
                      Editar
                    </button>
                    <button className="danger-action" type="button" onClick={() => removeDevice(device)} disabled={saving}>
                      <Trash2 size={14} />
                      Remover
                    </button>
                  </div>
                </article>
              );
            })}
            {!pagedDevices.length ? (
              <div className="empty-state">
                <strong>Nenhum dispositivo SNMP cadastrado</strong>
                <span>Cadastre o IP do Fortinet, UniFi ou switch para testar a coleta.</span>
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </>
  );
}

function SnmpMetricPreview({ metric }: { metric: SnmpMetric }) {
  return (
    <div className={`snmp-test-result ${metric.ok ? "online" : "offline"}`}>
      <strong>{metric.ok ? "SNMP OK" : "Falha SNMP"}</strong>
      <span>{metric.message}</span>
      {metric.ok ? (
        <div className="snmp-metric-grid">
          <div><span>Nome</span><strong>{metric.sysName || "-"}</strong></div>
          <div><span>Uptime</span><strong>{metric.uptime || "-"}</strong></div>
          <div><span>Interfaces</span><strong>{metric.interfaces ?? "-"}</strong></div>
          <div><span>Latencia</span><strong>{metric.latencyMs ?? "-"} ms</strong></div>
        </div>
      ) : null}
      {metric.sysDescr ? <p>{metric.sysDescr}</p> : null}
    </div>
  );
}

function IpsDashboard({
  ipSummary,
  ipDetails,
  onRefreshIps,
}: {
  ipSummary: IpSummary;
  ipDetails: IpDetails;
  onRefreshIps: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [ipSection, setIpSection] = useState<"addresses" | "subnets" | "links">("addresses");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editingItem, setEditingItem] = useState<IpInventoryItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renamingCategory, setRenamingCategory] = useState("");
  const [networkOpen, setNetworkOpen] = useState(false);
  const [vlanTarget, setVlanTarget] = useState<IpNetworkSummary | null>(null);
  const [editingLink, setEditingLink] = useState<IpInventoryLink | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredItems = filterItems(
    ipDetails.items.filter((item) => (!statusFilter || item.status === statusFilter) && (!categoryFilter || item.category === categoryFilter)),
    search,
    (item) => [item.ip, item.name, item.location, item.category, item.vlan, item.network, item.status, item.notes, item.sourceSheet],
  );
  const networkSummaries = buildIpNetworkSummaries(ipDetails.items);
  const filteredNetworks = filterItems(
    networkSummaries.filter((network) => !categoryFilter || network.category === categoryFilter),
    search,
    (network) => [network.network, network.category, network.vlan, network.sourceSheet],
  );
  const filteredLinks = filterItems(
    ipDetails.links.filter((link) => !categoryFilter || link.category === categoryFilter),
    search,
    (link) => [link.provider, link.type, link.name, link.speed, link.fortinetIp, link.gateway, link.mask, link.range, link.usedIp, link.location, link.service, link.ports, link.category, link.status, link.notes],
  );
  const filterCategories = Array.from(new Set([...ipDetails.categories, ...ipDetails.links.map((link) => link.category).filter(Boolean)])).sort();

  function openCreateIp() {
    setEditingItem(emptyIpItem());
    setActionError("");
    setActionMessage("");
    setEditOpen(true);
  }

  function openEditIp(item: IpInventoryItem) {
    setEditingItem(item);
    setActionError("");
    setActionMessage("");
    setEditOpen(true);
  }

  function closeEditIp() {
    setEditOpen(false);
    setEditingItem(null);
    setSaving(false);
  }

  function openRenameCategory() {
    setRenamingCategory(categoryFilter || ipDetails.categories[0] || "");
    setActionError("");
    setActionMessage("");
    setRenameOpen(true);
  }

  function closeRenameCategory() {
    setRenameOpen(false);
    setRenamingCategory("");
    setSaving(false);
  }

  function openCreateNetwork() {
    setActionError("");
    setActionMessage("");
    setNetworkOpen(true);
  }

  function closeCreateNetwork() {
    setNetworkOpen(false);
    setSaving(false);
  }

  function openVlanModal(network: IpNetworkSummary) {
    setVlanTarget(network);
    setActionError("");
    setActionMessage("");
  }

  function closeVlanModal() {
    setVlanTarget(null);
    setSaving(false);
  }

  function openCreateLink() {
    setEditingLink(emptyIpLink());
    setActionError("");
    setActionMessage("");
    setLinkOpen(true);
  }

  function openEditLink(link: IpInventoryLink) {
    setEditingLink(link);
    setActionError("");
    setActionMessage("");
    setLinkOpen(true);
  }

  function closeLinkModal() {
    setLinkOpen(false);
    setEditingLink(null);
    setSaving(false);
  }

  async function saveIp(item: IpInventoryItem) {
    setSaving(true);
    setActionError("");
    setActionMessage("");

    try {
      const isNew = !item.id;
      const payload = await adRequest<{ message: string; item: IpInventoryItem }>(isNew ? "/api/ips" : `/api/ips/${encodeURIComponent(item.id)}`, {
        method: isNew ? "POST" : "PATCH",
        body: item,
      });
      setActionMessage(payload.message || "IP salvo.");
      closeEditIp();
      await onRefreshIps();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Nao foi possivel salvar o IP.");
    } finally {
      setSaving(false);
    }
  }

  async function removeIp(item: IpInventoryItem) {
    setSaving(true);
    setActionError("");

    try {
      await adRequest(`/api/ips/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      closeEditIp();
      await onRefreshIps();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Nao foi possivel remover o IP.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCategoryName(from: string, to: string) {
    setSaving(true);
    setActionError("");
    setActionMessage("");

    try {
      const payload = await adRequest<{ message: string; category: string; updated: number }>("/api/ips/categories", {
        method: "PATCH",
        body: { from, to },
      });
      setCategoryFilter(payload.category);
      setPage(1);
      setActionMessage(`${payload.message} ${payload.updated} registros atualizados.`);
      closeRenameCategory();
      await onRefreshIps();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Nao foi possivel renomear a categoria.");
    } finally {
      setSaving(false);
    }
  }

  async function saveNetwork(payload: { cidr: string; category: string; vlan: string; sourceSheet: string }) {
    setSaving(true);
    setActionError("");
    setActionMessage("");

    try {
      const result = await adRequest<{ message: string; category: string; network: string; created: number; updated: number; total: number }>("/api/ips/networks", {
        method: "POST",
        body: payload,
      });
      setCategoryFilter(result.category);
      setPage(1);
      setActionMessage(`${result.message} ${result.network}: ${result.created} novos, ${result.updated} atualizados.`);
      closeCreateNetwork();
      await onRefreshIps();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Nao foi possivel criar a rede.");
    } finally {
      setSaving(false);
    }
  }

  async function saveNetworkVlan(network: IpNetworkSummary, vlan: string) {
    setSaving(true);
    setActionError("");
    setActionMessage("");

    try {
      const result = await adRequest<{ message: string; network: string; vlan: string; updated: number }>("/api/ips/networks/vlan", {
        method: "PATCH",
        body: { network: network.network, category: network.category, vlan },
      });
      setActionMessage(`${result.message} ${result.updated} IPs atualizados para VLAN ${result.vlan}.`);
      closeVlanModal();
      await onRefreshIps();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Nao foi possivel aplicar a VLAN.");
    } finally {
      setSaving(false);
    }
  }

  async function saveLink(link: IpInventoryLink) {
    setSaving(true);
    setActionError("");
    setActionMessage("");

    try {
      const isNew = !link.id;
      const result = await adRequest<{ message: string; link: IpInventoryLink }>(isNew ? "/api/ips/links" : `/api/ips/links/${encodeURIComponent(link.id)}`, {
        method: isNew ? "POST" : "PATCH",
        body: link,
      });
      setActionMessage(result.message || "Link salvo.");
      closeLinkModal();
      await onRefreshIps();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Nao foi possivel salvar o link.");
    } finally {
      setSaving(false);
    }
  }

  async function removeLink(link: IpInventoryLink) {
    setSaving(true);
    setActionError("");

    try {
      await adRequest(`/api/ips/links/${encodeURIComponent(link.id)}`, { method: "DELETE" });
      closeLinkModal();
      await onRefreshIps();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Nao foi possivel remover o link.");
    } finally {
      setSaving(false);
    }
  }

  async function reimportIps() {
    setSaving(true);
    setActionError("");
    setActionMessage("");

    try {
      const payload = await adRequest<{ message: string; total: number }>("/api/ips/reimport", { method: "POST" });
      setActionMessage(`${payload.message} ${payload.total} registros.`);
      await onRefreshIps();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Nao foi possivel reimportar a planilha.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="kpi-grid" aria-label="Resumo de IPs">
        <MetricCard icon={Network} label="IPs importados" value={String(ipSummary.total)} detail={`${ipSummary.categories} abas/categorias`} tone="calm" />
        <MetricCard icon={CheckCircle2} label="Usados" value={String(ipSummary.used)} detail="Com descricao/local" tone="good" />
        <MetricCard icon={CircleGauge} label="Livres" value={String(ipSummary.free)} detail="Sem uso informado" tone="warn" />
        <MetricCard icon={ShieldCheck} label="Reservados" value={String(ipSummary.reserved)} detail="Separados para uso" tone="calm" />
      </section>

      <section className="panel ips-panel">
        <PanelHeader
          icon={Network}
          title={ipSection === "subnets" ? "Subredes" : ipSection === "links" ? "Links" : "Inventario de IPs"}
          meta={ipSection === "subnets" ? `${filteredNetworks.length}/${networkSummaries.length} redes` : ipSection === "links" ? `${filteredLinks.length}/${ipDetails.links.length} links` : `${filteredItems.length}/${ipDetails.items.length} registros`}
          action={
            <div className="tickets-header-actions">
              <button className="secondary-action" type="button" onClick={onRefreshIps}>
                <RefreshCw size={15} />
                Atualizar
              </button>
              {ipSection === "addresses" ? (
                <button className="secondary-action" type="button" onClick={openRenameCategory} disabled={saving || !ipDetails.categories.length}>
                  <Settings size={15} />
                  Renomear categoria
                </button>
              ) : null}
              {ipSection === "subnets" ? (
                <button className="secondary-action" type="button" onClick={openCreateNetwork} disabled={saving}>
                  <Network size={15} />
                  Nova rede
                </button>
              ) : null}
              {ipSection === "links" ? (
                <button className="secondary-action" type="button" onClick={openCreateLink} disabled={saving}>
                  <Plus size={15} />
                  Novo link
                </button>
              ) : null}
              <button className="secondary-action" type="button" onClick={reimportIps} disabled={saving}>
                <RefreshCw size={15} />
                Reimportar
              </button>
              {ipSection === "addresses" ? (
              <button className="primary-action" type="button" onClick={openCreateIp}>
                <Plus size={15} />
                Novo IP
              </button>
              ) : null}
            </div>
          }
        />
        {actionError ? <div className="form-error">{actionError}</div> : null}
        {actionMessage ? <div className="form-success">{actionMessage}</div> : null}
        <div className="ip-submenu" role="tablist" aria-label="Secoes de IPs">
          {[
            { id: "addresses", label: "Enderecos" },
            { id: "subnets", label: "Subredes" },
            { id: "links", label: "Links" },
          ].map((item) => (
            <button
              type="button"
              key={item.id}
              className={ipSection === item.id ? "active" : ""}
              onClick={() => {
                setIpSection(item.id as "addresses" | "subnets" | "links");
                setPage(1);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="ip-tools">
          {ipSection === "addresses" ? (
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
            <option value="">Todos status</option>
            <option value="Usado">Usado</option>
            <option value="Livre">Livre</option>
            <option value="Reservado">Reservado</option>
          </select>
          ) : null}
          <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}>
            <option value="">Todas categorias</option>
            {filterCategories.map((category) => (
              <option value={category} key={category}>{category}</option>
            ))}
          </select>
        </div>
        <DirectoryTools
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          page={page}
          total={ipSection === "subnets" ? filteredNetworks.length : ipSection === "links" ? filteredLinks.length : filteredItems.length}
          onPageChange={setPage}
          placeholder={ipSection === "subnets" ? "Procurar rede, VLAN ou categoria" : ipSection === "links" ? "Procurar link, URL ou categoria" : "Procurar IP, local, categoria ou observacao"}
          pageSizeOverride={12}
        />
        {ipSection === "subnets" ? (
          <IpSubnetsTable summaries={paginate(filteredNetworks, page, 12)} onEditVlan={openVlanModal} />
        ) : ipSection === "links" ? (
          <IpLinksTable links={paginate(filteredLinks, page, 12)} onEdit={openEditLink} />
        ) : (
          <IpTable items={paginate(filteredItems, page, 12)} onEdit={openEditIp} />
        )}
      </section>

      {editOpen && editingItem ? (
        <IpEditModal
          item={editingItem}
          saving={saving}
          error={actionError}
          onSave={saveIp}
          onDelete={editingItem.id ? removeIp : undefined}
          onClose={closeEditIp}
        />
      ) : null}

      {renameOpen ? (
        <IpCategoryModal
          categories={ipDetails.categories}
          selectedCategory={renamingCategory}
          saving={saving}
          error={actionError}
          onSave={saveCategoryName}
          onClose={closeRenameCategory}
        />
      ) : null}

      {networkOpen ? (
        <IpNetworkModal
          saving={saving}
          error={actionError}
          onSave={saveNetwork}
          onClose={closeCreateNetwork}
        />
      ) : null}

      {vlanTarget ? (
        <IpVlanModal
          network={vlanTarget}
          saving={saving}
          error={actionError}
          onSave={saveNetworkVlan}
          onClose={closeVlanModal}
        />
      ) : null}

      {linkOpen && editingLink ? (
        <IpLinkModal
          link={editingLink}
          saving={saving}
          error={actionError}
          onSave={saveLink}
          onDelete={editingLink.id ? removeLink : undefined}
          onClose={closeLinkModal}
        />
      ) : null}
    </>
  );
}

function HealthTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "good" | "warn" | "danger";
}) {
  return (
    <div className={`health-tile ${tone}`}>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TvMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
  tone: "good" | "warn" | "danger" | "calm";
}) {
  return (
    <div className={`tv-metric ${tone}`}>
      <Icon size={22} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function TicketStatusCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  detail: string;
  tone: "good" | "warn" | "danger" | "calm" | "neutral";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`ticket-status-card ${tone} ${active ? "active" : ""}`} type="button" onClick={onClick}>
      <div>
        <Icon size={19} />
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </button>
  );
}

function percentOf(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function TvEventFeed({ adSummary, adDetails }: { adSummary: AdSummary; adDetails: AdDetails }) {
  const lockoutEvents = adDetails.lockouts.slice(0, 3).map((lockout) => ({
    title: `${lockout.user || lockout.cn} bloqueado`,
    detail: lockout.department || "Active Directory",
    tone: "danger" as const,
    time: formatWindowsFileTime(lockout.lockoutTime),
  }));
  const operationalEvents = [
    {
      title: adSummary.users.locked ? "Contas bloqueadas requerem acao" : "Sem bloqueios ativos",
      detail: "Active Directory",
      tone: adSummary.users.locked ? ("warn" as const) : ("good" as const),
      time: "Agora",
    },
    {
      title: `${adSummary.users.enabled} usuarios habilitados`,
      detail: `${adSummary.users.disabled} contas desativadas`,
      tone: "good" as const,
      time: "AD",
    },
    {
      title: `${adSummary.computers.total} maquinas no dominio`,
      detail: `${adSummary.computers.inactive30d} inativas em 30d`,
      tone: adSummary.computers.inactive30d ? ("warn" as const) : ("good" as const),
      time: "AD",
    },
  ];
  const events = [...lockoutEvents, ...operationalEvents].slice(0, 6);

  return (
    <div className="tv-event-feed">
      {events.map((event) => (
        <div className={`tv-event ${event.tone}`} key={`${event.title}-${event.time}`}>
          <i />
          <div>
            <strong>{event.title}</strong>
            <span>{event.detail}</span>
          </div>
          <small>{event.time}</small>
        </div>
      ))}
    </div>
  );
}

function CreateUserModal({
  form,
  loading,
  message,
  error,
  ous,
  domains,
  groups,
  ousLoading,
  ousError,
  onChange,
  onSubmit,
  onClose,
}: {
  form: CreateUserForm;
  loading: boolean;
  message: string;
  error: string;
  ous: AdOu[];
  domains: AdDomainOption[];
  groups: ApiAdGroup[];
  ousLoading: boolean;
  ousError: string;
  onChange: (field: keyof CreateUserForm, value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const domainFromTargetOu = domains.find((domain) => form.targetOu.endsWith(domain.baseDn)) || domains[0];
  const [selectedDomainBaseDn, setSelectedDomainBaseDn] = useState(domainFromTargetOu?.baseDn || "");
  const selectedDomain = domains.find((domain) => domain.baseDn === selectedDomainBaseDn) || domainFromTargetOu;
  const domainOus = selectedDomain
    ? ous.filter((ou) => ou.distinguishedName.toLowerCase().endsWith(selectedDomain.baseDn.toLowerCase()))
    : ous;
  const visibleOus = domainOus.length ? domainOus : ous;
  const [managerPreview, setManagerPreview] = useState<ResolvedUserIdentity | null>(null);
  const [managerPreviewLoading, setManagerPreviewLoading] = useState(false);
  const [managerPreviewError, setManagerPreviewError] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"general" | "account" | "telephones" | "organization" | "groups" | "profile">("general");
  const selectedGroups = parseGroupInput(form.groups);
  const visibleGroups = filterItems(groups, groupSearch, (group) => [
    group.cn,
    group.description,
    group.distinguishedName,
  ]).slice(0, 8);

  useEffect(() => {
    const identity = form.managerDn.trim();
    setManagerPreview(null);
    setManagerPreviewError("");

    if (!identity) {
      setManagerPreviewLoading(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setManagerPreviewLoading(true);

      try {
        const resolved = await adRequest<ResolvedUserIdentity>(`/api/ad/users/resolve/${encodeURIComponent(identity)}`, {
          method: "GET",
        });
        setManagerPreview(resolved);
      } catch (previewError) {
        setManagerPreviewError(previewError instanceof Error ? previewError.message : "Responsavel nao encontrado.");
      } finally {
        setManagerPreviewLoading(false);
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [form.managerDn]);

  useEffect(() => {
    if (!selectedDomainBaseDn && domainFromTargetOu?.baseDn) {
      setSelectedDomainBaseDn(domainFromTargetOu.baseDn);
    }
  }, [domainFromTargetOu?.baseDn, selectedDomainBaseDn]);

  function addInitialGroup(group: ApiAdGroup) {
    const value = group.distinguishedName || group.cn;
    if (selectedGroups.some((selected) => selected.toLowerCase() === value.toLowerCase())) return;
    onChange("groups", [...selectedGroups, value].join("\n"));
  }

  function removeInitialGroup(groupIdentity: string) {
    onChange(
      "groups",
      selectedGroups.filter((selected) => selected !== groupIdentity).join("\n"),
    );
  }

  function handleDomainChange(baseDn: string) {
    setSelectedDomainBaseDn(baseDn);
    const matchingOus = ous.filter((ou) => ou.distinguishedName.toLowerCase().endsWith(baseDn.toLowerCase()));
    const nextOu = (matchingOus.length ? matchingOus : ous)[0]?.distinguishedName || baseDn;
    onChange("targetOu", nextOu);
  }

  const createTabs = [
    { id: "general", label: "Geral" },
    { id: "account", label: "Conta" },
    { id: "telephones", label: "Telefones" },
    { id: "organization", label: "Organizacao" },
    { id: "groups", label: "Grupos" },
    { id: "profile", label: "Perfil" },
  ] as const;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Criar usuario do AD">
      <div className="user-modal create-user-modal">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Provisionamento AD</p>
            <h2>Criar usuario</h2>
            <span>Conta criada desativada para validacao</span>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="Fechar" aria-label="Fechar criacao de usuario">
            <X size={18} />
          </button>
        </header>

        {error ? <div className="action-feedback error">{error}</div> : null}
        {message ? <div className="action-feedback success">{message}</div> : null}
        {ousError ? <div className="action-feedback error">{ousError}</div> : null}

        <form className="create-user-form modal-create-form" onSubmit={onSubmit}>
          <div className="ad-properties-tabs" role="tablist" aria-label="Abas de criacao do usuario">
            {createTabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="ad-properties-card">
            <div className="ad-user-preview-strip">
              <UserCheck size={32} />
              <div>
                <strong>{form.displayName || [form.givenName, form.sn].filter(Boolean).join(" ") || "Novo usuario"}</strong>
                <span>{form.samAccountName || "login pendente"}</span>
              </div>
            </div>

            {activeTab === "general" ? (
              <section className="modal-section modal-section-wide">
                <h3>Geral</h3>
                <div className="create-user-grid">
                  <EditableField label="Nome" value={form.givenName} onChange={(value) => onChange("givenName", value)} required />
                  <EditableField label="Sobrenome" value={form.sn} onChange={(value) => onChange("sn", value)} required />
                  <EditableField label="Nome exibido" value={form.displayName} onChange={(value) => onChange("displayName", value)} required />
                  <EditableField label="Descricao" value={form.description} onChange={(value) => onChange("description", value)} required />
                  <EditableField label="Escritorio" value={form.office} onChange={(value) => onChange("office", value)} required />
                  <EditableField label="E-mail" value={form.mail} onChange={(value) => onChange("mail", value)} required />
                  <EditableField label="Pagina web" value={form.webPage} onChange={(value) => onChange("webPage", value)} />
                </div>
              </section>
            ) : null}

            {activeTab === "account" ? (
              <section className="modal-section modal-section-wide">
                <h3>Conta</h3>
                <div className="create-user-grid">
                  <EditableField label="Registro/Login" value={form.samAccountName} onChange={(value) => onChange("samAccountName", value)} required />
                  <div className="detail-item">
                    <span>UPN</span>
                    <strong>{form.samAccountName ? `${form.samAccountName}@${AD_UPN_SUFFIX}` : `login@${AD_UPN_SUFFIX}`}</strong>
                  </div>
                  <SelectField
                    label="Dominio"
                    value={selectedDomain?.baseDn || ""}
                    onChange={handleDomainChange}
                    options={domains.map((domain) => ({ label: domain.name, value: domain.baseDn }))}
                    placeholder="Dominio do AD"
                  />
                  <SelectField
                    label="OU destino"
                    value={form.targetOu}
                    onChange={(value) => onChange("targetOu", value)}
                    options={visibleOus.map((ou) => ({ label: ouLabel(ou), value: ou.distinguishedName }))}
                    placeholder={ousLoading ? "Carregando OUs..." : "Selecione a OU"}
                    required
                  />
                  <EditableField label="Senha inicial" value={form.initialPassword} onChange={(value) => onChange("initialPassword", value)} placeholder="Obrigatoria para ativar ao criar" />
                  <label className="field-control checkbox-field">
                    <span>Ativacao</span>
                    <label>
                      <input
                        type="checkbox"
                        checked={form.enableOnCreate === "true"}
                        onChange={(event) => onChange("enableOnCreate", event.target.checked ? "true" : "")}
                      />
                      Ativar usuario apos definir senha
                    </label>
                  </label>
                </div>
              </section>
            ) : null}

            {activeTab === "telephones" ? (
              <section className="modal-section modal-section-wide">
                <h3>Telefones</h3>
                <div className="create-user-grid">
                  <EditableField label="Telefone" value={form.telephoneNumber} onChange={(value) => onChange("telephoneNumber", value)} />
                  <EditableField label="Celular" value={form.mobile} onChange={(value) => onChange("mobile", value)} />
                </div>
              </section>
            ) : null}

            {activeTab === "organization" ? (
              <section className="modal-section modal-section-wide">
                <h3>Organizacao</h3>
                <div className="create-user-grid">
                  <EditableField label="Departamento" value={form.department} onChange={(value) => onChange("department", value)} required />
                  <EditableField label="Cargo" value={form.title} onChange={(value) => onChange("title", value)} required />
                  <EditableField label="Empresa" value={form.company} onChange={(value) => onChange("company", value)} required />
                  <EditableField label="Matricula/ID" value={form.employeeID} onChange={(value) => onChange("employeeID", value)} />
                  <EditableField label="Numero funcionario" value={form.employeeNumber} onChange={(value) => onChange("employeeNumber", value)} />
                  <EditableField label="Responsavel" value={form.managerDn} onChange={(value) => onChange("managerDn", value)} required />
                  <ManagerPreview preview={managerPreview} loading={managerPreviewLoading} error={managerPreviewError} />
                </div>
              </section>
            ) : null}

            {activeTab === "groups" ? (
              <section className="modal-section modal-section-wide">
                <h3>Grupos iniciais</h3>
                <label className="field-control">
                  <span>Procurar grupo</span>
                  <input value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} placeholder="Digite parte do nome ou descricao" />
                </label>
                {selectedGroups.length ? (
                  <div className="group-chip-list selected-group-list">
                    {selectedGroups.map((groupIdentity) => (
                      <span className="group-chip manageable" key={groupIdentity} title={groupIdentity}>
                        {groupNameFromIdentity(groupIdentity)}
                        <button type="button" onClick={() => removeInitialGroup(groupIdentity)} title="Remover grupo" aria-label="Remover grupo">
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="initial-group-picker">
                  {visibleGroups.length ? (
                    visibleGroups.map((group) => {
                      const identity = group.distinguishedName || group.cn;
                      const isSelected = selectedGroups.some((selected) => selected.toLowerCase() === identity.toLowerCase());
                      return (
                        <button type="button" key={identity} onClick={() => addInitialGroup(group)} disabled={isSelected}>
                          <div>
                            <strong>{group.cn}</strong>
                            <span>{group.description || extractOu(group.distinguishedName)}</span>
                          </div>
                          <small>{isSelected ? "Adicionado" : "Adicionar"}</small>
                        </button>
                      );
                    })
                  ) : (
                    <EmptyState title="Nenhum grupo encontrado" detail="Use a busca para localizar grupos do AD." />
                  )}
                </div>
              </section>
            ) : null}

            {activeTab === "profile" ? (
              <section className="modal-section modal-section-wide">
                <h3>Perfil</h3>
                <div className="create-user-grid">
                  <EditableField label="Caminho do perfil" value={form.profilePath} onChange={(value) => onChange("profilePath", value)} />
                  <EditableField label="Script de logon" value={form.scriptPath} onChange={(value) => onChange("scriptPath", value)} />
                  <EditableField label="Pasta base" value={form.homeDirectory} onChange={(value) => onChange("homeDirectory", value)} />
                  <EditableField label="Unidade" value={form.homeDrive} onChange={(value) => onChange("homeDrive", value)} placeholder="H:" />
                </div>
              </section>
            ) : null}
          </div>

          <div className="modal-actions">
            <button className="primary-action" type="submit" disabled={loading || !form.targetOu}>
              <Save size={16} />
              {loading ? "Criando" : "Criar usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddUserToGroupModal({
  groups,
  onClose,
  onRefreshAd,
}: {
  groups: ApiAdGroup[];
  onClose: () => void;
  onRefreshAd: () => Promise<void>;
}) {
  const [identity, setIdentity] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<ApiAdGroup | null>(null);
  const [userPreview, setUserPreview] = useState<ResolvedUserIdentity | null>(null);
  const [userPreviewLoading, setUserPreviewLoading] = useState(false);
  const [userPreviewError, setUserPreviewError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const visibleGroups = filterItems(groups, groupSearch, (group) => [
    group.cn,
    group.description,
    group.distinguishedName,
  ]).slice(0, 8);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const value = identity.trim();
    setUserPreview(null);
    setUserPreviewError("");
    setActionMessage("");

    if (!value) {
      setUserPreviewLoading(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setUserPreviewLoading(true);

      try {
        const resolved = await adRequest<ResolvedUserIdentity>(`/api/ad/users/resolve/${encodeURIComponent(value)}`, {
          method: "GET",
        });
        setUserPreview(resolved);
      } catch (previewError) {
        setUserPreviewError(previewError instanceof Error ? previewError.message : "Usuario nao encontrado.");
      } finally {
        setUserPreviewLoading(false);
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [identity]);

  async function submitGroupAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError("");
    setActionMessage("");

    if (!userPreview?.profile.samAccountName || !selectedGroup) {
      setActionError("Selecione um usuario valido e um grupo.");
      return;
    }

    setActionLoading(true);

    try {
      await adRequest<AdUserDetails>(`/api/ad/users/${encodeURIComponent(userPreview.profile.samAccountName)}/groups`, {
        method: "POST",
        body: { group: selectedGroup.distinguishedName || selectedGroup.cn },
      });
      setActionMessage(`${userPreview.profile.samAccountName} adicionado ao grupo ${selectedGroup.cn}.`);
      await onRefreshAd();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Nao foi possivel adicionar o usuario ao grupo.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Adicionar usuario em grupo">
      <div className="user-modal groups-modal">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Provisionamento AD</p>
            <h2>Adicionar em grupo</h2>
            <span>Busque o usuario por registro, login ou DN</span>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="Fechar" aria-label="Fechar adicionar em grupo">
            <X size={18} />
          </button>
        </header>

        {actionError ? <div className="action-feedback error">{actionError}</div> : null}
        {actionMessage ? <div className="action-feedback success">{actionMessage}</div> : null}

        <form className="modal-create-form group-action-layout" onSubmit={submitGroupAdd}>
          <section className="modal-section">
            <h3>Usuario</h3>
            <label className="field-control">
              <span>Registro, login ou DN</span>
              <input value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="Ex: 6008" autoFocus />
            </label>
            <UserIdentityPreview preview={userPreview} loading={userPreviewLoading} error={userPreviewError} />
          </section>

          <section className="modal-section">
            <h3>Grupo</h3>
            <label className="field-control">
              <span>Procurar grupo</span>
              <input value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} placeholder="Nome, descricao ou OU" />
            </label>
            {selectedGroup ? (
              <div className="group-chip-list selected-group-list">
                <span className="group-chip manageable" title={selectedGroup.distinguishedName}>
                  {selectedGroup.cn}
                  <button type="button" onClick={() => setSelectedGroup(null)} title="Remover selecao" aria-label="Remover grupo selecionado">
                    <X size={13} />
                  </button>
                </span>
              </div>
            ) : null}
            <div className="initial-group-picker compact-group-picker">
              {visibleGroups.length ? (
                visibleGroups.map((group) => {
                  const isSelected = selectedGroup?.distinguishedName === group.distinguishedName;
                  return (
                    <button type="button" key={group.distinguishedName || group.cn} onClick={() => setSelectedGroup(group)} disabled={isSelected}>
                      <div>
                        <strong>{group.cn}</strong>
                        <span>{group.description || extractOu(group.distinguishedName)}</span>
                      </div>
                      <small>{isSelected ? "Selecionado" : `${group.memberCount} membros`}</small>
                    </button>
                  );
                })
              ) : (
                <EmptyState title="Nenhum grupo encontrado" detail="Digite parte do nome do grupo." />
              )}
            </div>
          </section>

          <div className="modal-actions modal-section-wide">
            <button className="primary-action" type="submit" disabled={actionLoading || !userPreview || !selectedGroup}>
              <Plus size={16} />
              {actionLoading ? "Adicionando" : "Adicionar ao grupo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GroupsDirectoryModal({ groups, onClose }: { groups: ApiAdGroup[]; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filteredGroups = filterItems(groups, search, (group) => [
    group.cn,
    group.description,
    group.distinguishedName,
    String(group.memberCount),
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Listar grupos do AD">
      <div className="user-modal groups-modal">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Grupos do AD</p>
            <h2>Listar grupos</h2>
            <span>{filteredGroups.length}/{groups.length} grupos encontrados</span>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="Fechar" aria-label="Fechar lista de grupos">
            <X size={18} />
          </button>
        </header>

        <section className="modal-create-form">
          <DirectoryTools
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            page={page}
            total={filteredGroups.length}
            onPageChange={setPage}
            placeholder="Procurar grupo, descricao, membros ou OU"
          />
          <AdGroupsList groups={paginate(filteredGroups, page)} />
        </section>
      </div>
    </div>
  );
}

function TvAdOverviewPanel({
  adSummary,
  adDetails,
  standardIssues,
}: {
  adSummary: AdSummary;
  adDetails: AdDetails;
  standardIssues: number;
}) {
  const enabledPercent = percentOf(adSummary.users.enabled, adSummary.users.total);
  const disabledPercent = percentOf(adSummary.users.disabled, adSummary.users.total);
  const computerPercent = percentOf(adSummary.computers.domainJoined, adSummary.computers.total);

  const stats = [
    { label: "Usuarios habilitados", value: adSummary.users.enabled, detail: `${enabledPercent}% do total`, tone: "good" },
    { label: "Usuarios desativados", value: adSummary.users.disabled, detail: `${disabledPercent}% do total`, tone: adSummary.users.disabled ? "warn" : "good" },
    { label: "Maquinas no dominio", value: adSummary.computers.domainJoined, detail: `${computerPercent}% inventariado`, tone: "good" },
    { label: "Cadastro incompleto", value: standardIssues, detail: "usuarios ativos", tone: standardIssues ? "warn" : "good" },
    { label: "Bloqueios ativos", value: adSummary.users.locked, detail: `${adDetails.lockouts.length} listados`, tone: adSummary.users.locked ? "danger" : "good" },
    { label: "Eventos coletados", value: adDetails.lockoutEvents.length, detail: "4740 / 24h", tone: adDetails.lockoutEventErrors.length ? "warn" : "good" },
  ];

  return (
    <div className="tv-ad-live-grid">
      {stats.map((stat) => (
        <div className={`tv-ad-live-tile ${stat.tone}`} key={stat.label}>
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
          <small>{stat.detail}</small>
        </div>
      ))}
    </div>
  );
}

function TvStandardUsersPanel({ items }: { items: UserStandardItem[] }) {
  const visibleItems = items.slice(0, 5);

  if (!visibleItems.length) {
    return <EmptyState title="Cadastro em ordem" detail="Nenhum usuario ativo fora do padrao nesta coleta." />;
  }

  return (
    <div className="tv-compact-list">
      {visibleItems.map(({ user, missingFields }) => (
        <div className="tv-compact-row warn" key={user.distinguishedName || user.samAccountName}>
          <div>
            <strong>{user.displayName || user.cn || user.samAccountName}</strong>
            <span>{user.department || "Sem departamento"}</span>
          </div>
          <small>{formatMissingFields(missingFields)}</small>
        </div>
      ))}
    </div>
  );
}

function TvComputersPanel({ computers }: { computers: AdComputer[] }) {
  const visibleComputers = computers.slice(0, 5);

  if (!visibleComputers.length) {
    return <EmptyState title="Maquinas nao carregadas" detail="A API ainda nao retornou computadores do dominio." />;
  }

  return (
    <div className="tv-compact-list">
      {visibleComputers.map((computer) => (
        <div className="tv-compact-row" key={computer.distinguishedName || computer.cn}>
          <div>
            <strong>{computer.cn}</strong>
            <span>{computer.dNSHostName || "Sem DNS"}</span>
          </div>
          <small>{computer.operatingSystem || "SO nao informado"}</small>
        </div>
      ))}
    </div>
  );
}

function TvGroupsPanel({ groups }: { groups: ApiAdGroup[] }) {
  const visibleGroups = [...groups]
    .sort((first, second) => second.memberCount - first.memberCount)
    .slice(0, 5);

  if (!visibleGroups.length) {
    return <EmptyState title="Grupos nao carregados" detail="A API ainda nao retornou grupos do AD." />;
  }

  return (
    <div className="tv-compact-list">
      {visibleGroups.map((group) => (
        <div className="tv-compact-row" key={group.distinguishedName || group.cn}>
          <div>
            <strong>{group.cn}</strong>
            <span>{group.description || "Sem descricao"}</span>
          </div>
          <small>{group.memberCount} membros</small>
        </div>
      ))}
    </div>
  );
}

function TvLockoutEventsPanel({ events, errors }: { events: LockoutEvent[]; errors: string[] }) {
  const visibleEvents = events.slice(0, 5);

  if (!visibleEvents.length) {
    return <EmptyState title="Sem eventos recentes" detail={errors.length ? "A coleta de 4740 retornou erro nos DCs." : "Nenhum evento 4740 retornado nas ultimas 24h."} />;
  }

  return (
    <div className="tv-compact-list">
      {visibleEvents.map((event) => (
        <div className="tv-compact-row danger" key={`${event.domainController}-${event.targetUser}-${event.timeCreated}`}>
          <div>
            <strong>{event.targetUser}</strong>
            <span>{event.callerComputer || "Origem nao informada"}</span>
          </div>
          <small>{event.domainController} - {formatDateTime(event.timeCreated)}</small>
        </div>
      ))}
    </div>
  );
}

function AdCompliancePanel({ adSummary }: { adSummary: AdSummary }) {
  const dynamicCompliance = [
    {
      label: "Maquinas no dominio",
      current: adSummary.computers.domainJoined,
      expected: adSummary.computers.total,
      status: "Atencao",
    },
    {
      label: "Usuarios com cadastro OK",
      current: adSummary.users.enabled,
      expected: adSummary.users.total,
      status: "OK",
    },
    { label: "Usuarios fora do padrao", current: adSummary.users.disabled, expected: 0, status: "Revisar" },
    { label: "Maquinas inativas 30d", current: adSummary.computers.inactive30d, expected: 0, status: "Limpar" },
  ];

  return (
    <div className="ad-grid">
      <div className="inventory-strip">
        <div>
          <CheckCircle2 size={20} />
          <strong>{adSummary.users.enabled}</strong>
          <span>usuarios OK</span>
        </div>
        <div>
          <XCircle size={20} />
          <strong>{adSummary.users.disabled}</strong>
          <span>fora do padrao</span>
        </div>
        <div>
          <Monitor size={20} />
          <strong>{adSummary.computers.inactive30d}</strong>
          <span>maquinas inativas</span>
        </div>
      </div>
      <div className="compliance-stack">
        {dynamicCompliance.map((item) => (
          <ComplianceBar key={item.label} {...item} />
        ))}
      </div>
    </div>
  );
}

function LockoutPanel({
  adSummary,
  lockouts,
  events = [],
  allEvents,
  eventErrors = [],
  search = "",
  onSearchChange,
  page = 1,
  totalEvents = 0,
  onPageChange,
  onRefreshAd,
}: {
  adSummary: AdSummary;
  lockouts: ApiLockout[];
  events?: LockoutEvent[];
  allEvents?: LockoutEvent[];
  eventErrors?: string[];
  search?: string;
  onSearchChange?: (value: string) => void;
  page?: number;
  totalEvents?: number;
  onPageChange?: (page: number) => void;
  onRefreshAd?: () => Promise<void>;
}) {
  const eventsForLookup = allEvents || events;
  const [unlockingUser, setUnlockingUser] = useState("");
  const [unlockMessage, setUnlockMessage] = useState("");
  const [unlockError, setUnlockError] = useState("");

  async function unlockUser(lockout: ApiLockout) {
    const login = lockout.user || lockout.cn;
    if (!login || !window.confirm(`Desbloquear a conta ${login}?`)) {
      return;
    }

    setUnlockingUser(login);
    setUnlockMessage("");
    setUnlockError("");

    try {
      await adRequest(`/api/ad/users/${encodeURIComponent(login)}/unlock`, { method: "POST" });
      setUnlockMessage(`Conta ${login} desbloqueada.`);
      await onRefreshAd?.();
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : "Nao foi possivel desbloquear a conta.");
    } finally {
      setUnlockingUser("");
    }
  }

  return (
    <>
      <div className="lockout-summary">
        <div>
          <strong>{adSummary.users.locked}</strong>
          <span>bloqueios agora</span>
        </div>
        <div>
          <strong>{lockouts.length}</strong>
          <span>em destaque</span>
        </div>
      </div>
      {unlockError ? <div className="action-feedback error lockout-feedback">{unlockError}</div> : null}
      {unlockMessage ? <div className="action-feedback success lockout-feedback">{unlockMessage}</div> : null}
      <div className="lockout-list">
        {lockouts.length ? (
          lockouts.map((lockout) => (
            <ApiLockoutRow
              key={`${lockout.user}-${lockout.lockoutTime}`}
              lockout={lockout}
              event={findLockoutEvent(lockout, eventsForLookup)}
              hasEventErrors={Boolean(eventErrors.length)}
              onUnlock={unlockUser}
              unlocking={unlockingUser === (lockout.user || lockout.cn)}
            />
          ))
        ) : (
          <EmptyState title="Nenhuma conta bloqueada agora" detail="O AD nao retornou bloqueios ativos." />
        )}
      </div>
      {onSearchChange && onPageChange ? (
        <div className="event-log-section">
          <DirectoryTools
            value={search}
            onChange={onSearchChange}
            page={page}
            total={totalEvents}
            onPageChange={onPageChange}
            placeholder="Procurar usuario, maquina de origem ou DC"
          />
          <LockoutEventsList events={events} errors={eventErrors} />
        </div>
      ) : null}
    </>
  );
}

function ApiLockoutRow({
  lockout,
  event,
  hasEventErrors,
  onUnlock,
  unlocking,
}: {
  lockout: ApiLockout;
  event?: LockoutEvent;
  hasEventErrors: boolean;
  onUnlock: (lockout: ApiLockout) => void;
  unlocking: boolean;
}) {
  const origin = event?.callerComputer || (hasEventErrors ? "Sem acesso ao 4740" : "Origem nao encontrada");
  const eventLabel = event ? `${event.domainController} - 4740` : "AD";

  return (
    <div className="lockout-row critico">
      <div className="lockout-main">
        <div className="lockout-user">
          <strong>{lockout.user || lockout.cn}</strong>
          <span>{lockout.department || "Sem departamento"}</span>
        </div>
        <SeverityBadge severity="Critico" />
      </div>
      <div className="lockout-meta">
        <span>
          Conta
          <strong>{lockout.cn || lockout.user}</strong>
        </span>
        <span>
          Origem
          <strong title={origin}>{origin}</strong>
        </span>
        <span>
          Evento
          <strong title={eventLabel}>{eventLabel}</strong>
        </span>
      </div>
      <div className="lockout-footer">
        <span>Conta bloqueada no dominio - {formatWindowsFileTime(lockout.lockoutTime)}</span>
        <button className="small-action" type="button" onClick={() => onUnlock(lockout)} disabled={unlocking}>
          {unlocking ? "Desbloqueando" : "Desbloquear"}
        </button>
      </div>
    </div>
  );
}

function AdUsersList({ users, onSelect }: { users: AdUser[]; onSelect: (user: AdUser) => void }) {
  if (!users.length) {
    return <EmptyState title="Usuarios nao carregados" detail="A API nao retornou usuarios nesta coleta." />;
  }

  return (
    <div className="directory-list">
      {users.map((user) => (
        <button
          className="directory-row directory-button"
          key={user.distinguishedName || user.samAccountName}
          onClick={() => onSelect(user)}
          type="button"
        >
          <div>
            <strong>{user.cn || user.samAccountName}</strong>
            <span>{user.samAccountName}</span>
          </div>
          <div>
            <span>{user.department || "Sem departamento"}</span>
            <small>{user.mail || "Sem e-mail"}</small>
          </div>
          <StatusPill label={user.locked ? "Bloqueado" : user.enabled ? "Ativo" : "Desativado"} />
        </button>
      ))}
    </div>
  );
}

function IntuneFilterCard({
  active,
  count,
  icon: Icon,
  label,
  tone,
  onClick,
}: {
  active: boolean;
  count: number;
  icon: LucideIcon;
  label: string;
  tone: "good" | "warn" | "danger" | "calm";
  onClick: () => void;
}) {
  return (
    <button className={`intune-filter-card ${tone} ${active ? "active" : ""}`} type="button" onClick={onClick}>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  );
}

function IntuneDevicesList({ devices, onSelect }: { devices: IntuneDevice[]; onSelect: (device: IntuneDevice) => void }) {
  if (!devices.length) {
    return <EmptyState title="Dispositivos nao carregados" detail="O Intune nao retornou dispositivos nesta coleta." />;
  }

  return (
    <div className="intune-table" role="table" aria-label="Dispositivos Intune">
      <div className="intune-table-head" role="row">
        <span>Dispositivo</span>
        <span>Usuario</span>
        <span>Inventario</span>
        <span>Seguranca</span>
        <span>Ultimo sync</span>
      </div>
      {devices.map((device) => (
        <button className={`intune-table-row ${intuneDeviceRiskReasons(device).length ? "risk" : ""}`} key={device.id || device.deviceName} type="button" onClick={() => onSelect(device)} role="row">
          <div>
            <strong>{device.deviceName || "Sem nome"}</strong>
            <span>{formatIntuneOs(device)}</span>
          </div>
          <div>
            <strong>{device.userDisplayName || device.userPrincipalName || "Sem usuario"}</strong>
            <span>{device.userPrincipalName || device.emailAddress || "Sem e-mail"}</span>
          </div>
          <div>
            <strong>{[device.manufacturer, device.model].filter(Boolean).join(" ") || "Modelo nao informado"}</strong>
            <span>{device.serialNumber || "Serial nao informado"}</span>
          </div>
          <div className="intune-security-cell">
            <StatusPill label={intuneComplianceLabel(device.complianceState)} />
            <span>{device.isEncrypted ? "Criptografado" : "Sem BitLocker"}</span>
          </div>
          <div>
            <strong>{formatDateTime(device.lastSyncDateTime)}</strong>
            <span>{intuneRelativeDays(device.lastSyncDateTime)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function ServiceTicketsList({ tickets, onSelect }: { tickets: ServiceTicket[]; onSelect: (ticket: ServiceTicket) => void }) {
  if (!tickets.length) {
    return <EmptyState title="Chamados nao carregados" detail="O Milvus nao retornou chamados nesta coleta." />;
  }

  return (
    <div className="tickets-table" role="table" aria-label="Chamados Milvus">
      <div className="tickets-table-head" role="row">
        <span>Ticket</span>
        <span>Solicitante / Contato</span>
        <span>Assunto</span>
        <span>Categorias / Subcategorias</span>
        <span>Priori.</span>
        <span>St.</span>
        <span>Operador / Mesa</span>
        <span>Resposta / Solucao</span>
        <span>Criado</span>
        <span>Tarefas</span>
      </div>
      {tickets.map((ticket) => (
        <button className="tickets-table-row" key={ticket.id || ticket.code} type="button" onClick={() => onSelect(ticket)} role="row">
          <div>
            <strong>{ticket.code || ticket.id}</strong>
          </div>
          <div>
            <strong>{ticket.requester || "Nao informado"}</strong>
            <span>{ticket.contact || "Sem contato"}</span>
          </div>
          <div>
            <strong>{ticket.title}</strong>
            <span>{ticket.description || "Sem descricao"}</span>
          </div>
          <div>
            <strong>{ticket.category || "Sem categoria"}</strong>
            <span>{ticket.subcategory || "Sem subcategoria"}</span>
          </div>
          <span className="ticket-priority">{ticket.priority || "---"}</span>
          <span className={`ticket-status-dot ${isTicketClosed(ticket) ? "closed" : "open"}`} title={ticket.status || "Sem status"} />
          <div>
            <strong>{ticket.assignee || "---"}</strong>
            <span>{ticket.team || "Sem mesa"}</span>
          </div>
          <div>
            <strong>{ticket.solution || "Nao Possui"}</strong>
            <span>{ticket.sla || "Sem SLA"}</span>
          </div>
          <span className="ticket-date">{formatDateTime(ticket.createdAt)}</span>
          <div className="ticket-task-pills">
            <span>{ticket.tasksDone || 0}</span>
            <span>{ticket.tasksTotal || 0}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function buildIpNetworkSummaries(items: IpInventoryItem[]) {
  const map = new Map<string, IpNetworkSummary>();

  for (const item of items) {
    if (!item.network) continue;
    const key = `${item.category}:${item.network}`;
    const current = map.get(key) || {
      key,
      network: item.network,
      category: item.category,
      vlan: item.vlan,
      sourceSheet: item.sourceSheet,
      total: 0,
      used: 0,
      free: 0,
      reserved: 0,
    };

    current.total += 1;
    current.used += item.status === "Usado" ? 1 : 0;
    current.free += item.status === "Livre" ? 1 : 0;
    current.reserved += item.status === "Reservado" ? 1 : 0;
    if (!current.vlan && item.vlan) {
      current.vlan = item.vlan;
    } else if (current.vlan && item.vlan && current.vlan !== item.vlan) {
      current.vlan = "Mista";
    }
    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) => a.category.localeCompare(b.category) || a.network.localeCompare(b.network));
}

function IpTable({ items, onEdit }: { items: IpInventoryItem[]; onEdit: (item: IpInventoryItem) => void }) {
  if (!items.length) {
    return <EmptyState title="Nenhum IP encontrado" detail="Ajuste os filtros ou reimporte a planilha." />;
  }

  return (
    <div className="ip-table" role="table" aria-label="Inventario de IPs">
      <div className="ip-table-head" role="row">
        <span>IP</span>
        <span>VLAN</span>
        <span>Nome / Local</span>
        <span>Categoria</span>
        <span>Status</span>
        <span>Origem</span>
        <span>Atualizado</span>
      </div>
      {items.map((item) => (
        <button className="ip-table-row" key={item.id} type="button" onClick={() => onEdit(item)} role="row">
          <strong>{item.ip}</strong>
          <span>{item.vlan || "-"}</span>
          <div>
            <strong>{item.name || item.location || "Sem descricao"}</strong>
            <span>{item.network || item.notes || "Sem observacao"}</span>
          </div>
          <span>{item.category}</span>
          <StatusPill label={item.status} />
          <span>{item.sourceSheet}</span>
          <span>{formatDateTime(item.updatedAt)}</span>
        </button>
      ))}
    </div>
  );
}

function IpSubnetsTable({ summaries, onEditVlan }: { summaries: IpNetworkSummary[]; onEditVlan: (network: IpNetworkSummary) => void }) {
  if (!summaries.length) {
    return <EmptyState title="Nenhuma subrede encontrada" detail="Crie uma rede ou preencha o campo Rede/CIDR nos IPs." />;
  }

  return (
    <div className="subnet-table" role="table" aria-label="Subredes">
      <div className="subnet-table-head" role="row">
        <span>Rede</span>
        <span>Categoria</span>
        <span>VLAN</span>
        <span>Usados</span>
        <span>Livres</span>
        <span>Reservados</span>
        <span>Acoes</span>
      </div>
      {summaries.map((summary) => (
        <div className="subnet-table-row" key={summary.key} role="row">
          <strong>{summary.network}</strong>
          <span>{summary.category}</span>
          <span>{summary.vlan || "-"}</span>
          <span>{summary.used} de {summary.total}</span>
          <span>{summary.free}</span>
          <span>{summary.reserved}</span>
          <button className="secondary-action compact-action" type="button" onClick={() => onEditVlan(summary)}>
            <Settings size={14} />
            VLAN
          </button>
        </div>
      ))}
    </div>
  );
}

function ipv4ToNumber(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return ((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3];
}

function linkContainsIp(link: IpInventoryLink, ip: string) {
  const ipNumber = ipv4ToNumber(ip);
  const baseIp = ipv4ToNumber(link.fortinetIp || link.gateway);
  const prefix = Number(link.mask.replace("/", ""));

  if (ipNumber === null || baseIp === null || !Number.isInteger(prefix) || prefix < 1 || prefix > 32) return false;

  const size = 2 ** (32 - prefix);
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  const network = (baseIp & mask) >>> 0;
  return ipNumber >= network && ipNumber <= network + size - 1;
}

function buildInternetLinkGroups(links: IpInventoryLink[]) {
  const circuits = links.filter((link) => link.type === "Circuito");
  const services = links.filter((link) => link.type === "Uso");
  const groups = circuits.map((circuit) => ({ circuit, services: [] as IpInventoryLink[] }));

  for (const service of services) {
    const byIp = service.usedIp && service.usedIp !== "*"
      ? groups.find((group) => group.circuit.provider === service.provider && linkContainsIp(group.circuit, service.usedIp))
      : null;
    const fallback = groups.find((group) => group.circuit.provider === service.provider);

    (byIp || fallback)?.services.push(service);
  }

  for (const service of services) {
    if (groups.some((group) => group.services.includes(service))) continue;
    groups.push({ circuit: service, services: [service] });
  }

  return groups;
}

function IpLinksTable({ links, onEdit }: { links: IpInventoryLink[]; onEdit: (link: IpInventoryLink) => void }) {
  if (!links.length) {
    return <EmptyState title="Nenhum link cadastrado" detail="Adicione os circuitos de internet e os IPs publicados em uso." />;
  }

  const groups = buildInternetLinkGroups(links);

  return (
    <div className="internet-links-table" role="table" aria-label="Links de internet">
      <div className="links-table-head" role="row">
        <span>Link</span>
        <span>Vel. / Porta</span>
        <span>Gateway / Mask</span>
        <span>Range</span>
        <span>IP Fortinet</span>
        <span>Servicos no link</span>
        <span>Status</span>
        <span>Acoes</span>
      </div>
      {groups.map(({ circuit, services }) => (
        <div className="links-table-row" key={circuit.id} role="row">
          <div>
            <strong>{circuit.provider || circuit.category}</strong>
            <span>{circuit.name}</span>
          </div>
          <div>
            <strong>{circuit.speed || "-"}</strong>
            <span>{circuit.port ? `Porta ${circuit.port}` : circuit.ports || "-"}</span>
          </div>
          <div>
            <strong>{circuit.gateway || "-"}</strong>
            <span>{circuit.mask || "-"}</span>
          </div>
          <span>{circuit.range || "-"}</span>
          <span>{circuit.fortinetIp || circuit.usedIp || "-"}</span>
          <div className="link-service-stack">
            {services.length ? services.map((service) => (
              <button className="service-chip" type="button" key={service.id} onClick={() => onEdit(service)}>
                <strong>{service.service || service.name}</strong>
                <span>{service.usedIp || "-"}{service.ports ? ` | ${service.ports}` : ""}</span>
              </button>
            )) : (
              <span>Nenhum servico informado</span>
            )}
          </div>
          <StatusPill label={circuit.status} />
          <div className="link-row-actions">
            <button className="secondary-action compact-action" type="button" onClick={() => onEdit(circuit)}>
              <Settings size={14} />
              Link
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function IpCategoryModal({
  categories,
  selectedCategory,
  saving,
  error,
  onSave,
  onClose,
}: {
  categories: string[];
  selectedCategory: string;
  saving: boolean;
  error: string;
  onSave: (from: string, to: string) => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState(selectedCategory);
  const [to, setTo] = useState(selectedCategory);

  useEffect(() => {
    setFrom(selectedCategory);
    setTo(selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="user-modal category-modal" role="dialog" aria-modal="true" aria-labelledby="category-modal-title">
        <header className="modal-header">
          <div>
            <span>INVENTARIO DE REDE</span>
            <h2 id="category-modal-title">Renomear categoria</h2>
            <span>{from || "Selecione uma categoria"}</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>

        <div className="modal-create-form">
          {error ? <div className="form-error">{error}</div> : null}
          <div className="category-form-grid">
            <label>
              <span>Categoria atual</span>
              <select
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setTo(event.target.value);
                }}
              >
                {categories.map((category) => (
                  <option value={category} key={category}>{category}</option>
                ))}
              </select>
            </label>
            <EditableField label="Novo nome" value={to} onChange={setTo} required />
          </div>
          <div className="modal-footer-actions">
            <button className="secondary-action" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary-action" type="button" onClick={() => onSave(from, to)} disabled={saving || !from || !to.trim()}>
              <Save size={16} />
              {saving ? "Salvando" : "Salvar categoria"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function IpNetworkModal({
  saving,
  error,
  onSave,
  onClose,
}: {
  saving: boolean;
  error: string;
  onSave: (payload: { cidr: string; category: string; vlan: string; sourceSheet: string }) => void;
  onClose: () => void;
}) {
  const [cidr, setCidr] = useState("");
  const [category, setCategory] = useState("");
  const [vlan, setVlan] = useState("");
  const [sourceSheet, setSourceSheet] = useState("");

  useEffect(() => {
    if (!category && cidr) {
      setCategory(cidr);
    }
  }, [category, cidr]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="user-modal category-modal" role="dialog" aria-modal="true" aria-labelledby="network-modal-title">
        <header className="modal-header">
          <div>
            <span>INVENTARIO DE REDE</span>
            <h2 id="network-modal-title">Nova rede</h2>
            <span>{cidr || "Informe uma rede CIDR"}</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>

        <div className="modal-create-form">
          {error ? <div className="form-error">{error}</div> : null}
          <div className="category-form-grid">
            <EditableField label="Rede CIDR" value={cidr} onChange={setCidr} required placeholder="192.168.20.0/24" />
            <EditableField label="Categoria" value={category} onChange={setCategory} required placeholder="Wi-Fi Visitantes" />
            <EditableField label="VLAN" value={vlan} onChange={setVlan} placeholder="20" />
            <EditableField label="Origem" value={sourceSheet} onChange={setSourceSheet} placeholder="Wi-Fi Visitantes" />
          </div>
          <div className="modal-footer-actions">
            <button className="secondary-action" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="primary-action"
              type="button"
              onClick={() => onSave({ cidr, category, vlan, sourceSheet: sourceSheet || category })}
              disabled={saving || !cidr.trim() || !category.trim()}
            >
              <Save size={16} />
              {saving ? "Criando" : "Criar rede"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function IpVlanModal({
  network,
  saving,
  error,
  onSave,
  onClose,
}: {
  network: IpNetworkSummary;
  saving: boolean;
  error: string;
  onSave: (network: IpNetworkSummary, vlan: string) => void;
  onClose: () => void;
}) {
  const [vlan, setVlan] = useState(network.vlan === "Mista" ? "" : network.vlan);

  useEffect(() => {
    setVlan(network.vlan === "Mista" ? "" : network.vlan);
  }, [network]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="user-modal category-modal" role="dialog" aria-modal="true" aria-labelledby="vlan-modal-title">
        <header className="modal-header">
          <div>
            <span>SUBREDE</span>
            <h2 id="vlan-modal-title">{network.network}</h2>
            <span>{network.category}</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>

        <div className="modal-create-form">
          {error ? <div className="form-error">{error}</div> : null}
          <div className="category-form-grid">
            <EditableField label="VLAN da rede" value={vlan} onChange={setVlan} required placeholder="9" />
          </div>
          <div className="modal-footer-actions">
            <button className="secondary-action" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary-action" type="button" onClick={() => onSave(network, vlan)} disabled={saving || !vlan.trim()}>
              <Save size={16} />
              {saving ? "Aplicando" : "Aplicar em todos os IPs"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function IpLinkModal({
  link,
  saving,
  error,
  onSave,
  onDelete,
  onClose,
}: {
  link: IpInventoryLink;
  saving: boolean;
  error: string;
  onSave: (link: IpInventoryLink) => void;
  onDelete?: (link: IpInventoryLink) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<IpInventoryLink>(link);

  useEffect(() => {
    setForm(link);
  }, [link]);

  function update(field: keyof IpInventoryLink, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="user-modal ip-modal" role="dialog" aria-modal="true" aria-labelledby="link-modal-title">
        <header className="modal-header">
          <div>
            <span>LINKS</span>
            <h2 id="link-modal-title">{form.name || "Novo link"}</h2>
            <span>{form.category || "Geral"}</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>

        <div className="modal-create-form">
          {error ? <div className="form-error">{error}</div> : null}
          <div className="create-user-grid">
            <EditableField label="Provedor" value={form.provider} onChange={(value) => {
              update("provider", value);
              if (!form.category || form.category === "Geral") update("category", value || "Geral");
            }} required />
            <SelectField
              label="Tipo"
              value={form.type}
              onChange={(value) => update("type", value)}
              placeholder="Selecione"
              options={[
                { label: "Circuito", value: "Circuito" },
                { label: "Uso", value: "Uso" },
              ]}
            />
            <EditableField label="Nome" value={form.name} onChange={(value) => update("name", value)} />
            <EditableField label="Categoria" value={form.category} onChange={(value) => update("category", value)} />
            <EditableField label="Velocidade" value={form.speed} onChange={(value) => update("speed", value)} placeholder="200, 1G..." />
            <EditableField label="IP Fortinet" value={form.fortinetIp} onChange={(value) => update("fortinetIp", value)} />
            <EditableField label="Porta" value={form.port} onChange={(value) => update("port", value)} />
            <EditableField label="Gateway" value={form.gateway} onChange={(value) => update("gateway", value)} />
            <EditableField label="Mask" value={form.mask} onChange={(value) => update("mask", value)} placeholder="/29" />
            <EditableField label="Qtd IP" value={form.ipCount} onChange={(value) => update("ipCount", value)} />
            <EditableField label="Range" value={form.range} onChange={(value) => update("range", value)} />
            <EditableField label="IP usado" value={form.usedIp} onChange={(value) => update("usedIp", value)} />
            <EditableField label="Local" value={form.location} onChange={(value) => update("location", value)} />
            <EditableField label="Servico" value={form.service} onChange={(value) => update("service", value)} />
            <EditableField label="Portas publicadas" value={form.ports} onChange={(value) => update("ports", value)} placeholder="80-443" />
            <SelectField
              label="Status"
              value={form.status}
              onChange={(value) => update("status", value)}
              placeholder="Selecione"
              options={[
                { label: "Ativo", value: "Ativo" },
                { label: "Atencao", value: "Atencao" },
                { label: "Inativo", value: "Inativo" },
              ]}
            />
            <EditableField label="URL/documentacao" value={form.url} onChange={(value) => update("url", value)} placeholder="https://..." />
            <EditableField label="Observacao" value={form.notes} onChange={(value) => update("notes", value)} wide multiline />
          </div>
          <div className="modal-footer-actions">
            {onDelete ? (
              <button className="danger-action" type="button" onClick={() => onDelete(form)} disabled={saving}>
                <Trash2 size={16} />
                Remover
              </button>
            ) : null}
            <button className="secondary-action" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary-action" type="button" onClick={() => onSave(form)} disabled={saving}>
              <Save size={16} />
              {saving ? "Salvando" : "Salvar"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function IpEditModal({
  item,
  saving,
  error,
  onSave,
  onDelete,
  onClose,
}: {
  item: IpInventoryItem;
  saving: boolean;
  error: string;
  onSave: (item: IpInventoryItem) => void;
  onDelete?: (item: IpInventoryItem) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<IpInventoryItem>(item);

  useEffect(() => {
    setForm(item);
  }, [item]);

  function update(field: keyof IpInventoryItem, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="user-modal ip-modal" role="dialog" aria-modal="true" aria-labelledby="ip-modal-title">
        <header className="modal-header">
          <div>
            <span>INVENTARIO DE REDE</span>
            <h2 id="ip-modal-title">{form.ip || "Novo IP"}</h2>
            <span>{form.category || "Categoria manual"}</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>

        <div className="modal-create-form">
          {error ? <div className="form-error">{error}</div> : null}
          <div className="create-user-grid">
            <EditableField label="IP" value={form.ip} onChange={(value) => update("ip", value)} required />
            <SelectField
              label="Status"
              value={form.status}
              onChange={(value) => update("status", value)}
              placeholder="Selecione"
              required
              options={[
                { label: "Usado", value: "Usado" },
                { label: "Livre", value: "Livre" },
                { label: "Reservado", value: "Reservado" },
              ]}
            />
            <EditableField label="Nome" value={form.name} onChange={(value) => update("name", value)} />
            <EditableField label="Local" value={form.location} onChange={(value) => update("location", value)} />
            <EditableField label="Categoria" value={form.category} onChange={(value) => update("category", value)} />
            <EditableField label="VLAN" value={form.vlan} onChange={(value) => update("vlan", value)} />
            <EditableField label="Rede/CIDR" value={form.network} onChange={(value) => update("network", value)} />
            <EditableField label="Origem" value={form.sourceSheet} onChange={(value) => update("sourceSheet", value)} />
            <EditableField label="Observacao" value={form.notes} onChange={(value) => update("notes", value)} wide multiline />
          </div>
          <div className="modal-footer-actions">
            {onDelete ? (
              <button className="danger-action" type="button" onClick={() => onDelete(form)} disabled={saving}>
                <Trash2 size={16} />
                Remover
              </button>
            ) : null}
            <button className="secondary-action" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary-action" type="button" onClick={() => onSave(form)} disabled={saving}>
              <Save size={16} />
              {saving ? "Salvando" : "Salvar"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function TicketDetailsModal({
  ticket,
  loading,
  error,
  actionError,
  actionLoading,
  onCloseTicket,
  onClose,
}: {
  ticket: ServiceTicket;
  loading: boolean;
  error: string;
  actionError: string;
  actionLoading: boolean;
  onCloseTicket: (ticket: ServiceTicket) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="user-modal ticket-details-modal" role="dialog" aria-modal="true" aria-labelledby="ticket-details-title">
        <header className="modal-header">
          <div>
            <span>CHAMADO MILVUS</span>
            <h2 id="ticket-details-title">{ticket.code || ticket.id} - {ticket.title}</h2>
            <span>{ticket.requester || "Solicitante nao informado"}</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>

        {error ? <div className="modal-error">{error}</div> : null}
        {actionError ? <div className="modal-error">{actionError}</div> : null}
        {loading ? <div className="modal-loading">Carregando chamado...</div> : null}

        <div className="modal-content-grid">
          <section className="modal-section">
            <h3>Atendimento</h3>
            <div className="detail-grid">
              <DetailItem label="Status" value={ticket.status} />
              <DetailItem label="Prioridade" value={ticket.priority} />
              <DetailItem label="Equipe" value={ticket.team} />
              <DetailItem label="Responsavel" value={ticket.assignee} />
              <DetailItem label="Categoria" value={ticket.category} />
              <DetailItem label="Subcategoria" value={ticket.subcategory} />
              <DetailItem label="SLA" value={ticket.sla} />
              <DetailItem label="Tarefas" value={`${ticket.tasksDone || 0}/${ticket.tasksTotal || 0}`} />
            </div>
          </section>

          <section className="modal-section">
            <h3>Solicitante</h3>
            <div className="detail-grid">
              <DetailItem label="Nome" value={ticket.requester} />
              <DetailItem label="Contato" value={ticket.contact} />
              <DetailItem label="E-mail" value={ticket.requesterEmail} />
              <DetailItem label="Aberto em" value={formatDateTime(ticket.createdAt)} />
              <DetailItem label="Atualizado em" value={formatDateTime(ticket.updatedAt)} />
            </div>
          </section>

          <section className="modal-section modal-section-wide">
            <h3>Descricao</h3>
            <p className="description-text">{ticket.description || "Sem descricao informada."}</p>
          </section>
          <section className="modal-section modal-section-wide">
            <h3>Resposta / Solucao</h3>
            <p className="description-text">{ticket.solution || "Nao possui resposta de solucao."}</p>
          </section>
        </div>

        <div className="modal-footer-actions">
          <button className="secondary-action" type="button" onClick={onClose}>
            Fechar janela
          </button>
          <button className="primary-action" type="button" onClick={() => onCloseTicket(ticket)} disabled={actionLoading || isTicketClosed(ticket)}>
            <CheckCircle2 size={16} />
            {actionLoading ? "Fechando" : isTicketClosed(ticket) ? "Chamado fechado" : "Fechar chamado"}
          </button>
        </div>
      </section>
    </div>
  );
}

function CreateTicketModal({
  form,
  loading,
  error,
  message,
  onChange,
  onSubmit,
  onClose,
}: {
  form: CreateTicketForm;
  loading: boolean;
  error: string;
  message: string;
  onChange: (field: keyof CreateTicketForm, value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="user-modal create-ticket-modal" role="dialog" aria-modal="true" aria-labelledby="create-ticket-title">
        <header className="modal-header">
          <div>
            <span>MILVUS</span>
            <h2 id="create-ticket-title">Abrir chamado</h2>
            <span>Enviar solicitacao para a fila de atendimento</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>

        <form className="modal-create-form" onSubmit={onSubmit}>
          {error ? <div className="form-error">{error}</div> : null}
          {message ? <div className="form-success">{message}</div> : null}

          <div className="create-user-grid">
            <EditableField label="Titulo" value={form.title} onChange={(value) => onChange("title", value)} wide required />
            <EditableField label="Solicitante" value={form.requester} onChange={(value) => onChange("requester", value)} required />
            <EditableField label="E-mail" value={form.requesterEmail} onChange={(value) => onChange("requesterEmail", value)} />
            <SelectField
              label="Equipe"
              value={form.team}
              onChange={(value) => onChange("team", value)}
              placeholder="Selecione"
              options={[
                { label: "Service Desk", value: "Service Desk" },
                { label: "Infra", value: "Infra" },
                { label: "Redes", value: "Redes" },
                { label: "Seguranca", value: "Seguranca" },
                { label: "Sistemas", value: "Sistemas" },
              ]}
            />
            <SelectField
              label="Prioridade"
              value={form.priority}
              onChange={(value) => onChange("priority", value)}
              placeholder="Selecione"
              options={[
                { label: "Baixa", value: "Baixa" },
                { label: "Media", value: "Media" },
                { label: "Alta", value: "Alta" },
                { label: "Critica", value: "Critica" },
              ]}
            />
            <EditableField label="Categoria" value={form.category} onChange={(value) => onChange("category", value)} />
            <EditableField label="Descricao" value={form.description} onChange={(value) => onChange("description", value)} wide multiline required />
          </div>

          <div className="modal-actions">
            <button className="primary-action" type="submit" disabled={loading}>
              <Save size={16} />
              {loading ? "Abrindo" : "Abrir chamado"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function IntuneDeviceModal({
  device,
  loading,
  error,
  onClose,
}: {
  device: IntuneDevice;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  const [lapsCredential, setLapsCredential] = useState<IntuneLapsCredential | null>(null);
  const [lapsLoading, setLapsLoading] = useState(false);
  const [lapsError, setLapsError] = useState("");
  const [lapsVisible, setLapsVisible] = useState(false);
  const [lapsCopied, setLapsCopied] = useState(false);

  useEffect(() => {
    setLapsCredential(null);
    setLapsLoading(false);
    setLapsError("");
    setLapsVisible(false);
    setLapsCopied(false);
  }, [device.id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function loadLapsCredential() {
    setLapsLoading(true);
    setLapsError("");
    setLapsCopied(false);
    setLapsVisible(false);

    try {
      const response = await authFetch(`/api/intune/devices/${encodeURIComponent(device.id)}/laps`);
      const payload = await parseApiPayload<{ credential?: IntuneLapsCredential; message?: string }>(response, {});

      if (!response.ok || !payload.credential) {
        throw new Error(payload.message || "Nao foi possivel carregar a senha LAPS.");
      }

      setLapsCredential(payload.credential);
    } catch (nextError) {
      setLapsCredential(null);
      setLapsError(nextError instanceof Error ? nextError.message : "Nao foi possivel carregar a senha LAPS.");
    } finally {
      setLapsLoading(false);
    }
  }

  async function copyLapsPassword() {
    if (!lapsCredential?.password) return;
    await navigator.clipboard?.writeText(lapsCredential.password);
    setLapsCopied(true);
    window.setTimeout(() => setLapsCopied(false), 2500);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="user-modal intune-device-modal" role="dialog" aria-modal="true" aria-labelledby="intune-device-title">
        <header className="modal-header">
          <div>
            <span>DISPOSITIVO INTUNE</span>
            <h2 id="intune-device-title">{device.deviceName || "Dispositivo"}</h2>
            <span>{device.userPrincipalName || device.emailAddress || "Usuario principal nao informado"}</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>

        {error ? <div className="modal-error">{error}</div> : null}
        {loading ? <div className="modal-loading">Carregando dispositivo...</div> : null}

        <div className="modal-content-grid">
          <section className="modal-section">
            <h3>Inventario</h3>
            <div className="detail-grid">
              <DetailItem label="Sistema" value={formatIntuneOs(device)} />
              <DetailItem label="Categoria" value={device.deviceCategoryDisplayName || "Nao informada"} />
              <DetailItem label="Fabricante" value={device.manufacturer} />
              <DetailItem label="Modelo" value={device.model} />
              <DetailItem label="Serial" value={device.serialNumber} />
              <DetailItem label="Tipo" value={device.managedDeviceOwnerType} />
              <DetailItem label="Agente" value={device.managementAgent} />
              <DetailItem label="Inscricao" value={device.deviceEnrollmentType} />
              <DetailItem label="Estado" value={device.managementState || "Nao informado"} />
            </div>
          </section>

          <section className="modal-section">
            <h3>Conformidade</h3>
            <div className="detail-grid">
              <DetailItem label="Status" value={intuneComplianceLabel(device.complianceState)} />
              <DetailItem label="Ultimo sync" value={formatDateTime(device.lastSyncDateTime)} />
              <DetailItem label="Inscrito em" value={formatDateTime(device.enrolledDateTime)} />
              <DetailItem label="Azure AD Device ID" value={device.azureADDeviceId} />
            </div>
          </section>

          <section className="modal-section">
            <h3>Seguranca</h3>
            <div className="detail-grid">
              <DetailItem label="Criptografia" value={device.isEncrypted ? "Ativa" : "Nao informada/inativa"} />
              <DetailItem label="Azure AD registrado" value={device.azureADRegistered ? "Sim" : "Nao informado"} />
              <DetailItem label="Jailbreak" value={device.jailBroken || "Nao informado"} />
              <DetailItem label="Ameaca reportada" value={device.partnerReportedThreatState || "Nao informado"} />
            </div>
          </section>

          <section className="modal-section intune-laps-section">
            <div className="section-heading-row">
              <h3>LAPS</h3>
              <button className="secondary-action" type="button" onClick={loadLapsCredential} disabled={lapsLoading || !device.azureADDeviceId}>
                <KeyRound size={15} />
                {lapsLoading ? "Buscando" : "Buscar senha"}
              </button>
            </div>
            {!device.azureADDeviceId ? <div className="form-error">Dispositivo sem Azure AD Device ID.</div> : null}
            {lapsError ? <div className="form-error">{lapsError}</div> : null}
            {lapsCredential ? (
              <div className="laps-card">
                <div className="detail-grid">
                  <DetailItem label="Conta local" value={lapsCredential.accountName} />
                  <DetailItem label="Backup" value={formatDateTime(lapsCredential.backupDateTime || lapsCredential.lastBackupDateTime)} />
                  <DetailItem label="Proxima rotacao" value={formatDateTime(lapsCredential.refreshDateTime)} />
                  <DetailItem label="Device ID" value={lapsCredential.deviceId} />
                </div>
                <div className="laps-secret-row">
                  <div>
                    <span>Senha atual</span>
                    <strong>{lapsVisible ? lapsCredential.password : "••••••••••••••••"}</strong>
                  </div>
                  <button className="icon-button" type="button" onClick={() => setLapsVisible((value) => !value)} aria-label={lapsVisible ? "Ocultar senha LAPS" : "Revelar senha LAPS"}>
                    {lapsVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  <button className="secondary-action" type="button" onClick={copyLapsPassword}>
                    <Copy size={15} />
                    {lapsCopied ? "Copiado" : "Copiar"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="laps-empty">
                Clique em buscar para consultar a senha LAPS deste dispositivo no Microsoft Graph.
              </div>
            )}
          </section>

          <section className="modal-section">
            <h3>Rede e armazenamento</h3>
            <div className="detail-grid">
              <DetailItem label="Wi-Fi MAC" value={device.wiFiMacAddress} />
              <DetailItem label="Ethernet MAC" value={device.ethernetMacAddress} />
              <DetailItem label="Armazenamento total" value={formatBytes(device.totalStorageSpaceInBytes)} />
              <DetailItem label="Livre" value={`${formatBytes(device.freeStorageSpaceInBytes)} (${intuneFreeStoragePercent(device)}%)`} />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function UserStandardModal({
  items,
  total,
  overallTotal,
  search,
  page,
  onSearchChange,
  onPageChange,
  onSelect,
  onClose,
}: {
  items: UserStandardItem[];
  total: number;
  overallTotal: number;
  search: string;
  page: number;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onSelect: (user: AdUser) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="user-modal standard-modal" role="dialog" aria-modal="true" aria-labelledby="standard-users-title">
        <header className="modal-header">
          <div>
            <span>VERIFICACAO DE CADASTRO</span>
            <h2 id="standard-users-title">Usuarios fora do padrao</h2>
            <span>{overallTotal} usuarios ativos com campos obrigatorios pendentes</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>

        <div className="standard-modal-body">
          <DirectoryTools
            value={search}
            onChange={onSearchChange}
            page={page}
            total={total}
            onPageChange={onPageChange}
            placeholder="Procurar usuario, setor, e-mail ou campo faltante"
          />

          {items.length ? (
            <div className="directory-list standard-list">
              {items.map(({ user, missingFields }) => (
                <button
                  className="directory-row directory-button standard-row"
                  key={user.distinguishedName || user.samAccountName}
                  type="button"
                  onClick={() => onSelect(user)}
                >
                  <div>
                    <strong>{user.cn || user.displayName || user.samAccountName}</strong>
                    <span>{user.samAccountName}</span>
                  </div>
                  <div>
                    <span>{user.department || "Sem departamento"}</span>
                    <small>{missingFields.join(", ")}</small>
                  </div>
                  <StatusPill label={`${missingFields.length} faltando`} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhum usuario encontrado" detail="Nao ha pendencias para este filtro." />
          )}
        </div>
      </section>
    </div>
  );
}

function UserDetailsModal({
  user,
  details,
  loading,
  error,
  onClose,
  onCopyUser,
}: {
  user: AdUser;
  details: AdUserDetails | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onCopyUser: (details: AdUserDetails) => void;
}) {
  const [currentDetails, setCurrentDetails] = useState<AdUserDetails | null>(details);
  const [form, setForm] = useState<EditableUserProfile>(emptyEditableProfile());
  const [groupInput, setGroupInput] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forcePasswordChange, setForcePasswordChange] = useState(true);
  const [managerPreview, setManagerPreview] = useState<ResolvedUserIdentity | null>(null);
  const [managerPreviewLoading, setManagerPreviewLoading] = useState(false);
  const [managerPreviewError, setManagerPreviewError] = useState("");
  const profile = currentDetails?.profile;

  useEffect(() => {
    setCurrentDetails(details);
    if (details) {
      setForm(profileToForm(details));
    }
  }, [details]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const identity = form.managerDn.trim();
    setManagerPreview(null);
    setManagerPreviewError("");

    if (!identity) {
      setManagerPreviewLoading(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setManagerPreviewLoading(true);

      try {
        const resolved = await adRequest<ResolvedUserIdentity>(`/api/ad/users/resolve/${encodeURIComponent(identity)}`, {
          method: "GET",
        });
        setManagerPreview(resolved);
      } catch (previewError) {
        setManagerPreviewError(previewError instanceof Error ? previewError.message : "Responsavel nao encontrado.");
      } finally {
        setManagerPreviewLoading(false);
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [form.managerDn]);

  function updateForm(field: keyof EditableUserProfile, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missingFields = missingRequiredFields(form, requiredUserProfileFields);
    if (missingFields.length) {
      setActionError(`Preencha os campos obrigatorios: ${formatMissingFields(missingFields)}.`);
      return;
    }

    await runUserAction("profile", async () => {
      const updated = await adRequest<AdUserDetails>(`/api/ad/users/${encodeURIComponent(user.samAccountName)}`, {
        method: "PATCH",
        body: { profile: form },
      });
      setCurrentDetails(updated);
      setForm(profileToForm(updated));
      setActionMessage("Dados do usuario atualizados.");
    });
  }

  async function addGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupInput.trim()) return;

    await runUserAction("add-group", async () => {
      const updated = await adRequest<AdUserDetails>(`/api/ad/users/${encodeURIComponent(user.samAccountName)}/groups`, {
        method: "POST",
        body: { group: groupInput },
      });
      setCurrentDetails(updated);
      setGroupInput("");
      setActionMessage("Grupo adicionado ao usuario.");
    });
  }

  async function removeGroup(groupDn: string) {
    if (!window.confirm("Remover este usuario do grupo selecionado?")) {
      return;
    }

    await runUserAction(groupDn, async () => {
      const updated = await adRequest<AdUserDetails>(`/api/ad/users/${encodeURIComponent(user.samAccountName)}/groups`, {
        method: "DELETE",
        body: { group: groupDn },
      });
      setCurrentDetails(updated);
      setActionMessage("Grupo removido do usuario.");
    });
  }

  async function setUserEnabled(enabled: boolean) {
    const login = currentDetails?.profile.samAccountName || user.samAccountName;
    const actionLabel = enabled ? "ativar" : "desativar";

    if (!window.confirm(`Deseja ${actionLabel} a conta ${login}?`)) {
      return;
    }

    await runUserAction(enabled ? "enable-user" : "disable-user", async () => {
      const updated = await adRequest<AdUserDetails>(`/api/ad/users/${encodeURIComponent(login)}/enabled`, {
        method: "PATCH",
        body: { enabled },
      });
      setCurrentDetails(updated);
      setActionMessage(enabled ? "Usuario ativado no AD." : "Usuario desativado no AD.");
    });
  }

  function generatePassword() {
    const password = generateStrongPassword();
    setNewPassword(password);
    setForcePasswordChange(true);
    setActionError("");
    setActionMessage("Senha forte gerada. Confira e salve para aplicar no AD.");
  }

  async function copyPassword() {
    if (!newPassword) return;
    await navigator.clipboard?.writeText(newPassword);
    setActionMessage("Senha copiada para a area de transferencia.");
  }

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newPassword.trim()) {
      setActionError("Informe ou gere uma senha forte.");
      return;
    }

    if (!window.confirm(`Alterar a senha de ${currentDetails?.profile.samAccountName || user.samAccountName}?`)) {
      return;
    }

    await runUserAction("password", async () => {
      await adRequest(`/api/ad/users/${encodeURIComponent(currentDetails?.profile.samAccountName || user.samAccountName)}/password`, {
        method: "PATCH",
        body: { password: newPassword, forceChangeAtLogon: forcePasswordChange },
      });
      setNewPassword("");
      setActionMessage("Senha alterada no AD.");
    });
  }

  async function runUserAction(action: string, callback: () => Promise<void>) {
    setActionLoading(action);
    setActionError("");
    setActionMessage("");

    try {
      await callback();
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Falha ao executar acao no AD.");
    } finally {
      setActionLoading("");
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Detalhes do usuario">
      <div className="user-modal">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Ficha do usuario</p>
            <h2>{profile?.displayName || user.cn || user.samAccountName}</h2>
            <span>{profile?.samAccountName || user.samAccountName}</span>
          </div>
          <div className="modal-header-actions">
            {currentDetails ? (
              <button className="secondary-action" type="button" onClick={() => onCopyUser(currentDetails)}>
                <Plus size={16} />
                Copiar para novo usuario
              </button>
            ) : null}
            <button className="icon-button" type="button" onClick={onClose} title="Fechar" aria-label="Fechar detalhes do usuario">
              <X size={18} />
            </button>
          </div>
        </header>

        {loading ? <EmptyState title="Carregando usuario" detail="Consultando atributos e grupos no AD." /> : null}
        {error ? <EmptyState title="Nao foi possivel carregar" detail={error} /> : null}
        {actionError ? <div className="action-feedback error">{actionError}</div> : null}
        {actionMessage ? <div className="action-feedback success">{actionMessage}</div> : null}

        {currentDetails ? (
          <div className="modal-content-grid">
            <section className="modal-section">
              <h3>Editar perfil</h3>
              <form className="profile-form" onSubmit={submitProfile}>
                <div className="form-grid">
                  <DetailItem label="Login" value={currentDetails.profile.samAccountName} />
                  <EditableField label="Nome exibido" value={form.displayName} onChange={(value) => updateForm("displayName", value)} required />
                  <EditableField label="E-mail" value={form.mail} onChange={(value) => updateForm("mail", value)} required />
                  <EditableField label="Departamento" value={form.department} onChange={(value) => updateForm("department", value)} required />
                  <EditableField label="Cargo" value={form.title} onChange={(value) => updateForm("title", value)} required />
                  <EditableField label="Empresa" value={form.company} onChange={(value) => updateForm("company", value)} required />
                  <EditableField label="Telefone" value={form.telephoneNumber} onChange={(value) => updateForm("telephoneNumber", value)} />
                  <EditableField label="Celular" value={form.mobile} onChange={(value) => updateForm("mobile", value)} />
                  <EditableField label="Escritorio" value={form.office} onChange={(value) => updateForm("office", value)} required />
                  <EditableField label="Matricula/ID" value={form.employeeID} onChange={(value) => updateForm("employeeID", value)} />
                  <EditableField label="Numero funcionario" value={form.employeeNumber} onChange={(value) => updateForm("employeeNumber", value)} />
                  <EditableField label="Responsavel (registro, login ou DN)" value={form.managerDn} onChange={(value) => updateForm("managerDn", value)} wide required />
                  <ManagerPreview preview={managerPreview} loading={managerPreviewLoading} error={managerPreviewError} />
                  <EditableField label="Descricao" value={form.description} onChange={(value) => updateForm("description", value)} wide multiline required />
                </div>
                <div className="modal-actions">
                  <button className="primary-action" type="submit" disabled={Boolean(actionLoading)}>
                    <Save size={16} />
                    {actionLoading === "profile" ? "Salvando" : "Salvar dados"}
                  </button>
                </div>
              </form>
            </section>

            <section className="modal-section">
              <h3>Conta</h3>
              <div className="detail-grid">
                <AccountStatusControl
                  samAccountName={currentDetails.profile.samAccountName}
                  enabled={currentDetails.profile.enabled}
                  locked={currentDetails.profile.locked}
                  loading={actionLoading === "enable-user" || actionLoading === "disable-user"}
                  onToggle={setUserEnabled}
                />
                <DetailItem label="Responsavel" value={currentDetails.profile.manager?.name || "Nao informado"} />
                <DetailItem label="Criado em" value={formatAdDate(currentDetails.account.whenCreated)} />
                <DetailItem label="Alterado em" value={formatAdDate(currentDetails.account.whenChanged)} />
                <DetailItem label="Ultimo logon" value={formatWindowsFileTime(currentDetails.account.lastLogonTimestamp)} />
                <DetailItem label="Senha alterada" value={formatWindowsFileTime(currentDetails.account.pwdLastSet)} />
                <DetailItem label="Expira em" value={formatAccountExpires(currentDetails.account.accountExpires)} />
                <DetailItem label="UAC" value={currentDetails.account.userAccountControl} />
              </div>
              <form className="password-form" onSubmit={submitPassword}>
                <h3>Senha</h3>
                <label className="field-control">
                  <span>Nova senha forte</span>
                  <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Gere ou digite uma senha" autoComplete="new-password" />
                </label>
                <label className="check-control">
                  <input type="checkbox" checked={forcePasswordChange} onChange={(event) => setForcePasswordChange(event.target.checked)} />
                  <span>Exigir troca no proximo logon</span>
                </label>
                <div className="password-actions">
                  <button className="secondary-action" type="button" onClick={generatePassword}>
                    <KeyRound size={16} />
                    Gerar senha forte
                  </button>
                  <button className="secondary-action" type="button" onClick={copyPassword} disabled={!newPassword}>
                    Copiar
                  </button>
                  <button className="primary-action" type="submit" disabled={Boolean(actionLoading) || !newPassword.trim()}>
                    <Save size={16} />
                    {actionLoading === "password" ? "Alterando" : "Alterar senha"}
                  </button>
                </div>
              </form>
            </section>

            <section className="modal-section modal-section-wide">
              <h3>Grupos</h3>
              <form className="inline-group-form" onSubmit={addGroup}>
                <label className="field-control">
                  <span>Adicionar por CN ou Distinguished Name</span>
                  <input value={groupInput} onChange={(event) => setGroupInput(event.target.value)} placeholder="Ex: GG-VPN-Usuarios" />
                </label>
                <button className="primary-action" type="submit" disabled={Boolean(actionLoading) || !groupInput.trim()}>
                  <Plus size={16} />
                  {actionLoading === "add-group" ? "Adicionando" : "Adicionar"}
                </button>
              </form>
              {currentDetails.groups.length ? (
                <div className="group-chip-list">
                  {currentDetails.groups.map((group) => (
                    <span className="group-chip manageable" key={group.distinguishedName} title={group.distinguishedName}>
                      {group.name}
                      <button
                        type="button"
                        onClick={() => removeGroup(group.distinguishedName)}
                        disabled={Boolean(actionLoading)}
                        title="Remover grupo"
                        aria-label={`Remover ${group.name}`}
                      >
                        {actionLoading === group.distinguishedName ? <Clock3 size={13} /> : <Trash2 size={13} />}
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyState title="Sem grupos retornados" detail="O atributo memberOf veio vazio para este usuario." />
              )}
            </section>

            <section className="modal-section modal-section-wide">
              <h3>Distinguished Name</h3>
              <p className="dn-text">{currentDetails.profile.distinguishedName}</p>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ComputerDetailsModal({
  computer,
  details,
  loading,
  error,
  ous,
  ousLoading,
  ousError,
  onClose,
  onRefreshAd,
}: {
  computer: AdComputer;
  details: AdComputerDetails | null;
  loading: boolean;
  error: string;
  ous: AdOu[];
  ousLoading: boolean;
  ousError: string;
  onClose: () => void;
  onRefreshAd: () => Promise<void>;
}) {
  const [currentDetails, setCurrentDetails] = useState<AdComputerDetails | null>(details);
  const [form, setForm] = useState<EditableComputerProfile>(emptyComputerProfile());
  const [targetOu, setTargetOu] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [managerPreview, setManagerPreview] = useState<ResolvedUserIdentity | null>(null);
  const [managerPreviewLoading, setManagerPreviewLoading] = useState(false);
  const [managerPreviewError, setManagerPreviewError] = useState("");

  useEffect(() => {
    setCurrentDetails(details);
    if (details) {
      setForm(computerProfileToForm(details));
      setTargetOu(details.organizationalUnit.distinguishedName);
    }
  }, [details]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const identity = form.managedBy.trim();
    setManagerPreview(null);
    setManagerPreviewError("");

    if (!identity) {
      setManagerPreviewLoading(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setManagerPreviewLoading(true);

      try {
        const resolved = await adRequest<ResolvedUserIdentity>(`/api/ad/users/resolve/${encodeURIComponent(identity)}`, {
          method: "GET",
        });
        setManagerPreview(resolved);
      } catch (previewError) {
        setManagerPreviewError(previewError instanceof Error ? previewError.message : "Responsavel nao encontrado.");
      } finally {
        setManagerPreviewLoading(false);
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [form.managedBy]);

  function updateForm(field: keyof EditableComputerProfile, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runComputerAction("profile", async () => {
      const updated = await adRequest<AdComputerDetails>(`/api/ad/computers/${encodeURIComponent(computer.cn)}`, {
        method: "PATCH",
        body: { profile: form },
      });
      setCurrentDetails(updated);
      setForm(computerProfileToForm(updated));
      setActionMessage("Dados da maquina atualizados.");
      await onRefreshAd();
    });
  }

  async function moveComputer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetOu.trim() || !currentDetails) return;

    if (!window.confirm(`Mover ${currentDetails.profile.cn} para a OU selecionada?`)) {
      return;
    }

    await runComputerAction("move-ou", async () => {
      const updated = await adRequest<AdComputerDetails>(`/api/ad/computers/${encodeURIComponent(computer.cn)}/ou`, {
        method: "PATCH",
        body: { targetOu },
      });
      setCurrentDetails(updated);
      setTargetOu(updated.organizationalUnit.distinguishedName);
      setActionMessage("Maquina movida para a nova OU.");
      await onRefreshAd();
    });
  }

  async function removeComputer() {
    if (!currentDetails) return;

    const computerName = currentDetails.profile.cn || computer.cn;
    const typedName = window.prompt(`Digite ${computerName} para remover esta maquina do Active Directory.`);

    if (typedName === null) return;

    if (typedName.trim().toLowerCase() !== computerName.toLowerCase()) {
      setActionError("Remocao cancelada: o nome digitado nao confere com a maquina.");
      return;
    }

    await runComputerAction("delete-computer", async () => {
      await adRequest<{ ok: boolean; message: string }>(`/api/ad/computers/${encodeURIComponent(computerName)}`, {
        method: "DELETE",
      });
      await onRefreshAd();
      onClose();
    });
  }

  async function runComputerAction(action: string, callback: () => Promise<void>) {
    setActionLoading(action);
    setActionError("");
    setActionMessage("");

    try {
      await callback();
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Falha ao executar acao na maquina.");
    } finally {
      setActionLoading("");
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Detalhes da maquina">
      <div className="user-modal">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Ficha da maquina</p>
            <h2>{currentDetails?.profile.cn || computer.cn}</h2>
            <span>{currentDetails?.profile.dNSHostName || computer.dNSHostName || "Sem DNS"}</span>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="Fechar" aria-label="Fechar detalhes da maquina">
            <X size={18} />
          </button>
        </header>

        {loading ? <EmptyState title="Carregando maquina" detail="Consultando atributos do computador no AD." /> : null}
        {error ? <EmptyState title="Nao foi possivel carregar" detail={error} /> : null}
        {actionError ? <div className="action-feedback error">{actionError}</div> : null}
        {actionMessage ? <div className="action-feedback success">{actionMessage}</div> : null}

        {currentDetails ? (
          <div className="modal-content-grid">
            <section className="modal-section">
              <h3>Editar maquina</h3>
              <form className="profile-form" onSubmit={submitProfile}>
                <div className="form-grid">
                  <DetailItem label="Nome" value={currentDetails.profile.cn} />
                  <DetailItem label="DNS" value={currentDetails.profile.dNSHostName || "Nao informado"} />
                  <EditableField label="Localizacao" value={form.location} onChange={(value) => updateForm("location", value)} />
                  <EditableField label="Gerenciado por" value={form.managedBy} onChange={(value) => updateForm("managedBy", value)} />
                  <ManagerPreview preview={managerPreview} loading={managerPreviewLoading} error={managerPreviewError} />
                  <EditableField label="Descricao" value={form.description} onChange={(value) => updateForm("description", value)} wide multiline />
                </div>
                <div className="modal-actions">
                  <button className="primary-action" type="submit" disabled={Boolean(actionLoading)}>
                    <Save size={16} />
                    {actionLoading === "profile" ? "Salvando" : "Salvar dados"}
                  </button>
                </div>
              </form>
            </section>

            <section className="modal-section">
              <h3>Sistema e conta</h3>
              <div className="detail-grid">
                <DetailItem label="Sistema operacional" value={currentDetails.profile.operatingSystem || "Nao informado"} />
                <DetailItem label="Versao" value={currentDetails.profile.operatingSystemVersion || "Nao informado"} />
                <DetailItem label="Service pack" value={currentDetails.profile.operatingSystemServicePack || "Nao informado"} />
                <DetailItem label="Ultimo logon" value={formatWindowsFileTime(currentDetails.account.lastLogonTimestamp)} />
                <DetailItem label="Senha alterada" value={formatWindowsFileTime(currentDetails.account.pwdLastSet)} />
                <DetailItem label="Criado em" value={formatAdDate(currentDetails.account.whenCreated)} />
                <DetailItem label="Alterado em" value={formatAdDate(currentDetails.account.whenChanged)} />
                <DetailItem label="UAC" value={currentDetails.account.userAccountControl || "Nao informado"} />
              </div>
            </section>

            <section className="modal-section modal-section-wide">
              <h3>Organizational Unit</h3>
              <form className="inline-group-form ou-move-form" onSubmit={moveComputer}>
                <label className="field-control">
                  <span>OU atual</span>
                  <input value={ouPathFromDn(currentDetails.organizationalUnit.distinguishedName)} readOnly />
                </label>
                <label className="field-control">
                  <span>Mover para</span>
                  <select value={targetOu} onChange={(event) => setTargetOu(event.target.value)} disabled={ousLoading}>
                    <option value="">{ousLoading ? "Carregando OUs..." : "Selecione uma OU"}</option>
                    {ous.map((ou) => (
                      <option key={ou.distinguishedName} value={ou.distinguishedName}>
                        {ouLabel(ou)}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="primary-action" type="submit" disabled={Boolean(actionLoading) || !targetOu.trim() || targetOu === currentDetails.organizationalUnit.distinguishedName}>
                  <Monitor size={16} />
                  {actionLoading === "move-ou" ? "Movendo" : "Mover OU"}
                </button>
              </form>
              {ousError ? <div className="manager-preview error">{ousError}</div> : null}
              <p className="dn-text">{currentDetails.profile.distinguishedName}</p>
            </section>

            <section className="modal-section">
              <h3>Grupos</h3>
              {currentDetails.groups.length ? (
                <div className="group-chip-list">
                  {currentDetails.groups.map((group) => (
                    <span className="group-chip" key={group.distinguishedName} title={group.distinguishedName}>
                      {group.name}
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyState title="Sem grupos retornados" detail="O atributo memberOf veio vazio para esta maquina." />
              )}
            </section>

            <section className="modal-section">
              <h3>SPNs</h3>
              {currentDetails.servicePrincipalNames.length ? (
                <div className="spn-list">
                  {currentDetails.servicePrincipalNames.slice(0, 12).map((spn) => (
                    <span key={spn}>{spn}</span>
                  ))}
                </div>
              ) : (
                <EmptyState title="Sem SPNs" detail="Nenhum Service Principal Name retornado." />
              )}
            </section>

            <section className="modal-section modal-section-wide">
              <h3>Acoes de risco</h3>
              <p className="dn-text">Remove o objeto da maquina do Active Directory. Use somente quando o equipamento saiu do dominio ou sera recriado.</p>
              <div className="modal-footer-actions">
                <button className="danger-action" type="button" onClick={removeComputer} disabled={Boolean(actionLoading)}>
                  <Trash2 size={16} />
                  {actionLoading === "delete-computer" ? "Removendo" : "Remover do AD"}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function emptyEditableProfile(): EditableUserProfile {
  return {
    displayName: "",
    mail: "",
    department: "",
    title: "",
    company: "",
    telephoneNumber: "",
    mobile: "",
    office: "",
    description: "",
    employeeID: "",
    employeeNumber: "",
    managerDn: "",
  };
}

function emptyComputerProfile(): EditableComputerProfile {
  return {
    description: "",
    location: "",
    managedBy: "",
  };
}

function emptyCreateUserForm(): CreateUserForm {
  return {
    samAccountName: "",
    userPrincipalName: "",
    initialPassword: "",
    enableOnCreate: "",
    displayName: "",
    givenName: "",
    sn: "",
    mail: "",
    webPage: "",
    department: "",
    title: "",
    company: "",
    telephoneNumber: "",
    mobile: "",
    office: "",
    employeeID: "",
    employeeNumber: "",
    managerDn: "",
    targetOu: "",
    groups: "",
    description: "",
    profilePath: "",
    scriptPath: "",
    homeDirectory: "",
    homeDrive: "",
  };
}

function isCreateUserFormDirty(form: CreateUserForm) {
  return Object.entries(form).some(([key, value]) => {
    if (key === "enableOnCreate") return false;
    return String(value || "").trim() !== "";
  });
}

function emptyCreateTicketForm(user: AuthUser): CreateTicketForm {
  return {
    title: "",
    description: "",
    requester: user.name || user.login || "",
    requesterEmail: "",
    team: "Service Desk",
    category: "Geral",
    priority: "Media",
  };
}

function emptyIpItem(): IpInventoryItem {
  return {
    id: "",
    ip: "",
    name: "",
    location: "",
    category: "Manual",
    vlan: "",
    network: "",
    status: "Usado",
    sourceSheet: "Manual",
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}

function emptyIpLink(): IpInventoryLink {
  return {
    id: "",
    provider: "",
    type: "Circuito",
    name: "",
    url: "",
    category: "Geral",
    speed: "",
    fortinetIp: "",
    port: "",
    gateway: "",
    mask: "",
    ipCount: "",
    range: "",
    usedIp: "",
    location: "",
    service: "",
    ports: "",
    status: "Ativo",
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}

function emptySnmpDevice(): SnmpDevice {
  return {
    id: "",
    name: "",
    host: "",
    port: 161,
    type: "Switch",
    version: "2c",
    community: "public",
    username: "",
    authProtocol: "none",
    authKey: "",
    privProtocol: "none",
    privKey: "",
    timeoutMs: 1800,
    retries: 1,
    enabled: true,
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}

function emptyWifiRecord(columns: WifiColumn[]) {
  return Object.fromEntries(
    columns
      .filter((column) => column.writable && !column.autoIncrement)
      .map((column) => [column.name, ""]),
  );
}

function pickWifiVisibleColumns(columns: WifiColumn[], primaryKey: string) {
  const preferred = ["username", "value", "nome", "name", "email", "e-mail", "cpf", "matricula", "registro", "telefone", "celular", "status"];
  const scored = [...columns].sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const aScore = a.name === primaryKey ? -2 : preferred.some((item) => aName.includes(item)) ? -1 : 0;
    const bScore = b.name === primaryKey ? -2 : preferred.some((item) => bName.includes(item)) ? -1 : 0;
    return aScore - bScore;
  });

  return scored.slice(0, 6);
}

function wifiGridTemplate(columns: number) {
  return `repeat(${Math.max(1, columns)}, minmax(120px, 1fr)) 100px`;
}

function formatWifiValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function wifiFieldLabel(kind: WifiKind, column: WifiColumn) {
  if (kind === "colaboradores") {
    const name = column.name.toLowerCase();
    if (name === "username") return "RE";
    if (name === "value") return "Senha";
    if (name === "attribute") return "Atributo";
  }

  return column.name;
}

function createUserFormFromDetails(details: AdUserDetails): CreateUserForm {
  return {
    ...emptyCreateUserForm(),
    department: details.profile.department || "",
    title: details.profile.title || "",
    company: details.profile.company || "",
    telephoneNumber: details.profile.telephoneNumber || "",
    mobile: details.profile.mobile || "",
    office: details.profile.office || "",
    managerDn: details.profile.manager?.distinguishedName || "",
    targetOu: parentDnFromDn(details.profile.distinguishedName),
    groups: details.groups.map((group) => group.distinguishedName).filter(Boolean).join("\n"),
    description: details.profile.description || "",
  };
}

function ouLabel(ou: AdOu) {
  const path = ou.distinguishedName
    .split(",")
    .filter((part) => part.trim().toUpperCase().startsWith("OU="))
    .map((part) => part.trim().replace(/^OU=/i, ""))
    .reverse()
    .join(" / ");

  return path || ou.ou || ou.distinguishedName;
}

function ouPathFromDn(dn: string) {
  return dn
    .split(",")
    .filter((part) => part.trim().toUpperCase().startsWith("OU="))
    .map((part) => part.trim().replace(/^OU=/i, ""))
    .reverse()
    .join(" / ");
}

function parentDnFromDn(dn: string) {
  return dn.split(",").slice(1).join(",");
}

function makeTopologyId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyTopologyNetwork(): TopologyNetwork {
  return {
    id: "",
    name: "",
    cidr: "",
    vlan: "",
    gateway: "",
    notes: "",
  };
}

function emptyTopologyNode(): TopologyNode {
  return {
    id: "",
    name: "",
    type: "switch",
    ip: "",
    vendor: "UniFi",
    network: "",
    imageUrl: "",
    x: 50,
    y: 50,
  };
}

function emptyTopologyLink(nodes: TopologyNode[]): TopologyLink {
  return {
    id: "",
    from: nodes[0]?.id || "",
    to: nodes[1]?.id || "",
    label: "",
    medium: "trunk",
  };
}

function topologyNodeIcon(type: TopologyNodeType) {
  if (type === "firewall") return Shield;
  if (type === "core") return Router;
  if (type === "fiber") return RadioTower;
  if (type === "server") return Server;
  if (type === "internet") return Zap;
  return Wifi;
}

function topologyNodeStatus(node: TopologyNode, ipByAddress: Map<string, IpInventoryItem>, pingResults: Record<string, TopologyPingResult> = {}) {
  if (!node.ip) {
    return { tone: "idle" as const, label: "Sem IP configurado" };
  }

  const ping = pingResults[node.ip];
  if (ping) {
    return {
      tone: ping.ok ? ("online" as const) : ("offline" as const),
      label: ping.ok ? (ping.latencyMs !== null ? `${ping.latencyMs} ms` : "Ping OK") : "Sem ping",
    };
  }

  const inventoryItem = ipByAddress.get(node.ip);
  if (!inventoryItem) {
    return { tone: "unknown" as const, label: "IP fora do inventario" };
  }

  if (inventoryItem.status === "Livre") {
    return { tone: "offline" as const, label: "IP livre no inventario" };
  }

  if (inventoryItem.status === "Reservado") {
    return { tone: "warn" as const, label: "IP reservado" };
  }

  return { tone: "online" as const, label: inventoryItem.name || "IP em uso" };
}

function topologyLinkStatus(
  from: TopologyNode,
  to: TopologyNode,
  ipByAddress: Map<string, IpInventoryItem>,
  pingResults: Record<string, TopologyPingResult> = {},
) {
  const fromStatus = topologyNodeStatus(from, ipByAddress, pingResults).tone;
  const toStatus = topologyNodeStatus(to, ipByAddress, pingResults).tone;

  if (fromStatus === "idle" || toStatus === "idle") return "idle";
  if (fromStatus === "offline" || toStatus === "offline") return "offline";
  if (fromStatus === "warn" || toStatus === "warn" || fromStatus === "unknown" || toStatus === "unknown") return "warn";
  return "online";
}

function TopologyInventory({
  topology,
  onRemoveNetwork,
  onRemoveNode,
  onRemoveLink,
}: {
  topology: TopologyState;
  onRemoveNetwork: (id: string) => void;
  onRemoveNode: (id: string) => void;
  onRemoveLink: (id: string) => void;
}) {
  return (
    <div className="topology-inventory-grid">
      <section>
        <h3>Redes</h3>
        {topology.networks.map((network) => (
          <div className="topology-inventory-row" key={network.id}>
            <div>
              <strong>{network.name}</strong>
              <span>{network.cidr} - VLAN {network.vlan || "-"}</span>
            </div>
            <button type="button" onClick={() => onRemoveNetwork(network.id)} title="Remover rede" aria-label="Remover rede">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </section>
      <section>
        <h3>Equipamentos</h3>
        {topology.nodes.map((node) => (
          <div className="topology-inventory-row" key={node.id}>
            <div>
              <strong>{node.name}</strong>
              <span>{node.vendor} - {node.ip || "sem IP"}</span>
            </div>
            <button type="button" onClick={() => onRemoveNode(node.id)} title="Remover equipamento" aria-label="Remover equipamento">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </section>
      <section>
        <h3>Ligacoes</h3>
        {topology.links.map((link) => {
          const from = topology.nodes.find((node) => node.id === link.from)?.name || "Origem";
          const to = topology.nodes.find((node) => node.id === link.to)?.name || "Destino";
          return (
            <div className="topology-inventory-row" key={link.id}>
              <div>
                <strong>{from} / {to}</strong>
                <span>{link.label || link.medium}</span>
              </div>
              <button type="button" onClick={() => onRemoveLink(link.id)} title="Remover ligacao" aria-label="Remover ligacao">
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function requiredUserValue(user: AdUser, field: keyof EditableUserProfile) {
  if (field === "managerDn") return user.managerDn || "";
  return String(user[field as keyof AdUser] || "");
}

function missingRequiredUserFields(user: AdUser) {
  return requiredUserProfileFields
    .filter(({ field }) => !requiredUserValue(user, field).trim())
    .map(({ label }) => label);
}

function missingRequiredFields<T extends Record<string, string>>(form: T, fields: Array<{ field: keyof T; label: string }>) {
  return fields.filter(({ field }) => !String(form[field] || "").trim()).map(({ label }) => label);
}

function formatMissingFields(fields: string[]) {
  return fields.slice(0, 6).join(", ") + (fields.length > 6 ? ` e mais ${fields.length - 6}` : "");
}

function randomChar(chars: string) {
  const buffer = new Uint32Array(1);
  window.crypto.getRandomValues(buffer);
  return chars[buffer[0] % chars.length];
}

function shuffleText(value: string) {
  const chars = value.split("");
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const buffer = new Uint32Array(1);
    window.crypto.getRandomValues(buffer);
    const swapIndex = buffer[0] % (index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }
  return chars.join("");
}

function generateStrongPassword(length = 16) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%*+-?";
  const all = `${upper}${lower}${numbers}${symbols}`;
  const required = [randomChar(upper), randomChar(lower), randomChar(numbers), randomChar(symbols)];

  while (required.length < length) {
    required.push(randomChar(all));
  }

  return shuffleText(required.join(""));
}

function parseGroupInput(value: string) {
  return value
    .split(/[\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function groupNameFromIdentity(identity: string) {
  return (
    identity
      .split(",")
      .find((part) => part.trim().toUpperCase().startsWith("CN="))
      ?.trim()
      .replace(/^CN=/i, "") || identity
  );
}

function profileToForm(details: AdUserDetails): EditableUserProfile {
  return {
    displayName: details.profile.displayName || details.profile.cn || "",
    mail: details.profile.mail || "",
    department: details.profile.department || "",
    title: details.profile.title || "",
    company: details.profile.company || "",
    telephoneNumber: details.profile.telephoneNumber || "",
    mobile: details.profile.mobile || "",
    office: details.profile.office || "",
    description: details.profile.description || "",
    employeeID: details.profile.employeeID || "",
    employeeNumber: details.profile.employeeNumber || "",
    managerDn: details.profile.manager?.distinguishedName || "",
  };
}

function computerProfileToForm(details: AdComputerDetails): EditableComputerProfile {
  return {
    description: details.profile.description || "",
    location: details.profile.location || "",
    managedBy: details.profile.managedBy?.distinguishedName || "",
  };
}

async function adRequest<T>(path: string, options: { method: string; body?: unknown }) {
  const response = await authFetch(path, {
    method: options.method,
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || "Falha ao executar acao no AD.");
  }

  return payload as T;
}

function ManagerPreview({
  preview,
  loading,
  error,
}: {
  preview: ResolvedUserIdentity | null;
  loading: boolean;
  error: string;
}) {
  if (loading) {
    return <div className="manager-preview loading">Buscando responsavel no AD...</div>;
  }

  if (error) {
    return <div className="manager-preview error">{error}</div>;
  }

  if (!preview) {
    return null;
  }

  return (
    <div className="manager-preview success">
      <strong>{preview.profile.displayName || preview.profile.cn || preview.profile.samAccountName}</strong>
      <span>
        {preview.profile.employeeID || preview.profile.employeeNumber || preview.profile.samAccountName}
        {preview.profile.department ? ` - ${preview.profile.department}` : ""}
      </span>
      <small>{preview.profile.distinguishedName}</small>
    </div>
  );
}

function UserIdentityPreview({
  preview,
  loading,
  error,
}: {
  preview: ResolvedUserIdentity | null;
  loading: boolean;
  error: string;
}) {
  if (loading) {
    return <div className="manager-preview loading">Buscando usuario no AD...</div>;
  }

  if (error) {
    return <div className="manager-preview error">{error}</div>;
  }

  if (!preview) {
    return null;
  }

  return (
    <div className="manager-preview success">
      <strong>{preview.profile.displayName || preview.profile.cn || preview.profile.samAccountName}</strong>
      <span>
        {preview.profile.samAccountName}
        {preview.profile.department ? ` - ${preview.profile.department}` : ""}
      </span>
      <small>{preview.profile.distinguishedName}</small>
    </div>
  );
}

function AccountStatusControl({
  samAccountName,
  enabled,
  locked,
  loading,
  onToggle,
}: {
  samAccountName: string;
  enabled: boolean;
  locked: boolean;
  loading: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const status = locked ? "Bloqueado" : enabled ? "Ativo" : "Desativado";
  const isProtected = samAccountName.toLowerCase() === "krbtgt";

  return (
    <div className="detail-item account-status-control">
      <span>Status</span>
      <div>
        <strong>{status}</strong>
        <button
          className={enabled ? "danger-action" : "primary-action"}
          type="button"
          onClick={() => onToggle(!enabled)}
          disabled={loading || isProtected}
          title={isProtected ? "Conta interna do Kerberos protegida pelo AD" : undefined}
        >
          {loading ? "Aplicando" : enabled ? "Desativar" : "Ativar"}
        </button>
      </div>
      {isProtected ? <small>Conta interna do Kerberos. Nao ativar pelo painel.</small> : null}
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  wide = false,
  multiline = false,
  required = false,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
  multiline?: boolean;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className={`field-control${wide ? " field-wide" : ""}`}>
      <span>{label}{required ? " *" : ""}</span>
      {multiline ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} required={required} placeholder={placeholder} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} />
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="field-control">
      <span>{label}{required ? " *" : ""}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} required={required}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DetailItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value || "Nao informado"}</strong>
    </div>
  );
}

function AdComputersList({ computers, onSelect }: { computers: AdComputer[]; onSelect: (computer: AdComputer) => void }) {
  if (!computers.length) {
    return <EmptyState title="Maquinas nao carregadas" detail="A API nao retornou maquinas nesta coleta." />;
  }

  return (
    <div className="directory-list compact-list">
      {computers.map((computer) => (
        <button className="machine-row machine-button" key={computer.distinguishedName || computer.cn} onClick={() => onSelect(computer)} type="button">
          <div>
            <strong>{computer.cn}</strong>
            <span title={computer.distinguishedName}>{ouPathFromDn(computer.distinguishedName) || "OU nao informada"}</span>
          </div>
          <div>
            <strong>{computer.operatingSystem || "SO nao informado"}</strong>
            <span>{computer.dNSHostName || "Sem DNS"}</span>
          </div>
          <StatusPill label="Detalhes" />
        </button>
      ))}
    </div>
  );
}

function AdGroupsList({ groups }: { groups: ApiAdGroup[] }) {
  if (!groups.length) {
    return <EmptyState title="Grupos nao carregados" detail="A API nao retornou grupos nesta coleta." />;
  }

  return (
    <div className="directory-list">
      {groups.map((group) => (
        <div className="directory-row" key={group.distinguishedName || group.cn}>
          <div>
            <strong>{group.cn}</strong>
            <span>{group.description || "Sem descricao"}</span>
          </div>
          <div>
            <span>{group.memberCount} membros</span>
            <small>{extractOu(group.distinguishedName)}</small>
          </div>
          <RiskPill risk={group.memberCount > 100 ? "Alto" : group.memberCount > 10 ? "Medio" : "Baixo"} />
        </div>
      ))}
    </div>
  );
}

function LockoutEventsList({ events, errors }: { events: LockoutEvent[]; errors: string[] }) {
  if (errors.length && !events.length) {
    return (
      <EmptyState
        title="Origem do bloqueio indisponivel"
        detail="Eventos 4740 exigem acesso RPC/Windows Event Log aos DCs."
      />
    );
  }

  if (!events.length) {
    return <EmptyState title="Sem eventos 4740 nas ultimas 24h" detail="Nenhum bloqueio com origem foi retornado pelos DCs." />;
  }

  return (
    <div className="directory-list compact-list">
      {events.map((event) => (
        <div className="machine-row" key={`${event.domainController}-${event.targetUser}-${event.timeCreated}`}>
          <div>
            <strong>{event.targetUser}</strong>
            <span>{event.callerComputer || "Origem nao informada"}</span>
          </div>
          <small>
            {event.domainController} - {formatDateTime(event.timeCreated)}
          </small>
        </div>
      ))}
    </div>
  );
}

function DirectoryTools({
  value,
  onChange,
  page,
  total,
  onPageChange,
  placeholder,
  pageSizeOverride = pageSize,
}: {
  value: string;
  onChange: (value: string) => void;
  page: number;
  total: number;
  onPageChange: (page: number) => void;
  placeholder: string;
  pageSizeOverride?: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSizeOverride));
  const safePage = Math.min(page, pageCount);

  return (
    <div className="directory-tools">
      <label className="directory-search">
        <Search size={15} />
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      </label>
      <div className="pager">
        <button type="button" onClick={() => onPageChange(Math.max(1, safePage - 1))} disabled={safePage <= 1}>
          Anterior
        </button>
        <span>
          {safePage}/{pageCount}
        </span>
        <button type="button" onClick={() => onPageChange(Math.min(pageCount, safePage + 1))} disabled={safePage >= pageCount}>
          Proxima
        </button>
      </div>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function filterItems<T>(items: T[], search: string, getFields: (item: T) => Array<string | number | undefined | null>) {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return items;

  return items.filter((item) =>
    getFields(item)
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

function paginate<T>(items: T[], page: number, size = pageSize) {
  const safePage = Math.max(1, page);
  return items.slice((safePage - 1) * size, safePage * size);
}

function findLockoutEvent(lockout: ApiLockout, events: LockoutEvent[]) {
  const login = normalizeIdentity(lockout.user || lockout.cn);
  if (!login) return undefined;

  return events
    .filter((event) => normalizeIdentity(event.targetUser) === login)
    .sort((a, b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime())[0];
}

function normalizeIdentity(value: string) {
  return value.trim().toLowerCase().replace(/.*\\/, "");
}

function formatWindowsFileTime(value: string) {
  const fileTime = Number(value);
  if (!Number.isFinite(fileTime) || fileTime <= 0) return "Agora";

  const epochMs = fileTime / 10000 - 11644473600000;
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return "Agora";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAdDate(value: string) {
  if (!value) return "Nao informado";

  const generalizedTime = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  const date = generalizedTime
    ? new Date(
        Date.UTC(
          Number(generalizedTime[1]),
          Number(generalizedTime[2]) - 1,
          Number(generalizedTime[3]),
          Number(generalizedTime[4]),
          Number(generalizedTime[5]),
          Number(generalizedTime[6]),
        ),
      )
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "Nao informado";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAccountExpires(value: string) {
  if (!value || value === "0" || value === "9223372036854775807") return "Nunca";
  return formatWindowsFileTime(value);
}

function formatDateTime(value: string) {
  const normalized = value && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value)
    ? value.replace(" ", "T")
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "Agora";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(value: number) {
  if (!value) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex ? 1 : 0)} ${units[unitIndex]}`;
}

function normalizePopPath(value: string) {
  return decodeURIComponent(value || "")
    .replace(/\\/g, "/")
    .replace(/\/$/, "")
    .toLowerCase();
}

function popPathDepth(value: string) {
  return normalizePopPath(value)
    .split("/")
    .filter(Boolean)
    .length;
}

function isPopChildOfFolder(item: PopDocument, folder: PopDocument) {
  if (item.id === folder.id) return false;
  const parentPath = normalizePopPath(item.path);
  const folderName = normalizePopPath(folder.name);
  return parentPath.endsWith(`/${folderName}`) || parentPath.endsWith(`:${folderName}`);
}

function formatIntuneOs(device: IntuneDevice) {
  return [device.operatingSystem, device.osVersion].filter(Boolean).join(" ") || "SO nao informado";
}

function intuneDeviceIsWindows(device: IntuneDevice) {
  return normalizeText(device.operatingSystem).includes("windows");
}

function intuneDeviceIsStale(device: IntuneDevice) {
  const date = new Date(device.lastSyncDateTime);
  return Number.isNaN(date.getTime()) || date.getTime() < Date.now() - 1000 * 60 * 60 * 24 * 7;
}

function intuneFreeStoragePercent(device: IntuneDevice) {
  if (!device.totalStorageSpaceInBytes || !device.freeStorageSpaceInBytes) return 100;
  return Math.max(0, Math.round((device.freeStorageSpaceInBytes / device.totalStorageSpaceInBytes) * 100));
}

function intuneThreatIsActive(device: IntuneDevice) {
  const threat = normalizeText(device.partnerReportedThreatState);
  return Boolean(threat && !["unknown", "none", "clear", "activated"].includes(threat));
}

function intuneDeviceRiskReasons(device: IntuneDevice) {
  const reasons: string[] = [];
  if (normalizeText(device.complianceState) === "noncompliant") reasons.push("Nao conforme");
  if (intuneDeviceIsStale(device)) reasons.push("Sem sync 7d");
  if (intuneDeviceIsWindows(device) && !device.isEncrypted) reasons.push("Sem BitLocker");
  if (normalizeText(device.jailBroken) === "true") reasons.push("Jailbreak");
  if (intuneThreatIsActive(device)) reasons.push("Ameaca");
  if (intuneFreeStoragePercent(device) <= 15) reasons.push("Pouco espaco");
  return reasons;
}

function intuneDeviceMatchesFilter(device: IntuneDevice, filter: "all" | "risk" | "stale" | "windows" | "mobile") {
  if (filter === "risk") return intuneDeviceRiskReasons(device).length > 0;
  if (filter === "stale") return intuneDeviceIsStale(device);
  if (filter === "windows") return intuneDeviceIsWindows(device);
  if (filter === "mobile") return !intuneDeviceIsWindows(device);
  return true;
}

function intuneRelativeDays(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Hoje";
  if (days === 1) return "1 dia atras";
  return `${days} dias atras`;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function ticketStatusBucket(ticket: ServiceTicket) {
  const status = normalizeText(ticket.status);
  if (["fechado", "resolvido", "finalizado", "cancelado", "solucionado"].some((item) => status.includes(item))) return "closed";
  if (["a fazer", "afazer", "novo", "aberto", "em andamento", "andamento", "pendente", "aguardando"].some((item) => status.includes(item))) return "open";
  return "other";
}

function isTicketClosed(ticket: ServiceTicket) {
  return ticketStatusBucket(ticket) === "closed";
}

function ticketMatchesFilter(ticket: ServiceTicket, filter: TicketFilter) {
  const status = normalizeText(ticket.status);
  if (filter === "all") return true;
  if (filter === "open") return ticketStatusBucket(ticket) === "open";
  if (filter === "closed") return ticketStatusBucket(ticket) === "closed";
  return true;
}

function ticketFilterTitle(filter: TicketFilter) {
  if (filter === "closed") return "Chamados resolvidos";
  if (filter === "all") return "Todos os chamados";
  return "Chamados abertos";
}

function intuneComplianceLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "compliant") return "Conforme";
  if (normalized === "noncompliant") return "Nao conforme";
  if (normalized === "conflict") return "Conflito";
  if (normalized === "error") return "Erro";
  if (normalized === "unknown") return "Desconhecido";
  return value || "Sem status";
}

function extractOu(distinguishedName: string) {
  const ou = distinguishedName
    .split(",")
    .filter((part) => part.trim().toUpperCase().startsWith("OU="))
    .map((part) => part.trim().replace(/^OU=/i, ""))
    .slice(0, 2)
    .join(" / ");

  return ou || "Builtin/raiz";
}

function TicketList() {
  return (
    <div className="ticket-list">
      {ticketQueue.map((ticket) => (
        <div className="ticket-row" key={ticket.code}>
          <span className="ticket-code">{ticket.code}</span>
          <strong>{ticket.title}</strong>
          <div>
            <span>{ticket.team}</span>
            <small>{ticket.sla}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function TicketChart() {
  return (
    <div className="chart-wrap compact">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={callVolume} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="#e6ebe6" vertical={false} />
          <XAxis dataKey="hour" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dfe6df" }} />
          <Bar dataKey="opened" fill="#d9902f" radius={[6, 6, 0, 0]} name="Abertos" />
          <Bar dataKey="closed" fill="#16a085" radius={[6, 6, 0, 0]} name="Resolvidos" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LatencyChart() {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={latencyHistory} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="#e6ebe6" vertical={false} />
          <XAxis dataKey="time" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={38} unit="ms" />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dfe6df" }} />
          <Line type="monotone" dataKey="core" stroke="#16a085" strokeWidth={3} dot={false} name="Core" />
          <Line type="monotone" dataKey="unifi" stroke="#277da1" strokeWidth={3} dot={false} name="UniFi" />
          <Line type="monotone" dataKey="fortinet" stroke="#c0392b" strokeWidth={3} dot={false} name="Fortinet" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function WanChart() {
  return (
    <div className="chart-wrap compact">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={wanTraffic} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="#e6ebe6" vertical={false} />
          <XAxis dataKey="link" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dfe6df" }} />
          <Bar dataKey="download" radius={[6, 6, 0, 0]} name="Download">
            {wanTraffic.map((entry) => (
              <Cell key={entry.link} fill={entry.color} />
            ))}
          </Bar>
          <Bar dataKey="upload" fill="#9aa79e" radius={[6, 6, 0, 0]} name="Upload" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SiteHealth() {
  return (
    <div className="site-stack">
      {sites.map((site) => (
        <div className="site-row" key={site.name}>
          <div className="site-row-top">
            <strong>{site.name}</strong>
            <span>{site.health}%</span>
          </div>
          <div className="progress-track">
            <span style={{ width: `${site.health}%` }} />
          </div>
          <div className="site-row-meta">
            <span>{site.devices} devices</span>
            <span>{site.clients} clientes</span>
            <span>{site.alerts} alertas</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AssetTable() {
  return (
    <div className="asset-table" role="table" aria-label="Ativos monitorados">
      <div className="asset-head" role="row">
        <span>Ativo</span>
        <span>Grupo</span>
        <span>Fornecedor</span>
        <span>Status</span>
        <span>Latencia</span>
        <span>Uptime</span>
      </div>
      {assets.map((asset) => (
        <div className="asset-row" role="row" key={asset.ip}>
          <span>
            <strong>{asset.name}</strong>
            <small>{asset.ip}</small>
          </span>
          <span>{asset.group}</span>
          <span>{asset.vendor}</span>
          <span>
            <i className={`status-dot ${asset.status}`} />
            {statusLabel(asset.status)}
          </span>
          <span>{asset.latency}</span>
          <span>{asset.uptime}</span>
        </div>
      ))}
    </div>
  );
}

function IncidentList({ adSummary }: { adSummary: AdSummary }) {
  const dynamicIncidents =
    adSummary.users.locked > 0
      ? incidents
      : incidents.filter((incident) => incident.area !== "Active Directory");

  return (
    <div className="incident-list">
      {dynamicIncidents.map((incident) => (
        <div className="incident-row" key={incident.title}>
          <div>
            <strong>{incident.title}</strong>
            <span>{incident.area}</span>
          </div>
          <div className="incident-meta">
            <SeverityBadge severity={incident.severity} />
            <small>
              <Clock3 size={13} />
              {incident.age}
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}

function FortinetPanel() {
  return (
    <>
      <div className="firewall-snapshot">
        <div>
          <span>CPU</span>
          <strong>42%</strong>
        </div>
        <div>
          <span>Memoria</span>
          <strong>61%</strong>
        </div>
        <div>
          <span>Sessoes</span>
          <strong>18.4k</strong>
        </div>
        <div>
          <span>VPNs</span>
          <strong>14/15</strong>
        </div>
      </div>
      <div className="chart-wrap mini">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={latencyHistory} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="fortinetLoad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c0392b" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#c0392b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="fortinet" stroke="#c0392b" fill="url(#fortinetLoad)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function UnifiPanel() {
  return (
    <div className="unifi-grid">
      <div>
        <strong>37</strong>
        <span>APs online</span>
      </div>
      <div>
        <strong>623</strong>
        <span>Clientes</span>
      </div>
      <div>
        <strong>91%</strong>
        <span>Wi-Fi exp.</span>
      </div>
      <div>
        <strong>2</strong>
        <span>Portas down</span>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  tone: "good" | "danger" | "calm" | "warn";
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-icon">
        <Icon size={20} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function PanelHeader({
  icon: Icon,
  title,
  meta,
  action,
}: {
  icon: typeof Activity;
  title: string;
  meta: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="panel-header">
      <div>
        <Icon size={18} />
        <h2>{title}</h2>
      </div>
      <div className="panel-header-meta">
        {action}
        <span>{meta}</span>
      </div>
    </header>
  );
}

function ComplianceBar({
  label,
  current,
  expected,
  status,
}: {
  label: string;
  current: number;
  expected: number;
  status: string;
}) {
  const progress = expected === 0 ? Math.min(current * 6, 100) : Math.min((current / expected) * 100, 100);
  const isException = expected === 0 && current > 0;

  return (
    <div className="compliance-row">
      <div className="compliance-top">
        <strong>{label}</strong>
        <span>{status}</span>
      </div>
      <div className={`progress-track ${isException ? "exception" : ""}`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <small>
        {current} de {expected || "meta zero"}
      </small>
    </div>
  );
}

function LockoutRow({ lockout }: { lockout: Lockout }) {
  return (
    <div className={`lockout-row ${lockout.severity.toLowerCase()}`}>
      <div className="lockout-main">
        <div className="lockout-user">
          <strong>{lockout.user}</strong>
          <span>{lockout.department}</span>
        </div>
        <SeverityBadge severity={lockout.severity} />
      </div>
      <div className="lockout-meta">
        <span>
          Origem
          <strong>{lockout.source}</strong>
        </span>
        <span>
          DC
          <strong>{lockout.controller}</strong>
        </span>
        <span>
          Falhas
          <strong>{lockout.attempts}</strong>
        </span>
      </div>
      <div className="lockout-footer">
        <span>{lockout.reason}</span>
        <button className="small-action" type="button">
          {lockout.ticket}
        </button>
      </div>
      <small className="lockout-time">
        <Clock3 size={13} />
        {lockout.lastSeen}
      </small>
    </div>
  );
}

function AccessRequestRow({ request }: { request: AccessRequest }) {
  return (
    <div className="access-row">
      <div>
        <strong>{request.user}</strong>
        <span>{request.action}</span>
      </div>
      <div>
        <span>{request.target}</span>
        <small>{request.requestedBy}</small>
      </div>
      <StatusPill label={request.status} />
    </div>
  );
}

function GroupRow({ group }: { group: AdGroup }) {
  return (
    <div className="group-row">
      <div>
        <strong>{group.name}</strong>
        <span>{group.owner}</span>
      </div>
      <div className="group-meta">
        <span>{group.members} membros</span>
        <RiskPill risk={group.risk} />
      </div>
      <small>{group.lastChange}</small>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return <span className={`status-pill ${label.toLowerCase()}`}>{label}</span>;
}

function RiskPill({ risk }: { risk: AdGroup["risk"] }) {
  return <span className={`risk-pill ${risk.toLowerCase()}`}>{risk}</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const className = severity === "Critico" ? "critical" : severity === "Atencao" ? "attention" : "info";

  return <span className={`severity ${className}`}>{severity}</span>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
