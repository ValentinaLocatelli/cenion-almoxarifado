import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppDataProvider } from '@/contexts/AppDataContext';
import { EstoqueProvider } from '@/contexts/EstoqueContext';
import { ActiveUnitProvider } from '@/contexts/ActiveUnitContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';

import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Entrada from '@/pages/Entrada';
import Saida from '@/pages/Saida';
import Itens from '@/pages/Itens';
import NotFound from '@/pages/NotFound';
import ResetPassword from '@/pages/ResetPassword';
import ChangePassword from '@/pages/ChangePassword';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ActiveUnitProvider>
          <AppDataProvider>
            <EstoqueProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/change-password"
                element={(
                  <ProtectedRoute>
                    <ChangePassword />
                  </ProtectedRoute>
                )}
              />

              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/entrada" element={<Entrada />} />
                <Route path="/saida" element={<Saida />} />
                <Route path="/itens" element={<Itens />} />
              </Route>

              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            </EstoqueProvider>
          </AppDataProvider>
        </ActiveUnitProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
