import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleGauge,
  ClipboardList,
  Clock3,
  BookOpen,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Flower2,
  FolderKanban,
  Receipt,
  Boxes,
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
  ShieldAlert,
  ShieldCheck,
  Signal,
  Table as TableIcon,
  Trash2,
  Unlock,
  UserX,
  HardDrive,
  Home,
  Mail,
  MonitorSmartphone,
  Smartphone,
  Stethoscope,
  ChevronRight,
  RotateCcw,
  Tv,
  UserCheck,
  Users,
  Wifi,
  X,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ProjectsDashboard } from "./projects";
import { AccessDashboard } from "./access";
import { DiagnosticsDashboard } from "./diagnostics";
import { LinksDashboard } from "./links";
import { NocWall } from "./noc";
import { ContractsDashboard } from "./contracts";
import { DefenderDashboard } from "./defender";
import { InventoryDashboard } from "./inventory";

// O 3D (three.js) so e baixado quando alguem abre a tela.
const InfraView = React.lazy(() => import("./infra/InfraView"));
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

type Office365Status = {
  ok: boolean;
  source: string;
  configured: boolean;
  message: string;
};

type Office365Summary = {
  source: string;
  users: number;
  enabledUsers: number;
  licensedUsers: number;
  groups: number;
  licensedGroups: number;
  licenses: number;
  enabledLicenseUnits: number;
  consumedLicenseUnits: number;
  availableLicenseUnits: number;
};

type Office365User = {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string;
  accountEnabled: boolean;
  department: string;
  jobTitle: string;
  createdDateTime: string;
  assignedLicenses: string[];
  assignedLicenseSkuIds: string[];
};

type Office365License = {
  skuId: string;
  skuPartNumber: string;
  consumedUnits: number;
  enabledUnits: number;
  suspendedUnits: number;
  warningUnits: number;
  availableUnits: number;
  servicePlans: number;
};

type Office365Group = {
  id: string;
  displayName: string;
  description: string;
  mail: string;
  mailEnabled: boolean;
  securityEnabled: boolean;
  groupTypes: string[];
  createdDateTime: string;
  assignedLicenses: string[];
};

