import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { Shell } from './components/layout/shell';
import { TemplatesView } from './components/views/templates-view';
import { StacksView } from './components/views/stacks-view';
import { ContainersView } from './components/views/containers-view';
import { NodesView } from './components/views/nodes-view';
import { Toaster } from './components/ui/toaster';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Navigate to="/templates" replace />} />
            <Route path="/templates" element={<TemplatesView />} />
            <Route path="/stacks" element={<StacksView />} />
            <Route path="/containers" element={<ContainersView />} />
            <Route path="/nodes" element={<NodesView />} />
            <Route path="*" element={<Navigate to="/templates" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>

      {/* Sonner Toaster */}
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
