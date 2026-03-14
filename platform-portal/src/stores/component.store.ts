import { create } from 'zustand';

export interface Component {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  version: string;
  frontendUrl: string;
  backendUrl: string;
  routePath: string;
  icon?: string;
  category: string;
  permissions: string[];
  enabled: boolean;
  status: string;
  dependencies: any[];
  config: Record<string, any>;
  author?: string;
}

interface ComponentState {
  components: Component[];
  loading: boolean;
  error: string | null;

  fetchComponents: () => Promise<void>;
  addComponent: (component: Component) => void;
  updateComponent: (id: string, updates: Partial<Component>) => void;
  removeComponent: (id: string) => void;
  getComponentByPath: (path: string) => Component | undefined;
}

export const useComponentStore = create<ComponentState>((set, get) => ({
  components: [],
  loading: false,
  error: null,

  fetchComponents: async () => {
    set({ loading: true, error: null });

    try {
      const response = await fetch('http://localhost:5000/api/registry/components');

      if (!response.ok) {
        throw new Error('获取组件列表失败');
      }

      const data = await response.json();
      set({ components: data.components, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  addComponent: (component: Component) => {
    set((state) => ({
      components: [...state.components, component],
    }));
  },

  updateComponent: (id: string, updates: Partial<Component>) => {
    set((state) => ({
      components: state.components.map((comp) =>
        comp.id === id ? { ...comp, ...updates } : comp
      ),
    }));
  },

  removeComponent: (id: string) => {
    set((state) => ({
      components: state.components.filter((comp) => comp.id !== id),
    }));
  },

  getComponentByPath: (path: string) => {
    return get().components.find((comp) => path.startsWith(comp.routePath));
  },
}));
