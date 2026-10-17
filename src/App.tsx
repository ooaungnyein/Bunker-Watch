/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp,
  ChevronDown,
  RotateCcw,
  X, 
  Plus, 
  Trash2, 
  Droplets, 
  Clock, 
  Zap, 
  Settings2,
  Anchor,
  Fuel,
  LayoutDashboard,
  BarChart3,
  FileText,
  Thermometer,
  Cpu,
  Flame,
  Compass,
  Wifi,
  Edit2,
  Save,
  Sun,
  Moon,
  Check,
  Activity,
  Calendar,
  Navigation,
  Flag,
  XCircle,
  Ship,
  Layout,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  WifiOff,
  Copy,
  CheckCheck,
  Share2,
  ClipboardList,
  PenTool
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
// Background P2P Sync Logic
// This runs on every device and automatically finds/merges data from peers on the same Wi-Fi

// --- Types ---

type FuelType = {
  id: string;
  type: string;
  consumption: string;
  capacity: string;
  rob: string;
  initialRob: string;
  lastModified: number;
};

type OilType = {
  id: string;
  name: string;
  consumption: string;
  threshold: string;
  capacity: string;
  rob: string;
  initialRob: string;
  lastModified: number;
};

type MachineryItem = {
  id: string;
  name: string;
  desc: string;
  icon: 'me' | 'ge' | 'blr' | 'other';
  usedOils: string[]; // oilType IDs
  lastModified: number;
};

type ConsumptionLog = {
  id: string;
  timestamp: string;
  machineryName: string;
  type: string;
  value: string;
  unit: string;
  hoursRun?: string;
  situation?: string;
  fuelRobSnapshot?: Record<string, string>; // fuelTypeId -> value
  oilRobSnapshot?: Record<string, string>; // oilTypeId -> value
  lastModified: number;
};

type BunkerLog = {
  id: string;
  timestamp: string;
  type: string; // fuelTypeId or oilTypeId
  value: string;
  unit: string;
  port: string;
  lastModified: number;
};

type OnboardingData = {
  vesselName: string;
  imoNumber: string;
  department: 'deck' | 'engine' | null;
  machinery: MachineryItem[];
  fuelTypes: FuelType[];
  oilTypes: OilType[];
  calculationMethod: 'flowmeter' | 'time' | null;
  fuelConsumptionData: Record<string, Record<string, string>>; // machineryId -> fuelTypeId -> value
  oilConsumptionData: Record<string, Record<string, string>>; // machineryId -> oilTypeId -> value
  machineryHours: Record<string, string>; // machineryId -> hours
  consumptionLogs: ConsumptionLog[];
  bunkerLogs: BunkerLog[];
  onboardingCompleted: boolean;
  voyageStatus: {
    date: string;
    time: string;
    situation: string;
    voyageNumber: string;
    portOfDeparture: string;
    destinationPort?: string;
    voyageStage?: string;
    etaDate?: string;
    etaTime?: string;
    distanceToGo?: string;
    totalDistance?: string;
    condition?: string;
    remarks?: string;
  };
  dashboardCards: {
    id: string;
    type: string;
    title: string;
    visible: boolean;
  }[];
  lastModified: number;
};

// --- Default Data ---

const defaultFuelTypesList: FuelType[] = [
  { id: 'vlsfo', type: 'VLSFO', consumption: '24.5', capacity: '1200', rob: '840.5', initialRob: '850.0', lastModified: Date.now() },
  { id: 'lsmgo', type: 'LSMGO', consumption: '3.2', capacity: '350', rob: '165.2', initialRob: '170.0', lastModified: Date.now() }
];

const defaultData: OnboardingData = {
  vesselName: '',
  imoNumber: '',
  department: null,
  machinery: [
    { id: 'me', name: 'Main Engine (ME)', desc: 'Primary propulsion system unit', icon: 'me', usedOils: ['me-sys', 'me-cyl'], lastModified: Date.now() },
    { id: 'ge', name: 'Generator Engine (GE)', desc: 'Auxiliary power generation units', icon: 'ge', usedOils: ['ge-sys'], lastModified: Date.now() },
    { id: 'blr', name: 'Boiler (BLR)', desc: 'Steam generation system', icon: 'blr', usedOils: [], lastModified: Date.now() }
  ],
  fuelTypes: defaultFuelTypesList,
  oilTypes: [
    { id: 'me-sys', name: 'ME SYS', consumption: '35', threshold: '500', capacity: '12000', rob: '4850', initialRob: '5000', lastModified: Date.now() },
    { id: 'me-cyl', name: 'ME CYL', consumption: '120', threshold: '1000', capacity: '25000', rob: '14200', initialRob: '15000', lastModified: Date.now() },
    { id: 'ge-sys', name: 'GE SYS', consumption: '20', threshold: '300', capacity: '8000', rob: '3150', initialRob: '3300', lastModified: Date.now() }
  ],
  calculationMethod: 'flowmeter',
  fuelConsumptionData: {},
  oilConsumptionData: {},
  machineryHours: {},
  consumptionLogs: [],
  bunkerLogs: [],
  onboardingCompleted: false,
  voyageStatus: {
    date: new Date().toISOString().split('T')[0],
    time: "12:00",
    situation: 'Noon',
    voyageNumber: '001',
    portOfDeparture: 'SINGAPORE',
    destinationPort: 'ROTTERDAM',
    voyageStage: 'noon'
  },
  dashboardCards: [
    { id: 'vessel-info', type: 'vessel-info', title: 'Current Assignment', visible: true },
    { id: 'date', type: 'voyage-date', title: 'Report Date', visible: true },
    { id: 'time-status', type: 'voyage-time', title: 'Latest Situation', visible: true },
    { id: 'voyage-info', type: 'voyage-info', title: 'Voyage Info', visible: true },
    { id: 'last-report', type: 'last-report', title: 'Last Submitted Report', visible: true },
    { id: 'activity', type: 'activity', title: "Today's Activity", visible: true }
  ],
  lastModified: 0
};

// --- Utilities ---

const sanitizeData = (incoming: any, fallbackData: OnboardingData = defaultData): OnboardingData => {
  if (!incoming || typeof incoming !== 'object') {
    return fallbackData;
  }
  
  return {
    vesselName: typeof incoming.vesselName === 'string' ? incoming.vesselName : fallbackData.vesselName,
    imoNumber: typeof incoming.imoNumber === 'string' ? incoming.imoNumber : fallbackData.imoNumber,
    department: (incoming.department === 'deck' || incoming.department === 'engine') ? incoming.department : fallbackData.department,
    machinery: (Array.isArray(incoming.machinery) && incoming.machinery.length > 0) ? incoming.machinery : fallbackData.machinery,
    fuelTypes: (Array.isArray(incoming.fuelTypes) && incoming.fuelTypes.length > 0) ? incoming.fuelTypes : defaultFuelTypesList,
    oilTypes: (Array.isArray(incoming.oilTypes) && incoming.oilTypes.length > 0) ? incoming.oilTypes : fallbackData.oilTypes,
    calculationMethod: incoming.calculationMethod || fallbackData.calculationMethod || 'flowmeter',
    fuelConsumptionData: {},
    oilConsumptionData: (incoming.oilConsumptionData && typeof incoming.oilConsumptionData === 'object') ? incoming.oilConsumptionData : {},
    machineryHours: (incoming.machineryHours && typeof incoming.machineryHours === 'object') ? incoming.machineryHours : {},
    consumptionLogs: Array.isArray(incoming.consumptionLogs) ? incoming.consumptionLogs : [],
    bunkerLogs: Array.isArray(incoming.bunkerLogs) ? incoming.bunkerLogs : [],
    onboardingCompleted: typeof incoming.onboardingCompleted === 'boolean' ? incoming.onboardingCompleted : false,
    voyageStatus: {
      ...fallbackData.voyageStatus,
      ...(incoming.voyageStatus && typeof incoming.voyageStatus === 'object' ? incoming.voyageStatus : {})
    },
    dashboardCards: (Array.isArray(incoming.dashboardCards) && incoming.dashboardCards.length > 0) 
      ? incoming.dashboardCards 
      : fallbackData.dashboardCards,
    lastModified: typeof incoming.lastModified === 'number' ? incoming.lastModified : Date.now()
  };
};

const recalculateRob = (currentData: OnboardingData) => {
  const fuelList = (Array.isArray(currentData.fuelTypes) && currentData.fuelTypes.length > 0) ? currentData.fuelTypes : defaultFuelTypesList;
  const oilList = Array.isArray(currentData.oilTypes) ? currentData.oilTypes : [];
  const bunkerList = Array.isArray(currentData.bunkerLogs) ? currentData.bunkerLogs : [];
  const consumptionList = Array.isArray(currentData.consumptionLogs) ? currentData.consumptionLogs : [];

  const fuelRobs = fuelList.reduce((acc, f) => ({ ...acc, [f.id]: parseFloat(f.initialRob) || 0 }), {} as Record<string, number>);
  const oilRobs = oilList.reduce((acc, o) => ({ ...acc, [o.id]: parseFloat(o.initialRob) || 0 }), {} as Record<string, number>);

  // Add Bunkering
  bunkerList.forEach(log => {
    const val = parseFloat(log.value) || 0;
    if (log.unit === 'MT') {
      const fuel = fuelList.find(f => f.type === log.type);
      if (fuel) fuelRobs[fuel.id] = (fuelRobs[fuel.id] || 0) + val;
    } else {
      const oil = oilList.find(o => o.name === log.type);
      if (oil) oilRobs[oil.id] = (oilRobs[oil.id] || 0) + val;
    }
  });

  // Sort logs by timestamp
  const sortedLogs = [...consumptionList].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const updatedLogs = sortedLogs.map(log => {
    const val = parseFloat(log.value) || 0;

    if (log.unit === 'MT') {
      const fuel = fuelList.find(f => f.type === log.type);
      if (fuel) fuelRobs[fuel.id] = (fuelRobs[fuel.id] || 0) - val;
    } else {
      const oil = oilList.find(o => o.name === log.type);
      if (oil) oilRobs[oil.id] = (oilRobs[oil.id] || 0) - val;
    }

    const fuelRobSnapshot: Record<string, string> = {};
    const oilRobSnapshot: Record<string, string> = {};

    Object.keys(fuelRobs).forEach(k => fuelRobSnapshot[k] = (fuelRobs[k] ?? 0).toFixed(2));
    Object.keys(oilRobs).forEach(k => oilRobSnapshot[k] = (oilRobs[k] ?? 0).toFixed(0));

    return { ...log, fuelRobSnapshot, oilRobSnapshot };
  });

  const updatedFuelTypes = fuelList.map(f => ({ ...f, rob: (fuelRobs[f.id] ?? 0).toFixed(2) }));
  const updatedOilTypes = oilList.map(o => ({ ...o, rob: (oilRobs[o.id] ?? 0).toFixed(0) }));

  return { 
    ...currentData, 
    fuelTypes: updatedFuelTypes, 
    oilTypes: updatedOilTypes, 
    consumptionLogs: updatedLogs,
    bunkerLogs: bunkerList,
    lastModified: Date.now()
  };
};

// --- Components ---

