import React, { useRef, useEffect } from 'react';

/**
 * SixDigitOtpInput
 * High-performance 6-digit OTP input with auto-focus advancement,
 * backspace backward navigation, clipboard paste support, and mobile numeric keypad.
 */
export const SixDigitOtpInput = ({
  value = '',
  onChange,
  disabled = false,
  autoFocus = true,
  variant = 'lime', // 'lime' | 'amber' | 'rose'
}) => {
  const inputsRef = useRef([]);

  // Ensure digits array always has 6 items
  const digits = Array.from({ length: 6 }, (_, i) => (value && value[i]) || '');

  useEffect(() => {
    if (autoFocus && inputsRef.current[0] && !disabled) {
      inputsRef.current[0].focus();
    }
  }, [autoFocus, disabled]);

  const focusInput = (index) => {
    const target = inputsRef.current[index];
    if (target) {
      target.focus();
      target.select();
    }
  };

  const handleDigitChange = (index, e) => {
    const rawVal = e.target.value;
    // Keep only numbers
    const cleaned = rawVal.replace(/\D/g, '');

    if (!cleaned) {
      // Emptying this digit
      const newDigits = [...digits];
      newDigits[index] = '';
      onChange(newDigits.join(''));
      return;
    }

    if (cleaned.length > 1) {
      // User typed or pasted multiple characters into a single box
      handlePasteString(cleaned, index);
      return;
    }

    // Single digit entered
    const singleDigit = cleaned.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = singleDigit;
    const combined = newDigits.join('');
    onChange(combined);

    // Auto-advance to next box if not at end
    if (index < 5) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Current box is already empty; clear previous and focus it
        e.preventDefault();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
        focusInput(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      focusInput(index + 1);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    handlePasteString(pasted, 0);
  };

  const handlePasteString = (str, startIndex = 0) => {
    const numericOnly = str.replace(/\D/g, '').slice(0, 6);
    if (!numericOnly) return;

    const newDigits = [...digits];
    for (let i = 0; i < numericOnly.length && startIndex + i < 6; i++) {
      newDigits[startIndex + i] = numericOnly[i];
    }

    const combined = newDigits.join('');
    onChange(combined);

    const nextIndex = Math.min(startIndex + numericOnly.length, 5);
    focusInput(nextIndex);
  };

  // Border & focus color classes based on variant
  const colorClasses = {
    lime: 'border-[#49202C] focus:border-[#D7FF00] focus:ring-1 focus:ring-[#D7FF00] text-[#D7FF00]',
    amber: 'border-amber-500/40 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-amber-300',
    rose: 'border-rose-500/40 focus:border-rose-400 focus:ring-1 focus:ring-rose-400 text-rose-300',
  }[variant] || 'border-[#49202C] focus:border-[#D7FF00] text-[#D7FF00]';

  return (
    <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 my-2" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputsRef.current[index] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleDigitChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onClick={(e) => e.target.select()}
          className={`w-11 h-12 sm:w-12 sm:h-14 bg-[#171014] rounded-xl sm:rounded-2xl text-center font-mono font-black text-xl sm:text-2xl transition-all shadow-inner disabled:opacity-40 disabled:cursor-not-allowed ${colorClasses} ${
            digit ? 'border-opacity-100 bg-[#171014]/90' : 'border-opacity-60'
          }`}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
};

export default SixDigitOtpInput;
