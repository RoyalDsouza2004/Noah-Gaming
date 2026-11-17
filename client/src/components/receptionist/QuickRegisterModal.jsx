import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { receptionistApi } from '../../api/receptionist.js';
import { userManagementApi } from '../../api/userManagement.js';
import { UserPlus, Phone, Mail, User, X, Loader2, AlertCircle, CheckCircle2, Sparkles, UserCheck } from 'lucide-react';

export const QuickRegisterModal = ({ onClose, onSuccess, initialQuery = '' }) => {
  const digits = (initialQuery || '').replace(/\D/g, '');
  const [name, setName] = useState(!digits ? (initialQuery || '') : '');
  const [phone, setPhone] = useState(digits);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [existingUser, setExistingUser] = useState(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Live duplicate check when 10 digits are entered
  useEffect(() => {
    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      let isMounted = true;
      setCheckingDuplicate(true);
      userManagementApi
        .checkDuplicate(cleanPhone)
        .then((res) => {
          if (isMounted && res?.success && res.exists) {
            setExistingUser(res.user);
          } else if (isMounted) {
            setExistingUser(null);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setCheckingDuplicate(false);
        });
      return () => {
        isMounted = false;
      };
    } else {
      setExistingUser(null);
    }
  }, [phone]);

  const handleSelectExisting = () => {
    if (existingUser) {
      toast.success(`Selected existing profile for ${existingUser.name}!`);
      if (onSuccess) onSuccess(existingUser);
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Mobile number must be exactly 10 digits.');
      return;
    }

    if (!name.trim()) {
      setError('Customer name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await receptionistApi.registerCustomer({
        name: name.trim(),
        phone: cleanPhone,
        email: email.trim() || undefined,
      });

      if (res?.success) {
        if (res.alreadyExists) {
          toast.success(`Existing profile found for ${cleanPhone}!`);
        } else {
          toast.success(`Registered new customer '${name}' successfully!`);
        }
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        throw new Error(res?.message || 'Failed to register customer');
      }
    } catch (err) {
      const msg = err.message || 'Registration failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md my-auto max-h-[92vh] overflow-y-auto bg-[#260D17] border border-[#49202C] rounded-2xl p-5 sm:p-6 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#851B2B]/15 border border-[#49202C] flex items-center justify-center text-[#D7FF00]">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-heading">Register Walk-in Player</h3>
              <p className="text-xs text-slate-400">Instant counter account creation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Full Name <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#851B2B]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Mobile Number (10 Digits) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="tel"
                required
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="9876543210"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-[#851B2B]"
              />
              {checkingDuplicate && (
                <div className="absolute right-3 top-2.5 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-[#D7FF00]" />
                </div>
              )}
            </div>

            {existingUser && (
              <div className="mt-2.5 p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Existing Profile Found: {existingUser.name}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/30 text-amber-300 border border-amber-500/50">
                    {existingUser.accountType === 'GUEST' ? 'GUEST' : 'REGISTERED'}
                  </span>
                </div>
                <p className="text-[11px] text-amber-300/80">
                  This player already exists in the system. You can select this profile directly to prevent duplicate records.
                </p>
                <button
                  type="button"
                  onClick={handleSelectExisting}
                  className="w-full py-1.5 px-3 rounded-lg text-xs font-bold font-heading uppercase bg-[#D7FF00] hover:bg-[#c8ee00] text-slate-950 transition-colors flex items-center justify-center gap-1.5 shadow-md"
                >
                  <UserCheck className="w-3.5 h-3.5" /> Select Existing Profile ({existingUser.name})
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Email Address (Optional)
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Auto-generated if empty"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#851B2B]"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              If skipped, guest.phonenumber@noahgaming.com will be assigned.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold font-heading uppercase tracking-wider text-slate-950 bg-[#D7FF00] hover:bg-[#c8ee00] text-[#171014] transition-all shadow-lg shadow-[#851B2B]/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" /> Save & Select Player
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
