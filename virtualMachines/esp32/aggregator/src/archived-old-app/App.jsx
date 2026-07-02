import './App.css';
import QueueManagerDashboard from './QueueManagerDashboard';
import DataLibrarian from './DataLibrarian';
import DataMapper from './DataMapper';
import PascalishEditor from './PascalishEditor';
import DevelopWorkspace from './DevelopWorkspace';
import ProjectPlannerVisualTool from './ProjectPlannerVisualTool';
import TransactionLifecycleDashboard from './TransactionLifecycleDashboard';
import SwiftGatewayDashboard from './SwiftGatewayDashboard';
import BocGatewayDashboard from './BocGatewayDashboard';
import UserManagementDashboard from './UserManagementDashboard';
import ProfileManagementDashboard from './ProfileManagementDashboard';
import UserInProfileDashboard from './UserInProfileDashboard';
import UserProvisioner from './UserProvisioner';
import UserVerifier from './UserVerifier';
import UserProfileBrowser from './UserProfileBrowser';
import DeveloperDashboard from './DeveloperDashboard';
import FlowTargetsDashboard from './FlowTargetsDashboard';
import ChatPage from './ChatPage';
import ArtifactWorkbench from './ArtifactWorkbench.jsx';
import StartupFsmMonitor from './StartupFsmMonitor';
import TopologyDashboard from './TopologyDashboard';
import NetworkDevicesPage from '../NetworkDevicesPage';
import { getThemeFsmPalette, getThemeMermaidVariables } from './themeTokens';
import compiledWorkflowArtifacts from '../data/workflows.generated.json';
import workflowSourceArtifact from '../data/workflow.wfl?raw';
import dataMappingsArtifact from '../data/data-mappings.json';
import routingRulesArtifact from '../data/router-rules.json';
import { buildPublicArtifacts } from './artifactWorkbench';
import React, { useEffect, useMemo, useState } from 'react';

const RHS_MIN_WIDTH = 220;
const RHS_MAX_WIDTH = 620;
const WINDOW_THEMES = ['standard', 'whimsical', 'eclipse', 'anime', 'steampunk', 'rube-goldberg', 'french-pointalist', 'mid-century-modern', 'art-deco', 'moderne', 'group-of-seven-auto', 'group-of-seven-spring', 'group-of-seven-summer', 'group-of-seven-autumn', 'group-of-seven-winter'];
const THEME_PACK_LOADERS = {
  standard: () => import('./themes/packs/standard.css'),
  whimsical: () => import('./themes/packs/whimsical.css'),
  eclipse: () => import('./themes/packs/eclipse.css'),
  anime: () => import('./themes/packs/anime.css'),
  steampunk: () => import('./themes/packs/steampunk.css'),
  'rube-goldberg': () => import('./themes/packs/rube-goldberg.css'),
  'french-pointalist': () => import('./themes/packs/french-pointalist.css'),
  'mid-century-modern': () => import('./themes/packs/mid-century-modern.css'),
  'art-deco': () => import('./themes/packs/art-deco.css'),
  moderne: () => import('./themes/packs/moderne.css'),
  'group-of-seven-auto': () => import('./themes/packs/group-of-seven-auto.css'),
  'group-of-seven-spring': () => import('./themes/packs/group-of-seven-spring.css'),
  'group-of-seven-summer': () => import('./themes/packs/group-of-seven-summer.css'),
  'group-of-seven-autumn': () => import('./themes/packs/group-of-seven-autumn.css'),
  'group-of-seven-winter': () => import('./themes/packs/group-of-seven-winter.css')
};

const ACCESSIBILITY_PACK_LOADERS = {
  none: () => Promise.resolve(),
  monaco: () => import('./themes/accessibility/monaco.css'),
  'high-contrast': () => import('./themes/accessibility/high-contrast.css')
};

const ACCESSIBILITY_PACK_BY_THEME = {
  eclipse: 'monaco'
};

function resolveAccessibilityPack(themeId, preference = 'auto') {
  if (preference === 'high-contrast') return 'high-contrast';
  if (preference === 'monaco') return 'monaco';
  return ACCESSIBILITY_PACK_BY_THEME[themeId] || 'none';
}

function getSeasonalGroupOfSevenThemeId(date = new Date()) {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'group-of-seven-spring';
  if (month >= 5 && month <= 7) return 'group-of-seven-summer';
  if (month >= 8 && month <= 10) return 'group-of-seven-autumn';
  return 'group-of-seven-winter';
}

function resolveThemeId(windowStyle, date = new Date()) {
  if (windowStyle === 'group-of-seven') return getSeasonalGroupOfSevenThemeId(date);
  if (windowStyle === 'group-of-seven-auto') return getSeasonalGroupOfSevenThemeId(date);
  return windowStyle;
}

const AREAS = [
  { id: 'user-admin', label: 'User Admin', permission: 'users.read', accent: '#3aa3ff' },
  { id: 'project-manage', label: 'Project Manage', permission: 'queue.view', accent: '#59c17f' },
  { id: 'data-librarian', label: 'Data Librarian', permission: null, accent: '#f0c36b' },
  { id: 'analyze', label: 'Analyze', permission: 'data.read', accent: '#ffb454' },
  { id: 'develop', label: 'Develop', permission: 'topology.read', accent: '#9b8cff' },
  { id: 'network', label: 'Network', permission: 'topology.read', accent: '#ff8a5b' },
  { id: 'operations', label: 'Operations', permission: 'lifecycle.read', accent: '#f7768e' },
  { id: 'test', label: 'Test', permission: 'lifecycle.read', accent: '#8bd5ca' },
  { id: 'deploy', label: 'Deploy', permission: 'gateway.read', accent: '#7dcfff' },
];

const CORE_AREA_IDS = new Set(['data-librarian']);

const AREA_ICONS = {
  'user-admin': (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4Z"/></svg>
  ),
  'project-manage': (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18v4H3Zm0 6h11v10H3Zm13 0h5v10h-5Z"/></svg>
  ),
  analyze: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V4h2v16Zm5 0V9h2v11Zm5 0V6h2v14Zm5 0v-8h2v8Z"/></svg>
  ),
  'data-librarian': (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18h-1.5A2.5 2.5 0 0 0 16 22H6.5A2.5 2.5 0 0 1 4 19.5Zm2.5-1A1.5 1.5 0 0 0 5 5v14.5A1.5 1.5 0 0 0 6.5 21H15a3.5 3.5 0 0 1 3.5-3.5H19V3.5ZM8 7h8v1.5H8Zm0 3h8v1.5H8Zm0 3h6v1.5H8Z"/></svg>
  ),
  develop: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8.59 16.59 1.41 1.41L4.41 23 3 21.59Zm6.82 0L21 21.59 19.59 23 14 17.41ZM10 4l4 0v2h-4Zm-2.7 3.3 1.4-1.4 2.9 2.9-1.4 1.4Zm8.8-1.4 1.4 1.4-2.9 2.9-1.4-1.4ZM12 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"/></svg>
  ),
  network: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a3 3 0 0 1 3 3 2.99 2.99 0 0 1-1.5 2.59V11h4a2 2 0 0 1 2 2v3a3 3 0 1 1-2 0v-3h-4v3a3 3 0 1 1-2 0v-3H7v3a3 3 0 1 1-2 0v-3a2 2 0 0 1 2-2h4V8.59A2.99 2.99 0 0 1 9 6a3 3 0 1 1 3 3 3 3 0 0 1 0-6Z"/></svg>
  ),
  operations: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 2h2v4h-2Zm0 16h2v4h-2ZM2 11h4v2H2Zm16 0h4v2h-4ZM5.64 4.22l1.41-1.41 2.83 2.83-1.41 1.41Zm10.89 10.89 1.41-1.41 2.83 2.83-1.41 1.41ZM4.22 18.36l2.83-2.83 1.41 1.41-2.83 2.83Zm10.89-10.89 2.83-2.83 1.41 1.41-2.83 2.83Z"/></svg>
  ),
  test: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 2h6v2h-1v5.5l4.6 7.98A3 3 0 0 1 16 22H8a3 3 0 0 1-2.6-4.52L10 9.5V4H9Zm1.53 12h2.94l1.54 2.68A1 1 0 0 1 14.15 18h-4.3a1 1 0 0 1-.86-1.32Z"/></svg>
  ),
  deploy: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 2 7l10 5 10-5Zm0 7L2 4v2l10 5 10-5V4Zm-9 6 9 5 9-5v2l-9 5-9-5Z"/></svg>
  ),
};

const USER_ADMIN_TASKS = [
  { id: 'user', label: 'User' },
  { id: 'profile', label: 'Profile' },
  { id: 'user-in-profile', label: 'User In Profile' },
  { id: 'provisioner', label: 'Provisioner' },
  { id: 'verifier', label: 'Verifier' },
  { id: 'browser', label: 'Browser' }
];

const OPERATIONS_TASKS = [
  { id: 'fsm-runner', label: 'FSM Runner' },
  { id: 'topology', label: 'Topology' },
  { id: 'monitor', label: 'Monitor' },
  { id: 'deploy', label: 'Deploy' },
  { id: 'manage', label: 'Manage' }
];

const PROJECT_MANAGE_TASKS = [
  { id: 'planner', label: 'Project Planner' }
];

const NETWORK_TASKS = [
  { id: 'explorer', label: 'Explorer' }
];

const USER_ADMIN_ACTIONS = ['add', 'delete', 'update'];
const FIXED_LOGIN_USER_ID = 'SystemAdmin';
const FIXED_LOGIN_PASSWORD = '';
const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English' },
  { value: 'fr-CA', label: 'French' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'de-DE', label: 'German' }
];

const LANGUAGE_COPY = {
  en: {
    title: 'Operations At Login',
    subtitle: 'Flows, Services, and Servers with live state.',
    flows: 'Flows',
    services: 'Services',
    servers: 'Servers',
    runningWell: 'Running Well',
    currentState: 'Current State',
    yes: 'Yes',
    no: 'No',
    noItems: 'No items available.',
    tasks: 'Tasks',
    showAll: 'Show all',
    showLess: 'Show less',
    topology: 'Topology',
    pmachineTopology: 'PMachine topology',
    openTopology: 'Open PMachine topology',
    pmachineCountLabel: 'PMachine nodes',
    stateRunning: 'Running',
    statePaused: 'Paused',
    stateOffline: 'Offline',
    stateIdle: 'Idle'
  },
  fr: {
    title: 'Operations a la connexion',
    subtitle: 'Flux, services et serveurs avec etat en direct.',
    flows: 'Flux',
    services: 'Services',
    servers: 'Serveurs',
    tasks: 'Taches',
    runningWell: 'Fonctionne bien',
    currentState: 'Etat actuel',
    yes: 'Oui',
    no: 'Non',
    noItems: 'Aucun element disponible.',
    showAll: 'Afficher tout',
    showLess: 'Afficher moins',
    topology: 'Topologie',
    pmachineTopology: 'Topologie PMachine',
    openTopology: 'Ouvrir la topologie PMachine',
    pmachineCountLabel: 'Noeuds PMachine',
    stateRunning: 'En marche',
    statePaused: 'En pause',
    stateOffline: 'Hors ligne',
    stateIdle: 'Inactif'
  },
  es: {
    title: 'Operaciones al iniciar sesion',
    subtitle: 'Flujos, servicios y servidores con estado en vivo.',
    flows: 'Flujos',
    services: 'Servicios',
    servers: 'Servidores',
    tasks: 'Tareas',
    runningWell: 'Funciona bien',
    currentState: 'Estado actual',
    yes: 'Si',
    no: 'No',
    noItems: 'No hay elementos disponibles.',
    showAll: 'Mostrar todo',
    showLess: 'Mostrar menos',
    topology: 'Topologia',
    pmachineTopology: 'Topologia PMachine',
    openTopology: 'Abrir topologia PMachine',
    pmachineCountLabel: 'Nodos PMachine',
    stateRunning: 'En ejecucion',
    statePaused: 'En pausa',
    stateOffline: 'Sin conexion',
    stateIdle: 'Inactivo'
  },
  de: {
    title: 'Betrieb bei Anmeldung',
    subtitle: 'Flows, Dienste und Server mit Live-Status.',
    flows: 'Flows',
    services: 'Dienste',
    servers: 'Server',
    tasks: 'Aufgaben',
    runningWell: 'Laeuft gut',
    currentState: 'Aktueller Status',
    yes: 'Ja',
    no: 'Nein',
    noItems: 'Keine Elemente verfuegbar.',
    showAll: 'Alle anzeigen',
    showLess: 'Weniger anzeigen',
    topology: 'Topologie',
    pmachineTopology: 'PMachine-Topologie',
    openTopology: 'PMachine-Topologie oeffnen',
    pmachineCountLabel: 'PMachine-Knoten',
    stateRunning: 'Aktiv',
    statePaused: 'Pausiert',
    stateOffline: 'Offline',
    stateIdle: 'Inaktiv'
  }
};

function getThemeDisplayLabel(themeId) {
  const labels = {
    standard: 'Standard',
    whimsical: 'Whimsical',
    eclipse: 'Eclipse',
    anime: 'Anime',
    steampunk: 'Steampunk',
    'rube-goldberg': 'Rube Goldberg',
    'french-pointalist': 'French Pointalist',
    'mid-century-modern': 'Mid Century Modern',
    'art-deco': 'Art Deco',
    moderne: 'Streamline Moderne',
    'group-of-seven-auto': 'Group of Seven - Auto',
    'group-of-seven-spring': 'Group of Seven - Spring',
    'group-of-seven-summer': 'Group of Seven - Summer',
    'group-of-seven-autumn': 'Group of Seven - Autumn',
    'group-of-seven-winter': 'Group of Seven - Winter'
  };
  return labels[themeId] || themeId;
}

function hasPermission(permissions, requiredPermission) {
  if (!requiredPermission) return true;
  if (!Array.isArray(permissions)) return false;
  if (permissions.includes('*')) return true;
  if (permissions.includes(requiredPermission)) return true;

  const parts = String(requiredPermission).split('.');
  if (parts.length > 1) {
    const wildcard = `${parts[0]}.*`;
    if (permissions.includes(wildcard)) return true;
  }
  return false;
}

