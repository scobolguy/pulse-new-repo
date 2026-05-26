import './App.css';
import TopologyDashboard from './TopologyDashboard';
import QueueManagerDashboard from './QueueManagerDashboard';
import DataLibrarian from './DataLibrarian';
import DataMapper from './DataMapper';
import TransactionLifecycleDashboard from './TransactionLifecycleDashboard';
import SwiftGatewayDashboard from './SwiftGatewayDashboard';
import BocGatewayDashboard from './BocGatewayDashboard';
import UserManagementDashboard from './UserManagementDashboard';
import ProfileManagementDashboard from './ProfileManagementDashboard';
import UserInProfileDashboard from './UserInProfileDashboard';
import FlowTargetsDashboard from './FlowTargetsDashboard';
import ChatPage from './ChatPage';
import compiledWorkflowArtifacts from '../data/workflows.generated.json';
import React, { useEffect, useMemo, useState } from 'react';

const RHS_MIN_WIDTH = 220;
const RHS_MAX_WIDTH = 620;
const WINDOW_THEMES = ['standard', 'whimsical', 'eclipse', 'anime', 'steampunk', 'rube-goldberg', 'french-pointalist', 'mid-century-modern', 'group-of-seven-auto', 'group-of-seven-spring', 'group-of-seven-summer', 'group-of-seven-autumn', 'group-of-seven-winter'];
const THEME_PACK_LOADERS = {
  standard: () => import('./themes/packs/standard.css'),
  whimsical: () => import('./themes/packs/whimsical.css'),
  eclipse: () => import('./themes/packs/eclipse.css'),
  anime: () => import('./themes/packs/anime.css'),
  steampunk: () => import('./themes/packs/steampunk.css'),
  'rube-goldberg': () => import('./themes/packs/rube-goldberg.css'),
  'french-pointalist': () => import('./themes/packs/french-pointalist.css'),
  'mid-century-modern': () => import('./themes/packs/mid-century-modern.css'),
  'group-of-seven-auto': () => import('./themes/packs/group-of-seven.css'),
  'group-of-seven-spring': () => import('./themes/packs/group-of-seven.css'),
  'group-of-seven-summer': () => import('./themes/packs/group-of-seven.css'),
  'group-of-seven-autumn': () => import('./themes/packs/group-of-seven.css'),
  'group-of-seven-winter': () => import('./themes/packs/group-of-seven.css')
};

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
  { id: 'analyze', label: 'Analyze', permission: 'data.read', accent: '#ffb454' },
  { id: 'develop', label: 'Develop', permission: 'topology.read', accent: '#9b8cff' },
  { id: 'operations', label: 'Operations', permission: 'lifecycle.read', accent: '#f7768e' },
  { id: 'test', label: 'Test', permission: 'lifecycle.read', accent: '#8bd5ca' },
  { id: 'deploy', label: 'Deploy', permission: 'gateway.read', accent: '#7dcfff' },
];

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
  develop: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8.59 16.59 1.41 1.41L4.41 23 3 21.59Zm6.82 0L21 21.59 19.59 23 14 17.41ZM10 4l4 0v2h-4Zm-2.7 3.3 1.4-1.4 2.9 2.9-1.4 1.4Zm8.8-1.4 1.4 1.4-2.9 2.9-1.4-1.4ZM12 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"/></svg>
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
  { id: 'user-in-profile', label: 'User In Profile' }
];

const OPERATIONS_TASKS = [
  { id: 'monitor', label: 'Monitor' },
  { id: 'deploy', label: 'Deploy' },
  { id: 'manage', label: 'Manage' }
];

const USER_ADMIN_ACTIONS = ['add', 'delete', 'update'];
const LOGIN_SECTION_VISIBLE_LIMIT = 6;
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

function formatLatencyMs(value) {
  return Number.isFinite(value) ? `${Math.round(value)} ms` : 'No data';
}

