import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { Shell } from './components/layout/shell';
import { ProtectedRoute } from './components/auth/protected-route';
import { LoginView } from './components/views/login-view';
import { UsersView } from './components/views/users-view';
import { DashboardView } from './components/views/dashboard-view';
import { TemplatesView } from './components/views/templates-view';
import { StacksView } from './components/views/stacks-view';
import { ContainersView } from './components/views/containers-view';
import { ContainerDetailView } from './components/views/container-detail-view';
import { StackDetailView } from './components/views/stack-detail-view';
import { NetworksView } from './components/views/networks-view';
import { NetworkDetailView } from './components/views/network-detail-view';
import { VolumesView } from './components/views/volumes-view';
import { VolumeDetailView } from './components/views/volume-detail-view';
import { ImagesView } from './components/views/images-view';
import { ImageDetailView } from './components/views/image-detail-view';
import { RegistriesView } from './components/views/registries-view';
import { ProxyView } from './components/views/proxy-view';
import { NodesView } from './components/views/nodes-view';
import { Toaster } from './components/ui/toaster';
import { ConfirmDialog } from './components/common/confirm-dialog';
import { useAuthStore } from './stores/use-auth-store';
import { api } from './lib/api';

export function App() {
  const { token, setUser, logout } = useAuthStore();

  // Validate session on mount if token exists
  useEffect(() => {
    if (token) {
      api.getCurrentUser()
        .then((user) => setUser(user))
        .catch(() => logout());
    }
  }, [token, setUser, logout]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginView />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Shell />}>
              <Route path="/" element={<DashboardView />} />
              <Route path="/dashboard" element={<DashboardView />} />
              <Route path="/templates" element={<TemplatesView />} />
              <Route path="/stacks" element={<StacksView />} />
              <Route path="/stacks/:id" element={<StackDetailView />} />
              <Route path="/containers" element={<ContainersView />} />
              <Route path="/containers/:id" element={<ContainerDetailView />} />
              <Route path="/networks" element={<NetworksView />} />
              <Route path="/networks/:id" element={<NetworkDetailView />} />
              <Route path="/volumes" element={<VolumesView />} />
              <Route path="/volumes/:name" element={<VolumeDetailView />} />
              <Route path="/images" element={<ImagesView />} />
              <Route path="/images/:id" element={<ImageDetailView />} />
              <Route path="/proxy" element={<ProxyView />} />
              <Route path="/registries" element={<RegistriesView />} />
              <Route path="/nodes" element={<NodesView />} />

              {/* Admin Only Routes */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/users" element={<UsersView />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>

      {/* Global Confirm & Prompt Dialog */}
      <ConfirmDialog />

      {/* Sonner Toaster */}
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