function getMonitorClassLabel(itemClass) {
  if (!itemClass) return '';
  return itemClass.label || itemClass.classId;
}

function normalizeRuntimeStatus(value) {
  const status = String(value || '').toLowerCase();
  if (['up', 'online', 'running', 'active', 'ok'].includes(status)) return 'online';
  if (['quiesced', 'draining', 'maintenance', 'paused', 'idle'].includes(status)) return 'paused';
  return 'offline';
}

function getLanguageKey(language) {
  const normalized = String(language || 'en-US').toLowerCase();
  if (normalized.startsWith('fr')) return 'fr';
  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('de')) return 'de';
  return 'en';
}

function getThroughputHealth(actualTps, targetTps, runtimeStatus) {
  if (runtimeStatus !== 'running') return 'idle';
  if (!Number.isFinite(targetTps) || targetTps <= 0) return 'no-data';
  if (!Number.isFinite(actualTps)) return 'no-data';
  if (actualTps < targetTps) return 'breach';
  if (actualTps < targetTps * 1.1) return 'warning';
  return 'ok';
}

const TRANSACTION_FLOW_MERMAID_SOURCE = `flowchart LR
  classDef queue fill:#f7e7b6,stroke:#b7a36a,stroke-width:2px;
  classDef gadget fill:#efe6d1,stroke:#8a7a58,stroke-width:1.5px;
  classDef reject fill:#ffd9d9,stroke:#b35a5a,stroke-width:1.5px;
  classDef worker fill:#d8e7ff,stroke:#4f6b9a,stroke-width:1.5px;

  start["Start: received_mt103<br/>swift.mt103.parsed"]:::queue

  subgraph gadgets [Rube Goldberg Gadgets]
    pulley[Pulley]:::gadget
    lever[Lever]:::gadget
    bell[Bell]:::gadget
    mouse[Mouse Wheel]:::gadget
    domino[Domino Chain]:::gadget
    fan[Fan]:::gadget
    spring[Spring]:::gadget
  end

  created["pacs_created<br/>tx.pacs.created"]:::queue
  sanctionsGate{Sanctions}
  liquiditySub["Liquidity Mgmt<br/>Subflow"]:::worker
  sanctionsSub["Sanctions Scan<br/>Subflow"]:::worker
  lynxPending["liquidity<br/>tx.lynx.pending"]:::queue
  sanctionsPassed["sanctions_passed<br/>tx.sanctions.passed"]:::queue
  lynxGate{LYNX}
  lynxApproved["lynx_approved<br/>tx.lynx.approved"]:::queue
  corrUnreconciled["sent_corresp_unreconciled<br/>tx.correspondent.unreconciled"]:::queue
  matchedGate{Matched?}
  reconciled["reconciled<br/>tx.reconciled"]:::queue
  reject[Reject Bin]:::reject
  liqReject[Liquidity Reject Bin]:::reject
  sanReject[Sanctions Reject Bin]:::reject
  foreman[Foreman]

  start --> pulley --> lever -->|MAP mt103-to-pacs| created
  created --> bell -->|Sanctions Scan| sanctionsGate
  sanctionsGate -- Pass --> liquiditySub
  sanctionsGate -- Hit --> sanctionsSub
  liquiditySub -- Accepted --> lynxPending
  liquiditySub -- Rejected --> liqReject
  sanctionsSub -- Accepted --> sanctionsPassed
  sanctionsSub -- Rejected --> sanReject
  lynxPending --> sanctionsPassed -->|BoC/LYNX Decision| lynxGate
  lynxGate -- Approved --> fan --> lynxApproved
  lynxGate -- Rejected --> reject
  lynxApproved -->|ENQUEUE correspondent.pacs008.outbound| corrUnreconciled
  corrUnreconciled -->|statement_matched| matchedGate
  matchedGate -- True --> reconciled
  matchedGate -- False --> corrUnreconciled

  liqReject -.-> foreman
  sanReject -.-> foreman
  reject -.-> foreman

  lever -.-> spring
  bell -.-> fan
  mouse -.-> pulley
  domino -.-> bell
  spring -.-> domino
`;

const INCOMING_PAYMENT_FLOW_MERMAID = `flowchart LR
  inPay["Incoming Payment<br/>pacs.008 or pain.001"]
  sanSub["Sanctions Scan<br/>Subflow"]
  liqSub["Liquidity Mgmt<br/>Subflow"]
  swift[SWIFT Gateway]
  sanReject[Sanctions Reject Bin]
  liqReject[Liquidity Reject Bin]
  foreman[Foreman]

  inPay --> sanSub
  sanSub -- Accepted --> liqSub
  sanSub -- Rejected --> sanReject
  liqSub -- Accepted --> swift
  liqSub -- Rejected --> liqReject
  sanReject -.-> foreman
  liqReject -.-> foreman
`;

const LEGACY_PAYMENT_FLOW_MERMAID = `flowchart LR
  legacyIn["Legacy Payment<br/>MT103 / MT202 / MT202COV"]
  cbds[CBDS Ruleset]
  pacs008[pacs.008]
  pacs009[pacs.009]
  inPay["Incoming Payment<br/>pacs.008 or pain.001"]

  legacyIn --> cbds
  cbds -- "MT103 to pacs.008" --> pacs008
  cbds -- "MT202/202COV to pacs.009" --> pacs009
  pacs008 --> inPay
  pacs009 --> inPay
`;

const CORE_OUTGOING_FLOW_MERMAID = `flowchart LR
  coreTx["Core Outgoing Tx<br/>core.tx.outgoing"]
  sanSub["Sanctions Subflow<br/>Subflow"]
  liqSub["Liquidity Subflow<br/>Subflow"]
  swift[SWIFT Gateway]
  sanReject[Sanctions.reject]
  liqReject[Liquidity.reject]
  foreman[Foreman]

  coreTx --> sanSub
  sanSub -- Pass --> liqSub
  sanSub -- Fail --> sanReject
  liqSub -- Pass --> swift
  liqSub -- Fail --> liqReject
  sanReject -.-> foreman
  liqReject -.-> foreman
`;



const FLOW_DEFINITIONS = [
    {
      id: 'core-outgoing',
      name: 'Core Outgoing Flow',
      mermaidSource: CORE_OUTGOING_FLOW_MERMAID,
      transitionMetrics: [
        { id: 'sanctions_subflow', label: 'Sanctions Subflow', queueName: 'core.tx.outgoing', waiting: 0, cumulative: 0 },
        { id: 'sanctions_reject', label: 'Sanctions.reject', queueName: 'Sanctions.reject', waiting: 0, cumulative: 0 },
        { id: 'liquidity_subflow', label: 'Liquidity Subflow', queueName: 'Liquidity.subflow', waiting: 0, cumulative: 0 },
        { id: 'liquidity_reject', label: 'Liquidity.reject', queueName: 'Liquidity.reject', waiting: 0, cumulative: 0 },
        { id: 'swift_gateway', label: 'SWIFT Gateway', queueName: 'SWIFT.gateway', waiting: 0, cumulative: 0 }
      ]
    },
  {
    id: 'legacy-payment',
    name: 'Legacy Payment',
    mermaidSource: LEGACY_PAYMENT_FLOW_MERMAID,
    transitionMetrics: [
      { id: 'cbds_mapping', label: 'cbds_mapping', queueName: 'swift.mt103.inbound', waiting: 0, cumulative: 0 },
      { id: 'to_pacs', label: 'to_pacs', queueName: 'tx.pacs.created', waiting: 0, cumulative: 0 },
      { id: 'to_core_payment', label: 'to_core_payment', queueName: 'tx.pacs.created', waiting: 0, cumulative: 0 }
    ]
  },
  {
    id: 'incoming-payment',
    name: 'Incoming Payment',
    mermaidSource: INCOMING_PAYMENT_FLOW_MERMAID,
    transitionMetrics: [
      { id: 'sanctions_scanning', label: 'sanctions_scanning', queueName: 'tx.pacs.created', waiting: 0, cumulative: 0 },
      { id: 'liquidity_management', label: 'liquidity_management', queueName: 'tx.lynx.pending', waiting: 0, cumulative: 0 },
      { id: 'to_swift_gateway', label: 'to_swift_gateway', queueName: 'tx.correspondent.unreconciled', waiting: 0, cumulative: 0 }
    ]
  },
  {
    id: 'core-payment',
    name: 'Core Payment Flow',
    mermaidSource: TRANSACTION_FLOW_MERMAID_SOURCE,
    transitionMetrics: [
      { id: 'mapped_to_pacs', label: 'mapped_to_pacs', queueName: 'tx.pacs.created', waiting: 0, cumulative: 0 },
      { id: 'sanctions_scanning', label: 'sanctions_scanning', queueName: 'tx.pacs.created', waiting: 0, cumulative: 0 },
      { id: 'liquidity_management', label: 'liquidity_management', queueName: 'tx.lynx.pending', waiting: 0, cumulative: 0 },
      { id: 'lynx_decision', label: 'lynx_decision', queueName: 'tx.lynx.pending', waiting: 0, cumulative: 0 },
      { id: 'sent_to_correspondent', label: 'sent_to_correspondent', queueName: 'tx.correspondent.unreconciled', waiting: 0, cumulative: 0 },
      { id: 'statement_matched', label: 'statement_matched', queueName: 'tx.reconciled', waiting: 0, cumulative: 0 }
    ]
  }
];

  const WORKFLOW_CARD_METADATA = {};

  const COMPILED_WORKFLOW_ITEMS = Array.isArray(compiledWorkflowArtifacts)
    ? compiledWorkflowArtifacts
    : Array.isArray(compiledWorkflowArtifacts?.workflows)
      ? compiledWorkflowArtifacts.workflows
      : [];

  function toWorkflowDisplayName(workflowId) {
    const normalized = String(workflowId || '').replace(/[-_]+/g, ' ').trim();
    if (!normalized) return 'Workflow';
    return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function escapeMermaidText(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r?\n+/g, '\\n');
  }

  function formatWorkflowCondition(condition) {
    const field = String(condition?.field || '').trim();
    const operator = String(condition?.operator || 'equals').trim();
    const value = String(condition?.value || '').trim();
    if (!field && !value) return 'Decision';
    return `${field} ${operator} ${value}`.trim();
  }

  function describeWorkflowStep(step) {
    if (!step || typeof step !== 'object') return 'STEP';
    if (step.action === 'call_api') {
      return `CALL API\n${String(step.method || 'GET').toUpperCase()} ${String(step.route || '')}`.trim();
    }
    if (step.action === 'check_api') {
      return `CHECK API\n${String(step.method || 'GET').toUpperCase()} ${String(step.route || '')}\nEXPECT ${String(step.expectedStatus || '')}`.trim();
    }
    if (step.action === 'wait') {
      return `WAIT\n${String(step.durationMs || 0)} ms`;
    }
    if (step.action === 'route_queue') {
      return `ROUTE QUEUE\n${String(step.queueRef || '')}`.trim();
    }
    if (step.action === 'set_state') {
      return `SET STATE\n${String(step.key || '')} = ${String(step.value || '')}`.trim();
    }
    if (step.action === 'if') {
      return `IF\n${formatWorkflowCondition(step.condition)}`.trim();
    }
    return String(step.id || step.action || 'STEP').toUpperCase();
  }

  function countWorkflowSteps(steps = []) {
    let count = 0;
    for (const step of steps || []) {
      count += 1;
      if (step?.action === 'if') {
        count += countWorkflowSteps(step.then || []);
        count += countWorkflowSteps(step.else || []);
      }
    }
    return count;
  }

  function buildWorkflowMermaid(workflow) {
    const steps = Array.isArray(workflow?.steps) ? workflow.steps : [];
    const lines = ['flowchart LR'];
    let nodeIndex = 0;
    const emitted = new Set();

    const nextId = (prefix) => `${prefix}${nodeIndex += 1}`;

    const addNode = (id, shape, label) => {
      const escapedLabel = escapeMermaidText(label);
      if (shape === 'round') {
        lines.push(`  ${id}(("${escapedLabel}"))`);
        return;
      }
      if (shape === 'diamond') {
        lines.push(`  ${id}{"${escapedLabel}"}`);
        return;
      }
      lines.push(`  ${id}["${escapedLabel}"]`);
    };

    const addEdge = (from, to, label = '') => {
      if (!from || !to) return;
      const key = `${from}|${label}|${to}`;
      if (emitted.has(key)) return;
      emitted.add(key);
      if (label) {
        lines.push(`  ${from} -->|${escapeMermaidText(label)}| ${to}`);
        return;
      }
      lines.push(`  ${from} --> ${to}`);
    };

    const renderSteps = (stepList, entryId) => {
      let cursor = entryId;
      for (const step of stepList || []) {
        if (step?.action === 'if') {
          const decisionId = nextId('if');
          const joinId = nextId('join');
          addNode(decisionId, 'diamond', describeWorkflowStep(step));
          addNode(joinId, 'round', 'Merge');
          addEdge(cursor, decisionId);

          const thenTail = renderSteps(step.then || [], decisionId);
          const elseTail = renderSteps(step.else || [], decisionId);

          if (thenTail && thenTail !== decisionId) {
            addEdge(thenTail, joinId, 'yes');
          } else {
            addEdge(decisionId, joinId, 'yes');
          }

          if (elseTail && elseTail !== decisionId) {
            addEdge(elseTail, joinId, 'no');
          } else {
            addEdge(decisionId, joinId, 'no');
          }

          cursor = joinId;
          continue;
        }

        const nodeId = nextId('step');
        addNode(nodeId, 'rect', describeWorkflowStep(step));
        addEdge(cursor, nodeId);
        cursor = nodeId;
      }
      return cursor;
    };

    const startId = 'start';
    const endId = 'end';
    addNode(startId, 'round', 'Start');
    addNode(endId, 'round', 'End');

    const tail = renderSteps(steps, startId);
    if (tail && tail !== startId) {
      addEdge(tail, endId);
    } else if (!steps.length) {
      addEdge(startId, endId);
    }

    return lines.join('\n');
  }

  function buildWorkflowCards(workflows = []) {
    const workflowById = new Map();
    for (const workflow of workflows || []) {
      const workflowId = String(workflow?.id || '').toLowerCase();
      if (!workflowId) continue;
      workflowById.set(workflowId, workflow);
    }

    const orderedIds = Array.from(workflowById.keys());

    return orderedIds.map((workflowId) => {
      const workflow = workflowById.get(workflowId) || { id: workflowId, steps: [] };
      const metadata = WORKFLOW_CARD_METADATA[workflowId] || {};
      const name = metadata.name || toWorkflowDisplayName(workflowId);
      return {
        id: String(workflow.id || workflowId),
        name,
        description: metadata.description || `Workflow diagram for ${name}.`,
        stepCount: countWorkflowSteps(workflow.steps || []),
        mermaidSource: buildWorkflowMermaid(workflow)
      };
    });
  }

  const DEFAULT_WORKFLOW_CARDS = buildWorkflowCards(COMPILED_WORKFLOW_ITEMS);