const getIcon = (iconType: string) => {
  switch (iconType) {
    case 'me': return <Cpu size={18} />;
    case 'ge': return <Zap size={18} />;
    case 'blr': return <Flame size={18} />;
    default: return <Settings2 size={18} />;
  }
};

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  theme,
  confirmLabel = "Delete"
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  message: string, 
  theme: 'dark' | 'light',
  confirmLabel?: string
}) => {
  if (!isOpen) return null;
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`${theme === 'dark' ? 'bg-[#0A192F] border-white/10' : 'bg-white border-slate-200'} p-6 sm:p-8 rounded-2xl sm:rounded-[32px] border shadow-2xl max-w-xs w-full space-y-5 sm:space-y-6`}
      >
        <div className="text-center space-y-1.5 sm:space-y-2">
          <h3 className={`text-lg sm:text-xl font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{title}</h3>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">{message}</p>
        </div>
        <div className="flex gap-2.5 sm:gap-3">
          <button 
            onClick={onClose}
            className={`flex-1 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${theme === 'dark' ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            Cancel
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className="flex-1 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-red-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all"
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const machineryIcons = [
  { id: 'me', icon: <Cpu size={20} />, label: 'Main Engine' },
  { id: 'ge', icon: <Zap size={20} />, label: 'Generator' },
  { id: 'blr', icon: <Flame size={20} />, label: 'Boiler' },
  { id: 'other', icon: <Settings2 size={20} />, label: 'Other' },
];

const Logo = ({ className = "", size = 64 }: { className?: string, size?: number }) => (
  <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
    <Anchor size={size} className="text-[#0A3161] absolute" strokeWidth={2.5} />
    <div className="absolute bg-white p-1 rounded-full translate-x-3 -translate-y-1">
      <Fuel size={size * 0.4} className="text-[#00A8A8]" strokeWidth={3} />
    </div>
  </div>
);

const SplashScreen = ({ onFinish }: { onFinish: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onFinish, 500);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#0A3161] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Immersive Background */}
      <div className="absolute inset-0 z-0 bg-[#0A3161]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A3161] via-[#0A192F] to-[#050B15]" />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#4DE8E8 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex flex-col items-center gap-4 sm:gap-6 z-10"
      >
        <div className="relative flex items-center justify-center w-24 h-24 sm:w-32 sm:h-32">
          <Anchor size={90} className="text-white absolute opacity-90 sm:w-[120px] sm:h-[120px]" strokeWidth={2} />
          <div className="absolute bg-[#00A8A8] p-1.5 sm:p-2 rounded-full translate-x-5 -translate-y-1.5 sm:translate-x-6 sm:-translate-y-2 shadow-xl shadow-cyan-500/20">
            <Fuel size={36} className="text-white sm:w-12 sm:h-12" strokeWidth={2.5} />
          </div>
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-white uppercase italic">BUNKER WATCH</h1>
          <p className="text-[#4DE8E8] text-[9px] sm:text-[10px] font-bold tracking-[0.3em] uppercase opacity-80">A Bunker Calculation app</p>
        </div>
      </motion.div>
      
      {/* Animated loading bar at bottom */}
      <div className="absolute bottom-12 sm:bottom-20 left-8 right-8 sm:left-12 sm:right-12 h-0.5 bg-white/10 rounded-full overflow-hidden z-10">
        <motion.div 
          initial={{ x: "-100%" }}
          animate={{ x: "0%" }}
          transition={{ duration: 2.5, ease: "linear" }}
          className="h-full bg-gradient-to-r from-transparent via-[#4DE8E8] to-transparent w-full"
        />
      </div>
    </motion.div>
  );
};

const BottomNav = ({ activeTab, onTabChange, theme }: { activeTab: string, onTabChange: (tab: string) => void, theme: 'dark' | 'light', data?: OnboardingData }) => {
  const tabs = [
    { id: 'dashboard', label: 'DASHBOARD', icon: <LayoutDashboard size={20} />, color: '#4DE8E8' },
    { id: 'daily-entry', label: 'DAILY ENTRY (EVENT / SITUATION)', icon: <ClipboardList size={20} />, color: '#00A8A8' },
  ];

  const currentTabId = activeTab === 'dashboard' ? 'dashboard' : 'daily-entry';

  return (
    <nav id="app-nav" className={`fixed bottom-0 left-0 right-0 max-w-md mx-auto ${theme === 'dark' ? 'bg-[#0A192F]/95 border-white/10' : 'bg-[#0A3161] border-white/10'} backdrop-blur-2xl border-t flex h-16 sm:h-20 pb-2 sm:pb-6 z-40 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] rounded-t-2xl sm:rounded-t-[32px] px-6`}>
      {tabs.map((tab) => {
        const isActive = currentTabId === tab.id;
        return (
          <button 
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 sm:gap-1.5 transition-all relative group px-2 py-1 ${
              isActive 
                ? 'text-[#4DE8E8]' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={{ color: isActive ? tab.color : undefined }}
          >
            <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-white/10 scale-110 shadow-lg shadow-cyan-500/10' : 'group-hover:bg-white/5'}`}>
              {React.isValidElement(tab.icon) ? React.cloneElement(tab.icon as React.ReactElement<any>, { size: 20 }) : tab.icon}
            </div>
            <span className={`text-[8px] sm:text-[9.5px] font-black tracking-widest sm:tracking-[0.25em] transition-all truncate max-w-full px-1 ${isActive ? 'opacity-100 font-black' : 'opacity-60'}`}>{tab.label}</span>
            {isActive && (
              <motion.div 
                layoutId="activeTab"
                className="absolute -top-px left-8 right-8 h-0.5 shadow-[0_0_12px_currentColor]"
                style={{ backgroundColor: tab.color }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
};

const VoyageVesselIcon = ({ theme, className = "w-8 h-8 sm:w-9 sm:h-9" }: { theme: 'dark' | 'light', className?: string }) => (
  <svg 
    viewBox="0 0 46 42" 
    className={className} 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Main Sail (Right Triangular Sail) */}
    <path 
      d="M23 4 L40 26 L23 26 Z" 
      fill={theme === 'dark' ? '#00E5E5' : '#0284C7'} 
      fillOpacity="0.9"
      stroke={theme === 'dark' ? '#E0F2FE' : '#0A3161'} 
      strokeWidth="1.6" 
      strokeLinejoin="round" 
    />
    {/* Fore Sail / Jib (Left Triangular Sail) */}
    <path 
      d="M20 9 L7 26 L20 26 Z" 
      fill={theme === 'dark' ? '#4DE8E8' : '#38BDF8'} 
      fillOpacity="0.8"
      stroke={theme === 'dark' ? '#E0F2FE' : '#0A3161'} 
      strokeWidth="1.6" 
      strokeLinejoin="round" 
    />
    {/* Mast (Vertical) */}
    <line 
      x1="21.5" 
      y1="3" 
      x2="21.5" 
      y2="29" 
      stroke={theme === 'dark' ? '#FFFFFF' : '#0F172A'} 
      strokeWidth="2.2" 
      strokeLinecap="round" 
    />
    {/* Boat Hull (Angled boat hull matching sketch) */}
    <path 
      d="M5 27 L10 37 L34 37 L39 27 Z" 
      fill={theme === 'dark' ? '#0A192F' : '#FFFFFF'} 
      stroke={theme === 'dark' ? '#4DE8E8' : '#0A3161'} 
      strokeWidth="2" 
      strokeLinejoin="round" 
    />
    {/* Hull deck waterline stripe */}
    <line 
      x1="8" 
      y1="30" 
      x2="36" 
      y2="30" 
      stroke={theme === 'dark' ? '#00E5E5' : '#0284C7'} 
      strokeWidth="1.4" 
      strokeLinecap="round" 
    />
  </svg>
);

const Dashboard = ({ data, setData, onOpenSettings, theme, isSyncing, isOffline, lastSynced, setShowBunkerModal, onNavigateToReport }: { data: OnboardingData, setData: React.Dispatch<React.SetStateAction<OnboardingData>>, onOpenSettings: (section?: string) => void, theme: 'dark' | 'light', isSyncing: boolean, isOffline: boolean, lastSynced: string | null, setShowBunkerModal: (show: boolean) => void, onNavigateToReport?: () => void }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  const getFuelColor = (type: string) => {
    const upperType = type.toUpperCase();
    if (upperType.includes('FO')) return '#FF4D4D';
    if (upperType.includes('DO')) return '#FF80BF';
    return '#4DE8E8';
  };
  const today = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formattedDate = today.toLocaleDateString(undefined, dateOptions);

  // Voyage Waypoints derived from user sketch - sea replaced with COSP and EOSP
  const VOYAGE_WAYPOINTS = [
    { id: 'port-dep', label: 'port', sub: 'Departure Port', percent: 6, type: 'dot', defaultSituation: 'Departure', subText: data.voyageStatus.portOfDeparture || 'SIN' },
    { id: 'anchor-dep', label: 'anchor', sub: 'Departure Anchor', percent: 21, type: 'tick', defaultSituation: 'Anchor', subText: '' },
    { id: 'sea-1', label: 'COSP', sub: 'COSP (Commence Sea Passage)', percent: 36, type: 'subtick', defaultSituation: 'COSP', subText: '' },
    { id: 'noon', label: 'Noon', sub: 'Noon Report (12:00 LT Reset)', percent: 50, type: 'noon-dot', defaultSituation: 'Noon', subText: '' },
    { id: 'sea-2', label: 'EOSP', sub: 'EOSP (End of Sea Passage)', percent: 64, type: 'subtick', defaultSituation: 'EOSP', subText: '' },
    { id: 'anchor-arr', label: 'anchor', sub: 'Arrival Anchor', percent: 79, type: 'tick', defaultSituation: 'Anchor', subText: '' },
    { id: 'port-arr', label: 'port', sub: 'Destination Port', percent: 94, type: 'dot', defaultSituation: 'FWE', subText: data.voyageStatus.destinationPort || 'RTM' },
  ];

  const currentStageId = useMemo(() => {
    const current = data.voyageStatus.voyageStage;
    if (current && VOYAGE_WAYPOINTS.some(w => w.id === current)) {
      return current;
    }
    const sit = data.voyageStatus.situation;
    if (sit === 'Noon') return 'noon';
    if (sit === 'Anchor') return 'anchor-dep';
    if (sit === 'COSP') return 'sea-1';
    if (sit === 'EOSP') return 'sea-2';
    if (sit === 'FWE') return 'port-arr';
    if (sit === 'Departure' || sit === 'Alongside') return 'port-dep';
    return 'noon';
  }, [data.voyageStatus.voyageStage, data.voyageStatus.situation]);

  const currentWaypoint = VOYAGE_WAYPOINTS.find(w => w.id === currentStageId) || VOYAGE_WAYPOINTS[3];

  const handleWaypointSelect = (wp: typeof VOYAGE_WAYPOINTS[number]) => {
    if (data.department === 'deck') return;
    setData(prev => ({
      ...prev,
      voyageStatus: {
        ...prev.voyageStatus,
        voyageStage: wp.id,
        situation: wp.defaultSituation || prev.voyageStatus.situation
      },
      lastModified: Date.now()
    }));
  };
  
  const reportDate = data.voyageStatus.date;
  const todayLogs = data.consumptionLogs.filter(log => log.timestamp.startsWith(reportDate))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Get the most recent report (last event)
  const lastReport = data.consumptionLogs.length > 0 
    ? data.consumptionLogs.reduce((latest, current) => {
        if (!latest) return current;
        return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest;
      }, data.consumptionLogs[0])
    : null;

  const lastReportLogs = lastReport 
    ? data.consumptionLogs.filter(log => 
        log.timestamp === lastReport.timestamp && 
        log.situation === lastReport.situation
      )
    : [];

  const getLastReportValue = (machineryName: string, type: string) => {
    const log = lastReportLogs.find(l => 
      l.machineryName === machineryName && 
      l.type === type
    );
    return log ? log.value : '0.0';
  };

  const situationIcons: Record<string, React.ReactNode> = {
    'Noon': <Sun size={16} />,
    'Standby': <Clock size={16} />,
    'FWE': <XCircle size={16} />,
    'COSP': <Navigation size={16} />,
    'EOSP': <Flag size={16} />,
    'Departure': <Ship size={16} />,
    'Alongside': <Layout size={16} />,
    'Anchor': <Anchor size={16} />,
    'Unknown': <Activity size={16} />
  };

  const situations = ['Noon', 'Standby', 'FWE', 'COSP', 'EOSP', 'Departure', 'Alongside', 'Anchor'];

  // Critical visual warning if fuel or oil ROB falls below 15% of total capacity
  const lowCapacityAlerts = useMemo(() => {
    const alerts: { id: string; name: string; type: 'fuel' | 'oil'; rob: number; capacity: number; percent: number }[] = [];
    (data.fuelTypes || []).forEach(f => {
      const rob = parseFloat(f.rob) || 0;
      const cap = parseFloat(f.capacity) || 0;
      if (cap > 0) {
        const pct = (rob / cap) * 100;
        if (pct < 15) {
          alerts.push({ id: f.id, name: f.type, type: 'fuel', rob, capacity: cap, percent: Math.round(pct) });
        }
      }
    });
    (data.oilTypes || []).forEach(o => {
      const rob = parseFloat(o.rob) || 0;
      const cap = parseFloat(o.capacity) || 0;
      if (cap > 0) {
        const pct = (rob / cap) * 100;
        if (pct < 15) {
          alerts.push({ id: o.id, name: o.name, type: 'oil', rob, capacity: cap, percent: Math.round(pct) });
        }
      }
    });
    return alerts;
  }, [data.fuelTypes, data.oilTypes]);

  const getIcon = (iconType: string) => {
    switch (iconType) {
      case 'me': return <Cpu size={14} />;
      case 'ge': return <Zap size={14} />;
      case 'blr': return <Flame size={14} />;
      default: return <Settings2 size={14} />;
    }
  };

  const machineryList = data.machinery.reduce((acc, m) => {
    if (!acc.find(item => item.name === m.name)) {
      acc.push({
        ...m,
        icon: getIcon(m.icon)
      });
    }
    return acc;
  }, [] as any[]);

  const removeCard = (id: string) => {
    setData({
      ...data,
      dashboardCards: data.dashboardCards.map(c => c.id === id ? { ...c, visible: false } : c)
    });
  };

  const addCard = (id: string) => {
    setData({
      ...data,
      dashboardCards: data.dashboardCards.map(c => c.id === id ? { ...c, visible: true } : c)
    });
  };

  const updateCardTitle = (id: string, title: string) => {
    setData({
      ...data,
      dashboardCards: data.dashboardCards.map(c => c.id === id ? { ...c, title } : c)
    });
  };

  const moveCard = (id: string, direction: 'up' | 'down') => {
    const index = data.dashboardCards.findIndex(c => c.id === id);
    if (index < 0) return;
    
    const newCards = [...data.dashboardCards];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < newCards.length) {
      [newCards[index], newCards[targetIndex]] = [newCards[targetIndex], newCards[index]];
      setData({ ...data, dashboardCards: newCards });
    }
  };

  return (
    <div id="app-root" className={`pb-28 sm:pb-32 min-h-screen ${theme === 'dark' ? 'bg-[#050B15]' : 'bg-[#F1F5F9]'}`}>
      <header id="app-header" className={`${theme === 'dark' ? 'bg-[#0A192F] border-white/10' : 'bg-[#0A3161] border-white/10'} text-white p-4 pt-8 sm:p-6 sm:pt-12 rounded-b-[28px] sm:rounded-b-[40px] shadow-[0_20px_50px_rgba(10,49,97,0.3)] border-b relative overflow-hidden`}>
        {/* Decorative elements for mixed theme */}
        <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-[#00A8A8]/10 rounded-full blur-3xl -mr-24 -mt-24 sm:-mr-32 sm:-mt-32" />
        <div className="absolute bottom-0 left-0 w-24 h-24 sm:w-32 sm:h-32 bg-[#4DE8E8]/5 rounded-full blur-2xl -ml-12 -mb-12 sm:-ml-16 sm:-mb-16" />
        
        <div className="flex justify-between items-start mb-6 sm:mb-8 relative z-10 gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-white/10 p-1.5 sm:p-2 rounded-lg sm:rounded-xl backdrop-blur-md border border-white/10 shrink-0">
                <Anchor size={20} className="text-[#4DE8E8] sm:w-6 sm:h-6" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black tracking-tighter italic uppercase text-white leading-none truncate">BUNKER WATCH</h1>
                <p className="text-[#4DE8E8] text-[8px] sm:text-[9px] font-bold tracking-[0.3em] sm:tracking-[0.4em] uppercase opacity-80 mt-1 truncate">{formattedDate}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 flex-wrap justify-end">
            {isSyncing && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1 text-[7px] sm:text-[8px] font-black text-[#4DE8E8] uppercase tracking-widest"
              >
                <div className="w-1 h-1 bg-[#4DE8E8] rounded-full animate-ping" />
                Syncing
              </motion.div>
            )}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isOffline ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-[#4DE8E8] shadow-[0_0_8px_rgba(77,232,232,0.5)]'}`} />
              <span className="text-[7px] sm:text-[8px] font-black text-white/70 uppercase tracking-widest">
                {isOffline ? 'Solo Mode' : 'Ship Server'}
              </span>
            </div>
            {isOffline && (
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 text-[7px] sm:text-[8px] font-black text-orange-400 uppercase tracking-widest">
                  <Wifi size={10} className="opacity-50" />
                  Offline Mode
                </div>
                {lastSynced && <span className="text-[6px] font-bold text-slate-500 uppercase tracking-tighter">Last Sync: {lastSynced}</span>}
              </div>
            )}
            {data.department && (
              <span className={`text-[7px] sm:text-[9px] font-black px-2 py-0.5 sm:px-3 sm:py-1 rounded-md sm:rounded-lg border backdrop-blur-md ${
                data.department === 'engine' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-orange-500/20 border-orange-500/40 text-orange-300'
              }`}>
                {data.department.toUpperCase()}
              </span>
            )}
            <button 
              onClick={() => onOpenSettings()}
              className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all hover:scale-105 active:scale-95"
              title="Settings"
            >
              <Settings2 size={18} className="text-[#4DE8E8] sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </header>

      <main id="app-main" className="px-3.5 sm:px-6 -mt-6 sm:-mt-8 space-y-4 sm:space-y-6 relative z-10">
        {/* Critical ROB Low Capacity Visual Warning (< 15%) */}
        {lowCapacityAlerts.length > 0 && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-red-500/15 border-2 border-red-500/40 shadow-[0_0_25px_rgba(239,68,68,0.25)] flex items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 sm:p-2.5 rounded-xl bg-red-500/25 text-red-400 shrink-0">
                <AlertTriangle size={20} className="animate-bounce sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-red-300">
                    CRITICAL ROB WARNING: INVENTORY &lt; 15% CAPACITY
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase bg-red-500 text-white shrink-0">
                    LOW LEVEL
                  </span>
                </div>
                <p className="text-[8px] sm:text-[9.5px] font-bold text-red-200/90 truncate mt-0.5">
                  {lowCapacityAlerts.map(a => `${a.name}: ${a.rob} ${a.type === 'fuel' ? 'MT' : 'L'} remaining (${a.percent}% of ${a.capacity})`).join(' • ')}
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-block px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-wider bg-red-500 text-white shrink-0">
              CRITICAL
            </span>
          </div>
        )}

        {/* Vessel Info Card (formerly in header) */}
        {data.dashboardCards.filter(c => c.visible && c.type === 'vessel-info').map(card => (
          <div key={card.id} className="relative group">
            {isEditMode && (
              <div className="absolute -top-2 -right-2 z-20 flex gap-1">
                <div className="flex bg-[#0A192F] rounded-full p-1 shadow-lg border border-white/10">
                  <button 
                    onClick={() => moveCard(card.id, 'up')}
                    className="text-white p-1 hover:text-[#4DE8E8] transition-colors"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button 
                    onClick={() => moveCard(card.id, 'down')}
                    className="text-white p-1 hover:text-[#4DE8E8] transition-colors"
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
                <button 
                  onClick={() => setEditingCardId(editingCardId === card.id ? null : card.id)}
                  className="bg-[#00A8A8] text-white p-2 rounded-full shadow-lg"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  onClick={() => removeCard(card.id)}
                  className="bg-red-500 text-white p-2 rounded-full shadow-lg"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {editingCardId === card.id && (
              <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm rounded-2xl sm:rounded-[28px] flex flex-col items-center justify-center p-4 sm:p-6 gap-3 sm:gap-4">
                <div className="w-full max-w-xs space-y-2">
                  <label className="text-[10px] font-black text-[#4DE8E8] uppercase tracking-widest">Card Title</label>
                  <input 
                    type="text" 
                    value={card.title}
                    onChange={(e) => updateCardTitle(card.id, e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl p-3 sm:p-4 text-white text-xs sm:text-sm font-black uppercase focus:outline-none focus:border-[#00A8A8]"
                  />
                </div>
                <button 
                  onClick={() => setEditingCardId(null)}
                  className="bg-[#00A8A8] text-[#0A192F] px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-cyan-500/20"
                >
                  Save Changes
                </button>
              </div>
            )}

            <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-xl p-4 sm:p-6 rounded-2xl sm:rounded-[28px] border shadow-2xl relative z-10 group transition-all hover:border-[#4DE8E8]/30`}>
              <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                <Compass size={14} className="text-[#4DE8E8] animate-pulse sm:w-4 sm:h-4" />
                <span className="text-[8px] sm:text-[9px] font-black tracking-[0.2em] uppercase text-white/50">{card.title}</span>
              </div>
              <div className="flex items-end justify-between gap-2">
                <h2 className={`text-xl sm:text-2xl font-black tracking-tight truncate ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{data.vesselName || "UNNAMED VESSEL"}</h2>
                <div className="text-[9px] sm:text-[10px] font-bold text-[#4DE8E8] bg-[#4DE8E8]/10 px-2 py-0.5 sm:py-1 rounded-md border border-[#4DE8E8]/20 whitespace-nowrap shrink-0">IMO {data.imoNumber || "9876543"}</div>
              </div>
            </div>
          </div>
        ))}

        {/* Grid for small cards */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
          {data.dashboardCards
            .filter(c => c.visible && (c.type === 'voyage-date' || c.type === 'voyage-time' || c.type === 'voyage-info'))
            .sort((a, b) => {
              if (a.type === 'voyage-info' && b.type !== 'voyage-info') return 1;
              if (b.type === 'voyage-info' && a.type !== 'voyage-info') return -1;
              return 0;
            })
            .map(card => (
            <div key={card.id} className={`relative group ${card.type === 'voyage-info' ? 'col-span-2 w-full' : 'col-span-1'}`}>
              {isEditMode && (
                <div className="absolute -top-2 -right-2 z-20 flex gap-1">
                  <div className="flex bg-[#0A192F] rounded-full p-1 shadow-lg border border-white/10">
                    <button 
                      onClick={() => moveCard(card.id, 'up')}
                      className="text-white p-1 hover:text-[#4DE8E8] transition-colors"
                    >
                      <ChevronUp size={10} />
                    </button>
                    <button 
                      onClick={() => moveCard(card.id, 'down')}
                      className="text-white p-1 hover:text-[#4DE8E8] transition-colors"
                    >
                      <ChevronDown size={10} />
                    </button>
                  </div>
                  <button 
                    onClick={() => setEditingCardId(editingCardId === card.id ? null : card.id)}
                    className="bg-[#00A8A8] text-white p-1 sm:p-1.5 rounded-full shadow-lg"
                  >
                    <Edit2 size={10} />
                  </button>
                  <button 
                    onClick={() => removeCard(card.id)}
                    className="bg-red-500 text-white p-1 sm:p-1.5 rounded-full shadow-lg"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
              
              {editingCardId === card.id && (
                <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm rounded-2xl sm:rounded-[28px] flex flex-col items-center justify-center p-3 sm:p-4 gap-2">
                  <input 
                    type="text" 
                    value={card.title}
                    onChange={(e) => updateCardTitle(card.id, e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg p-2 text-white text-[10px] font-black uppercase text-center focus:outline-none focus:border-[#00A8A8]"
                  />
                  <button 
                    onClick={() => setEditingCardId(null)}
                    className="bg-[#00A8A8] text-[#0A192F] px-4 py-1 rounded-full text-[8px] font-black uppercase"
                  >
                    Save
                  </button>
                </div>
              )}

              {card.type === 'voyage-date' && (
                <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-3.5 sm:p-5 rounded-2xl sm:rounded-[28px] shadow-xl border h-full transition-all hover:translate-y-[-2px]`}>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl ${theme === 'dark' ? 'bg-white/5 text-[#4DE8E8]' : 'bg-[#0A3161]/5 text-[#0A3161]'}`}>
                        <Calendar size={16} className="sm:w-[18px] sm:h-[18px]" />
                      </div>
                      <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-wider sm:tracking-[0.2em] truncate">{card.title}</span>
                    </div>
                    <span className="text-[7px] sm:text-[7.5px] font-black uppercase tracking-wider text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                      Read-only
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-base sm:text-lg font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                      {data.voyageStatus.date ? new Date(data.voyageStatus.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'No Date'}
                    </span>
                    <span className="text-[7.5px] sm:text-[8px] font-bold text-[#00A8A8] uppercase tracking-wider mt-1 flex items-center gap-1">
                      <CheckCircle size={10} /> Latest Log Date
                    </span>
                  </div>
                </div>
              )}

              {card.type === 'voyage-time' && (
                <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-3.5 sm:p-5 rounded-2xl sm:rounded-[28px] shadow-xl border h-full transition-all hover:translate-y-[-2px]`}>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl ${theme === 'dark' ? 'bg-white/5 text-[#4DE8E8]' : 'bg-[#0A3161]/5 text-[#0A3161]'}`}>
                        <Clock size={16} className="sm:w-[18px] sm:h-[18px]" />
                      </div>
                      <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-wider sm:tracking-[0.2em] truncate">Latest Situation</span>
                    </div>
                    <span className="text-[7px] sm:text-[7.5px] font-black uppercase tracking-wider text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                      Read-only
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl sm:text-3xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                        {data.voyageStatus.time || "12:00"}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">HRS</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00A8A8]/20 border border-[#00A8A8]/40 text-[#4DE8E8]">
                        {situationIcons[data.voyageStatus.situation] || <Activity size={13} />}
                        <span className="text-[9.5px] sm:text-[11px] font-black uppercase tracking-wider text-[#4DE8E8]">
                          {data.voyageStatus.situation}
                        </span>
                      </div>
                      <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider">
                        • Current Status
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {card.type === 'voyage-info' && (
                <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-3.5 sm:p-5 rounded-2xl sm:rounded-[28px] shadow-xl border h-full w-full transition-all hover:translate-y-[-2px] space-y-3.5 sm:space-y-4 relative overflow-hidden`}>
                  {/* Subtle decorative glow */}
                  <div className="absolute top-0 right-0 w-40 h-40 bg-[#00A8A8]/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

                  {/* Header with Title and Current Stage Status */}
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl ${theme === 'dark' ? 'bg-white/5 text-[#4DE8E8] border border-white/10' : 'bg-[#0A3161]/5 text-[#0A3161] border border-[#0A3161]/10'}`}>
                        <Ship size={16} className="sm:w-[18px] sm:h-[18px] text-[#4DE8E8]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className={`text-[10px] sm:text-xs font-black tracking-wider uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{card.title}</span>
                          <span className="px-1.5 py-0.5 rounded-full text-[7.5px] sm:text-[8px] font-black uppercase tracking-wider bg-[#00A8A8]/10 text-[#00A8A8] border border-[#00A8A8]/20">
                            Voy #{data.voyageStatus.voyageNumber || '001'}
                          </span>
                        </div>
                        <span className="text-[7.5px] sm:text-[8px] font-medium text-slate-400 block -mt-0.5">Maritime Voyage Timeline & Status</span>
                      </div>
                    </div>

                    <div className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full flex items-center gap-1.5 border ${theme === 'dark' ? 'bg-[#050B15]/80 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4DE8E8] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-[#00A8A8]"></span>
                      </span>
                      <span className={`text-[7.5px] sm:text-[8.5px] font-black uppercase tracking-wider ${theme === 'dark' ? 'text-[#4DE8E8]' : 'text-[#0A3161]'}`}>
                        {currentWaypoint.sub}
                      </span>
                    </div>
                  </div>

                  {/* Voyage Timeline Track (Iconography matching uploaded sketch) */}
                  <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border ${theme === 'dark' ? 'bg-[#050B15]/70 border-white/5' : 'bg-slate-50/80 border-slate-200/80'} relative pt-12 sm:pt-14 pb-4 select-none`}>
                    
                    {/* Sliding Boat Icon */}
                    <motion.div 
                      className="absolute top-1 sm:top-1.5 -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center"
                      animate={{ left: `${currentWaypoint.percent}%` }}
                      transition={{ type: "spring", stiffness: 220, damping: 24 }}
                    >
                      <motion.div
                        animate={{ y: [0, -2.5, 0], rotate: [-1, 1, -1] }}
                        transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
                        className="filter drop-shadow-[0_4px_10px_rgba(77,232,232,0.6)]"
                      >
                        <VoyageVesselIcon theme={theme} className="w-8 h-8 sm:w-9 sm:h-9" />
                      </motion.div>
                      {/* Vessel beacon indicator dot touching the track line */}
                      <div className="w-1.5 h-1.5 rounded-full bg-[#4DE8E8] shadow-[0_0_8px_#4DE8E8] -mt-0.5" />
                    </motion.div>

                    {/* Track Line with Markers */}
                    <div className="relative w-full my-3">
                      {/* Base Track Line */}
                      <div className={`h-1 w-full rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} />

                      {/* Active Progress Track Line */}
                      <motion.div 
                        className="absolute top-0 left-0 h-1 rounded-full bg-gradient-to-r from-[#00A8A8] to-[#4DE8E8] shadow-[0_0_10px_rgba(77,232,232,0.5)]"
                        animate={{ width: `${currentWaypoint.percent}%` }}
                        transition={{ type: "spring", stiffness: 220, damping: 24 }}
                      />

                      {/* Waypoints along the line */}
                      {VOYAGE_WAYPOINTS.map((wp) => {
                        const isActive = wp.id === currentWaypoint.id;
                        const isPast = wp.percent <= currentWaypoint.percent;

                        return (
                          <div
                            key={wp.id}
                            style={{ left: `${wp.percent}%` }}
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group/wp transition-all z-10 flex flex-col items-center pointer-events-none select-none cursor-default"
                          >
                            {/* Waypoint Marker Iconography */}
                            {wp.type === 'dot' ? (
                              <div className={`w-3.5 h-3.5 rounded-full border-2 transition-all flex items-center justify-center ${
                                isActive 
                                  ? 'bg-[#4DE8E8] border-white shadow-[0_0_12px_#4DE8E8] scale-125' 
                                  : isPast 
                                    ? 'bg-[#00A8A8] border-[#4DE8E8]' 
                                    : theme === 'dark' ? 'bg-[#0A192F] border-slate-500' : 'bg-white border-slate-300'
                              }`}>
                                <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-[#0A192F]' : 'bg-white'}`} />
                              </div>
                            ) : wp.type === 'noon-dot' ? (
                              <div className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
                                isActive 
                                  ? 'bg-[#4DE8E8] border-white shadow-[0_0_14px_#4DE8E8] scale-125' 
                                  : isPast 
                                    ? 'bg-[#00A8A8] border-[#4DE8E8]' 
                                    : theme === 'dark' ? 'bg-[#0A192F] border-slate-500' : 'bg-white border-slate-300'
                              }`}>
                                <Sun size={9} className={isActive ? 'text-[#0A192F]' : isPast ? 'text-white' : 'text-slate-400'} />
                              </div>
                            ) : wp.type === 'tick' ? (
                              <div className={`w-1 h-3.5 sm:h-4 rounded-full transition-all ${
                                isActive 
                                  ? 'bg-[#4DE8E8] shadow-[0_0_10px_#4DE8E8] scale-125' 
                                  : isPast 
                                    ? 'bg-[#00A8A8]' 
                                    : theme === 'dark' ? 'bg-slate-600' : 'bg-slate-300'
                              }`} />
                            ) : (
                              /* Intermediate subtick (COSP / EOSP) */
                              <div className={`w-0.5 h-2.5 rounded-full transition-all ${
                                isActive 
                                  ? 'bg-[#4DE8E8] shadow-[0_0_8px_#4DE8E8]' 
                                  : isPast 
                                    ? 'bg-[#00A8A8]/70' 
                                    : theme === 'dark' ? 'bg-slate-700' : 'bg-slate-300'
                              }`} />
                            )}

                            {/* Label underneath */}
                            <div className="mt-2 text-center whitespace-nowrap">
                              <span className={`block text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-wider transition-colors ${
                                isActive 
                                  ? 'text-[#4DE8E8] font-black scale-105' 
                                  : isPast 
                                    ? theme === 'dark' ? 'text-slate-300' : 'text-slate-700' 
                                    : 'text-slate-500'
                              }`}>
                                {wp.label}
                              </span>
                              {wp.subText && (
                                <span className={`text-[7px] sm:text-[7.5px] font-bold block -mt-0.5 max-w-[48px] sm:max-w-[65px] truncate ${
                                  isActive ? 'text-[#00A8A8]' : 'text-slate-400'
                                }`}>
                                  {wp.subText}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-6 flex items-center justify-between text-[7px] sm:text-[8px] text-slate-500 font-bold uppercase tracking-wider px-1">
                      <span>• Vessel Position: {currentWaypoint.sub}</span>
                      <span className="text-[#00A8A8]">• Synced with Latest Situation</span>
                    </div>
                  </div>

                  {/* Voyage Ports & Voyage No. Status (Read-only) */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-0.5">
                    <div className={`p-2 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'} space-y-0.5 min-w-0`}>
                      <span className="text-[7.5px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest block truncate">Voyage No.</span>
                      <div className={`text-xs sm:text-sm font-black truncate ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                        {data.voyageStatus.voyageNumber || '001'}
                      </div>
                    </div>
                    <div className={`p-2 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'} space-y-0.5 min-w-0`}>
                      <span className="text-[7.5px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest block truncate">Departure</span>
                      <div className={`text-xs sm:text-sm font-black truncate ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                        {data.voyageStatus.portOfDeparture || 'SINGAPORE'}
                      </div>
                    </div>
                    <div className={`p-2 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'} space-y-0.5 min-w-0`}>
                      <span className="text-[7.5px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest block truncate">Destination</span>
                      <div className={`text-xs sm:text-sm font-black truncate ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                        {data.voyageStatus.destinationPort || 'ROTTERDAM'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Large cards */}
        {data.dashboardCards.filter(c => c.visible && (c.type === 'last-report' || c.type === 'activity')).map(card => (
          <div key={card.id} className="relative group">
            {isEditMode && (
              <div className="absolute -top-2 -right-2 z-20 flex gap-1">
                <div className="flex bg-[#0A192F] rounded-full p-1 shadow-lg border border-white/10">
                  <button 
                    onClick={() => moveCard(card.id, 'up')}
                    className="text-white p-1 hover:text-[#4DE8E8] transition-colors"
                  >
                    <ChevronUp size={12} className="sm:w-3.5 sm:h-3.5" />
                  </button>
                  <button 
                    onClick={() => moveCard(card.id, 'down')}
                    className="text-white p-1 hover:text-[#4DE8E8] transition-colors"
                  >
                    <ChevronDown size={12} className="sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>
                <button 
                  onClick={() => setEditingCardId(editingCardId === card.id ? null : card.id)}
                  className="bg-[#00A8A8] text-white p-1.5 sm:p-2 rounded-full shadow-lg"
                >
                  <Edit2 size={12} className="sm:w-3.5 sm:h-3.5" />
                </button>
                <button 
                  onClick={() => removeCard(card.id)}
                  className="bg-red-500 text-white p-1.5 sm:p-2 rounded-full shadow-lg"
                >
                  <X size={12} className="sm:w-3.5 sm:h-3.5" />
                </button>
              </div>
            )}

            {editingCardId === card.id && (
              <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm rounded-2xl sm:rounded-[32px] flex flex-col items-center justify-center p-4 sm:p-6 gap-3 sm:gap-4">
                <div className="w-full max-w-xs space-y-2">
                  <label className="text-[10px] font-black text-[#4DE8E8] uppercase tracking-widest">Card Title</label>
                  <input 
                    type="text" 
                    value={card.title}
                    onChange={(e) => updateCardTitle(card.id, e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl p-3 sm:p-4 text-white text-xs sm:text-sm font-black uppercase focus:outline-none focus:border-[#00A8A8]"
                  />
                </div>
                <button 
                  onClick={() => setEditingCardId(null)}
                  className="bg-[#00A8A8] text-[#0A192F] px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-cyan-500/20"
                >
                  Save Changes
                </button>
              </div>
            )}

            {card.type === 'last-report' && (
              <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md rounded-2xl sm:rounded-[32px] shadow-2xl border overflow-hidden`}>
                <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="bg-[#00A8A8]/10 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl shrink-0">
                      <FileText size={18} className="text-[#00A8A8] sm:w-[22px] sm:h-[22px]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className={`font-black text-xs sm:text-sm tracking-widest uppercase truncate ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{card.title}</h3>
                      <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider sm:tracking-[0.2em] mt-0.5 truncate">Summary of previous entry</p>
                    </div>
                  </div>
                  {lastReport && (
                    <div className="flex flex-col items-end shrink-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 text-[#00A8A8] bg-[#00A8A8]/10 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full border border-[#00A8A8]/20">
                        {situationIcons[lastReport.situation]}
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">{lastReport.situation}</span>
                      </div>
                      <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {new Date(lastReport.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4 sm:p-6 space-y-5 sm:space-y-8">
                  {/* ROB Summary Row */}
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-wider sm:tracking-[0.3em] block">ROB Summary</span>
                      <div className="flex gap-1.5 sm:gap-2">
                        <button 
                          onClick={() => setShowBunkerModal(true)}
                          className="flex items-center gap-1 sm:gap-1.5 text-[7px] sm:text-[8px] font-black text-[#4DE8E8] bg-[#4DE8E8]/10 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-[#4DE8E8]/20 uppercase tracking-widest hover:bg-[#4DE8E8]/20 transition-all"
                        >
                          <Plus size={10} className="sm:w-3 sm:h-3" />
                          Record Bunker
                        </button>
                        {onNavigateToReport && (
                          <button 
                            onClick={onNavigateToReport}
                            className="flex items-center gap-1 sm:gap-1.5 text-[7px] sm:text-[8px] font-black text-[#00A8A8] bg-[#00A8A8]/10 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-[#00A8A8]/20 uppercase tracking-widest hover:bg-[#00A8A8]/20 transition-all"
                          >
                            <FileText size={10} className="sm:w-3 sm:h-3" />
                            Daily Report
                          </button>
                        )}
                        {data.department !== 'deck' && (
                          <button 
                            onClick={() => onOpenSettings('settings-oil')}
                            className="flex items-center gap-1 sm:gap-1.5 text-[7px] sm:text-[8px] font-black text-[#00A8A8] uppercase tracking-widest hover:opacity-80 transition-opacity"
                          >
                            <Settings2 size={10} className="sm:w-3 sm:h-3" />
                            Manage Oils
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Oil ROB Inventory Cards */}
                    <div className="space-y-2 sm:space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider sm:tracking-[0.2em] block">Lubricating Oil ROB (Stock in Liters)</span>
                        <span className="text-[7.5px] font-bold text-orange-400 uppercase tracking-widest">Live Tank Telemetry</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {data.oilTypes.map(oil => {
                          const robValue = oil.rob;
                          const robNum = parseFloat(robValue) || 0;
                          const capNum = parseFloat(oil.capacity) || 0;
                          const thresh = parseFloat(oil.threshold) || 0;
                          const pct = capNum > 0 ? (robNum / capNum) * 100 : 100;
                          const isCritical15 = capNum > 0 && pct < 15;
                          const isLow = (thresh > 0 && robNum <= thresh) || isCritical15;
                          return (
                            <div key={oil.id} className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all ${
                              isCritical15 
                                ? 'bg-red-500/10 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                                : theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'
                            } flex flex-col justify-between`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-wider text-orange-400 truncate mr-1">{oil.name}</span>
                                {isCritical15 ? (
                                  <span className="text-[6.5px] font-black text-red-400 bg-red-400/20 px-1 py-0.5 rounded border border-red-500/30 animate-pulse">&lt;15%</span>
                                ) : isLow ? (
                                  <span className="text-[6.5px] font-black text-red-400 bg-red-400/10 px-1 py-0.5 rounded">LOW</span>
                                ) : null}
                              </div>
                              <div className="flex items-baseline justify-between mt-1">
                                <span className={`text-sm sm:text-base font-black ${isCritical15 ? 'text-red-400' : theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{robValue}</span>
                                <span className="text-[7.5px] sm:text-[8.5px] text-slate-400 font-bold ml-1">L</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Consumption Details */}
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-wider sm:tracking-[0.3em] block">Machinery Consumption Details</span>
                      <button 
                        onClick={() => onOpenSettings('settings-machinery')}
                        className="flex items-center gap-1 sm:gap-1.5 text-[7px] sm:text-[8px] font-black text-[#00A8A8] uppercase tracking-widest hover:opacity-80 transition-opacity"
                      >
                        <Plus size={10} className="sm:w-3 sm:h-3" />
                        Manage
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {machineryList.map(m => (
                        <div key={m.id} className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border flex items-center gap-3 sm:gap-4 ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                          <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl flex-shrink-0 ${theme === 'dark' ? 'bg-white/5 text-[#4DE8E8]' : 'bg-[#0A3161]/5 text-[#0A3161]'}`}>
                            {m.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`font-black text-[9px] sm:text-[10px] uppercase tracking-tight truncate block ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{m.name}</span>
                            <div className="flex flex-wrap gap-x-3 sm:gap-x-4 gap-y-0.5 sm:gap-y-1 mt-0.5 sm:mt-1">
                              {data.oilTypes.filter(o => m.usedOils.includes(o.id)).map(o => (
                                <div key={o.id} className="flex items-center gap-1">
                                  <span className="text-[7px] sm:text-[8px] font-bold text-orange-400 uppercase">{o.name}:</span>
                                  <span className={`text-[9px] sm:text-[10px] font-black ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                                    {getLastReportValue(m.name, o.name)} <span className="text-[7px] opacity-60">L</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {card.type === 'activity' && (
              <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[28px] shadow-2xl border space-y-3 sm:space-y-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="bg-[#4DE8E8]/10 p-1.5 sm:p-2 rounded-lg sm:rounded-xl">
                      <Clock size={16} className="text-[#4DE8E8] sm:w-5 sm:h-5" />
                    </div>
                    <h3 className={`font-black text-xs sm:text-sm tracking-wider uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{card.title}</h3>
                  </div>
                  <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">{todayLogs.length} Entries</span>
                </div>
                
                <div className="space-y-2 sm:space-y-3">
                  {todayLogs.length > 0 ? (
                    todayLogs.map(log => (
                      <div key={log.id} className={`flex items-center justify-between p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shadow-sm border shrink-0 ${theme === 'dark' ? 'bg-[#0A192F] border-white/10' : 'bg-white border-slate-100'}`}>
                            <Activity size={16} className="text-[#4DE8E8] sm:w-[18px] sm:h-[18px]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <span className={`font-black text-[11px] sm:text-xs truncate ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{log.machineryName}</span>
                              <span className="text-[7px] sm:text-[8px] font-bold text-[#00A8A8] bg-[#00A8A8]/10 px-1 sm:px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0">{log.type}</span>
                              {log.situation && (
                                <span className="text-[7px] sm:text-[8px] font-bold text-orange-400 bg-orange-400/10 px-1 sm:px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0">{log.situation}</span>
                              )}
                            </div>
                            <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">
                              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <div className="text-right whitespace-nowrap shrink-0 ml-2">
                          <span className={`font-black text-base sm:text-lg ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{log.value}</span>
                          <span className="text-[8px] sm:text-[9px] font-black text-slate-400 ml-1 uppercase">{log.unit}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 sm:py-8 text-center space-y-2">
                      <div className="text-slate-500 opacity-20 flex justify-center">
                        <Activity size={36} className="sm:w-12 sm:h-12" />
                      </div>
                      <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">No entries recorded today</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {isEditMode && (
          <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
              <Plus size={14} className="text-[#00A8A8] sm:w-4 sm:h-4" />
              <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Hidden Components</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.dashboardCards.filter(c => !c.visible).map(card => (
                <button 
                  key={card.id}
                  onClick={() => addCard(card.id)}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-3 bg-[#00A8A8]/10 text-[#00A8A8] rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest border border-[#00A8A8]/20 hover:bg-[#00A8A8]/20 transition-all"
                >
                  <Plus size={12} className="sm:w-3.5 sm:h-3.5" />
                  Add {card.title}
                </button>
              ))}
              {data.dashboardCards.filter(c => !c.visible).length === 0 && (
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 italic">All components are currently visible.</p>
              )}
            </div>
          </div>
        )}

        {/* Edit Mode Toggle at bottom */}
        {data.department !== 'deck' && (
          <div className="flex justify-center pt-6 pb-8 sm:pt-8 sm:pb-12">
            <button 
              onClick={() => setIsEditMode(!isEditMode)}
              className={`flex items-center gap-2.5 sm:gap-3 px-6 py-3 sm:px-8 sm:py-4 rounded-full font-black text-xs sm:text-sm uppercase tracking-widest transition-all shadow-2xl ${
                isEditMode 
                  ? 'bg-[#4DE8E8] text-[#0A192F] shadow-[0_0_30px_rgba(77,232,232,0.4)]' 
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {isEditMode ? <Check size={18} className="sm:w-5 sm:h-5" /> : <Layout size={18} className="sm:w-5 sm:h-5" />}
              {isEditMode ? 'Finish Customizing' : 'Customize Dashboard'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

const FOView = ({ data, setData, onOpenSettings, theme, fuelType, onSubmit }: { data: OnboardingData, setData: React.Dispatch<React.SetStateAction<OnboardingData>>, onOpenSettings: () => void, theme: 'dark' | 'light', fuelType?: FuelType, onSubmit: () => void }) => {
  const getFuelColor = (type: string) => {
    const upperType = type.toUpperCase();
    if (upperType.includes('FO')) return '#FF4D4D';
    if (upperType.includes('DO')) return '#FF80BF';
    return '#4DE8E8';
  };
  const accentColor = fuelType ? getFuelColor(fuelType.type) : '#4DE8E8';

  const handleConsumptionChange = (machineryId: string, value: string) => {
    if (!fuelType) return;
    const machinery = data.machinery.find(m => m.id === machineryId);
    const targetName = machinery?.name || 'Unknown';
    
    const newFuelConsumption = { ...data.fuelConsumptionData };
    
    // Synchronize all machinery with the same name
    data.machinery.forEach(m => {
      if (m.name === targetName) {
        if (!newFuelConsumption[m.id]) newFuelConsumption[m.id] = {};
        newFuelConsumption[m.id][fuelType.id] = value;
      }
    });
    
    // Update logs
    const logDate = data.voyageStatus.date;
    const logTime = data.voyageStatus.time;
    const logSituation = data.voyageStatus.situation;
    
    const timestamp = `${logDate}T${logTime}:00`;
    const existingLogIndex = data.consumptionLogs.findIndex(log => 
      log.machineryName === (machinery?.name || 'Unknown') && 
      log.type === fuelType.type && 
      log.timestamp === timestamp &&
      log.situation === logSituation
    );
    
    let newLogs = [...data.consumptionLogs];
    const fuelRobSnapshot = data.fuelTypes.reduce((acc, f) => ({ ...acc, [f.id]: f.rob }), {});
    const oilRobSnapshot = data.oilTypes.reduce((acc, o) => ({ ...acc, [o.id]: o.rob }), {});

    if (existingLogIndex >= 0) {
      newLogs[existingLogIndex] = {
        ...newLogs[existingLogIndex],
        value,
        timestamp,
        situation: logSituation,
        fuelRobSnapshot,
        oilRobSnapshot,
        lastModified: Date.now()
      };
    } else if (value !== '') {
      newLogs.push({
        id: uuidv4(),
        timestamp,
        machineryName: machinery?.name || 'Unknown',
        type: fuelType.type,
        value,
        unit: 'MT',
        situation: logSituation,
        fuelRobSnapshot,
        oilRobSnapshot,
        lastModified: Date.now()
      });
    }
    
    setData(recalculateRob({ ...data, fuelConsumptionData: newFuelConsumption, consumptionLogs: newLogs }));
  };

  const situationIcons: Record<string, React.ReactNode> = {
    'Noon': <Sun size={14} />,
    'Standby': <Clock size={14} />,
    'FWE': <XCircle size={14} />,
    'COSP': <Navigation size={14} />,
    'EOSP': <Flag size={14} />,
    'Departure': <Ship size={14} />,
    'Alongside': <Layout size={14} />,
    'Anchor': <Anchor size={14} />
  };

  const situations = ['Noon', 'Standby', 'FWE', 'COSP', 'EOSP', 'Departure', 'Alongside', 'Anchor'];

  return (
    <div className={`pb-28 sm:pb-32 min-h-screen ${theme === 'dark' ? 'bg-[#050B15]' : 'bg-[#F8FAFC]'}`}>
      <header className={`${theme === 'dark' ? 'bg-[#0A192F] border-white/10' : 'bg-[#0A3161] border-white/10'} text-white p-4 sm:p-6 pt-8 sm:pt-12 rounded-b-3xl sm:rounded-b-[40px] shadow-2xl border-b relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32" style={{ backgroundColor: `${accentColor}1A` }} />
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/10">
              <Fuel size={20} className="sm:w-6 sm:h-6" style={{ color: accentColor }} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tighter italic uppercase text-white leading-none">{fuelType?.type || 'FUEL OIL'}</h1>
              <p style={{ color: accentColor }} className="text-[8px] sm:text-[9px] font-bold tracking-[0.3em] sm:tracking-[0.4em] uppercase opacity-80 mt-1">Inventory Control</p>
            </div>
          </div>
          <button 
            onClick={onOpenSettings}
            className="p-2 sm:p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
          >
            <Settings2 size={18} className="sm:w-5 sm:h-5" style={{ color: accentColor }} />
          </button>
        </div>
      </header>
      <main className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-md mx-auto">
        {/* Entry Context (Date, Time, Situation) */}
        <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[28px] shadow-2xl border space-y-4 sm:space-y-6`}>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Report Date</label>
              <div className={`flex items-center gap-2 p-2.5 sm:p-3 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <Calendar size={14} style={{ color: accentColor }} />
                <input 
                  type="date" 
                  value={data.voyageStatus.date}
                  onChange={(e) => setData({ ...data, voyageStatus: { ...data.voyageStatus, date: e.target.value } })}
                  className={`bg-transparent border-none p-0 text-[11px] sm:text-xs font-bold focus:ring-0 focus:outline-none cursor-pointer w-full ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                />
              </div>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Report Time</label>
              <div className={`flex items-center gap-2 p-2.5 sm:p-3 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <Clock size={14} style={{ color: accentColor }} />
                <input 
                  type="time" 
                  value={data.voyageStatus.time}
                  onChange={(e) => setData({ ...data, voyageStatus: { ...data.voyageStatus, time: e.target.value } })}
                  className={`bg-transparent border-none p-0 text-[11px] sm:text-xs font-bold focus:ring-0 focus:outline-none cursor-pointer w-full ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-2.5 sm:space-y-3">
            <label className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest block">Select Situation</label>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {situations.map(s => (
                <button
                  key={s}
                  onClick={() => setData({ ...data, voyageStatus: { ...data.voyageStatus, situation: s } })}
                  className={`flex flex-col items-center justify-center gap-1 sm:gap-1.5 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border transition-all ${
                    data.voyageStatus.situation === s 
                      ? 'border-transparent text-[#0A192F] shadow-lg scale-[1.02]' 
                      : theme === 'dark' 
                        ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10' 
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                  style={{ 
                    backgroundColor: data.voyageStatus.situation === s ? accentColor : undefined,
                    boxShadow: data.voyageStatus.situation === s ? `0 10px 20px ${accentColor}33` : undefined
                  }}
                >
                  <div className={data.voyageStatus.situation === s ? 'text-[#0A192F]' : ''} style={{ color: data.voyageStatus.situation === s ? undefined : accentColor }}>
                    {situationIcons[s]}
                  </div>
                  <span className="text-[7.5px] sm:text-[8px] font-black uppercase tracking-tighter">{s}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Machinery Consumption Entry */}
        <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[28px] shadow-2xl border space-y-3 sm:space-y-4`}>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-xl" style={{ backgroundColor: `${accentColor}1A` }}>
              <Activity size={18} className="sm:w-5 sm:h-5" style={{ color: accentColor }} />
            </div>
            <h3 className={`font-black text-xs sm:text-sm tracking-wider uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>Consumption (MT)</h3>
          </div>
          <div className="space-y-2.5 sm:space-y-3">
            {data.machinery.reduce((acc, m) => {
              if (!acc.find(item => item.name === m.name)) acc.push(m);
              return acc;
            }, [] as MachineryItem[]).map(m => (
              <div key={m.id} className={`flex flex-col p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center justify-between mb-2.5 sm:mb-3">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shadow-sm border ${theme === 'dark' ? 'bg-[#0A192F] border-white/10' : 'bg-white border-slate-100'}`}>
                      <span style={{ color: accentColor }}>{getIcon(m.icon)}</span>
                    </div>
                    <div>
                      <span className={`font-black text-xs sm:text-sm block ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{m.name}</span>
                      <span className="text-[7.5px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest">{m.desc}</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-2 sm:gap-4">
                  <div className="space-y-1">
                    <label className="text-[7.5px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest">Cons (MT)</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        step="0.1"
                        value={data.fuelConsumptionData[m.id]?.[fuelType?.id || ''] || ''}
                        onChange={(e) => handleConsumptionChange(m.id, e.target.value)}
                        placeholder="0"
                        className={`w-full bg-transparent border-b border-slate-200 dark:border-white/10 focus:border-[#00A8A8] transition-all text-right font-black text-xs sm:text-sm p-1 focus:outline-none placeholder:opacity-30 ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                      />
                      <span className="text-[7.5px] sm:text-[8px] font-black text-slate-400">MT</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={onSubmit}
          style={{ background: `linear-gradient(to right, ${accentColor}, ${accentColor}CC)`, boxShadow: `0 20px 40px ${accentColor}33` }}
          className="w-full text-[#0A192F] py-3.5 sm:py-5 rounded-2xl sm:rounded-[28px] font-black text-xs sm:text-sm uppercase tracking-[0.2em] active:scale-95 transition-all flex items-center justify-center gap-2.5 sm:gap-3"
        >
          <CheckCircle size={18} className="sm:w-5 sm:h-5" />
          NEXT REPORT
        </button>

        <div className="grid grid-cols-1">
          <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-5 rounded-2xl sm:rounded-[24px] shadow-xl border group transition-all hover:translate-y-[-2px]`}>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className={`p-1.5 sm:p-2 rounded-lg ${theme === 'dark' ? 'bg-white/5 text-slate-400' : 'bg-[#0A3161]/5 text-[#0A3161]'}`}>
                <Fuel size={16} className="sm:w-4 sm:h-4" />
              </div>
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{fuelType?.type || 'FO'} ROB</span>
            </div>
            <div className={`text-2xl sm:text-3xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
              {fuelType?.rob || '0.0'} <span className="text-[10px] sm:text-xs font-bold text-slate-400 ml-1">MT</span>
            </div>
          </div>
        </div>

        <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[28px] shadow-2xl border space-y-4 sm:space-y-6`}>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="bg-[#00A8A8]/10 p-1.5 sm:p-2 rounded-xl">
              <BarChart3 size={18} className="text-[#00A8A8] sm:w-5 sm:h-5" />
            </div>
            <h3 className={`font-black text-xs sm:text-sm tracking-wider uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>Inventory Breakdown</h3>
          </div>
          <div className="space-y-2.5 sm:space-y-3">
            <div className={`flex justify-between items-center p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border transition-all hover:scale-[1.01] ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shadow-sm border ${theme === 'dark' ? 'bg-[#0A192F] border-white/10' : 'bg-white border-slate-100'}`}>
                  <Fuel size={16} className="text-[#00A8A8] sm:w-4 sm:h-4" />
                </div>
                <div>
                  <span className={`font-black text-xs sm:text-sm block ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{fuelType?.type || 'FO'}</span>
                  <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest">Main Storage</span>
                </div>
              </div>
              <div className="text-right">
                <span className={`font-black text-base sm:text-xl block ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{fuelType?.consumption || '0.0'} MT</span>
                <span className="text-[8px] sm:text-[9px] font-bold text-[#00A8A8] uppercase tracking-widest">65% Capacity</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const LOView = ({ data, setData, onOpenSettings, theme, onSubmit }: { data: OnboardingData, setData: React.Dispatch<React.SetStateAction<OnboardingData>>, onOpenSettings: () => void, theme: 'dark' | 'light', onSubmit: () => void }) => {
  const handleConsumptionChange = (machineryId: string, oilTypeId: string, value: string) => {
    const machinery = data.machinery.find(m => m.id === machineryId);
    const targetName = machinery?.name || 'Unknown';
    
    const newOilConsumption = { ...data.oilConsumptionData };
    
    // Synchronize all machinery with the same name
    data.machinery.forEach(m => {
      if (m.name === targetName) {
        if (!newOilConsumption[m.id]) newOilConsumption[m.id] = {};
        newOilConsumption[m.id][oilTypeId] = value;
      }
    });
    
    // Update logs
    const oilType = data.oilTypes.find(o => o.id === oilTypeId);
    const logDate = data.voyageStatus.date;
    const logTime = data.voyageStatus.time;
    const logSituation = data.voyageStatus.situation;
    
    const timestamp = `${logDate}T${logTime}:00`;
    const existingLogIndex = data.consumptionLogs.findIndex(log => 
      log.machineryName === (machinery?.name || 'Unknown') && 
      log.type === (oilType?.name || 'Unknown') && 
      log.timestamp === timestamp &&
      log.situation === logSituation
    );
    
    let newLogs = [...data.consumptionLogs];
    const fuelRobSnapshot = data.fuelTypes.reduce((acc, f) => ({ ...acc, [f.id]: f.rob }), {});
    const oilRobSnapshot = data.oilTypes.reduce((acc, o) => ({ ...acc, [o.id]: o.rob }), {});

    if (existingLogIndex >= 0) {
      newLogs[existingLogIndex] = {
        ...newLogs[existingLogIndex],
        value,
        timestamp,
        situation: logSituation,
        fuelRobSnapshot,
        oilRobSnapshot,
        lastModified: Date.now()
      };
    } else if (value !== '') {
      newLogs.push({
        id: uuidv4(),
        timestamp,
        machineryName: machinery?.name || 'Unknown',
        type: oilType?.name || 'Unknown',
        value,
        unit: 'L',
        situation: logSituation,
        fuelRobSnapshot,
        oilRobSnapshot,
        lastModified: Date.now()
      });
    }
    
    setData(recalculateRob({ ...data, oilConsumptionData: newOilConsumption, consumptionLogs: newLogs }));
  };

  const situationIcons: Record<string, React.ReactNode> = {
    'Noon': <Sun size={14} />,
    'Standby': <Clock size={14} />,
    'FWE': <XCircle size={14} />,
    'COSP': <Navigation size={14} />,
    'EOSP': <Flag size={14} />,
    'Departure': <Ship size={14} />,
    'Alongside': <Layout size={14} />,
    'Anchor': <Anchor size={14} />
  };

  const situations = ['Noon', 'Standby', 'FWE', 'COSP', 'EOSP', 'Departure', 'Alongside', 'Anchor'];

  const getIcon = (iconType: string) => {
    switch (iconType) {
      case 'me': return <Cpu size={18} />;
      case 'ge': return <Zap size={18} />;
      case 'blr': return <Flame size={18} />;
      default: return <Settings2 size={18} />;
    }
  };

  return (
    <div className={`pb-28 sm:pb-32 min-h-screen ${theme === 'dark' ? 'bg-[#050B15]' : 'bg-[#F8FAFC]'}`}>
      <header className={`${theme === 'dark' ? 'bg-[#0A192F] border-white/10' : 'bg-[#0A3161] border-white/10'} text-white p-4 sm:p-6 pt-8 sm:pt-12 rounded-b-3xl sm:rounded-b-[40px] shadow-2xl border-b relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/10">
              <Droplets size={20} className="text-orange-400 sm:w-6 sm:h-6" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tighter italic uppercase text-white leading-none">LUBE OIL</h1>
              <p className="text-[#4DE8E8] text-[8px] sm:text-[9px] font-bold tracking-[0.3em] sm:tracking-[0.4em] uppercase opacity-80 mt-1">Lubricants Monitoring</p>
            </div>
          </div>
          <button 
            onClick={onOpenSettings}
            className="p-2 sm:p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
          >
            <Settings2 size={18} className="text-[#4DE8E8] sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>
      <main className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-md mx-auto">
        {/* Entry Context (Date, Time, Situation) */}
        <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[28px] shadow-2xl border space-y-4 sm:space-y-6`}>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Report Date</label>
              <div className={`flex items-center gap-2 p-2.5 sm:p-3 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <Calendar size={14} className="text-orange-400" />
                <input 
                  type="date" 
                  value={data.voyageStatus.date}
                  onChange={(e) => setData({ ...data, voyageStatus: { ...data.voyageStatus, date: e.target.value } })}
                  className={`bg-transparent border-none p-0 text-[11px] sm:text-xs font-bold focus:ring-0 focus:outline-none cursor-pointer w-full ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                />
              </div>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Report Time</label>
              <div className={`flex items-center gap-2 p-2.5 sm:p-3 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <Clock size={14} className="text-orange-400" />
                <input 
                  type="time" 
                  value={data.voyageStatus.time}
                  onChange={(e) => setData({ ...data, voyageStatus: { ...data.voyageStatus, time: e.target.value } })}
                  className={`bg-transparent border-none p-0 text-[11px] sm:text-xs font-bold focus:ring-0 focus:outline-none cursor-pointer w-full ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-2.5 sm:space-y-3">
            <label className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest block">Select Situation</label>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {situations.map(s => (
                <button
                  key={s}
                  onClick={() => setData({ ...data, voyageStatus: { ...data.voyageStatus, situation: s } })}
                  className={`flex flex-col items-center justify-center gap-1 sm:gap-1.5 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border transition-all ${
                    data.voyageStatus.situation === s 
                      ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20 scale-[1.02]' 
                      : theme === 'dark' 
                        ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10' 
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <div className={data.voyageStatus.situation === s ? 'text-white' : 'text-orange-400'}>
                    {situationIcons[s]}
                  </div>
                  <span className="text-[7.5px] sm:text-[8px] font-black uppercase tracking-tighter">{s}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Machinery LO Entry */}
        <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[28px] shadow-2xl border space-y-4 sm:space-y-6`}>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="bg-orange-500/10 p-1.5 sm:p-2 rounded-xl">
              <Activity size={18} className="text-orange-500 sm:w-5 sm:h-5" />
            </div>
            <h3 className={`font-black text-xs sm:text-sm tracking-wider uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>Consumption (L)</h3>
          </div>
          <div className="space-y-4 sm:space-y-6">
            {data.machinery.reduce((acc, m) => {
              const existing = acc.find(item => item.name === m.name);
              if (existing) {
                // Merge usedOils for the unique display item
                existing.usedOils = Array.from(new Set([...existing.usedOils, ...m.usedOils]));
              } else {
                acc.push({ ...m });
              }
              return acc;
            }, [] as MachineryItem[]).map(m => (
              <div key={m.id} className="space-y-2.5 sm:space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border ${theme === 'dark' ? 'bg-[#0A192F] border-white/10' : 'bg-white border-slate-100'}`}>
                    <span className="text-orange-500">{getIcon(m.icon)}</span>
                  </div>
                  <span className={`font-black text-[9px] sm:text-[10px] uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{m.name}</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {data.oilTypes.filter(o => m.usedOils.includes(o.id)).map(o => (
                    <div key={o.id} className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                      <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider">{o.name}</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number"
                          step="0.1"
                          value={data.oilConsumptionData[m.id]?.[o.id] || ''}
                          onChange={(e) => handleConsumptionChange(m.id, o.id, e.target.value)}
                          placeholder="0"
                          className={`w-14 sm:w-16 bg-transparent border-b border-white/10 focus:border-orange-500 transition-all text-right font-black text-xs sm:text-sm p-1 focus:outline-none placeholder:opacity-30 ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                        />
                        <span className="text-[7.5px] sm:text-[8px] font-black text-slate-400 uppercase">L</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={onSubmit}
          className="w-full bg-gradient-to-r from-orange-400 to-orange-600 text-white py-3.5 sm:py-5 rounded-2xl sm:rounded-[28px] font-black text-xs sm:text-sm uppercase tracking-[0.2em] shadow-2xl shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2.5 sm:gap-3"
        >
          <CheckCircle size={18} className="sm:w-5 sm:h-5" />
          SUBMIT REPORT
        </button>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
          {data.oilTypes.slice(0, 2).map(oil => (
            <div key={oil.id} className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-3.5 sm:p-5 rounded-2xl sm:rounded-[24px] shadow-xl border group transition-all hover:translate-y-[-2px]`}>
              <div className="flex items-center justify-between mb-2.5 sm:mb-4">
                <div className={`p-1.5 sm:p-2 rounded-lg ${theme === 'dark' ? 'bg-white/5 text-orange-400' : 'bg-orange-50 text-orange-600'}`}>
                  <Droplets size={16} className="sm:w-4 sm:h-4" />
                </div>
                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{oil.name.split(' ').pop()} ROB</span>
              </div>
              <div className={`text-2xl sm:text-3xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                {oil.rob}<span className="text-[10px] sm:text-xs font-bold text-slate-400 ml-1">L</span>
              </div>
            </div>
          ))}
        </div>

        <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[28px] shadow-2xl border space-y-4 sm:space-y-6`}>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="bg-orange-500/10 p-1.5 sm:p-2 rounded-xl">
              <Droplets size={18} className="text-orange-500 sm:w-5 sm:h-5" />
            </div>
            <h3 className={`font-black text-xs sm:text-sm tracking-wider uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>Stock Breakdown</h3>
          </div>
          <div className="space-y-2.5 sm:space-y-3">
            {data.oilTypes.map(o => (
              <div key={o.id} className={`flex justify-between items-center p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border transition-all hover:scale-[1.01] ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shadow-sm border ${theme === 'dark' ? 'bg-[#0A192F] border-white/10' : 'bg-white border-slate-100'}`}>
                    <Droplets size={16} className="text-orange-500 sm:w-4 sm:h-4" />
                  </div>
                  <div>
                    <span className={`font-black text-xs sm:text-sm block ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{o.name}</span>
                    <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest">Storage Tank</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`font-black text-base sm:text-xl block ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{o.threshold} L</span>
                  <span className="text-[8px] sm:text-[9px] font-bold text-orange-500 uppercase tracking-widest">Low Level Alert</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

const ReportView = ({ 
  data, 
  setData, 
  onOpenSettings, 
  theme,
  setShowBunkerModal
}: { 
  data: OnboardingData, 
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>, 
  onOpenSettings: (section?: string) => void, 
  theme: 'dark' | 'light',
  setShowBunkerModal?: (show: boolean) => void
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'entry' | 'history'>('entry');
  
  // Mixed Event / Situation & Consumption Form State
  const [reportDate, setReportDate] = useState(data.voyageStatus.date || new Date().toISOString().split('T')[0]);
  const [reportTime, setReportTime] = useState(data.voyageStatus.time || "12:00");
  const [reportSituation, setReportSituation] = useState(data.voyageStatus.situation || 'Noon');
  const [voyageNum, setVoyageNum] = useState(data.voyageStatus.voyageNumber || '001');
  const [depPort, setDepPort] = useState(data.voyageStatus.portOfDeparture || 'SINGAPORE');
  const [destPort, setDestPort] = useState(data.voyageStatus.destinationPort || 'ROTTERDAM');
  const [selectedStage, setSelectedStage] = useState(data.voyageStatus.voyageStage || 'noon');
  const [eventRemarks, setEventRemarks] = useState('');
  
  // Fuel inputs: [machineryId]: { [fuelId]: string }
  const [fuelInputs, setFuelInputs] = useState<Record<string, Record<string, string>>>(() => {
    return data.fuelConsumptionData || {};
  });
  
  // Running hours: [machineryId]: string
  const [machineryHours, setMachineryHours] = useState<Record<string, string>>(() => {
    return data.machineryHours || {};
  });

  // Oil inputs: [machineryId]: { [oilId]: string }
  const [oilInputs, setOilInputs] = useState<Record<string, Record<string, string>>>(() => {
    return data.oilConsumptionData || {};
  });

  // Active fuel grade filter in entry view
  const [selectedFuelFilter, setSelectedFuelFilter] = useState<string>('all');

  // Success / notification banner
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // History filtering & search
  const [historyFilter, setHistoryFilter] = useState<string>('ALL');
  const [historySearch, setHistorySearch] = useState<string>('');

  // Editing existing event
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // Ensure ROB is fresh
  useEffect(() => {
    const newData = recalculateRob(data);
    if (JSON.stringify(newData.consumptionLogs) !== JSON.stringify(data.consumptionLogs) || 
        JSON.stringify(newData.fuelTypes) !== JSON.stringify(data.fuelTypes) ||
        JSON.stringify(newData.oilTypes) !== JSON.stringify(data.oilTypes)) {
      setData(newData);
    }
  }, []);

  const situationIcons: Record<string, React.ReactNode> = {
    'Noon': <Sun size={13} />,
    'Standby': <Clock size={13} />,
    'FWE': <XCircle size={13} />,
    'COSP': <Navigation size={13} />,
    'EOSP': <Flag size={13} />,
    'Departure': <Ship size={13} />,
    'Alongside': <Layout size={13} />,
    'Anchor': <Anchor size={13} />,
    'Unknown': <Activity size={13} />
  };

  const situations = ['Noon', 'Standby', 'FWE', 'COSP', 'EOSP', 'Departure', 'Alongside', 'Anchor'];

  const EDITABLE_WAYPOINTS = [
    { id: 'port-dep', label: 'port', sub: 'Departure Port', percent: 6, type: 'dot', defaultSituation: 'Departure', subText: depPort || 'SIN' },
    { id: 'anchor-dep', label: 'anchor', sub: 'Departure Anchor', percent: 21, type: 'tick', defaultSituation: 'Anchor', subText: '' },
    { id: 'sea-1', label: 'COSP', sub: 'COSP (Commence Sea Passage)', percent: 36, type: 'subtick', defaultSituation: 'COSP', subText: '' },
    { id: 'noon', label: 'Noon', sub: 'Noon Report (12:00 Reset)', percent: 50, type: 'noon-dot', defaultSituation: 'Noon', subText: '' },
    { id: 'sea-2', label: 'EOSP', sub: 'EOSP (End of Sea Passage)', percent: 64, type: 'subtick', defaultSituation: 'EOSP', subText: '' },
    { id: 'anchor-arr', label: 'anchor', sub: 'Arrival Anchor', percent: 79, type: 'tick', defaultSituation: 'Anchor', subText: '' },
    { id: 'port-arr', label: 'port', sub: 'Destination Port', percent: 94, type: 'dot', defaultSituation: 'FWE', subText: destPort || 'RTM' },
  ];

  const currentEditableWaypoint = EDITABLE_WAYPOINTS.find(w => w.id === selectedStage) || EDITABLE_WAYPOINTS[3];

  const handleSaveSituation = () => {
    const now = Date.now();
    const timestamp = `${reportDate}T${reportTime}:00`;

    let stage = selectedStage;
    if (reportSituation === 'Noon') stage = 'noon';
    else if (reportSituation === 'COSP') stage = 'sea-1';
    else if (reportSituation === 'EOSP') stage = 'sea-2';
    else if (reportSituation === 'FWE') stage = 'port-arr';
    else if (reportSituation === 'Departure' || reportSituation === 'Alongside') stage = 'port-dep';
    else if (reportSituation === 'Anchor') {
      if (stage !== 'anchor-arr' && stage !== 'anchor-dep') stage = 'anchor-dep';
    }

    const newLog: ConsumptionLog = {
      id: uuidv4(),
      timestamp,
      machineryName: 'Vessel Situation Update',
      type: 'STATUS',
      value: '0',
      unit: 'LOG',
      situation: reportSituation,
      hoursRun: '0',
      oilRobSnapshot: data.oilTypes.reduce((acc, o) => ({ ...acc, [o.id]: o.rob }), {}),
      fuelRobSnapshot: data.fuelTypes.reduce((acc, f) => ({ ...acc, [f.id]: f.rob }), {}),
      lastModified: now
    };

    const updatedData = recalculateRob({
      ...data,
      voyageStatus: {
        ...data.voyageStatus,
        date: reportDate,
        time: reportTime,
        situation: reportSituation,
        voyageStage: stage,
        voyageNumber: voyageNum,
        portOfDeparture: depPort,
        destinationPort: destPort
      },
      consumptionLogs: [...data.consumptionLogs, newLog],
      lastModified: now
    });

    setData(updatedData);
    setSubmitSuccess(`Vessel situation updated to "${reportSituation}" at ${reportTime} hrs! Synced with Dashboard.`);
    setEventRemarks('');
  };

  const getFuelColor = (type: string) => {
    const upperType = type.toUpperCase();
    if (upperType.includes('FO')) return '#FF4D4D';
    if (upperType.includes('DO')) return '#FF80BF';
    return '#4DE8E8';
  };

  // Deduplicated unique machinery list
  const uniqueMachinery = useMemo(() => {
    return data.machinery.reduce((acc, m) => {
      if (!acc.find(item => item.name === m.name)) acc.push(m);
      return acc;
    }, [] as MachineryItem[]);
  }, [data.machinery]);

  // Handle Fuel Input change
  const handleFuelChange = (machineryId: string, fuelId: string, val: string) => {
    const m = data.machinery.find(item => item.id === machineryId);
    const targetName = m?.name || 'Unknown';
    setFuelInputs(prev => {
      const next = { ...prev };
      data.machinery.forEach(item => {
        if (item.name === targetName) {
          if (!next[item.id]) next[item.id] = {};
          next[item.id] = { ...next[item.id], [fuelId]: val };
        }
      });
      return next;
    });
  };

  // Handle Hours change
  const handleHoursChange = (machineryId: string, val: string) => {
    const m = data.machinery.find(item => item.id === machineryId);
    const targetName = m?.name || 'Unknown';
    setMachineryHours(prev => {
      const next = { ...prev };
      data.machinery.forEach(item => {
        if (item.name === targetName) {
          next[item.id] = val;
        }
      });
      return next;
    });
  };

  // Handle Oil Input change
  const handleOilChange = (machineryId: string, oilId: string, val: string) => {
    const m = data.machinery.find(item => item.id === machineryId);
    const targetName = m?.name || 'Unknown';
    setOilInputs(prev => {
      const next = { ...prev };
      data.machinery.forEach(item => {
        if (item.name === targetName) {
          if (!next[item.id]) next[item.id] = {};
          next[item.id] = { ...next[item.id], [oilId]: val };
        }
      });
      return next;
    });
  };

  // Calculate entry totals
  const totalFuelConsEntered = useMemo(() => {
    let sum = 0;
    uniqueMachinery.forEach(m => {
      data.fuelTypes.forEach(f => {
        const val = parseFloat(fuelInputs[m.id]?.[f.id] || '0') || 0;
        sum += val;
      });
    });
    return sum;
  }, [fuelInputs, uniqueMachinery, data.fuelTypes]);

  const totalOilConsEntered = useMemo(() => {
    let sum = 0;
    uniqueMachinery.forEach(m => {
      data.oilTypes.forEach(o => {
        const val = parseFloat(oilInputs[m.id]?.[o.id] || '0') || 0;
        sum += val;
      });
    });
    return sum;
  }, [oilInputs, uniqueMachinery, data.oilTypes]);

  // Submit Daily Report
  const handleSubmitReport = () => {
    const timestamp = `${reportDate}T${reportTime}:00`;
    const newLogs: ConsumptionLog[] = [];
    const now = Date.now();

    // Snapshot current ROBs before this entry
    const fuelRobSnapshot = data.fuelTypes.reduce((acc, f) => ({ ...acc, [f.id]: f.rob }), {} as Record<string, string>);
    const oilRobSnapshot = data.oilTypes.reduce((acc, o) => ({ ...acc, [o.id]: o.rob }), {} as Record<string, string>);

    // Add fuel logs
    uniqueMachinery.forEach(m => {
      const hours = machineryHours[m.id] || '';
      data.fuelTypes.forEach(f => {
        const val = fuelInputs[m.id]?.[f.id] || '';
        if (parseFloat(val) > 0) {
          newLogs.push({
            id: uuidv4(),
            timestamp,
            machineryName: m.name,
            type: f.type,
            value: val,
            unit: 'MT',
            hoursRun: hours,
            situation: reportSituation,
            fuelRobSnapshot,
            oilRobSnapshot,
            lastModified: now
          });
        }
      });
    });

    // Add oil logs
    uniqueMachinery.forEach(m => {
      const hours = machineryHours[m.id] || '';
      data.oilTypes.forEach(o => {
        const val = oilInputs[m.id]?.[o.id] || '';
        if (parseFloat(val) > 0) {
          newLogs.push({
            id: uuidv4(),
            timestamp,
            machineryName: m.name,
            type: o.name,
            value: val,
            unit: 'L',
            hoursRun: hours,
            situation: reportSituation,
            fuelRobSnapshot,
            oilRobSnapshot,
            lastModified: now
          });
        }
      });
    });

    if (newLogs.length === 0) {
      newLogs.push({
        id: uuidv4(),
        timestamp,
        machineryName: 'Vessel Operations',
        type: data.fuelTypes[0]?.type || 'FO',
        value: '0.00',
        unit: 'MT',
        situation: reportSituation,
        fuelRobSnapshot,
        oilRobSnapshot,
        lastModified: now
      });
    }

    // Determine voyage stage to sync with timeline
    let newStage = data.voyageStatus.voyageStage;
    if (reportSituation === 'Noon') newStage = 'noon';
    else if (reportSituation === 'Anchor') {
      if (newStage !== 'anchor-arr' && newStage !== 'anchor-dep') newStage = 'anchor-dep';
    }
    else if (reportSituation === 'COSP') newStage = 'sea-1';
    else if (reportSituation === 'EOSP') newStage = 'sea-2';
    else if (reportSituation === 'FWE') newStage = 'port-arr';
    else if (reportSituation === 'Departure' || reportSituation === 'Alongside') newStage = 'port-dep';

    const updatedData = recalculateRob({
      ...data,
      voyageStatus: {
        ...data.voyageStatus,
        date: reportDate,
        time: reportTime,
        situation: reportSituation,
        voyageStage: newStage,
        voyageNumber: voyageNum,
        portOfDeparture: depPort,
        destinationPort: destPort
      },
      consumptionLogs: [...data.consumptionLogs, ...newLogs],
      fuelConsumptionData: {},
      oilConsumptionData: {},
      machineryHours: {},
      lastModified: now
    });

    setData(updatedData);
    setFuelInputs({});
    setOilInputs({});
    setMachineryHours({});
    setSubmitSuccess(`Report for ${reportSituation} (${reportDate} ${reportTime}) recorded and logged successfully!`);
    setActiveSubTab('history');
  };

  // Group logs by timestamp and situation
  const groupedByEvent = useMemo(() => {
    return data.consumptionLogs.reduce((acc, log) => {
      const eventKey = `${log.timestamp}|${log.situation || 'Unknown'}`;
      if (!acc[eventKey]) acc[eventKey] = [];
      acc[eventKey].push(log);
      return acc;
    }, {} as Record<string, typeof data.consumptionLogs>);
  }, [data.consumptionLogs]);

  // Sort events descending
  const sortedEventKeys = useMemo(() => {
    return Object.keys(groupedByEvent).sort((a, b) => {
      const [timeA] = a.split('|');
      const [timeB] = b.split('|');
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });
  }, [groupedByEvent]);

  // Filtered keys
  const filteredEventKeys = useMemo(() => {
    return sortedEventKeys.filter(key => {
      const [timestamp, situation] = key.split('|');
      if (historyFilter !== 'ALL' && situation.toUpperCase() !== historyFilter.toUpperCase()) {
        return false;
      }
      if (historySearch.trim()) {
        const query = historySearch.toLowerCase();
        if (!timestamp.toLowerCase().includes(query) && !situation.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [sortedEventKeys, historyFilter, historySearch]);

  const removeEvent = (eventKey: string) => {
    const [timestamp, situation] = eventKey.split('|');
    const newLogs = data.consumptionLogs.filter(log => !(log.timestamp === timestamp && log.situation === situation));
    const newData = recalculateRob({ ...data, consumptionLogs: newLogs });
    setData(newData);
  };

  const startEditing = (eventKey: string, logs: any[]) => {
    setEditingEvent(eventKey);
    const initialValues: Record<string, string> = {};
    logs.forEach(log => {
      initialValues[log.id] = log.value;
    });
    setEditValues(initialValues);
  };

  const saveEdit = () => {
    const newLogs = data.consumptionLogs.map(log => {
      if (editValues[log.id] !== undefined) {
        return { ...log, value: editValues[log.id] };
      }
      return log;
    });
    const newData = recalculateRob({ ...data, consumptionLogs: newLogs });
    setData(newData);
    setEditingEvent(null);
  };

  // Format Telex Summary for copying
  const copyTelex = (eventKey: string, logs: any[]) => {
    const [timestamp, situation] = eventKey.split('|');
    const dateObj = new Date(timestamp);
    const formattedDate = dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const fuelRob = logs[logs.length - 1]?.fuelRobSnapshot || {};
    const oilRob = logs[logs.length - 1]?.oilRobSnapshot || {};

    const fuelLogs = logs.filter(l => l.unit === 'MT' && parseFloat(l.value) > 0);
    const oilLogs = logs.filter(l => l.unit === 'L' && parseFloat(l.value) > 0);

    let telex = `========================================\n`;
    telex += `DAILY REPORT: ${situation.toUpperCase()}\n`;
    telex += `VESSEL: ${data.vesselName || 'MT Vast coral'} (IMO: ${data.imoNumber || '9392999'})\n`;
    telex += `VOYAGE: ${data.voyageStatus.voyageNumber || '001'} | ${data.voyageStatus.portOfDeparture || 'SINGAPORE'} -> ${data.voyageStatus.destinationPort || 'ROTTERDAM'}\n`;
    telex += `DATE/TIME: ${formattedDate} ${formattedTime}\n`;
    telex += `----------------------------------------\n`;
    telex += `FUEL CONSUMPTION (MT):\n`;
    if (fuelLogs.length > 0) {
      data.fuelTypes.forEach(f => {
        const items = fuelLogs.filter(l => l.type === f.type);
        if (items.length > 0) {
          const subtotal = items.reduce((s, it) => s + (parseFloat(it.value) || 0), 0);
          telex += ` • ${f.type}: ${subtotal.toFixed(2)} MT [${items.map(it => `${it.machineryName}: ${it.value}`).join(', ')}]\n`;
        }
      });
    } else {
      telex += ` • Nil\n`;
    }

    telex += `LUBE OIL CONSUMPTION (L):\n`;
    if (oilLogs.length > 0) {
      data.oilTypes.forEach(o => {
        const items = oilLogs.filter(l => l.type === o.name);
        if (items.length > 0) {
          const subtotal = items.reduce((s, it) => s + (parseFloat(it.value) || 0), 0);
          telex += ` • ${o.name}: ${subtotal.toFixed(0)} L [${items.map(it => `${it.machineryName}: ${it.value}L`).join(', ')}]\n`;
        }
      });
    } else {
      telex += ` • Nil\n`;
    }

    telex += `----------------------------------------\n`;
    telex += `ROB AFTER REPORT:\n`;
    data.fuelTypes.forEach(f => {
      telex += ` • ${f.type}: ${fuelRob[f.id] || f.rob} MT\n`;
    });
    data.oilTypes.forEach(o => {
      telex += ` • ${o.name}: ${oilRob[o.id] || o.rob} L\n`;
    });
    telex += `========================================`;

    navigator.clipboard.writeText(telex);
    setCopiedKey(eventKey);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className={`pb-28 sm:pb-32 min-h-screen ${theme === 'dark' ? 'bg-[#050B15]' : 'bg-[#F8FAFC]'}`}>
      {/* Header */}
      <header className={`${theme === 'dark' ? 'bg-[#0A192F] border-white/10' : 'bg-[#0A3161] border-white/10'} text-white p-4 sm:p-6 pt-8 sm:pt-12 rounded-b-3xl sm:rounded-b-[40px] shadow-2xl border-b relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="bg-white/10 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl backdrop-blur-md border border-white/10">
              <FileText size={22} className="text-[#4DE8E8] sm:w-6 sm:h-6" strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tighter italic uppercase text-white leading-none">DAILY ENTRY</h1>
                <span className="text-[7.5px] sm:text-[8px] font-black uppercase tracking-wider bg-[#00A8A8]/20 text-[#4DE8E8] px-2 py-0.5 rounded-full border border-[#00A8A8]/30">
                  EVENT / SITUATION
                </span>
              </div>
              <p className="text-[#4DE8E8] text-[8px] sm:text-[9px] font-bold tracking-[0.2em] sm:tracking-[0.25em] uppercase opacity-80 mt-1">
                {data.vesselName || 'MT Vast coral'} • Reset Time: 12:00 LT (Noon)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {setShowBunkerModal && (
              <button 
                onClick={() => setShowBunkerModal(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#4DE8E8]/30 bg-[#4DE8E8]/10 text-[#4DE8E8] text-[9px] font-black uppercase tracking-wider hover:bg-[#4DE8E8]/20 transition-all"
              >
                <Plus size={12} />
                Bunker
              </button>
            )}
            <button 
              onClick={() => onOpenSettings()}
              className="p-2 sm:p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
              title="Settings"
            >
              <Settings2 size={18} className="text-[#4DE8E8] sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Sub-Tab Navigation Bar */}
        <div className="grid grid-cols-2 gap-2 mt-4 relative z-10 p-1 bg-black/20 backdrop-blur-md rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => setActiveSubTab('entry')}
            className={`flex items-center justify-center gap-2 py-2 sm:py-2.5 px-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all ${
              activeSubTab === 'entry'
                ? 'bg-gradient-to-r from-[#00A8A8] to-[#4DE8E8] text-[#0A192F] shadow-lg shadow-cyan-500/20'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <PenTool size={13} />
            <span className="truncate">Daily Entry (Event & Consumption)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('history')}
            className={`flex items-center justify-center gap-2 py-2 sm:py-2.5 px-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all relative ${
              activeSubTab === 'history'
                ? 'bg-gradient-to-r from-[#00A8A8] to-[#4DE8E8] text-[#0A192F] shadow-lg shadow-cyan-500/20'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <ClipboardList size={13} />
            <span className="truncate">Situation Logs & History</span>
            {sortedEventKeys.length > 0 && (
              <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-full ${
                activeSubTab === 'history' ? 'bg-[#0A192F] text-[#4DE8E8]' : 'bg-white/20 text-white'
              }`}>
                {sortedEventKeys.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-4 sm:p-6 space-y-4 sm:space-y-6 relative z-10 max-w-md mx-auto">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
             style={{ backgroundImage: `radial-gradient(${theme === 'dark' ? '#fff' : '#0A3161'} 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />

        {/* Success Alert Banner */}
        <AnimatePresence>
          {submitSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              className="p-3.5 sm:p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-between gap-3 shadow-lg"
            >
              <div className="flex items-center gap-2.5 text-xs font-black">
                <CheckCircle size={18} className="shrink-0 text-emerald-400" />
                <span>{submitSuccess}</span>
              </div>
              <button 
                onClick={() => setSubmitSuccess(null)}
                className="text-emerald-400/70 hover:text-emerald-400 p-1"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============================================================== */}
        {/* UNIFIED DAILY ENTRY FORM (EVENT / SITUATION + CONSUMPTION)      */}
        {/* ============================================================== */}
        {activeSubTab === 'entry' && (
          <div className="space-y-4 sm:space-y-6">
            
            {/* 1. EVENT / SITUATION & VOYAGE STATUS (EDITABLE) */}
            <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[28px] shadow-2xl border space-y-4 sm:space-y-5`}>
              
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#4DE8E8] animate-ping" />
                  <span className={`text-[11px] sm:text-xs font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                    EVENT / SITUATION & VOYAGE
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#00A8A8]/20 border border-[#00A8A8]/30 text-[#4DE8E8] text-[8px] font-black uppercase tracking-wider">
                  <span>Current: {reportSituation}</span>
                </div>
              </div>

              {/* Event / Situation 8 Buttons Grid matching uploaded sketch/screenshot */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] sm:text-[10px] font-black text-[#4DE8E8] uppercase tracking-widest block">
                    EVENT / SITUATION
                  </label>
                  <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Select Situation
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {situations.map(s => {
                    const isSelected = reportSituation === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setReportSituation(s);
                          if (s === 'Noon') setSelectedStage('noon');
                          else if (s === 'COSP') setSelectedStage('sea-1');
                          else if (s === 'EOSP') setSelectedStage('sea-2');
                          else if (s === 'FWE') setSelectedStage('port-arr');
                          else if (s === 'Departure' || s === 'Alongside') setSelectedStage('port-dep');
                          else if (s === 'Anchor') setSelectedStage('anchor-dep');
                        }}
                        className={`flex flex-col items-center justify-center gap-1.5 p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-[#00A8A8] border-[#4DE8E8] text-[#0A192F] shadow-[0_0_15px_rgba(77,232,232,0.45)] scale-[1.03]' 
                            : theme === 'dark' 
                              ? 'bg-[#050B15]/80 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className={isSelected ? 'text-[#0A192F]' : 'text-[#4DE8E8]'}>
                          {React.isValidElement(situationIcons[s]) 
                            ? React.cloneElement(situationIcons[s] as React.ReactElement<any>, { size: 18 }) 
                            : situationIcons[s]}
                        </div>
                        <span className={`text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-wider ${isSelected ? 'text-[#0A192F]' : ''}`}>{s}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date & Time Picker */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Report Date</label>
                  <div className={`flex items-center gap-2 p-2.5 sm:p-3 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    <Calendar size={14} className="text-[#00A8A8]" />
                    <input 
                      type="date" 
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className={`bg-transparent border-none p-0 text-[11px] sm:text-xs font-bold focus:ring-0 focus:outline-none cursor-pointer w-full ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Report Time</label>
                    <button 
                      type="button" 
                      onClick={() => setReportTime('12:00')}
                      className="text-[7.5px] text-[#4DE8E8] font-black uppercase hover:underline"
                    >
                      Noon (12:00)
                    </button>
                  </div>
                  <div className={`flex items-center gap-2 p-2.5 sm:p-3 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    <Clock size={14} className="text-[#00A8A8]" />
                    <input 
                      type="time" 
                      value={reportTime}
                      onChange={(e) => setReportTime(e.target.value)}
                      className={`bg-transparent border-none p-0 text-[11px] sm:text-xs font-bold focus:ring-0 focus:outline-none cursor-pointer w-full ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                    />
                  </div>
                </div>
              </div>

              {/* Editable Voyage Ports & Voyage No. */}
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-1">
                <div className={`p-2.5 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} space-y-1`}>
                  <span className="text-[7.5px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest block truncate">Voyage No.</span>
                  <input 
                    type="text" 
                    value={voyageNum}
                    onChange={(e) => setVoyageNum(e.target.value)}
                    className={`bg-transparent border-none p-0 text-xs sm:text-sm font-black focus:ring-0 focus:outline-none w-full ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                    placeholder="001"
                  />
                </div>
                <div className={`p-2.5 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} space-y-1`}>
                  <span className="text-[7.5px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest block truncate">Departure</span>
                  <input 
                    type="text" 
                    value={depPort}
                    onChange={(e) => setDepPort(e.target.value)}
                    className={`bg-transparent border-none p-0 text-xs sm:text-sm font-black focus:ring-0 focus:outline-none w-full truncate ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                    placeholder="SINGAPORE"
                  />
                </div>
                <div className={`p-2.5 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} space-y-1`}>
                  <span className="text-[7.5px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest block truncate">Destination</span>
                  <input 
                    type="text" 
                    value={destPort}
                    onChange={(e) => setDestPort(e.target.value)}
                    className={`bg-transparent border-none p-0 text-xs sm:text-sm font-black focus:ring-0 focus:outline-none w-full truncate ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                    placeholder="ROTTERDAM"
                  />
                </div>
              </div>

              {/* Interactive Timeline Track */}
              <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border ${theme === 'dark' ? 'bg-[#050B15]/70 border-white/5' : 'bg-slate-50/80 border-slate-200/80'} relative pt-12 sm:pt-14 pb-4 select-none`}>
                <motion.div 
                  className="absolute top-1 sm:top-1.5 -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center"
                  animate={{ left: `${currentEditableWaypoint.percent}%` }}
                  transition={{ type: "spring", stiffness: 220, damping: 24 }}
                >
                  <motion.div
                    animate={{ y: [0, -2.5, 0], rotate: [-1, 1, -1] }}
                    transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
                    className="filter drop-shadow-[0_4px_10px_rgba(77,232,232,0.6)]"
                  >
                    <VoyageVesselIcon theme={theme} className="w-8 h-8 sm:w-9 sm:h-9" />
                  </motion.div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4DE8E8] shadow-[0_0_8px_#4DE8E8] -mt-0.5" />
                </motion.div>

                <div className="relative w-full my-3">
                  <div className={`h-1 w-full rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} />
                  <motion.div 
                    className="absolute top-0 left-0 h-1 rounded-full bg-gradient-to-r from-[#00A8A8] to-[#4DE8E8] shadow-[0_0_10px_rgba(77,232,232,0.5)]"
                    animate={{ width: `${currentEditableWaypoint.percent}%` }}
                    transition={{ type: "spring", stiffness: 220, damping: 24 }}
                  />

                  {EDITABLE_WAYPOINTS.map((wp) => {
                    const isActive = wp.id === currentEditableWaypoint.id;
                    const isPast = wp.percent <= currentEditableWaypoint.percent;
                    return (
                      <button
                        key={wp.id}
                        type="button"
                        onClick={() => {
                          setSelectedStage(wp.id);
                          if (wp.defaultSituation) setReportSituation(wp.defaultSituation);
                        }}
                        style={{ left: `${wp.percent}%` }}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group/wp focus:outline-none transition-all z-10 flex flex-col items-center cursor-pointer"
                      >
                        {wp.type === 'dot' ? (
                          <div className={`w-3.5 h-3.5 rounded-full border-2 transition-all flex items-center justify-center ${
                            isActive 
                              ? 'bg-[#4DE8E8] border-white shadow-[0_0_12px_#4DE8E8] scale-125' 
                              : isPast 
                                ? 'bg-[#00A8A8] border-[#4DE8E8]' 
                                : theme === 'dark' ? 'bg-[#0A192F] border-slate-500 hover:border-slate-300' : 'bg-white border-slate-300 hover:border-slate-500'
                          }`}>
                            <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-[#0A192F]' : 'bg-white'}`} />
                          </div>
                        ) : wp.type === 'noon-dot' ? (
                          <div className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
                            isActive 
                              ? 'bg-[#4DE8E8] border-white shadow-[0_0_14px_#4DE8E8] scale-125' 
                              : isPast 
                                ? 'bg-[#00A8A8] border-[#4DE8E8]' 
                                : theme === 'dark' ? 'bg-[#0A192F] border-slate-500 hover:border-slate-300' : 'bg-white border-slate-300 hover:border-slate-500'
                          }`}>
                            <Sun size={9} className={isActive ? 'text-[#0A192F]' : isPast ? 'text-white' : 'text-slate-400'} />
                          </div>
                        ) : wp.type === 'tick' ? (
                          <div className={`w-1 h-3.5 sm:h-4 rounded-full transition-all ${
                            isActive 
                              ? 'bg-[#4DE8E8] shadow-[0_0_10px_#4DE8E8] scale-125' 
                              : isPast 
                                ? 'bg-[#00A8A8]' 
                                : theme === 'dark' ? 'bg-slate-600 hover:bg-slate-400' : 'bg-slate-300 hover:bg-slate-400'
                          }`} />
                        ) : (
                          <div className={`w-0.5 h-2.5 rounded-full transition-all ${
                            isActive 
                              ? 'bg-[#4DE8E8] shadow-[0_0_8px_#4DE8E8]' 
                              : isPast 
                                ? 'bg-[#00A8A8]/70' 
                                : theme === 'dark' ? 'bg-slate-700 hover:bg-slate-500' : 'bg-slate-300 hover:bg-slate-400'
                          }`} />
                        )}
                        <div className="mt-2 text-center whitespace-nowrap">
                          <span className={`block text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-wider transition-colors ${
                            isActive 
                              ? 'text-[#4DE8E8] font-black scale-105' 
                              : isPast 
                                ? theme === 'dark' ? 'text-slate-300' : 'text-slate-700' 
                                : 'text-slate-500'
                          }`}>
                            {wp.label}
                          </span>
                          {wp.subText && (
                            <span className={`text-[7px] sm:text-[7.5px] font-bold block -mt-0.5 max-w-[48px] sm:max-w-[65px] truncate ${
                              isActive ? 'text-[#00A8A8]' : 'text-slate-400'
                            }`}>
                              {wp.subText}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-6 flex items-center justify-between text-[7px] sm:text-[8px] text-slate-500 font-bold uppercase tracking-wider px-1">
                  <span>• Tap waypoint to change vessel position</span>
                  <button
                    type="button"
                    onClick={handleSaveSituation}
                    className="text-[#4DE8E8] font-black hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Save size={10} />
                    <span>Save Situation Only</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick ROB Live Status Bar */}
            <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-3.5 sm:p-5 rounded-2xl sm:rounded-[28px] shadow-xl border space-y-3`}>
              <div className="flex items-center justify-between">
                <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest block">Current ROB (Live)</span>
                {setShowBunkerModal && (
                  <button 
                    onClick={() => setShowBunkerModal(true)}
                    className="text-[7.5px] sm:text-[8px] font-black text-[#4DE8E8] uppercase tracking-wider hover:underline"
                  >
                    + Bunker
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {data.fuelTypes.map(f => (
                  <div key={f.id} className={`p-2 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'} flex items-center justify-between`}>
                    <span className="text-[9px] font-black uppercase" style={{ color: getFuelColor(f.type) }}>{f.type}</span>
                    <span className={`text-xs font-black ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{f.rob} <span className="text-[7px] text-slate-400">MT</span></span>
                  </div>
                ))}
                {data.oilTypes.slice(0, 2).map(o => (
                  <div key={o.id} className={`p-2 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'} flex items-center justify-between`}>
                    <span className="text-[8.5px] font-bold text-orange-400 uppercase truncate mr-1">{o.name.split(' ').pop()}</span>
                    <span className={`text-xs font-black ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{o.rob} <span className="text-[7px] text-slate-400">L</span></span>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 1: FUEL CONSUMPTION (FO & DO) */}
            <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[28px] shadow-2xl border space-y-4`}>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#00A8A8]/10 text-[#00A8A8]">
                    <Fuel size={18} />
                  </div>
                  <div>
                    <h3 className={`font-black text-xs sm:text-sm tracking-wider uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                      Fuel Oil & Diesel Oil
                    </h3>
                    <p className="text-[7.5px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                      Machinery Consumption in Metric Tons (MT)
                    </p>
                  </div>
                </div>
                {totalFuelConsEntered > 0 && (
                  <span className="text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full bg-[#00A8A8]/10 text-[#4DE8E8] border border-[#00A8A8]/30">
                    {totalFuelConsEntered.toFixed(2)} MT Total
                  </span>
                )}
              </div>

              {/* Machinery with Fuels - EXACT MATCH TO LUBRICATING OILS (LO) */}
              <div className="space-y-3">
                {uniqueMachinery.map(m => {
                  const currentHrs = machineryHours[m.id] || '';

                  return (
                    <div 
                      key={m.id}
                      className={`p-3.5 sm:p-4 rounded-2xl border space-y-2.5 ${
                        theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg text-[#00A8A8] ${theme === 'dark' ? 'bg-white/5' : 'bg-white'}`}>
                            {getIcon(m.icon)}
                          </div>
                          <span className={`text-[10px] sm:text-xs font-black uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                            {m.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 bg-black/10 dark:bg-white/5 rounded-lg px-2 py-0.5 border border-white/5">
                          <Clock size={11} className="text-slate-400" />
                          <span className="text-[7.5px] font-bold text-slate-400 uppercase">RUN:</span>
                          <input 
                            type="number"
                            step="0.1"
                            value={currentHrs}
                            onChange={(e) => handleHoursChange(m.id, e.target.value)}
                            placeholder="0.0"
                            className={`w-10 bg-transparent text-right font-black text-[10px] focus:outline-none ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                          />
                          <span className="text-[7.5px] font-bold text-slate-400">hrs</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {data.fuelTypes.map(f => {
                          const currentVal = fuelInputs[m.id]?.[f.id] || '';
                          const robNum = parseFloat(f.rob) || 0;
                          const capNum = parseFloat(f.capacity) || 0;
                          const pct = capNum > 0 ? (robNum / capNum) * 100 : 100;
                          const isLow = (capNum > 0 && pct < 15) || robNum <= 0;
                          const fColor = getFuelColor(f.type);

                          return (
                            <div 
                              key={f.id}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                                theme === 'dark' ? 'bg-[#0A192F]/60 border-white/5' : 'bg-white border-slate-200/70'
                              }`}
                            >
                              <div>
                                <span className="text-[9px] sm:text-[10px] font-black uppercase block" style={{ color: fColor }}>
                                  {f.type}
                                </span>
                                <div className="flex items-center gap-2 text-[7.5px] font-bold text-slate-400">
                                  <span>ROB: {f.rob} MT</span>
                                  {isLow && (
                                    <span className="text-red-400 font-black animate-pulse">LOW LEVEL ALERT</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 bg-black/10 dark:bg-white/5 rounded-lg px-2.5 py-1 border border-white/5">
                                <input 
                                  type="number"
                                  step="0.01"
                                  value={currentVal}
                                  onChange={(e) => handleFuelChange(m.id, f.id, e.target.value)}
                                  placeholder="0.00"
                                  className={`w-14 sm:w-16 bg-transparent text-right font-black text-xs sm:text-sm focus:outline-none ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                                />
                                <span className="text-[7.5px] font-black text-slate-400">MT</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION 2: LUBRICATING OILS (LO) CONSUMPTION */}
            <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[28px] shadow-2xl border space-y-4`}>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
                    <Droplets size={18} />
                  </div>
                  <div>
                    <h3 className={`font-black text-xs sm:text-sm tracking-wider uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                      Lubricating Oils (LO)
                    </h3>
                    <p className="text-[7.5px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                      Machinery Consumption in Liters (L)
                    </p>
                  </div>
                </div>
                {totalOilConsEntered > 0 && (
                  <span className="text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/30">
                    {totalOilConsEntered.toFixed(0)} L Total
                  </span>
                )}
              </div>

              {/* Machinery with used oils */}
              <div className="space-y-3">
                {uniqueMachinery.map(m => {
                  const associatedOils = data.oilTypes.filter(o => m.usedOils.includes(o.id));
                  if (associatedOils.length === 0) return null;

                  return (
                    <div 
                      key={m.id}
                      className={`p-3.5 sm:p-4 rounded-2xl border space-y-2.5 ${
                        theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg text-orange-400 ${theme === 'dark' ? 'bg-white/5' : 'bg-white'}`}>
                          {getIcon(m.icon)}
                        </div>
                        <span className={`text-[10px] sm:text-xs font-black uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                          {m.name}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {associatedOils.map(o => {
                          const currentOilVal = oilInputs[m.id]?.[o.id] || '';
                          const robNum = parseFloat(o.rob) || 0;
                          const threshNum = parseFloat(o.threshold) || 0;
                          const isLow = robNum <= threshNum && threshNum > 0;

                          return (
                            <div 
                              key={o.id}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                                theme === 'dark' ? 'bg-[#0A192F]/60 border-white/5' : 'bg-white border-slate-200/70'
                              }`}
                            >
                              <div>
                                <span className="text-[9px] sm:text-[10px] font-black uppercase text-orange-400 block">
                                  {o.name}
                                </span>
                                <div className="flex items-center gap-2 text-[7.5px] font-bold text-slate-400">
                                  <span>ROB: {o.rob} L</span>
                                  {isLow && (
                                    <span className="text-red-400 font-black">LOW LEVEL ALERT</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 bg-black/10 dark:bg-white/5 rounded-lg px-2.5 py-1 border border-white/5">
                                <input 
                                  type="number"
                                  step="1"
                                  value={currentOilVal}
                                  onChange={(e) => handleOilChange(m.id, o.id, e.target.value)}
                                  placeholder="0"
                                  className={`w-14 sm:w-16 bg-transparent text-right font-black text-xs sm:text-sm focus:outline-none ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                                />
                                <span className="text-[7.5px] font-black text-slate-400">L</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION 3: SUMMARY & SUBMIT BUTTON */}
            <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[28px] shadow-2xl border space-y-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest block">Entry Summary</span>
                  <span className={`text-xs sm:text-sm font-black uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                    {reportSituation} Report • {reportDate} ({reportTime} hrs)
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-[11px] sm:text-xs font-black text-[#4DE8E8]">
                    {totalFuelConsEntered.toFixed(2)} MT Fuel
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-black text-orange-400">
                    {totalOilConsEntered.toFixed(0)} L Oil
                  </div>
                </div>
              </div>

              {/* Event Remarks / Operation Log */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Remarks / Operation Log (Optional)
                </label>
                <input 
                  type="text" 
                  value={eventRemarks}
                  onChange={(e) => setEventRemarks(e.target.value)}
                  placeholder={`e.g. Logged ${reportSituation} at ${reportTime} hrs, all engines normal.`}
                  className={`w-full p-2.5 sm:p-3 rounded-xl border text-[11px] sm:text-xs font-medium focus:ring-1 focus:ring-[#4DE8E8] focus:outline-none ${
                    theme === 'dark' ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-[#0A3161] placeholder:text-slate-400'
                  }`}
                />
              </div>

              <button 
                type="button"
                onClick={handleSubmitReport}
                className="w-full bg-gradient-to-r from-[#00A8A8] via-[#00C4C4] to-[#4DE8E8] text-[#0A192F] py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-[0.2em] shadow-xl shadow-cyan-500/20 active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer hover:opacity-95"
              >
                <CheckCircle size={18} />
                SUBMIT DAILY REPORT (EVENT & CONSUMPTION)
              </button>

              <div className="flex items-center justify-between text-[7.5px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-wider px-1">
                <span>• Updates situation & syncs dashboard</span>
                <span>• Deducts from ROB automatically</span>
              </div>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* SUB-TAB: REPORT HISTORY & LOGS                                */}
        {/* ============================================================== */}
        {activeSubTab === 'history' && (
          <div className="space-y-4 sm:space-y-5">
            
            {/* Filter and Search Bar */}
            <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border space-y-3`}>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search by date or situation..."
                  className={`flex-1 bg-black/10 dark:bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#00A8A8] ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                />
                {historySearch && (
                  <button 
                    onClick={() => setHistorySearch('')}
                    className="p-2 text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Situation Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {['ALL', 'Noon', 'Departure', 'FWE', 'Anchor', 'COSP'].map(filt => (
                  <button
                    key={filt}
                    type="button"
                    onClick={() => setHistoryFilter(filt)}
                    className={`px-2.5 py-1 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-wider shrink-0 transition-all ${
                      historyFilter === filt
                        ? 'bg-[#00A8A8] text-[#0A192F] shadow-sm'
                        : theme === 'dark' ? 'bg-white/5 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {filt}
                  </button>
                ))}
              </div>
            </div>

            {/* Reports List */}
            {filteredEventKeys.length > 0 ? (
              filteredEventKeys.map(eventKey => {
                const logs = groupedByEvent[eventKey] || [];
                const [timestamp, situation] = eventKey.split('|');
                const dateObj = new Date(timestamp);
                const formattedDate = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                const fuelRob = logs[logs.length - 1]?.fuelRobSnapshot || {};
                const oilRob = logs[logs.length - 1]?.oilRobSnapshot || {};

                const totalEventFuel = logs
                  .filter(l => l.unit === 'MT')
                  .reduce((sum, l) => sum + (parseFloat(l.value) || 0), 0);
                const totalEventOil = logs
                  .filter(l => l.unit === 'L')
                  .reduce((sum, l) => sum + (parseFloat(l.value) || 0), 0);

                const isCopied = copiedKey === eventKey;

                return (
                  <div key={eventKey} className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md rounded-2xl sm:rounded-[32px] border shadow-2xl overflow-hidden transition-all hover:border-[#00A8A8]/30`}>
                    
                    {/* Event Header */}
                    <div className={`p-4 sm:p-5 border-b ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'} flex items-center justify-between`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 mb-1">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-[#00A8A8]" />
                            <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                              {formattedDate}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock size={12} className="text-slate-400" />
                            <span className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400">{formattedTime}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-orange-400">
                          {situationIcons[situation] || <Activity size={12} />}
                          <span className="text-xs sm:text-sm font-black uppercase tracking-wider">{situation} Report</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => copyTelex(eventKey, logs)}
                          title="Copy Telex Format"
                          className={`p-2 rounded-xl border transition-all flex items-center gap-1 text-[8px] font-black uppercase ${
                            isCopied 
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                              : 'bg-white/5 border-white/10 text-[#4DE8E8] hover:bg-white/10'
                          }`}
                        >
                          {isCopied ? <CheckCheck size={14} /> : <Copy size={14} />}
                          <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Telex'}</span>
                        </button>

                        {data.department !== 'deck' && (
                          <>
                            {editingEvent === eventKey ? (
                              <button 
                                onClick={saveEdit}
                                className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-all border border-emerald-500/30"
                              >
                                <Check size={14} />
                              </button>
                            ) : (
                              <button 
                                onClick={() => startEditing(eventKey, logs)}
                                className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-[#4DE8E8] transition-all"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            <button 
                              onClick={() => removeEvent(eventKey)}
                              className="p-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all border border-red-500/20"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Totals & ROB After Snapshot */}
                    <div className="p-4 sm:p-5 grid grid-cols-2 gap-3 border-b border-dashed border-slate-200 dark:border-white/10">
                      <div className="space-y-1">
                        <span className="text-[7.5px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest block">Fuel ROB (After)</span>
                        {data.fuelTypes.map(f => (
                          <div key={f.id} className="flex justify-between items-center text-[9px] sm:text-[10px]">
                            <span className="font-bold text-slate-400">{f.type}:</span>
                            <span className={`font-black ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                              {fuelRob[f.id] || f.rob} MT
                            </span>
                          </div>
                        ))}
                        <div className="pt-1 text-[8px] font-bold text-[#00A8A8]">
                          Total Cons: {totalEventFuel.toFixed(2)} MT
                        </div>
                      </div>
                      <div className="space-y-1 border-l border-slate-100 dark:border-white/5 pl-3">
                        <span className="text-[7.5px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest block">Oil ROB (After)</span>
                        {data.oilTypes.slice(0, 3).map(o => (
                          <div key={o.id} className="flex justify-between items-center text-[9px] sm:text-[10px]">
                            <span className="font-bold text-slate-400">{o.name.split(' ').pop()}:</span>
                            <span className={`font-black ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                              {oilRob[o.id] || o.rob} L
                            </span>
                          </div>
                        ))}
                        <div className="pt-1 text-[8px] font-bold text-orange-400">
                          Total Cons: {totalEventOil.toFixed(0)} L
                        </div>
                      </div>
                    </div>

                    {/* Detailed Consumption Rows */}
                    {logs.some(l => parseFloat(l.value) > 0) && (
                      <div className="p-4 sm:p-5 space-y-2">
                        <span className="text-[7.5px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest block">Machinery Consumption Breakdown</span>
                        <div className="space-y-1.5">
                          {logs.filter(l => parseFloat(l.value) > 0).map(log => (
                            <div key={log.id} className={`p-2 rounded-xl flex items-center justify-between text-xs ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}`}>
                              <div className="flex items-center gap-2">
                                <div className={`p-1 rounded-md ${log.unit === 'MT' ? 'text-[#00A8A8]' : 'text-orange-400'}`}>
                                  {log.unit === 'MT' ? <Fuel size={12} /> : <Droplets size={12} />}
                                </div>
                                <div>
                                  <span className={`font-black uppercase text-[10px] ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                                    {log.machineryName}
                                  </span>
                                  <span className="text-[8px] font-bold text-slate-400 ml-1.5">
                                    ({log.type})
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                {editingEvent === eventKey ? (
                                  <input 
                                    type="number"
                                    value={editValues[log.id] || ''}
                                    onChange={(e) => setEditValues({ ...editValues, [log.id]: e.target.value })}
                                    className={`w-14 bg-transparent border-b border-[#00A8A8] text-right font-black text-xs focus:outline-none ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                                  />
                                ) : (
                                  <span className={`font-black text-xs ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                                    {log.value} {log.unit}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                );
              })
            ) : (
              <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-6 sm:p-8 rounded-2xl sm:rounded-[32px] shadow-2xl border flex flex-col items-center justify-center py-12 sm:py-16 text-center space-y-3`}>
                <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl ${theme === 'dark' ? 'bg-white/5 text-slate-600' : 'bg-slate-50 text-slate-400'}`}>
                  <FileText size={44} strokeWidth={1.5} />
                </div>
                <h3 className={`font-black text-lg ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>
                  {historySearch || historyFilter !== 'ALL' ? 'No Matching Reports' : 'No Reports Submitted Yet'}
                </h3>
                <p className="text-slate-500 text-xs max-w-xs leading-relaxed">
                  Use the Daily Entry tab above to record your Fuel Oil and Lubricating Oil daily consumption and log your noon reports.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setHistoryFilter('ALL');
                    setHistorySearch('');
                    setActiveSubTab('entry');
                  }}
                  className="mt-2 bg-[#00A8A8] text-[#0A192F] px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider"
                >
                  Create Daily Report
                </button>
              </div>
            )}

          </div>
        )}

      </main>
    </div>
  );
};

// --- Main App ---

const SettingsView = ({ 
  data, 
  setData, 
  onClose,
  theme,
  setTheme,
  addFuel,
  removeFuel,
  addOil,
  removeOil,
  addMachinery,
  removeMachinery,
  initialSection,
  deferredPrompt,
  onInstall,
  mergeData,
  lastSynced,
  setLastSynced,
  swReady,
  setConfirmReset
}: { 
  data: OnboardingData, 
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>,
  onClose: () => void,
  theme: 'dark' | 'light',
  setTheme: (theme: 'dark' | 'light') => void,
  addFuel: () => void,
  removeFuel: (id: string) => void,
  addOil: () => void,
  removeOil: (id: string) => void,
  addMachinery: () => void,
  removeMachinery: (id: string) => void,
  initialSection?: string | null,
  deferredPrompt?: any,
  onInstall?: () => void,
  mergeData: (incoming: OnboardingData) => void,
  lastSynced: string | null,
  setLastSynced: (val: string | null) => void,
  swReady: boolean,
  setConfirmReset: (val: 'all' | null) => void
}) => {
  const [serverUrl] = useState(window.location.origin);
  const [editingVessel, setEditingVessel] = useState(false);
  const [editingFuelId, setEditingFuelId] = useState<string | null>(null);
  const [editingMachineryId, setEditingMachineryId] = useState<string | null>(null);
  const [editingOilId, setEditingOilId] = useState<string | null>(null);
  const [vesselName, setVesselName] = useState(data.vesselName);
  const [imoNumber, setImoNumber] = useState(data.imoNumber);
  const isDeck = data.department === 'deck';

  useEffect(() => {
    if (initialSection) {
      const element = document.getElementById(initialSection);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [initialSection]);

  const saveVesselName = () => {
    setData({ ...data, vesselName, imoNumber });
    setEditingVessel(false);
  };

  // Push local data to local server whenever it changes
  useEffect(() => {
    const pushToLocalServer = async () => {
      try {
        await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } catch (e) {
        // Local server might not be running or accessible
      }
    };
    pushToLocalServer();
  }, [data]);

  return (
    <motion.div 
      id="settings-view"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={`fixed inset-0 z-50 overflow-y-auto ${theme === 'dark' ? 'bg-[#050B15] text-slate-100' : 'bg-[#F8FAFC] text-slate-900'}`}
    >
      <header className={`${theme === 'dark' ? 'bg-[#0A192F] border-white/10' : 'bg-[#0A3161] border-white/10'} p-4 sm:p-6 pt-8 sm:pt-12 rounded-b-3xl sm:rounded-b-[40px] shadow-2xl border-b flex items-center justify-between text-white relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00A8A8]/10 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="relative z-10">
          <h1 className="text-xl sm:text-2xl font-black tracking-tighter italic uppercase">SETTINGS</h1>
          <p className="text-[#4DE8E8] text-[8px] sm:text-[9px] font-bold tracking-[0.3em] sm:tracking-[0.4em] uppercase opacity-80 mt-1">Vessel Configuration</p>
        </div>
        <button 
          onClick={onClose}
          className={`p-2 sm:p-2.5 rounded-xl relative z-10 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20' : 'bg-white/10 hover:bg-white/20'} transition-all text-white`}
        >
          <X size={20} className="sm:w-6 sm:h-6" />
        </button>
      </header>

      <main className="p-4 sm:p-6 space-y-5 sm:space-y-8 max-w-md mx-auto relative z-10 pb-12">
        {/* Theme Toggle */}
        <section className="space-y-3 sm:space-y-4">
          <h2 className="text-[9px] sm:text-[10px] font-black tracking-[0.25em] sm:tracking-[0.3em] uppercase text-slate-400">Appearance</h2>
          <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-5 rounded-2xl sm:rounded-[24px] border flex items-center justify-between shadow-xl`}>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className={`${theme === 'dark' ? 'bg-white/5 text-yellow-400' : 'bg-[#0A3161]/5 text-[#0A3161]'} p-2.5 sm:p-3 rounded-xl border border-transparent dark:border-white/5`}>
                {theme === 'dark' ? <Moon size={18} className="sm:w-5 sm:h-5" /> : <Sun size={18} className="sm:w-5 sm:h-5" />}
              </div>
              <div>
                <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Theme Mode</div>
                <div className={`text-xs sm:text-sm font-black uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{theme} MODE</div>
              </div>
            </div>
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`w-12 sm:w-14 h-6 sm:h-7 rounded-full relative transition-all duration-500 p-0.5 sm:p-1 ${theme === 'dark' ? 'bg-[#00A8A8]' : 'bg-slate-200 shadow-inner'}`}
            >
              <motion.div 
                animate={{ x: theme === 'dark' ? 24 : 0 }}
                className="w-5 h-5 bg-white rounded-full shadow-lg flex items-center justify-center"
              >
                {theme === 'dark' ? <Moon size={10} className="text-[#00A8A8]" /> : <Sun size={10} className="text-slate-400" />}
              </motion.div>
            </button>
          </div>
        </section>

        {/* Dashboard Layout Section */}
        <section className="space-y-3 sm:space-y-4">
          <h2 className="text-[9px] sm:text-[10px] font-black tracking-[0.25em] sm:tracking-[0.3em] uppercase text-slate-400">Dashboard Layout</h2>
          <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-5 rounded-2xl sm:rounded-[24px] border shadow-xl`}>
            <button 
              onClick={() => setData({
                ...data,
                dashboardCards: [
                  { id: 'vessel-info', type: 'vessel-info', title: 'Current Assignment', visible: true },
                  { id: 'date', type: 'voyage-date', title: 'Report Date', visible: true },
                  { id: 'time-status', type: 'voyage-time', title: 'Latest Situation', visible: true },
                  { id: 'voyage-info', type: 'voyage-info', title: 'Voyage Info', visible: true },
                  { id: 'last-report', type: 'last-report', title: 'Last Submitted Report', visible: true },
                  { id: 'activity', type: 'activity', title: "Today's Activity", visible: true }
                ]
              })}
              className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              <RotateCcw size={14} />
              Reset Dashboard Layout
            </button>
          </div>
        </section>

        {/* Vessel Name Section */}
        <section id="settings-vessel" className="space-y-3 sm:space-y-4">
          <h2 className="text-[9px] sm:text-[10px] font-black tracking-[0.25em] sm:tracking-[0.3em] uppercase text-slate-400">Vessel Identity</h2>
          <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-5 rounded-2xl sm:rounded-[24px] border flex flex-col shadow-xl`}>
            {editingVessel ? (
              <div className="space-y-3 sm:space-y-4 w-full">
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Ship Name</label>
                  <input 
                    type="text" 
                    value={vesselName}
                    onChange={(e) => setVesselName(e.target.value)}
                    className={`${theme === 'dark' ? 'bg-[#050B15] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-[#0A3161]'} border rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm w-full focus:outline-none focus:border-[#00A8A8] transition-all`}
                    placeholder="Enter Vessel Name"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">IMO Number</label>
                  <input 
                    type="text" 
                    value={imoNumber}
                    onChange={(e) => setImoNumber(e.target.value)}
                    className={`${theme === 'dark' ? 'bg-[#050B15] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-[#0A3161]'} border rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm w-full focus:outline-none focus:border-[#00A8A8] transition-all`}
                    placeholder="Enter IMO Number"
                  />
                </div>
                <button onClick={saveVesselName} className="w-full bg-[#00A8A8] py-2.5 sm:py-3 rounded-xl text-[#0A192F] font-black text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Save size={14} className="sm:w-4 sm:h-4" />
                  Save Changes
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`p-2.5 sm:p-3 rounded-xl ${theme === 'dark' ? 'bg-white/5 text-[#4DE8E8]' : 'bg-[#0A3161]/5 text-[#0A3161]'}`}>
                    <Anchor size={18} className="sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ship Identity</div>
                    <div className={`text-base sm:text-lg font-black ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{data.vesselName || "UNNAMED"}</div>
                    <div className="text-[9px] sm:text-[10px] font-bold text-[#00A8A8] uppercase tracking-widest">IMO {data.imoNumber || "N/A"}</div>
                  </div>
                </div>
                <button onClick={() => setEditingVessel(true)} className="p-2 sm:p-3 text-slate-400 hover:text-[#4DE8E8] transition-colors">
                  <Edit2 size={18} className="sm:w-5 sm:h-5" />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Fuel Types Section */}
        <section id="settings-fuel" className={`space-y-3 sm:space-y-4 ${isDeck ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[9px] sm:text-[10px] font-black tracking-[0.25em] sm:tracking-[0.3em] uppercase text-slate-400">Fuel Inventory</h2>
            {!isDeck && (
              <button 
                onClick={addFuel}
                className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-black text-[#00A8A8] uppercase tracking-widest hover:opacity-80 transition-opacity"
              >
                <Plus size={12} strokeWidth={3} />
                Add Fuel
              </button>
            )}
          </div>
          <div className="space-y-2.5 sm:space-y-3">
            {data.fuelTypes.map((fuel) => (
              <div key={fuel.id} className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-5 rounded-2xl sm:rounded-[28px] border shadow-xl group transition-all ${editingFuelId === fuel.id ? 'border-[#00A8A8] shadow-cyan-500/20' : 'hover:border-[#00A8A8]/40 hover:shadow-cyan-500/5'} relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00A8A8]/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                <div className="flex items-center gap-3 sm:gap-4 relative z-10">
                  <div className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl ${theme === 'dark' ? 'bg-white/5 text-[#4DE8E8] border border-white/10' : 'bg-[#0A3161]/5 text-[#0A3161] border border-[#0A3161]/10'} ${editingFuelId === fuel.id ? 'animate-pulse' : ''}`}>
                    <Droplets size={18} className="sm:w-[22px] sm:h-[22px]" />
                  </div>
                  <div className="flex-1 space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <input 
                        type="text" 
                        value={fuel.type}
                        readOnly={editingFuelId !== fuel.id}
                        onChange={(e) => {
                          const newFuelTypes = data.fuelTypes.map(f => f.id === fuel.id ? { ...f, type: e.target.value } : f);
                          setData({ ...data, fuelTypes: newFuelTypes });
                        }}
                        className={`bg-transparent border-none p-0 text-sm sm:text-base font-black uppercase tracking-widest focus:ring-0 focus:outline-none w-full ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'} ${editingFuelId !== fuel.id ? 'cursor-default' : 'cursor-text'}`}
                        placeholder="Fuel Type (e.g. LSFO)"
                      />
                      <div className="flex items-center gap-1 transition-all">
                        <button 
                          onClick={() => setEditingFuelId(editingFuelId === fuel.id ? null : fuel.id)}
                          className={`p-1.5 sm:p-2 rounded-xl transition-all ${editingFuelId === fuel.id ? 'bg-[#00A8A8] text-[#0A192F]' : theme === 'dark' ? 'text-slate-400 hover:bg-white/10 hover:text-[#4DE8E8]' : 'text-slate-400 hover:bg-slate-100 hover:text-[#00A8A8]'}`}
                        >
                          {editingFuelId === fuel.id ? <Check size={14} className="sm:w-4 sm:h-4" /> : <Edit2 size={14} className="sm:w-4 sm:h-4" />}
                        </button>
                        <button 
                          onClick={() => removeFuel(fuel.id)}
                          className={`p-1.5 sm:p-2 rounded-xl transition-all ${theme === 'dark' ? 'text-red-400/60 hover:bg-red-500/10 hover:text-red-400' : 'text-red-500/60 hover:bg-red-50 hover:text-red-500'}`}
                        >
                          <Trash2 size={14} className="sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-2 sm:gap-y-3">
                      <div className="flex flex-col gap-0.5 sm:gap-1">
                        <span className="text-[7.5px] sm:text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Avg Cons</span>
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="text" 
                            value={fuel.consumption}
                            readOnly={editingFuelId !== fuel.id}
                            onChange={(e) => {
                              const newFuelTypes = data.fuelTypes.map(f => f.id === fuel.id ? { ...f, consumption: e.target.value } : f);
                              setData({ ...data, fuelTypes: newFuelTypes });
                            }}
                            className={`bg-transparent border-none p-0 text-xs font-black focus:ring-0 focus:outline-none w-12 ${theme === 'dark' ? 'text-[#4DE8E8]' : 'text-[#0A3161]'} ${editingFuelId !== fuel.id ? 'cursor-default' : 'cursor-text'}`}
                            placeholder="0.00"
                          />
                          <span className="text-[7.5px] sm:text-[8px] font-black text-slate-500 uppercase">MT</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 sm:gap-1">
                        <span className="text-[7.5px] sm:text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Max Cap</span>
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="text" 
                            value={fuel.capacity}
                            readOnly={editingFuelId !== fuel.id}
                            onChange={(e) => {
                              const newFuelTypes = data.fuelTypes.map(f => f.id === fuel.id ? { ...f, capacity: e.target.value } : f);
                              setData({ ...data, fuelTypes: newFuelTypes });
                            }}
                            className={`bg-transparent border-none p-0 text-xs font-black focus:ring-0 focus:outline-none w-12 ${theme === 'dark' ? 'text-[#00A8A8]' : 'text-[#0A3161]'} ${editingFuelId !== fuel.id ? 'cursor-default' : 'cursor-text'}`}
                            placeholder="0.00"
                          />
                          <span className="text-[7.5px] sm:text-[8px] font-black text-slate-500 uppercase">MT</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 sm:gap-1">
                        <span className="text-[7.5px] sm:text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Initial ROB</span>
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="text" 
                            value={fuel.initialRob}
                            readOnly={editingFuelId !== fuel.id}
                            onChange={(e) => {
                              const newFuelTypes = data.fuelTypes.map(f => f.id === fuel.id ? { ...f, initialRob: e.target.value } : f);
                              setData({ ...data, fuelTypes: newFuelTypes });
                            }}
                            className={`bg-transparent border-none p-0 text-xs font-black focus:ring-0 focus:outline-none w-12 ${theme === 'dark' ? 'text-[#00A8A8]' : 'text-[#0A3161]'} ${editingFuelId !== fuel.id ? 'cursor-default' : 'cursor-text'}`}
                            placeholder="0.00"
                          />
                          <span className="text-[7.5px] sm:text-[8px] font-black text-slate-500 uppercase">MT</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 sm:gap-1">
                        <span className="text-[7.5px] sm:text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Current ROB</span>
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="text" 
                            value={fuel.rob}
                            readOnly={editingFuelId !== fuel.id}
                            onChange={(e) => {
                              const newFuelTypes = data.fuelTypes.map(f => f.id === fuel.id ? { ...f, rob: e.target.value } : f);
                              setData({ ...data, fuelTypes: newFuelTypes });
                            }}
                            className={`bg-transparent border-none p-0 text-xs font-black focus:ring-0 focus:outline-none w-12 ${theme === 'dark' ? 'text-[#00A8A8]' : 'text-[#0A3161]'} ${editingFuelId !== fuel.id ? 'cursor-default' : 'cursor-text'}`}
                            placeholder="0.00"
                          />
                          <span className="text-[7.5px] sm:text-[8px] font-black text-slate-500 uppercase">MT</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Machinery Section */}
        <section id="settings-machinery" className={`space-y-3 sm:space-y-4 ${isDeck ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-[9px] sm:text-[10px] font-black tracking-[0.25em] sm:tracking-[0.3em] uppercase text-slate-400">Machinery Management</h2>
            {!isDeck && (
              <button 
                onClick={addMachinery}
                className={`flex items-center gap-1.5 text-[8px] sm:text-[9px] font-black tracking-widest uppercase px-2.5 sm:px-3 py-1.5 rounded-lg transition-all ${
                  theme === 'dark' ? 'bg-white/5 text-[#4DE8E8] hover:bg-white/10' : 'bg-[#0A3161]/5 text-[#0A3161] hover:bg-[#0A3161]/10'
                }`}
              >
                <Plus size={12} />
                Add New
              </button>
            )}
          </div>
          <div className="space-y-3 sm:space-y-4">
            {data.machinery.reduce((acc, m) => {
              const existing = acc.find(item => item.name === m.name);
              if (existing) {
                // Merge usedOils for the unique display item
                existing.usedOils = Array.from(new Set([...existing.usedOils, ...m.usedOils]));
              } else {
                acc.push({ ...m });
              }
              return acc;
            }, [] as MachineryItem[]).map((m) => (
              <div 
                key={m.id}
                className={`p-4 sm:p-5 rounded-2xl sm:rounded-[32px] border transition-all flex flex-col gap-3 sm:gap-4 shadow-xl ${
                  editingMachineryId === m.id 
                    ? 'border-[#00A8A8] shadow-cyan-500/20' 
                    : theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 sm:gap-4 flex-1">
                    <div className="relative group/icon">
                      <div className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl ${theme === 'dark' ? 'bg-white/5 text-[#4DE8E8] border border-white/10' : 'bg-[#0A3161]/5 text-[#0A3161] border border-[#0A3161]/10'} ${editingMachineryId === m.id ? 'animate-pulse' : ''}`}>
                        {m.icon === 'me' ? <Cpu size={18} className="sm:w-[22px] sm:h-[22px]" /> : m.icon === 'ge' ? <Zap size={18} className="sm:w-[22px] sm:h-[22px]" /> : m.icon === 'blr' ? <Flame size={18} className="sm:w-[22px] sm:h-[22px]" /> : <Settings2 size={18} className="sm:w-[22px] sm:h-[22px]" />}
                      </div>
                    </div>
                    <div className="flex-1">
                      <input 
                        type="text"
                        value={m.name}
                        readOnly={editingMachineryId !== m.id}
                        onChange={(e) => {
                          const oldName = m.name;
                          const newName = e.target.value;
                          const newMachinery = data.machinery.map(item => item.name === oldName ? { ...item, name: newName } : item);
                          setData({ ...data, machinery: newMachinery });
                        }}
                        className={`bg-transparent text-sm sm:text-base font-black focus:outline-none w-full ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'} ${editingMachineryId !== m.id ? 'cursor-default' : 'cursor-text'}`}
                        placeholder="Machinery Name"
                      />
                      <input 
                        type="text"
                        value={m.desc}
                        readOnly={editingMachineryId !== m.id}
                        onChange={(e) => {
                          const name = m.name;
                          const newDesc = e.target.value;
                          const newMachinery = data.machinery.map(item => item.name === name ? { ...item, desc: newDesc } : item);
                          setData({ ...data, machinery: newMachinery });
                        }}
                        className={`bg-transparent text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] focus:outline-none w-full mt-0.5 ${editingMachineryId !== m.id ? 'cursor-default' : 'cursor-text'}`}
                        placeholder="Description"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 transition-all">
                    <button 
                      onClick={() => setEditingMachineryId(editingMachineryId === m.id ? null : m.id)}
                      className={`p-1.5 sm:p-2 rounded-xl transition-all ${editingMachineryId === m.id ? 'bg-[#00A8A8] text-[#0A192F]' : theme === 'dark' ? 'text-slate-400 hover:bg-white/10 hover:text-[#4DE8E8]' : 'text-slate-400 hover:bg-slate-100 hover:text-[#00A8A8]'}`}
                    >
                      {editingMachineryId === m.id ? <Check size={14} className="sm:w-4 sm:h-4" /> : <Edit2 size={14} className="sm:w-4 sm:h-4" />}
                    </button>
                    <button 
                      onClick={() => {
                        const name = m.name;
                        const idsToRemove = data.machinery.filter(item => item.name === name).map(item => item.id);
                        
                        setData(prev => {
                          const newFuelCons = { ...prev.fuelConsumptionData };
                          const newOilCons = { ...prev.oilConsumptionData };
                          idsToRemove.forEach(id => {
                            delete newFuelCons[id];
                            delete newOilCons[id];
                          });
                          
                          return {
                            ...prev,
                            machinery: prev.machinery.filter(item => item.name !== name),
                            fuelConsumptionData: newFuelCons,
                            oilConsumptionData: newOilCons,
                            lastModified: Date.now()
                          };
                        });
                      }}
                      className={`p-1.5 sm:p-2 rounded-xl transition-all ${theme === 'dark' ? 'text-red-400/60 hover:bg-red-500/10 hover:text-red-400' : 'text-red-500/60 hover:bg-red-50 hover:text-red-500'}`}
                    >
                      <Trash2 size={14} className="sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Icon Picker */}
                <div className={`flex gap-1.5 sm:gap-2 transition-all ${editingMachineryId !== m.id ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                  {machineryIcons.map(icon => (
                    <button
                      key={icon.id}
                      disabled={editingMachineryId !== m.id}
                      onClick={() => {
                        const name = m.name;
                        const newMachinery = data.machinery.map(item => item.name === name ? { ...item, icon: icon.id as any } : item);
                        setData({ ...data, machinery: newMachinery });
                      }}
                      className={`p-1.5 sm:p-2 rounded-lg border transition-all ${
                        m.icon === icon.id 
                          ? 'bg-[#00A8A8] border-[#00A8A8] text-[#0A192F]' 
                          : theme === 'dark' ? 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                      }`}
                      title={icon.label}
                    >
                      {icon.icon}
                    </button>
                  ))}
                </div>

                {/* Oil Selection in Settings */}
                <div className={`space-y-2.5 sm:space-y-3 pt-2 border-t border-white/5 transition-all ${editingMachineryId !== m.id ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                  <label className="text-[8px] sm:text-[9px] font-black tracking-[0.2em] uppercase text-[#00A8A8]">Associated Lube Oils</label>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {data.oilTypes.map(oil => (
                      <button
                        key={oil.id}
                        disabled={editingMachineryId !== m.id}
                        onClick={() => {
                          const name = m.name;
                          const isUsed = m.usedOils.includes(oil.id);
                          const newUsedOils = isUsed 
                            ? m.usedOils.filter(id => id !== oil.id)
                            : [...m.usedOils, oil.id];
                          const newMachinery = data.machinery.map(item => item.name === name ? { ...item, usedOils: newUsedOils } : item);
                          setData({ ...data, machinery: newMachinery });
                        }}
                        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider border transition-all ${
                          m.usedOils.includes(oil.id)
                            ? 'bg-[#00A8A8]/20 border-[#00A8A8] text-[#00A8A8]'
                            : theme === 'dark' ? 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        {oil.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* LO Types Section */}
        <section id="settings-oil" className={`space-y-4 ${isDeck ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-slate-400">Lube Oil Inventory</h2>
            {!isDeck && (
              <button 
                onClick={addOil}
                className="flex items-center gap-1.5 text-[9px] font-black text-[#00A8A8] uppercase tracking-widest hover:opacity-80 transition-opacity"
              >
                <Plus size={12} strokeWidth={3} />
                Add Oil
              </button>
            )}
          </div>
          <div className="space-y-3">
            {data.oilTypes.map((o) => (
              <div key={o.id} className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-5 rounded-[28px] border shadow-xl group transition-all ${editingOilId === o.id ? 'border-orange-500 shadow-orange-500/20' : 'hover:border-[#00A8A8]/40 hover:shadow-cyan-500/5'} relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className={`p-3.5 rounded-2xl ${theme === 'dark' ? 'bg-white/5 text-orange-400 border border-white/10' : 'bg-orange-50 text-orange-600 border border-orange-100'} ${editingOilId === o.id ? 'animate-pulse' : ''}`}>
                    <Droplets size={22} />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <input 
                        type="text" 
                        value={o.name}
                        readOnly={editingOilId !== o.id}
                        onChange={(e) => {
                          const newOils = data.oilTypes.map(item => item.id === o.id ? { ...item, name: e.target.value } : item);
                          setData({ ...data, oilTypes: newOils });
                        }}
                        className={`bg-transparent border-none p-0 text-base font-black uppercase tracking-widest focus:ring-0 focus:outline-none w-full ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'} ${editingOilId !== o.id ? 'cursor-default' : 'cursor-text'}`}
                        placeholder="Oil Name (e.g. ME CYL OIL)"
                      />
                      <div className="flex items-center gap-1 transition-all">
                        <button 
                          onClick={() => setEditingOilId(editingOilId === o.id ? null : o.id)}
                          className={`p-2 rounded-xl transition-all ${editingOilId === o.id ? 'bg-orange-500 text-white' : theme === 'dark' ? 'text-slate-400 hover:bg-white/10 hover:text-orange-400' : 'text-slate-400 hover:bg-orange-50 hover:text-orange-500'}`}
                        >
                          {editingOilId === o.id ? <Check size={14} /> : <Edit2 size={14} />}
                        </button>
                        <button 
                          onClick={() => removeOil(o.id)}
                          className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'text-red-400/60 hover:bg-red-500/10 hover:text-red-400' : 'text-red-500/60 hover:bg-red-50 hover:text-red-500'}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Avg Cons</span>
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="text" 
                            value={o.consumption}
                            readOnly={editingOilId !== o.id}
                            onChange={(e) => {
                              const newOils = data.oilTypes.map(item => item.id === o.id ? { ...item, consumption: e.target.value } : item);
                              setData({ ...data, oilTypes: newOils });
                            }}
                            className={`bg-transparent border-none p-0 text-xs font-black focus:ring-0 focus:outline-none w-10 ${theme === 'dark' ? 'text-orange-400' : 'text-[#0A3161]'} ${editingOilId !== o.id ? 'cursor-default' : 'cursor-text'}`}
                            placeholder="0.00"
                          />
                          <span className="text-[8px] font-black text-slate-500 uppercase">L</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Max Cap</span>
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="text" 
                            value={o.capacity}
                            readOnly={editingOilId !== o.id}
                            onChange={(e) => {
                              const newOils = data.oilTypes.map(item => item.id === o.id ? { ...item, capacity: e.target.value } : item);
                              setData({ ...data, oilTypes: newOils });
                            }}
                            className={`bg-transparent border-none p-0 text-xs font-black focus:ring-0 focus:outline-none w-10 ${theme === 'dark' ? 'text-[#00A8A8]' : 'text-[#0A3161]'} ${editingOilId !== o.id ? 'cursor-default' : 'cursor-text'}`}
                            placeholder="0.00"
                          />
                          <span className="text-[8px] font-black text-slate-500 uppercase">L</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Initial ROB</span>
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="text" 
                            value={o.initialRob}
                            readOnly={editingOilId !== o.id}
                            onChange={(e) => {
                              const newOils = data.oilTypes.map(item => item.id === o.id ? { ...item, initialRob: e.target.value } : item);
                              setData({ ...data, oilTypes: newOils });
                            }}
                            className={`bg-transparent border-none p-0 text-xs font-black focus:ring-0 focus:outline-none w-10 ${theme === 'dark' ? 'text-[#00A8A8]' : 'text-[#0A3161]'} ${editingOilId !== o.id ? 'cursor-default' : 'cursor-text'}`}
                            placeholder="0.00"
                          />
                          <span className="text-[8px] font-black text-slate-500 uppercase">L</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Current ROB</span>
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="text" 
                            value={o.rob}
                            readOnly={editingOilId !== o.id}
                            onChange={(e) => {
                              const newOils = data.oilTypes.map(item => item.id === o.id ? { ...item, rob: e.target.value } : item);
                              setData({ ...data, oilTypes: newOils });
                            }}
                            className={`bg-transparent border-none p-0 text-xs font-black focus:ring-0 focus:outline-none w-10 ${theme === 'dark' ? 'text-[#00A8A8]' : 'text-[#0A3161]'} ${editingOilId !== o.id ? 'cursor-default' : 'cursor-text'}`}
                            placeholder="0.00"
                          />
                          <span className="text-[8px] font-black text-slate-500 uppercase">L</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 col-span-2">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Min Threshold Alert</span>
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="text" 
                            value={o.threshold}
                            readOnly={editingOilId !== o.id}
                            onChange={(e) => {
                              const newOils = data.oilTypes.map(item => item.id === o.id ? { ...item, threshold: e.target.value } : item);
                              setData({ ...data, oilTypes: newOils });
                            }}
                            className={`bg-transparent border-none p-0 text-xs font-black focus:ring-0 focus:outline-none w-10 ${theme === 'dark' ? 'text-red-400' : 'text-[#0A3161]'} ${editingOilId !== o.id ? 'cursor-default' : 'cursor-text'}`}
                            placeholder="0"
                          />
                          <span className="text-[8px] font-black text-slate-500 uppercase">L (Alert below this value)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Data Source Section (Fixed to Flowmeter) */}
        <section className={`space-y-3 sm:space-y-4 ${isDeck ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-slate-400">Data Source (Calculation)</h2>
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {[
              { id: 'flowmeter', name: 'Flowmeter', icon: <Droplets size={20} /> }
            ].map((m) => (
              <button
                key={m.id}
                className={`p-4 sm:p-5 rounded-2xl sm:rounded-[24px] border-2 transition-all flex flex-col items-center gap-2 sm:gap-3 shadow-lg bg-[#00A8A8] border-[#00A8A8] text-[#0A192F] shadow-cyan-500/20`}
              >
                {m.icon}
                <span className="text-[9px] sm:text-[10px] font-black tracking-[0.2em]">{m.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Mesh Sync Section */}
        <section id="settings-p2p" className="space-y-3 sm:space-y-4 pt-6 sm:pt-8 border-t border-slate-200 dark:border-white/5">
          <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4">
            <div className="p-2.5 sm:p-3 bg-[#00A8A8]/10 rounded-xl sm:rounded-2xl text-[#00A8A8]">
              <Activity size={22} className="sm:w-6 sm:h-6" />
            </div>
            <h2 className="text-xs sm:text-sm font-black tracking-[0.2em] uppercase text-slate-400">P2P Mesh Network</h2>
          </div>

          <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-5 sm:p-8 rounded-2xl sm:rounded-[32px] border flex flex-col items-center text-center space-y-5 sm:space-y-8 shadow-2xl relative overflow-hidden`}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#4DE8E8] to-transparent opacity-50" />
            
            <div className="space-y-3 sm:space-y-4 w-full">
              <div className="space-y-1">
                <div className={`text-base sm:text-lg font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>Automatic Background Sync</div>
                <div className="text-[10px] sm:text-[11px] text-slate-500 leading-relaxed max-w-[240px] mx-auto space-y-1 sm:space-y-2">
                  <p>Devices on the same ship Wi-Fi automatically find each other and synchronize data in the background.</p>
                  <p className="text-[#00A8A8] font-bold uppercase tracking-tighter">Mesh Network Active</p>
                  <p className="text-[8px] sm:text-[9px] text-slate-500 font-bold uppercase tracking-widest pt-0.5 sm:pt-1">
                    Matching IMO: <span className="text-[#00A8A8]">{data.imoNumber || 'NOT SET'}</span>
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 border-[#00A8A8]/20 bg-[#00A8A8]/5 flex items-center gap-3 sm:gap-4">
                <div className="bg-[#00A8A8] p-2.5 sm:p-3 rounded-full animate-pulse">
                  <Activity size={18} className="text-white sm:w-5 sm:h-5" />
                </div>
                <div className="text-left">
                  <div className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>Scanning for Peers</div>
                  <div className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    Last Sync: {lastSynced || 'Never'}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 sm:pt-4">
                <div className={`flex items-center justify-center gap-2.5 sm:gap-3 text-[8px] sm:text-[9px] font-black tracking-widest ${theme === 'dark' ? 'text-[#4DE8E8] bg-white/5 border-white/10' : 'text-[#0A3161] bg-slate-50 border-slate-100'} px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border`}>
                  <Wifi size={14} className="animate-pulse" />
                  SHIP_WIFI_INTERNAL
                </div>
              </div>

              <button 
                onClick={() => {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(registrations => {
                      for (let registration of registrations) {
                        registration.update();
                      }
                      alert('Checking for updates...');
                    });
                  }
                }}
                className={`flex items-center justify-center gap-2.5 sm:gap-3 w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl transition-all active:scale-95 ${
                  theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-100 text-[#0A3161]'
                }`}
              >
                <RotateCcw size={18} className="sm:w-5 sm:h-5" />
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Force Update App</span>
              </button>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="space-y-3 sm:space-y-4 pt-6 sm:pt-8 border-t border-red-500/20">
          <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-red-500/60">Danger Zone</h2>
          <div className={`${theme === 'dark' ? 'bg-red-500/5 border-red-500/10' : 'bg-red-50 border-red-100'} backdrop-blur-md p-4 sm:p-5 rounded-2xl sm:rounded-[24px] border shadow-xl space-y-3`}>
            <button 
              onClick={() => setConfirmReset('all')}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
            >
              <Trash2 size={14} />
              Erase All Data
            </button>
            <p className="text-[8px] sm:text-[9px] text-center text-slate-500 font-bold uppercase tracking-tighter opacity-60 leading-tight">
              Warning: This will erase all vessel data, machinery, and logs, and restart the onboarding procedure.
            </p>
          </div>
        </section>
      </main>
    </motion.div>
  );
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const totalSteps = 6;
  const [step, setStep] = useState(() => {
    const localData = localStorage.getItem('bunker_watch_data');
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        if (parsed.onboardingCompleted) return totalSteps + 1;
      } catch (e) {}
    }
    return 1;
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showSettings, setShowSettings] = useState(false);
  const [targetSection, setTargetSection] = useState<string | null>(null);

  const handleOpenSettings = (section?: string) => {
    if (section) setTargetSection(section);
    setShowSettings(true);
  };
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } catch (e) {}
    }
    return 'dark';
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        setTheme(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } catch (e) {}
  }, []);

  const [data, setData] = useState<OnboardingData>(() => {
    const localData = localStorage.getItem('bunker_watch_data');
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        return sanitizeData(parsed, defaultData);
      } catch (e) {
        console.error("Failed to parse local data", e);
      }
    }
    return defaultData;
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  const [lastSynced, setLastSynced] = useState<string | null>(localStorage.getItem('bunker_watch_last_sync'));
  const [showToast, setShowToast] = useState<{ message: string, type: 'info' | 'success' | 'error' } | null>(null);
  const [showBunkerModal, setShowBunkerModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [swReady, setSwReady] = useState(false);
  const [confirmReset, setConfirmReset] = useState<'all' | null>(null);

  const clearAllData = () => {
    const freshData = { ...defaultData, lastModified: Date.now() };
    setData(freshData);
    setStep(1);
    setShowSettings(false);
    setConfirmReset(null);
    localStorage.removeItem('bunker_watch_data');
    localStorage.removeItem('bunker_watch_last_sync');
    setLastSynced(null);
    
    // Clear server data
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(freshData)
    }).catch(e => console.error("Failed to clear server data", e));
  };

  const handleSplashFinish = React.useCallback(() => {
    setShowSplash(false);
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setSwReady(true);
      });
    }
  }, []);

  // --- P2P Merge Logic (The Brain) ---
  const mergeData = useCallback((incoming: OnboardingData) => {
    setData(prev => {
      // 0. Check IMO Number - SAFETY FIRST
      if (incoming.imoNumber && prev.imoNumber && incoming.imoNumber !== prev.imoNumber) {
        console.warn("P2P Sync Blocked: IMO Number mismatch", { incoming: incoming.imoNumber, local: prev.imoNumber });
        return prev;
      }

      // 1. Compare Vessel Info
      const mergedVessel = incoming.lastModified > prev.lastModified ? incoming : prev;
      
      // 2. Merge Fuel Types (Latest Wins per ID)
      const allFuelIds = Array.from(new Set([...prev.fuelTypes.map(f => f.id), ...incoming.fuelTypes.map(f => f.id)]));
      const mergedFuelTypes = allFuelIds.map(id => {
        const local = prev.fuelTypes.find(f => f.id === id);
        const remote = incoming.fuelTypes.find(f => f.id === id);
        if (!local) return remote!;
        if (!remote) return local;
        return remote.lastModified > local.lastModified ? remote : local;
      });

      // 3. Merge Oil Types
      const allOilIds = Array.from(new Set([...prev.oilTypes.map(o => o.id), ...incoming.oilTypes.map(o => o.id)]));
      const mergedOilTypes = allOilIds.map(id => {
        const local = prev.oilTypes.find(o => o.id === id);
        const remote = incoming.oilTypes.find(o => o.id === id);
        if (!local) return remote!;
        if (!remote) return local;
        return remote.lastModified > local.lastModified ? remote : local;
      });

      // 4. Merge Machinery
      const allMachIds = Array.from(new Set([...prev.machinery.map(m => m.id), ...incoming.machinery.map(m => m.id)]));
      const mergedMachinery = allMachIds.map(id => {
        const local = prev.machinery.find(m => m.id === id);
        const remote = incoming.machinery.find(m => m.id === id);
        if (!local) return remote!;
        if (!remote) return local;
        return remote.lastModified > local.lastModified ? remote : local;
      });

      // 5. Merge Logs (Latest Wins per ID)
      const allLogIds = Array.from(new Set([...prev.consumptionLogs.map(l => l.id), ...incoming.consumptionLogs.map(l => l.id)]));
      const mergedLogs = allLogIds.map(id => {
        const local = prev.consumptionLogs.find(l => l.id === id);
        const remote = incoming.consumptionLogs.find(l => l.id === id);
        if (!local) return remote!;
        if (!remote) return local;
        return remote.lastModified > local.lastModified ? remote : local;
      });

      // 6. Merge Bunker Logs
      const allBunkerLogIds = Array.from(new Set([...(prev.bunkerLogs || []).map(l => l.id), ...(incoming.bunkerLogs || []).map(l => l.id)]));
      const mergedBunkerLogs = allBunkerLogIds.map(id => {
        const local = (prev.bunkerLogs || []).find(l => l.id === id);
        const remote = (incoming.bunkerLogs || []).find(l => l.id === id);
        if (!local) return remote!;
        if (!remote) return local;
        return remote.lastModified > local.lastModified ? remote : local;
      });

      const result = sanitizeData({
        ...mergedVessel,
        fuelTypes: mergedFuelTypes,
        oilTypes: mergedOilTypes,
        machinery: mergedMachinery,
        consumptionLogs: mergedLogs,
        bunkerLogs: mergedBunkerLogs,
        lastModified: Math.max(prev.lastModified, incoming.lastModified)
      }, defaultData);

      localStorage.setItem('bunker_watch_data', JSON.stringify(result));
      return result;
    });
    
    setShowToast({ message: 'P2P Sync Complete: Latest data applied.', type: 'success' });
    setTimeout(() => setShowToast(null), 3000);
  }, []);

  // Online/Offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowToast({ message: 'Back Online! Syncing data...', type: 'success' });
      setTimeout(() => setShowToast(null), 3000);
    };
    const handleOffline = () => {
      setIsOffline(true);
      setShowToast({ message: 'Offline Mode Active. Data saved locally.', type: 'info' });
      setTimeout(() => setShowToast(null), 3000);
    };
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Load data on start
  useEffect(() => {
    const loadData = async () => {
      // If we are offline, don't even try the network to avoid hanging
      if (!navigator.onLine) {
        setIsOffline(true);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        // Try server
        const response = await fetch('/api/data', { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const serverData = await response.json();
          const sanitized = sanitizeData(serverData, defaultData);
          
          // Use mergeData to ensure we don't overwrite newer local data
          mergeData(sanitized);
          
          const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setLastSynced(now);
          localStorage.setItem('bunker_watch_last_sync', now);
          setIsOffline(false);
          
          // If we got data and we are still in onboarding, skip it
          if (sanitized.onboardingCompleted && step <= totalSteps) {
            setStep(totalSteps + 1);
          }
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.warn("Server request timed out, using local storage");
        } else {
          console.error("Failed to load data from server, using local storage", error);
        }
        setIsOffline(true);
      }
    };
    loadData();
  }, [mergeData, totalSteps]);

  // Save data on change (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      // Don't save empty initial state
      if (!data.vesselName && data.consumptionLogs.length === 0) return;

      setIsSyncing(true);
      localStorage.setItem('bunker_watch_data', JSON.stringify(data));
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout

      try {
        const response = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          setIsOffline(false);
          const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setLastSynced(now);
          localStorage.setItem('bunker_watch_last_sync', now);
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.warn("Sync request timed out");
        } else {
          console.error("Failed to sync with server", error);
        }
        setIsOffline(true);
      } finally {
        setIsSyncing(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [data]);

  // Background Auto-Sync Effect (Stable Interval)
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    const backgroundSync = async () => {
      try {
        const currentData = dataRef.current;
        if (!currentData.onboardingCompleted) return;

        // 1. Get peers from local server
        const peersRes = await fetch('/api/peers');
        if (!peersRes.ok) return;
        const peers: string[] = await peersRes.json();

        for (const peerIp of peers) {
          try {
            // 3. Fetch peer data
            const peerDataRes = await fetch(`http://${peerIp}:3000/api/data`, { 
              signal: AbortSignal.timeout(5000) 
            });
            if (peerDataRes.ok) {
              const incoming = await peerDataRes.json();
              
              // 4. Check IMO Number before merging
              if (incoming.imoNumber === currentData.imoNumber) {
                // 5. Merge if incoming is newer or has more logs
                if (incoming.lastModified > currentData.lastModified || incoming.consumptionLogs.length > currentData.consumptionLogs.length) {
                  mergeData(incoming);
                  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  setLastSynced(now);
                  console.log(`🔄 Auto-Synced with ${peerIp}`);
                }
              } else {
                console.log(`🚫 Skipped sync with ${peerIp}: IMO mismatch`);
              }
            }
          } catch (e) {
            // Peer might be offline
          }
        }
      } catch (e) {
        // Local server might be starting up
      }
    };

    const interval = setInterval(backgroundSync, 15000); // Sync every 15 seconds
    return () => clearInterval(interval);
  }, [mergeData]); // Only depend on mergeData which is stable

  const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: 'machinery' | 'fuel' | 'oil' } | null>(null);

  const addMachinery = () => {
    const id = uuidv4();
    setData({ 
      ...data, 
      machinery: [
        ...data.machinery, 
        { id, name: 'New Machinery', desc: 'Custom unit', icon: 'other', usedOils: [], lastModified: Date.now() }
      ],
      lastModified: Date.now()
    });
  };

  const removeMachinery = (id: string) => {
    setData(prev => {
      const { [id]: _, ...remainingFuelCons } = prev.fuelConsumptionData;
      const { [id]: __, ...remainingOilCons } = prev.oilConsumptionData;
      return {
        ...prev,
        machinery: prev.machinery.filter(m => m.id !== id),
        fuelConsumptionData: remainingFuelCons,
        oilConsumptionData: remainingOilCons,
        lastModified: Date.now()
      };
    });
  };

  const addFuel = () => {
    const id = uuidv4();
    setData({ 
      ...data, 
      fuelTypes: [...data.fuelTypes, { id, type: 'NEW FO', consumption: '0', capacity: '0', rob: '0', initialRob: '0', lastModified: Date.now() }],
      lastModified: Date.now()
    });
  };

  const removeFuel = (id: string) => {
    setData(prev => {
      // Clean up machinery consumption data for this fuel type
      const newFuelCons = { ...prev.fuelConsumptionData };
      Object.keys(newFuelCons).forEach(mId => {
        if (newFuelCons[mId]) {
          const { [id]: _, ...rest } = newFuelCons[mId];
          newFuelCons[mId] = rest;
        }
      });

      return {
        ...prev,
        fuelTypes: prev.fuelTypes.filter(f => f.id !== id),
        fuelConsumptionData: newFuelCons,
        lastModified: Date.now()
      };
    });
    if (activeTab === `fuel-${id}`) setActiveTab('dashboard');
  };

  const removeOil = (id: string) => {
    setData(prev => {
      // Clean up machinery consumption data for this oil type
      const newOilCons = { ...prev.oilConsumptionData };
      Object.keys(newOilCons).forEach(mId => {
        if (newOilCons[mId]) {
          const { [id]: _, ...rest } = newOilCons[mId];
          newOilCons[mId] = rest;
        }
      });

      return {
        ...prev,
        oilTypes: prev.oilTypes.filter(o => o.id !== id),
        oilConsumptionData: newOilCons,
        lastModified: Date.now()
      };
    });
    if (activeTab === 'lo') setActiveTab('dashboard');
  };

  const addOil = () => {
    const id = uuidv4();
    setData({ 
      ...data, 
      oilTypes: [...data.oilTypes, { id, name: 'NEW OIL', consumption: '0', threshold: '0', capacity: '0', rob: '0', initialRob: '0', lastModified: Date.now() }],
      lastModified: Date.now()
    });
  };

  const nextStep = () => setStep(s => Math.min(s + 1, totalSteps));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const renderHeader = (title: string, showLogo = true) => (
    <header className={`${theme === 'dark' ? 'bg-[#0A192F] border-white/5' : 'bg-[#0A3161] border-gray-100'} text-white p-3.5 sm:p-4 flex items-center justify-between sticky top-0 z-10 shadow-md`}>
      <div className="flex items-center gap-2.5 sm:gap-4">
        <button onClick={prevStep} className={`p-1 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-white/10'} rounded-full transition-colors`}>
          <ChevronLeft size={20} className="sm:w-6 sm:h-6" />
        </button>
        <h1 className="text-xs sm:text-sm font-bold tracking-wider uppercase truncate">{title}</h1>
      </div>
      {showLogo && (
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className={`${theme === 'dark' ? 'bg-[#00A8A8]' : 'bg-white'} p-0.5 rounded-sm`}>
            <Anchor size={14} className={`sm:w-4 sm:h-4 ${theme === 'dark' ? 'text-[#0A192F]' : 'text-[#0A3161]'}`} strokeWidth={3} />
          </div>
          <div className="flex flex-col">
            <div className={`text-xs sm:text-sm font-black tracking-tighter italic leading-none ${theme === 'dark' ? 'text-[#00A8A8]' : 'text-white'}`}>BUNKER WATCH</div>
            <div className={`text-[6px] sm:text-[7px] font-bold tracking-widest opacity-80 leading-none mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-white'}`}>A Bunker Calculation app</div>
          </div>
        </div>
      )}
    </header>
  );

  const renderFooter = (onNext: () => void, nextLabel = "NEXT", showSkip = true, showSaveDraft = false, disabled = false) => (
    <footer className={`${theme === 'dark' ? 'bg-[#0A192F]/95 border-white/5' : 'bg-white/95 border-slate-200'} backdrop-blur-xl border-t p-4 sm:p-6 flex items-center justify-between fixed left-0 right-0 max-w-md mx-auto ${step <= totalSteps ? 'bottom-0' : 'bottom-16'} z-30`}>
      <div className="flex items-center gap-5 sm:gap-8">
        {showSaveDraft && (
          <button className="text-[#4DE8E8] font-bold text-xs sm:text-sm tracking-wide uppercase">SAVE DRAFT</button>
        )}
        {!showSaveDraft && step > 1 && (
          <button onClick={prevStep} className={`flex flex-col items-center gap-0.5 sm:gap-1 ${theme === 'dark' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} transition-colors`}>
            <ChevronLeft size={18} className="sm:w-5 sm:h-5" />
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">BACK</span>
          </button>
        )}
        {!showSaveDraft && showSkip && (
          <button onClick={onNext} className={`flex flex-col items-center gap-0.5 sm:gap-1 ${theme === 'dark' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} transition-colors`}>
            <X size={18} className="sm:w-5 sm:h-5" />
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">SKIP</span>
          </button>
        )}
      </div>

      <button 
        onClick={onNext}
        disabled={disabled}
        className={`px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl sm:rounded-lg font-black text-xs sm:text-sm flex items-center gap-2 sm:gap-3 shadow-lg transition-all ${
          disabled 
            ? 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50 shadow-none' 
            : 'bg-gradient-to-r from-[#00A8A8] to-[#4DE8E8] text-[#0A192F] shadow-cyan-500/20 hover:opacity-90 active:scale-95'
        }`}
      >
        {nextLabel}
        <ChevronRight size={18} className="sm:w-5 sm:h-5" />
      </button>
    </footer>
  );

  const renderProgress = () => (
    <div className="flex gap-1.5 sm:gap-2 px-4 sm:px-6 py-4 sm:py-8">
      {[...Array(totalSteps)].map((_, i) => (
        <div 
          key={i} 
          className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i + 1 <= step ? 'bg-[#00A8A8]' : theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  );

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#050B15] text-slate-100' : 'bg-[#F8FAFC] text-[#0A3161]'} font-sans max-w-md mx-auto shadow-2xl relative pb-32 sm:pb-48`}>
      <AnimatePresence>
        {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
      </AnimatePresence>

      {!showSplash && (
        <>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col min-h-[calc(100vh-140px)] sm:min-h-[calc(100vh-180px)]"
              >
                {renderHeader("VESSEL IDENTITY")}
                {renderProgress()}
                <div className="px-4 sm:px-6 space-y-5 sm:space-y-8 flex-1">
                  <div className="space-y-2 sm:space-y-3">
                    <div className={`inline-block px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[9px] font-black tracking-[0.2em] uppercase ${theme === 'dark' ? 'bg-white/5 text-[#4DE8E8] border border-white/10' : 'bg-[#0A3161]/5 text-[#0A3161] border border-[#0A3161]/10'}`}>
                      Step 01 / 06
                    </div>
                    <h2 className={`text-2xl sm:text-3xl font-black tracking-tighter italic uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>What is your <span className="text-[#00A8A8]">vessel Name?</span></h2>
                    <p className="text-slate-500 text-xs sm:text-sm font-medium leading-relaxed">
                      This identifier will be used across all navigational logs, fuel reports, and safety certifications.
                    </p>
                  </div>

                  <div className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-5 sm:p-8 rounded-2xl sm:rounded-[40px] border shadow-2xl space-y-4 sm:space-y-6 relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#00A8A8]/5 rounded-full blur-2xl -mr-16 -mt-16" />
                    <div className="space-y-3.5 sm:space-y-4 relative z-10">
                      <div className="space-y-1.5 sm:space-y-2">
                        <label className={`text-[9px] sm:text-[10px] font-black tracking-[0.3em] uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-[#0A3161]'}`}>VESSEL NAME</label>
                        <div className="relative">
                          <Anchor className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-[#00A8A8]" size={18} />
                          <input 
                            type="text" 
                            placeholder="e.g. MT OCEAN STAR"
                            className={`w-full pl-10 sm:pl-12 pr-3.5 sm:pr-4 py-3.5 sm:py-5 rounded-xl sm:rounded-2xl border-2 text-base sm:text-lg font-black transition-all focus:outline-none focus:ring-4 focus:ring-[#00A8A8]/10 ${
                              theme === 'dark' 
                                ? 'bg-[#050B15] border-white/5 text-white focus:border-[#00A8A8]' 
                                : 'bg-slate-50 border-slate-100 text-[#0A3161] focus:border-[#0A3161]'
                            }`}
                            value={data.vesselName}
                            onChange={(e) => setData({ ...data, vesselName: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <label className={`text-[9px] sm:text-[10px] font-black tracking-[0.3em] uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-[#0A3161]'}`}>IMO NUMBER</label>
                        <div className="relative">
                          <Activity className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-[#00A8A8]" size={18} />
                          <input 
                            type="text" 
                            placeholder="e.g. 9876543"
                            className={`w-full pl-10 sm:pl-12 pr-3.5 sm:pr-4 py-3.5 sm:py-5 rounded-xl sm:rounded-2xl border-2 text-base sm:text-lg font-black transition-all focus:outline-none focus:ring-4 focus:ring-[#00A8A8]/10 ${
                              theme === 'dark' 
                                ? 'bg-[#050B15] border-white/5 text-white focus:border-[#00A8A8]' 
                                : 'bg-slate-50 border-slate-100 text-[#0A3161] focus:border-[#0A3161]'
                            }`}
                            value={data.imoNumber}
                            onChange={(e) => setData({ ...data, imoNumber: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {renderFooter(nextStep, "NEXT", true, false, false)}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col min-h-[calc(100vh-140px)] sm:min-h-[calc(100vh-180px)]"
              >
                {renderHeader("USER ROLE")}
                {renderProgress()}
                <div className="px-4 sm:px-6 space-y-5 sm:space-y-8 flex-1">
                  <div className="space-y-2 sm:space-y-3">
                    <div className={`inline-block px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[9px] font-black tracking-[0.2em] uppercase ${theme === 'dark' ? 'bg-white/5 text-[#4DE8E8] border border-white/10' : 'bg-[#0A3161]/5 text-[#0A3161] border border-[#0A3161]/10'}`}>
                      Step 02 / 06
                    </div>
                    <h2 className={`text-2xl sm:text-3xl font-black tracking-tighter italic uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>Are you <span className="text-[#00A8A8]">Deck or Engine?</span></h2>
                    <p className="text-slate-500 text-xs sm:text-sm font-medium leading-relaxed">
                      Select your department to customize your interface and access permissions.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    {[
                      { 
                        id: 'engine', 
                        title: 'ENGINE', 
                        subtitle: 'Full Access', 
                        desc: 'Data entry and configuration', 
                        icon: <Cpu size={26} className="sm:w-8 sm:h-8" /> 
                      },
                      { 
                        id: 'deck', 
                        title: 'DECK', 
                        subtitle: 'View Only', 
                        desc: 'Reports and data access', 
                        icon: <Compass size={26} className="sm:w-8 sm:h-8" /> 
                      }
                    ].map((role) => (
                      <button 
                        key={role.id}
                        onClick={() => setData({ ...data, department: role.id as any })}
                        className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-5 sm:p-8 rounded-2xl sm:rounded-[40px] border-2 transition-all flex flex-col items-center text-center gap-3 sm:gap-4 shadow-xl relative overflow-hidden group ${
                          data.department === role.id 
                            ? 'border-[#00A8A8] scale-[1.02] shadow-cyan-500/20' 
                            : 'hover:border-slate-300'
                        }`}
                      >
                        <div className={`p-3.5 sm:p-5 rounded-xl sm:rounded-2xl transition-colors ${data.department === role.id ? 'bg-[#0A192F]/10 text-[#00A8A8]' : theme === 'dark' ? 'bg-white/5 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
                          {role.icon}
                        </div>
                        <div className="space-y-0.5 sm:space-y-1">
                          <h3 className={`text-xl sm:text-2xl font-black tracking-tighter italic uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{role.title}</h3>
                          <p className={`text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-[#4DE8E8]' : 'text-[#0A3161]'}`}>{role.subtitle}</p>
                          <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium">{role.desc}</p>
                        </div>
                        {data.department === role.id && (
                          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-[#00A8A8] text-[#0A192F] p-1 rounded-full">
                            <Check size={14} className="sm:w-4 sm:h-4" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                {renderFooter(() => {
                  if (data.department === 'deck') {
                    setStep(totalSteps + 1);
                  } else {
                    nextStep();
                  }
                }, "NEXT", true, false, false)}
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col min-h-[calc(100vh-140px)] sm:min-h-[calc(100vh-180px)]"
              >
                {renderHeader("FUEL TYPES")}
                {renderProgress()}
                <div className="px-4 sm:px-6 space-y-5 sm:space-y-8 flex-1">
                  <div className="space-y-2 sm:space-y-3">
                    <div className={`inline-block px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[9px] font-black tracking-[0.2em] uppercase ${theme === 'dark' ? 'bg-white/5 text-[#4DE8E8] border border-white/10' : 'bg-[#0A3161]/5 text-[#0A3161] border border-[#0A3161]/10'}`}>
                      Step 03 / 06
                    </div>
                    <h2 className={`text-2xl sm:text-3xl font-black tracking-tighter italic uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>Fuel <span className="text-[#00A8A8]">Inventory</span></h2>
                    <p className="text-slate-500 text-xs sm:text-sm font-medium leading-relaxed">Define initial ROB and storage capacity for each fuel grade.</p>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    {data.fuelTypes.map((f) => (
                      <div key={f.id} className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[32px] shadow-2xl border space-y-3.5 sm:space-y-5 relative overflow-hidden group`}>
                        <div className="absolute top-0 right-0 w-24 h-24 bg-[#00A8A8]/5 rounded-full blur-2xl -mr-12 -mt-12" />
                        <button 
                          onClick={() => setConfirmDelete({ id: f.id, type: 'fuel' })}
                          className="absolute top-3 right-3 sm:top-4 sm:right-4 text-red-500/30 hover:text-red-500 p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all hover:bg-red-500/10"
                        >
                          <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                        </button>
                        <div className="space-y-1.5 sm:space-y-2 relative z-10">
                          <label className="text-[9px] font-black tracking-[0.3em] uppercase text-slate-400">FUEL TYPE</label>
                          <input 
                            type="text" 
                            value={f.type}
                            onChange={(e) => {
                              const newFuels = data.fuelTypes.map(item => item.id === f.id ? { ...item, type: e.target.value } : item);
                              setData({ ...data, fuelTypes: newFuels });
                            }}
                            className={`w-full bg-transparent border-none p-0 text-base sm:text-lg font-black italic uppercase focus:ring-0 focus:outline-none ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                            placeholder="Fuel Type (e.g. LSFO)"
                          />
                        </div>
                        <div className="space-y-1.5 sm:space-y-2 relative z-10">
                          <label className="text-[9px] font-black tracking-[0.3em] uppercase text-slate-400">INITIAL ROB</label>
                          <input 
                            type="text" 
                            value={f.rob}
                            onChange={(e) => {
                              const newFuels = data.fuelTypes.map(item => item.id === f.id ? { ...item, rob: e.target.value, initialRob: e.target.value } : item);
                              setData({ ...data, fuelTypes: newFuels });
                            }}
                            placeholder="0"
                            className={`w-full ${theme === 'dark' ? 'bg-[#050B15] border-white/5 text-white' : 'bg-slate-50 border-slate-100 text-[#0A3161]'} p-3 sm:p-4 rounded-xl sm:rounded-2xl font-black outline-none border-2 focus:border-[#00A8A8] transition-all text-base sm:text-lg`}
                          />
                        </div>
                        <div className="space-y-1.5 sm:space-y-2 relative z-10">
                          <label className="text-[9px] font-black tracking-[0.3em] uppercase text-[#00A8A8]">What is the total fuel storage capacity of the vessel?</label>
                          <input 
                            type="text" 
                            value={f.capacity}
                            onChange={(e) => {
                              const newFuels = data.fuelTypes.map(item => item.id === f.id ? { ...item, capacity: e.target.value } : item);
                              setData({ ...data, fuelTypes: newFuels });
                            }}
                            placeholder="0"
                            className={`w-full ${theme === 'dark' ? 'bg-[#050B15] border-white/5 text-white' : 'bg-slate-50 border-slate-100 text-[#0A3161]'} p-3 sm:p-4 rounded-xl sm:rounded-2xl font-black outline-none border-2 focus:border-[#00A8A8] transition-all text-base sm:text-lg`}
                          />
                        </div>
                      </div>
                    ))}

                    <button onClick={addFuel} className={`w-full border-2 border-dashed ${theme === 'dark' ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50'} p-4 sm:p-6 rounded-2xl sm:rounded-[32px] flex flex-col items-center justify-center gap-2 sm:gap-3 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-[#00A8A8] transition-all active:scale-95`}>
                      <div className="bg-[#00A8A8] text-[#0A192F] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg shadow-cyan-500/20">
                        <Plus size={20} className="sm:w-6 sm:h-6" />
                      </div>
                      ADD NEW FUEL GRADE
                    </button>
                  </div>
                </div>
                {renderFooter(nextStep, "NEXT", true, false, false)}
              </motion.div>
            )}

            {step === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col min-h-[calc(100vh-140px)] sm:min-h-[calc(100vh-180px)]"
              >
                {renderHeader("LUBRICATING OILS")}
                {renderProgress()}
                <div className="px-4 sm:px-6 space-y-5 sm:space-y-8 flex-1">
                  <div className="space-y-2 sm:space-y-3">
                    <div className={`inline-block px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[9px] font-black tracking-[0.2em] uppercase ${theme === 'dark' ? 'bg-white/5 text-[#4DE8E8] border border-white/10' : 'bg-[#0A3161]/5 text-[#0A3161] border border-[#0A3161]/10'}`}>
                      Step 04 / 06
                    </div>
                    <h2 className={`text-2xl sm:text-3xl font-black tracking-tighter italic uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>Lubricating <span className="text-[#00A8A8]">Oils</span></h2>
                    <p className="text-slate-500 text-xs sm:text-sm font-medium leading-relaxed">Define initial ROB, storage capacity and minimum levels for lube oils.</p>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    {data.oilTypes.map((o) => (
                      <div key={o.id} className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[32px] shadow-2xl border-l-4 border-l-[#00A8A8] border space-y-3.5 sm:space-y-5 relative overflow-hidden group`}>
                        <div className="flex items-center justify-between relative z-10">
                          <input 
                            type="text" 
                            value={o.name}
                            onChange={(e) => {
                              const newOils = data.oilTypes.map(item => item.id === o.id ? { ...item, name: e.target.value } : item);
                              setData({ ...data, oilTypes: newOils });
                            }}
                            className={`bg-transparent border-none p-0 font-black text-base sm:text-lg italic uppercase tracking-tight focus:ring-0 focus:outline-none w-full ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                            placeholder="Oil Name (e.g. ME CYL OIL)"
                          />
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <button 
                              onClick={() => setConfirmDelete({ id: o.id, type: 'oil' })}
                              className="text-red-500/30 hover:text-red-500 p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all hover:bg-red-500/10"
                            >
                              <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                            </button>
                            <Droplets className="text-orange-400" size={18} />
                          </div>
                        </div>
                        <div className="space-y-1.5 sm:space-y-2 relative z-10">
                          <label className="text-[9px] font-black tracking-[0.3em] uppercase text-slate-400">INITIAL ROB</label>
                          <input 
                            type="text" 
                            value={o.rob}
                            onChange={(e) => {
                              const newOils = data.oilTypes.map(item => item.id === o.id ? { ...item, rob: e.target.value, initialRob: e.target.value } : item);
                              setData({ ...data, oilTypes: newOils });
                            }}
                            placeholder="0"
                            className={`w-full ${theme === 'dark' ? 'bg-[#050B15] border-white/5 text-white' : 'bg-slate-50 border-slate-100 text-[#0A3161]'} p-3 sm:p-4 rounded-xl sm:rounded-2xl font-black outline-none border-2 focus:border-[#00A8A8] transition-all text-base sm:text-lg`}
                          />
                        </div>
                        <div className="space-y-1.5 sm:space-y-2 relative z-10">
                          <label className="text-[9px] font-black tracking-[0.3em] uppercase text-slate-400 text-[#00A8A8]">What is the total oil storage capacity of the vessel?</label>
                          <input 
                            type="text" 
                            value={o.capacity}
                            onChange={(e) => {
                              const newOils = data.oilTypes.map(item => item.id === o.id ? { ...item, capacity: e.target.value } : item);
                              setData({ ...data, oilTypes: newOils });
                            }}
                            placeholder="0"
                            className={`w-full ${theme === 'dark' ? 'bg-[#050B15] border-white/5 text-white' : 'bg-slate-50 border-slate-100 text-[#0A3161]'} p-3 sm:p-4 rounded-xl sm:rounded-2xl font-black outline-none border-2 focus:border-[#00A8A8] transition-all text-base sm:text-lg`}
                          />
                        </div>
                        <div className="space-y-1.5 sm:space-y-2 relative z-10">
                          <label className="text-[9px] font-black tracking-[0.3em] uppercase text-slate-400">MINIMUM THRESHOLD</label>
                          <input 
                            type="text" 
                            value={o.threshold}
                            onChange={(e) => {
                              const newOils = data.oilTypes.map(item => item.id === o.id ? { ...item, threshold: e.target.value } : item);
                              setData({ ...data, oilTypes: newOils });
                            }}
                            placeholder="0"
                            className={`w-full ${theme === 'dark' ? 'bg-[#050B15] border-white/5 text-white' : 'bg-slate-50 border-slate-100 text-[#0A3161]'} p-3 sm:p-4 rounded-xl sm:rounded-2xl font-black outline-none border-2 focus:border-[#00A8A8] transition-all text-base sm:text-lg`}
                          />
                        </div>
                      </div>
                    ))}

                    <button onClick={addOil} className={`w-full border-2 border-dashed ${theme === 'dark' ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50'} p-4 sm:p-6 rounded-2xl sm:rounded-[32px] flex flex-col items-center justify-center gap-2 sm:gap-3 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-[#00A8A8] transition-all active:scale-95`}>
                      <div className={`${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'} text-slate-400 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl`}>
                        <Plus size={20} className="sm:w-6 sm:h-6" />
                      </div>
                      ADD NEW OIL TYPE
                    </button>
                  </div>
                </div>
                {renderFooter(nextStep, "NEXT", true, false, false)}
              </motion.div>
            )}

            {step === 5 && (
              <motion.div 
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col min-h-[calc(100vh-140px)] sm:min-h-[calc(100vh-180px)]"
              >
                {renderHeader("MACHINERY SELECTION")}
                {renderProgress()}
                <div className="px-4 sm:px-6 space-y-5 sm:space-y-8 flex-1">
                  <div className="space-y-2 sm:space-y-3">
                    <div className={`inline-block px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[9px] font-black tracking-[0.2em] uppercase ${theme === 'dark' ? 'bg-white/5 text-[#4DE8E8] border border-white/10' : 'bg-[#0A3161]/5 text-[#0A3161] border border-[#0A3161]/10'}`}>
                      Step 05 / 06
                    </div>
                    <h2 className={`text-2xl sm:text-3xl font-black tracking-tighter italic uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>Select Vessel <span className="text-[#00A8A8]">Machinery</span></h2>
                    <p className="text-slate-500 text-xs sm:text-sm font-medium leading-relaxed">
                      Specify the operational machinery on your vessel to calibrate monitoring telemetry.
                    </p>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    {data.machinery.map((m) => (
                      <div 
                        key={m.id}
                        className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} p-4 sm:p-5 rounded-2xl sm:rounded-[32px] flex flex-col gap-3 sm:gap-4 border-2 transition-all shadow-lg relative overflow-hidden group`}
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-colors shrink-0 ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}`}>
                            {m.icon === 'me' ? <Cpu className="text-[#00A8A8]" size={20} /> : m.icon === 'ge' ? <Zap className="text-[#00A8A8]" size={20} /> : m.icon === 'blr' ? <Flame className="text-[#00A8A8]" size={20} /> : <Settings2 className="text-[#00A8A8]" size={20} />}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <input 
                              type="text"
                              value={m.name}
                              onChange={(e) => {
                                const newMachinery = data.machinery.map(item => item.id === m.id ? { ...item, name: e.target.value } : item);
                                setData({ ...data, machinery: newMachinery });
                              }}
                              className={`bg-transparent font-black text-xs sm:text-sm uppercase tracking-tight focus:outline-none w-full truncate ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}
                            />
                            <input 
                              type="text"
                              value={m.desc}
                              onChange={(e) => {
                                const newMachinery = data.machinery.map(item => item.id === m.id ? { ...item, desc: e.target.value } : item);
                                setData({ ...data, machinery: newMachinery });
                              }}
                              className={`bg-transparent text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider focus:outline-none w-full mt-0.5 truncate`}
                            />
                          </div>
                          <button 
                            onClick={() => setConfirmDelete({ id: m.id, type: 'machinery' })}
                            className="text-red-400/30 hover:text-red-400 p-1.5 sm:p-2 transition-colors shrink-0"
                          >
                            <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                          </button>
                        </div>
                        
                        {/* Icon Picker in Onboarding */}
                        <div className="space-y-2 sm:space-y-3">
                          <label className="text-[8px] sm:text-[9px] font-black tracking-[0.2em] uppercase text-slate-400">Select Icon</label>
                          <div className="flex gap-2">
                            {machineryIcons.map(icon => (
                              <button
                                key={icon.id}
                                onClick={() => {
                                  const newMachinery = data.machinery.map(item => item.id === m.id ? { ...item, icon: icon.id as any } : item);
                                  setData({ ...data, machinery: newMachinery });
                                }}
                                className={`p-1.5 sm:p-2 rounded-lg border transition-all ${
                                  m.icon === icon.id 
                                    ? 'bg-[#00A8A8] border-[#00A8A8] text-[#0A192F]' 
                                    : theme === 'dark' ? 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                                }`}
                              >
                                {icon.icon}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Oil Selection */}
                        <div className="space-y-2 sm:space-y-3 pt-2 border-t border-white/5">
                          <label className="text-[8px] sm:text-[9px] font-black tracking-[0.2em] uppercase text-[#00A8A8]">What oil does this machinery use?</label>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {data.oilTypes.map(oil => (
                              <button
                                key={oil.id}
                                onClick={() => {
                                  const isUsed = m.usedOils.includes(oil.id);
                                  const newUsedOils = isUsed 
                                    ? m.usedOils.filter(id => id !== oil.id)
                                    : [...m.usedOils, oil.id];
                                  const newMachinery = data.machinery.map(item => item.id === m.id ? { ...item, usedOils: newUsedOils } : item);
                                  setData({ ...data, machinery: newMachinery });
                                }}
                                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider border transition-all ${
                                  m.usedOils.includes(oil.id)
                                    ? 'bg-[#00A8A8]/20 border-[#00A8A8] text-[#00A8A8]'
                                    : theme === 'dark' ? 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                                }`}
                              >
                                {oil.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}

                    <button 
                      onClick={addMachinery}
                      className={`w-full border-2 border-dashed ${theme === 'dark' ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50'} p-4 sm:p-5 rounded-xl sm:rounded-[24px] flex items-center justify-center gap-2 sm:gap-3 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-[#00A8A8] transition-all active:scale-95`}
                    >
                      <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />
                      ADD NEW MACHINERY
                    </button>
                  </div>
                </div>
                {renderFooter(nextStep, "NEXT", true, false, false)}
              </motion.div>
            )}

            {step === 6 && (
              <motion.div 
                key="step6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col min-h-[calc(100vh-140px)] sm:min-h-[calc(100vh-180px)]"
              >
                {renderHeader("CALCULATION METHOD")}
                {renderProgress()}

                <div className="px-4 sm:px-6 space-y-5 sm:space-y-8 flex-1">
                  <div className="space-y-2 sm:space-y-3">
                    <div className={`inline-block px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[9px] font-black tracking-[0.2em] uppercase ${theme === 'dark' ? 'bg-white/5 text-[#4DE8E8] border border-white/10' : 'bg-[#0A3161]/5 text-[#0A3161] border border-[#0A3161]/10'}`}>
                      Step 06 / 06
                    </div>
                    <h2 className={`text-2xl sm:text-3xl font-black tracking-tighter italic uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>Data <span className="text-[#00A8A8]">Source</span></h2>
                    <p className="text-slate-500 text-xs sm:text-sm font-medium leading-relaxed">
                      Choose how your vessel's fuel consumption is primarily measured.
                    </p>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    {[
                      { id: 'flowmeter', title: 'Flowmeter based', desc: 'Calculate consumption by subtracting the flowmeter reading.', icon: <Droplets className="text-[#00A8A8]" size={24} /> }
                    ].map((m) => (
                      <button 
                        key={m.id}
                        onClick={() => setData({ ...data, calculationMethod: m.id as any })}
                        className={`${theme === 'dark' ? 'bg-[#0A192F]/80 border-white/10' : 'bg-white border-[#0A3161]/10'} backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[32px] flex items-start gap-3.5 sm:gap-5 border-2 transition-all shadow-xl relative overflow-hidden group ${
                          data.calculationMethod === m.id 
                            ? 'border-[#00A8A8] shadow-cyan-500/20' 
                            : 'hover:border-slate-300'
                        }`}
                      >
                        <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-colors shrink-0 ${data.calculationMethod === m.id ? 'bg-[#0A192F]/10' : theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}`}>
                          {m.icon}
                        </div>
                        <div className="flex-1 text-left space-y-0.5 sm:space-y-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className={`font-black text-base sm:text-lg italic uppercase tracking-tight truncate ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>{m.title}</h3>
                            {data.calculationMethod === m.id && (
                              <div className="bg-[#00A8A8] text-[#0A192F] rounded-full p-1 shrink-0 ml-2">
                                <Check size={14} />
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-snug">{m.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                {renderFooter(() => {
                  setData(prev => ({ ...prev, onboardingCompleted: true, lastModified: Date.now() }));
                  setStep(totalSteps + 1);
                }, "FINISH", true, false, false)}
              </motion.div>
            )}

            {step > totalSteps && (
              <>
                <motion.div
                  key="main-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {activeTab === 'dashboard' && (
                    <Dashboard 
                      data={data} 
                      setData={setData} 
                      onOpenSettings={handleOpenSettings} 
                      theme={theme} 
                      isSyncing={isSyncing} 
                      isOffline={isOffline} 
                      lastSynced={lastSynced} 
                      setShowBunkerModal={setShowBunkerModal}
                      onNavigateToReport={() => setActiveTab('daily-entry')}
                    />
                  )}
                  {(activeTab === 'daily-entry' || activeTab === 'report' || activeTab.startsWith('fuel-') || activeTab === 'lo') && (
                    <ReportView 
                      data={data} 
                      setData={setData} 
                      onOpenSettings={handleOpenSettings} 
                      theme={theme}
                      setShowBunkerModal={setShowBunkerModal}
                    />
                  )}
                </motion.div>
                <BottomNav activeTab={activeTab} onTabChange={setActiveTab} theme={theme} data={data} />
              </>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showSettings && (
              <SettingsView 
                data={data} 
                setData={setData} 
                onClose={() => {
                  setShowSettings(false);
                  setTargetSection(null);
                }}
                theme={theme}
                setTheme={setTheme}
                addFuel={addFuel}
                removeFuel={(id) => setConfirmDelete({ id, type: 'fuel' })}
                addOil={addOil}
                removeOil={(id) => setConfirmDelete({ id, type: 'oil' })}
                addMachinery={addMachinery}
                removeMachinery={(id) => setConfirmDelete({ id, type: 'machinery' })}
                initialSection={targetSection}
                deferredPrompt={deferredPrompt}
                onInstall={handleInstallClick}
                mergeData={mergeData}
                lastSynced={lastSynced}
                setLastSynced={setLastSynced}
                swReady={swReady}
                setConfirmReset={setConfirmReset}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showBunkerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setShowBunkerModal(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={`${theme === 'dark' ? 'bg-[#0A192F] border-white/10' : 'bg-white border-[#0A3161]/10'} w-full max-w-md rounded-2xl sm:rounded-[40px] border shadow-2xl overflow-hidden relative z-10`}
          >
            <div className="p-5 sm:p-8 space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="bg-[#4DE8E8]/10 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl">
                    <Plus size={20} className="text-[#4DE8E8] sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h3 className={`text-lg sm:text-xl font-black tracking-tighter uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0A3161]'}`}>Record Bunker</h3>
                    <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Update your ROB inventory</p>
                  </div>
                </div>
                <button onClick={() => setShowBunkerModal(false)} className="text-slate-400 hover:text-white p-1.5 sm:p-2">
                  <X size={18} className="sm:w-5 sm:h-5" />
                </button>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Fuel / Oil Grade</label>
                  <select 
                    id="bunker-type"
                    className={`w-full ${theme === 'dark' ? 'bg-[#050B15] border-white/5 text-white' : 'bg-slate-50 border-slate-100 text-[#0A3161]'} p-3 sm:p-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-base outline-none border-2 focus:border-[#4DE8E8] transition-all appearance-none`}
                  >
                    <optgroup label="Fuel Grades">
                      {data.fuelTypes.map(f => <option key={f.id} value={f.type}>{f.type}</option>)}
                    </optgroup>
                    <optgroup label="Oil Grades">
                      {data.oilTypes.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
                    </optgroup>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</label>
                    <input 
                      id="bunker-value"
                      type="number" 
                      placeholder="0.0"
                      className={`w-full ${theme === 'dark' ? 'bg-[#050B15] border-white/5 text-white' : 'bg-slate-50 border-slate-100 text-[#0A3161]'} p-3 sm:p-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-base outline-none border-2 focus:border-[#4DE8E8] transition-all`}
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit</label>
                    <select 
                      id="bunker-unit"
                      className={`w-full ${theme === 'dark' ? 'bg-[#050B15] border-white/5 text-white' : 'bg-slate-50 border-slate-100 text-[#0A3161]'} p-3 sm:p-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-base outline-none border-2 focus:border-[#4DE8E8] transition-all appearance-none`}
                    >
                      <option value="MT">MT (Fuel)</option>
                      <option value="L">L (Oil)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Port / Location</label>
                  <input 
                    id="bunker-port"
                    type="text" 
                    placeholder="SINGAPORE"
                    className={`w-full ${theme === 'dark' ? 'bg-[#050B15] border-white/5 text-white' : 'bg-slate-50 border-slate-100 text-[#0A3161]'} p-3 sm:p-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-base outline-none border-2 focus:border-[#4DE8E8] transition-all`}
                  />
                </div>
              </div>

              <button 
                onClick={() => {
                  const type = (document.getElementById('bunker-type') as HTMLSelectElement).value;
                  const value = (document.getElementById('bunker-value') as HTMLInputElement).value;
                  const unit = (document.getElementById('bunker-unit') as HTMLSelectElement).value;
                  const port = (document.getElementById('bunker-port') as HTMLInputElement).value;
                  
                  if (!value || parseFloat(value) <= 0) return;

                  const newBunkerLog: BunkerLog = {
                    id: uuidv4(),
                    timestamp: new Date().toISOString(),
                    type,
                    value,
                    unit,
                    port,
                    lastModified: Date.now()
                  };

                  setData(recalculateRob({
                    ...data,
                    bunkerLogs: [...(data.bunkerLogs || []), newBunkerLog]
                  }));
                  setShowBunkerModal(false);
                  setShowToast({ message: `Successfully recorded ${value} ${unit} of ${type}`, type: 'success' });
                }}
                className="w-full bg-[#4DE8E8] text-[#0A192F] py-3.5 sm:py-5 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest shadow-xl shadow-cyan-500/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                Confirm Bunker
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showToast && (
              <motion.div
                id="app-toast"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className={`fixed bottom-20 sm:bottom-24 left-4 right-4 sm:left-6 sm:right-6 z-[100] p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-2xl flex items-center gap-2.5 sm:gap-3 border ${
                  showToast.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' : 
                  showToast.type === 'error' ? 'bg-red-500 border-red-400 text-white' :
                  'bg-[#0A3161] border-white/10 text-white'
                }`}
              >
                {showToast.type === 'success' ? <Check size={18} className="sm:w-5 sm:h-5" /> : showToast.type === 'error' ? <AlertCircle size={18} className="sm:w-5 sm:h-5" /> : <WifiOff size={18} className="sm:w-5 sm:h-5" />}
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">{showToast.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {confirmDelete && (
              <ConfirmModal 
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                  if (!confirmDelete) return;
                  if (confirmDelete.type === 'machinery') removeMachinery(confirmDelete.id);
                  if (confirmDelete.type === 'fuel') removeFuel(confirmDelete.id);
                  if (confirmDelete.type === 'oil') removeOil(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                title={`Delete ${confirmDelete?.type || ''}`}
                message={`Are you sure you want to remove this ${confirmDelete?.type || ''}? This action cannot be undone.`}
                theme={theme}
              />
            )}
            {confirmReset && (
              <ConfirmModal 
                isOpen={!!confirmReset}
                onClose={() => setConfirmReset(null)}
                onConfirm={() => {
                  if (confirmReset === 'all') clearAllData();
                }}
                title="Erase All Data"
                message="Are you sure you want to erase ALL data and restart the onboarding procedure? This will reset the entire application to its initial state. This action cannot be undone."
                theme={theme}
                confirmLabel="Erase"
              />
            )}
          </AnimatePresence>

          {/* Grid background pattern for some steps */}
          {(step === 2 || step === 3 || step === 4 || step === 6) && (
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-[-1]" 
                 style={{ backgroundImage: 'radial-gradient(#0A3161 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          )}
        </>
      )}
    </div>
  );
}
