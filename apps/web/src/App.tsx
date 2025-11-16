import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { SignIn, SignUp, SignedIn, SignedOut } from '@clerk/clerk-react';
import { Toaster } from '@/components/ui/Toaster';
import { Layout } from '@/components/layout';
import Dashboard from '@/pages/Dashboard';
import Onboarding from '@/pages/Onboarding';
import SelectAccount from '@/pages/SelectAccount';
import ClientDetail from '@/pages/ClientDetail';
import Recommendations from '@/pages/Recommendations';
import Competitors from '@/pages/Competitors';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<div className="p-8">Loading...</div>}>
          <Routes>
            {/* Public routes - Clerk built-in components */}
            <Route
              path="/sign-in/*"
              element={
                <div className="flex min-h-screen items-center justify-center">
                  <SignIn routing="path" path="/sign-in" />
                </div>
              }
            />
            <Route
              path="/sign-up/*"
              element={
                <div className="flex min-h-screen items-center justify-center">
                  <SignUp routing="path" path="/sign-up" />
                </div>
              }
            />

            {/* Protected routes */}
            <Route
              path="/onboarding"
              element={
                <>
                  <SignedIn>
                    <Layout>
                      <Onboarding />
                    </Layout>
                  </SignedIn>
                  <SignedOut>
                    <Navigate to="/sign-in" replace />
                  </SignedOut>
                </>
              }
            />
            <Route
              path="/onboarding/select-account"
              element={
                <>
                  <SignedIn>
                    <SelectAccount />
                  </SignedIn>
                  <SignedOut>
                    <Navigate to="/sign-in" replace />
                  </SignedOut>
                </>
              }
            />
            <Route
              path="/clients/:clientId"
              element={
                <>
                  <SignedIn>
                    <Layout>
                      <ClientDetail />
                    </Layout>
                  </SignedIn>
                  <SignedOut>
                    <Navigate to="/sign-in" replace />
                  </SignedOut>
                </>
              }
            />
            <Route
              path="/clients/:clientId/recommendations"
              element={
                <>
                  <SignedIn>
                    <Layout>
                      <Recommendations />
                    </Layout>
                  </SignedIn>
                  <SignedOut>
                    <Navigate to="/sign-in" replace />
                  </SignedOut>
                </>
              }
            />
            <Route
              path="/clients/:clientId/competitors"
              element={
                <>
                  <SignedIn>
                    <Layout>
                      <Competitors />
                    </Layout>
                  </SignedIn>
                  <SignedOut>
                    <Navigate to="/sign-in" replace />
                  </SignedOut>
                </>
              }
            />
            <Route
              path="/"
              element={
                <>
                  <SignedIn>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </SignedIn>
                  <SignedOut>
                    <Navigate to="/sign-in" replace />
                  </SignedOut>
                </>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
