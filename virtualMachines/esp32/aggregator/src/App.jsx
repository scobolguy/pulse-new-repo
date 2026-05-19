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
    runningWell: 'Fonctionne bien',
    currentState: 'Etat actuel',
    yes: 'Oui',
    no: 'Non',
    noItems: 'Aucun element disponible.',
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
    runningWell: 'Funciona bien',
    currentState: 'Estado actual',
    yes: 'Si',
    no: 'No',
    noItems: 'No hay elementos disponibles.',
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
    runningWell: 'Laeuft gut',
    currentState: 'Aktueller Status',
    yes: 'Ja',
    no: 'Nein',
    noItems: 'Keine Elemente verfuegbar.',
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

function App() {
  const [actorUserId, setActorUserId] = useState(localStorage.getItem('pulse.actorUserId') || 'system-admin');
  const [loginUserId, setLoginUserId] = useState(localStorage.getItem('pulse.actorUserId') || 'system-admin');
  const [language, setLanguage] = useState(localStorage.getItem('pulse.language') || 'en-US');
  const [windowStyle, setWindowStyle] = useState(() => {
    const stored = localStorage.getItem('pulse.windowStyle') || 'group-of-seven-auto';
    return WINDOW_THEMES.includes(stored) ? stored : 'group-of-seven-auto';
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
  const [collapsedSections, setCollapsedSections] = useState({ flows: false, services: false, servers: false });
  const flowSnapshotRef = React.useRef({});
  const resolvedWindowStyle = useMemo(() => resolveThemeId(windowStyle), [windowStyle]);

  function toggleSection(sectionId) {
    setCollapsedSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  }

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
        const res = await fetch('/api/authz/me');
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

  const visibleAreas = useMemo(
    () => AREAS.filter(item => hasPermission(authz.permissions, item.permission)),
    [authz.permissions]
  );

  useEffect(() => {
    if (visibleAreas.length === 0) return;
    if (!visibleAreas.some(item => item.id === area)) {
      setArea(visibleAreas[0].id);
    }
  }, [area, visibleAreas]);

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
    const loadOverview = async () => {
      try {
        const readPayload = async (result) => {
          if (result.status !== 'fulfilled') return null;
          const response = result.value;
          return response.json().catch(() => null);
        };

        const [wRes, gRes, mRes, dRes, dbRes, qmRes, bRes, sRes] = await Promise.allSettled([
          fetch('/api/lifecycle/workers', { headers: { 'x-user-id': actorUserId } }),
          fetch('/api/gateways', { headers: { 'x-user-id': actorUserId } }),
          fetch('/api/metrics/current', { headers: { 'x-user-id': actorUserId } }),
          fetch('/api/lifecycle/dashboard', { headers: { 'x-user-id': actorUserId } }),
          fetch('/api/registry/databases', { headers: { 'x-user-id': actorUserId } }),
          fetch('/api/registry/queue-managers', { headers: { 'x-user-id': actorUserId } }),
          fetch('/api/broker/state', { headers: { 'x-user-id': actorUserId } }),
          fetch('/api/registry/services', { headers: { 'x-user-id': actorUserId } }),
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

        const flowRows = Object.entries(latencyTargets).map(([flowId, target]) => {
          const evaluation = latencyEvaluations[flowId] || {};
          const sourceQueues = Array.isArray(target?.queues)
            ? target.queues
            : Array.isArray(evaluation?.sourceQueues)
              ? evaluation.sourceQueues
              : [];
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
          };
        });

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
      } catch {
        if (cancelled) return;
      }
    };

    loadOverview();
    const timer = setInterval(loadOverview, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [actorUserId, pathname, askBoxActive]);

  const activeArea = visibleAreas.find((item) => item.id === area) || null;
  const gatewayOnlineCount = Number(Boolean(overview.gateways.swift)) + Number(Boolean(overview.gateways.boc)) + Number(Boolean(overview.gateways.fed));
  const gatewayTotal = 3;
  const serverRunningCount = overview.servers.filter((item) => item.status === 'online').length;
  const activeFlowCount = overview.flows.filter((item) => item.runtimeStatus === 'running').length;
  const serviceRunningCount = overview.services.filter((item) => item.status === 'online').length;
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
            <QueueManagerDashboard />
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
        return <UserManagementDashboard />;
      }
      if (userAdminTask === 'profile') {
        return <ProfileManagementDashboard />;
      }
      return <UserInProfileDashboard />;
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
            <section className={`login-mini-dashboard theme-${resolvedWindowStyle} lang-${languageKey}`}>
              <div className="login-mini-dashboard-head">
                <h2>{copy.title}</h2>
                <p>{copy.subtitle}</p>
              </div>

              <div className="login-mini-sections">
                <section className="login-mini-section">
                  <header>
                    <h3>{copy.flows}</h3>
                    <span className="login-mini-toggle">{activeFlowCount}/{overview.flows.length}</span>
                  </header>
                  <div className={`login-mini-grid${collapsedSections.flows ? ' is-collapsed' : ''}`}>
                    {overview.flows.length === 0 ? <div className="login-mini-empty">{copy.noItems}</div> : overview.flows.map((flow) => {
                      const runningWell = flow.runtimeStatus === 'running' && !['breach', 'critical'].includes(flow.throughputStatus) && !['critical'].includes(flow.policyStatus);
                      const currentState = flow.runtimeStatus === 'idle' ? copy.stateIdle : getFlowStatusLabel(flow.throughputStatus);
                      return (
                        <article key={flow.id} className={`login-mini-card is-${flow.throughputStatus}`} style={getFlowBeltAnimationStyle(flow)}>
                          <div className="login-mini-badge">{flow.transactionCount}</div>
                          <strong>{flow.name}</strong>
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
                    <span className="login-mini-toggle">{serviceRunningCount}/{overview.services.length}</span>
                  </header>
                  <div className={`login-mini-grid${collapsedSections.services ? ' is-collapsed' : ''}`}>
                    {overview.services.length === 0 ? <div className="login-mini-empty">{copy.noItems}</div> : overview.services.map((service) => {
                      const runningWell = service.status === 'online';
                      const currentState = service.status === 'online' ? copy.stateRunning : service.status === 'paused' ? copy.statePaused : copy.stateOffline;
                      return (
                        <article key={service.id} className={`login-mini-card is-${service.status}`}>
                          <strong>{service.name}</strong>
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
                    <span className="login-mini-toggle">{serverRunningCount}/{overview.servers.length}</span>
                  </header>
                  <div className={`login-mini-grid${collapsedSections.servers ? ' is-collapsed' : ''}`}>
                    {overview.servers.length === 0 ? <div className="login-mini-empty">{copy.noItems}</div> : overview.servers.map((server) => {
                      const runningWell = server.status === 'online';
                      const currentState = server.status === 'online' ? copy.stateRunning : server.status === 'paused' ? copy.statePaused : copy.stateOffline;
                      return (
                        <article key={server.id} className={`login-mini-card is-${server.status}`}>
                          <strong>{server.name}</strong>
                          <div className="login-mini-row"><span>{copy.runningWell}</span><b>{runningWell ? copy.yes : copy.no}</b></div>
                          <div className="login-mini-row"><span>{copy.currentState}</span><b>{currentState}</b></div>
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
    </div>
  );
}

export default App;