function formatThroughputTps(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} tx/s` : 'No data';
}

function normalizeRuntimeStatus(value) {
  const status = String(value || '').toLowerCase();
  if (['up', 'online', 'running', 'active', 'ok'].includes(status)) return 'online';
  if (['quiesced', 'draining', 'maintenance', 'paused', 'idle'].includes(status)) return 'paused';
  return 'offline';
}

function getRuntimeStatusLabel(status) {
  if (status === 'online') return 'Running';
  if (status === 'paused') return 'Paused';
  return 'Offline';
}

function getFlowStatusLabel(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'ok') return 'On target';
  if (normalized === 'critical') return 'Breach';
  if (normalized === 'warning') return 'Warning';
  if (normalized === 'breach') return 'Breach';
  if (normalized === 'running') return 'Running';
  if (normalized === 'idle') return 'Idle';
  return 'No data';
}

function getLanguageKey(language) {
  const normalized = String(language || 'en-US').toLowerCase();
  if (normalized.startsWith('fr')) return 'fr';
  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('de')) return 'de';
  return 'en';
}

function countPmachineNodes(nodes = []) {
  if (!Array.isArray(nodes)) return 0;
  return nodes.filter((node) => {
    const details = node?.details || {};
    const hardware = String(details.hardware || '').toLowerCase();
    const serviceName = String(node?.serviceName || '').toLowerCase();
    const runtime = String(details.runtime || node?.runtime || '').toLowerCase();
    const deviceRole = String(details.deviceRole || node?.deviceRole || '').toLowerCase();
    const services = Array.isArray(details.services) ? details.services.map((service) => String(service).toLowerCase()) : [];
    return (
      hardware.includes('pmachine') ||
      hardware.includes('esp32') ||
      serviceName.includes('pmachine') ||
      serviceName.includes('esp32-node') ||
      runtime.includes('pmachine') ||
      runtime.includes('javascript') ||
      deviceRole.length > 0 ||
      services.some((service) => service.includes('pmachine'))
    );
  }).length;
}

function getThroughputHealth(actualTps, targetTps, runtimeStatus) {
  if (runtimeStatus !== 'running') return 'idle';
  if (!Number.isFinite(targetTps) || targetTps <= 0) return 'no-data';
  if (!Number.isFinite(actualTps)) return 'no-data';
  if (actualTps < targetTps) return 'breach';
  if (actualTps < targetTps * 1.1) return 'warning';
  return 'ok';
}

function getFlowBeltAnimationStyle(flow) {
  const throughputTps = Number(flow?.actualThroughputTps);
  const isRunning = flow?.runtimeStatus === 'running' && Number.isFinite(throughputTps) && throughputTps > 0;
  if (!isRunning) {
    return {
      '--rg-belt-duration': '2.6s',
      '--rg-belt-play-state': 'paused'
    };
  }

  const minDurationMs = 520;
  const maxDurationMs = 2300;
  const saturationTps = 180;
  const normalized = Math.max(0, Math.min(throughputTps / saturationTps, 1));
  const durationMs = Math.round(maxDurationMs - ((maxDurationMs - minDurationMs) * normalized));

  return {
    '--rg-belt-duration': `${durationMs}ms`,
    '--rg-belt-play-state': 'running'
  };
}

function buildSparklinePoints(values, width = 160, height = 42) {
  const points = Array.isArray(values) ? values.map((value) => Number(value || 0)) : [];
  if (points.length === 0) {
    return `0,${height / 2} ${width},${height / 2}`;
  }
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = Math.max(max - min, 1);
  return points.map((value, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - (((value - min) / range) * (height - 6)) - 3;
    return `${x},${y}`;
  }).join(' ');
}

function Sparkline({ values, label, tone = 'neutral' }) {
  const points = buildSparklinePoints(values);
  return (
    <div className={`home-sparkline home-sparkline--${tone}`}>
      <span>{label}</span>
      <svg viewBox="0 0 160 42" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={points} />
      </svg>
    </div>
  );
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

  const WORKFLOW_CARD_METADATA = {
    'enqueue-pacs': {
      name: 'Enqueue PACS',
      description: 'Submit a PACS message to the outbound queue.'
    },
    'pain2-routing': {
      name: 'Pain2 Routing',
      description: 'Route pain.001 payloads by status.'
    },
    'gradual-startup': {
      name: 'Gradual Startup',
      description: 'Stage backend startup with health gates.'
    }
  };

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
        lines.push(`  ${id}((\"${escapedLabel}\"))`);
        return;
      }
      if (shape === 'diamond') {
        lines.push(`  ${id}{\"${escapedLabel}\"}`);
        return;
      }
      lines.push(`  ${id}[\"${escapedLabel}\"]`);
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

    const orderedIds = [
      'enqueue-pacs',
      'pain2-routing',
      'gradual-startup',
      ...Array.from(workflowById.keys()).filter((workflowId) => !['enqueue-pacs', 'pain2-routing', 'gradual-startup'].includes(workflowId))
    ];

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

function App() {
  const [actorUserId, setActorUserId] = useState(localStorage.getItem('pulse.actorUserId') || 'system-admin');
  const [loginUserId, setLoginUserId] = useState(localStorage.getItem('pulse.actorUserId') || 'system-admin');
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
  const [userAdminTask, setUserAdminTask] = useState('user');
  const [userAdminAction, setUserAdminAction] = useState('update');
  const [taskContextMenu, setTaskContextMenu] = useState({ open: false, x: 0, y: 0, taskId: null });
  const [workflowCards, setWorkflowCards] = useState(DEFAULT_WORKFLOW_CARDS);
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
  const [pmachineNodeCount, setPmachineNodeCount] = useState(0);
  const [rhsWidth, setRhsWidth] = useState(() => {
    const saved = Number(localStorage.getItem('pulse.rhsWidth'));
    if (Number.isFinite(saved)) {
      return Math.max(RHS_MIN_WIDTH, Math.min(RHS_MAX_WIDTH, saved));
    }
    return 320;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [askBoxActive, setAskBoxActive] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState({ flows: false, services: false, servers: false });
  const [expandedSections, setExpandedSections] = useState({ flows: false, services: false, servers: false });
  const [cardContextMenu, setCardContextMenu] = useState({ open: false, x: 0, y: 0, kind: null, item: null });
  const [cardHiddenMap, setCardHiddenMap] = useState({});
  const [cardRenameMap, setCardRenameMap] = useState({});
  const [cardRuntimeMap, setCardRuntimeMap] = useState({});
  const [cardPreview, setCardPreview] = useState({ open: false, kind: null, title: '', item: null });
  const [flowDiagramSvg, setFlowDiagramSvg] = useState('');
  const [flowDiagramError, setFlowDiagramError] = useState('');
  const [mermaidSsePhase, setMermaidSsePhase] = useState(0);
  const [mermaidSseConnected, setMermaidSseConnected] = useState(false);
  const [selectedFlowTransitionId, setSelectedFlowTransitionId] = useState(null);
  const flowSnapshotRef = React.useRef({});
  const deepLinkHandledRef = React.useRef(false);
  const resolvedWindowStyle = useMemo(() => resolveThemeId(windowStyle), [windowStyle]);

  function toggleSection(sectionId) {
    setCollapsedSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  }

  function toggleSectionExpansion(sectionId) {
    setExpandedSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
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

  function findCardByDeepLink(kind, id) {
    const normalizedKind = String(kind || '').toLowerCase();
    const normalizedId = String(id || '').toLowerCase();
    if (!normalizedKind || !normalizedId) return null;

    if (normalizedKind === 'flow') {
      const runtimeFlow = overview.flows.find((item) => String(item?.id || item?.name || '').toLowerCase() === normalizedId);
      if (runtimeFlow) return runtimeFlow;

      const definition = FLOW_DEFINITIONS.find((item) => {
        const idMatch = String(item?.id || '').toLowerCase() === normalizedId;
        const nameMatch = String(item?.name || '').toLowerCase() === normalizedId;
        return idMatch || nameMatch;
      });
      if (!definition) return null;

      return {
        id: definition.id,
        name: definition.name,
        runtimeStatus: 'idle',
        throughputStatus: 'no-data',
        policyStatus: 'no-data',
        transactionCount: 0,
        transitionMetrics: Array.isArray(definition.transitionMetrics) ? definition.transitionMetrics : []
      };
    }
    if (normalizedKind === 'service') {
      return overview.services.find((item) => String(item?.id || item?.name || '').toLowerCase() === normalizedId) || null;
    }
    if (normalizedKind === 'server') {
      return overview.servers.find((item) => String(item?.id || item?.name || '').toLowerCase() === normalizedId) || null;
    }
    if (normalizedKind === 'workflow') {
      return workflowCards.find((item) => String(item?.id || item?.name || '').toLowerCase() === normalizedId) || null;
    }
    return null;
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
      openCardPreview(kind, item);
      return;
    }

    if (action === 'copy-id') {
      await copyTextToClipboard(String(item?.id || item?.name || ''));
      closeCardContextMenu();
      return;
    }

    if (action === 'copy-mermaid') {
      await copyTextToClipboard(String(item?.mermaidSource || activeFlowMermaidSource || ''));
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

  function openCardPreview(kind, item) {
    const title = kind === 'flow'
      ? `Flow: ${item?.name || item?.id || 'Flow'}`
      : kind === 'workflow'
        ? `Workflow: ${item?.name || item?.id || 'Workflow'}`
        : `${kind === 'service' ? 'Service' : 'Server'}: ${item?.name || item?.id || 'Item'}`;
    setCardPreview({ open: true, kind, title, item: item || null });
    if (kind === 'flow') {
      const firstTransition = Array.isArray(item?.transitionMetrics) ? item.transitionMetrics[0] : null;
      setSelectedFlowTransitionId(firstTransition?.id || null);
    } else {
      setSelectedFlowTransitionId(null);
    }
    closeCardContextMenu();
  }

  function closeCardPreview() {
    setCardPreview({ open: false, kind: null, title: '', item: null });
    setFlowDiagramSvg('');
    setFlowDiagramError('');
    setSelectedFlowTransitionId(null);
  }

  const activeFlowMermaidSource = useMemo(() => {
    if (!(cardPreview.open && (cardPreview.kind === 'flow' || cardPreview.kind === 'workflow'))) return '';
    if (cardPreview.kind === 'workflow') {
      return cardPreview.item?.mermaidSource || '';
    }
    const definition = resolveFlowDefinition(cardPreview.item);
    return definition?.mermaidSource || TRANSACTION_FLOW_MERMAID_SOURCE;
  }, [cardPreview.open, cardPreview.kind, cardPreview.item]);

  useEffect(() => {
    if (!(cardPreview.open && (cardPreview.kind === 'flow' || cardPreview.kind === 'workflow'))) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'dark'
        });
        const primarySource = activeFlowMermaidSource || TRANSACTION_FLOW_MERMAID_SOURCE;
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
        } catch (e) {
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
  }, [cardPreview.open, cardPreview.kind, activeFlowMermaidSource]);

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

    const item = findCardByDeepLink(kind, id);
    if (!item) return;

    deepLinkHandledRef.current = true;
    openCardPreview(kind, item);
  }, [overview.flows, overview.services, overview.servers]);

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

  function handleLogin() {
    const nextUserId = String(loginUserId || '').trim();
    if (!nextUserId) return;
    setActorUserId(nextUserId);
    setAuthzError('');
  }

  function handleLogout() {
    setActorUserId('anonymous');
    setLoginUserId('');
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
    let cancelled = false;

    async function refreshPmachineNodeCount() {
      try {
        const res = await fetch('/api/nodes');
        const nodes = await res.json().catch(() => []);
        if (cancelled) return;
        setPmachineNodeCount(countPmachineNodes(nodes));
      } catch {
        if (!cancelled) setPmachineNodeCount(0);
      }
    }

    refreshPmachineNodeCount();
    const interval = setInterval(refreshPmachineNodeCount, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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
    if (permissions.length > 0) return permissions;
    if (String(actorUserId || '').toLowerCase() === 'system-admin') return ['*'];
    return permissions;
  }, [authz.permissions, actorUserId]);

  const visibleAreas = useMemo(
    () => AREAS.filter(item => hasPermission(effectivePermissions, item.permission)),
    [effectivePermissions]
  );

  useEffect(() => {
    if (visibleAreas.length === 0) return;
    if (!visibleAreas.some(item => item.id === area)) {
      setArea(visibleAreas[0].id);
    }
  }, [area, visibleAreas]);

  useEffect(() => {
    if (!(cardPreview.open && (cardPreview.kind === 'flow' || cardPreview.kind === 'workflow'))) {
      setMermaidSseConnected(false);
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
  }, [monitorClassId, pathname]);

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
  const gatewayOnlineCount = Number(Boolean(overview.gateways.swift)) + Number(Boolean(overview.gateways.boc)) + Number(Boolean(overview.gateways.fed));
  const gatewayTotal = 3;
  const visibleFlows = overview.flows
    .filter((item) => !cardHiddenMap[getCardKey('flow', item)])
    .map((flow) => {
      const action = String(cardRuntimeMap[getCardKey('flow', flow)] || '').toLowerCase();
      if (!action) return flow;
      const runtimeStatus = (action === 'start' || action === 'start up')
        ? 'running'
        : action === 'quiesce'
          ? 'idle'
          : 'idle';
      return {
        ...flow,
        runtimeStatus,
        throughputStatus: runtimeStatus === 'running' ? (flow.throughputStatus === 'no-data' ? 'warning' : flow.throughputStatus) : 'idle'
      };
    });
  const visibleServices = overview.services
    .filter((item) => !cardHiddenMap[getCardKey('service', item)])
    .map((service) => {
      const action = String(cardRuntimeMap[getCardKey('service', service)] || '').toLowerCase();
      if (!action) return service;
      const status = (action === 'start' || action === 'start up')
        ? 'online'
        : action === 'quiesce'
          ? 'paused'
          : 'offline';
      return {
        ...service,
        status,
        state: status
      };
    });
  const visibleServers = overview.servers.filter((item) => !cardHiddenMap[getCardKey('server', item)]);
  const serverRunningCount = visibleServers.filter((item) => item.status === 'online').length;
  const activeFlowCount = visibleFlows.filter((item) => item.runtimeStatus === 'running').length;
  const serviceRunningCount = visibleServices.filter((item) => item.status === 'online').length;
  const languageKey = getLanguageKey(language);
  const copy = LANGUAGE_COPY[languageKey] || LANGUAGE_COPY.en;

  const activeUserAdminTask = USER_ADMIN_TASKS.find(task => task.id === userAdminTask) || USER_ADMIN_TASKS[0];
  const activeOperationsTask = OPERATIONS_TASKS.find(task => task.id === operationsTask) || OPERATIONS_TASKS[0];
  const activeMonitorClass = monitorClasses.find(item => item.classId === monitorClassId) || null;

  function renderMonitorContent(classId) {
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
    if (area === 'analyze') return <DataLibrarian />;
    if (area === 'develop') return <TopologyDashboard permissions={authz.permissions || []} />;
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
      return <UserInProfileDashboard actorPermissions={effectivePermissions} />;
    }

    return (
      <div className="area-empty">
        <h3>Project Manage</h3>
        <p>This area shell is ready. We can define cards, workflows, and role views next.</p>
      </div>
    );
  };

  if (pathname === '/chat') {
    return (
      <ChatPage
        onNavigateHome={() => navigateTo('/')}
        screenContext={{ area, operationsTask, monitorClassId, actorUserId, language, overview, actor: authz.actor, roles: authz.profiles, permissions: authz.permissions }}
        askBoxActive={askBoxActive}
        onSetAskBoxActive={setAskBoxActive}
      />
    );
  }

  return (
    <div
      className={`app-shell window-style-${resolvedWindowStyle}${isResizingSidebar ? ' is-resizing' : ''}${lhsCollapsed ? ' lhs-collapsed' : ''}${rhsCollapsed ? ' rhs-collapsed' : ''}${askBoxActive ? ' ask-box-active' : ''}`}
      style={{
        '--lhs-width': lhsCollapsed ? '56px' : 'clamp(190px, 16vw, 300px)',
        '--rhs-width': rhsCollapsed ? '56px' : `${rhsWidth}px`,
        '--divider-width': rhsCollapsed ? '0px' : '8px'
      }}
    >
      <header className="utility-top-bar">
        <div className="utility-status">
          <span className="utility-chip"><strong>User:</strong> {authz.actor?.userId || actorUserId || 'guest'}</span>
          <span className="utility-chip"><strong>Language:</strong> {LANGUAGE_OPTIONS.find(item => item.value === language)?.label || language}</span>
          <span className="utility-chip"><strong>Style:</strong> {getThemeDisplayLabel(resolvedWindowStyle)}</span>
        </div>
        <div className="utility-actions">
          <button className="utility-button" type="button" onClick={() => navigateTo('/chat')}>Chat</button>
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
            placeholder="user id"
            aria-label="User ID"
          />
          <button className="utility-button" type="button" onClick={handleLogin}>Login</button>
          <button className="utility-button utility-button--warn" type="button" onClick={handleLogout}>Logout</button>
        </div>
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
                          <button
                            className={`admin-subtask-item ${area === 'develop' ? 'is-active' : ''}`}
                            onClick={() => setArea('develop')}
                          >
                            Network Topology
                          </button>
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
        {area !== 'user-admin' && (
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
                    <h3>{copy.pmachineTopology}</h3>
                    <span className="login-mini-toggle">{pmachineNodeCount} {copy.pmachineCountLabel}</span>
                  </header>
                  <div className="login-mini-grid">
                    <article
                      className="login-mini-card is-workflow"
                      onClick={() => setArea('develop')}
                      title={copy.openTopology}
                    >
                      <div className="login-mini-badge">{pmachineNodeCount}</div>
                      <strong>{copy.openTopology}</strong>
                      <div className="login-mini-row"><span>Type</span><b>Network</b></div>
                      <div className="login-mini-row"><span>Area</span><b>Develop</b></div>
                    </article>
                  </div>
                </section>

                <section className="login-mini-section">
                  <header>
                    <h3>{copy.flows}</h3>
                    <div className="login-mini-header-actions">
                      <span className="login-mini-toggle">{activeFlowCount}/{visibleFlows.length}</span>
                      {!collapsedSections.flows && visibleFlows.length > LOGIN_SECTION_VISIBLE_LIMIT && (
                        <button
                          type="button"
                          className="login-mini-toggle"
                          onClick={() => toggleSectionExpansion('flows')}
                        >
                          {expandedSections.flows
                            ? copy.showLess
                            : `${copy.showAll} (${visibleFlows.length - LOGIN_SECTION_VISIBLE_LIMIT})`}
                        </button>
                      )}
                    </div>
                  </header>
                  <div className={`login-mini-grid${collapsedSections.flows ? ' is-collapsed' : ''}`}>
                    {(expandedSections.flows ? visibleFlows : visibleFlows.slice(0, LOGIN_SECTION_VISIBLE_LIMIT)).length === 0 ? <div className="login-mini-empty">{copy.noItems}</div> : (expandedSections.flows ? visibleFlows : visibleFlows.slice(0, LOGIN_SECTION_VISIBLE_LIMIT)).map((flow) => {
                      const runningWell = flow.runtimeStatus === 'running' && !['breach', 'critical'].includes(flow.throughputStatus) && !['critical'].includes(flow.policyStatus);
                      const currentState = flow.runtimeStatus === 'idle' ? copy.stateIdle : getFlowStatusLabel(flow.throughputStatus);
                      return (
                        <article
                          key={flow.id}
                          className={`login-mini-card is-${flow.throughputStatus}`}
                          style={getFlowBeltAnimationStyle(flow)}
                          onContextMenu={(event) => openCardContextMenu(event, 'flow', flow)}
                          title="Right click for actions"
                        >
                          <div className="login-mini-badge">{flow.transactionCount}</div>
                          <strong>{getCardDisplayName('flow', flow, flow.name)}</strong>
                          <div className="login-mini-row"><span>{copy.runningWell}</span><b>{runningWell ? copy.yes : copy.no}</b></div>
                          <div className="login-mini-row"><span>{copy.currentState}</span><b>{currentState}</b></div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="login-mini-section">
                  <header>
                    <h3>{copy.services}</h3>
                    <div className="login-mini-header-actions">
                      <span className="login-mini-toggle">{serviceRunningCount}/{visibleServices.length}</span>
                      {!collapsedSections.services && visibleServices.length > LOGIN_SECTION_VISIBLE_LIMIT && (
                        <button
                          type="button"
                          className="login-mini-toggle"
                          onClick={() => toggleSectionExpansion('services')}
                        >
                          {expandedSections.services
                            ? copy.showLess
                            : `${copy.showAll} (${visibleServices.length - LOGIN_SECTION_VISIBLE_LIMIT})`}
                        </button>
                      )}
                    </div>
                  </header>
                  <div className={`login-mini-grid${collapsedSections.services ? ' is-collapsed' : ''}`}>
                    {(expandedSections.services ? visibleServices : visibleServices.slice(0, LOGIN_SECTION_VISIBLE_LIMIT)).length === 0 ? <div className="login-mini-empty">{copy.noItems}</div> : (expandedSections.services ? visibleServices : visibleServices.slice(0, LOGIN_SECTION_VISIBLE_LIMIT)).map((service) => {
                      const runningWell = service.status === 'online';
                      const currentState = service.status === 'online' ? copy.stateRunning : service.status === 'paused' ? copy.statePaused : copy.stateOffline;
                      return (
                        <article
                          key={service.id}
                          className={`login-mini-card is-${service.status}`}
                          onContextMenu={(event) => openCardContextMenu(event, 'service', service)}
                          title="Right click for actions"
                        >
                          <strong>{getCardDisplayName('service', service, service.name)}</strong>
                          <div className="login-mini-row"><span>{copy.runningWell}</span><b>{runningWell ? copy.yes : copy.no}</b></div>
                          <div className="login-mini-row"><span>{copy.currentState}</span><b>{currentState}</b></div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="login-mini-section">
                  <header>
                    <h3>{copy.servers}</h3>
                    <div className="login-mini-header-actions">
                      <span className="login-mini-toggle">{serverRunningCount}/{visibleServers.length}</span>
                      {!collapsedSections.servers && visibleServers.length > LOGIN_SECTION_VISIBLE_LIMIT && (
                        <button
                          type="button"
                          className="login-mini-toggle"
                          onClick={() => toggleSectionExpansion('servers')}
                        >
                          {expandedSections.servers
                            ? copy.showLess
                            : `${copy.showAll} (${visibleServers.length - LOGIN_SECTION_VISIBLE_LIMIT})`}
                        </button>
                      )}
                    </div>
                  </header>
                  <div className={`login-mini-grid${collapsedSections.servers ? ' is-collapsed' : ''}`}>
                    {(expandedSections.servers ? visibleServers : visibleServers.slice(0, LOGIN_SECTION_VISIBLE_LIMIT)).length === 0 ? <div className="login-mini-empty">{copy.noItems}</div> : (expandedSections.servers ? visibleServers : visibleServers.slice(0, LOGIN_SECTION_VISIBLE_LIMIT)).map((server) => {
                      const runningWell = server.status === 'online';
                      const currentState = server.status === 'online' ? copy.stateRunning : server.status === 'paused' ? copy.statePaused : copy.stateOffline;
                      return (
                        <article
                          key={server.id}
                          className={`login-mini-card is-${server.status}`}
                          onContextMenu={(event) => openCardContextMenu(event, 'server', server)}
                          title="Right click for actions"
                        >
                          <strong>{getCardDisplayName('server', server, server.name)}</strong>
                          <div className="login-mini-row"><span>{copy.runningWell}</span><b>{runningWell ? copy.yes : copy.no}</b></div>
                          <div className="login-mini-row"><span>{copy.currentState}</span><b>{currentState}</b></div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="login-mini-section">
                  <header>
                    <h3>{copy.tasks}</h3>
                    <span className="login-mini-toggle">{workflowCards.length}</span>
                  </header>
                  <div className="login-mini-grid">
                    {workflowCards.length === 0 ? <div className="login-mini-empty">{copy.noItems}</div> : workflowCards.map((workflow) => {
                      const stepLabel = `${workflow.stepCount || 0} steps`;
                      return (
                        <article
                          key={workflow.id}
                          className="login-mini-card is-workflow"
                          onClick={() => openCardPreview('workflow', workflow)}
                          onContextMenu={(event) => openCardContextMenu(event, 'workflow', workflow)}
                          title="Open workflow diagram"
                        >
                          <div className="login-mini-badge">{workflow.stepCount || 0}</div>
                          <strong>{getCardDisplayName('workflow', workflow, workflow.name)}</strong>
                          <div className="login-mini-row"><span>Type</span><b>Workflow</b></div>
                          <div className="login-mini-row"><span>Steps</span><b>{stepLabel}</b></div>
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
          <button type="button" onClick={() => handleCardContextAction('open')}>Open</button>
          <button type="button" onClick={() => handleCardContextAction('open-new-window')}>Open in New Window</button>
          <button type="button" onClick={() => handleCardContextAction('delete')}>Delete</button>
          <button type="button" onClick={() => handleCardContextAction('rename')}>Rename</button>
          <button type="button" onClick={() => handleCardContextAction('start')}>Start</button>
          <button type="button" onClick={() => handleCardContextAction('stop')}>Stop</button>
          <button type="button" onClick={() => handleCardContextAction('quiesce')}>Quiesce</button>
          <button type="button" onClick={() => handleCardContextAction('start up')}>Start Up</button>
        </div>
      )}

      {cardPreview.open && (
        <div className="card-open-overlay" onClick={closeCardPreview}>
          <div className="card-open-dialog" onClick={(event) => event.stopPropagation()}>
            <header>
              <h3>{cardPreview.title}</h3>
              <button type="button" className="card-open-close" onClick={closeCardPreview}>Close</button>
            </header>
            {cardPreview.kind === 'flow' || cardPreview.kind === 'workflow' ? (
              <>
                <p className="card-open-subtitle">
                  {cardPreview.kind === 'workflow'
                    ? 'Animated workflow diagram generated from the WFL source.'
                    : 'Click a transition to view live queue metrics.'}
                </p>
                {flowDiagramSvg ? (
                  <div
                    className={`card-open-mermaid-diagram${mermaidSseConnected ? ' is-sse-live' : ''}`}
                    style={{ '--mermaid-sse-phase': mermaidSsePhase }}
                    dangerouslySetInnerHTML={{ __html: flowDiagramSvg }}
                  />
                ) : (
                  <pre className="card-open-mermaid">{flowDiagramError || activeFlowMermaidSource || TRANSACTION_FLOW_MERMAID_SOURCE}</pre>
                )}
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
