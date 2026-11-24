/**
 * FitSnap - Custom Toast Notification System
 * Modern, clean, accessible toast alerts conforming to Linear / Whoop / Stripe tokens.
 */

import React from 'react';
import { Toaster, toast as hotToast, ToastOptions } from 'react-hot-toast';

export const FitSnapToaster: React.FC = () => {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={8}
      toastOptions={{
        duration: 3500,
        className: 'health-toast',
        style: {
          background: '#FFFFFF',
          color: '#0F172A',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.08)',
          borderRadius: '12px',
          padding: '12px 16px',
          fontSize: '0.875rem',
          fontWeight: 500,
          fontFamily: 'Inter, system-ui, sans-serif',
          maxWidth: '380px',
        },
        success: {
          iconTheme: {
            primary: '#16A34A',
            secondary: '#FFFFFF',
          },
        },
        error: {
          duration: 4500,
          iconTheme: {
            primary: '#DC2626',
            secondary: '#FFFFFF',
          },
        },
      }}
    />
  );
};

// Typed helper wrapper
export const toast = {
  success: (msg: string, opts?: ToastOptions) => hotToast.success(msg, opts),
  error: (msg: string, opts?: ToastOptions) => hotToast.error(msg, opts),
  info: (msg: string, opts?: ToastOptions) =>
    hotToast(msg, {
      icon: 'ℹ️',
      ...opts,
    }),
  loading: (msg: string, opts?: ToastOptions) => hotToast.loading(msg, opts),
  dismiss: (id?: string) => hotToast.dismiss(id),
};

export default toast;