function resolveFlowDefinition(flow) {
  const id = String(flow?.id || '').toLowerCase();
  const name = String(flow?.name || '').toLowerCase();
  const byId = FLOW_DEFINITIONS.find((definition) => id === definition.id || id.includes(definition.id));
  if (byId) return byId;
  const byName = FLOW_DEFINITIONS.find((definition) => name === definition.name.toLowerCase() || name.includes(definition.name.toLowerCase()));
  return byName || FLOW_DEFINITIONS[2];
}

function normalizeFsmStateToken(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.toUpperCase().replace(/[^A-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
}

function formatFsmStateLabel(value) {
  const token = normalizeFsmStateToken(value);
  if (!token) return 'State';
  return token
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function truncateFsmStateLabel(label, maxChars = 16) {
  const value = String(label || '').trim();
  if (!value) return value;
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

function getFsmPalette(windowStyle) {
  return getThemeFsmPalette(windowStyle);
}

function buildFsmFullLabelLookup(fsmItem, statusPayload) {
  const lookup = new Map();
  const register = (value) => {
    const token = normalizeFsmStateToken(value);
    if (!token) return;
    lookup.set(token, formatFsmStateLabel(value));
  };

  const workflow = Array.isArray(statusPayload?.workflow) ? statusPayload.workflow : [];
  for (const step of workflow) register(step);
  register(statusPayload?.state || fsmItem?.state || 'IDLE');

  if (!lookup.size) {
    register('IDLE');
    register('READY');
    register('FAILED');
  }

  return lookup;
}

function getMermaidThemeVariables(windowStyle) {
  return getThemeMermaidVariables(windowStyle);
}

function buildFsmMermaidSource(fsmItem, statusPayload, palette) {
  const workflow = Array.isArray(statusPayload?.workflow) ? statusPayload.workflow : [];
  const labelsById = new Map();
  const orderedIds = [];
  const sequenceIds = [];
  const colors = palette || getFsmPalette('standard');

  const register = (value) => {
    const label = String(value || '').trim();
    const id = normalizeFsmStateToken(label);
    if (!id) return;
    sequenceIds.push(id);
    if (!labelsById.has(id)) {
      const fullLabel = formatFsmStateLabel(label || id);
      labelsById.set(id, truncateFsmStateLabel(fullLabel));
      orderedIds.push(id);
    }
  };

  for (const step of workflow) register(step);
  register(statusPayload?.state || fsmItem?.state || 'IDLE');

  if (orderedIds.length === 0) {
    register('IDLE');
    register('READY');
    register('FAILED');
  }

  const activeId = normalizeFsmStateToken(statusPayload?.state || fsmItem?.state || sequenceIds[sequenceIds.length - 1] || orderedIds[orderedIds.length - 1] || 'IDLE');
  if (activeId && sequenceIds[sequenceIds.length - 1] !== activeId) {
    sequenceIds.push(activeId);
  }

  const doneIds = new Set(sequenceIds.slice(0, Math.max(0, sequenceIds.length - 1)));
  const pathIds = sequenceIds.length > 0 ? sequenceIds : orderedIds;

  const lines = [
    'stateDiagram-v2',
    '  direction LR',
    `  [*] --> ${pathIds[0]}`,
    `  classDef active fill:${colors.activeFill},stroke:${colors.activeStroke},color:${colors.activeText},stroke-width:${colors.strokeWidth};`,
    `  classDef done fill:${colors.doneFill},stroke:${colors.doneStroke},color:${colors.doneText},stroke-width:${colors.strokeWidth};`,
    `  classDef failed fill:${colors.failedFill},stroke:${colors.failedStroke},color:${colors.failedText},stroke-width:${colors.strokeWidth};`
  ];

  for (let index = 0; index < orderedIds.length; index += 1) {
    const id = orderedIds[index];
    const label = labelsById.get(id) || formatFsmStateLabel(id);
    lines.push(`  state "${escapeMermaidText(label)}" as ${id}`);
  }

  for (let index = 0; index < pathIds.length - 1; index += 1) {
    lines.push(`  ${pathIds[index]} --> ${pathIds[index + 1]}`);
  }

  const doneList = Array.from(doneIds).filter((id) => id !== activeId && orderedIds.includes(id));
  if (doneList.length > 0) {
    lines.push(`  class ${doneList.join(',')} done;`);
  }

  if (activeId && orderedIds.includes(activeId)) {
    lines.push(`  class ${activeId} active;`);
  }

  if (activeId === 'FAILED' && orderedIds.includes('FAILED')) {
    lines.push('  class FAILED failed;');
  }

  return lines.join('\n');
}

function App() {
  const [actorUserId, setActorUserId] = useState(() => {
    const stored = String(localStorage.getItem('pulse.actorUserId') || '').trim();
    if (!stored || stored.toLowerCase() === 'anonymous') return 'system-admin';
    return stored;
  });
  const [loginUserId, setLoginUserId] = useState(FIXED_LOGIN_USER_ID);
  const [loginPassword, setLoginPassword] = useState(FIXED_LOGIN_PASSWORD);
  const [language, setLanguage] = useState(localStorage.getItem('pulse.language') || 'en-US');
  const [windowStyle, setWindowStyle] = useState(() => {
    const stored = localStorage.getItem('pulse.windowStyle') || 'rube-goldberg';
    return WINDOW_THEMES.includes(stored) ? stored : 'rube-goldberg';
  });
  const [pathname, setPathname] = useState(() => window.location.pathname || '/');
  const [authz, setAuthz] = useState({ actor: null, profiles: [], permissions: [] });
  const [authzError, setAuthzError] = useState('');
  const [lhsCollapsed, setLhsCollapsed] = useState(localStorage.getItem('pulse.lhsCollapsed') === '1');
  const [rhsCollapsed, setRhsCollapsed] = useState(localStorage.getItem('pulse.rhsCollapsed') === '1');
  const [area, setArea] = useState('operations');
  const [operationsTask, setOperationsTask] = useState('monitor');
  const [operationsNavExpanded, setOperationsNavExpanded] = useState(true);
  const [monitorClasses, setMonitorClasses] = useState([]);
  const [monitorClassId, setMonitorClassId] = useState('transaction-flows');
  const [projectManageTask, setProjectManageTask] = useState('planner');
  const [networkTask, setNetworkTask] = useState('explorer');
  const [userAdminTask, setUserAdminTask] = useState('user');
  const [dataLibrarianTask, setDataLibrarianTask] = useState('data-shapes');
  const [developCreateRequest, setDevelopCreateRequest] = useState(null);
  const [userAdminAction, setUserAdminAction] = useState('update');
  const [taskContextMenu, setTaskContextMenu] = useState({ open: false, x: 0, y: 0, taskId: null });
  const [workflowCards] = useState(DEFAULT_WORKFLOW_CARDS);
  const [overview, setOverview] = useState({
    workers: { lifecycle: 0, bridge: 0 },
    gateways: { swift: false, boc: false, fed: false },
    activity: { activeTransactions: 0 },
    queues: {},
    services: [],
    servers: [],
    flows: [],
    system: { cpuUsagePercent: null, memoryUsagePercent: null }
  });
  const [rhsWidth, setRhsWidth] = useState(() => {
    const saved = Number(localStorage.getItem('pulse.rhsWidth'));
    if (Number.isFinite(saved)) {
      return Math.max(RHS_MIN_WIDTH, Math.min(RHS_MAX_WIDTH, saved));
    }
    return 320;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [askBoxActive, setAskBoxActive] = useState(true);
  const [contrastModePreference] = useState(() => {
    const stored = localStorage.getItem('pulse.contrastMode');
    if (stored === 'high-contrast') return 'high-contrast';
    return 'auto';
  });
  const [collapsedSections, setCollapsedSections] = useState({ flows: false, services: false, servers: false });
  const [cardContextMenu, setCardContextMenu] = useState({ open: false, x: 0, y: 0, kind: null, item: null });
  const [cardHiddenMap, setCardHiddenMap] = useState({});
  const [cardRenameMap, setCardRenameMap] = useState({});
  const [cardRuntimeMap, setCardRuntimeMap] = useState({});
  const [cardPreview, setCardPreview] = useState({ open: false, kind: null, title: '', item: null, mode: null, fullscreen: false });
  const [messageLayouts, setMessageLayouts] = useState([]);
  const [flowDiagramSvg, setFlowDiagramSvg] = useState('');
  const [flowDiagramError, setFlowDiagramError] = useState('');
  const [fsmPreviewStatus, setFsmPreviewStatus] = useState(null);
  const [runnableFsms, setRunnableFsms] = useState([]);
  const [selectedFsmId, setSelectedFsmId] = useState('startup-fsm');
  const [mermaidSsePhase, setMermaidSsePhase] = useState(0);
  const [mermaidSseConnected, setMermaidSseConnected] = useState(false);
  const [selectedFlowTransitionId, setSelectedFlowTransitionId] = useState(null);
  const flowSnapshotRef = React.useRef({});
  const deepLinkHandledRef = React.useRef(false);
  const resolvedWindowStyle = resolveThemeId(windowStyle);
  const resolvedContrastMode = useMemo(
    () => resolveAccessibilityPack(resolvedWindowStyle, contrastModePreference),
    [resolvedWindowStyle, contrastModePreference]
  );

  function toggleSection(sectionId) {
    setCollapsedSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  }

  async function copyTextToClipboard(text) {
    const value = String(text || '');
    if (!value) return;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  function getCardContextActions(kind) {
    const normalizedKind = String(kind || '').toLowerCase();
    if (normalizedKind === 'fsm') {
      return [
        { action: 'open', label: 'Open FSM Runner' },
        { action: 'open-fsm-mermaid', label: 'Show Mermaid Diagram' },
        { action: 'open-fsm-mermaid-live', label: 'Open Mermaid (Live Animate)' },
        { action: 'copy-id', label: 'Copy ID' }
      ];
    }

    if (normalizedKind === 'workflow') {
      return [
        { action: 'open', label: 'Open' },
        { action: 'open-new-window', label: 'Open in New Window' },
        { action: 'copy-mermaid', label: 'Copy Mermaid' },
        { action: 'copy-id', label: 'Copy ID' },
        { action: 'rename', label: 'Rename' },
        { action: 'delete', label: 'Hide' }
      ];
    }

    const actions = [
      { action: 'open', label: 'Open' },
      { action: 'open-new-window', label: 'Open in New Window' },
      { action: 'copy-id', label: 'Copy ID' },
      { action: 'rename', label: 'Rename' },
      { action: 'delete', label: 'Hide' }
    ];

    if (normalizedKind === 'flow') {
      actions.splice(2, 0, { action: 'copy-mermaid', label: 'Copy Mermaid' });
      actions.push({ action: 'start', label: 'Start' });
      actions.push({ action: 'stop', label: 'Stop' });
      actions.push({ action: 'quiesce', label: 'Quiesce' });
      actions.push({ action: 'start up', label: 'Start Up' });
    } else if (normalizedKind === 'service' || normalizedKind === 'server') {
      actions.push({ action: 'start', label: 'Start' });
      actions.push({ action: 'stop', label: 'Stop' });
      actions.push({ action: 'quiesce', label: 'Quiesce' });
      actions.push({ action: 'start up', label: 'Start Up' });
    }

    return actions;
  }

  function openCardContextMenu(event, kind, item) {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 240;
    const menuHeight = 34 + (getCardContextActions(kind).length * 34);
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const x = Math.max(8, Math.min(event.clientX, Math.max(8, viewportWidth - menuWidth - 8)));
    const y = Math.max(8, Math.min(event.clientY, Math.max(8, viewportHeight - menuHeight - 8)));
    setCardContextMenu({
      open: true,
      x,
      y,
      kind,
      item: item || null,
    });
  }

  function closeCardContextMenu() {
    setCardContextMenu({ open: false, x: 0, y: 0, kind: null, item: null });
  }

  function getCardKey(kind, item) {
    return `${String(kind || '').toLowerCase()}:${String(item?.id || item?.name || '').toLowerCase()}`;
  }

  function getCardDisplayName(kind, item, fallback) {
    const key = getCardKey(kind, item);
    return String(cardRenameMap[key] || fallback || item?.name || item?.id || 'Item');
  }

  async function persistCardOverrides(nextHiddenMap, nextRenameMap, nextRuntimeMap) {
    try {
      await fetch('/api/ui/card-overrides', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': actorUserId
        },
        body: JSON.stringify({
          hiddenMap: nextHiddenMap,
          renameMap: nextRenameMap,
          runtimeMap: nextRuntimeMap
        })
      });
    } catch {
      // Keep the UI responsive if persistence temporarily fails.
    }
  }



  function applyLocalRuntimeAction(kind, item, action) {
    const normalizedAction = String(action || '').toLowerCase();
    const key = getCardKey(kind, item);
    const nextRuntimeMap = {
      ...cardRuntimeMap,
      [key]: normalizedAction === 'start up' ? 'start' : normalizedAction
    };
    setCardRuntimeMap(nextRuntimeMap);
    void persistCardOverrides(cardHiddenMap, cardRenameMap, nextRuntimeMap);

    setOverview((current) => {
      if (kind === 'flow') {
        const flows = current.flows.map((flow) => {
          if (String(flow.id) !== String(item.id)) return flow;
          const runtimeStatus = (normalizedAction === 'start' || normalizedAction === 'start up')
            ? 'running'
            : normalizedAction === 'quiesce'
              ? 'idle'
              : 'idle';
          return {
            ...flow,
            runtimeStatus,
            throughputStatus: runtimeStatus === 'running' ? (flow.throughputStatus === 'no-data' ? 'warning' : flow.throughputStatus) : 'idle'
          };
        });
        return { ...current, flows };
      }

      if (kind === 'service') {
        const services = current.services.map((service) => {
          if (String(service.id) !== String(item.id)) return service;
          const status = (normalizedAction === 'start' || normalizedAction === 'start up')
            ? 'online'
            : normalizedAction === 'quiesce'
              ? 'paused'
              : 'offline';
          return {
            ...service,
            status,
            state: status
          };
        });
        return { ...current, services };
      }

      return current;
    });
  }

  async function executeRuntimeAction(kind, item, action) {
    const normalizedAction = String(action || '').toLowerCase();
    if (kind === 'flow' || kind === 'service') {
      applyLocalRuntimeAction(kind, item, normalizedAction);
      return;
    }

    if (kind === 'workflow') {
      throw new Error('Workflow cards are read-only. Use Open or Copy Mermaid.');
    }

    if (kind !== 'server') {
      throw new Error('Unsupported card kind for runtime actions.');
    }

    const family = String(item?.family || '').toLowerCase();
    const name = String(item?.name || '').toLowerCase();
    const headers = {
      'Content-Type': 'application/json',
      'x-user-id': actorUserId
    };

    if (family === 'gateway') {
      const gatewayAction = normalizedAction === 'start up' ? 'start' : normalizedAction;
      if (!['start', 'stop', 'quiesce'].includes(gatewayAction)) {
        throw new Error('Unsupported gateway action.');
      }
      const res = await fetch(`/api/runtime/classes/gateway/actions/${gatewayAction}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ targets: [name] })
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Gateway action failed (${res.status}).`);
      }
      return;
    }

    if (family === 'broker') {
      const brokerAction = normalizedAction === 'start' || normalizedAction === 'start up'
        ? 'up'
        : normalizedAction === 'stop'
          ? 'down'
          : normalizedAction;
      if (!['up', 'down', 'quiesce'].includes(brokerAction)) {
        throw new Error('Unsupported broker action.');
      }
      const res = await fetch(`/api/runtime/classes/broker/actions/${brokerAction}`, {
        method: 'POST',
        headers
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Broker action failed (${res.status}).`);
      }
      return;
    }

    if (family === 'database' || family === 'queue manager') {
      const databaseAction = normalizedAction === 'start' || normalizedAction === 'start up'
        ? 'up'
        : normalizedAction === 'stop'
          ? 'maintenance'
          : normalizedAction;
      if (!['up', 'quiesce', 'maintenance'].includes(databaseAction)) {
        throw new Error('Unsupported database action.');
      }
      const res = await fetch(`/api/runtime/classes/database/actions/${databaseAction}`, {
        method: 'POST',
        headers
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Database action failed (${res.status}).`);
      }
      return;
    }

    throw new Error('No runtime action mapping for this server type yet.');
  }

  async function handleCardContextAction(action) {
    const kind = cardContextMenu.kind;
    const item = cardContextMenu.item;
    if (!kind || !item) {
      closeCardContextMenu();
      return;
    }

    if (action === 'open') {
      if (kind === 'fsm') {
        openFsmRunner(item?.id);
        closeCardContextMenu();
        return;
      }
      openCardPreview(kind, item);
      return;
    }

    if (action === 'open-fsm-mermaid') {
      openCardPreview('fsm', item, { mode: 'static', fullscreen: true });
      return;
    }

    if (action === 'open-fsm-mermaid-live') {
      openCardPreview('fsm', item, { mode: 'live', fullscreen: true });
      return;
    }

    if (action === 'copy-id') {
      await copyTextToClipboard(String(item?.id || item?.name || ''));
      closeCardContextMenu();
      return;
    }

    if (action === 'copy-mermaid') {
      await copyTextToClipboard(String(item?.mermaidSource || activeCardMermaidSource || ''));
      closeCardContextMenu();
      return;
    }

    if (action === 'open-new-window') {
      const openId = String(item?.id || item?.name || '').toLowerCase();
      const basePath = import.meta.env.BASE_URL || '/';
      const url = new URL(basePath, window.location.origin);
      url.searchParams.set('open', 'card');
      url.searchParams.set('kind', String(kind || '').toLowerCase());
      url.searchParams.set('id', openId);
      const child = window.open(url.toString(), '_blank', 'noopener,noreferrer');
      if (!child) {
        window.alert('Unable to open a new window. Please allow pop-ups for this site.');
      } else {
        child.focus();
      }
      closeCardContextMenu();
      return;
    }

    if (action === 'delete') {
      const key = getCardKey(kind, item);
      const nextHiddenMap = { ...cardHiddenMap, [key]: true };
      setCardHiddenMap(nextHiddenMap);
      void persistCardOverrides(nextHiddenMap, cardRenameMap, cardRuntimeMap);
      closeCardContextMenu();
      return;
    }

    if (action === 'rename') {
      const currentName = getCardDisplayName(kind, item, item?.name || item?.id || 'Item');
      const nextName = window.prompt('Rename card', currentName);
      if (typeof nextName === 'string' && nextName.trim()) {
        const key = getCardKey(kind, item);
        const nextRenameMap = { ...cardRenameMap, [key]: nextName.trim() };
        setCardRenameMap(nextRenameMap);
        void persistCardOverrides(cardHiddenMap, nextRenameMap, cardRuntimeMap);
      }
      closeCardContextMenu();
      return;
    }

    try {
      await executeRuntimeAction(kind, item, action);
      closeCardContextMenu();
    } catch (error) {
      window.alert(error?.message || 'Action failed.');
      closeCardContextMenu();
    }
  }

  function openCardPreview(kind, item, options = {}) {
    const title = kind === 'flow'
      ? `Flow: ${item?.name || item?.id || 'Flow'}`
      : kind === 'workflow'
        ? `Workflow: ${item?.name || item?.id || 'Workflow'}`
        : kind === 'fsm'
          ? `FSM: ${item?.name || item?.id || 'FSM'}`
        : `${kind === 'service' ? 'Service' : 'Server'}: ${item?.name || item?.id || 'Item'}`;
    setCardPreview({
      open: true,
      kind,
      title,
      item: item || null,
      mode: String(options?.mode || '') || null,
      fullscreen: Boolean(options?.fullscreen)
    });
    if (kind === 'flow') {
      const firstTransition = Array.isArray(item?.transitionMetrics) ? item.transitionMetrics[0] : null;
      setSelectedFlowTransitionId(firstTransition?.id || null);
    } else {
      setSelectedFlowTransitionId(null);
    }
    closeCardContextMenu();
  }

  function closeCardPreview() {
    setCardPreview({ open: false, kind: null, title: '', item: null, mode: null, fullscreen: false });
    setFlowDiagramSvg('');
    setFlowDiagramError('');
    setFsmPreviewStatus(null);
    setSelectedFlowTransitionId(null);
  }

  function toggleCardPreviewFullscreen() {
    setCardPreview((current) => ({ ...current, fullscreen: !current.fullscreen }));
  }

  const activeCardMermaidSource = (() => {
    if (!(cardPreview.open && (cardPreview.kind === 'flow' || cardPreview.kind === 'workflow' || cardPreview.kind === 'fsm'))) return '';
    if (cardPreview.kind === 'fsm') {
      return buildFsmMermaidSource(cardPreview.item, fsmPreviewStatus, getFsmPalette(resolvedWindowStyle));
    }
    if (cardPreview.kind === 'workflow') {
      return cardPreview.item?.mermaidSource || '';
    }
    const definition = resolveFlowDefinition(cardPreview.item);
    return definition?.mermaidSource || TRANSACTION_FLOW_MERMAID_SOURCE;
  })();

  useEffect(() => {
    if (!(cardPreview.open && cardPreview.kind === 'fsm')) {
      setTimeout(() => {
        setFsmPreviewStatus(null);
      }, 0);
      return undefined;
    }

    let cancelled = false;
    const fsmId = String(cardPreview?.item?.id || '').trim() || 'startup-fsm';
    const liveMode = cardPreview.mode === 'live';

    const loadSingleStatus = async () => {
      try {
        const response = await fetch(`/api/fsm/status?fsmId=${encodeURIComponent(fsmId)}`);
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.ok) {
          setFsmPreviewStatus(payload && typeof payload === 'object' ? payload : null);
          return;
        }
      } catch {
        if (cancelled) return;
      }
      if (!cancelled) {
        setFsmPreviewStatus((current) => current || { state: cardPreview?.item?.state || 'IDLE', workflow: [] });
      }
    };

    if (!liveMode) {
      setTimeout(() => {
        setMermaidSseConnected(false);
      }, 0);
      void loadSingleStatus();
      return () => {
        cancelled = true;
      };
    }

    let streamClosed = false;
    const source = new EventSource(`/api/fsm/events?fsmId=${encodeURIComponent(fsmId)}`);

    const handleFsmPayload = (event) => {
      if (cancelled) return;
      try {
        const payload = JSON.parse(String(event?.data || '{}'));
        setFsmPreviewStatus(payload && typeof payload === 'object' ? payload : null);
      } catch {
        // Keep previous status when malformed payload arrives.
      }
      setMermaidSsePhase((current) => (current + 1) % 1024);
    };

    source.onopen = () => {
      if (!cancelled) {
        setMermaidSseConnected(true);
      }
    };
    source.onmessage = handleFsmPayload;
    source.addEventListener('fsm', handleFsmPayload);
    source.onerror = () => {
      if (!cancelled) {
        setMermaidSseConnected(false);
      }
      if (!streamClosed) {
        source.close();
        streamClosed = true;
      }
    };

    return () => {
      cancelled = true;
      if (!streamClosed) {
        source.close();
        streamClosed = true;
      }
      setMermaidSseConnected(false);
    };
  }, [cardPreview.open, cardPreview.kind, cardPreview.item, cardPreview.mode]);

  useEffect(() => {
    if (!(cardPreview.open && (cardPreview.kind === 'flow' || cardPreview.kind === 'workflow' || cardPreview.kind === 'fsm'))) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'base',
          themeVariables: getMermaidThemeVariables(resolvedWindowStyle),
          themeCSS: '.nodeLabel, .edgeLabel, .label { letter-spacing: 0.02em; text-shadow: 0 0 1px rgba(17, 10, 5, 0.55); } .statediagram-state text, .stateGroup text { font-size: 11px !important; }'
        });
        const primarySource = activeCardMermaidSource || TRANSACTION_FLOW_MERMAID_SOURCE;
        const randomSuffix = Math.random().toString(36).slice(2, 10);
        const renderId = `flow-diagram-${Date.now()}-${randomSuffix}`;
        let { svg } = await mermaid.render(renderId, primarySource);

        // Post-process SVG to add animation classes
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(svg, 'image/svg+xml');

          if (cardPreview.kind === 'workflow') {
            Array.from(doc.querySelectorAll('g.node')).forEach((node, index) => {
              const text = String(node.textContent || '');
              node.classList.add('workflow-node');
              node.style.setProperty('--workflow-delay', `${index * 0.14}s`);

              if (/start/i.test(text)) node.classList.add('workflow-start');
              if (/end/i.test(text)) node.classList.add('workflow-end');
              if (/if\b|decision|merge/i.test(text)) node.classList.add('workflow-decision');
              if (/call api/i.test(text)) node.classList.add('workflow-call');
              if (/check api/i.test(text)) node.classList.add('workflow-check');
              if (/wait/i.test(text)) node.classList.add('workflow-wait');
              if (/route queue/i.test(text)) node.classList.add('workflow-route');
              if (/set state/i.test(text)) node.classList.add('workflow-state');
            });

            Array.from(doc.querySelectorAll('path')).forEach((pathNode, index) => {
              const className = String(pathNode.getAttribute('class') || '');
              if (/flowchart-link|edge/i.test(className) || pathNode.getAttribute('marker-end')) {
                pathNode.classList.add('workflow-edge');
                pathNode.style.setProperty('--workflow-edge-delay', `${index * 0.12}s`);
              }
            });
          }

          if (cardPreview.kind === 'fsm') {
            const activeToken = normalizeFsmStateToken(fsmPreviewStatus?.state || cardPreview?.item?.state || '');
            const doneTokens = new Set(
              (Array.isArray(fsmPreviewStatus?.workflow) ? fsmPreviewStatus.workflow : [])
                .map((step) => normalizeFsmStateToken(step))
                .filter(Boolean)
            );
            const fullLabelLookup = buildFsmFullLabelLookup(cardPreview?.item, fsmPreviewStatus);

            Array.from(doc.querySelectorAll('g.node')).forEach((node, index) => {
              node.classList.add('fsm-node');
              node.style.setProperty('--fsm-node-delay', `${index * 0.08}s`);
              const token = normalizeFsmStateToken(node.textContent || '');
              const fullLabel = fullLabelLookup.get(token);
              if (fullLabel) {
                const existingTitle = node.querySelector('title');
                if (!existingTitle) {
                  const title = doc.createElementNS('http://www.w3.org/2000/svg', 'title');
                  title.textContent = fullLabel;
                  node.insertBefore(title, node.firstChild || null);
                } else {
                  existingTitle.textContent = fullLabel;
                }
              }
              if (token && doneTokens.has(token)) {
                node.classList.add('fsm-done-node');
              }
              if (token && token === activeToken) {
                node.classList.add('fsm-active-node');
              }
            });

            Array.from(doc.querySelectorAll('path')).forEach((pathNode, index) => {
              const className = String(pathNode.getAttribute('class') || '');
              if (/flowchart-link|edge|transition/i.test(className) || pathNode.getAttribute('marker-end')) {
                pathNode.classList.add('fsm-edge');
                pathNode.style.setProperty('--fsm-edge-delay', `${index * 0.09}s`);
              }
            });
          }
          
          // Animate the fan node (label contains 'FAN')
          const fanNode = Array.from(doc.querySelectorAll('g.node')).find(g => g.textContent && g.textContent.match(/FAN/i));
          if (fanNode) {
            // Add fan-shape class to the main shape (ellipse or polygon)
            const fanShape = fanNode.querySelector('ellipse, circle, polygon, path');
            if (fanShape) fanShape.classList.add('fan-shape');
            // If there are any paths (for blades), add fan-blade class to all
            const blades = fanNode.querySelectorAll('path');
            blades.forEach(blade => blade.classList.add('fan-blade'));
          }
          
          // Animate the mouse wheel node (label contains 'Mouse')
          const mouseNode = Array.from(doc.querySelectorAll('g.node')).find(g => g.textContent && g.textContent.match(/Mouse/i));
          if (mouseNode) {
            const wheelShape = mouseNode.querySelector('ellipse, circle');
            if (wheelShape) wheelShape.classList.add('mouse-wheel');
            // Also animate any rect inside (could be the wheel or cage)
            const rects = mouseNode.querySelectorAll('rect');
            rects.forEach(rect => rect.classList.add('mouse-wheel'));
          }
          
          // Animate the domino node (label contains 'Domino')
          const dominoNode = Array.from(doc.querySelectorAll('g.node')).find(g => g.textContent && g.textContent.match(/Domino/i));
          if (dominoNode) {
            const dominoRect = dominoNode.querySelector('rect');
            if (dominoRect) dominoRect.classList.add('domino-rect');
          }
          
          // Animate queue belts: add class to all nodes with 'queue' in their label
          Array.from(doc.querySelectorAll('g.node')).forEach(g => {
            if (g.textContent && g.textContent.match(/queue|pending|created|reconciled|rejected|unreconciled/i)) {
              const beltRect = g.querySelector('rect');
              if (beltRect) beltRect.classList.add('queue-belt');
            }
          });
          
          // Animate reject bin: add falling animation
          const rejectBinNode = Array.from(doc.querySelectorAll('g.node')).find(g => g.textContent && g.textContent.match(/🗑️|reject\s*bin/i));
          if (rejectBinNode) {
            const binShape = rejectBinNode.querySelector('ellipse, circle, polygon');
            if (binShape) {
              binShape.classList.add('reject-bin');
              // Add falling items animation
              for (let i = 0; i < 4; i++) {
                const item = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
                item.setAttribute('cx', String(8 + Math.random() * 8));
                item.setAttribute('cy', String(-5 - i * 3));
                item.setAttribute('r', '2');
                item.setAttribute('fill', '#ff6b6b');
                item.setAttribute('opacity', '0.8');
                item.classList.add('falling-item');
                item.style.setProperty('--delay', String(i * 0.3));
                rejectBinNode.appendChild(item);
              }
            }
          }
          
          // Animate foreman: add walking, bell-ringing, pointing animations
          const foremanNode = Array.from(doc.querySelectorAll('g.node')).find(g => g.textContent && g.textContent.match(/👨|foreman/i));
          if (foremanNode) {
            foremanNode.classList.add('foreman-node');
            const foremanShape = foremanNode.querySelector('ellipse, circle, polygon');
            if (foremanShape) {
              foremanShape.classList.add('foreman-walk');
              // Add bell to foreman
              const bell = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
              bell.setAttribute('cx', '-8');
              bell.setAttribute('cy', '-12');
              bell.setAttribute('r', '4');
              bell.setAttribute('fill', '#FFD700');
              bell.classList.add('foreman-bell');
              foremanNode.appendChild(bell);
              // Add pointing arm (line)
              const arm = doc.createElementNS('http://www.w3.org/2000/svg', 'line');
              arm.setAttribute('x1', '0');
              arm.setAttribute('y1', '-5');
              arm.setAttribute('x2', '15');
              arm.setAttribute('y2', '-8');
              arm.setAttribute('stroke', '#8B4513');
              arm.setAttribute('stroke-width', '2');
              arm.classList.add('foreman-arm');
              foremanNode.appendChild(arm);
            }
          }
          
          // Animate subflow black box nodes (for future subflow nodes if added)
          Array.from(doc.querySelectorAll('g.node')).forEach(g => {
            if (g.textContent && (g.textContent.match(/engine|subflow|🏭/i) || g.querySelector('rect[fill="#1a1a1a"]'))) {
              const rect = g.querySelector('rect');
              if (rect) {
                rect.classList.add('subflow-box');
                // Add status lamp circle
                const lamp = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
                lamp.setAttribute('cx', '8');
                lamp.setAttribute('cy', '8');
                lamp.setAttribute('r', '4');
                lamp.classList.add('subflow-lamp');
                g.appendChild(lamp);
              }
              // Add whistle lines (vertical lines at top)
              const whistles = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
              whistles.classList.add('subflow-whistle');
              for (let i = 0; i < 2; i++) {
                const line = doc.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', String(20 + i * 30));
                line.setAttribute('y1', '-2');
                line.setAttribute('x2', String(20 + i * 30));
                line.setAttribute('y2', '-15');
                line.setAttribute('stroke', '#ffeb3b');
                line.setAttribute('stroke-width', '1.5');
                whistles.appendChild(line);
              }
              g.appendChild(whistles);
            }
          });

          if (cardPreview.kind === 'workflow') {
            const workflowNodes = Array.from(doc.querySelectorAll('g.node.workflow-node'));
            workflowNodes.forEach((node) => {
              const body = node.querySelector('rect, polygon, ellipse, circle, path');
              if (body) {
                body.classList.add('workflow-body');
              }
            });
          }
          
          svg = new XMLSerializer().serializeToString(doc.documentElement);
        } catch {
          // If SVG parsing fails, fallback to unmodified SVG
        }
        if (!cancelled) {
          setFlowDiagramSvg(svg);
          setFlowDiagramError('');
        }
      } catch (error) {
        if (!cancelled) {
          setFlowDiagramSvg('');
          setFlowDiagramError(error?.message || 'Unable to render flow diagram.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cardPreview.open, cardPreview.kind, cardPreview.item, cardPreview.mode, activeCardMermaidSource, fsmPreviewStatus, resolvedWindowStyle]);

  useEffect(() => {
    if (!cardContextMenu.open) return undefined;

    function handleDismiss(event) {
      if (event instanceof MouseEvent && event.button !== 0) return;
      const target = event.target;
      if (target instanceof Element && target.closest('.card-context-menu')) {
        return;
      }
      closeCardContextMenu();
    }

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        closeCardContextMenu();
      }
    }

    window.addEventListener('mousedown', handleDismiss);
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('mousedown', handleDismiss);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [cardContextMenu.open]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/ui/card-overrides', {
          headers: { 'x-user-id': actorUserId }
        });
        const payload = await response.json().catch(() => ({}));
        if (cancelled || !response.ok) return;
        setCardHiddenMap(payload?.hiddenMap && typeof payload.hiddenMap === 'object' ? payload.hiddenMap : {});
        setCardRenameMap(payload?.renameMap && typeof payload.renameMap === 'object' ? payload.renameMap : {});
        setCardRuntimeMap(payload?.runtimeMap && typeof payload.runtimeMap === 'object' ? payload.runtimeMap : {});
      } catch {
        if (cancelled) return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [actorUserId, pathname]);

  useEffect(() => {
    if (deepLinkHandledRef.current) return;

    const params = new URLSearchParams(window.location.search || '');
    if (params.get('open') !== 'card') return;

    const kind = String(params.get('kind') || '').toLowerCase();
    const id = String(params.get('id') || '').toLowerCase();
    if (!kind || !id) return;

    // Inline minimal deep-link lookup to avoid depending on non-stable callbacks
    let item = null;
    const normalizedId = id;
    if (kind === 'flow') {
      item = overview.flows.find((itm) => String(itm?.id || itm?.name || '').toLowerCase() === normalizedId);
      if (!item) {
        const definition = FLOW_DEFINITIONS.find((d) => String(d.id || '').toLowerCase() === normalizedId || String(d.name || '').toLowerCase() === normalizedId);
        if (definition) {
          item = {
            id: definition.id,
            name: definition.name,
            runtimeStatus: 'idle',
            throughputStatus: 'no-data',
            policyStatus: 'no-data',
            transactionCount: 0,
            transitionMetrics: Array.isArray(definition.transitionMetrics) ? definition.transitionMetrics : []
          };
        }
      }
    } else if (kind === 'service') {
      item = overview.services.find((itm) => String(itm?.id || itm?.name || '').toLowerCase() === normalizedId) || null;
    } else if (kind === 'server') {
      item = overview.servers.find((itm) => String(itm?.id || itm?.name || '').toLowerCase() === normalizedId) || null;
    } else if (kind === 'workflow') {
      item = workflowCards.find((itm) => String(itm?.id || itm?.name || '').toLowerCase() === normalizedId) || null;
    }

    if (!item) return;

    deepLinkHandledRef.current = true;
    // Inline openCardPreview to avoid depending on non-stable callback
    const title = kind === 'flow'
      ? `Flow: ${item?.name || item?.id || 'Flow'}`
      : kind === 'workflow'
        ? `Workflow: ${item?.name || item?.id || 'Workflow'}`
        : kind === 'fsm'
          ? `FSM: ${item?.name || item?.id || 'FSM'}`
          : `${kind === 'service' ? 'Service' : 'Server'}: ${item?.name || item?.id || 'Item'}`;
    // Schedule state updates to avoid synchronous setState inside effect body
    setTimeout(() => {
      setCardPreview({ open: true, kind, title, item: item || null, mode: null, fullscreen: false });
      if (kind === 'flow') {
        const firstTransition = Array.isArray(item?.transitionMetrics) ? item.transitionMetrics[0] : null;
        setSelectedFlowTransitionId(firstTransition?.id || null);
      } else {
        setSelectedFlowTransitionId(null);
      }
    }, 0);
  }, [overview.flows, overview.services, overview.servers, workflowCards]);

  function clampRhsWidth(nextWidth) {
    return Math.max(RHS_MIN_WIDTH, Math.min(RHS_MAX_WIDTH, Math.round(nextWidth)));
  }

  function handleRhsResizeStart(event) {
    if (window.innerWidth <= 1100) return;
    event.preventDefault();
    setIsResizingSidebar(true);
  }

  function nudgeRhsWidth(delta) {
    setRhsWidth((current) => clampRhsWidth(current + delta));
  }

  async function handleLogin() {
    const nextUserId = String(loginUserId || '').trim();
    const nextPassword = String(loginPassword || '');
    const isFixedLocalAdmin = nextUserId.toLowerCase() === String(FIXED_LOGIN_USER_ID || '').toLowerCase()
      && String(FIXED_LOGIN_PASSWORD || '') === '';

    if (!nextUserId || (!nextPassword && !isFixedLocalAdmin)) {
      setAuthzError('Enter user ID and password.');
      return;
    }

    try {
      if (isFixedLocalAdmin) {
        setActorUserId(nextUserId);
        setLoginPassword('');
        setAuthzError('');
        return;
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: nextUserId, password: nextPassword })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || `Login failed (${response.status})`);
      }

      if (payload?.token) {
        localStorage.setItem('pulse.authToken', String(payload.token));
      }
      setActorUserId(String(payload?.actor?.userId || nextUserId));
      setLoginPassword('');
      setAuthzError('');
    } catch (e) {
      setAuthzError(e?.message || String(e));
    }
  }

  async function handleLogout() {
    const token = localStorage.getItem('pulse.authToken') || '';
    if (token) {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // no-op
      }
    }
    localStorage.removeItem('pulse.authToken');
    setActorUserId('anonymous');
    setLoginUserId(FIXED_LOGIN_USER_ID);
    setLoginPassword('');
    localStorage.setItem('pulse.actorUserId', 'anonymous');
    setAuthz({ actor: null, profiles: [], permissions: [] });
    setAuthzError('Logged out');
  }

  function navigateTo(nextPath) {
    const targetPath = String(nextPath || '/').startsWith('/') ? String(nextPath || '/') : `/${String(nextPath || '')}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setPathname(targetPath);
  }

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname || '/');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshRunnableFsms() {
      try {
        const response = await fetch('/api/fsm/runnable');
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        const items = Array.isArray(payload?.items) ? payload.items : [];
        setRunnableFsms(items);
        if (!items.some((item) => String(item?.id || '') === selectedFsmId)) {
          const fallbackId = String(items[0]?.id || 'startup-fsm');
          setSelectedFsmId(fallbackId);
        }
      } catch {
        if (cancelled) return;
        setRunnableFsms([]);
      }
    }

    refreshRunnableFsms();
    const timer = setInterval(refreshRunnableFsms, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedFsmId]);

  useEffect(() => {
    const hasToken = Boolean(localStorage.getItem('pulse.authToken'));
    const normalizedActor = String(actorUserId || '').trim().toLowerCase();
    if (!hasToken && (!normalizedActor || normalizedActor === 'anonymous')) {
      setActorUserId('system-admin');
      setLoginUserId(FIXED_LOGIN_USER_ID);
      return;
    }

    localStorage.setItem('pulse.actorUserId', actorUserId);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/authz/me', {
          headers: { 'x-user-id': actorUserId }
        });
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          if (!hasToken && res.status === 401 && normalizedActor && normalizedActor !== 'system-admin') {
            setActorUserId('system-admin');
            setLoginUserId(FIXED_LOGIN_USER_ID);
            return;
          }
          setAuthz({ actor: null, profiles: [], permissions: [] });
          setAuthzError(payload.error || `Authz lookup failed (${res.status})`);
          return;
        }
        setAuthz({ actor: payload.actor || null, profiles: payload.profiles || [], permissions: payload.permissions || [] });
        setAuthzError('');
      } catch (e) {
        if (cancelled) return;
        setAuthz({ actor: null, profiles: [], permissions: [] });
        setAuthzError(e.message || String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [actorUserId]);

  useEffect(() => {
    localStorage.setItem('pulse.rhsWidth', String(rhsWidth));
  }, [rhsWidth]);

  useEffect(() => {
    localStorage.setItem('pulse.language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('pulse.windowStyle', windowStyle);
  }, [windowStyle]);

  useEffect(() => {
    const loadThemePack = THEME_PACK_LOADERS[resolvedWindowStyle] || THEME_PACK_LOADERS.standard;
    loadThemePack().catch((error) => {
      console.error(`[THEME] Failed to load theme pack for ${resolvedWindowStyle}:`, error);
    });
  }, [resolvedWindowStyle]);

  useEffect(() => {
    const loadAccessibilityPack = ACCESSIBILITY_PACK_LOADERS[resolvedContrastMode] || ACCESSIBILITY_PACK_LOADERS.none;
    loadAccessibilityPack().catch((error) => {
      console.error(`[A11Y-THEME] Failed to load accessibility pack for ${resolvedContrastMode}:`, error);
    });
  }, [resolvedContrastMode]);

  useEffect(() => {
    localStorage.setItem('pulse.lhsCollapsed', lhsCollapsed ? '1' : '0');
  }, [lhsCollapsed]);

  useEffect(() => {
    localStorage.setItem('pulse.rhsCollapsed', rhsCollapsed ? '1' : '0');
  }, [rhsCollapsed]);

  useEffect(() => {
    const handleF1 = (event) => {
      if (event.key !== 'F1') return;
      event.preventDefault();
      setAskBoxActive(true);
      setRhsCollapsed(false);
    };
    window.addEventListener('keydown', handleF1);
    return () => window.removeEventListener('keydown', handleF1);
  }, []);

  useEffect(() => {
    if (!isResizingSidebar) return;

    const handlePointerMove = (event) => {
      const clientX = event.touches?.[0]?.clientX ?? event.clientX;
      if (!Number.isFinite(clientX)) return;
      const viewportWidth = window.innerWidth || 0;
      const maxAllowed = Math.min(RHS_MAX_WIDTH, Math.max(RHS_MIN_WIDTH + 40, viewportWidth * 0.48));
      const targetWidth = viewportWidth - clientX;
      setRhsWidth(Math.max(RHS_MIN_WIDTH, Math.min(maxAllowed, Math.round(targetWidth))));
    };

    const stopResize = () => setIsResizingSidebar(false);

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', stopResize);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', stopResize);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', stopResize);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', stopResize);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSidebar]);

  const effectivePermissions = useMemo(() => {
    const permissions = Array.isArray(authz.permissions) ? authz.permissions : [];
    return permissions;
  }, [authz.permissions, actorUserId]);

  const visibleAreas = useMemo(
    () => AREAS.filter((item) => CORE_AREA_IDS.has(item.id) || hasPermission(effectivePermissions, item.permission)),
    [effectivePermissions]
  );

  useEffect(() => {
    if (visibleAreas.length === 0) return;
    if (!visibleAreas.some(item => item.id === area)) {
      setTimeout(() => {
        setArea(visibleAreas[0].id);
      }, 0);
    }
  }, [area, visibleAreas]);

  useEffect(() => {
    if (!(cardPreview.open && (cardPreview.kind === 'flow' || cardPreview.kind === 'workflow'))) {
      setTimeout(() => {
        setMermaidSseConnected(false);
      }, 0);
      return undefined;
    }

    let cancelled = false;
    const source = new EventSource('/api/events/mermaid');

    const handleMessage = (event) => {
      if (cancelled) return;
      try {
        const payload = JSON.parse(String(event?.data || '{}'));
        const phase = Number(payload?.phase || 0);
        setMermaidSsePhase(Number.isFinite(phase) ? phase : 0);
      } catch {
        setMermaidSsePhase((current) => (current + 1) % 1024);
      }
    };

    source.onopen = () => {
      if (!cancelled) setMermaidSseConnected(true);
    };
    source.onmessage = handleMessage;
    source.addEventListener('mermaid', handleMessage);
    source.onerror = () => {
      if (!cancelled) setMermaidSseConnected(false);
    };

    return () => {
      cancelled = true;
      setMermaidSseConnected(false);
      source.close();
    };
  }, [cardPreview.open, cardPreview.kind]);

  useEffect(() => {
    if (pathname === '/chat') return;
    if (askBoxActive) return;
    let cancelled = false;
    const loadMonitorClasses = async () => {
      try {
        const response = await fetch('/api/operations/monitor/classes');
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) return;
        const classes = (Array.isArray(payload.classes) ? payload.classes : [])
          .filter(item => item?.classId !== 'servers' && item?.classId !== 'gateways');
        setMonitorClasses(classes);
        if (!classes.some(item => item.classId === monitorClassId)) {
          const preferred = classes.find(item => item.classId === 'transaction-flows')?.classId;
          setMonitorClassId(preferred || classes[0]?.classId || 'transaction-flows');
        }
      } catch {
        if (cancelled) return;
      }
    };

    loadMonitorClasses();
    return () => {
      cancelled = true;
    };
  }, [askBoxActive, monitorClassId, pathname]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [schemasRes, typesRes] = await Promise.all([
          fetch('/api/librarian/schemas'),
          fetch('/api/librarian/data-types')
        ]);

        const schemas = await schemasRes.json().catch(() => ({}));
        const dataTypes = await typesRes.json().catch(() => ({}));
        if (cancelled) return;

        const fromSchemas = Array.isArray(schemas?.schemas) ? schemas.schemas : [];
        const fromTypes = Array.isArray(dataTypes?.types) ? dataTypes.types : [];
        const merged = [...fromSchemas, ...fromTypes];
        setMessageLayouts(merged);
      } catch {
        if (!cancelled) {
          setMessageLayouts([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const closeMenu = () => setTaskContextMenu(prev => ({ ...prev, open: false }));
    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, []);

  useEffect(() => {
    if (pathname === '/chat') return;
    let cancelled = false;
    let inFlight = false;
    let failureCount = 0;
    let timerId = null;
    let activeController = null;
    const baseIntervalMs = 60000;
    const maxIntervalMs = 300000;

    const scheduleNext = (delayMs) => {
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => {
        runOverviewRefresh(false);
      }, delayMs);
    };

    const getHeaders = () => ({
      'x-user-id': actorUserId
    });

    const runOverviewRefresh = async (forceNow) => {
      if (cancelled) return;
      if (!forceNow && document.hidden) {
        scheduleNext(baseIntervalMs);
        return;
      }
      if (inFlight) {
        scheduleNext(baseIntervalMs);
        return;
      }

      inFlight = true;
      activeController = new AbortController();
      try {
        const readPayload = async (result) => {
          if (result.status !== 'fulfilled') return null;
          const response = result.value;
          return response.json().catch(() => null);
        };

        const [wRes, gRes, mRes, dRes, dbRes, qmRes, bRes, sRes] = await Promise.allSettled([
          fetch('/api/lifecycle/workers', { headers: getHeaders(), signal: activeController.signal }),
          fetch('/api/gateways', { headers: getHeaders(), signal: activeController.signal }),
          fetch('/api/metrics/current', { headers: getHeaders(), signal: activeController.signal }),
          fetch('/api/lifecycle/dashboard', { headers: getHeaders(), signal: activeController.signal }),
          fetch('/api/registry/databases', { headers: getHeaders(), signal: activeController.signal }),
          fetch('/api/registry/queue-managers', { headers: getHeaders(), signal: activeController.signal }),
          fetch('/api/broker/state', { headers: getHeaders(), signal: activeController.signal }),
          fetch('/api/registry/services', { headers: getHeaders(), signal: activeController.signal }),
        ]);
        const [workers, gateways, metrics, dashboard, databases, queueManagers, brokers, servicesPayload] = await Promise.all([
          readPayload(wRes),
          readPayload(gRes),
          readPayload(mRes),
          readPayload(dRes),
          readPayload(dbRes),
          readPayload(qmRes),
          readPayload(bRes),
          readPayload(sRes),
        ]);
        if (cancelled) return;
        const q = metrics?.metrics?.queueDepths || {};
        const activeTransactions = Array.isArray(dashboard?.activeTransactions) ? dashboard.activeTransactions.length : 0;
        const latencyTargets = metrics?.latencyPolicy?.targets || {};
        const latencyEvaluations = metrics?.latencyPolicy?.evaluations || {};
        const now = Date.now();
        const stateCountsByQueue = Array.isArray(dashboard?.states)
          ? dashboard.states.reduce((bucket, state) => {
            const queueName = String(state?.queueName || '').trim();
            if (!queueName) return bucket;
            bucket[queueName] = Number(state?.cumulativeCount || 0);
            return bucket;
          }, {})
          : {};
        const serverRows = [];

        for (const db of Array.isArray(databases?.databases) ? databases.databases : []) {
          serverRows.push({
            id: `database-${db.serverId || db.name}`,
            family: 'Database',
            name: String(db.name || db.serverId || 'Database Server'),
            detail: `${db.host || 'localhost'}${db.port ? `:${db.port}` : ''}`,
            status: normalizeRuntimeStatus(db.status),
            statusText: String(db.serviceState || db.status || 'unknown')
          });
        }

        for (const manager of Array.isArray(queueManagers?.queueManagers) ? queueManagers.queueManagers : []) {
          serverRows.push({
            id: `qm-${manager.managerId}`,
            family: 'Queue Manager',
            name: String(manager.managerId || 'queue-manager'),
            detail: `${manager.nodeId || manager.ip || 'localhost'}${manager.port ? `:${manager.port}` : ''}`,
            status: normalizeRuntimeStatus(manager.status),
            statusText: String(manager.status || 'unknown')
          });
        }

        for (const [brokerId, instance] of Object.entries(brokers?.brokers || {})) {
          const brokerStatus = instance?.active ? (instance?.quiesced ? 'paused' : 'online') : 'offline';
          serverRows.push({
            id: `broker-${brokerId}`,
            family: 'Broker',
            name: brokerId,
            detail: `Class ${String(brokers?.classStatus || brokers?.state || 'unknown')}`,
            status: brokerStatus,
            statusText: instance?.active ? (instance?.quiesced ? 'quiesced' : 'active') : 'down'
          });
        }

        for (const gatewayId of ['swift', 'boc', 'fed']) {
          const gateway = gateways?.[gatewayId] || {};
          const running = Boolean(gateway.running);
          const active = running && activeTransactions > 0;
          serverRows.push({
            id: `gateway-${gatewayId}`,
            family: 'Gateway',
            name: gatewayId.toUpperCase(),
            detail: active ? `${activeTransactions} active tx` : 'No active tx',
            status: running ? (active ? 'online' : 'paused') : 'offline',
            statusText: running ? (active ? 'active' : 'idle') : 'stopped'
          });
        }

        const serviceRows = [];
        for (const [serviceName, instances] of Object.entries(servicesPayload?.services || {})) {
          for (const instance of Array.isArray(instances) ? instances : []) {
            const normalized = normalizeRuntimeStatus(instance?.status);
            serviceRows.push({
              id: `${serviceName}:${instance?.instanceId || instance?.nodeId || Math.random()}`,
              name: String(instance?.instanceId || serviceName),
              status: normalized,
              state: String(instance?.status || 'unknown')
            });
          }
        }

        const flowDefinitionById = FLOW_DEFINITIONS.reduce((acc, definition) => {
          acc[definition.id] = definition;
          return acc;
        }, {});

        const flowRows = Object.entries(latencyTargets).map(([flowId, target]) => {
          const evaluation = latencyEvaluations[flowId] || {};
          const definition = flowDefinitionById[flowId] || null;
          const definitionQueues = Array.isArray(definition?.transitionMetrics)
            ? definition.transitionMetrics
              .map((metric) => String(metric?.queueName || '').trim())
              .filter(Boolean)
            : [];
          const sourceQueues = Array.isArray(target?.queues)
            ? target.queues
            : Array.isArray(evaluation?.sourceQueues)
              ? evaluation.sourceQueues
              : definitionQueues;
          const throughputQueue = String(target?.throughputQueue || sourceQueues[sourceQueues.length - 1] || sourceQueues[0] || '').trim();
          const queuedNow = sourceQueues.reduce((sum, queueName) => sum + Number(q?.[queueName]?.current || 0), 0);
          const currentCount = Number(stateCountsByQueue[throughputQueue] || 0);
          const cumulativeCount = sourceQueues.reduce((sum, queueName) => sum + Number(stateCountsByQueue[queueName] || 0), 0);
          const previousSnapshot = flowSnapshotRef.current[flowId] || null;
          const elapsedSeconds = previousSnapshot ? Math.max((now - Number(previousSnapshot.at || now)) / 1000, 0.001) : null;
          const deltaCount = previousSnapshot ? Math.max(0, currentCount - Number(previousSnapshot.count || 0)) : 0;
          const actualThroughputTps = elapsedSeconds ? deltaCount / elapsedSeconds : null;
          const latencyPoint = Number.isFinite(Number(evaluation?.p95Ms)) ? Number(evaluation.p95Ms) : 0;
          const throughputPoint = Number.isFinite(actualThroughputTps) ? actualThroughputTps : 0;
          const latencyHistory = [...(previousSnapshot?.latencyHistory || []), latencyPoint].slice(-12);
          const throughputHistory = [...(previousSnapshot?.throughputHistory || []), throughputPoint].slice(-12);

          const runtimeStatus = queuedNow > 0 || (Number.isFinite(actualThroughputTps) && actualThroughputTps > 0) ? 'running' : 'idle';
          const targetThroughputTps = Number.isFinite(Number(target?.targetThroughputTps)) ? Number(target.targetThroughputTps) : null;
          const throughputStatus = getThroughputHealth(actualThroughputTps, targetThroughputTps, runtimeStatus);

          const queueMetric = (queueName) => ({
            queueName,
            waiting: Number(q?.[queueName]?.current || 0),
            cumulative: Number(stateCountsByQueue[queueName] || 0)
          });

          const transitionMetrics = [
            { id: 'mapped_to_pacs', label: 'mapped_to_pacs', ...queueMetric('tx.pacs.created') },
            { id: 'sanctions_scanning', label: 'sanctions_scanning', ...queueMetric('tx.pacs.created') },
            { id: 'liqudity_management', label: 'liqudity_management', ...queueMetric('tx.lynx.pending') },
            { id: 'lynx_decision', label: 'lynx_decision', ...queueMetric('tx.lynx.pending') },
            { id: 'sent_to_correspondent', label: 'sent_to_correspondent', ...queueMetric('tx.correspondent.unreconciled') },
            { id: 'statement_matched', label: 'statement_matched', ...queueMetric('tx.reconciled') }
          ];

          flowSnapshotRef.current[flowId] = {
            at: now,
            count: currentCount,
            latencyHistory,
            throughputHistory
          };

          return {
            id: flowId,
            name: String(target?.description || flowId),
            targetMs: Number.isFinite(Number(target?.p95Ms)) ? Number(target.p95Ms) : null,
            actualMs: Number.isFinite(Number(evaluation?.p95Ms)) ? Number(evaluation.p95Ms) : null,
            actualThroughputTps,
            targetThroughputTps,
            runtimeStatus,
            policyStatus: String(evaluation?.status || 'no-data'),
            throughputStatus,
            budgetUsedPercent: Number.isFinite(Number(evaluation?.budgetUsedPercent)) ? Number(evaluation.budgetUsedPercent) : null,
            queues: sourceQueues,
            queuedNow,
            latencyHistory,
            throughputHistory,
            transactionCount: cumulativeCount,
            transitionMetrics,
          };
        });

        // Ensure user-created/core flows remain visible even when backend targets are missing.
        const existingFlowIds = new Set(flowRows.map((flow) => String(flow.id).toLowerCase()));
        for (const definition of FLOW_DEFINITIONS) {
          if (existingFlowIds.has(definition.id)) continue;
          const definitionQueues = Array.isArray(definition.transitionMetrics)
            ? [...new Set(definition.transitionMetrics
              .map((metric) => String(metric?.queueName || '').trim())
              .filter(Boolean))]
            : [];
          const queuedNow = definitionQueues.reduce((sum, queueName) => sum + Number(q?.[queueName]?.current || 0), 0);
          const transactionCount = definitionQueues.reduce((sum, queueName) => sum + Number(stateCountsByQueue[queueName] || 0), 0);
          flowRows.push({
            id: definition.id,
            name: definition.name,
            targetMs: null,
            actualMs: null,
            actualThroughputTps: 0,
            targetThroughputTps: null,
            runtimeStatus: 'idle',
            policyStatus: 'no-data',
            throughputStatus: 'no-data',
            budgetUsedPercent: null,
            queues: definitionQueues,
            queuedNow,
            latencyHistory: [],
            throughputHistory: [],
            transactionCount,
            transitionMetrics: Array.isArray(definition.transitionMetrics)
              ? definition.transitionMetrics.map((metric) => ({
                ...metric,
                waiting: Number(q?.[metric.queueName]?.current || 0),
                cumulative: Number(stateCountsByQueue[metric.queueName] || 0)
              }))
              : [],
          });
        }

        setOverview({
          workers: {
            lifecycle: (workers.lifecycleWorkers || []).length,
            bridge: (workers.bridgeWorkers || []).length,
          },
          gateways: {
            swift: Boolean(gateways?.swift?.running) && activeTransactions > 0,
            boc: Boolean(gateways?.boc?.running) && activeTransactions > 0,
            fed: Boolean(gateways?.fed?.running) && activeTransactions > 0,
          },
          activity: {
            activeTransactions,
          },
          queues: {
            inbound: q['swift.mt103.inbound']?.current || 0,
            pending: q['tx.lynx.pending']?.current || 0,
            approved: q['tx.lynx.approved']?.current || 0,
          },
          services: serviceRows,
          servers: serverRows,
          flows: flowRows,
          system: {
            cpuUsagePercent: Number(metrics?.metrics?.systemResources?.cpu?.usagePercent ?? null),
            memoryUsagePercent: Number(metrics?.metrics?.systemResources?.memory?.usagePercent ?? null),
          }
        });
        failureCount = 0;
      } catch (error) {
        if (cancelled) return;
        if (error?.name !== 'AbortError') {
          failureCount = Math.min(failureCount + 1, 3);
        }
      } finally {
        inFlight = false;
        activeController = null;
        if (!cancelled) {
          const nextDelay = failureCount === 0
            ? baseIntervalMs
            : Math.min(baseIntervalMs * (2 ** failureCount), maxIntervalMs);
          scheduleNext(nextDelay);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        runOverviewRefresh(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    runOverviewRefresh(true);
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
      if (activeController) activeController.abort();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [actorUserId, pathname, askBoxActive]);

  const activeArea = visibleAreas.find((item) => item.id === area) || null;
  const availableRunnableFsms = runnableFsms.filter((item) => item?.canRun !== false);
  const languageKey = getLanguageKey(language);
  const copy = LANGUAGE_COPY[languageKey] || LANGUAGE_COPY.en;
  const publicArtifacts = useMemo(
    () => buildPublicArtifacts({
      workflowSource: workflowSourceArtifact,
      workflowCards,
      dataMappings: Array.isArray(dataMappingsArtifact) ? dataMappingsArtifact : [],
      flowDefinitions: FLOW_DEFINITIONS,
      routingRules: Array.isArray(routingRulesArtifact) ? routingRulesArtifact : []
    }),
    [workflowCards]
  );

  function renderMonitorContent() {
    return <TransactionLifecycleDashboard />;
  }

  function openTaskContextMenu(event, taskId) {
    event.preventDefault();
    setArea('user-admin');
    setUserAdminTask(taskId);
    setTaskContextMenu({ open: true, x: event.clientX, y: event.clientY, taskId });
  }

  function handleAreaIconClick(areaId) {
    if (areaId === 'operations' && area === 'operations') {
      setOperationsNavExpanded((prev) => !prev);
      setTaskContextMenu(prev => ({ ...prev, open: false }));
      return;
    }
    setArea(areaId);
    if (areaId === 'operations') {
      setOperationsTask('monitor');
      setOperationsNavExpanded(true);
    }
    setTaskContextMenu(prev => ({ ...prev, open: false }));
  }

  function openFsmRunner(fsmId) {
    setArea('operations');
    setOperationsTask('fsm-runner');
    setSelectedFsmId(String(fsmId || 'startup-fsm'));
  }

  function openDevelopDebugger(payload = {}) {
    openFsmRunner(String(payload?.fsmId || 'startup-fsm'));
  }

  useEffect(() => {
    function handleOpenDebuggerEvent(event) {
      const detail = event?.detail && typeof event.detail === 'object' ? event.detail : {};
      openDevelopDebugger(detail);
    }

    window.addEventListener('pulse:open-debugger', handleOpenDebuggerEvent);
    return () => {
      window.removeEventListener('pulse:open-debugger', handleOpenDebuggerEvent);
    };
  }, []);

  function handleAreaIconContextMenu(event, areaId) {
    event.preventDefault();
    setArea(areaId);
    setTaskContextMenu(prev => ({ ...prev, open: false }));
  }

  function applyUserAdminAction(action) {
    if (!USER_ADMIN_ACTIONS.includes(action)) return;
    setUserAdminAction(action);
    if (taskContextMenu.taskId) {
      setUserAdminTask(taskContextMenu.taskId);
    }
    setTaskContextMenu(prev => ({ ...prev, open: false }));
  }

  const renderMainContent = () => {
    if (!activeArea) {
      return <div className="area-empty">No screens available for this actor.</div>;
    }

    if (area === 'operations') {
      if (operationsTask === 'fsm-runner') {
        return <StartupFsmMonitor fsmId={selectedFsmId} themeStyle={resolvedWindowStyle} />;
      }
      if (operationsTask === 'topology') {
        return <TopologyDashboard />;
      }
      if (operationsTask === 'monitor') {
        return renderMonitorContent(monitorClassId);
      }
      if (operationsTask === 'deploy') {
        return (
          <div className="stacked-panels">
            <SwiftGatewayDashboard />
            <BocGatewayDashboard />
          </div>
        );
      }
      if (operationsTask === 'manage') {
        return (
          <div className="stacked-panels">
            <FlowTargetsDashboard />
            <QueueManagerDashboard actorPermissions={effectivePermissions} />
          </div>
        );
      }
      return renderMonitorContent(monitorClassId);
    }
    if (area === 'analyze') return <DataMapper />;
    if (area === 'data-librarian') {
      if (dataLibrarianTask === 'pascalish-editor') {
        return <PascalishEditor />;
      }
      return <DataLibrarian />;
    }
    if (area === 'develop') {
      return (
        <DeveloperDashboard
          actorPermissions={effectivePermissions}
          createRequest={developCreateRequest}
          onCreateRequestHandled={() => setDevelopCreateRequest(null)}
          onOpenDebugger={openDevelopDebugger}
          themeStyle={resolvedWindowStyle}
        />
      );
    }
    if (area === 'network') {
      return <NetworkDevicesPage />;
    }
    if (area === 'project-manage') {
      if (projectManageTask === 'planner') {
        return <ProjectPlannerVisualTool />;
      }
    }
    if (area === 'test') return <TransactionLifecycleDashboard />;
    if (area === 'deploy') {
      return (
        <div className="stacked-panels">
          <SwiftGatewayDashboard />
          <BocGatewayDashboard />
        </div>
      );
    }
    if (area === 'user-admin') {
      if (userAdminTask === 'user') {
        return <UserManagementDashboard actorPermissions={effectivePermissions} />;
      }
      if (userAdminTask === 'profile') {
        return <ProfileManagementDashboard actorPermissions={effectivePermissions} />;
      }
      if (userAdminTask === 'user-in-profile') {
        return <UserInProfileDashboard actorPermissions={effectivePermissions} />;
      }
      if (userAdminTask === 'provisioner') {
        return <UserProvisioner actorPermissions={effectivePermissions} />;
      }
      if (userAdminTask === 'verifier') {
        return <UserVerifier actorPermissions={effectivePermissions} />;
      }
      if (userAdminTask === 'browser') {
        return <UserProfileBrowser actorPermissions={effectivePermissions} />;
      }
      return <UserManagementDashboard actorPermissions={effectivePermissions} />;
    }

    return <ProjectPlannerVisualTool />;
  };

  if (pathname === '/chat') {
    return (
      <ChatPage
        onNavigateHome={() => navigateTo('/')}
        themeClassName={`window-style-${resolvedWindowStyle} accessibility-${resolvedContrastMode}`}
        screenContext={{ area, operationsTask, monitorClassId, actorUserId, language, overview, actor: authz.actor, roles: authz.profiles, permissions: authz.permissions }}
        askBoxActive={askBoxActive}
        onSetAskBoxActive={setAskBoxActive}
      />
    );
  }

  return (
    <div
      className={`app-shell window-style-${resolvedWindowStyle} accessibility-${resolvedContrastMode}${isResizingSidebar ? ' is-resizing' : ''}${lhsCollapsed ? ' lhs-collapsed' : ''}${rhsCollapsed ? ' rhs-collapsed' : ''}${askBoxActive ? ' ask-box-active' : ''}`}
      style={{
        '--lhs-width': lhsCollapsed ? '56px' : 'clamp(190px, 16vw, 300px)',
        '--rhs-width': rhsCollapsed ? '56px' : `${rhsWidth}px`,
        '--divider-width': rhsCollapsed ? '0px' : '8px'
      }}
    >
      <header className="utility-top-bar">
        <div className="utility-status">
          <span className="utility-chip"><strong>Language:</strong> {LANGUAGE_OPTIONS.find(item => item.value === language)?.label || language}</span>
          <span className="utility-chip"><strong>Style:</strong> {getThemeDisplayLabel(resolvedWindowStyle)}</span>
        </div>
        <div className="utility-actions">
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="utility-select"
            aria-label="Language"
          >
            {LANGUAGE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={windowStyle}
            onChange={(event) => setWindowStyle(event.target.value)}
            className="utility-select"
            aria-label="Style"
          >
            {WINDOW_THEMES.map((themeId) => (
              <option key={themeId} value={themeId}>{getThemeDisplayLabel(themeId)}</option>
            ))}
          </select>
          <input
            className="utility-input"
            value={loginUserId}
            onChange={(event) => setLoginUserId(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleLogin();
              }
            }}
            placeholder={FIXED_LOGIN_USER_ID}
            aria-label="User ID"
          />
          <input
            className="utility-input"
            type="password"
            value={loginPassword}
            onChange={(event) => setLoginPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleLogin();
              }
            }}
            placeholder="enter password"
            aria-label="Password"
          />
          <button className="utility-button" type="button" onClick={handleLogin}>Login</button>
          <button className="utility-button utility-button--warn" type="button" onClick={handleLogout}>Logout</button>
        </div>
        {authzError ? <div className="utility-chip" role="status">{authzError}</div> : null}
      </header>

      <aside className="lhs-sidebar">
        <button
          className="sidebar-toggle lhs-toggle"
          type="button"
          onClick={() => setLhsCollapsed((prev) => !prev)}
          aria-expanded={!lhsCollapsed}
          aria-label={lhsCollapsed ? 'Expand left sidebar' : 'Collapse left sidebar'}
        >
          {lhsCollapsed ? '>>' : '<<'}
        </button>
        <div className="brand">Pulse Ops</div>
        <div className="lhs-scroll">
          <section className="nav-section">
            <div className="section-title">User Role</div>
            <nav className="area-nav" aria-label="User Role">
              {visibleAreas.map((item) => (
                <div key={item.id}>
                  <button
                    className={`area-nav-item ${area === item.id ? 'is-active' : ''}`}
                    onClick={() => handleAreaIconClick(item.id)}
                    onContextMenu={(event) => handleAreaIconContextMenu(event, item.id)}
                    style={{ '--area-accent': item.accent }}
                    title={lhsCollapsed ? item.label : undefined}
                    aria-label={item.label}
                  >
                    <span className="area-icon">{AREA_ICONS[item.id]}</span>
                    <span className="area-label">{item.label}</span>
                  </button>
                  {item.id === 'user-admin' && area === 'user-admin' && (
                    <div className="admin-subtasks" aria-label="User Admin Tasks">
                      {USER_ADMIN_TASKS.map(task => (
                        <button
                          key={task.id}
                          className={`admin-subtask-item ${userAdminTask === task.id ? 'is-active' : ''}`}
                          onClick={() => {
                            setUserAdminTask(task.id);
                            setTaskContextMenu(prev => ({ ...prev, open: false }));
                          }}
                          onContextMenu={(event) => openTaskContextMenu(event, task.id)}
                          title="Right click for Add/Delete/Update"
                        >
                          {task.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {item.id === 'operations' && area === 'operations' && (
                    <div className="admin-subtasks" aria-label="Operations Tasks">
                      <button
                        className="admin-subtask-item"
                        onClick={() => setOperationsNavExpanded((prev) => !prev)}
                      >
                        {operationsNavExpanded ? 'Contract Operations' : 'Expand Operations'}
                      </button>
                      {operationsNavExpanded && (
                        <>
                          {OPERATIONS_TASKS.map(task => (
                            <button
                              key={task.id}
                              className={`admin-subtask-item ${operationsTask === task.id ? 'is-active' : ''}`}
                              onClick={() => setOperationsTask(task.id)}
                            >
                              {task.label}
                            </button>
                          ))}
                          <div className="admin-subtasks" aria-label="Overview Lists">
                            <button
                              className={`admin-subtask-item ${collapsedSections.flows ? '' : 'is-active'}`}
                              onClick={() => toggleSection('flows')}
                            >
                              {collapsedSections.flows ? 'Expand Flows' : 'Contract Flows'}
                            </button>
                            <button
                              className={`admin-subtask-item ${collapsedSections.services ? '' : 'is-active'}`}
                              onClick={() => toggleSection('services')}
                            >
                              {collapsedSections.services ? 'Expand Services' : 'Contract Services'}
                            </button>
                            <button
                              className={`admin-subtask-item ${collapsedSections.servers ? '' : 'is-active'}`}
                              onClick={() => toggleSection('servers')}
                            >
                              {collapsedSections.servers ? 'Expand Servers' : 'Contract Servers'}
                            </button>
                          </div>
                          {operationsTask === 'monitor' && (
                            <div className="admin-subtasks" aria-label="Monitor Classes">
                              {(monitorClasses.length > 0 ? monitorClasses : [
                                { classId: 'transaction-flows', label: 'Transaction Flows' }
                              ]).map(itemClass => (
                                <button
                                  key={itemClass.classId}
                                  className={`admin-subtask-item ${monitorClassId === itemClass.classId ? 'is-active' : ''}`}
                                  onClick={() => setMonitorClassId(itemClass.classId)}
                                >
                                  {getMonitorClassLabel(itemClass)}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {item.id === 'analyze' && (
                    <div className="admin-subtasks" aria-label="Analyze Views">
                      <button
                        className={`admin-subtask-item ${area === 'analyze' ? 'is-active' : ''}`}
                        onClick={() => setArea('analyze')}
                      >
                        Business Analysis
                      </button>
                    </div>
                  )}
                  {item.id === 'project-manage' && (
                    <div className="admin-subtasks" aria-label="Project Manage Tools">
                      {PROJECT_MANAGE_TASKS.map((task) => (
                        <button
                          key={task.id}
                          className={`admin-subtask-item ${area === 'project-manage' && projectManageTask === task.id ? 'is-active' : ''}`}
                          onClick={() => {
                            setArea('project-manage');
                            setProjectManageTask(task.id);
                          }}
                        >
                          {task.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {item.id === 'data-librarian' && (
                    <div className="admin-subtasks" aria-label="Data Librarian Views">
                      <button
                        className={`admin-subtask-item ${area === 'data-librarian' && dataLibrarianTask === 'data-shapes' ? 'is-active' : ''}`}
                        onClick={() => {
                          setArea('data-librarian');
                          setDataLibrarianTask('data-shapes');
                        }}
                      >
                        Data Shape Definition
                      </button>
                      <button
                        className={`admin-subtask-item ${area === 'data-librarian' && dataLibrarianTask === 'pascalish-editor' ? 'is-active' : ''}`}
                        onClick={() => {
                          setArea('data-librarian');
                          setDataLibrarianTask('pascalish-editor');
                        }}
                      >
                        Pascalish Editor
                      </button>
                    </div>
                  )}
                  {item.id === 'develop' && (
                    <div className="admin-subtasks" aria-label="Develop Files">
                      <button
                        className="admin-subtask-item"
                        onClick={() => {
                          setArea('develop');
                          setDevelopCreateRequest({ typeId: 'pascalish', name: 'pascalish-test.pas', nonce: Date.now() });
                        }}
                      >
                        New Pascalish Program
                      </button>
                      <button
                        className="admin-subtask-item"
                        onClick={() => {
                          setArea('develop');
                          setDevelopCreateRequest({ typeId: 'workflow', name: 'workflow-test.wfl', nonce: Date.now() });
                        }}
                      >
                        New WFL Program
                      </button>
                    </div>
                  )}
                  {item.id === 'network' && (
                    <div className="admin-subtasks" aria-label="Network Tools">
                      {NETWORK_TASKS.map((task) => (
                        <button
                          key={task.id}
                          className={`admin-subtask-item ${area === 'network' && networkTask === task.id ? 'is-active' : ''}`}
                          onClick={() => {
                            setArea('network');
                            setNetworkTask(task.id);
                          }}
                        >
                          {task.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
            {taskContextMenu.open && area === 'user-admin' && (
              <div
                className="task-context-menu"
                style={{ left: taskContextMenu.x, top: taskContextMenu.y }}
                onClick={event => event.stopPropagation()}
              >
                {USER_ADMIN_ACTIONS.map(action => (
                  <button
                    key={action}
                    className={`task-context-action ${userAdminAction === action ? 'is-active' : ''}`}
                    onClick={() => applyUserAdminAction(action)}
                  >
                    {action[0].toUpperCase() + action.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>

      <main className="main-pane">
        {area === 'operations' && (
          <>
            <section
              className={`login-mini-dashboard theme-${resolvedWindowStyle} lang-${languageKey}`}
            >
              <div className="login-mini-dashboard-head">
                <h2>{copy.title}</h2>
                <p>{copy.subtitle}</p>
              </div>

              <div className="login-mini-sections">
                <section className="login-mini-section">
                  <header>
                    <h3>Runnable FSMs</h3>
                    <span className="login-mini-toggle">{availableRunnableFsms.length}</span>
                  </header>
                  <div className="login-mini-grid">
                    {availableRunnableFsms.length === 0 ? (
                      <div className="login-mini-empty">No runnable FSMs are currently available.</div>
                    ) : availableRunnableFsms.map((fsm) => {
                      const currentState = String(fsm?.state || 'idle');
                      return (
                        <article
                          key={String(fsm.id)}
                          className="login-mini-card is-workflow"
                          onClick={() => openFsmRunner(fsm.id)}
                          onContextMenu={(event) => openCardContextMenu(event, 'fsm', fsm)}
                          title="Open FSM runner"
                        >
                          <div className="login-mini-badge">FSM</div>
                          <strong>{String(fsm.name || fsm.id || 'FSM')}</strong>
                          <div className="login-mini-row"><span>State</span><b>{currentState}</b></div>
                          <div className="login-mini-row"><span>Action</span><b>Run</b></div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              </div>
            </section>
          </>
        )}

        <section className="workspace-pane">
          {renderMainContent()}
        </section>
      </main>

      <div
        className={`pane-divider${isResizingSidebar ? ' is-active' : ''}`}
        role="separator"
        aria-label="Resize inspector sidebar"
        aria-orientation="vertical"
        tabIndex={0}
        onMouseDown={rhsCollapsed ? undefined : handleRhsResizeStart}
        onTouchStart={rhsCollapsed ? undefined : handleRhsResizeStart}
        onKeyDown={(event) => {
          if (rhsCollapsed) return;
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            nudgeRhsWidth(16);
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            nudgeRhsWidth(-16);
          }
        }}
      />

      <aside className="rhs-sidebar">
        <button
          className="sidebar-toggle rhs-toggle"
          type="button"
          onClick={() => setRhsCollapsed((prev) => !prev)}
          aria-expanded={!rhsCollapsed}
          aria-label={rhsCollapsed ? 'Expand right sidebar' : 'Collapse right sidebar'}
        >
          {rhsCollapsed ? '<<' : '>>'}
        </button>
        <div className="rhs-chat-wrap">
          <ChatPage
            onNavigateHome={() => {}}
            themeClassName={`window-style-${resolvedWindowStyle} accessibility-${resolvedContrastMode}`}
            screenContext={{ area, operationsTask, monitorClassId, actorUserId, language, overview, actor: authz.actor, roles: authz.profiles, permissions: authz.permissions }}
            askBoxActive={askBoxActive}
            onSetAskBoxActive={setAskBoxActive}
          />
        </div>
      </aside>

      {cardContextMenu.open && (
        <div
          className="card-context-menu"
          style={{ left: cardContextMenu.x, top: cardContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          {getCardContextActions(cardContextMenu.kind).map((entry) => (
            <button key={entry.action} type="button" onClick={() => handleCardContextAction(entry.action)}>{entry.label}</button>
          ))}
        </div>
      )}

      {cardPreview.open && (
        <div className="card-open-overlay" onClick={closeCardPreview}>
          <div
            className={`card-open-dialog${cardPreview.fullscreen ? ' is-fullscreen' : ''}${cardPreview.kind === 'fsm' && cardPreview.fullscreen ? ' is-fsm-themed' : ''}`}
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h3>{cardPreview.title}</h3>
              <div className="card-open-actions">
                {cardPreview.kind === 'fsm' ? (
                  <button type="button" className="card-open-close" onClick={toggleCardPreviewFullscreen}>
                    {cardPreview.fullscreen ? 'Windowed' : 'Full Screen'}
                  </button>
                ) : null}
                <button type="button" className="card-open-close" onClick={closeCardPreview}>Close</button>
              </div>
            </header>
            {!(cardPreview.kind === 'fsm' && cardPreview.fullscreen) ? (
              <ArtifactWorkbench artifacts={publicArtifacts} cardPreview={cardPreview} messageLayouts={messageLayouts} />
            ) : null}
            {cardPreview.kind === 'flow' || cardPreview.kind === 'workflow' || cardPreview.kind === 'fsm' ? (
              <>
                <p className="card-open-subtitle">
                  {cardPreview.kind === 'workflow'
                    ? 'Animated workflow diagram generated from the WFL source.'
                    : cardPreview.kind === 'fsm'
                      ? (cardPreview.mode === 'live'
                        ? (cardPreview.fullscreen
                          ? 'Dedicated full-screen live FSM Mermaid view with steampunk styling.'
                          : 'Live FSM Mermaid view. Active state pulses as status updates arrive.')
                        : 'FSM Mermaid snapshot. Use the context menu option for live animation while running.')
                    : 'Click a transition to view live queue metrics.'}
                </p>
                {flowDiagramSvg ? (
                  <div
                    className={`card-open-mermaid-diagram${(mermaidSseConnected || (cardPreview.kind === 'fsm' && cardPreview.mode === 'live')) ? ' is-sse-live' : ''}${cardPreview.kind === 'fsm' ? ' is-fsm-diagram' : ''}${cardPreview.kind === 'fsm' && cardPreview.fullscreen ? ' is-fsm-fullscreen' : ''}`}
                    style={{ '--mermaid-sse-phase': mermaidSsePhase }}
                    dangerouslySetInnerHTML={{ __html: flowDiagramSvg }}
                  />
                ) : (
                  <pre className="card-open-mermaid">{flowDiagramError || activeCardMermaidSource || TRANSACTION_FLOW_MERMAID_SOURCE}</pre>
                )}
                {cardPreview.kind === 'fsm' ? (
                  <div className="card-open-details" style={{ marginTop: 10 }}>
                    <div><span>State</span><strong>{String(fsmPreviewStatus?.state || cardPreview?.item?.state || 'IDLE')}</strong></div>
                    <div><span>Version</span><strong>{String(fsmPreviewStatus?.version || cardPreview?.item?.activeVersion || 'n/a')}</strong></div>
                    <div><span>Subflows</span><strong>{Array.isArray(fsmPreviewStatus?.subflows) ? fsmPreviewStatus.subflows.length : (Array.isArray(cardPreview?.item?.subflows) ? cardPreview.item.subflows.length : 0)}</strong></div>
                  </div>
                ) : null}
                {cardPreview.kind === 'flow' ? (
                  <>
                    <div className="card-open-transition-list">
                      {(cardPreview.item?.transitionMetrics || []).map((transition) => (
                        <button
                          key={transition.id}
                          type="button"
                          className={`card-open-transition-chip${selectedFlowTransitionId === transition.id ? ' is-active' : ''}`}
                          onClick={() => setSelectedFlowTransitionId(transition.id)}
                        >
                          {transition.label}
                        </button>
                      ))}
                    </div>
                    {(() => {
                      const selected = (cardPreview.item?.transitionMetrics || []).find((transition) => transition.id === selectedFlowTransitionId)
                        || (cardPreview.item?.transitionMetrics || [])[0]
                        || null;
                      if (!selected) return null;
                      return (
                        <div className="card-open-transition-panel">
                          <h4>{selected.label}</h4>
                          <div><span>Queue</span><strong>{selected.queueName}</strong></div>
                          <div><span>Messages Waiting</span><strong>{selected.waiting}</strong></div>
                          <div><span>Cumulative Count</span><strong>{selected.cumulative}</strong></div>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div className="card-open-details">
                    <div><span>Name</span><strong>{cardPreview.item?.name || 'N/A'}</strong></div>
                    <div><span>Steps</span><strong>{cardPreview.item?.stepCount ?? 0}</strong></div>
                    <div><span>Description</span><strong>{cardPreview.item?.description || 'Workflow diagram'}</strong></div>
                    <div><span>Kind</span><strong>{cardPreview.kind}</strong></div>
                  </div>
                )}
              </>
            ) : (
              <div className="card-open-details">
                <div><span>Name</span><strong>{cardPreview.item?.name || 'N/A'}</strong></div>
                <div><span>Status</span><strong>{cardPreview.item?.statusText || cardPreview.item?.status || 'unknown'}</strong></div>
                <div><span>Kind</span><strong>{cardPreview.kind}</strong></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
