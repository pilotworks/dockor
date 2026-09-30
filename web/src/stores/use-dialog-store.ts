import { create } from 'zustand';
import React from 'react';

export type DialogVariant = 'primary' | 'destructive' | 'warning';

export interface ConfirmDialogOptions {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

export interface PromptDialogOptions {
  title: string;
  description?: React.ReactNode;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  inputType?: 'text' | 'password' | 'email' | 'number';
  required?: boolean;
  validate?: (value: string) => string | null | undefined;
}

export interface AlertDialogOptions {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  variant?: DialogVariant;
}

interface DialogState {
  isOpen: boolean;
  type: 'confirm' | 'prompt' | 'alert';
  title: string;
  description?: React.ReactNode;
  confirmText: string;
  cancelText: string;
  variant: DialogVariant;

  // Prompt specifics
  promptValue: string;
  placeholder?: string;
  inputType: 'text' | 'password' | 'email' | 'number';
  required?: boolean;
  errorMessage?: string;
  validate?: (value: string) => string | null | undefined;

  // Internal Promise resolver
  resolve: ((val: any) => void) | null;

  // Actions
  setPromptValue: (val: string) => void;
  openConfirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  openPrompt: (options: PromptDialogOptions) => Promise<string | null>;
  openAlert: (options: AlertDialogOptions) => Promise<void>;
  handleConfirm: () => void;
  handleCancel: () => void;
}

export const useDialogStore = create<DialogState>((set, get) => ({
  isOpen: false,
  type: 'confirm',
  title: '',
  description: undefined,
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'primary',
  promptValue: '',
  placeholder: '',
  inputType: 'text',
  required: false,
  errorMessage: undefined,
  validate: undefined,
  resolve: null,

  setPromptValue: (promptValue) => set({ promptValue, errorMessage: undefined }),

  openConfirm: (options) => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        type: 'confirm',
        title: options.title,
        description: options.description,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'primary',
        resolve,
      });
    });
  },

  openPrompt: (options) => {
    return new Promise<string | null>((resolve) => {
      set({
        isOpen: true,
        type: 'prompt',
        title: options.title,
        description: options.description,
        placeholder: options.placeholder || '',
        promptValue: options.defaultValue || '',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'primary',
        inputType: options.inputType || 'text',
        required: options.required ?? false,
        validate: options.validate,
        errorMessage: undefined,
        resolve,
      });
    });
  },

  openAlert: (options) => {
    return new Promise<void>((resolve) => {
      set({
        isOpen: true,
        type: 'alert',
        title: options.title,
        description: options.description,
        confirmText: options.confirmText || 'OK',
        cancelText: '',
        variant: options.variant || 'primary',
        resolve,
      });
    });
  },

  handleConfirm: () => {
    const { type, promptValue, validate, required, resolve } = get();

    if (type === 'prompt') {
      if (required && !promptValue.trim()) {
        set({ errorMessage: 'This field is required' });
        return;
      }
      if (validate) {
        const error = validate(promptValue);
        if (error) {
          set({ errorMessage: error });
          return;
        }
      }
      set({ isOpen: false });
      if (resolve) resolve(promptValue);
      return;
    }

    set({ isOpen: false });
    if (resolve) {
      if (type === 'confirm') resolve(true);
      else resolve(undefined);
    }
  },

  handleCancel: () => {
    const { type, resolve } = get();
    set({ isOpen: false });
    if (resolve) {
      if (type === 'confirm') resolve(false);
      else if (type === 'prompt') resolve(null);
      else resolve(undefined);
    }
  },
}));

// Standalone functions for convenience outside or inside React components
export const confirmDialog = (options: ConfirmDialogOptions) =>
  useDialogStore.getState().openConfirm(options);

export const promptDialog = (options: PromptDialogOptions) =>
  useDialogStore.getState().openPrompt(options);

export const alertDialog = (options: AlertDialogOptions) =>
  useDialogStore.getState().openAlert(options);
