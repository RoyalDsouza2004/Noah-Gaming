import toast from 'react-hot-toast';

export const showToast = {
  success: (msg, opts) => toast.success(msg, opts),
  error: (msg, opts) => toast.error(msg, opts),
  info: (msg, opts) =>
    toast(msg, {
      icon: 'ℹ️',
      ...opts,
    }),
  warn: (msg, opts) =>
    toast(msg, {
      icon: '⚠️',
      ...opts,
    }),
  warning: (msg, opts) =>
    toast(msg, {
      icon: '⚠️',
      ...opts,
    }),
  loading: (msg, opts) => toast.loading(msg, opts),
  dismiss: (id) => toast.dismiss(id),
  promise: (promise, msgs, opts) => toast.promise(promise, msgs, opts),
};

export default toast;