type Office365Details = {
  users: Office365User[];
  licenses: Office365License[];
  groups: Office365Group[];
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

type MilvusAssetsSummary = {
  source: string;
  configured: boolean;
  total: number;
  computers: number;
  mobile: number;
  unknown: number;
  message: string;
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
    return value === "ad" || value === "tv" || value === "topology" || value === "intune" || value === "office365" || value === "milvusPortal" || value === "ips" || value === "snmp" || value === "wifi" || value === "pop" || value === "projects" || value === "access" || value === "diagnostics" || value === "links" || value === "noc" || value === "contracts" || value === "infra3d" || value === "defender" || value === "inventory" ? value : "tv";
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

const fallbackOffice365Status: Office365Status = {
  ok: true,
  source: "graph",
  configured: false,
  message: "Office 365 aguardando configuracao",
};

const fallbackOffice365Summary: Office365Summary = {
  source: "graph",
  users: 0,
  enabledUsers: 0,
  licensedUsers: 0,
  groups: 0,
  licensedGroups: 0,
  licenses: 0,
  enabledLicenseUnits: 0,
  consumedLicenseUnits: 0,
  availableLicenseUnits: 0,
};

const fallbackOffice365Details: Office365Details = {
  users: [],
  licenses: [],
  groups: [],
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

const fallbackMilvusAssetsSummary: MilvusAssetsSummary = {
  source: "mock",
  configured: false,
  total: 0,
  computers: 0,
  mobile: 0,
  unknown: 0,
  message: "Inventario Milvus aguardando configuracao",
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

// Itens por pagina nas listas do portal (AD, Intune, Office 365, bloqueios).
const pageSize = 20;

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

// Menu por assunto (o que se usa junto fica junto); cada icone com um significado so.
const navSections: { title: string; items: { label: string; icon: LucideIcon; view: View }[] }[] = [
  {
    title: "Visão geral",
    items: [
      { label: "Início", icon: Home, view: "tv" },
      { label: "Painel NOC (TV)", icon: Tv, view: "noc" },
    ],
  },
  {
    title: "Rede e monitoramento",
    items: [
      { label: "Links de internet", icon: Zap, view: "links" },
      { label: "Topologia", icon: Network, view: "topology" },
      { label: "Infraestrutura 3D", icon: Boxes, view: "infra3d" },
      { label: "Equipamentos (SNMP)", icon: Signal, view: "snmp" },
      { label: "IPs e VLANs", icon: Router, view: "ips" },
      { label: "Wi-Fi (portal)", icon: Wifi, view: "wifi" },
    ],
  },
  {
    title: "Segurança",
    items: [{ label: "Microsoft Defender", icon: ShieldAlert, view: "defender" }],
  },
  {
    title: "Usuários e dispositivos",
    items: [
      { label: "Inventário de máquinas", icon: MonitorSmartphone, view: "inventory" },
      { label: "Active Directory", icon: Users, view: "ad" },
      { label: "Office 365", icon: Mail, view: "office365" },
      { label: "Intune", icon: Smartphone, view: "intune" },
    ],
  },
  {
    title: "Atendimento e gestão",
    items: [
      { label: "Chamados (Milvus)", icon: ClipboardList, view: "milvusPortal" },
      { label: "Procedimentos (POP)", icon: BookOpen, view: "pop" },
      { label: "Projetos", icon: FolderKanban, view: "projects" },
      { label: "Contratos", icon: Receipt, view: "contracts" },
    ],
  },
  {
    title: "Administração",
    items: [
      { label: "Acessos", icon: UserCheck, view: "access" },
      { label: "Diagnóstico", icon: Stethoscope, view: "diagnostics" },
    ],
  },
];

type View = "tv" | "topology" | "ad" | "intune" | "office365" | "tickets" | "milvusPortal" | "ips" | "snmp" | "wifi" | "pop" | "projects" | "access" | "diagnostics" | "links" | "noc" | "contracts" | "infra3d" | "defender" | "inventory";

function statusLabel(status: Status) {
  return {
    online: "Online",
    warning: "Atencao",
    offline: "Offline",
  }[status];
}

function viewEyebrow(view: View) {
  if (view === "tv") return "O que precisa de você agora";
  if (view === "intune") return "Gerenciamento de dispositivos";
  if (view === "office365") return "Administração Microsoft 365";
  if (view === "tickets") return "Atendimento e SLA";
  if (view === "milvusPortal") return "Atendimento";
  if (view === "ips") return "Inventário de rede";
  if (view === "snmp") return "Monitoramento de equipamentos";
  if (view === "wifi") return "Cadastro do Wi-Fi do clube";
  if (view === "pop") return "Procedimento operacional padrão";
  if (view === "projects") return "Gestão de projetos da TI";
  if (view === "contracts") return "Gestão de fornecedores";
  if (view === "infra3d") return "Digital Twin · dados ao vivo";
  if (view === "defender") return "Incidentes, máquinas e quarentena de e-mail";
  if (view === "inventory") return "AD × Entra × Intune × Defender × Milvus";
  if (view === "links") return "Monitoramento via Zabbix";
  if (view === "noc") return "Central de monitoramento";
  if (view === "access") return "Administração do portal";
  if (view === "diagnostics") return "Administração do portal";
  if (view === "topology") return "Mapa e monitoramento";
  return "Administração de identidade";
}

// Titulo da tela igual ao nome no menu.
function viewTitle(view: View) {
  if (view === "tv") return "Início";
  if (view === "intune") return "Intune";
  if (view === "office365") return "Office 365";
  if (view === "tickets") return "Chamados (Milvus)";
  if (view === "milvusPortal") return "Chamados (Milvus)";
  if (view === "ips") return "IPs e VLANs";
  if (view === "snmp") return "Equipamentos (SNMP)";
  if (view === "wifi") return "Wi-Fi (portal)";
  if (view === "pop") return "Procedimentos (POP)";
  if (view === "projects") return "Projetos";
  if (view === "contracts") return "Contratos";
  if (view === "infra3d") return "Infraestrutura 3D";
  if (view === "defender") return "Microsoft Defender";
  if (view === "inventory") return "Inventário de máquinas";
  if (view === "links") return "Links de internet";
  if (view === "noc") return "Painel NOC (TV)";
  if (view === "access") return "Acessos";
  if (view === "diagnostics") return "Diagnóstico das integrações";
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
  const [access, setAccess] = useState<{ isAdmin: boolean; views: string[]; openMode: boolean } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  // Muda a cada busca: remonta a tela de destino para ela ler o filtro pedido.
  const [searchNonce, setSearchNonce] = useState(0);

  // Abre outra tela ja filtrada (busca global, inventario -> ficha no AD/Intune).
  function openFiltered(target: { view: View; tab?: string; term: string }) {
    try {
      if (target.term) window.sessionStorage.setItem(PENDING_SEARCH_KEY, JSON.stringify(target));
    } catch {
      /* abre a tela sem filtro */
    }
    setSearchNonce((value) => value + 1);
    setActiveView(target.view);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Permissoes do usuario (o servidor tambem bloqueia; aqui so evita chamadas e esconde o menu).
  useEffect(() => {
    if (!session) {
      setAccess(null);
      return undefined;
    }
    let cancelled = false;
    const loadAccess = async () => {
      try {
        const response = await authFetch("/api/access/me");
        if (!response.ok) return;
        const payload = await parseApiPayload<{ isAdmin?: boolean; views?: string[]; openMode?: boolean }>(response, {});
        if (!cancelled) setAccess({ isAdmin: Boolean(payload.isAdmin), views: payload.views || [], openMode: Boolean(payload.openMode) });
      } catch {
        /* tenta de novo no proximo ciclo */
      }
    };
    loadAccess();
    const timer = window.setInterval(loadAccess, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session]);

  const canView = useCallback((view: string) => {
    if (!access) return false;
    if (view === "access" || view === "diagnostics") return access.isAdmin;
    return access.views.includes(view === "tickets" ? "milvusPortal" : view);
  }, [access]);

  // Quais telas usam cada conjunto de dados.
  const canLoad = useCallback((kind: string) => {
    const needs: Record<string, string[]> = {
      ad: ["ad", "tv"],
      intune: ["intune", "tv"],
      office365: ["office365", "tv"],
      snmp: ["snmp", "tv", "topology"],
      tickets: ["milvusPortal", "tv"],
      ips: ["ips", "topology", "tv"],
      topology: ["topology", "tv"],
    };
    return (needs[kind] || []).some((view) => canView(view));
  }, [canView]);

  // Tela salva sem permissao (ou permissao retirada): vai para a primeira liberada.
  useEffect(() => {
    if (!access || canView(activeView)) return;
    const first = navSections.flatMap((section) => section.items).find((item) => canView(item.view));
    if (first) setActiveView(first.view);
  }, [access, activeView, canView]);  const [adSummaryState, setAdSummaryState] = useState<AdSummary>(fallbackAdSummary);
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
  const [office365Status, setOffice365Status] = useState<Office365Status>(fallbackOffice365Status);
  const [office365Summary, setOffice365Summary] = useState<Office365Summary>(fallbackOffice365Summary);
  const [office365Details, setOffice365Details] = useState<Office365Details>(fallbackOffice365Details);
  const [snmpSummary, setSnmpSummary] = useState<SnmpSummary>(fallbackSnmpSummary);
  const [snmpDetails, setSnmpDetails] = useState<SnmpDetails>(fallbackSnmpDetails);
  const [ticketsStatus, setTicketsStatus] = useState<TicketsStatus>(fallbackTicketsStatus);
  const [ticketsSummary, setTicketsSummary] = useState<TicketsSummary>(fallbackTicketsSummary);
  const [ticketsDetails, setTicketsDetails] = useState<TicketsDetails>(fallbackTicketsDetails);
  const [milvusAssetsSummary, setMilvusAssetsSummary] = useState<MilvusAssetsSummary>(fallbackMilvusAssetsSummary);
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
    setOffice365Status(fallbackOffice365Status);
    setOffice365Summary(fallbackOffice365Summary);
    setOffice365Details(fallbackOffice365Details);
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

  const [myOpenTasks, setMyOpenTasks] = useState(0);
  const freshLoginRef = useRef(false);

  const handleLogin = useCallback((nextSession: AuthSession) => {
    freshLoginRef.current = true;
    saveSession(nextSession);
    setSession(nextSession);
  }, []);

  // Tarefas abertas do usuario (contador no menu). Analista (nao gestor) cai direto em Projetos ao logar.
  useEffect(() => {
    if (!session) return undefined;
    let cancelled = false;

    async function loadMyTasks() {
      try {
        if (!canView("projects")) {
          setMyOpenTasks(0);
          return;
        }
        const response = await authFetch("/api/projects");
        if (!response.ok) return;
        const payload = await parseApiPayload<{ tasks?: { assignee: string; status: string; collaborators?: { login: string }[]; checklist?: { assignee?: string }[] }[]; me?: { isAdmin: boolean } }>(response, {});
        if (cancelled) return;
        const login = session!.user.login.toLowerCase();
        const involved = (task: { assignee: string; collaborators?: { login: string }[]; checklist?: { assignee?: string }[] }) =>
          task.assignee?.toLowerCase() === login
          || Boolean(task.collaborators?.some((member) => member.login.toLowerCase() === login))
          || Boolean(task.checklist?.some((item) => item.assignee?.toLowerCase() === login));
        setMyOpenTasks((payload.tasks || []).filter((task) => involved(task) && task.status !== "concluido").length);
        if (freshLoginRef.current) {
          freshLoginRef.current = false;
          if (payload.me && !payload.me.isAdmin) setActiveView("projects");
        }
      } catch {
        /* contador e opcional */
      }
    }

    loadMyTasks();
    const timer = window.setInterval(loadMyTasks, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session, activeView, canView]);

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
    } catch (error) {
      setAdStatus({
        ok: false,
        source: "offline",
        configured: false,
        message: `Sem resposta da API do AD (${error instanceof Error ? error.message : "erro de rede"}). Os números abaixo são de exemplo. Gestor: veja Administração → Diagnóstico.`,
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

      const [summaryResponse, ticketsResponse, assetsResponse] = await Promise.all([
        authFetch("/api/tickets/summary"),
        authFetch("/api/tickets?limit=500"),
        authFetch("/api/tickets/assets-summary"),
      ]);

      if (summaryResponse.ok) {
        setTicketsSummary(await summaryResponse.json());
      }

      if (ticketsResponse.ok) {
        const payload = await ticketsResponse.json();
        setTicketsDetails({ tickets: payload.items || [] });
      }

      if (assetsResponse.ok) {
        setMilvusAssetsSummary(await assetsResponse.json());
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
        message: `Sem resposta da API do Intune (${error instanceof Error ? error.message : "erro de rede"}). Gestor: veja Administração → Diagnóstico.`,
      });
    }
  }, [clearSession, session]);

  const loadOffice365 = useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      const statusResponse = await authFetch("/api/office365/status");

      if (statusResponse.status === 401) {
        clearSession();
        return;
      }

      const statusPayload = await parseApiPayload<Partial<Office365Status>>(statusResponse, {});
      setOffice365Status(
        statusResponse.ok
          ? (statusPayload as Office365Status)
          : {
              ok: false,
              source: "graph",
              configured: true,
              message: statusPayload.message || `API Office 365 retornou erro ${statusResponse.status}.`,
            },
      );

      const [summaryResponse, detailsResponse] = await Promise.all([
        authFetch("/api/office365/summary"),
        authFetch("/api/office365/details"),
      ]);

      if (summaryResponse.ok) {
        setOffice365Summary(await summaryResponse.json());
      } else {
        const payload = await parseApiPayload<{ message?: string }>(summaryResponse, {});
        setOffice365Summary(fallbackOffice365Summary);
        setOffice365Status({
          ok: false,
          source: "graph",
          configured: statusPayload.configured ?? true,
          message: payload.message || `Resumo Office 365 retornou erro ${summaryResponse.status}.`,
        });
      }

      if (detailsResponse.ok) {
        const payload = await detailsResponse.json();
        setOffice365Details({
          users: payload.users || [],
          licenses: payload.licenses || [],
          groups: payload.groups || [],
        });
      } else {
        const payload = await parseApiPayload<{ message?: string }>(detailsResponse, {});
        setOffice365Details(fallbackOffice365Details);
        setOffice365Status({
          ok: false,
          source: "graph",
          configured: statusPayload.configured ?? true,
          message: payload.message || `Detalhes Office 365 retornaram erro ${detailsResponse.status}.`,
        });
      }
    } catch (error) {
      setOffice365Summary(fallbackOffice365Summary);
      setOffice365Details(fallbackOffice365Details);
      setOffice365Status({
        ok: false,
        source: "offline",
        configured: false,
        message: error instanceof Error ? error.message : "API Office 365 offline.",
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
    if (!session || !canLoad("ad")) {
      return undefined;
    }

    loadAd();
    const interval = window.setInterval(loadAd, 30000);
    return () => window.clearInterval(interval);
  }, [loadAd, session, canLoad]);

  useEffect(() => {
    if (!session || !canLoad("intune")) {
      return undefined;
    }

    loadIntune();
    const interval = window.setInterval(loadIntune, 60000);
    return () => window.clearInterval(interval);
  }, [loadIntune, session, canLoad]);

  useEffect(() => {
    if (!session || !canLoad("office365")) {
      return undefined;
    }

    loadOffice365();
    const interval = window.setInterval(loadOffice365, 60000);
    return () => window.clearInterval(interval);
  }, [loadOffice365, session, canLoad]);

  useEffect(() => {
    if (!session || !canLoad("snmp")) {
      return undefined;
    }

    loadSnmp();
    const interval = window.setInterval(loadSnmp, 60000);
    return () => window.clearInterval(interval);
  }, [loadSnmp, session, canLoad]);

  useEffect(() => {
    if (!session || !canLoad("tickets")) {
      return undefined;
    }

    loadTickets();
    const interval = window.setInterval(loadTickets, 30000);
    return () => window.clearInterval(interval);
  }, [loadTickets, session, canLoad]);

  useEffect(() => {
    if (!session || !canLoad("ips")) {
      return undefined;
    }

    loadIps();
    const interval = window.setInterval(loadIps, 60000);
    return () => window.clearInterval(interval);
  }, [loadIps, session, canLoad]);

  useEffect(() => {
    if (!session || !canLoad("topology")) {
      return;
    }

    loadTopology();
  }, [loadTopology, session, canLoad]);

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

  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <main className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar" aria-label="Navegacao principal">
        <div className="sidebar-head">
          <div className="brand">
            <div className="brand-mark">
              <Flower2 size={24} strokeWidth={2} />
            </div>
            <div>
              <strong>Paineiras NOC</strong>
              <span>Central de TI</span>
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

        <nav className="nav-list" aria-label="Seções do portal">
          {navSections
            .map((section) => ({ ...section, items: section.items.filter((item) => canView(item.view)) }))
            .filter((section) => section.items.length)
            .map((section) => (
            <div className="nav-section" key={section.title}>
              <p className="nav-section-title">{section.title}</p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.view === activeView;
                // O Milvus nao abre dentro do portal (o navegador bloqueia a sessao no iframe): vai em nova aba.
                if (item.view === "milvusPortal") {
                  return (
                    <a className="nav-item" key={item.view} href={MILVUS_URL} target="_blank" rel="noreferrer" title={`${item.label} (abre em nova aba)`}>
                      <Icon size={18} />
                      <span>{item.label}</span>
                      <ExternalLink size={14} className="nav-external" aria-label="abre em nova aba" />
                    </a>
                  );
                }
                return (
                  <button
                    className={`nav-item ${isActive ? "active" : ""}`}
                    key={item.view}
                    onClick={() => setActiveView(item.view)}
                    type="button"
                    title={item.label}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                    {item.view === "projects" && myOpenTasks ? (
                      <b className="nav-badge" title={`${myOpenTasks} tarefa(s) atribuída(s) a você`}>{myOpenTasks}</b>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
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
            <button className="global-search-trigger" type="button" onClick={() => setSearchOpen(true)} aria-keyshortcuts="Control+K">
              <Search size={16} />
              <span>Buscar no portal</span>
              <kbd>Ctrl K</kbd>
            </button>
            {canView("milvusPortal") ? (
              <a className="secondary-action" href={MILVUS_URL} target="_blank" rel="noreferrer" title="Abre o Milvus em nova aba">
                <Plus size={16} />
                Abrir chamado
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ) : null}
            <div className="session-chip" title={`${session.user.login}${session.user.domain ? ` · ${session.user.domain}` : ""}`}>
              <span className="session-avatar" aria-hidden="true">{userInitials(session.user.name || session.user.login)}</span>
              <span>{session.user.name || session.user.login}</span>
            </div>
            <button className="icon-button" type="button" title="Sair" aria-label="Sair do portal" onClick={clearSession}>
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {access?.openMode ? (
          <div className="open-mode-banner" role="alert">
            <AlertTriangle size={18} />
            <span>
              <strong>Modo aberto:</strong> nenhum gestor definido, por isso todos os usuários estão vendo todos os projetos e todo o menu.
              Se você é o gestor, assuma agora; os demais passam a ver só o que for liberado.
            </span>
            <button
              className="open-mode-claim"
              type="button"
              onClick={async () => {
                const response = await authFetch("/api/access/claim", { method: "POST" });
                if (response.ok) window.location.reload();
              }}
            >
              Assumir como gestor do portal
            </button>
          </div>
        ) : null}
        <ViewErrorBoundary key={activeView}>
        {!access ? (
          <div className="view-loading">Carregando suas permissões...</div>
        ) : !canView(activeView) ? (
          <div className="view-error" role="alert">
            <LockKeyhole size={24} />
            <div>
              <strong>Você não tem acesso a esta área.</strong>
              <p>Peça ao gestor do portal para liberar em Administração → Acessos.</p>
            </div>
          </div>
        ) : activeView === "access" ? (
          <AccessDashboard />
        ) : activeView === "diagnostics" ? (
          <DiagnosticsDashboard />
        ) : activeView === "links" ? (
          <LinksDashboard isAdmin={Boolean(access?.isAdmin)} />
        ) : activeView === "contracts" ? (
          <ContractsDashboard />
        ) : activeView === "defender" ? (
          <DefenderDashboard />
        ) : activeView === "inventory" ? (
          <InventoryDashboard onOpen={(view, term, tab) => openFiltered({ view, tab, term })} />
        ) : activeView === "infra3d" ? (
          <React.Suspense fallback={<div className="view-loading">Carregando a infraestrutura 3D...</div>}>
            <InfraView />
          </React.Suspense>
        ) : activeView === "noc" ? (
          <NocWall isAdmin={Boolean(access?.isAdmin)} />
        ) : activeView === "tv" ? (
          <HomeDashboard
            adStatus={adStatus}
            adDetails={adDetails}
            intuneDetails={intuneDetails}
            office365Details={office365Details}
            snmpSummary={snmpSummary}
            myOpenTasks={myOpenTasks}
            canView={canView}
            onNavigate={setActiveView}
          />
        ) : activeView === "topology" ? (
          <TopologyDashboard topology={topology} onChange={setTopology} ipDetails={ipDetails} onRefreshIps={loadIps} saveStatus={topologySaveStatus} />
        ) : activeView === "intune" ? (
          <IntuneDashboard key={`intune-${searchNonce}`} intuneStatus={intuneStatus} intuneSummary={intuneSummary} intuneDetails={intuneDetails} onRefreshIntune={loadIntune} isAdmin={Boolean(access?.isAdmin)} />
        ) : activeView === "office365" ? (
          <Office365Dashboard office365Status={office365Status} office365Summary={office365Summary} office365Details={office365Details} onRefreshOffice365={loadOffice365} />
        ) : activeView === "snmp" ? (
          <SnmpDashboard snmpSummary={snmpSummary} snmpDetails={snmpDetails} onRefreshSnmp={loadSnmp} />
        ) : activeView === "tickets" ? (
          <TicketsDashboard ticketsStatus={ticketsStatus} ticketsSummary={ticketsSummary} ticketsDetails={ticketsDetails} onRefreshTickets={loadTickets} sessionUser={session.user} />
        ) : activeView === "milvusPortal" ? (
          <MilvusPortalView />
        ) : activeView === "ips" ? (
          <IpsDashboard key={`ips-${searchNonce}`} ipSummary={ipSummary} ipDetails={ipDetails} onRefreshIps={loadIps} />
        ) : activeView === "wifi" ? (
          <WifiPortalDashboard />
        ) : activeView === "pop" ? (
          <PopDashboard />
        ) : activeView === "projects" ? (
          <ProjectsDashboard currentUser={{ login: session.user.login, name: session.user.name || session.user.login }} />
        ) : (
          <AdDashboard key={`ad-${searchNonce}`} adSummary={adSummaryState} adStatus={adStatus} adDetails={adDetails} onRefreshAd={loadAd} />
        )}
        </ViewErrorBoundary>
      </section>
      {searchOpen ? (
        <GlobalSearch
          canView={canView}
          adDetails={adDetails}
          intuneDetails={intuneDetails}
          ipDetails={ipDetails}
          onClose={() => setSearchOpen(false)}
          onGo={(hit) => {
            setSearchOpen(false);
            openFiltered({ view: hit.view, tab: hit.tab, term: hit.term || "" });
          }}
        />
      ) : null}
    </main>
  );
}

function LoginPage({ onLogin }: { onLogin: (session: AuthSession) => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
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
      <section className="login-hero" aria-hidden="true">
        <div className="login-hero-brand">
          <div className="brand-mark">
            <Flower2 size={28} strokeWidth={2} />
          </div>
          <div>
            <strong>Clube Paineiras</strong>
            <span>do Morumby</span>
          </div>
        </div>

        <div className="login-hero-copy">
          <p className="login-kicker">Tecnologia da Informação</p>
          <h2>Central de operações de rede</h2>
          <p>Monitoramento, Active Directory, Intune, Office 365 e chamados em um só lugar.</p>
        </div>

        <ul className="login-hero-features">
          <li><ShieldCheck size={18} /> Acesso com sua conta do AD</li>
          <li><Monitor size={18} /> Painel pronto para a TV do NOC</li>
          <li><LockKeyhole size={18} /> Sessão encerra após 8 horas</li>
        </ul>
      </section>

      <section className="login-panel" aria-label="Login do portal">
        <div className="login-heading">
          <p className="eyebrow">Acesso restrito</p>
          <h1>Entrar</h1>
          <p className="login-subtitle">Use o mesmo registro e senha do computador.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Registro ou usuário</span>
            <input
              autoComplete="username"
              autoFocus
              inputMode="text"
              onChange={(event) => setLogin(event.target.value)}
              placeholder="ex.: 1234 ou nome@paineiras.com.br"
              value={login}
            />
          </label>

          <label>
            <span>Senha</span>
            <div className="login-password">
              <input
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                placeholder="Sua senha do AD"
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                className="login-password-toggle"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {capsLock ? <div className="login-hint">Caps Lock está ativado.</div> : null}
          {error ? <div className="login-error" role="alert">{error}</div> : null}

          <button className="login-button" disabled={loading || !login.trim() || !password} type="submit">
            <KeyRound size={18} />
            {loading ? "Validando..." : "Entrar"}
          </button>
        </form>

        <p className="login-footnote">Problemas para entrar? Abra um chamado com a equipe de TI.</p>
      </section>
    </main>
  );
}

// Fecha gaveta/modal com Esc enquanto estiver aberto.
function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onEscape]);
}

// Aba do AD a abrir quando o Inicio leva direto para os bloqueados.
const AD_TAB_KEY = "rede-clube-ad-tab";

// Busca global: a tela de destino abre ja filtrada (lido uma vez, na abertura da tela).
const PENDING_SEARCH_KEY = "rede-clube-pending-search";
type PendingSearch = { view: View; tab?: string; term: string };
function takePendingSearch(view: View): PendingSearch | null {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(PENDING_SEARCH_KEY) || "null") as PendingSearch | null;
    if (!parsed || parsed.view !== view) return null;
    window.sessionStorage.removeItem(PENDING_SEARCH_KEY);
    return parsed;
  } catch {
    return null;
  }
}

type SearchHit = { key: string; group: string; title: string; detail: string; view: View; tab?: string; term?: string };

// Ctrl+K: procura telas, usuarios e maquinas do AD, dispositivos do Intune e IPs com os dados ja carregados.
function GlobalSearch({
  canView,
  adDetails,
  intuneDetails,
  ipDetails,
  onGo,
  onClose,
}: {
  canView: (view: string) => boolean;
  adDetails: AdDetails;
  intuneDetails: IntuneDetails;
  ipDetails: IpDetails;
  onGo: (hit: SearchHit) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const term = normalizeText(query);
  const has = (...values: Array<string | undefined | null>) => normalizeText(values.filter(Boolean).join(" ")).includes(term);

  const hits: SearchHit[] = [];
  if (term) {
    for (const item of navSections.flatMap((section) => section.items).filter((entry) => canView(entry.view) && has(entry.label)).slice(0, 4)) {
      hits.push({ key: `view-${item.view}`, group: "Telas", title: item.label, detail: "abrir a tela", view: item.view });
    }
    if (canView("ad")) {
      for (const user of adDetails.users.filter((entry) => has(entry.cn, entry.displayName, entry.samAccountName, entry.mail, entry.department)).slice(0, 6)) {
        hits.push({ key: `user-${user.samAccountName}`, group: "Usuários do AD", title: user.cn || user.displayName || user.samAccountName, detail: [user.samAccountName, user.department, user.locked ? "BLOQUEADO" : ""].filter(Boolean).join(" · "), view: "ad", tab: "users", term: user.samAccountName });
      }
      for (const computer of adDetails.computers.filter((entry) => has(entry.cn, entry.dNSHostName)).slice(0, 4)) {
        hits.push({ key: `pc-${computer.cn}`, group: "Máquinas do AD", title: computer.cn, detail: computer.operatingSystem || "sistema não informado", view: "ad", tab: "computers", term: computer.cn });
      }
    }
    if (canView("intune")) {
      for (const device of intuneDetails.devices.filter((entry) => has(entry.deviceName, entry.userDisplayName, entry.userPrincipalName, entry.serialNumber)).slice(0, 4)) {
        hits.push({ key: `intune-${device.id || device.deviceName}`, group: "Dispositivos do Intune", title: device.deviceName || "Sem nome", detail: [device.userDisplayName, device.serialNumber].filter(Boolean).join(" · "), view: "intune", term: device.deviceName || device.serialNumber });
      }
    }
    if (canView("ips")) {
      for (const item of ipDetails.items.filter((entry) => has(entry.ip, entry.name, entry.location)).slice(0, 4)) {
        hits.push({ key: `ip-${item.id}`, group: "IPs", title: item.ip, detail: [item.name, item.location, item.status].filter(Boolean).join(" · "), view: "ips", term: item.ip });
      }
    }
  }
  const safeCursor = Math.min(cursor, Math.max(0, hits.length - 1));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop global-search-backdrop" role="presentation" onClick={onClose}>
      <section className="global-search" role="dialog" aria-modal="true" aria-label="Buscar no portal" onClick={(event) => event.stopPropagation()}>
        <label className="global-search-input">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setCursor((value) => Math.min(value + 1, hits.length - 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setCursor((value) => Math.max(value - 1, 0));
              }
              if (event.key === "Enter" && hits[safeCursor]) onGo(hits[safeCursor]);
            }}
            placeholder="Buscar usuário, máquina, dispositivo, IP ou tela..."
            aria-label="Buscar no portal"
          />
          <kbd>Esc</kbd>
        </label>
        {term ? (
          hits.length ? (
            <ul className="global-search-results" role="listbox" aria-label="Resultados">
              {hits.map((hit, index) => (
                <li key={hit.key}>
                  {index === 0 || hits[index - 1].group !== hit.group ? <span className="global-search-group">{hit.group}</span> : null}
                  <button type="button" role="option" aria-selected={index === safeCursor} className={index === safeCursor ? "active" : ""} onMouseEnter={() => setCursor(index)} onClick={() => onGo(hit)}>
                    <strong>{hit.title}</strong>
                    <small>{hit.detail}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="global-search-empty">Nada encontrado para "{query.trim()}".</p>
          )
        ) : (
          <p className="global-search-empty">Digite parte do nome, login, e-mail, setor, serial ou IP. Use ↑ ↓ e Enter para abrir.</p>
        )}
      </section>
    </div>
  );
}

type HomeItem = { key: string; tone: "danger" | "warn"; title: string; detail: string; action: string; view: View; prepare?: () => void };

// Inicio: fila do que precisa de alguem agora, cada item leva a tela certa (substitui a "Visao geral (TV)",
// que repetia a TV no computador e nao levava a lugar nenhum).
function HomeDashboard({
  adStatus,
  adDetails,
  intuneDetails,
  office365Details,
  snmpSummary,
  myOpenTasks,
  canView,
  onNavigate,
}: {
  adStatus: AdStatus;
  adDetails: AdDetails;
  intuneDetails: IntuneDetails;
  office365Details: Office365Details;
  snmpSummary: SnmpSummary;
  myOpenTasks: number;
  canView: (view: string) => boolean;
  onNavigate: (view: View) => void;
}) {
  const [links, setLinks] = useState<TvZabbixLink[] | null>(null);
  const [defender, setDefender] = useState<{ unassigned: number; high: number } | null>(null);
  const [contracts, setContracts] = useState<{ title: string; days: number }[] | null>(null);
  const [checkedAt, setCheckedAt] = useState(() => new Date());
  const canLinks = canView("links") || canView("tv");
  const canDefender = canView("defender");
  const canContracts = canView("contracts");

  useEffect(() => {
    if (!canLinks) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await authFetch("/api/links");
        if (!response.ok) return;
        const payload = await parseApiPayload<{ links?: TvZabbixLink[] }>(response, {});
        if (!cancelled) {
          setLinks(payload.links || []);
          setCheckedAt(new Date());
        }
      } catch {
        /* mantem o ultimo valor */
      }
    };
    load();
    const timer = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [canLinks]);

  useEffect(() => {
    if (canDefender) {
      authFetch("/api/defender/incidents?status=open")
        .then((response) => (response.ok ? parseApiPayload<{ incidents?: { assignedTo?: string | null; severity: string }[] }>(response, {}) : null))
        .then((payload) => {
          const open = payload?.incidents || [];
          const unassigned = open.filter((incident) => !incident.assignedTo);
          setDefender({ unassigned: unassigned.length, high: unassigned.filter((incident) => incident.severity === "high").length });
        })
        .catch(() => undefined);
    }
    if (canContracts) {
      authFetch("/api/contracts")
        .then((response) => (response.ok ? parseApiPayload<{ contracts?: { title: string; endDate: string; active: boolean }[] }>(response, {}) : null))
        .then((payload) => {
          const today = new Date(new Date().toDateString()).getTime();
          setContracts(
            (payload?.contracts || [])
              .filter((contract) => contract.active && contract.endDate)
              .map((contract) => ({ title: contract.title, days: Math.round((new Date(`${contract.endDate}T00:00:00`).getTime() - today) / 864e5) }))
              .filter((contract) => contract.days <= 30)
              .sort((a, b) => a.days - b.days),
          );
        })
        .catch(() => undefined);
    }
  }, [canDefender, canContracts]);

  const items: HomeItem[] = [];
  if (canView("ad") && adDetails.lockouts.length) {
    const names = adDetails.lockouts.slice(0, 3).map((lockout) => lockout.user || lockout.cn).join(", ");
    items.push({
      key: "ad-locked",
      tone: "danger",
      title: `${adDetails.lockouts.length} ${adDetails.lockouts.length === 1 ? "conta bloqueada" : "contas bloqueadas"} no AD`,
      detail: `${names}${adDetails.lockouts.length > 3 ? ` e +${adDetails.lockouts.length - 3}` : ""}`,
      action: "Ver e desbloquear",
      view: "ad",
      prepare: () => {
        try {
          window.sessionStorage.setItem(AD_TAB_KEY, "locked");
        } catch {
          /* so a aba inicial */
        }
      },
    });
  }
  if (defender?.unassigned) {
    items.push({
      key: "defender",
      tone: defender.high ? "danger" : "warn",
      title: `${defender.unassigned} ${defender.unassigned === 1 ? "incidente" : "incidentes"} do Defender sem responsável`,
      detail: defender.high ? `${defender.high} de severidade alta` : "ninguém analisando ainda",
      action: "Triar",
      view: "defender",
    });
  }
  for (const link of (links || []).filter((entry) => !entry.online)) {
    items.push({ key: `link-${link.id}`, tone: "danger", title: `Link ${link.name} offline`, detail: "sem resposta no Zabbix", action: "Ver link", view: "links" });
  }
  if (canView("snmp") && snmpSummary.offline) {
    items.push({ key: "snmp", tone: "warn", title: `${snmpSummary.offline} ${snmpSummary.offline === 1 ? "equipamento SNMP sem resposta" : "equipamentos SNMP sem resposta"}`, detail: "coleta do portal", action: "Ver", view: "snmp" });
  }
  const overdue = (contracts || []).filter((contract) => contract.days < 0);
  const dueSoon = (contracts || []).filter((contract) => contract.days >= 0);
  if (overdue.length) {
    items.push({ key: "contracts-overdue", tone: "danger", title: `${overdue.length} ${overdue.length === 1 ? "contrato ativo vencido" : "contratos ativos vencidos"}`, detail: overdue.slice(0, 2).map((contract) => contract.title).join(", "), action: "Abrir", view: "contracts" });
  }
  if (dueSoon.length) {
    items.push({
      key: "contracts-soon",
      tone: "warn",
      title: `${dueSoon.length} ${dueSoon.length === 1 ? "contrato vence" : "contratos vencem"} em até 30 dias`,
      detail: dueSoon.slice(0, 2).map((contract) => `${contract.title} (${contract.days === 0 ? "hoje" : `${contract.days} dias`})`).join(", "),
      action: "Abrir",
      view: "contracts",
    });
  }
  const nonCompliant = intuneDetails.devices.filter((device) => normalizeText(device.complianceState) === "noncompliant").length;
  if (canView("intune") && nonCompliant) {
    items.push({ key: "intune", tone: "warn", title: `${nonCompliant} ${nonCompliant === 1 ? "dispositivo não conforme" : "dispositivos não conformes"} no Intune`, detail: "fora das políticas de segurança", action: "Ver", view: "intune" });
  }
  const disabledLicensed = office365Details.users.filter((user) => !user.accountEnabled && user.assignedLicenses.length).length;
  if (canView("office365") && disabledLicensed) {
    items.push({ key: "o365", tone: "warn", title: `${disabledLicensed} ${disabledLicensed === 1 ? "conta desativada ainda ocupa" : "contas desativadas ainda ocupam"} licença`, detail: "custo sem uso no Office 365", action: "Ver", view: "office365" });
  }
  items.sort((a, b) => Number(b.tone === "danger") - Number(a.tone === "danger"));

  const go = (item: { view: View; prepare?: () => void }) => {
    item.prepare?.();
    onNavigate(item.view);
  };

  return (
    <div className="home-page">
      {!adStatus.ok && canView("ad") ? (
        <section className="ad-alert" role="alert">
          <AlertTriangle size={20} />
          <div>
            <strong>O Active Directory não está respondendo</strong>
            <span>Contas bloqueadas não aparecem nesta lista até ele voltar. {adStatus.message}</span>
          </div>
        </section>
      ) : null}

      <section className="panel home-queue" aria-labelledby="home-queue-title">
        <header>
          <h2 id="home-queue-title">Precisa de você agora</h2>
          <small>atualizado às {checkedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>
        </header>
        {items.length ? (
          <ul>
            {items.map((item) => (
              <li key={item.key} className={`tone-${item.tone}`}>
                {item.tone === "danger" ? <XCircle size={20} /> : <AlertTriangle size={20} />}
                <div>
                  <strong>{item.title}</strong>
                  {item.detail ? <small>{item.detail}</small> : null}
                </div>
                <button className={item.tone === "danger" ? "primary-action" : "secondary-action"} type="button" onClick={() => go(item)}>
                  {item.action}
                  <ChevronRight size={15} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="home-clear"><CheckCircle2 size={20} /> Nada pedindo ação agora.</p>
        )}
      </section>

      <section className="home-grid">
        {canLinks ? (
          <article className="panel home-links">
            <PanelHeader icon={CircleGauge} title="Links agora" meta={links?.length ? `${links.filter((link) => link.online).length}/${links.length} online` : "Zabbix"} />
            {links?.length ? <TvLiveLinkGauges links={links} /> : <EmptyState title="Sem leitura dos links" detail="O Zabbix ainda não respondeu." />}
          </article>
        ) : null}
        {canView("projects") ? (
          <article className="panel home-tasks">
            <PanelHeader icon={FolderKanban} title="Minhas tarefas" meta="Projetos" />
            <strong className="home-big">{myOpenTasks}</strong>
            <p>{myOpenTasks ? `${myOpenTasks === 1 ? "tarefa atribuída" : "tarefas atribuídas"} a você em aberto` : "Nenhuma tarefa sua em aberto."}</p>
            <button className="secondary-action" type="button" onClick={() => onNavigate("projects")}>
              Abrir Projetos
              <ChevronRight size={15} />
            </button>
          </article>
        ) : null}
      </section>
    </div>
  );
}

type TvZabbixLink = {
  id: string;
  name: string;
  contractedMbps: number;
  inBps: number;
  outBps: number;
  usagePercent: number | null;
  online: boolean;
  latencyMs: number | null;
  lossPercent: number | null;
};

function tvRate(bps: number) {
  const mbps = bps / 1e6;
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`;
  return `${mbps >= 100 ? Math.round(mbps) : mbps.toFixed(1)} Mbps`;
}

function TvLiveLinkGauges({ links }: { links: TvZabbixLink[] }) {
  return (
    <div className="tv-link-gauges">
      {links.map((link) => {
        const usage = link.usagePercent ?? 0;
        const fill = Math.min(100, Math.max(2, usage));
        const tone = !link.online ? "danger critical" : usage >= 90 ? "danger" : usage >= 70 ? "warn" : "";
        const contracted = link.contractedMbps >= 1000 ? `${link.contractedMbps / 1000} Gbps` : `${link.contractedMbps} Mbps`;
        return (
          <div
            className={`tv-link-gauge ${tone}`}
            key={link.id}
            style={{ "--gauge-fill": `${fill / 2}%`, "--gauge-angle": `${180 + fill * 1.8}deg` } as React.CSSProperties}
          >
            <div className="tv-gauge-dial" aria-hidden="true">
              <span />
            </div>
            <div className="tv-gauge-copy">
              <strong>{link.name}</strong>
              <b>{link.online ? `${usage >= 10 ? Math.round(usage) : usage.toFixed(1)}%` : "OFFLINE"}</b>
              <span>↓ {tvRate(link.inBps)} · ↑ {tvRate(link.outBps)}</span>
              <small>{link.contractedMbps ? `de ${contracted}` : ""}{link.latencyMs !== null ? ` · ${link.latencyMs} ms` : ""}{link.lossPercent ? ` · perda ${link.lossPercent}%` : ""}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function parseLinkSpeedMbps(value: string) {
  const normalized = value.trim().replace(",", ".").toUpperCase();
  const amount = Number(normalized.match(/[\d.]+/)?.[0] || 0);
  if (!amount) return 0;
  if (normalized.includes("GB") || normalized.includes("G")) return amount * 1000;
  if (normalized.includes("KB") || normalized.includes("K")) return amount / 1000;
  return amount;
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
  // Padrao e so ver: arrastar e editar exigem entrar em "Editar mapa" (antes um arraste ja salvava sem querer).
  const [editMode, setEditMode] = useState(false);
  const [infoNodeId, setInfoNodeId] = useState("");
  // Desfazer: guarda o mapa antes de cada alteracao (ate 30 passos).
  const historyRef = useRef<TopologyState[]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const dragStateRef = useRef<{ id: string; x: number; y: number; moved: boolean }>({ id: "", x: 0, y: 0, moved: false });
  const ipByAddress = new Map(ipDetails.items.map((item) => [item.ip, item]));

  function remember() {
    historyRef.current = [...historyRef.current.slice(-29), topology];
    setHistoryCount(historyRef.current.length);
  }

  function change(update: (current: TopologyState) => TopologyState) {
    remember();
    onChange(update);
  }

  function undo() {
    const previous = historyRef.current.pop();
    setHistoryCount(historyRef.current.length);
    if (previous) onChange(() => previous);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!editMode) return;
      if (event.key === "Escape" && linkMode) {
        setLinkMode(false);
        setSelectedNodeId("");
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const monitoredNodes = topology.nodes.filter((node) => node.ip);
  const onlineNodes = monitoredNodes.filter((node) => topologyNodeStatus(node, ipByAddress, pingResults).tone === "online").length;
  const downNodes = monitoredNodes.filter((node) => topologyNodeStatus(node, ipByAddress, pingResults).tone === "offline");
  const infoNode = topology.nodes.find((node) => node.id === infoNodeId) || null;
  const infoStatus = infoNode ? topologyNodeStatus(infoNode, ipByAddress, pingResults) : null;
  const infoPing = infoNode?.ip ? pingResults[infoNode.ip] : undefined;
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

    change((current) => ({
      ...current,
      networks: [...current.networks, { ...networkForm, id: makeTopologyId("net") }],
    }));
    setNetworkForm(emptyTopologyNetwork());
    setActivePanel(null);
  }

  function addNode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nodeForm.name.trim()) return;

    change((current) => ({
      ...current,
      nodes: [...current.nodes, { ...nodeForm, id: makeTopologyId("node") }],
    }));
    setNodeForm(emptyTopologyNode());
    setActivePanel(null);
  }

  function updateNode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nodeForm.id || !nodeForm.name.trim()) return;

    change((current) => ({
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

  // Remover pede confirmacao e pode ser desfeito (o mapa salva sozinho logo em seguida).
  function removeNetwork(id: string) {
    const network = topology.networks.find((entry) => entry.id === id);
    if (!window.confirm(`Remover a rede "${network?.name || id}" do mapa? Dá para desfazer com "Desfazer" (Ctrl+Z).`)) return;
    change((current) => ({
      ...current,
      networks: current.networks.filter((entry) => entry.id !== id),
    }));
  }

  function removeNode(id: string) {
    const node = topology.nodes.find((entry) => entry.id === id);
    const linkCount = topology.links.filter((link) => link.from === id || link.to === id).length;
    if (!window.confirm(`Remover "${node?.name || id}"${linkCount ? ` e as ${linkCount} ligações dele` : ""}? Dá para desfazer com "Desfazer" (Ctrl+Z).`)) return false;
    change((current) => ({
      ...current,
      nodes: current.nodes.filter((entry) => entry.id !== id),
      links: current.links.filter((link) => link.from !== id && link.to !== id),
    }));
    return true;
  }

  function removeLink(id: string) {
    if (!window.confirm("Remover esta ligação do mapa? Dá para desfazer com \"Desfazer\" (Ctrl+Z).")) return;
    change((current) => ({
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
    // Modo ver: clique mostra o cartao do equipamento (IP, ping, rede), sem editar nada.
    if (!editMode) {
      setInfoNodeId(node.id);
      setActivePanel(null);
      return;
    }
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

    change((current) => ({
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
    if (linkMode || !editMode) return;
    setDraggingNodeId(node.id);
    dragStateRef.current = { id: node.id, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleNodePointerMove(event: React.PointerEvent<HTMLButtonElement>, node: TopologyNode) {
    if (draggingNodeId !== node.id || linkMode || !editMode) return;
    const dragState = dragStateRef.current;
    if (!dragState.moved && (Math.abs(event.clientX - dragState.x) > 4 || Math.abs(event.clientY - dragState.y) > 4)) {
      // Um arraste inteiro vira um passo do "Desfazer".
      remember();
      dragStateRef.current = { ...dragState, moved: true };
    }
    if (dragStateRef.current.moved) updateNodePosition(node.id, event.clientX, event.clientY);
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
          {editMode ? (
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
              <button className={linkMode ? "primary-action" : "secondary-action"} type="button" aria-pressed={linkMode} onClick={() => {
                setLinkMode((value) => !value);
                setSelectedNodeId("");
              }}>
                <Zap size={16} />
                Nova ligação
              </button>
              <select className="topology-medium-select" aria-label="Tipo de cabo da ligação" value={linkMedium} onChange={(event) => setLinkMedium(event.target.value as TopologyLink["medium"])} disabled={!linkMode}>
                <option value="fibra">Fibra</option>
                <option value="utp">Cabo de rede</option>
                <option value="trunk">Trunk</option>
                <option value="wan">WAN</option>
              </select>
              <button className="secondary-action" type="button" onClick={undo} disabled={!historyCount} title="Desfazer a última alteração (Ctrl+Z)">
                <RotateCcw size={16} />
                Desfazer{historyCount ? ` (${historyCount})` : ""}
              </button>
              <button className="primary-action" type="button" onClick={() => {
                setEditMode(false);
                setLinkMode(false);
                setSelectedNodeId("");
                setActivePanel(null);
              }}>
                <CheckCircle2 size={16} />
                Concluir edição
              </button>
            </div>
          ) : (
            <div className="topology-toolbar-group">
              <button className="secondary-action" type="button" onClick={() => {
                setEditMode(true);
                setInfoNodeId("");
              }}>
                <Settings size={16} />
                Editar mapa
              </button>
            </div>
          )}
          <div className="topology-toolbar-group">
            <span className="topology-live-pill">{onlineNodes}/{monitoredNodes.length} online</span>
            <span className="topology-save-pill" role="status">{saveStatus.replace(/ no arquivo| do arquivo/, "")}</span>
            {pingError ? <span className="topology-error-pill">{pingError}</span> : null}
            <button className="secondary-action" type="button" onClick={refreshTopologyPing} disabled={pingLoading}>
              <RefreshCw size={16} />
              {pingLoading ? "Testando ping..." : "Ping agora"}
            </button>
            <button className="secondary-action" type="button" onClick={() => setActivePanel("monitor")}>
              <Activity size={16} />
              Monitor
            </button>
            <button className="secondary-action" type="button" onClick={() => setActivePanel("inventory")}>
              <Server size={16} />
              Inventário
            </button>
          </div>
        </div>
      </div>

      <div className={`topology-map topology-map-full ${linkMode ? "link-mode" : ""} ${editMode ? "is-editing" : "is-viewing"}`} ref={mapRef} aria-label="Mapa visual da topologia">
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
              {{ utp: "Cabo", fibra: "Fibra", trunk: "Trunk", wan: "WAN" }[link.medium] || link.medium}
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
          {!editMode
            ? "Clique num equipamento para ver IP e ping. Para mover ou editar, use \"Editar mapa\"."
            : linkMode
              ? selectedNodeId
                ? "Clique no equipamento de destino para criar a ligação. Esc cancela."
                : "Clique no equipamento de origem. Esc cancela."
              : "Arraste para organizar; clique para editar. Cada alteração é salva sozinha e pode ser desfeita."}
        </div>

        {/* O que esta fora do ar, sempre a vista (antes so no painel Monitor). */}
        {!editMode && downNodes.length ? (
          <aside className="topology-down-list" aria-label="Equipamentos fora do ar">
            <strong><XCircle size={16} /> Fora do ar ({downNodes.length})</strong>
            <ul>
              {downNodes.slice(0, 8).map((node) => (
                <li key={node.id}>
                  <button type="button" onClick={() => setInfoNodeId(node.id)}>
                    <span>{node.name}</span>
                    <small>{node.ip}</small>
                  </button>
                </li>
              ))}
            </ul>
            {downNodes.length > 8 ? <small>+ {downNodes.length - 8} fora do ar</small> : null}
          </aside>
        ) : null}

        {infoNode ? (
          <aside className="topology-info-card" aria-label={`Equipamento ${infoNode.name}`}>
            <header>
              <strong>{infoNode.name}</strong>
              <button className="icon-button" type="button" onClick={() => setInfoNodeId("")} aria-label="Fechar">
                <X size={16} />
              </button>
            </header>
            <StatusPill label={infoStatus?.tone === "online" ? "Online" : infoStatus?.tone === "offline" ? "Offline" : infoStatus?.label || "Sem dados"} />
            <dl>
              <dt>IP</dt>
              <dd>{infoNode.ip || "—"}</dd>
              <dt>Ping</dt>
              <dd>{infoPing?.latencyMs !== null && infoPing?.latencyMs !== undefined ? `${infoPing.latencyMs} ms` : infoStatus?.label || "—"}</dd>
              <dt>Fabricante</dt>
              <dd>{infoNode.vendor || "—"}</dd>
              <dt>Rede</dt>
              <dd>{infoNode.network || "—"}</dd>
            </dl>
            <button className="secondary-action" type="button" onClick={() => {
              setEditMode(true);
              setInfoNodeId("");
              openNodeEditor(infoNode);
            }}>
              <Settings size={14} />
              Editar
            </button>
          </aside>
        ) : null}
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
                  if (!removeNode(nodeForm.id)) return;
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
  // Uma tabela com abas e uma busca (antes eram 4 paineis de 360 px, cada um com a sua busca).
  // A busca global pode abrir o AD numa aba e ja filtrado.
  const [pending] = useState(() => takePendingSearch("ad"));
  const [adTab, setAdTab] = useState<AdTab>(() => {
    if (pending?.tab) return pending.tab as AdTab;
    // O Inicio pode pedir para abrir direto numa aba (ex.: "Bloqueados").
    try {
      const requested = window.sessionStorage.getItem(AD_TAB_KEY) as AdTab | null;
      window.sessionStorage.removeItem(AD_TAB_KEY);
      return requested || "users";
    } catch {
      return "users";
    }
  });
  const [search, setSearch] = useState(() => pending?.term || "");
  const [page, setPage] = useState(1);
  const [lockoutSearch, setLockoutSearch] = useState("");
  const [lockoutPage, setLockoutPage] = useState(1);
  const [unlockingUser, setUnlockingUser] = useState("");
  const [adNotice, setAdNotice] = useState<{ ok: boolean; text: string } | null>(null);
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

  function changeTab(tab: AdTab) {
    setAdTab(tab);
    setPage(1);
  }

  // Desbloquear direto na linha da lista (a tarefa mais comum do AD).
  async function unlockFromList(user: AdUser) {
    if (!window.confirm(`Desbloquear a conta ${user.samAccountName}? A senha continua a mesma.`)) return;
    setUnlockingUser(user.samAccountName);
    setAdNotice(null);
    try {
      await adRequest(`/api/ad/users/${encodeURIComponent(user.samAccountName)}/unlock`, { method: "POST" });
      setAdNotice({ ok: true, text: `Conta ${user.samAccountName} desbloqueada.` });
      await onRefreshAd();
    } catch (error) {
      setAdNotice({ ok: false, text: error instanceof Error ? error.message : "Não foi possível desbloquear a conta." });
    } finally {
      setUnlockingUser("");
    }
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

  const filteredUsers = filterItems(adDetails.users, search, (user) => [
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
  const filteredStandardItems = filterItems(userStandardItems, search, (item) => [
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
  const filteredComputers = filterItems(adDetails.computers, search, (computer) => [
    computer.cn,
    computer.dNSHostName,
    computer.operatingSystem,
    computer.distinguishedName,
  ]);
  const filteredGroups = filterItems(adDetails.groups, search, (group) => [
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

  const tabs: { key: AdTab; label: string; count: number; alert?: boolean }[] = [
    { key: "users", label: "Usuários", count: adDetails.users.length },
    { key: "locked", label: "Bloqueados", count: adDetails.lockouts.length, alert: adDetails.lockouts.length > 0 },
    { key: "standard", label: "Fora do padrão", count: userStandardItems.length },
    { key: "computers", label: "Máquinas", count: adDetails.computers.length },
    { key: "groups", label: "Grupos", count: adDetails.groups.length },
  ];
  const tabResults = adTab === "users" ? filteredUsers.length : adTab === "standard" ? filteredStandardItems.length : adTab === "computers" ? filteredComputers.length : filteredGroups.length;
  const placeholders: Record<AdTab, string> = {
    users: "Buscar nome, login, e-mail, setor ou OU",
    locked: "",
    standard: "Buscar usuário, setor ou campo faltando",
    computers: "Buscar máquina, DNS, sistema ou OU",
    groups: "Buscar grupo, descrição ou OU",
  };

  return (
    <>
      {!adStatus.ok ? (
        <section className="ad-alert" role="alert">
          <AlertTriangle size={20} />
          <div>
            <strong>O Active Directory não está respondendo</strong>
            <span>{adStatus.message}</span>
          </div>
        </section>
      ) : null}

      <article className="panel ad-main-panel">
        <header className="ad-main-head">
          <div className="ui-tabs" role="tablist" aria-label="Áreas do Active Directory">
            {tabs.map((tab) => (
              <button key={tab.key} type="button" role="tab" aria-selected={adTab === tab.key} className={adTab === tab.key ? "active" : ""} onClick={() => changeTab(tab.key)}>
                {tab.label}
                <b className={`ui-tab-count${tab.alert ? "" : " zero"}`}>{tab.count}</b>
              </button>
            ))}
          </div>
          <div className="ad-main-actions">
            <button className="secondary-action" type="button" onClick={openAddGroupModal}>
              <Users size={16} />
              Adicionar em grupo
            </button>
            <button className="primary-action" type="button" onClick={openCreateUserModal}>
              <Plus size={16} />
              Criar usuário
            </button>
          </div>
        </header>

        {adNotice ? <div className={`action-feedback ${adNotice.ok ? "success" : "error"}`} role={adNotice.ok ? "status" : "alert"}>{adNotice.text}</div> : null}

        {adTab === "locked" ? (
          <LockoutPanel
            adSummary={adSummary}
            lockouts={filterItems(adDetails.lockouts, lockoutSearch, (lockout) => [lockout.user, lockout.cn, lockout.department])}
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
        ) : (
          <>
            <DirectoryTools
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              page={page}
              total={tabResults}
              onPageChange={setPage}
              placeholder={placeholders[adTab]}
            />
            {search.trim() && !tabResults ? (
              <EmptyState title={`Nada encontrado para "${search.trim()}"`} detail="Confira a grafia ou limpe a busca para ver todos." />
            ) : adTab === "users" ? (
              <AdUsersList users={paginate(filteredUsers, page)} onSelect={openUserDetails} onUnlock={unlockFromList} unlocking={unlockingUser} />
            ) : adTab === "standard" ? (
              <UserStandardList items={paginate(filteredStandardItems, page)} onSelect={openUserDetails} />
            ) : adTab === "computers" ? (
              <AdComputersList computers={paginate(filteredComputers, page)} onSelect={openComputerDetails} />
            ) : (
              <AdGroupsList groups={paginate(filteredGroups, page)} />
            )}
          </>
        )}
      </article>
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
    </>
  );
}

type AdTab = "users" | "locked" | "standard" | "computers" | "groups";

// Usuarios ativos com campos obrigatorios faltando (aba "Fora do padrao").
function UserStandardList({ items, onSelect }: { items: UserStandardItem[]; onSelect: (user: AdUser) => void }) {
  if (!items.length) return <EmptyState title="Nenhum usuário fora do padrão" detail="Todos os usuários ativos têm os campos obrigatórios preenchidos." />;
  return (
    <div className="directory-list standard-list">
      {items.map(({ user, missingFields }) => (
        <button className="directory-row directory-button standard-row" key={user.distinguishedName || user.samAccountName} type="button" onClick={() => onSelect(user)}>
          <div>
            <strong>{user.cn || user.displayName || user.samAccountName}</strong>
            <span>{user.samAccountName}</span>
          </div>
          <div>
            <span>{user.department || "Sem departamento"}</span>
            <small>Falta: {missingFields.join(", ")}</small>
          </div>
          <StatusPill label={`${missingFields.length} faltando`} />
        </button>
      ))}
    </div>
  );
}

function IntuneDashboard({
  intuneStatus,
  intuneSummary,
  intuneDetails,
  onRefreshIntune,
  isAdmin,
}: {
  intuneStatus: IntuneStatus;
  intuneSummary: IntuneSummary;
  intuneDetails: IntuneDetails;
  onRefreshIntune: () => Promise<void>;
  isAdmin: boolean;
}) {
  // Windows 10 -> 11 (servidor: /api/intune/windows); carrega junto com a tela para o contador do filtro.
  const [windows, setWindows] = useState<WindowsOverview | null>(null);
  const [windowsError, setWindowsError] = useState("");
  const loadWindows = useCallback(async (refresh = false) => {
    setWindowsError("");
    try {
      setWindows(await adRequest<WindowsOverview>(`/api/intune/windows${refresh ? "?refresh=1" : ""}`, { method: "GET" }));
    } catch (error) {
      setWindowsError(error instanceof Error ? error.message : "Não foi possível ler as máquinas Windows 10.");
    }
  }, []);
  useEffect(() => {
    void loadWindows();
  }, [loadWindows]);
  const [deviceSearch, setDeviceSearch] = useState(() => takePendingSearch("intune")?.term || "");
  const [devicePage, setDevicePage] = useState(1);
  const [deviceFilter, setDeviceFilter] = useState<IntuneFilter>("all");
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

  const nonCompliantDevices = intuneDetails.devices.filter((device) => normalizeText(device.complianceState) === "noncompliant");
  // Um clique filtra; clicar de novo no filtro ativo volta para "Todos".
  const pickFilter = (filter: IntuneFilter) => {
    setDeviceFilter(deviceFilter === filter ? "all" : filter);
    setDevicePage(1);
  };

  return (
    <>
      {!intuneStatus.ok ? (
        <section className="ad-alert" role="alert">
          <AlertTriangle size={20} />
          <div>
            <strong>O Intune não está respondendo</strong>
            <span>{intuneStatus.message}</span>
          </div>
        </section>
      ) : null}

      {/* Uma faixa de filtros no lugar de KPIs + cartoes + painel lateral (os mesmos numeros apareciam 3 vezes). */}
      <section className="intune-filter-board" aria-label="Filtrar dispositivos">
        <IntuneFilterCard active={deviceFilter === "all"} count={intuneDetails.devices.length} icon={Monitor} label="Todos" tone="calm" onClick={() => pickFilter("all")} />
        <IntuneFilterCard active={deviceFilter === "risk"} count={riskDevices.length} icon={AlertTriangle} label="Com risco" tone={riskDevices.length ? "danger" : "calm"} onClick={() => pickFilter("risk")} />
        <IntuneFilterCard active={deviceFilter === "noncompliant"} count={nonCompliantDevices.length} icon={XCircle} label="Não conformes" tone={nonCompliantDevices.length ? "danger" : "calm"} onClick={() => pickFilter("noncompliant")} />
        <IntuneFilterCard active={deviceFilter === "stale"} count={staleDevices.length} icon={Clock3} label="Sem sync há 7 dias" tone={staleDevices.length ? "warn" : "calm"} onClick={() => pickFilter("stale")} />
        <IntuneFilterCard active={deviceFilter === "storage"} count={storageAlerts.length} icon={HardDrive} label="Pouco disco" tone={storageAlerts.length ? "warn" : "calm"} onClick={() => pickFilter("storage")} />
        <IntuneFilterCard active={deviceFilter === "windows"} count={windowsDevices.length} icon={Monitor} label="Windows" tone="calm" onClick={() => pickFilter("windows")} />
        <IntuneFilterCard active={deviceFilter === "win10"} count={windows?.totals.win10 ?? 0} icon={Monitor} label="Windows 10 (sem suporte)" tone={windows?.totals.win10 ? "warn" : "calm"} onClick={() => pickFilter("win10")} />
        <IntuneFilterCard active={deviceFilter === "mobile"} count={mobileDevices.length} icon={Wifi} label="Celulares" tone="calm" onClick={() => pickFilter("mobile")} />
      </section>

      {deviceFilter === "win10" ? (
        <Windows10Panel overview={windows} error={windowsError} isAdmin={isAdmin} onReload={loadWindows} />
      ) : (
      <section className="intune-main">
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
          {deviceSearch.trim() && !filteredDevices.length ? (
            <EmptyState title={`Nada encontrado para "${deviceSearch.trim()}"`} detail="Confira a grafia ou limpe a busca." />
          ) : (
            <IntuneDevicesList devices={paginate(filteredDevices, devicePage)} onSelect={openDeviceDetails} />
          )}
        </article>
      </section>
      )}

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

type WindowsItem = {
  id: string;
  deviceName: string;
  user: string;
  model: string;
  label: string;
  family: string;
  build: number;
  lastSync: string;
  readiness: { status: "capable" | "notCapable" | "unknown"; failed: string[] };
  inGroup: boolean | null;
  blocked: string;
};
type WindowsOverview = {
  checkedAt: string;
  target: { profileName: string; version: string; groupName: string; groupId: string; dynamic: boolean } | null;
  totals: { win10: number; win11: number; server: number; capable: number; notCapable: number; unknown: number; inGroup: number };
  items: WindowsItem[];
  warnings: string[];
  capabilities: { groupWrite: boolean; sync: boolean; missing: string[] };
};
type Win10Filter = "all" | "ready" | "blocked" | "scheduled" | "server";

// Windows 10 sem suporte: quem ainda esta no 10, se da para ir ao 11 e o agendamento pela politica do Intune.
// O NOC poe a maquina no grupo da politica "Feature updates"; o Windows Update instala e reinicia depois.
function Windows10Panel({ overview, error, isAdmin, onReload }: { overview: WindowsOverview | null; error: string; isAdmin: boolean; onReload: (refresh?: boolean) => Promise<void> }) {
  const [filter, setFilter] = useState<Win10Filter>("all");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<{ kind: "schedule" | "cancel"; item: WindowsItem } | null>(null);
  const [comment, setComment] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const closeAction = useCallback(() => setAction(null), []);
  useEscape(Boolean(action), closeAction);

  if (!overview) {
    return (
      <section className="panel">
        {error ? <EmptyState title="Não foi possível ler as máquinas Windows 10" detail={error} /> : <EmptyState title="Consultando o Intune..." detail="Lendo máquinas, compatibilidade com o Windows 11 e a política de atualização." />}
      </section>
    );
  }

  const desktops = overview.items.filter((item) => item.family === "win10");
  const counts = {
    ready: desktops.filter((item) => !item.blocked && !item.inGroup).length,
    blocked: desktops.filter((item) => item.blocked).length,
    scheduled: desktops.filter((item) => item.inGroup).length,
    server: overview.totals.server,
  };
  const rows = filterItems(
    overview.items.filter((item) =>
      filter === "server" ? item.family === "server" : item.family === "win10" && (filter === "all" || (filter === "ready" ? !item.blocked && !item.inGroup : filter === "blocked" ? Boolean(item.blocked) : Boolean(item.inGroup))),
    ),
    search,
    (item) => [item.deviceName, item.user, item.model, item.label],
  );
  const canAct = isAdmin && overview.capabilities.groupWrite && Boolean(overview.target?.groupId) && !overview.target?.dynamic;
  const relative = (iso: string) => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
    return days <= 0 ? "hoje" : days === 1 ? "ontem" : `há ${days} dias`;
  };

  function openAction(kind: "schedule" | "cancel", item: WindowsItem) {
    setAction({ kind, item });
    setComment("");
    setConfirmName("");
    setNotice(null);
  }

  async function runAction() {
    if (!action) return;
    setBusy(action.item.id);
    try {
      const result = await adRequest<{ message: string }>(`/api/intune/devices/${encodeURIComponent(action.item.id)}/windows11`, {
        method: action.kind === "schedule" ? "POST" : "DELETE",
        body: { comment, confirmName },
      });
      setNotice({ ok: true, text: result.message });
      setAction(null);
      await onReload(true);
    } catch (actionError) {
      setNotice({ ok: false, text: actionError instanceof Error ? actionError.message : "Falha ao falar com o Intune." });
    } finally {
      setBusy("");
    }
  }

  async function syncDevice(item: WindowsItem) {
    setBusy(item.id);
    setNotice(null);
    try {
      const result = await adRequest<{ message: string }>(`/api/intune/devices/${encodeURIComponent(item.id)}/sync`, { method: "POST" });
      setNotice({ ok: true, text: `${item.deviceName}: ${result.message}` });
    } catch (syncError) {
      setNotice({ ok: false, text: syncError instanceof Error ? syncError.message : "Falha ao pedir a sincronização." });
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="panel win10-panel">
      <header className="ad-main-head">
        <div>
          <h2 className="win10-title">Windows 10 · sem suporte da Microsoft desde 14/10/2025</h2>
          <p className="win10-target">
            {overview.target
              ? <>Política do Intune: <b>{overview.target.profileName}</b> → {overview.target.version.replace("Windows 11, version", "Windows 11")} · grupo <b>{overview.target.groupName || overview.target.groupId}</b></>
              : "Sem política de atualização para o Windows 11 no Intune."}
          </p>
        </div>
        <div className="ad-main-actions">
          <button className="secondary-action" type="button" onClick={() => onReload(true)}>
            <RefreshCw size={15} />
            Atualizar
          </button>
        </div>
      </header>

      {overview.warnings.map((warning) => <div key={warning} className="action-feedback error" role="alert">{warning}</div>)}
      {!overview.capabilities.groupWrite ? (
        <div className="action-feedback warn-note">
          Para agendar pelo NOC falta a permissão <b>GroupMember.ReadWrite.All</b> no app do portal (Entra ID → Registros de aplicativo → Rede Clube POP → Permissões de API → consentimento do administrador). Até lá, a tela só mostra.
        </div>
      ) : !isAdmin ? (
        <div className="action-feedback warn-note">Só o gestor do portal pode colocar máquinas na atualização.</div>
      ) : null}
      {notice ? <div className={`action-feedback ${notice.ok ? "success" : "error"}`} role={notice.ok ? "status" : "alert"}>{notice.text}</div> : null}

      <div className="ct-filters" role="group" aria-label="Filtrar máquinas Windows 10">
        {([
          ["all", `Windows 10 (${desktops.length})`],
          ["ready", `Prontas para o 11 (${counts.ready})`],
          ["scheduled", `Na atualização (${counts.scheduled})`],
          ["blocked", `Não podem ir (${counts.blocked})`],
          ["server", `Servidores (${counts.server})`],
        ] as [Win10Filter, string][]).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={filter === key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>
      <label className="directory-search">
        <Search size={15} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar máquina, usuário ou modelo" aria-label="Buscar máquina Windows 10" />
      </label>

      <div className="ct-table-wrap">
        <table className="ct-table win10-table">
          <thead>
            <tr>
              <th>Máquina</th>
              <th>Sistema</th>
              <th>Windows 11</th>
              <th>Situação</th>
              <th className="num">Último sync</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id} className="win10-row">
                <td>
                  <strong className="ct-title">{item.deviceName}</strong>
                  <small className="ct-cat">{[item.user, item.model].filter(Boolean).join(" · ") || "—"}</small>
                </td>
                <td>{item.label}</td>
                <td>
                  <StatusPill label={item.family === "server" ? "Fora" : item.readiness.status === "capable" ? "Compatível" : item.readiness.status === "notCapable" ? "Incompatível" : "Sem relatório"} />
                  {item.readiness.failed.length ? <small className="ct-cat">falta {item.readiness.failed.join(", ")}</small> : null}
                </td>
                <td>{item.inGroup ? <StatusPill label="Na atualização" /> : item.blocked ? <small className="win10-blocked">{item.blocked}</small> : <span className="ct-muted">pronta para agendar</span>}</td>
                <td className="num">{item.lastSync ? relative(item.lastSync) : "—"}</td>
                <td>
                  <div className="win10-actions">
                    {item.inGroup ? (
                      <button className="secondary-action compact-action" type="button" disabled={!canAct || Boolean(busy)} onClick={() => openAction("cancel", item)}>Tirar da atualização</button>
                    ) : !item.blocked ? (
                      <button className="primary-action compact-action" type="button" disabled={!canAct || Boolean(busy)} onClick={() => openAction("schedule", item)}>Atualizar para o 11</button>
                    ) : null}
                    {item.family === "win10" && overview.capabilities.sync && isAdmin ? (
                      <button className="secondary-action compact-action" type="button" disabled={Boolean(busy)} onClick={() => syncDevice(item)} title="Pede para a máquina buscar políticas e atualizações agora">
                        <RefreshCw size={13} />
                        {busy === item.id ? "Pedindo..." : "Sincronizar"}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={6} className="ct-empty-row">{search.trim() ? `Nada encontrado para "${search.trim()}".` : "Nenhuma máquina neste filtro."}</td></tr> : null}
          </tbody>
        </table>
      </div>

      {action ? (
        <div className="modal-backdrop" role="presentation" onClick={closeAction}>
          <section className="user-modal win10-confirm" role="dialog" aria-modal="true" aria-label="Confirmar atualização do Windows" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <p className="eyebrow">{action.kind === "schedule" ? "Atualizar para o Windows 11" : "Tirar da atualização"}</p>
                <h2>{action.item.deviceName}</h2>
                <span>{[action.item.user, action.item.model, action.item.label].filter(Boolean).join(" · ")}</span>
              </div>
              <button className="icon-button" type="button" onClick={closeAction} aria-label="Fechar">
                <X size={18} />
              </button>
            </header>
            {action.kind === "schedule" ? (
              <ul className="win10-effects">
                <li>A máquina entra no grupo <b>{overview.target?.groupName}</b> da política <b>{overview.target?.profileName}</b>.</li>
                <li>O Windows Update oferece o {overview.target?.version.replace("Windows 11, version", "Windows 11")} nas próximas horas (cerca de 4 GB de download).</li>
                <li>A instalação leva de 30 a 90 min e <b>reinicia a máquina</b>, conforme o anel de atualização do Intune. Avise o usuário.</li>
              </ul>
            ) : (
              <p className="win10-effects">A máquina sai do grupo da política. Se a instalação já começou, ela pode terminar mesmo assim.</p>
            )}
            <label className="field-control">
              <span>Motivo (obrigatório, mínimo 5 caracteres; fica na auditoria do portal)</span>
              <textarea rows={2} maxLength={500} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Ex.: combinado com o usuário, atualizar no fim do expediente" autoFocus />
            </label>
            <label className="field-control">
              <span>Para confirmar, digite o nome da máquina: <b>{action.item.deviceName}</b></span>
              <input value={confirmName} onChange={(event) => setConfirmName(event.target.value)} autoComplete="off" />
            </label>
            <div className="modal-footer-actions">
              <button className="secondary-action" type="button" onClick={closeAction}>Cancelar</button>
              <button
                className={action.kind === "schedule" ? "primary-action" : "danger-action"}
                type="button"
                disabled={Boolean(busy) || comment.trim().length < 5 || confirmName.trim().toLowerCase() !== action.item.deviceName.toLowerCase()}
                onClick={runAction}
              >
                {busy ? "Enviando..." : action.kind === "schedule" ? "Colocar na atualização" : "Tirar da atualização"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function Office365Dashboard({
  office365Status,
  office365Summary,
  office365Details,
  onRefreshOffice365,
}: {
  office365Status: Office365Status;
  office365Summary: Office365Summary;
  office365Details: Office365Details;
  onRefreshOffice365: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"users" | "licenses" | "groups">("users");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [operationFilter, setOperationFilter] = useState("");
  const [licenseUser, setLicenseUser] = useState<Office365User | null>(null);
  const [licenseSelection, setLicenseSelection] = useState<string[]>([]);
  const [licenseSaving, setLicenseSaving] = useState(false);
  const [licenseError, setLicenseError] = useState("");
  const [licenseMessage, setLicenseMessage] = useState("");

  const usersByOperation = operationFilter === "licensed-users"
    ? office365Details.users.filter((user) => user.assignedLicenses.length)
    : operationFilter === "unlicensed-users"
      ? office365Details.users.filter((user) => !user.assignedLicenses.length)
      : operationFilter === "disabled-licensed"
        ? office365Details.users.filter((user) => !user.accountEnabled && user.assignedLicenses.length)
        : office365Details.users;
  const licensesByOperation = operationFilter === "license-usage"
    ? office365Details.licenses.filter((license) => license.consumedUnits > 0)
    : operationFilter === "license-full"
      ? office365Details.licenses.filter((license) => license.enabledUnits > 0 && license.availableUnits === 0)
      : office365Details.licenses;
  const groupsByOperation = operationFilter === "licensed-groups"
    ? office365Details.groups.filter((group) => group.assignedLicenses.length)
    : office365Details.groups;
  const currentItems = tab === "users" ? usersByOperation : tab === "licenses" ? licensesByOperation : groupsByOperation;
  const filteredUsers = filterItems(usersByOperation, search, (user) => [
    user.displayName,
    user.userPrincipalName,
    user.mail,
    user.department,
    user.jobTitle,
    user.assignedLicenses.join(" "),
  ]);
  const filteredLicenses = filterItems(licensesByOperation, search, (license) => [
    license.skuPartNumber,
    license.skuId,
    String(license.consumedUnits),
    String(license.availableUnits),
  ]);
  const filteredGroups = filterItems(groupsByOperation, search, (group) => [
    group.displayName,
    group.description,
    group.mail,
    group.groupTypes.join(" "),
    group.assignedLicenses.join(" "),
  ]);
  const filteredItems = tab === "users" ? filteredUsers : tab === "licenses" ? filteredLicenses : filteredGroups;
  const unlicensedUsersCount = office365Details.users.filter((user) => !user.assignedLicenses.length).length;
  // Conta desativada ainda com licenca = custo sem uso.
  const disabledLicensedCount = office365Details.users.filter((user) => !user.accountEnabled && user.assignedLicenses.length).length;
  const fullLicensesCount = office365Details.licenses.filter((license) => license.enabledUnits > 0 && license.availableUnits === 0).length;
  const licensedGroupsCount = office365Details.groups.filter((group) => group.assignedLicenses.length).length;

  function changeTab(nextTab: "users" | "licenses" | "groups", nextOperationFilter = "") {
    setTab(nextTab);
    setSearch("");
    setPage(1);
    setOperationFilter(nextOperationFilter);
  }

  // Clicar de novo no filtro ativo limpa o filtro.
  function applyOperationFilter(nextTab: "users" | "licenses" | "groups", nextOperationFilter: string) {
    changeTab(nextTab, operationFilter === nextOperationFilter ? "" : nextOperationFilter);
  }

  function openLicenseModal(user: Office365User) {
    setLicenseUser(user);
    setLicenseSelection(user.assignedLicenseSkuIds || []);
    setLicenseError("");
    setLicenseMessage("");
  }

  function closeLicenseModal() {
    if (licenseSaving) return;
    setLicenseUser(null);
    setLicenseSelection([]);
    setLicenseError("");
    setLicenseMessage("");
  }

  async function saveUserLicenses() {
    if (!licenseUser) return;

    setLicenseSaving(true);
    setLicenseError("");
    setLicenseMessage("");

    try {
      const response = await authFetch(`/api/office365/users/${encodeURIComponent(licenseUser.id)}/licenses`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skuIds: licenseSelection }),
      });
      const payload = await parseApiPayload<{ message?: string }>(response, {});

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel aplicar as licencas.");
      }

      setLicenseMessage(payload.message || "Licencas atualizadas com sucesso.");
      await onRefreshOffice365();
      window.setTimeout(() => closeLicenseModal(), 900);
    } catch (error) {
      setLicenseError(error instanceof Error ? error.message : "Nao foi possivel aplicar as licencas.");
    } finally {
      setLicenseSaving(false);
    }
  }

  return (
    <>
      {!office365Status.ok ? (
        <section className="ad-alert" role="alert">
          <AlertTriangle size={20} />
          <div>
            <strong>O Office 365 não está respondendo</strong>
            <span>{office365Status.message}</span>
          </div>
        </section>
      ) : null}

      {/* Os problemas viram filtros no topo (no lugar de KPIs + painel lateral que repetia a aba Licencas). */}
      <section className="intune-filter-board office365-filter-board" aria-label="Filtrar por problema">
        <IntuneFilterCard active={operationFilter === "unlicensed-users"} count={unlicensedUsersCount} icon={Users} label="Usuários sem licença" tone={unlicensedUsersCount ? "warn" : "calm"} onClick={() => applyOperationFilter("users", "unlicensed-users")} />
        <IntuneFilterCard active={operationFilter === "disabled-licensed"} count={disabledLicensedCount} icon={UserX} label="Desativados com licença" tone={disabledLicensedCount ? "danger" : "calm"} onClick={() => applyOperationFilter("users", "disabled-licensed")} />
        <IntuneFilterCard active={operationFilter === "license-full"} count={fullLicensesCount} icon={TableIcon} label="Licenças sem saldo" tone={fullLicensesCount ? "danger" : "calm"} onClick={() => applyOperationFilter("licenses", "license-full")} />
        <IntuneFilterCard active={operationFilter === "licensed-groups"} count={licensedGroupsCount} icon={Network} label="Grupos com licença" tone="calm" onClick={() => applyOperationFilter("groups", "licensed-groups")} />
      </section>

      <section className="intune-main">
        <article className="panel office365-main-panel">
          <header className="ad-main-head">
            <div className="ui-tabs" role="tablist" aria-label="Office 365">
              {([
                ["users", "Usuários", office365Details.users.length],
                ["licenses", "Licenças", office365Details.licenses.length],
                ["groups", "Grupos", office365Details.groups.length],
              ] as ["users" | "licenses" | "groups", string, number][]).map(([key, label, count]) => (
                <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => changeTab(key)}>
                  {label} <b className="ui-tab-count zero">{count}</b>
                </button>
              ))}
            </div>
            <div className="ad-main-actions">
              <button className="secondary-action" type="button" onClick={onRefreshOffice365}>
                <RefreshCw size={15} />
                Atualizar
              </button>
            </div>
          </header>

          {operationFilter ? (
            <div className="office365-filter-chip">
              <span>{office365OperationLabel(operationFilter)}</span>
              <button type="button" onClick={() => changeTab(tab)}>
                Limpar
              </button>
            </div>
          ) : null}

          <DirectoryTools
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            page={page}
            total={filteredItems.length}
            onPageChange={setPage}
            placeholder={tab === "users" ? "Procurar usuario, e-mail, setor ou licenca" : tab === "licenses" ? "Procurar SKU ou ID da licenca" : "Procurar grupo, e-mail, tipo ou licenca"}
          />

          {tab === "users" ? (
            <Office365UsersList users={paginate(filteredUsers, page)} onEditLicenses={openLicenseModal} />
          ) : tab === "licenses" ? (
            <Office365LicensesList licenses={paginate(filteredLicenses, page)} />
          ) : (
            <Office365GroupsList groups={paginate(filteredGroups, page)} />
          )}
        </article>
      </section>

      {licenseUser ? (
        <Office365LicenseModal
          user={licenseUser}
          licenses={office365Details.licenses}
          selectedSkuIds={licenseSelection}
          saving={licenseSaving}
          error={licenseError}
          message={licenseMessage}
          onChange={setLicenseSelection}
          onSave={saveUserLicenses}
          onClose={closeLicenseModal}
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

// Endereco do Milvus: abre sempre em nova aba (dentro do portal o navegador bloqueia a sessao).
const MILVUS_URL = "https://app.milvus.com.br/login";

// So aparece para quem tinha esta tela salva como a ultima aberta: o menu ja abre o Milvus em nova aba.
function MilvusPortalView() {
  return (
    <section className="panel milvus-portal-link">
      <ClipboardList size={32} />
      <h2>Chamados no Milvus</h2>
      <p>O Milvus abre em uma nova aba, já com o login do próprio Milvus.</p>
      <a className="primary-action" href={MILVUS_URL} target="_blank" rel="noreferrer">
        Abrir o Milvus
        <ExternalLink size={16} aria-hidden="true" />
      </a>
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
  // O campo e a busca aplicada sao separados: consulta o banco so 400 ms depois de parar de digitar.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [editingId, setEditingId] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formSnapshot, setFormSnapshot] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
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
    setSearchInput("");
    setSearch("");
    setForm({});
    setEditingId("");
    setDrawerOpen(false);
    setMessage("");
    setError("");
  }

  function openDrawer(nextForm: Record<string, unknown>, id: string) {
    setForm(nextForm);
    setFormSnapshot(JSON.stringify(nextForm));
    setEditingId(id);
    setMessage("");
    setError("");
    setDrawerOpen(true);
  }

  function newRecord() {
    openDrawer(emptyWifiRecord(columns), "");
  }

  function editRecord(record: Record<string, unknown>) {
    openDrawer({ ...record }, String(record[primaryKey] ?? ""));
  }

  // Fechar com campos alterados pergunta antes (antes, clicar em outra linha descartava o que foi digitado).
  function closeDrawer() {
    if (JSON.stringify(form) !== formSnapshot && !window.confirm("Descartar as alterações deste cadastro?")) return;
    setDrawerOpen(false);
    setEditingId("");
  }

  const recordName = (record: Record<string, unknown>) =>
    String(record.nome ?? record.name ?? record.username ?? record.email ?? record[primaryKey] ?? "este cadastro");

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
      setDrawerOpen(false);
      await loadWifi();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel salvar registro WiFi.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRecord() {
    if (!editingId) return;
    if (!window.confirm(`Remover ${recordName(form)} do Wi-Fi? A pessoa perde o acesso à rede e não dá para desfazer.`)) return;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const result = await adRequest<{ message: string }>(`/api/wifi/${kind}/${encodeURIComponent(editingId)}`, { method: "DELETE" });
      setMessage(result.message || "Registro removido.");
      setEditingId("");
      setForm(emptyWifiRecord(columns));
      setDrawerOpen(false);
      await loadWifi();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Nao foi possivel remover registro WiFi.");
    } finally {
      setSaving(false);
    }
  }

  useEscape(drawerOpen, closeDrawer);
  const kindLabel = kind === "associados" ? "associado" : "colaborador";

  return (
    <>
      <section className="panel wifi-panel">
        <header className="ad-main-head">
          <div className="ui-tabs" role="tablist" aria-label="Cadastros do Wi-Fi">
            <button role="tab" aria-selected={kind === "associados"} className={kind === "associados" ? "active" : ""} type="button" onClick={() => changeKind("associados")}>
              Associados
            </button>
            <button role="tab" aria-selected={kind === "colaboradores"} className={kind === "colaboradores" ? "active" : ""} type="button" onClick={() => changeKind("colaboradores")}>
              Colaboradores
            </button>
          </div>
          <div className="ad-main-actions">
            {/* Estado do banco numa linha (no lugar de 4 KPIs tecnicos: MySQL, base, campos, chave). */}
            <span className={`wifi-db-state ${status.ok ? "ok" : "bad"}`} title={status.message}>
              {status.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {status.ok ? "banco conectado" : "banco sem resposta"}
              {payload ? ` · ${payload.hasMore ? `${payload.total}+` : payload.total} cadastros` : ""}
            </span>
            <button className="secondary-action" type="button" onClick={loadWifi} disabled={loading}>
              <RefreshCw size={15} />
              Atualizar
            </button>
            <button className="primary-action" type="button" onClick={newRecord} disabled={!columns.length}>
              <Plus size={15} />
              Novo {kindLabel}
            </button>
          </div>
        </header>

        {error && !drawerOpen ? <div className="form-error" role="alert">{error}</div> : null}
        {message && !drawerOpen ? <div className="form-success" role="status">{message}</div> : null}

        <section className="wifi-list">
          <DirectoryTools
            value={searchInput}
            onChange={setSearchInput}
            page={page}
            total={payload?.total || 0}
            onPageChange={setPage}
            placeholder="Buscar nome, e-mail, CPF, matrícula ou qualquer campo"
            pageSizeOverride={payload?.pageSize || 20}
          />

          <div className="wifi-table">
            <div className="wifi-table-head" style={{ gridTemplateColumns: wifiGridTemplate(visibleColumns.length) }}>
              {visibleColumns.map((column) => (
                <span key={column.name}>{wifiFieldLabel(kind, column)}</span>
              ))}
              <span>Ações</span>
            </div>
            {(payload?.items || []).map((record, index) => {
              const recordId = String(record[primaryKey] ?? index);
              return (
                <button className="wifi-table-row" key={recordId} onClick={() => editRecord(record)} style={{ gridTemplateColumns: wifiGridTemplate(visibleColumns.length) }} type="button">
                  {visibleColumns.map((column) => (
                    <span key={column.name}>{formatWifiValue(record[column.name])}</span>
                  ))}
                  <strong>Abrir</strong>
                </button>
              );
            })}
            {!payload?.items?.length ? (
              <EmptyState
                title={loading ? "Carregando..." : search.trim() ? `Nada encontrado para "${search.trim()}"` : "Nenhum cadastro"}
                detail={search.trim() ? "Confira a grafia ou limpe a busca." : `Use "Novo ${kindLabel}" para cadastrar.`}
              />
            ) : null}
          </div>
        </section>
      </section>

      {drawerOpen ? (
        <>
          <div className="side-drawer-backdrop" onClick={closeDrawer} />
          <aside className="side-drawer" role="dialog" aria-modal="true" aria-label={editingId ? `Editar ${kindLabel}` : `Novo ${kindLabel}`}>
            <header className="side-drawer-head">
              <div>
                <p className="eyebrow">{editingId ? `Editar ${kindLabel}` : `Novo ${kindLabel}`}</p>
                <h2>{editingId ? recordName(form) : kind === "associados" ? "Associado" : "Colaborador"}</h2>
              </div>
              <button className="icon-button" type="button" onClick={closeDrawer} aria-label="Fechar">
                <X size={18} />
              </button>
            </header>

            {error ? <div className="form-error" role="alert">{error}</div> : null}

            <form className="wifi-form" onSubmit={saveRecord}>
              {writableColumns.map((column) => (
                <label key={column.name}>
                  <span>{wifiFieldLabel(kind, column)}{column.nullable ? "" : " *"}</span>
                  <input
                    disabled={saving}
                    onChange={(event) => setForm((current) => ({ ...current, [column.name]: event.target.value }))}
                    value={String(form[column.name] ?? "")}
                  />
                </label>
              ))}
              {!writableColumns.length ? (
                <EmptyState title="Tabela sem campos editáveis" detail="Confira as permissões e a estrutura da tabela no banco." />
              ) : null}
              <div className="wifi-actions">
                <button className="secondary-action" type="button" onClick={closeDrawer} disabled={saving}>
                  Cancelar
                </button>
                <button className="primary-action" type="submit" disabled={saving || !writableColumns.length}>
                  <Save size={15} />
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>

            {/* Remover separado de Salvar, no fim da gaveta. */}
            {editingId ? (
              <div className="side-drawer-danger">
                <button className="danger-action" type="button" onClick={removeRecord} disabled={saving}>
                  <Trash2 size={15} />
                  Remover do Wi-Fi
                </button>
              </div>
            ) : null}
          </aside>
        </>
      ) : null}
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
  // A lista vem primeiro; cadastrar/editar abre numa gaveta a direita (antes o formulario ocupava a tela).
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "offline" | "online" | "disabled">("all");

  const metricByDevice = new Map(snmpDetails.metrics.map((metric) => [metric.deviceId, metric]));
  const deviceState = (device: SnmpDevice) => {
    const metric = metricByDevice.get(device.id);
    return !device.enabled ? "disabled" : metric?.ok ? "online" : metric ? "offline" : "waiting";
  };
  const stateRank = { offline: 0, waiting: 1, online: 2, disabled: 3 } as const;
  const counts = {
    offline: snmpDetails.devices.filter((device) => deviceState(device) === "offline").length,
    online: snmpDetails.devices.filter((device) => deviceState(device) === "online").length,
    disabled: snmpDetails.devices.filter((device) => deviceState(device) === "disabled").length,
  };
  const filteredDevices = filterItems(
    snmpDetails.devices.filter((device) => statusFilter === "all" || deviceState(device) === statusFilter),
    search,
    (device) => {
      const metric = metricByDevice.get(device.id);
      return [device.name, device.host, device.type, device.version, device.notes, metric?.sysName, metric?.sysDescr, metric?.message];
    },
  ).sort((a, b) => stateRank[deviceState(a)] - stateRank[deviceState(b)] || (a.name || a.host).localeCompare(b.name || b.host, "pt-BR", { numeric: true }));
  const pagedDevices = paginate(filteredDevices, page);

  function editDevice(device: SnmpDevice) {
    setForm({ ...device });
    setMessage("");
    setError("");
    setTestMetric(metricByDevice.get(device.id) || null);
    setDrawerOpen(true);
  }

  function newDevice() {
    setForm(emptySnmpDevice());
    setMessage("");
    setError("");
    setTestMetric(null);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
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
      setDrawerOpen(false);
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
    if (!window.confirm(`Remover "${device.name || device.host}" (${device.host}) da coleta SNMP? Não dá para desfazer.`)) return;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await adRequest(`/api/snmp/devices/${encodeURIComponent(device.id)}`, { method: "DELETE" });
      if (form.id === device.id) closeDrawer();
      setMessage(`${device.name || device.host} removido da coleta.`);
      await onRefreshSnmp();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Nao foi possivel remover o dispositivo.");
    } finally {
      setSaving(false);
    }
  }

  useEscape(drawerOpen, closeDrawer);
  const stateLabel = { offline: "Offline", online: "Online", disabled: "Desativado", waiting: "Aguardando" } as const;
  const pickStatus = (value: typeof statusFilter) => {
    setStatusFilter(statusFilter === value ? "all" : value);
    setPage(1);
  };

  return (
    <>
      <section className="intune-filter-board" aria-label="Filtrar equipamentos">
        <IntuneFilterCard active={statusFilter === "all"} count={snmpSummary.total} icon={Signal} label="Todos" tone="calm" onClick={() => pickStatus("all")} />
        <IntuneFilterCard active={statusFilter === "offline"} count={counts.offline} icon={XCircle} label="Offline" tone={counts.offline ? "danger" : "calm"} onClick={() => pickStatus("offline")} />
        <IntuneFilterCard active={statusFilter === "online"} count={counts.online} icon={CheckCircle2} label="Online" tone="calm" onClick={() => pickStatus("online")} />
        <IntuneFilterCard active={statusFilter === "disabled"} count={counts.disabled} icon={Clock3} label="Desativados" tone="calm" onClick={() => pickStatus("disabled")} />
      </section>

      <section className="intune-main">
        <section className="panel snmp-list-panel">
          <PanelHeader
            icon={Server}
            title="Equipamentos coletados pelo portal"
            meta={`${filteredDevices.length}/${snmpDetails.devices.length} · coleta a cada 60 s`}
            action={
              <div className="ad-main-actions">
                <button className="secondary-action" type="button" onClick={collectAll} disabled={saving || !snmpDetails.devices.length}>
                  <RefreshCw size={15} />
                  Coletar todos
                </button>
                <button className="primary-action" type="button" onClick={newDevice}>
                  <Plus size={15} />
                  Novo equipamento
                </button>
              </div>
            }
          />
          {error && !drawerOpen ? <div className="form-error" role="alert">{error}</div> : null}
          {message && !drawerOpen ? <div className="form-success" role="status">{message}</div> : null}
          <DirectoryTools
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            page={page}
            total={filteredDevices.length}
            onPageChange={setPage}
            placeholder="Buscar IP, nome, tipo ou descrição"
          />
          <div className="snmp-device-list">
            {pagedDevices.map((device) => {
              const metric = metricByDevice.get(device.id);
              const state = deviceState(device);
              const tone = state === "disabled" ? "idle" : state === "online" ? "online" : state === "offline" ? "offline" : "warn";
              return (
                <article className={`snmp-device-row ${tone}`} key={device.id}>
                  <div>
                    <strong>{device.name || device.host}</strong>
                    <span>{device.host}:{device.port} · {device.type} · SNMPv{device.version}</span>
                    <small>{metric?.sysName || metric?.message || "Ainda sem coleta"}</small>
                  </div>
                  <div className="snmp-device-meta">
                    {/* Status escrito (nao so a cor da linha). */}
                    <StatusPill label={stateLabel[state]} />
                    <span>{metric?.latencyMs !== null && metric?.latencyMs !== undefined ? `${metric.latencyMs} ms` : ""}</span>
                    <button className="secondary-action" type="button" onClick={() => collectDevice(device)} disabled={saving || !device.enabled} title="Coletar agora">
                      <RefreshCw size={14} />
                      Coletar
                    </button>
                    <button className="secondary-action" type="button" onClick={() => editDevice(device)}>
                      <Settings size={14} />
                      Editar
                    </button>
                  </div>
                </article>
              );
            })}
            {!pagedDevices.length ? (
              <div className="empty-state">
                <strong>{snmpDetails.devices.length ? "Nenhum equipamento com esse filtro" : "Nenhum equipamento SNMP cadastrado"}</strong>
                <span>{snmpDetails.devices.length ? "Limpe a busca ou o filtro." : "Cadastre o IP do Fortinet, UniFi ou switch para testar a coleta."}</span>
              </div>
            ) : null}
          </div>
        </section>
      </section>

      {drawerOpen ? (
        <>
          <div className="side-drawer-backdrop" onClick={closeDrawer} />
          <aside className="side-drawer" role="dialog" aria-modal="true" aria-label={form.id ? "Editar equipamento SNMP" : "Novo equipamento SNMP"}>
          <header className="side-drawer-head">
            <div>
              <p className="eyebrow">{form.version === "3" ? "SNMPv3" : `SNMPv${form.version}`}</p>
              <h2>{form.id ? form.name || form.host : "Novo equipamento"}</h2>
            </div>
            <button className="icon-button" type="button" onClick={closeDrawer} aria-label="Fechar">
              <X size={18} />
            </button>
          </header>

          {error ? <div className="form-error" role="alert">{error}</div> : null}
          {message ? <div className="form-success" role="status">{message}</div> : null}

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
                <span>Versão</span>
                <select value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value as SnmpVersion })}>
                  <option value="2c">SNMP v2c</option>
                  <option value="1">SNMP v1</option>
                  <option value="3">SNMP v3</option>
                </select>
              </label>
              {form.version !== "3" ? (
                <label>
                  <span>Community</span>
                  <input value={form.community} onChange={(event) => setForm({ ...form, community: event.target.value })} placeholder={form.id ? "Salva - deixe vazio para manter" : "public"} type="password" autoComplete="off" />
                </label>
              ) : (
                <label>
                  <span>Usuário v3</span>
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
                    <input value={form.authKey} onChange={(event) => setForm({ ...form, authKey: event.target.value })} placeholder={form.id ? "Deixe vazio para manter" : ""} type="password" autoComplete="off" />
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
                    <input value={form.privKey} onChange={(event) => setForm({ ...form, privKey: event.target.value })} placeholder={form.id ? "Deixe vazio para manter" : ""} type="password" autoComplete="off" />
                  </label>
                </>
              ) : null}
              <label>
                <span>Tempo limite (ms)</span>
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
              <span>Observações</span>
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Portas importantes, local físico, link..." />
            </label>
            <div className="snmp-actions">
              <button className="secondary-action" type="button" onClick={testDevice} disabled={saving || !form.host.trim()}>
                <Activity size={15} />
                Testar SNMP
              </button>
              <button className="secondary-action" type="button" onClick={autoDetectVersion} disabled={saving || !form.host.trim() || form.version === "3"} title="Testa v2c e depois v1">
                <Signal size={15} />
                Detectar versão
              </button>
              <button className="primary-action" type="submit" disabled={saving || !form.host.trim()}>
                <Save size={15} />
                Salvar
              </button>
            </div>
          </form>

          {testMetric ? <SnmpMetricPreview metric={testMetric} /> : null}

          {/* Remover fica separado, no fim da gaveta, longe de Salvar. */}
          {form.id ? (
            <div className="side-drawer-danger">
              <button className="danger-action" type="button" onClick={() => removeDevice(form)} disabled={saving}>
                <Trash2 size={14} />
                Remover da coleta
              </button>
            </div>
          ) : null}
          </aside>
        </>
      ) : null}
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
  const [search, setSearch] = useState(() => takePendingSearch("ips")?.term || "");
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
  // Agrupa (circuito + servicos) antes de paginar: paginar antes separava o servico do seu circuito.
  const linkGroups = buildInternetLinkGroups(filteredLinks);
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
          total={ipSection === "subnets" ? filteredNetworks.length : ipSection === "links" ? linkGroups.length : filteredItems.length}
          onPageChange={setPage}
          placeholder={ipSection === "subnets" ? "Procurar rede, VLAN ou categoria" : ipSection === "links" ? "Procurar link, URL ou categoria" : "Procurar IP, local, categoria ou observacao"}
          pageSizeOverride={12}
        />
        {ipSection === "subnets" ? (
          <IpSubnetsTable summaries={paginate(filteredNetworks, page, 12)} onEditVlan={openVlanModal} />
        ) : ipSection === "links" ? (
          <IpLinksTable groups={paginate(linkGroups, page, 12)} onEdit={openEditLink} />
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

function TicketStatusCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  active,
  onClick,
}: {
  icon: LucideIcon;
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
      {/* A busca filtra as contas bloqueadas (acima) e o historico de bloqueios (abaixo). */}
      {onSearchChange && onPageChange ? (
        <DirectoryTools
          value={search}
          onChange={onSearchChange}
          page={page}
          total={totalEvents}
          onPageChange={onPageChange}
          placeholder="Procurar conta bloqueada, máquina de origem ou DC"
        />
      ) : null}
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
        ) : search.trim() ? (
          <EmptyState title="Nenhuma conta bloqueada com essa busca" detail="Limpe a busca para ver todas." />
        ) : (
          <EmptyState title="Nenhuma conta bloqueada agora" detail="O AD nao retornou bloqueios ativos." />
        )}
      </div>
      {onSearchChange && onPageChange ? (
        <div className="event-log-section">
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

// Linha do usuario; bloqueado ganha "Desbloquear" na propria linha (sem abrir a ficha).
function AdUsersList({
  users,
  onSelect,
  onUnlock,
  unlocking = "",
}: {
  users: AdUser[];
  onSelect: (user: AdUser) => void;
  onUnlock?: (user: AdUser) => void;
  unlocking?: string;
}) {
  if (!users.length) {
    return <EmptyState title="Nenhum usuário retornado pelo AD" detail="A última coleta do Active Directory não trouxe usuários." />;
  }

  return (
    <div className="directory-list">
      {users.map((user) => (
        <div className="ad-user-line" key={user.distinguishedName || user.samAccountName}>
          <button className="directory-row directory-button" onClick={() => onSelect(user)} type="button">
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
          {user.locked && onUnlock ? (
            <button className="primary-action compact-action" type="button" onClick={() => onUnlock(user)} disabled={Boolean(unlocking)}>
              <Unlock size={14} />
              {unlocking === user.samAccountName ? "Desbloqueando" : "Desbloquear"}
            </button>
          ) : null}
        </div>
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
            {/* O motivo do risco aparece na linha (antes so a cor da linha indicava). */}
            {intuneDeviceRiskReasons(device).length ? <span className="intune-risk-reason">{intuneDeviceRiskReasons(device).join(" · ")}</span> : <span>{formatIntuneOs(device)}</span>}
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

function Office365UsersList({ users, onEditLicenses }: { users: Office365User[]; onEditLicenses: (user: Office365User) => void }) {
  if (!users.length) {
    return <EmptyState title="Usuarios nao carregados" detail="O Microsoft Graph nao retornou usuarios nesta coleta." />;
  }

  return (
    <div className="office365-table office365-users-table" role="table" aria-label="Usuarios Office 365">
      <div className="office365-table-head" role="row">
        <span>Usuario</span>
        <span>Setor</span>
        <span>Licencas</span>
        <span>Acoes</span>
      </div>
      {users.map((user) => (
        <div className="office365-table-row" key={user.id || user.userPrincipalName} role="row">
          <div>
            <strong>{user.displayName || user.userPrincipalName || "Sem nome"}</strong>
            <span>{user.userPrincipalName || user.mail || "Sem e-mail"}</span>
          </div>
          <div>
            <strong>{user.department || "Sem departamento"}</strong>
            <span>{user.jobTitle || "Sem cargo"}</span>
          </div>
          <div>
            <strong>{user.assignedLicenses.length ? `${user.assignedLicenses.length} licenca(s)` : "Sem licenca"}</strong>
            <span>{user.assignedLicenses.map(formatSkuName).join(", ") || "Nao atribuido"}</span>
          </div>
          <div className="office365-actions-cell">
            <StatusPill label={user.accountEnabled ? "Ativo" : "Desativado"} />
            <button className="small-action" type="button" onClick={() => onEditLicenses(user)}>
              Licencas
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Office365LicensesList({ licenses }: { licenses: Office365License[] }) {
  if (!licenses.length) {
    return <EmptyState title="Licencas nao carregadas" detail="O Microsoft Graph nao retornou licencas nesta coleta." />;
  }

  return (
    <div className="office365-table office365-licenses-table" role="table" aria-label="Licencas Office 365">
      <div className="office365-table-head" role="row">
        <span>SKU</span>
        <span>Uso</span>
        <span>Disponivel</span>
        <span>Planos</span>
      </div>
      {licenses.map((license) => (
        <div className="office365-table-row" key={license.skuId || license.skuPartNumber} role="row">
          <div>
            <strong>{formatSkuName(license.skuPartNumber)}</strong>
            <span>{license.skuPartNumber || license.skuId}</span>
          </div>
          <div>
            <strong>{license.consumedUnits} / {license.enabledUnits}</strong>
            <span>{license.suspendedUnits} suspensas, {license.warningUnits} alerta</span>
          </div>
          <div>
            <strong>{license.availableUnits}</strong>
            <span>unidades livres</span>
          </div>
          <StatusPill label={`${license.servicePlans} planos`} />
        </div>
      ))}
    </div>
  );
}

function Office365GroupsList({ groups }: { groups: Office365Group[] }) {
  if (!groups.length) {
    return <EmptyState title="Grupos nao carregados" detail="O Microsoft Graph nao retornou grupos nesta coleta." />;
  }

  return (
    <div className="office365-table office365-groups-table" role="table" aria-label="Grupos Office 365">
      <div className="office365-table-head" role="row">
        <span>Grupo</span>
        <span>Tipo</span>
        <span>Licencas</span>
        <span>Status</span>
      </div>
      {groups.map((group) => (
        <div className="office365-table-row" key={group.id || group.displayName} role="row">
          <div>
            <strong>{group.displayName || "Sem nome"}</strong>
            <span>{group.mail || group.description || "Sem e-mail"}</span>
          </div>
          <div>
            <strong>{group.groupTypes.includes("Unified") ? "Microsoft 365" : group.securityEnabled ? "Seguranca" : "Distribuicao"}</strong>
            <span>{group.mailEnabled ? "Mail habilitado" : "Sem mail"}</span>
          </div>
          <div>
            <strong>{group.assignedLicenses.length ? `${group.assignedLicenses.length} licenca(s)` : "Sem licenca"}</strong>
            <span>{group.assignedLicenses.map(formatSkuName).join(", ") || "Nao atribuido"}</span>
          </div>
          <StatusPill label={group.securityEnabled ? "Security" : "Grupo"} />
        </div>
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

function IpLinksTable({ groups, onEdit }: { groups: ReturnType<typeof buildInternetLinkGroups>; onEdit: (link: IpInventoryLink) => void }) {
  if (!groups.length) {
    return <EmptyState title="Nenhum link cadastrado" detail="Adicione os circuitos de internet e os IPs publicados em uso." />;
  }

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

function Office365LicenseModal({
  user,
  licenses,
  selectedSkuIds,
  saving,
  error,
  message,
  onChange,
  onSave,
  onClose,
}: {
  user: Office365User;
  licenses: Office365License[];
  selectedSkuIds: string[];
  saving: boolean;
  error: string;
  message: string;
  onChange: (skuIds: string[]) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const selected = new Set(selectedSkuIds.map((skuId) => skuId.toLowerCase()));

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function toggleLicense(skuId: string) {
    const normalized = skuId.toLowerCase();
    const nextSelection = selected.has(normalized)
      ? selectedSkuIds.filter((item) => item.toLowerCase() !== normalized)
      : [...selectedSkuIds, skuId];
    onChange(nextSelection);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="user-modal office365-license-modal" role="dialog" aria-modal="true" aria-labelledby="office365-license-title">
        <header className="modal-header">
          <div>
            <span>OFFICE 365</span>
            <h2 id="office365-license-title">Alterar licencas</h2>
            <span>{user.displayName || user.userPrincipalName}</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar" disabled={saving}>
            <X size={20} />
          </button>
        </header>

        <div className="office365-license-modal-body">
          {error ? <div className="form-error">{error}</div> : null}
          {message ? <div className="form-success">{message}</div> : null}

          <div className="license-user-summary">
            <DetailItem label="Usuario" value={user.userPrincipalName} />
            <DetailItem label="Status" value={user.accountEnabled ? "Ativo" : "Desativado"} />
            <DetailItem label="Licencas selecionadas" value={selectedSkuIds.length} />
          </div>

          <div className="license-checkbox-list">
            {licenses.map((license) => {
              const checked = selected.has(license.skuId.toLowerCase());
              return (
                <label className={`license-checkbox ${checked ? "checked" : ""}`} key={license.skuId}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleLicense(license.skuId)}
                    disabled={saving}
                  />
                  <div>
                    <strong>{formatSkuName(license.skuPartNumber)}</strong>
                    <span>{license.consumedUnits}/{license.enabledUnits} usadas - {license.availableUnits} disponiveis</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="modal-footer-actions">
          <button className="secondary-action" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="primary-action" type="button" onClick={onSave} disabled={saving}>
            <Save size={16} />
            {saving ? "Aplicando" : "Aplicar licencas"}
          </button>
        </div>
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

  async function unlockUser() {
    const login = currentDetails?.profile.samAccountName || user.samAccountName;
    if (!window.confirm(`Desbloquear a conta ${login}? A senha continua a mesma.`)) {
      return;
    }

    await runUserAction("unlock-user", async () => {
      await adRequest(`/api/ad/users/${encodeURIComponent(login)}/unlock`, { method: "POST" });
      const updated = await adRequest<AdUserDetails>(`/api/ad/users/${encodeURIComponent(login)}/details`, { method: "GET" });
      setCurrentDetails(updated);
      setActionMessage(`Conta ${login} desbloqueada.`);
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
                  loading={actionLoading}
                  onUnlock={unlockUser}
                  onEnable={() => setUserEnabled(true)}
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

            {currentDetails.profile.enabled && currentDetails.profile.samAccountName.toLowerCase() !== "krbtgt" ? (
              <section className="modal-section modal-section-wide risk-zone">
                <h3>Zona de risco</h3>
                <p className="dn-text">Desativar impede o login em tudo (computador, e-mail, VPN). Para uma conta bloqueada por senha errada, use Desbloquear.</p>
                <div className="modal-footer-actions">
                  <button className="danger-action" type="button" onClick={() => setUserEnabled(false)} disabled={Boolean(actionLoading)}>
                    {actionLoading === "disable-user" ? "Desativando" : "Desativar conta"}
                  </button>
                </div>
              </section>
            ) : null}
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

function userInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
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

// Nomes de coluna do banco em portugues para a tela (o desconhecido vira "Nome Do Campo").
const WIFI_FIELD_NAMES: Record<string, string> = {
  nome: "Nome",
  name: "Nome",
  email: "E-mail",
  mail: "E-mail",
  cpf: "CPF",
  matricula: "Matrícula",
  telefone: "Telefone",
  celular: "Celular",
  status: "Status",
  ativo: "Ativo",
  created_at: "Criado em",
  updated_at: "Atualizado em",
  data_cadastro: "Cadastrado em",
  senha: "Senha",
  password: "Senha",
};

function wifiFieldLabel(kind: WifiKind, column: WifiColumn) {
  const name = column.name.toLowerCase();
  if (kind === "colaboradores") {
    if (name === "username") return "RE";
    if (name === "value") return "Senha";
    if (name === "attribute") return "Atributo";
  }
  if (WIFI_FIELD_NAMES[name]) return WIFI_FIELD_NAMES[name];
  return column.name.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function ouPathFromDn(dn: string | undefined) {
  return (dn || "")
    .split(",")
    .filter((part) => part.trim().toUpperCase().startsWith("OU="))
    .map((part) => part.trim().replace(/^OU=/i, ""))
    .reverse()
    .join(" / ");
}

function parentDnFromDn(dn: string | undefined) {
  return (dn || "").split(",").slice(1).join(",");
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

  // IP "Livre" no inventario e divergencia de cadastro, nao queda: atencao, nao vermelho.
  if (inventoryItem.status === "Livre") {
    return { tone: "warn" as const, label: "IP marcado como livre no inventário" };
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

// Status da conta com a acao que resolve o estado atual (desbloquear ou ativar). Desativar fica
// separado, na "Zona de risco" da ficha, para nao ser clicado no lugar de desbloquear.
function AccountStatusControl({
  samAccountName,
  enabled,
  locked,
  loading,
  onUnlock,
  onEnable,
}: {
  samAccountName: string;
  enabled: boolean;
  locked: boolean;
  loading: string;
  onUnlock: () => void;
  onEnable: () => void;
}) {
  const status = locked ? "Bloqueado" : enabled ? "Ativo" : "Desativado";
  const isProtected = samAccountName.toLowerCase() === "krbtgt";

  return (
    <div className="detail-item account-status-control">
      <span>Status</span>
      <div>
        <StatusPill label={status} />
        {locked ? (
          <button className="primary-action" type="button" onClick={onUnlock} disabled={Boolean(loading)}>
            <Unlock size={14} />
            {loading === "unlock-user" ? "Desbloqueando" : "Desbloquear"}
          </button>
        ) : !enabled ? (
          <button
            className="primary-action"
            type="button"
            onClick={onEnable}
            disabled={Boolean(loading) || isProtected}
            title={isProtected ? "Conta interna do Kerberos protegida pelo AD" : undefined}
          >
            {loading === "enable-user" ? "Ativando" : "Ativar"}
          </button>
        ) : null}
      </div>
      {locked ? <small className="account-status-hint">Desbloquear libera o login de novo; a senha continua a mesma.</small> : null}
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
          Próxima
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

// Busca sem diferenciar acentos nem maiusculas ("joao" acha "João").
function filterItems<T>(items: T[], search: string, getFields: (item: T) => Array<string | number | undefined | null>) {
  const normalized = normalizeText(search);
  if (!normalized) return items;

  return items.filter((item) => normalizeText(getFields(item).join(" ")).includes(normalized));
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

// O Graph devolve "10.0.<build>" tambem para o Windows 11: o nome sai do build.
const WINDOWS_RELEASES: Record<number, string> = { 19041: "2004", 19042: "20H2", 19043: "21H1", 19044: "21H2", 19045: "22H2", 22000: "21H2", 22621: "22H2", 22631: "23H2", 26100: "24H2", 26200: "25H2" };
function windowsLabel(osVersion: string) {
  const build = Number(String(osVersion || "").split(".")[2] || 0);
  if (!build) return "";
  const release = WINDOWS_RELEASES[build] || `build ${build}`;
  if (build >= 22000) return `Windows 11 ${release}`;
  if (build >= 19041) return `Windows 10 ${release}`;
  return build === 14393 ? "Windows Server 2016" : build === 17763 ? "Windows Server 2019 / LTSC 2019" : `Windows (build ${build})`;
}

function formatIntuneOs(device: IntuneDevice) {
  if (intuneDeviceIsWindows(device)) return windowsLabel(device.osVersion) || "Windows";
  return [device.operatingSystem, device.osVersion].filter(Boolean).join(" ") || "Sistema não informado";
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

// Ameaca de verdade so com severidade informada ou maquina comprometida ("secured" = protegido pelo
// Defender; antes contava como ameaca e marcava quase todos os aparelhos como "em risco").
function intuneThreatIsActive(device: IntuneDevice) {
  const threat = normalizeText(device.partnerReportedThreatState);
  return ["lowseverity", "mediumseverity", "highseverity", "compromised"].includes(threat);
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

type IntuneFilter = "all" | "risk" | "noncompliant" | "stale" | "storage" | "windows" | "win10" | "mobile";

function intuneDeviceMatchesFilter(device: IntuneDevice, filter: IntuneFilter) {
  if (filter === "risk") return intuneDeviceRiskReasons(device).length > 0;
  if (filter === "noncompliant") return normalizeText(device.complianceState) === "noncompliant";
  if (filter === "storage") return intuneFreeStoragePercent(device) <= 15;
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

function formatSkuName(value: string) {
  const known: Record<string, string> = {
    ENTERPRISEPACK: "Office 365 E3",
    ENTERPRISEPREMIUM: "Office 365 E5",
    SPE_E3: "Microsoft 365 E3",
    SPE_E5: "Microsoft 365 E5",
    BUSINESS_PREMIUM: "Business Premium",
    BUSINESS_STANDARD: "Business Standard",
    EXCHANGESTANDARD: "Exchange Online",
    POWER_BI_STANDARD: "Power BI",
    FLOW_FREE: "Power Automate Free",
    TEAMS_EXPLORATORY: "Teams Exploratory",
  };
  const normalized = String(value || "").trim();
  return known[normalized] || normalized.replace(/_/g, " ") || "Nao informado";
}

function office365OperationLabel(value: string) {
  if (value === "unlicensed-users") return "Revisando usuarios sem licenca";
  if (value === "licensed-users") return "Visualizando usuarios licenciados";
  if (value === "license-full") return "Revisando licencas sem saldo";
  if (value === "license-usage") return "Visualizando licencas em uso";
  if (value === "licensed-groups") return "Visualizando grupos com licenca";
  if (value === "disabled-licensed") return "Contas desativadas que ainda ocupam licença";
  return "Filtro ativo";
}

function extractOu(distinguishedName: string | undefined) {
  const ou = (distinguishedName || "")
    .split(",")
    .filter((part) => part.trim().toUpperCase().startsWith("OU="))
    .map((part) => part.trim().replace(/^OU=/i, ""))
    .slice(0, 2)
    .join(" / ");

  return ou || "Builtin/raiz";
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

// Cor pelo significado: verde ok/disponivel, ambar atencao, vermelho problema, azul informativo, cinza neutro.
function statusTone(label: string) {
  const value = normalizeText(label);
  if (/^(ativo|ativa|aprovado|executando|conforme|livre|online|compativel)$/.test(value)) return "good";
  if (/bloquead|nao conforme|conflito|erro|falha|offline|incompativel/.test(value)) return "bad";
  if (/pendente|reservado|atencao|faltando/.test(value)) return "warn";
  if (/^(usado|na atualizacao)$/.test(value)) return "info";
  return "neutral";
}

function StatusPill({ label }: { label: string }) {
  return <span className={`status-pill tone-${statusTone(label)}`}>{label}</span>;
}

function RiskPill({ risk }: { risk: AdGroup["risk"] }) {
  return <span className={`risk-pill ${risk.toLowerCase()}`}>{risk}</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const className = severity === "Critico" ? "critical" : severity === "Atencao" ? "attention" : "info";

  return <span className={`severity ${className}`}>{severity}</span>;
}

// Isola falhas de renderizacao por tela: um dado inesperado nao derruba o portal inteiro.
class ViewErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Falha ao renderizar a tela:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="view-error" role="alert">
        <AlertTriangle size={28} />
        <div>
          <strong>Esta tela encontrou um erro e não pôde ser exibida.</strong>
          <p>O restante do portal continua funcionando. Detalhe técnico: {this.state.error.message}</p>
        </div>
        <button className="action-button" type="button" onClick={() => this.setState({ error: null })}>
          <RefreshCw size={16} />
          Tentar novamente
        </button>
      </div>
    );
  }
}

// Modo quiosque da TV: ?tv=<chave> guarda a chave e mostra so o Painel NOC (sem login pessoal).
const TV_KEY_STORAGE = "rede-clube-tv-key";
function resolveTvKey() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("tv");
  try {
    if (fromUrl) {
      window.localStorage.setItem(TV_KEY_STORAGE, fromUrl);
      params.delete("tv");
      params.set("modo", "tv");
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
      return fromUrl;
    }
    if (params.get("modo") === "tv") return window.localStorage.getItem(TV_KEY_STORAGE) || "";
  } catch {
    return fromUrl || "";
  }
  return "";
}
const tvKey = resolveTvKey();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {tvKey ? <NocWall tvKey={tvKey} kiosk /> : <App />}
  </React.StrictMode>,
);
