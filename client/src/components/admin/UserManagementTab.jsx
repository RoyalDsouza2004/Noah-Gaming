import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  UserCheck,
  UserX,
  Shield,
  KeyRound,
  Eye,
  Edit2,
  RefreshCw,
  GitMerge,
  Crown,
  Gamepad2,
  Calendar,
  CreditCard,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  FileText,
  Loader2,
  X,
  ArrowRight,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { userManagementApi } from '../../api/userManagement.js';
import { showToast } from '../../utils/toast.js';
import { Pagination } from '../common/Pagination.jsx';
import { SixDigitOtpInput } from '../common/SixDigitOtpInput.jsx';
import { ConfirmModal } from '../common/ConfirmModal.jsx';

export const UserManagementTab = ({ isAdmin = false }) => {
  // Query & Table State
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [accountType, setAccountType] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [membershipFilter, setMembershipFilter] = useState('ALL');
  const [kpis, setKpis] = useState({
    totalUsersCount: 0,
    totalGuestsCount: 0,
    totalRegisteredCount: 0,
    activeMembersCount: 0,
  });

  // Modal States
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailActiveTab, setDetailActiveTab] = useState('overview');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
    accountStatus: 'ACTIVE',
    role: 'customer',
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Guest Conversion Modal
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertingUser, setConvertingUser] = useState(null);
  const [convertOtp, setConvertOtp] = useState('');
  const [convertPassword, setConvertPassword] = useState('');
  const [convertEmail, setConvertEmail] = useState('');
  const [convertOtpSent, setConvertOtpSent] = useState(false);
  const [convertCooldown, setConvertCooldown] = useState(0);
  const [submittingConvert, setSubmittingConvert] = useState(false);

  // Password Reset Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resettingUser, setResettingUser] = useState(null);
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);
  const [submittingReset, setSubmittingReset] = useState(false);

  // Countdown timer for resend buttons
  useEffect(() => {
    const timer = setInterval(() => {
      setConvertCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      setResetCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Merge Accounts Modal (Admin Only)
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergePrimaryId, setMergePrimaryId] = useState('');
  const [mergeSecondaryId, setMergeSecondaryId] = useState('');
  const [mergeReason, setMergeReason] = useState('Duplicate customer profile resolution');
  const [submittingMerge, setSubmittingMerge] = useState(false);

  // Delete User Confirmation Modal (Admin Only)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // Fetch users list
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await userManagementApi.getUsers({
        page,
        limit,
        search,
        accountType,
        role: roleFilter,
        accountStatus: statusFilter,
        membershipStatus: membershipFilter,
      });

      if (res?.success) {
        setUsers(res.data.users || []);
        setTotal(res.data.pagination?.total || 0);
        setTotalPages(res.data.pagination?.pages || 1);
        if (res.data.kpis) {
          setKpis(res.data.kpis);
        }
      } else {
        showToast.error(res?.message || 'Failed to fetch users');
      }
    } catch (err) {
      showToast.error(err.message || 'Error fetching user list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, limit, accountType, roleFilter, statusFilter, membershipFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  // Open User Detail
  const handleViewUser = async (userId) => {
    try {
      setLoadingDetail(true);
      setDetailModalOpen(true);
      setDetailActiveTab('overview');
      const res = await userManagementApi.getUserDetails(userId);
      if (res?.success) {
        setSelectedUserDetail(res.data);
      } else {
        showToast.error(res?.message || 'Failed to load user details');
      }
    } catch (err) {
      showToast.error(err.message || 'Error loading user details');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open Edit User
  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      phone: user.phone || '',
      email: user.email || '',
      notes: user.notes || '',
      accountStatus: user.accountStatus || 'ACTIVE',
      role: user.role || 'customer',
    });
    setEditModalOpen(true);
  };

  // Submit Edit User
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!editForm.name.trim()) {
      showToast.error('Customer name is required');
      return;
    }
    const cleanPhone = editForm.phone.trim().replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      showToast.error('Mobile number must be exactly 10 digits');
      return;
    }

    try {
      setSubmittingEdit(true);
      const res = await userManagementApi.updateUserDetails(editingUser._id, {
        name: editForm.name.trim(),
        phone: cleanPhone,
        email: editForm.email.trim(),
        notes: editForm.notes,
        accountStatus: editForm.accountStatus,
      });

      if (res?.success) {
        // If Admin changed role
        if (isAdmin && editForm.role !== editingUser.role) {
          const roleRes = await userManagementApi.changeUserRole(editingUser._id, editForm.role);
          if (!roleRes?.success) {
            showToast.error(roleRes?.message || 'Failed to update role');
          }
        }
        showToast.success('User updated successfully');
        setEditModalOpen(false);
        fetchUsers();
      } else {
        showToast.error(res?.message || 'Failed to update user');
      }
    } catch (err) {
      showToast.error(err.message || 'Error updating user');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Open Guest Conversion Modal
  const handleOpenConvert = (user) => {
    setConvertingUser(user);
    setConvertOtp('');
    setConvertPassword('');
    setConvertEmail(user.email && !user.email.startsWith('guest.') ? user.email : '');
    setConvertOtpSent(false);
    setConvertModalOpen(true);
  };

  // Request Conversion OTP
  const handleRequestConvertOtp = async () => {
    if (!convertingUser || convertCooldown > 0) return;
    try {
      setSubmittingConvert(true);
      const res = await userManagementApi.initiateGuestConversion(convertingUser._id, {
        email: convertEmail.trim() || undefined,
      });
      if (res?.success) {
        setConvertOtpSent(true);
        setConvertCooldown(res.data?.resendCooldownSeconds || 60);
        showToast.success(res.message || `Verification OTP sent to ${res.data?.email || convertingUser.phone}`);
      } else {
        showToast.error(res?.message || 'Failed to generate OTP');
      }
    } catch (err) {
      showToast.error(err.message || 'Error generating OTP');
    } finally {
      setSubmittingConvert(false);
    }
  };

  // Complete Conversion
  const handleCompleteConvert = async (e) => {
    e.preventDefault();
    if (!convertingUser) return;

    if (!convertPassword || convertPassword.length < 6) {
      showToast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setSubmittingConvert(true);
      const res = await userManagementApi.completeGuestConversion(convertingUser._id, {
        otp: convertOtp.trim(),
        password: convertPassword,
        email: convertEmail.trim() || undefined,
        name: convertingUser.name,
      });

      if (res?.success) {
        showToast.success('Account successfully upgraded to Registered Customer!');
        setConvertModalOpen(false);
        fetchUsers();
      } else {
        showToast.error(res?.message || 'Conversion failed');
      }
    } catch (err) {
      showToast.error(err.message || 'Error completing conversion');
    } finally {
      setSubmittingConvert(false);
    }
  };

  // Open Password Reset Modal
  const handleOpenReset = (user) => {
    setResettingUser(user);
    setResetOtp('');
    setResetNewPassword('');
    setResetOtpSent(false);
    setResetModalOpen(true);
  };

  // Request Reset OTP
  const handleRequestResetOtp = async () => {
    if (!resettingUser || resetCooldown > 0) return;
    try {
      setSubmittingReset(true);
      const res = await userManagementApi.initiatePasswordReset(resettingUser._id);
      if (res?.success) {
        setResetOtpSent(true);
        setResetCooldown(res.data?.resendCooldownSeconds || 60);
        showToast.success(res.message || `Password reset OTP dispatched to customer's email`);
      } else {
        showToast.error(res?.message || 'Failed to generate OTP');
      }
    } catch (err) {
      showToast.error(err.message || 'Error generating OTP');
    } finally {
      setSubmittingReset(false);
    }
  };

  // Complete Reset Password
  const handleCompleteReset = async (e) => {
    e.preventDefault();
    if (!resettingUser) return;

    if (!resetNewPassword || resetNewPassword.length < 6) {
      showToast.error('New password must be at least 6 characters');
      return;
    }

    try {
      setSubmittingReset(true);
      const res = await userManagementApi.completePasswordReset(resettingUser._id, {
        otp: resetOtp.trim(),
        newPassword: resetNewPassword,
      });

      if (res?.success) {
        showToast.success('Password has been reset successfully');
        setResetModalOpen(false);
      } else {
        showToast.error(res?.message || 'Failed to reset password');
      }
    } catch (err) {
      showToast.error(err.message || 'Error resetting password');
    } finally {
      setSubmittingReset(false);
    }
  };

  // Submit Account Merge (Admin Only)
  const handleMergeSubmit = async (e) => {
    e.preventDefault();
    if (!mergePrimaryId || !mergeSecondaryId) {
      showToast.error('Please specify both primary and secondary user IDs');
      return;
    }
    if (mergePrimaryId === mergeSecondaryId) {
      showToast.error('Primary and secondary user cannot be identical');
      return;
    }

    try {
      setSubmittingMerge(true);
      const res = await userManagementApi.mergeAccounts(mergePrimaryId.trim(), mergeSecondaryId.trim(), mergeReason);
      if (res?.success) {
        showToast.success(res.message || 'Accounts merged successfully');
        setMergeModalOpen(false);
        setMergePrimaryId('');
        setMergeSecondaryId('');
        fetchUsers();
      } else {
        showToast.error(res?.message || 'Merge failed');
      }
    } catch (err) {
      showToast.error(err.message || 'Error merging accounts');
    } finally {
      setSubmittingMerge(false);
    }
  };

  // Open Delete User Confirmation Prompt
  const handleOpenDelete = (user) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  // Execute Deletion after confirmation
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      setDeletingUser(true);
      const res = await userManagementApi.deleteUser(userToDelete._id);
      if (res?.success) {
        showToast.success(res.message || `User '${userToDelete.name}' was permanently deleted.`);
        setDeleteModalOpen(false);
        setUserToDelete(null);
        if (detailModalOpen && selectedUserDetail?.user?._id === userToDelete._id) {
          setDetailModalOpen(false);
          setSelectedUserDetail(null);
        }
        fetchUsers();
      } else {
        showToast.error(res?.message || 'Failed to delete user');
      }
    } catch (err) {
      showToast.error(err.message || 'Error deleting user');
    } finally {
      setDeletingUser(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn text-slate-900 dark:text-[#FFF4E8]">
      {/* Header & KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="user-management-kpi p-4 rounded-2xl bg-white dark:bg-[#260D17]/80 border border-slate-200 dark:border-[#49202C] shadow-sm dark:shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-[#C7A5A8]">Total Users</span>
            <h3 className="text-xl sm:text-2xl font-black font-heading text-slate-900 dark:text-white mt-0.5">{kpis.totalUsersCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#851B2B]/20 border border-slate-200 dark:border-[#851B2B]/40 flex items-center justify-center text-[#851B2B] dark:text-[#D7FF00]">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="user-management-kpi p-4 rounded-2xl bg-white dark:bg-[#260D17]/80 border border-slate-200 dark:border-[#49202C] shadow-sm dark:shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-amber-700 dark:text-amber-400">Guest Accounts</span>
            <h3 className="text-xl sm:text-2xl font-black font-heading text-amber-800 dark:text-amber-300 mt-0.5">{kpis.totalGuestsCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <UserX className="w-5 h-5" />
          </div>
        </div>

        <div className="user-management-kpi p-4 rounded-2xl bg-white dark:bg-[#260D17]/80 border border-slate-200 dark:border-[#49202C] shadow-sm dark:shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Registered</span>
            <h3 className="text-xl sm:text-2xl font-black font-heading text-emerald-800 dark:text-emerald-300 mt-0.5">{kpis.totalRegisteredCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="user-management-kpi p-4 rounded-2xl bg-white dark:bg-[#260D17]/80 border border-slate-200 dark:border-[#49202C] shadow-sm dark:shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-purple-700 dark:text-purple-400">Active Passes</span>
            <h3 className="text-xl sm:text-2xl font-black font-heading text-purple-800 dark:text-purple-300 mt-0.5">{kpis.activeMembersCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Crown className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Panel: Search & Filters */}
      <div className="user-management-card p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#260D17]/80 border border-slate-200 dark:border-[#49202C] shadow-sm dark:shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-[#C7A5A8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name, mobile, email, or Customer ID..."
              className="w-full pl-10 pr-24 py-2.5 rounded-xl bg-slate-50 dark:bg-[#171014] border border-slate-200 dark:border-[#49202C] text-xs sm:text-sm text-slate-900 dark:text-[#FFF4E8] placeholder-slate-400 dark:placeholder-[#C7A5A8]/50 focus:outline-none focus:border-[#851B2B]"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-xs font-bold font-heading bg-[#851B2B] hover:bg-[#a12235] text-white transition-all shadow-md"
            >
              Search
            </button>
          </form>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setAccountType('ALL');
                setRoleFilter('ALL');
                setStatusFilter('ALL');
                setMembershipFilter('ALL');
                setPage(1);
                fetchUsers();
              }}
              title="Refresh and Reset Filters"
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#171014] border border-slate-200 dark:border-[#49202C] text-slate-600 dark:text-[#C7A5A8] hover:text-slate-900 dark:hover:text-[#FFF4E8] hover:bg-slate-100 dark:hover:bg-[#851B2B]/20 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setMergeModalOpen(true)}
                className="px-3 py-2.5 rounded-xl text-xs font-bold font-heading uppercase tracking-wider bg-slate-50 dark:bg-[#171014] border border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <GitMerge className="w-3.5 h-3.5" /> Merge Duplicate
              </button>
            )}
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-[#49202C]/60 text-xs">
          <span className="text-slate-600 dark:text-[#C7A5A8] flex items-center gap-1 mr-1 font-mono uppercase tracking-wider text-[10px]">
            <Filter className="w-3 h-3" /> Filters:
          </span>

          {/* Account Type */}
          <select
            value={accountType}
            onChange={(e) => {
              setAccountType(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#171014] border border-slate-200 dark:border-[#49202C] text-slate-900 dark:text-[#FFF4E8] focus:outline-none focus:border-[#851B2B]"
          >
            <option value="ALL">All Types (Guest & Registered)</option>
            <option value="GUEST">Guest Accounts Only</option>
            <option value="REGISTERED">Registered Accounts Only</option>
          </select>

          {/* Role */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#171014] border border-slate-200 dark:border-[#49202C] text-slate-900 dark:text-[#FFF4E8] focus:outline-none focus:border-[#851B2B]"
          >
            <option value="ALL">All Roles</option>
            <option value="customer">Customers</option>
            <option value="receptionist">Receptionists</option>
            <option value="admin">Administrators</option>
          </select>

          {/* Account Status */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#171014] border border-slate-200 dark:border-[#49202C] text-slate-900 dark:text-[#FFF4E8] focus:outline-none focus:border-[#851B2B]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DEACTIVATED">Deactivated / Merged</option>
          </select>

          {/* Membership Filter */}
          <select
            value={membershipFilter}
            onChange={(e) => {
              setMembershipFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#171014] border border-slate-200 dark:border-[#49202C] text-slate-900 dark:text-[#FFF4E8] focus:outline-none focus:border-[#851B2B]"
          >
            <option value="ALL">All Memberships</option>
            <option value="ACTIVE">Active Membership</option>
            <option value="NONE">No Pass</option>
          </select>
        </div>
      </div>

      {/* Main Users Table */}
      <div className="user-management-table rounded-2xl bg-white dark:bg-[#260D17]/80 border border-slate-200 dark:border-[#49202C] shadow-sm dark:shadow-2xl overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-[#C7A5A8]">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D7FF00] mb-3" />
            <p className="text-xs font-semibold uppercase tracking-wider">Loading user database...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-16 text-center text-[#C7A5A8]">
            <Users className="w-10 h-10 mx-auto text-[#C7A5A8]/50 mb-3" />
            <p className="text-sm font-bold text-white">No customers found</p>
            <p className="text-xs text-[#C7A5A8] mt-1">Try adjusting your search criteria or clearing filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#171014] text-slate-700 dark:text-[#C7A5A8] font-mono uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-[#49202C]">
                <tr>
                  <th className="p-3.5">Customer & ID</th>
                  <th className="p-3.5">Contact Details</th>
                  <th className="p-3.5">Account Type</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Membership</th>
                  <th className="p-3.5 text-center">Bookings</th>
                  <th className="p-3.5 text-center">Sessions</th>
                  <th className="p-3.5 text-right">Verified Spend</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#49202C]/60 text-slate-800 dark:text-slate-200">
                {users.map((u) => {
                  const isGuest = u.accountType === 'GUEST' || u.isGuest;
                  return (
                    <tr key={u._id} className="hover:bg-slate-50 dark:hover:bg-[#851B2B]/10 transition-colors">
                      {/* Name & ID */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                            isGuest ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-[#851B2B]/30 text-[#D7FF00] border border-[#851B2B]'
                          }`}>
                            {u.name?.slice(0, 2) || 'GU'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white hover:text-[#851B2B] dark:hover:text-[#D7FF00] cursor-pointer" onClick={() => handleViewUser(u._id)}>
                              {u.name}
                            </div>
                            <span className="font-mono text-[10px] text-slate-500 dark:text-[#C7A5A8] block">
                              {u.customerId || u._id.slice(-6)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="p-3.5">
                        <div className="space-y-0.5">
                          <div className="font-mono text-slate-800 dark:text-white flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400 dark:text-[#C7A5A8]" />
                            {u.phone}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-[#C7A5A8] truncate max-w-[170px]" title={u.email}>
                            {u.email}
                          </div>
                        </div>
                      </td>

                      {/* Account Type */}
                      <td className="p-3.5">
                        {isGuest ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40">
                            <UserX className="w-3 h-3" /> GUEST
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                            <UserCheck className="w-3 h-3" /> REGISTERED
                          </span>
                        )}
                        {u.guestConvertedAt && (
                          <span className="block text-[9px] font-mono text-emerald-400/80 mt-0.5">
                            Converted {new Date(u.guestConvertedAt).toLocaleDateString()}
                          </span>
                        )}
                      </td>

                      {/* Role */}
                      <td className="p-3.5">
                        {u.role === 'admin' ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              u.isPrimaryAdmin || u.email === 'royalofficial2004@gmail.com'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                            }`}
                          >
                            {u.isPrimaryAdmin || u.email === 'royalofficial2004@gmail.com' ? 'Primary Admin' : 'Admin'}
                          </span>
                        ) : u.role === 'receptionist' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 uppercase">
                            Front Desk
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 uppercase">
                            Customer
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        {u.accountStatus === 'ACTIVE' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            ACTIVE
                          </span>
                        ) : u.accountStatus === 'SUSPENDED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/40">
                            SUSPENDED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400">
                            {u.accountStatus || 'INACTIVE'}
                          </span>
                        )}
                      </td>

                      {/* Membership */}
                      <td className="p-3.5">
                        {u.membership?.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            <Crown className="w-3 h-3" /> {u.membership?.planId?.name || 'Active Pass'}
                          </span>
                        ) : (
                          <span className="text-[#C7A5A8] text-[11px]">None</span>
                        )}
                      </td>

                      {/* Total Bookings */}
                      <td className="p-3.5 text-center font-mono font-bold text-white">
                        {u.totalBookings || 0}
                      </td>

                      {/* Total Gaming Sessions */}
                      <td className="p-3.5 text-center font-mono text-slate-300">
                        {u.totalGamingSessions || 0}
                      </td>

                      {/* Verified Spending */}
                      <td className="p-3.5 text-right font-mono font-bold text-[#D7FF00]">
                        ₹{u.totalVerifiedSpendRupees || 0}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View */}
                          <button
                            type="button"
                            onClick={() => handleViewUser(u._id)}
                            title="View Customer Profile & History"
                            className="p-1.5 rounded-lg bg-[#171014] text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            title="Edit User Details"
                            className="p-1.5 rounded-lg bg-[#171014] text-slate-300 hover:text-[#D7FF00] hover:bg-slate-800 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Convert Guest Action */}
                          {isGuest && (
                            <button
                              type="button"
                              onClick={() => handleOpenConvert(u)}
                              title="Convert Guest to Registered Account"
                              className="px-2 py-1 rounded-lg text-[10px] font-bold font-heading uppercase bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors flex items-center gap-1"
                            >
                              <Sparkles className="w-3 h-3" /> Convert
                            </button>
                          )}

                          {/* Password Reset */}
                          <button
                            type="button"
                            onClick={() => handleOpenReset(u)}
                            title="Reset Password via OTP"
                            className="p-1.5 rounded-lg bg-[#171014] text-slate-300 hover:text-rose-300 hover:bg-slate-800 transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete User (Admin Only, never on Primary Admin) */}
                          {isAdmin && !u.isPrimaryAdmin && u.email !== 'royalofficial2004@gmail.com' && (
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(u)}
                              title={`Delete ${u.name || 'User'}`}
                              className="p-1.5 rounded-lg bg-[#171014] text-rose-400 hover:text-white hover:bg-rose-600/30 border border-rose-500/20 hover:border-rose-500/50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {total > 0 && (
          <div className="p-3 bg-[#171014] border-t border-[#49202C] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#C7A5A8]">
            <div>
              Showing {users.length} of <span className="font-mono text-white font-bold">{total}</span> customers
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. USER DETAILS MODAL (Tabs: Overview, Bookings, Sessions, Payments, Pass) */}
      {/* ========================================================================= */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-[#260D17] border border-[#49202C] rounded-3xl p-5 sm:p-6 shadow-2xl text-[#FFF4E8] m-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#49202C]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#851B2B]/20 border border-[#851B2B] flex items-center justify-center text-[#D7FF00] text-lg font-bold">
                  {selectedUserDetail?.user?.name?.slice(0, 2) || 'CU'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black font-heading text-white">
                      {selectedUserDetail?.user?.name || 'Customer Profile'}
                    </h3>
                    {selectedUserDetail?.user?.accountType === 'GUEST' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        GUEST
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        REGISTERED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#C7A5A8] font-mono mt-0.5">
                    📱 {selectedUserDetail?.user?.phone || 'No Phone'} | ✉ {selectedUserDetail?.user?.email || 'No Email'} | ID: {selectedUserDetail?.user?.customerId || selectedUserDetail?.user?._id}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isAdmin && selectedUserDetail?.user && !selectedUserDetail.user.isPrimaryAdmin && selectedUserDetail.user.email !== 'royalofficial2004@gmail.com' && (
                  <button
                    type="button"
                    onClick={() => handleOpenDelete(selectedUserDetail.user)}
                    title="Delete User Account"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500 hover:text-white text-xs font-bold transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete User</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDetailModalOpen(false)}
                  className="p-2 rounded-xl text-[#C7A5A8] hover:text-white hover:bg-[#171014] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingDetail ? (
              <div className="p-16 text-center text-[#C7A5A8]">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D7FF00] mb-3" />
                <p className="text-xs">Loading comprehensive customer timeline and financial records...</p>
              </div>
            ) : selectedUserDetail ? (
              <div className="space-y-5 mt-4">
                {/* Modal Navigation Tabs */}
                <div className="flex p-1 rounded-xl bg-[#171014] border border-[#49202C] text-xs font-heading uppercase tracking-wider overflow-x-auto">
                  <button
                    onClick={() => setDetailActiveTab('overview')}
                    className={`px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${
                      detailActiveTab === 'overview' ? 'bg-[#851B2B] text-white shadow-md' : 'text-[#C7A5A8] hover:text-white'
                    }`}
                  >
                    Overview & Metrics
                  </button>
                  <button
                    onClick={() => setDetailActiveTab('bookings')}
                    className={`px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${
                      detailActiveTab === 'bookings' ? 'bg-[#851B2B] text-white shadow-md' : 'text-[#C7A5A8] hover:text-white'
                    }`}
                  >
                    Bookings ({selectedUserDetail.bookings?.length || 0})
                  </button>
                  <button
                    onClick={() => setDetailActiveTab('sessions')}
                    className={`px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${
                      detailActiveTab === 'sessions' ? 'bg-[#851B2B] text-white shadow-md' : 'text-[#C7A5A8] hover:text-white'
                    }`}
                  >
                    Sessions ({selectedUserDetail.sessions?.length || 0})
                  </button>
                  <button
                    onClick={() => setDetailActiveTab('payments')}
                    className={`px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${
                      detailActiveTab === 'payments' ? 'bg-[#851B2B] text-white shadow-md' : 'text-[#C7A5A8] hover:text-white'
                    }`}
                  >
                    Payments ({selectedUserDetail.payments?.length || 0})
                  </button>
                  <button
                    onClick={() => setDetailActiveTab('memberships')}
                    className={`px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${
                      detailActiveTab === 'memberships' ? 'bg-[#851B2B] text-white shadow-md' : 'text-[#C7A5A8] hover:text-white'
                    }`}
                  >
                    Membership Passes
                  </button>
                  <button
                    onClick={() => setDetailActiveTab('logs')}
                    className={`px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${
                      detailActiveTab === 'logs' ? 'bg-[#851B2B] text-white shadow-md' : 'text-[#C7A5A8] hover:text-white'
                    }`}
                  >
                    Audit Trail ({selectedUserDetail.activityLogs?.length || 0})
                  </button>
                </div>

                {/* TAB 1: OVERVIEW & METRICS */}
                {detailActiveTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-xl bg-[#171014] border border-[#49202C]">
                        <span className="text-[10px] font-mono uppercase text-[#C7A5A8]">Total Bookings</span>
                        <div className="text-xl font-bold font-heading text-white mt-1">{selectedUserDetail.metrics?.totalBookingsCount || 0}</div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-[#171014] border border-[#49202C]">
                        <span className="text-[10px] font-mono uppercase text-emerald-400">Total Spent</span>
                        <div className="text-xl font-bold font-heading text-[#D7FF00] mt-1">₹{selectedUserDetail.metrics?.totalPaidRupees || 0}</div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-[#171014] border border-[#49202C]">
                        <span className="text-[10px] font-mono uppercase text-rose-400">Balance Remaining</span>
                        <div className="text-xl font-bold font-heading text-rose-300 mt-1">₹{selectedUserDetail.metrics?.outstandingBalanceRupees || 0}</div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-[#171014] border border-[#49202C]">
                        <span className="text-[10px] font-mono uppercase text-purple-400">Pass Validity</span>
                        <div className="text-sm font-bold text-white mt-1">
                          {selectedUserDetail.user?.membership?.status === 'ACTIVE'
                            ? selectedUserDetail.user?.membership?.planId?.name || 'Active'
                            : 'None'}
                        </div>
                      </div>
                    </div>

                    {/* Profile Meta Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-[#171014] border border-[#49202C] space-y-2 text-xs">
                        <span className="text-[10px] font-mono uppercase text-[#C7A5A8] tracking-wider block border-b border-[#49202C] pb-1">
                          System Identifiers & Registration
                        </span>
                        <div className="flex justify-between py-1">
                          <span className="text-[#C7A5A8]">MongoDB ObjectId:</span>
                          <span className="font-mono text-white select-all">{selectedUserDetail.user?._id}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-[#C7A5A8]">Registration Date:</span>
                          <span className="text-white">{new Date(selectedUserDetail.user?.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-[#C7A5A8]">Account Status:</span>
                          <span className="font-bold text-emerald-400">{selectedUserDetail.user?.accountStatus}</span>
                        </div>
                        {selectedUserDetail.user?.guestConvertedAt && (
                          <div className="flex justify-between py-1">
                            <span className="text-[#C7A5A8]">Converted From Guest:</span>
                            <span className="text-emerald-300">{new Date(selectedUserDetail.user.guestConvertedAt).toLocaleString()}</span>
                          </div>
                        )}
                      </div>

                      <div className="p-4 rounded-xl bg-[#171014] border border-[#49202C] space-y-2 text-xs">
                        <span className="text-[10px] font-mono uppercase text-[#C7A5A8] tracking-wider block border-b border-[#49202C] pb-1">
                          Front Desk & Admin Notes
                        </span>
                        <p className="text-[#FFF4E8]/90 italic bg-[#260D17] p-3 rounded-lg border border-[#49202C] min-h-[70px]">
                          {selectedUserDetail.user?.notes || 'No administrative notes attached to this profile.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: BOOKINGS */}
                {detailActiveTab === 'bookings' && (
                  <div className="overflow-x-auto rounded-xl border border-[#49202C]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#171014] text-[#C7A5A8] font-mono uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Booking ID</th>
                          <th className="p-3">Date & Time</th>
                          <th className="p-3">Device & Game</th>
                          <th className="p-3 text-center">Duration</th>
                          <th className="p-3 text-right">Amount</th>
                          <th className="p-3 text-right">Paid</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#49202C]/60 text-slate-200">
                        {(selectedUserDetail.bookings || []).map((b) => (
                          <tr key={b._id} className="hover:bg-[#851B2B]/10">
                            <td className="p-3 font-mono font-bold text-white">{b.bookingId}</td>
                            <td className="p-3 font-mono">{b.bookingDate} @ {b.startTime}</td>
                            <td className="p-3">
                              <span className="font-semibold text-white block">{b.device?.name || 'Console'}</span>
                              <span className="text-[#C7A5A8] text-[11px]">{b.game?.name || 'Open Title'}</span>
                            </td>
                            <td className="p-3 text-center font-mono">{b.duration} hr(s)</td>
                            <td className="p-3 text-right font-mono font-bold text-white">₹{Math.round((b.totalAmount || 0) / 100)}</td>
                            <td className="p-3 text-right font-mono text-emerald-400">₹{Math.round((b.amountPaid || 0) / 100)}</td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                                {b.bookingStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* TAB 3: SESSIONS */}
                {detailActiveTab === 'sessions' && (
                  <div className="overflow-x-auto rounded-xl border border-[#49202C]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#171014] text-[#C7A5A8] font-mono uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Session Start</th>
                          <th className="p-3">Scheduled End</th>
                          <th className="p-3">Actual End</th>
                          <th className="p-3">Device</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#49202C]/60 text-slate-200">
                        {(selectedUserDetail.sessions || []).map((s) => (
                          <tr key={s._id} className="hover:bg-[#851B2B]/10">
                            <td className="p-3 font-mono">{new Date(s.startedAt).toLocaleString()}</td>
                            <td className="p-3 font-mono">{new Date(s.scheduledEndAt).toLocaleTimeString()}</td>
                            <td className="p-3 font-mono text-[#C7A5A8]">{s.actualEndAt ? new Date(s.actualEndAt).toLocaleTimeString() : 'In Progress'}</td>
                            <td className="p-3 font-semibold text-white">{s.device?.name || 'PS5'}</td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* TAB 4: PAYMENTS */}
                {detailActiveTab === 'payments' && (
                  <div className="overflow-x-auto rounded-xl border border-[#49202C]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#171014] text-[#C7A5A8] font-mono uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Receipt / ID</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Gateway & Method</th>
                          <th className="p-3 text-right">Amount</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#49202C]/60 text-slate-200">
                        {(selectedUserDetail.payments || []).map((p) => (
                          <tr key={p._id} className="hover:bg-[#851B2B]/10">
                            <td className="p-3 font-mono font-bold text-white">{p.receiptNumber || p.paymentId}</td>
                            <td className="p-3 font-mono">{new Date(p.createdAt).toLocaleDateString()}</td>
                            <td className="p-3">
                              <span className="font-semibold text-white block">{p.paymentGateway}</span>
                              <span className="text-[#C7A5A8] text-[11px] font-mono">{p.paymentMethod}</span>
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-[#D7FF00]">
                              ₹{Math.round((p.amount || p.amountPaise || 0) / 100)}
                            </td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                                {p.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* TAB 5: MEMBERSHIPS */}
                {detailActiveTab === 'memberships' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-[#171014] border border-[#49202C] space-y-3">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-400" /> Active Membership Pass
                      </h4>
                      {selectedUserDetail.user?.membership?.status === 'ACTIVE' ? (
                        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/40 to-[#260D17] border border-amber-500/40 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-base font-bold text-white">
                              {selectedUserDetail.user?.membership?.planId?.name || 'Gaming Club Pass'}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50">
                              ACTIVE
                            </span>
                          </div>
                          <p className="text-xs text-[#C7A5A8]">
                            Expires on: <span className="text-white font-mono">{selectedUserDetail.user?.membership?.expiresAt ? new Date(selectedUserDetail.user.membership.expiresAt).toLocaleDateString() : 'N/A'}</span>
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-[#C7A5A8] italic">No active monthly gaming membership on file for this customer.</p>
                      )}
                    </div>

                    {/* All Subscriptions History */}
                    {selectedUserDetail.subscriptions && selectedUserDetail.subscriptions.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#C7A5A8] font-mono">
                          Subscription History ({selectedUserDetail.subscriptions.length})
                        </h4>
                        <div className="overflow-x-auto rounded-xl border border-[#49202C]">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#171014] text-[#C7A5A8] font-mono uppercase text-[10px]">
                              <tr>
                                <th className="p-3">Subscription ID</th>
                                <th className="p-3">Plan</th>
                                <th className="p-3">Validity</th>
                                <th className="p-3 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#49202C]/60 text-slate-200">
                              {selectedUserDetail.subscriptions.map((sub) => (
                                <tr key={sub._id} className="hover:bg-[#851B2B]/10">
                                  <td className="p-3 font-mono font-bold text-white">{sub.subscriptionId}</td>
                                  <td className="p-3 font-semibold text-amber-300">
                                    {sub.membershipPlan?.name || sub.plan?.name || 'Membership'}
                                  </td>
                                  <td className="p-3 font-mono text-[11px] text-[#C7A5A8]">
                                    {new Date(sub.startDate).toLocaleDateString()} &rarr; {new Date(sub.expirationDate).toLocaleDateString()}
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      sub.status === 'ACTIVE'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                        : sub.status === 'EXPIRED'
                                        ? 'bg-slate-800 text-slate-400'
                                        : 'bg-rose-500/20 text-rose-300'
                                    }`}>
                                      {sub.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 6: AUDIT TRAIL */}
                {detailActiveTab === 'logs' && (
                  <div className="space-y-2">
                    {(selectedUserDetail.activityLogs || []).map((log) => (
                      <div key={log._id} className="p-3 rounded-xl bg-[#171014] border border-[#49202C] text-xs flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span className="font-mono text-[#D7FF00]">{log.action}</span>
                            <span className="text-[#C7A5A8] text-[11px]">by {log.userName} ({log.userRole})</span>
                          </div>
                          <p className="text-slate-300 mt-1">{log.description || 'System action recorded'}</p>
                        </div>
                        <span className="text-[10px] font-mono text-[#C7A5A8] whitespace-nowrap ml-3">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. EDIT USER MODAL (With Admin-Only Role Management Safeguard)            */}
      {/* ========================================================================= */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-lg bg-[#260D17] border border-[#49202C] rounded-3xl p-5 sm:p-6 shadow-2xl text-[#FFF4E8] m-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#49202C]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#851B2B]/20 border border-[#851B2B] flex items-center justify-center text-[#D7FF00]">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-heading text-white">Edit Customer Profile</h3>
                  <p className="text-xs text-[#C7A5A8]">Update validated customer details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 rounded-lg text-[#C7A5A8] hover:text-white hover:bg-[#171014]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#C7A5A8] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#171014] border border-[#49202C] text-white focus:outline-none focus:border-[#851B2B]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#C7A5A8] mb-1">Mobile Number (10 Digits) *</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, '') })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#171014] border border-[#49202C] text-white font-mono focus:outline-none focus:border-[#851B2B]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#C7A5A8] mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#171014] border border-[#49202C] text-white focus:outline-none focus:border-[#851B2B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#C7A5A8] mb-1">Account Status</label>
                  <select
                    value={editForm.accountStatus}
                    onChange={(e) => setEditForm({ ...editForm, accountStatus: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#171014] border border-[#49202C] text-white focus:outline-none focus:border-[#851B2B]"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="DEACTIVATED">Deactivated</option>
                  </select>
                </div>

                {/* Role Management (Strictly Admin Only) */}
                <div>
                  <label className="block font-semibold text-[#C7A5A8] mb-1 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-purple-400" />
                    Role {editingUser?.isPrimaryAdmin || editingUser?.email === 'royalofficial2004@gmail.com' ? '(Primary Admin - Ownership Protected)' : isAdmin ? '(Admin Control)' : '(Protected)'}
                  </label>
                  <select
                    value={editForm.role}
                    disabled={!isAdmin || editingUser?.isPrimaryAdmin || editingUser?.email === 'royalofficial2004@gmail.com'}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className={`w-full px-3 py-2.5 rounded-xl bg-[#171014] border border-[#49202C] text-white focus:outline-none focus:border-[#851B2B] ${
                      !isAdmin || editingUser?.isPrimaryAdmin || editingUser?.email === 'royalofficial2004@gmail.com' ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  >
                    <option value="customer">Customer</option>
                    <option value="receptionist">Receptionist / Front Desk</option>
                    <option value="admin">Administrator</option>
                  </select>
                  {!isAdmin && (
                    <span className="text-[10px] text-[#C7A5A8] mt-0.5 block">Role edits require Admin clearance</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#C7A5A8] mb-1">Internal Notes</label>
                <textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Preferences, gaming history remarks, or counter notes..."
                  className="w-full px-3 py-2 rounded-xl bg-[#171014] border border-[#49202C] text-white focus:outline-none focus:border-[#851B2B]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#49202C]">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  disabled={submittingEdit}
                  className="px-4 py-2.5 rounded-xl font-semibold text-[#C7A5A8] hover:bg-[#171014]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-5 py-2.5 rounded-xl font-bold font-heading uppercase tracking-wider bg-[#851B2B] hover:bg-[#a12235] text-white shadow-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {submittingEdit ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving Changes...
                    </>
                  ) : (
                    'Save User Profile'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. GUEST-TO-REGISTERED CONVERSION MODAL                                   */}
      {/* ========================================================================= */}
      {convertModalOpen && convertingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-md bg-[#260D17] border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl text-[#FFF4E8] m-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#49202C]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-heading text-white">Upgrade Guest Account</h3>
                  <p className="text-xs text-[#C7A5A8]">Convert to full Registered Customer</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConvertModalOpen(false)}
                className="p-1.5 rounded-lg text-[#C7A5A8] hover:text-white hover:bg-[#171014]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 p-3.5 rounded-xl bg-amber-950/25 border border-amber-500/30 text-xs text-amber-200">
              <p className="font-semibold text-white">
                Player: <span className="text-[#D7FF00]">{convertingUser.name}</span> ({convertingUser.phone})
              </p>
              <p className="text-[11px] text-amber-300/80 mt-1">
                Upgrading preserves this player's exact User ID, along with all {convertingUser.totalBookings || 0} historical bookings and receipts.
              </p>
            </div>

            <form onSubmit={handleCompleteConvert} className="space-y-4 text-xs">
              {/* Customer Email */}
              <div>
                <label className="block font-semibold text-[#C7A5A8] mb-1">
                  Customer Email Address (for OTP Delivery) *
                </label>
                <input
                  type="email"
                  required
                  value={convertEmail}
                  onChange={(e) => setConvertEmail(e.target.value)}
                  placeholder="customer@domain.com"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#171014] border border-[#49202C] text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Step 1: Send OTP Button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[#C7A5A8]">Identity Verification OTP</label>
                  {convertOtpSent && (
                    <span className="text-[11px] text-emerald-400 font-mono">
                      OTP dispatched to customer's email
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleRequestConvertOtp}
                  disabled={submittingConvert || convertCooldown > 0 || !convertEmail.trim()}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#171014] border border-[#49202C] text-[#FFF4E8] font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 font-mono"
                >
                  {convertCooldown > 0
                    ? `Resend available in ${convertCooldown}s`
                    : convertOtpSent
                    ? 'Resend 6-Digit OTP'
                    : 'Dispatch 6-Digit OTP to Email'}
                </button>
              </div>

              {/* Step 2: Enter OTP */}
              <div>
                <label className="block font-semibold text-[#C7A5A8] mb-1">Enter 6-Digit OTP *</label>
                <SixDigitOtpInput
                  value={convertOtp}
                  onChange={setConvertOtp}
                  disabled={submittingConvert}
                  variant="amber"
                />
              </div>

              {/* Step 3: Password */}
              <div>
                <label className="block font-semibold text-[#C7A5A8] mb-1">Set Account Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={convertPassword}
                  onChange={(e) => setConvertPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#171014] border border-[#49202C] text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#49202C]">
                <button
                  type="button"
                  onClick={() => setConvertModalOpen(false)}
                  disabled={submittingConvert}
                  className="px-4 py-2 rounded-xl text-[#C7A5A8] hover:bg-[#171014]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingConvert || convertOtp.length !== 6 || !convertPassword}
                  className="px-5 py-2.5 rounded-xl font-bold font-heading uppercase tracking-wider bg-[#851B2B] hover:bg-[#6e1623] active:bg-[#5e121e] text-white transition-all shadow-lg shadow-[#851B2B]/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingConvert ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> <span className="text-white">Verifying...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4 text-white" /> <span className="text-white">Complete Conversion</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PASSWORD RESET MODAL                                                   */}
      {/* ========================================================================= */}
      {resetModalOpen && resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-md bg-[#260D17] border border-rose-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl text-[#FFF4E8] m-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#49202C]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-heading text-white">Reset Customer Password</h3>
                  <p className="text-xs text-[#C7A5A8]">Secure OTP verification reset</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="p-1.5 rounded-lg text-[#C7A5A8] hover:text-white hover:bg-[#171014]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs text-rose-200">
              Target: <span className="font-bold text-white">{resettingUser.name}</span> ({resettingUser.phone})
            </div>

            <form onSubmit={handleCompleteReset} className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[#C7A5A8]">Step 1: Dispatch Reset OTP</label>
                  {resetOtpSent && (
                    <span className="text-[11px] text-emerald-400 font-mono">
                      OTP dispatched to customer's email
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleRequestResetOtp}
                  disabled={submittingReset || resetCooldown > 0}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#171014] border border-[#49202C] text-[#FFF4E8] font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 font-mono"
                >
                  {resetCooldown > 0
                    ? `Resend available in ${resetCooldown}s`
                    : resetOtpSent
                    ? 'Resend OTP to Customer'
                    : 'Send Reset OTP to Customer Email'}
                </button>
              </div>

              <div>
                <label className="block font-semibold text-[#C7A5A8] mb-1">Step 2: Enter 6-Digit OTP *</label>
                <SixDigitOtpInput
                  value={resetOtp}
                  onChange={setResetOtp}
                  disabled={submittingReset}
                  variant="rose"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#C7A5A8] mb-1">Step 3: New Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#171014] border border-[#49202C] text-white focus:outline-none focus:border-rose-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#49202C]">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  disabled={submittingReset}
                  className="px-4 py-2 rounded-xl text-[#C7A5A8] hover:bg-[#171014]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReset || resetOtp.length !== 6 || !resetNewPassword}
                  className="px-5 py-2.5 rounded-xl font-bold font-heading uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white shadow-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingReset ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...
                    </>
                  ) : (
                    'Set New Password'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MERGE DUPLICATE ACCOUNTS MODAL (Admin Only)                            */}
      {/* ========================================================================= */}
      {mergeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-lg bg-[#260D17] border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl text-[#FFF4E8] m-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#49202C]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                  <GitMerge className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-heading text-white">Merge Duplicate Accounts</h3>
                  <p className="text-xs text-[#C7A5A8]">Consolidate duplicate customer profiles</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMergeModalOpen(false)}
                className="p-1.5 rounded-lg text-[#C7A5A8] hover:text-white hover:bg-[#171014]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 mb-1" />
              All bookings, payments, and gaming sessions from the <strong>Secondary Account</strong> will be permanently migrated to the <strong>Primary Account</strong>. The secondary account will be marked deactivated.
            </div>

            <form onSubmit={handleMergeSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#C7A5A8] mb-1">
                  Primary Account ID (Account to Keep) *
                </label>
                <input
                  type="text"
                  required
                  value={mergePrimaryId}
                  onChange={(e) => setMergePrimaryId(e.target.value)}
                  placeholder="e.g. 6af812464e950ff72824844e"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#171014] border border-[#49202C] text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#C7A5A8] mb-1">
                  Secondary Account ID (Duplicate Account to Merge & Deactivate) *
                </label>
                <input
                  type="text"
                  required
                  value={mergeSecondaryId}
                  onChange={(e) => setMergeSecondaryId(e.target.value)}
                  placeholder="e.g. 6afa9400939423cf35afbc65"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#171014] border border-[#49202C] text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#C7A5A8] mb-1">Merge Reason / Audit Note</label>
                <input
                  type="text"
                  value={mergeReason}
                  onChange={(e) => setMergeReason(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#171014] border border-[#49202C] text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#49202C]">
                <button
                  type="button"
                  onClick={() => setMergeModalOpen(false)}
                  disabled={submittingMerge}
                  className="px-4 py-2 rounded-xl text-[#C7A5A8] hover:bg-[#171014]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMerge || !mergePrimaryId || !mergeSecondaryId}
                  className="px-5 py-2.5 rounded-xl font-bold font-heading uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-slate-950 transition-all shadow-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingMerge ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Merging...
                    </>
                  ) : (
                    <>
                      <GitMerge className="w-4 h-4" /> Confirm Merge
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CONFIRM DELETE USER MODAL (Admin Only) */}
      {/* ========================================================================= */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Customer Account"
        message={`Are you sure you really want to delete user '${userToDelete?.name}' (${userToDelete?.phone || userToDelete?.email || 'Customer'})? This action is permanent and cannot be undone.`}
        confirmText="Yes, Delete User"
        cancelText="Cancel"
        isDanger={true}
        isLoading={deletingUser}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!deletingUser) {
            setDeleteModalOpen(false);
            setUserToDelete(null);
          }
        }}
      />
    </div>
  );
};
