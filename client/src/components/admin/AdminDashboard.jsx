import React, { useState, useEffect } from 'react';
import { equipmentApi } from '../../api/equipment.js';
import { AdminBookingsTab } from './AdminBookingsTab.jsx';
import { AdminCalendarTab } from './AdminCalendarTab.jsx';
import { AdminPaymentsTab } from './AdminPaymentsTab.jsx';
import { AdminMembershipsTab } from './AdminMembershipsTab.jsx';
import { AdminAnalyticsView } from './analytics/AdminAnalyticsView.jsx';
import { AdminAutomationTab } from './AdminAutomationTab.jsx';
import { UserManagementTab } from './UserManagementTab.jsx';
import { AdminEmailTab } from './AdminEmailTab.jsx';
import { ReportExportModal } from './analytics/ReportExportModal.jsx';
import {
  Tv,
  Gamepad2,
  FolderTree,
  Coins,
  Wrench,
  BarChart3,
  TrendingUp,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Flame,
  Users,
  Clock,
  Edit2,
  Trash2,
  RefreshCw,
  Power,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  DollarSign,
  Calendar,
  Check,
  Crown,
  Bot,
  Mail,
  X,
  Shield,
  Download,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { ConfirmModal } from '../common/ConfirmModal.jsx';
import { showToast } from '../../utils/toast.js';
import { SystemStatus } from '../SystemStatus.jsx';
import { Pagination } from '../common/Pagination.jsx';
import { ChevronDown } from 'lucide-react';

export const AdminDashboard = ({ initialTab = 'overview', onClose }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'overview'); // overview, devices, games, categories, pricing, maintenance
  const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Pagination states
  const [devicePage, setDevicePage] = useState(1);
  const [gamePage, setGamePage] = useState(1);
  const [exclusivePage, setExclusivePage] = useState(1);
  const [categoryPage, setCategoryPage] = useState(1);
  const [maintPage, setMaintPage] = useState(1);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Data states
  const [devices, setDevices] = useState([]);
  const [games, setGames] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pricingPlans, setPricingPlans] = useState([]);
  const [maintenanceList, setMaintenanceList] = useState([]);

  // Loading & status
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Reusable confirmation modal state
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Delete',
    onConfirm: null,
  });

  // Modals state
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [deviceForm, setDeviceForm] = useState({
    name: '',
    deviceCode: '',
    deviceType: 'PS5',
    description: '',
    capacity: 4,
    status: 'ACTIVE',
  });

  const [gameModalOpen, setGameModalOpen] = useState(false);
  const [editingGame, setEditingGame] = useState(null);
  const [gameForm, setGameForm] = useState({
    name: '',
    description: '',
    thumbnail: '',
    category: '',
    compatibleDevices: [],
    minPlayers: 1,
    maxPlayers: 4,
    bookingMode: 'BOTH',
    isExclusive: false,
    advancePaymentRequired: false,
    minimumAdvancePayment: 0,
    minimumDuration: 60,
    maximumDuration: 240,
    status: 'ACTIVE',
  });

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', status: 'ACTIVE' });

  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [editingPricing, setEditingPricing] = useState(null);
  const [pricingForm, setPricingForm] = useState({
    name: '',
    deviceType: 'PS5',
    billingType: 'PER_PLAYER_HOURLY',
    amountInRupees: 60,
    minimumDuration: 60,
    maximumDuration: 240,
    status: 'ACTIVE',
  });

  const [maintModalOpen, setMaintModalOpen] = useState(false);
  const [maintForm, setMaintForm] = useState({
    device: '',
    reason: '',
    expectedEndDate: '',
    notes: '',
  });

  // Price Calculator Tester state
  const [calcDeviceId, setCalcDeviceId] = useState('');
  const [calcDuration, setCalcDuration] = useState(1);
  const [calcPlayers, setCalcPlayers] = useState(1);
  const [calcResult, setCalcResult] = useState(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Initial load
  const fetchAllData = async () => {
    setLoading(true);
    setActionError('');
    try {
      const [devRes, gmRes, catRes, prRes, mnRes] = await Promise.all([
        equipmentApi.getDevices(),
        equipmentApi.getGames(),
        equipmentApi.getCategories(),
        equipmentApi.getPricing(),
        equipmentApi.getMaintenance(),
      ]);

      if (devRes.success) setDevices(devRes.data.devices);
      if (gmRes.success) setGames(gmRes.data.games);
      if (catRes.success) setCategories(catRes.data.categories);
      if (prRes.success) setPricingPlans(prRes.data.pricingPlans);
      if (mnRes.success) setMaintenanceList(mnRes.data.maintenanceList);
    } catch (err) {
      setActionError(err.message || 'Failed to load management data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const showNotification = (msg) => {
    setActionSuccess(msg);
    showToast.success(msg);
    setTimeout(() => setActionSuccess(''), 4000);
  };

  const showError = (msg) => {
    setActionError(msg);
    showToast.error(msg);
    setTimeout(() => setActionError(''), 6000);
  };

  // ---------------- DEVICE HANDLERS ----------------
  const handleSaveDevice = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      if (editingDevice) {
        const res = await equipmentApi.updateDevice(editingDevice._id, deviceForm);
        if (res.success) showNotification(`Device '${res.data.device.name}' updated successfully.`);
      } else {
        const res = await equipmentApi.createDevice(deviceForm);
        if (res.success) showNotification(`Device '${res.data.device.name}' registered successfully.`);
      }
      setDeviceModalOpen(false);
      setEditingDevice(null);
      fetchAllData();
    } catch (err) {
      showError(err.message);
    }
  };

  const handleToggleDeviceStatus = async (device) => {
    try {
      const newStatus = device.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const res = await equipmentApi.updateDevice(device._id, { status: newStatus });
      if (res.success) {
        showNotification(`Device '${device.name}' status changed to ${newStatus}.`);
        fetchAllData();
      }
    } catch (err) {
      showError(err.message);
    }
  };

  const handleDeleteDevice = (id, name) => {
    setConfirmState({
      isOpen: true,
      title: 'Remove Device',
      message: `Are you sure you want to remove device '${name}'? This action cannot be undone if the device has active dependencies.`,
      confirmText: 'Remove Device',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await equipmentApi.deleteDevice(id);
          if (res.success) {
            showNotification(`Device '${name}' removed.`);
            fetchAllData();
          }
        } catch (err) {
          showError(err.message);
        } finally {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // ---------------- GAME HANDLERS ----------------
  const handleSaveGame = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      const minP = parseInt(gameForm.minPlayers, 10) || 1;
      const maxP = parseInt(gameForm.maxPlayers, 10) || 4;

      if (minP < 1) {
        showError('Minimum players must be at least 1.');
        return;
      }
      if (maxP < minP) {
        showError('Maximum players must be greater than or equal to minimum players.');
        return;
      }
      if (maxP > 4) {
        showError('For PS5 lounge games, maximum capacity cannot exceed 4 players.');
        return;
      }

      const payload = {
        ...gameForm,
        minPlayers: minP,
        maxPlayers: maxP,
      };

      if (editingGame) {
        const res = await equipmentApi.updateGame(editingGame._id, payload);
        if (res.success) showNotification(`Game '${res.data.game.name}' updated.`);
      } else {
        const res = await equipmentApi.createGame(payload);
        if (res.success) showNotification(`Game '${res.data.game.name}' registered.`);
      }
      setGameModalOpen(false);
      setEditingGame(null);
      fetchAllData();
    } catch (err) {
      showError(err.message);
    }
  };

  const handleToggleGameStatus = async (game) => {
    try {
      const newStatus = game.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const res = await equipmentApi.updateGame(game._id, { status: newStatus });
      if (res.success) {
        showNotification(`Game '${game.name}' is now ${newStatus}.`);
        fetchAllData();
      }
    } catch (err) {
      showError(err.message);
    }
  };

  const handleDeleteGame = (id, name) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Game',
      message: `Are you sure you want to delete '${name}' from catalog?`,
      confirmText: 'Delete Game',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await equipmentApi.deleteGame(id);
          if (res.success) {
            showNotification(`Game '${name}' deleted.`);
            fetchAllData();
          }
        } catch (err) {
          showError(err.message);
        } finally {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // ---------------- CATEGORY HANDLERS ----------------
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      if (editingCategory) {
        const res = await equipmentApi.updateCategory(editingCategory._id, categoryForm);
        if (res.success) showNotification(`Category '${res.data.category.name}' updated.`);
      } else {
        const res = await equipmentApi.createCategory(categoryForm);
        if (res.success) showNotification(`Category '${res.data.category.name}' created.`);
      }
      setCategoryModalOpen(false);
      setEditingCategory(null);
      fetchAllData();
    } catch (err) {
      showError(err.message);
    }
  };

  const handleDeleteCategory = (id, name) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Category',
      message: `Are you sure you want to delete category '${name}'?`,
      confirmText: 'Delete Category',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await equipmentApi.deleteCategory(id);
          if (res.success) {
            showNotification(`Category '${name}' deleted.`);
            fetchAllData();
          }
        } catch (err) {
          showError(err.message);
        } finally {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // ---------------- PRICING HANDLERS ----------------
  const handleSavePricing = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      if (editingPricing) {
        const res = await equipmentApi.updatePricing(editingPricing._id, pricingForm);
        if (res.success) showNotification(`Pricing rule '${res.data.pricing.name}' updated.`);
      } else {
        const res = await equipmentApi.createPricing(pricingForm);
        if (res.success) showNotification(`Pricing rule '${res.data.pricing.name}' created.`);
      }
      setPricingModalOpen(false);
      setEditingPricing(null);
      fetchAllData();
    } catch (err) {
      showError(err.message);
    }
  };

  const handleDeletePricing = (id, name) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Pricing Rule',
      message: `Are you sure you want to delete pricing rule '${name}'?`,
      confirmText: 'Delete Pricing Rule',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await equipmentApi.deletePricing(id);
          if (res.success) {
            showNotification(`Pricing rule '${name}' deleted.`);
            fetchAllData();
          }
        } catch (err) {
          showError(err.message);
        } finally {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // ---------------- MAINTENANCE HANDLERS ----------------
  const handleStartMaintenance = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      const res = await equipmentApi.createMaintenance(maintForm);
      if (res.success) {
        showNotification(`Device marked under maintenance.`);
        setMaintModalOpen(false);
        setMaintForm({ device: '', reason: '', expectedEndDate: '', notes: '' });
        fetchAllData();
      }
    } catch (err) {
      showError(err.message);
    }
  };

  const handleCompleteMaintenance = async (maintId) => {
    try {
      const res = await equipmentApi.updateMaintenance(maintId, { status: 'COMPLETED' });
      if (res.success) {
        showNotification('Maintenance marked as COMPLETED and device restored to ACTIVE status.');
        fetchAllData();
      }
    } catch (err) {
      showError(err.message);
    }
  };

  // Price Calculation Simulation
  const handleCalculatePrice = async (e) => {
    e.preventDefault();
    if (!calcDeviceId) return;
    try {
      const res = await equipmentApi.calculatePrice({
        deviceId: calcDeviceId,
        durationMinutes: calcDuration * 60,
        playersCount: calcPlayers,
      });
      if (res.success) setCalcResult(res.data);
    } catch (err) {
      showError(err.message);
    }
  };

  // Filtered views
  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.deviceCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter ? d.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const filteredGames = games.filter((g) => {
    const matchesSearch =
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter ? g.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const exclusiveGames = games.filter((g) => g.isExclusive);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4" /> Lounge Operations Console
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              DATABASE: MONGODB ATLAS (CLOUD)
            </span>
          </div>
          <h1 className="text-3xl font-black font-heading text-white">
            ADMINISTRATOR <span className="gaming-gradient-text">MANAGEMENT PANEL</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Centralized control over devices, games catalogue, categories, dynamic pricing, and maintenance history.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
          {/* Switch to Reception POS Desk */}
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#receptionist';
            }}
            style={{
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              outline: 'none',
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#D7FF00]/15 hover:bg-[#D7FF00]/25 text-xs font-bold text-[#D7FF00] border border-[#D7FF00]/40 transition-all shadow-sm active:scale-95"
            title="Switch to Reception Front Desk POS & Live Station Management"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D7FF00]" />
            Front Desk POS
          </button>

          <button
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-[#851B2B] to-[#a32235] hover:from-[#9c2033] hover:to-[#b8273c] text-xs font-bold text-[#FFF4E8] border border-[#F5B942]/30 shadow-md shadow-[#851B2B]/20 transition-all"
            title="Export Business Intelligence & Accounting Reports (.xlsx, .pdf, .csv)"
          >
            <Download className="w-3.5 h-3.5 text-[#D7FF00]" />
            Export Reports
          </button>

          <button
            onClick={fetchAllData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#D7FF00]' : ''}`} />
            Refresh Data
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-[#260D17] hover:bg-[#851B2B]/40 text-[#C7A5A8] hover:text-[#FFF4E8] border border-[#49202C] transition-colors"
              title="Close Admin Panel & Return to Lounge"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2 animate-fadeIn">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Admin Section Selector Dropdown (Replaces horizontal tab bar & eliminates scrollbar) */}
      {(() => {
        const adminTabs = [
          { id: 'overview', label: 'Dashboard Overview', icon: BarChart3 },
          { id: 'users', label: 'User Management', icon: Users },
          { id: 'analytics', label: 'Analytics & Reports (BI)', icon: TrendingUp },
          { id: 'automation', label: 'Automation & Timers', icon: Bot },
          { id: 'email', label: 'Email Integration (Resend)', icon: Mail },
          { id: 'payments', label: 'Payments & Revenue', icon: DollarSign },
          { id: 'memberships', label: 'Memberships & Passes', icon: Crown },
          { id: 'bookings', label: 'Bookings & Walk-ins', icon: Calendar },
          { id: 'calendar', label: 'Timeline Calendar', icon: Clock },
          { id: 'devices', label: `Devices (${devices.length})`, icon: Tv },
          { id: 'games', label: `Games (${games.length})`, icon: Gamepad2 },
          { id: 'exclusive', label: `Exclusive Games (${exclusiveGames.length})`, icon: Flame },
          { id: 'categories', label: `Categories (${categories.length})`, icon: FolderTree },
          { id: 'pricing', label: `Centralized Pricing (${pricingPlans.length})`, icon: Coins },
          { id: 'maintenance', label: `Maintenance (${maintenanceList.length})`, icon: Wrench },
          { id: 'receptionist', label: 'Front Desk POS (Reception Desk)', icon: Sparkles },
          { id: 'health', label: 'System Health & Engine', icon: Shield },
        ];
        const currentTabObj = adminTabs.find((t) => t.id === activeTab) || adminTabs[0];
        const CurrentIcon = currentTabObj.icon;

        return (
          <div className="relative z-30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-[#260D17] border border-[#49202C] shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#851B2B] to-[#A51F35] text-[#FFF4E8] flex items-center justify-center shrink-0 shadow-md shadow-[#851B2B]/40">
                  <CurrentIcon className="w-5 h-5 text-[#D7FF00]" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#F5B942] font-bold">
                    Admin Management Section
                  </span>
                  <h2 className="text-base sm:text-lg font-black font-heading text-[#FFF4E8] tracking-wide">
                    {currentTabObj.label}
                  </h2>
                </div>
              </div>

              {/* Single Section Dropdown Selector */}
              <div className="relative w-full sm:w-80">
                <button
                  type="button"
                  onClick={() => setSectionDropdownOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#171014] border border-[#49202C] hover:border-[#851B2B] text-xs font-semibold text-[#FFF4E8] transition-all shadow-inner focus:outline-none focus:ring-1 focus:ring-[#851B2B]"
                  aria-expanded={sectionDropdownOpen}
                  aria-label="Select Admin Management Section"
                >
                  <div className="flex items-center gap-2 truncate">
                    <CurrentIcon className="w-4 h-4 text-[#D7FF00] shrink-0" />
                    <span className="truncate">{currentTabObj.label}</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-[#C7A5A8] transition-transform duration-200 shrink-0 ${
                      sectionDropdownOpen ? 'rotate-180 text-[#D7FF00]' : ''
                    }`}
                  />
                </button>

                {sectionDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setSectionDropdownOpen(false)}
                    />
                    <div className="absolute top-full right-0 mt-1.5 w-full sm:w-80 max-h-80 overflow-y-auto rounded-2xl bg-[#171014] border border-[#49202C] shadow-2xl z-40 p-1.5 space-y-1">
                      {adminTabs.map((tab) => {
                        const TabIcon = tab.icon;
                        const isSelected = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              if (tab.id === 'receptionist') {
                                setSectionDropdownOpen(false);
                                window.location.hash = '#receptionist';
                                return;
                              }
                              setActiveTab(tab.id);
                              setSectionDropdownOpen(false);
                              setSearchQuery('');
                              setStatusFilter('');
                              window.location.hash = tab.id === 'overview' ? '#admin' : `#admin-${tab.id}`;
                            }}
                            className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                              isSelected
                                ? 'bg-[#851B2B] text-[#FFF4E8] shadow-md shadow-[#851B2B]/40'
                                : 'text-[#C7A5A8] hover:text-[#FFF4E8] hover:bg-[#260D17]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <TabIcon
                                className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#D7FF00]' : 'text-[#C7A5A8]'}`}
                              />
                              <span className="truncate">{tab.label}</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#D7FF00] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---------------- TAB 1: OVERVIEW & ANALYTICS ---------------- */}
      {(activeTab === 'overview' || activeTab === 'analytics') && (
        <AdminAnalyticsView />
      )}

      {/* ---------------- TAB: USER MANAGEMENT & GUEST CONVERSION ---------------- */}
      {activeTab === 'users' && (
        <UserManagementTab isAdmin={true} />
      )}

      {/* ---------------- TAB: TRANSACTIONAL EMAIL (RESEND) ---------------- */}
      {activeTab === 'email' && (
        <AdminEmailTab />
      )}

      {/* ---------------- TAB 2: DEVICE MANAGEMENT ---------------- */}
      {activeTab === 'devices' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search device by name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#171014] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-[#851B2B]"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-[#171014] border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </div>

            <button
              onClick={() => {
                setEditingDevice(null);
                setDeviceForm({
                  name: '',
                  deviceCode: `DEV-${Date.now().toString().slice(-4)}`,
                  deviceType: 'PS5',
                  description: '',
                  capacity: 4,
                  status: 'ACTIVE',
                });
                setDeviceModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#D7FF00] hover:bg-[#cbf200] text-[#171014] font-bold text-xs uppercase tracking-wider font-heading"
            >
              <Plus className="w-4 h-4" /> Add Device
            </button>
          </div>

          {/* Devices Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#171014] shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Device Code</th>
                  <th className="py-3.5 px-4">Device Name</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Capacity</th>
                  <th className="py-3.5 px-4">Games Supported</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredDevices.slice((devicePage - 1) * 6, devicePage * 6).map((device) => (
                  <tr key={device._id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-[#D7FF00]">{device.deviceCode}</td>
                    <td className="py-3.5 px-4 font-sans font-semibold text-white">{device.name}</td>
                    <td className="py-3.5 px-4 font-sans text-slate-300">{device.deviceType}</td>
                    <td className="py-3.5 px-4 text-slate-300">{device.capacity} Players</td>
                    <td className="py-3.5 px-4 font-sans text-slate-400">
                      {device.supportedGames?.length || 0} games assigned
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
                          device.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : device.status === 'MAINTENANCE'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {device.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-sans">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleDeviceStatus(device)}
                          title="Toggle Active / Inactive"
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setMaintForm({ device: device._id, reason: '', expectedEndDate: '', notes: '' });
                            setMaintModalOpen(true);
                          }}
                          title="Schedule Maintenance"
                          className="p-1.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 transition-colors"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingDevice(device);
                            setDeviceForm({
                              name: device.name,
                              deviceCode: device.deviceCode,
                              deviceType: device.deviceType,
                              description: device.description || '',
                              capacity: device.capacity,
                              status: device.status,
                            });
                            setDeviceModalOpen(true);
                          }}
                          title="Edit Device"
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[#D7FF00] transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDevice(device._id, device.name)}
                          title="Delete Device"
                          className="p-1.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredDevices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                      No devices matching your search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={devicePage}
            totalPages={Math.ceil(filteredDevices.length / 6)}
            totalItems={filteredDevices.length}
            pageSize={6}
            onPageChange={setDevicePage}
          />
        </div>
      )}

      {/* ---------------- TAB 3: GAME MANAGEMENT ---------------- */}
      {activeTab === 'games' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search games..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#171014] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-[#851B2B]"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-[#171014] border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            <button
              onClick={() => {
                setEditingGame(null);
                setGameForm({
                  name: '',
                  description: '',
                  thumbnail: '',
                  category: categories[0]?._id || '',
                  compatibleDevices: devices.filter((d) => d.deviceType === 'PS5').map((d) => d._id),
                  minPlayers: 1,
                  maxPlayers: 4,
                  bookingMode: 'BOTH',
                  isExclusive: false,
                  advancePaymentRequired: false,
                  minimumAdvancePayment: 0,
                  minimumDuration: 60,
                  maximumDuration: 240,
                  status: 'ACTIVE',
                });
                setGameModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#D7FF00] hover:bg-[#cbf200] text-[#171014] font-bold text-xs uppercase tracking-wider font-heading"
            >
              <Plus className="w-4 h-4" /> Add New Game
            </button>
          </div>

          {/* Games Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredGames.slice((gamePage - 1) * 6, gamePage * 6).map((game) => (
              <div
                key={game._id}
                className={`p-5 rounded-2xl bg-[#171014] border transition-all flex flex-col justify-between ${
                  game.isExclusive
                    ? 'border-amber-500/40 shadow-lg shadow-amber-500/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                      {game.category?.name || 'Uncategorized'}
                    </span>
                    <div className="flex items-center gap-2">
                      {game.isExclusive && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Flame className="w-3 h-3" /> Exclusive
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          game.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        {game.status}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-lg font-bold text-white font-heading">{game.name}</h4>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {game.description || 'No description provided.'}
                  </p>

                  <div className="pt-2 text-xs space-y-1.5 text-slate-400 font-mono">
                    <div className="flex items-center justify-between">
                      <span>Capacity:</span>
                      <span className="text-[#D7FF00] font-bold">
                        {game.minPlayers === game.maxPlayers
                          ? `${game.maxPlayers} Player${game.maxPlayers > 1 ? 's' : ''}`
                          : `${game.minPlayers || 1} - ${game.maxPlayers || 4} Players`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Booking Mode:</span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          game.bookingMode === 'PRIVATE_ONLY'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : game.bookingMode === 'SHARED'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {game.bookingMode === 'PRIVATE_ONLY'
                          ? 'Private Only'
                          : game.bookingMode === 'SHARED'
                          ? 'Shared Only'
                          : 'Both (Shared/Private)'}
                      </span>
                    </div>
                    <div>
                      Devices: <span className="text-slate-200">{game.compatibleDevices?.length || 0} compatible</span>
                    </div>
                    {game.advancePaymentRequired && (
                      <div className="text-amber-300">
                        Advance: ₹{game.minimumAdvancePayment / 100 || 75} required
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    onClick={() => handleToggleGameStatus(game)}
                    className={`text-xs px-3 py-1.5 rounded font-semibold transition-colors ${
                      game.status === 'ACTIVE'
                        ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                        : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                    }`}
                  >
                    {game.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setEditingGame(game);
                        setGameForm({
                          name: game.name,
                          description: game.description || '',
                          thumbnail: game.thumbnail || '',
                          category: game.category?._id || game.category || '',
                          compatibleDevices: game.compatibleDevices?.map((d) => d._id || d) || [],
                          minPlayers: game.minPlayers || 1,
                          maxPlayers: game.maxPlayers || 4,
                          bookingMode: game.bookingMode || 'BOTH',
                          isExclusive: game.isExclusive,
                          advancePaymentRequired: game.advancePaymentRequired,
                          minimumAdvancePayment: game.minimumAdvancePayment || 0,
                          minimumDuration: game.minimumDuration || 60,
                          maximumDuration: game.maximumDuration || 240,
                          status: game.status,
                        });
                        setGameModalOpen(true);
                      }}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[#D7FF00]"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteGame(game._id, game.name)}
                      className="p-1.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            currentPage={gamePage}
            totalPages={Math.ceil(filteredGames.length / 6)}
            totalItems={filteredGames.length}
            pageSize={6}
            onPageChange={setGamePage}
          />
        </div>
      )}

      {/* ---------------- TAB 4: EXCLUSIVE GAMES (GTA 6 MANAGEMENT) ---------------- */}
      {activeTab === 'exclusive' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#121722] to-[#1a1528] border border-amber-500/30 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-heading text-white">Exclusive Games Suite (GTA 6)</h3>
                  <p className="text-xs text-slate-400">
                    High-demand VIP titles requiring mandatory advance payments and dedicated administrator activation.
                  </p>
                </div>
              </div>

              <span className="self-start sm:self-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Exclusive Rules Active
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {exclusiveGames.map((game) => (
              <div
                key={game._id}
                className="p-6 rounded-2xl bg-[#171014] border border-amber-500/40 shadow-xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-2xl font-bold font-heading text-white">{game.name}</h4>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      game.status === 'ACTIVE'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}
                  >
                    {game.status === 'ACTIVE' ? 'ONLINE (ACTIVE)' : 'DISABLED (STANDBY)'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{game.description}</p>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono pt-2">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">Advance Payment</span>
                    <span className="text-amber-300 font-bold">
                      {game.advancePaymentRequired ? 'Mandatory (50%)' : 'Optional'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">Min Advance Amount</span>
                    <span className="text-white font-bold">
                      ₹{game.minimumAdvancePayment ? game.minimumAdvancePayment / 100 : 75}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">Min Duration</span>
                    <span className="text-[#FFF4E8] font-bold">{game.minimumDuration / 60 || 1} Hour(s)</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">Max Duration</span>
                    <span className="text-[#FFF4E8] font-bold">{game.maximumDuration / 60 || 4} Hours</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => handleToggleGameStatus(game)}
                    className={`w-full py-2.5 px-4 rounded-xl font-heading font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                      game.status === 'ACTIVE'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                        : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
                    }`}
                  >
                    <Power className="w-4 h-4" />
                    {game.status === 'ACTIVE' ? 'Disable Exclusive Booking' : 'Activate GTA 6 Availability'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            currentPage={gamePage}
            totalPages={Math.ceil(filteredGames.length / 6)}
            totalItems={filteredGames.length}
            pageSize={6}
            onPageChange={setGamePage}
          />
        </div>
      )}

      {/* ---------------- TAB 5: CATEGORY MANAGEMENT ---------------- */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-400">
              Manage game categories used by customers for browsing and filtering.
            </p>
            <button
              onClick={() => {
                setEditingCategory(null);
                setCategoryForm({ name: '', description: '', status: 'ACTIVE' });
                setCategoryModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#D7FF00] hover:bg-[#cbf200] text-[#171014] font-bold text-xs uppercase tracking-wider font-heading"
            >
              <Plus className="w-4 h-4" /> Add Category
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div
                key={cat._id}
                className="p-5 rounded-2xl bg-[#171014] border border-slate-800 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-base font-heading">{cat.name}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-emerald-400">
                      {cat.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{cat.description || 'No description provided.'}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditingCategory(cat);
                      setCategoryForm({ name: cat.name, description: cat.description || '', status: cat.status });
                      setCategoryModalOpen(true);
                    }}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[#D7FF00]"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat._id, cat.name)}
                    className="p-1.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            currentPage={gamePage}
            totalPages={Math.ceil(filteredGames.length / 6)}
            totalItems={filteredGames.length}
            pageSize={6}
            onPageChange={setGamePage}
          />
        </div>
      )}

      {/* ---------------- TAB 6: CENTRALIZED PRICING MANAGEMENT ---------------- */}
      {activeTab === 'pricing' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold font-heading text-white">Centralized Pricing Engine</h3>
              <p className="text-xs text-slate-400">
                All monetary amounts are stored in precision-safe integer paise (1 INR = 100 paise).
              </p>
            </div>
            <button
              onClick={() => {
                setEditingPricing(null);
                setPricingForm({
                  name: '',
                  deviceType: 'PS5',
                  billingType: 'PER_PLAYER_HOURLY',
                  amountInRupees: 60,
                  minimumDuration: 60,
                  maximumDuration: 240,
                  status: 'ACTIVE',
                });
                setPricingModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#D7FF00] hover:bg-[#cbf200] text-[#171014] font-bold text-xs uppercase tracking-wider font-heading"
            >
              <Plus className="w-4 h-4" /> Add Pricing Rule
            </button>
          </div>

          {/* Pricing Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#171014] shadow-xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/80 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800 font-sans">
                <tr>
                  <th className="py-3.5 px-4">Plan Name</th>
                  <th className="py-3.5 px-4">Device / Target</th>
                  <th className="py-3.5 px-4">Billing Model</th>
                  <th className="py-3.5 px-4">Amount (Rupees)</th>
                  <th className="py-3.5 px-4">Precision (Paise)</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {pricingPlans.map((pr) => (
                  <tr key={pr._id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white font-sans">{pr.name}</td>
                    <td className="py-3.5 px-4 text-[#FFF4E8]">{pr.deviceType}</td>
                    <td className="py-3.5 px-4 text-slate-300 font-sans">{pr.billingType}</td>
                    <td className="py-3.5 px-4 font-bold text-emerald-400">₹{pr.amount / 100}</td>
                    <td className="py-3.5 px-4 text-slate-400">{pr.amount} paise</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
                        {pr.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-sans">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingPricing(pr);
                            setPricingForm({
                              name: pr.name,
                              deviceType: pr.deviceType,
                              billingType: pr.billingType,
                              amountInRupees: pr.amount / 100,
                              minimumDuration: pr.minimumDuration || 60,
                              maximumDuration: pr.maximumDuration || 240,
                              status: pr.status,
                            });
                            setPricingModalOpen(true);
                          }}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[#D7FF00]"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePricing(pr._id, pr.name)}
                          className="p-1.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Real-time Pricing Calculator Simulator */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <h4 className="text-sm font-bold text-white font-heading uppercase tracking-wider flex items-center gap-2">
              <Coins className="w-4 h-4 text-[#D7FF00]" /> Backend Session Price Calculator Simulator
            </h4>
            <form onSubmit={handleCalculatePrice} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">Device</label>
                <select
                  required
                  value={calcDeviceId}
                  onChange={(e) => setCalcDeviceId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                >
                  <option value="">Select Device</option>
                  {devices.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.deviceType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">Duration (Hours)</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={calcDuration}
                  onChange={(e) => setCalcDuration(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">Players</label>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={calcPlayers}
                  onChange={(e) => setCalcPlayers(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-lg bg-[#D7FF00] hover:bg-[#cbf200] text-[#171014] font-bold text-xs uppercase tracking-wider font-heading"
                >
                  Calculate Quote
                </button>
              </div>
            </form>

            {calcResult && (
              <div className="p-4 rounded-xl bg-slate-950 border border-[#49202C] text-xs font-mono space-y-2">
                <div className="flex items-center justify-between text-white font-sans text-sm font-bold">
                  <span>Calculated Total: ₹{calcResult.totalAmountRupees}</span>
                  <span className="text-[#D7FF00] font-mono">{calcResult.totalAmountPaise} paise</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-slate-400 pt-1">
                  <div>Model: {calcResult.pricingRule.billingType}</div>
                  <div>Base Unit: ₹{calcResult.pricingRule.ratePerUnitRupees}/hr</div>
                  <div>Advance: {calcResult.advanceRequired ? `₹${calcResult.minimumAdvanceRupees}` : 'None'}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- TAB 7: MAINTENANCE MANAGEMENT ---------------- */}
      {activeTab === 'maintenance' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-400">
              Track maintenance tickets. Devices under maintenance are automatically blocked from future bookings.
            </p>
            <button
              onClick={() => {
                setMaintForm({
                  device: devices[0]?._id || '',
                  reason: '',
                  expectedEndDate: '',
                  notes: '',
                });
                setMaintModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider font-heading"
            >
              <Plus className="w-4 h-4" /> Schedule Maintenance
            </button>
          </div>

          {/* Maintenance Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#171014] shadow-xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/80 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800 font-sans">
                <tr>
                  <th className="py-3.5 px-4">Device</th>
                  <th className="py-3.5 px-4">Reason</th>
                  <th className="py-3.5 px-4">Start Date</th>
                  <th className="py-3.5 px-4">Expected End</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {maintenanceList.map((maint) => (
                  <tr key={maint._id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-[#D7FF00] font-sans">
                      {maint.device?.name || 'Device'} ({maint.device?.deviceCode})
                    </td>
                    <td className="py-3.5 px-4 font-sans text-slate-300 max-w-xs truncate">{maint.reason}</td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(maint.startDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {maint.expectedEndDate
                        ? new Date(maint.expectedEndDate).toLocaleDateString('en-IN')
                        : 'Unspecified'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          maint.status === 'COMPLETED'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        {maint.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-sans">
                      {maint.status !== 'COMPLETED' ? (
                        <button
                          onClick={() => handleCompleteMaintenance(maint._id)}
                          className="px-3 py-1.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-semibold text-xs transition-colors flex items-center gap-1 ml-auto"
                        >
                          <Check className="w-3.5 h-3.5" /> Mark Completed
                        </button>
                      ) : (
                        <span className="text-slate-500 text-xs font-mono">Resolved</span>
                      )}
                    </td>
                  </tr>
                ))}
                {maintenanceList.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                      No maintenance records recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={devicePage}
            totalPages={Math.ceil(filteredDevices.length / 6)}
            totalItems={filteredDevices.length}
            pageSize={6}
            onPageChange={setDevicePage}
          />
        </div>
      )}

      {/* ---------------- TAB: PAYMENTS & REVENUE (Phase 4) ---------------- */}
      {activeTab === 'payments' && (
        <AdminPaymentsTab />
      )}

      {/* ---------------- TAB: MEMBERSHIPS & SUBSCRIPTIONS (Phase 5) ---------------- */}
      {activeTab === 'memberships' && (
        <AdminMembershipsTab />
      )}

      {/* ---------------- TAB: BOOKINGS & WALK-IN DESK (Phase 3) ---------------- */}
      {activeTab === 'bookings' && (
        <AdminBookingsTab devices={devices} games={games} onRefreshData={fetchAllData} />
      )}

      {/* ---------------- TAB: VISUAL TIMELINE CALENDAR (Phase 3) ---------------- */}
      {activeTab === 'calendar' && (
        <AdminCalendarTab devices={devices} />
      )}

      {/* ---------------- TAB: AUTOMATION & SCHEDULER TIMERS (Phase 8) ---------------- */}
      {activeTab === 'automation' && (
        <AdminAutomationTab />
      )}

      {/* ---------------- MODAL: DEVICE ---------------- */}
      {deviceModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div className="m-auto w-full max-w-md p-6 bg-[#171014] border border-slate-700/80 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold font-heading text-white mb-4">
              {editingDevice ? 'Edit Device' : 'Register New Device'}
            </h3>
            <form onSubmit={handleSaveDevice} className="space-y-4 text-xs">
              <div>
                <label className="block uppercase tracking-wider text-slate-400 mb-1">Device Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PS5 Station 4"
                  value={deviceForm.name}
                  onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block uppercase tracking-wider text-slate-400 mb-1">Unique Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PS5-04"
                  value={deviceForm.deviceCode}
                  onChange={(e) => setDeviceForm({ ...deviceForm, deviceCode: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white uppercase font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block uppercase tracking-wider text-slate-400 mb-1">Device Type</label>
                  <select
                    value={deviceForm.deviceType}
                    onChange={(e) => setDeviceForm({ ...deviceForm, deviceType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="PS5">PlayStation 5</option>
                    <option value="POOL">Pool / Billiards Table</option>
                    <option value="EXCLUSIVE">Exclusive Lounge</option>
                    <option value="VR">Virtual Reality</option>
                    <option value="PC">Gaming PC</option>
                  </select>
                </div>

                <div>
                  <label className="block uppercase tracking-wider text-slate-400 mb-1">Max Capacity (Players)</label>
                  <input
                    type="number"
                    min={1}
                    max={16}
                    required
                    value={deviceForm.capacity}
                    onChange={(e) => setDeviceForm({ ...deviceForm, capacity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block uppercase tracking-wider text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Hardware specs, screen details..."
                  value={deviceForm.description}
                  onChange={(e) => setDeviceForm({ ...deviceForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeviceModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-[#D7FF00] text-[#171014] font-bold rounded-lg font-heading">
                  Save Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: GAME ---------------- */}
      {gameModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div className="m-auto w-full max-w-lg p-6 bg-[#171014] border border-slate-700/80 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold font-heading text-white mb-4">
              {editingGame ? 'Edit Game' : 'Register New Game'}
            </h3>
            <form onSubmit={handleSaveGame} className="space-y-4 text-xs">
              <div>
                <label className="block uppercase tracking-wider text-slate-400 mb-1">Game Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mortal Kombat 1"
                  value={gameForm.name}
                  onChange={(e) => setGameForm({ ...gameForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block uppercase tracking-wider text-slate-400 mb-1">Category</label>
                <select
                  required
                  value={gameForm.category}
                  onChange={(e) => setGameForm({ ...gameForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block uppercase tracking-wider text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={gameForm.description}
                  onChange={(e) => setGameForm({ ...gameForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>

              {/* Game-Specific Player Capacity Configuration */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-heading flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#D7FF00]" /> Player Capacity & Booking Mode
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">PS5 Max: 4</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block uppercase tracking-wider text-slate-400 text-[10px] mb-1">
                      Minimum Players
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="4"
                      required
                      value={gameForm.minPlayers}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 1;
                        setGameForm({
                          ...gameForm,
                          minPlayers: val,
                          maxPlayers: Math.max(val, gameForm.maxPlayers),
                        });
                      }}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                    />
                    <p className="text-[9px] text-slate-500 mt-0.5">Min 1 player</p>
                  </div>

                  <div>
                    <label className="block uppercase tracking-wider text-slate-400 text-[10px] mb-1">
                      Maximum Players
                    </label>
                    <input
                      type="number"
                      min={gameForm.minPlayers || 1}
                      max="4"
                      required
                      value={gameForm.maxPlayers}
                      onChange={(e) =>
                        setGameForm({
                          ...gameForm,
                          maxPlayers: Math.min(4, Math.max(gameForm.minPlayers || 1, parseInt(e.target.value, 10) || 1)),
                        })
                      }
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                    />
                    <p className="text-[9px] text-slate-500 mt-0.5">Up to 4 on PS5</p>
                  </div>
                </div>

                <div>
                  <label className="block uppercase tracking-wider text-slate-400 text-[10px] mb-1">
                    Booking Mode
                  </label>
                  <select
                    value={gameForm.bookingMode}
                    onChange={(e) => setGameForm({ ...gameForm, bookingMode: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="BOTH">BOTH (Shared and Private Sessions)</option>
                    <option value="SHARED">SHARED (Shared Player Sessions Only)</option>
                    <option value="PRIVATE_ONLY">PRIVATE_ONLY (Exclusive Full Console Only)</option>
                  </select>
                  <p className="text-[9px] text-slate-400 mt-1">
                    {gameForm.bookingMode === 'PRIVATE_ONLY'
                      ? 'Customers must book the entire physical console exclusively.'
                      : gameForm.bookingMode === 'SHARED'
                      ? 'Station slots can be booked individually by multiple customers.'
                      : 'Customers can choose to book shared seats or book the whole console privately.'}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
                <label className="flex items-center gap-2 text-white font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gameForm.isExclusive}
                    onChange={(e) =>
                      setGameForm({
                        ...gameForm,
                        isExclusive: e.target.checked,
                        advancePaymentRequired: e.target.checked,
                        bookingMode: e.target.checked ? 'PRIVATE_ONLY' : gameForm.bookingMode,
                        minPlayers: e.target.checked ? 1 : gameForm.minPlayers,
                        maxPlayers: e.target.checked ? 1 : gameForm.maxPlayers,
                        minimumAdvancePayment: e.target.checked ? 7500 : gameForm.minimumAdvancePayment,
                      })
                    }
                    className="w-4 h-4 rounded text-[#D7FF00]"
                  />
                  Mark as Exclusive Game (e.g. GTA 6 Suite)
                </label>

                {gameForm.isExclusive && (
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <label className="block uppercase tracking-wider text-amber-400 text-[10px]">
                      Mandatory Advance Payment (Paise)
                    </label>
                    <input
                      type="number"
                      value={gameForm.minimumAdvancePayment}
                      onChange={(e) =>
                        setGameForm({ ...gameForm, minimumAdvancePayment: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                    />
                    <p className="text-[10px] text-slate-400">7500 paise = ₹75 advance required</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGameModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-[#D7FF00] text-[#171014] font-bold rounded-lg font-heading">
                  Save Game
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: CATEGORY ---------------- */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div className="m-auto w-full max-w-sm p-6 bg-[#171014] border border-slate-700/80 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold font-heading text-white mb-4">
              {editingCategory ? 'Edit Category' : 'Create Category'}
            </h3>
            <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
              <div>
                <label className="block uppercase tracking-wider text-slate-400 mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Simulation"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block uppercase tracking-wider text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-[#D7FF00] text-[#171014] font-bold rounded-lg font-heading">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: PRICING ---------------- */}
      {pricingModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div className="m-auto w-full max-w-md p-6 bg-[#171014] border border-slate-700/80 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold font-heading text-white mb-4">
              {editingPricing ? 'Edit Pricing Rule' : 'New Pricing Rule'}
            </h3>
            <form onSubmit={handleSavePricing} className="space-y-3 text-xs">
              <div>
                <label className="block uppercase tracking-wider text-slate-400 mb-1">Plan Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PS5 Peak Hours"
                  value={pricingForm.name}
                  onChange={(e) => setPricingForm({ ...pricingForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block uppercase tracking-wider text-slate-400 mb-1">Target Device</label>
                  <select
                    value={pricingForm.deviceType}
                    onChange={(e) => setPricingForm({ ...pricingForm, deviceType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="PS5">PS5</option>
                    <option value="POOL">Pool Table</option>
                    <option value="EXCLUSIVE">Exclusive Lounge</option>
                    <option value="GENERAL">General Fallback</option>
                  </select>
                </div>

                <div>
                  <label className="block uppercase tracking-wider text-slate-400 mb-1">Rate (₹ Rupees)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={pricingForm.amountInRupees}
                    onChange={(e) =>
                      setPricingForm({ ...pricingForm, amountInRupees: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block uppercase tracking-wider text-slate-400 mb-1">Billing Model</label>
                <select
                  value={pricingForm.billingType}
                  onChange={(e) => setPricingForm({ ...pricingForm, billingType: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                >
                  <option value="PER_PLAYER_HOURLY">Per Player Per Hour (e.g. ₹60 x players x hrs)</option>
                  <option value="PER_DEVICE_HOURLY">Per Device Per Hour (e.g. ₹150 x hrs regardless of players)</option>
                  <option value="FIXED_SESSION">Fixed Session Rate</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPricingModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-[#D7FF00] text-[#171014] font-bold rounded-lg font-heading">
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: MAINTENANCE ---------------- */}
      {maintModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div className="m-auto w-full max-w-md p-6 bg-[#171014] border border-slate-700/80 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold font-heading text-white mb-4">Schedule Device Maintenance</h3>
            <form onSubmit={handleStartMaintenance} className="space-y-3 text-xs">
              <div>
                <label className="block uppercase tracking-wider text-slate-400 mb-1">Target Device</label>
                <select
                  required
                  value={maintForm.device}
                  onChange={(e) => setMaintForm({ ...maintForm, device: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                >
                  <option value="">Select Device to Service</option>
                  {devices.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.deviceCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block uppercase tracking-wider text-slate-400 mb-1">Maintenance Reason</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Controller stick drift calibration, cloth replacement"
                  value={maintForm.reason}
                  onChange={(e) => setMaintForm({ ...maintForm, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block uppercase tracking-wider text-slate-400 mb-1">Expected Completion Date</label>
                <input
                  type="date"
                  value={maintForm.expectedEndDate}
                  onChange={(e) => setMaintForm({ ...maintForm, expectedEndDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMaintModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg font-heading">
                  Begin Maintenance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- TAB 14: SYSTEM HEALTH & MONGO PERSISTENCE (ADMIN ONLY) ---------------- */}
      {activeTab === 'health' && (
        <div className="space-y-6 animate-fadeIn">
          <SystemStatus />
        </div>
      )}

      {/* Centered Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        isDanger={confirmState.isDanger !== false}
        onConfirm={confirmState.onConfirm}
        onClose={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Business Intelligence & Export Modal */}
      <ReportExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
      />
    </div>
  );
};
