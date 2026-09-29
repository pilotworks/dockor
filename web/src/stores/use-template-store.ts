import { create } from 'zustand';
import { Template } from '../types';

interface TemplateState {
  searchQuery: string;
  selectedCategory: string;
  activeDeployTemplate: Template | null;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  openDeployModal: (template: Template) => void;
  closeDeployModal: () => void;
}

export const useTemplateStore = create<TemplateState>((set) => ({
  searchQuery: '',
  selectedCategory: 'All',
  activeDeployTemplate: null,
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  openDeployModal: (activeDeployTemplate) => set({ activeDeployTemplate }),
  closeDeployModal: () => set({ activeDeployTemplate: null }),
}));
