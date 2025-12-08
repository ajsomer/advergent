import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Circle, Loader2, LayoutDashboard, Globe } from 'lucide-react';

type OnboardingStep = 'create-client' | 'select-mode' | 'connect-google-ads' | 'connect-search-console' | 'connect-ga4' | 'complete';

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const api = useApiClient();

  const [currentStep, setCurrentStep] = useState<OnboardingStep>('create-client');
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleAdsConnected, setGoogleAdsConnected] = useState(false);
  const [searchConsoleConnected, setSearchConsoleConnected] = useState(false);
  const [ga4Connected, setGa4Connected] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<'unified' | 'split' | null>(null);

  // Check for OAuth callback parameters
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const stepParam = searchParams.get('step');
    const serviceParam = searchParams.get('service');
    const clientIdParam = searchParams.get('clientId');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }

    // Restore clientId from callback if present
    if (clientIdParam && !clientId) {
      setClientId(clientIdParam);
    }

    if (stepParam === 'complete') {
      // Handle multiple services from unified flow
      const servicesParam = searchParams.get('services');
      if (servicesParam) {
        const services = servicesParam.split(',');
        if (services.includes('ads')) setGoogleAdsConnected(true);
        if (services.includes('search_console')) setSearchConsoleConnected(true);
        if (services.includes('ga4')) setGa4Connected(true);
        setCurrentStep('complete');
      }
      // Handle single service from split flow (backward compatibility)
      else if (serviceParam) {
        if (serviceParam === 'ads') {
          setGoogleAdsConnected(true);
          setCurrentStep('connect-search-console');
        } else if (serviceParam === 'search_console') {
          setSearchConsoleConnected(true);
          setCurrentStep('connect-ga4');
        } else if (serviceParam === 'ga4') {
          setGa4Connected(true);
          setCurrentStep('complete');
        }
      }
    }
  }, [searchParams, clientId]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/clients', {
        name: clientName,
      });

      setClientId(response.data.id);
      setCurrentStep('select-mode');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMode = async (mode: 'unified' | 'split') => {
    setOnboardingMode(mode);
    if (mode === 'split') {
      setCurrentStep('connect-google-ads');
    } else {
      // Unified flow
      if (!clientId) return;
      setLoading(true);
      try {
        const response = await api.get('/api/google/auth/initiate', {
          params: {
            clientId,
            service: 'all',
          },
        });
        window.location.href = response.data.authUrl;
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to initiate unified connection');
        setLoading(false);
      }
    }
  };

  const handleConnectGoogleAds = async () => {
    if (!clientId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/api/google/auth/initiate', {
        params: {
          clientId,
          service: 'ads',
        },
      });

      // Redirect to Google OAuth
      window.location.href = response.data.authUrl;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to initiate Google Ads connection');
      setLoading(false);
    }
  };

  const handleConnectSearchConsole = async () => {
    if (!clientId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/api/google/auth/initiate', {
        params: {
          clientId,
          service: 'search_console',
        },
      });

      // Redirect to Google OAuth
      window.location.href = response.data.authUrl;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to initiate Search Console connection');
      setLoading(false);
    }
  };

  const handleSkipGoogleAds = () => {
    setCurrentStep('connect-search-console');
  };

  const handleSkipSearchConsole = () => {
    setCurrentStep('connect-ga4');
  };

  const handleConnectGA4 = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const { data } = await api.get('/api/google/auth/initiate', {
        params: {
          clientId,
          service: 'ga4',
        },
      });
      window.location.href = data.authUrl;
    } catch (err) {
      setError('Failed to initiate GA4 connection');
      setLoading(false);
    }
  };

  const handleSkipGA4 = () => {
    setCurrentStep('complete');
  };

  const handleComplete = () => {
    if (clientId) {
      navigate(`/clients/${clientId}/preparing`);
    } else {
      // Fallback - shouldn't happen but handle gracefully
      navigate('/');
    }
  };

  const steps = [
    { key: 'create-client', label: 'Create Client', completed: !!clientId },
    { key: 'select-mode', label: 'Select Mode', completed: !!onboardingMode },
    ...(onboardingMode === 'unified'
      ? [{ key: 'connect-unified', label: 'Connect Accounts', completed: currentStep === 'complete' }]
      : [
        { key: 'connect-google-ads', label: 'Connect Google Ads', completed: googleAdsConnected },
        { key: 'connect-search-console', label: 'Connect Search Console', completed: searchConsoleConnected },
        { key: 'connect-ga4', label: 'Connect GA4', completed: ga4Connected },
      ]
    ),
    { key: 'complete', label: 'Complete', completed: currentStep === 'complete' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step.completed
                    ? 'bg-blue-600 text-white'
                    : currentStep === step.key
                      ? 'bg-blue-100 text-blue-600 border-2 border-blue-600'
                      : 'bg-slate-200 text-slate-400'
                    }`}>
                    {step.completed ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <Circle className="w-6 h-6" />
                    )}
                  </div>
                  <span className="mt-2 text-sm font-medium text-slate-700">{step.label}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-1 mx-4 ${step.completed ? 'bg-blue-600' : 'bg-slate-200'
                    }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Step Content */}
        <Card>
          {currentStep === 'create-client' && (
            <>
              <CardHeader>
                <CardTitle>Create New Client</CardTitle>
                <CardDescription>
                  Enter the name of the client you want to add to your agency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateClient} className="space-y-4">
                  <div>
                    <Label htmlFor="clientName">Client Name</Label>
                    <Input
                      id="clientName"
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="e.g., Acme Corporation"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={loading || !clientName.trim()}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Continue'
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}

          {currentStep === 'select-mode' && (
            <>
              <CardHeader>
                <CardTitle>Select Connection Mode</CardTitle>
                <CardDescription>
                  Choose how you want to connect your Google accounts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <button
                    onClick={() => handleSelectMode('unified')}
                    className="flex flex-col items-start p-6 border-2 border-slate-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition-all text-left"
                  >
                    <div className="p-3 bg-blue-100 rounded-full mb-4">
                      <LayoutDashboard className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Single Google Account</h3>
                    <p className="text-sm text-slate-600">
                      I use one Google account (e.g. analytics@agency.com) to access Google Ads, Search Console, and GA4.
                    </p>
                  </button>

                  <button
                    onClick={() => handleSelectMode('split')}
                    className="flex flex-col items-start p-6 border-2 border-slate-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition-all text-left"
                  >
                    <div className="p-3 bg-purple-100 rounded-full mb-4">
                      <Globe className="w-6 h-6 text-purple-600" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Multiple Google Accounts</h3>
                    <p className="text-sm text-slate-600">
                      I need to use different Google accounts for each service.
                    </p>
                  </button>
                </div>
              </CardContent>
            </>
          )}

          {currentStep === 'connect-google-ads' && (
            <>
              <CardHeader>
                <CardTitle>Connect Google Ads</CardTitle>
                <CardDescription>
                  Connect your client's Google Ads account to analyze paid search performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2">What you'll need:</h4>
                  <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                    <li>Access to your client's Google Ads account</li>
                    <li>Admin or Standard access level</li>
                    <li>Permission to grant API access</li>
                  </ul>
                </div>
                <div className="flex space-x-3">
                  <Button onClick={handleConnectGoogleAds} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Connect Google Ads'
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleSkipGoogleAds}>
                    Skip for Now
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {currentStep === 'connect-search-console' && (
            <>
              <CardHeader>
                <CardTitle>Connect Google Search Console</CardTitle>
                <CardDescription>
                  Connect Search Console to analyze organic search performance and identify overlaps
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {googleAdsConnected && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200 mb-4">
                    <div className="flex items-start">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 mr-2" />
                      <div>
                        <h4 className="font-semibold text-green-900">Google Ads Connected</h4>
                        <p className="text-sm text-green-700">Your Google Ads account is now connected</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2">What you'll need:</h4>
                  <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                    <li>Access to your client's Google Search Console</li>
                    <li>Owner or Full user permissions</li>
                    <li>Verified website property</li>
                  </ul>
                </div>

                <div className="flex space-x-3">
                  <Button onClick={handleConnectSearchConsole} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Connect Search Console'
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleSkipSearchConsole}>
                    Skip for Now
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {currentStep === 'connect-ga4' && (
            <>
              <CardHeader>
                <CardTitle>Connect Google Analytics 4</CardTitle>
                <CardDescription>
                  Connect GA4 to analyze user engagement and conversion metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {searchConsoleConnected && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200 mb-4">
                    <div className="flex items-start">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 mr-2" />
                      <div>
                        <h4 className="font-semibold text-green-900">Search Console Connected</h4>
                        <p className="text-sm text-green-700">Your Search Console property is now connected</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2">What you'll need:</h4>
                  <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                    <li>Access to your client's GA4 property</li>
                    <li>Viewer or higher permissions</li>
                  </ul>
                </div>

                <div className="flex space-x-3">
                  <Button onClick={handleConnectGA4} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Connect GA4'
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleSkipGA4}>
                    Skip for Now
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {currentStep === 'complete' && (
            <>
              <CardHeader>
                <CardTitle>Onboarding Complete!</CardTitle>
                <CardDescription>
                  Your client has been successfully added to Advergent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-6 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-16 h-16 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-green-900 text-center mb-2">
                    Setup Complete
                  </h3>
                  <p className="text-sm text-green-700 text-center mb-4">
                    We'll begin syncing data from your connected accounts. This may take a few minutes.
                  </p>

                  <div className="space-y-2">
                    {googleAdsConnected && (
                      <div className="flex items-center text-sm text-green-800">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Google Ads connected
                      </div>
                    )}
                    {searchConsoleConnected && (
                      <div className="flex items-center text-sm text-green-800">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Search Console connected
                      </div>
                    )}
                    {ga4Connected && (
                      <div className="flex items-center text-sm text-green-800">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        GA4 connected
                      </div>
                    )}
                  </div>
                </div>

                <Button onClick={handleComplete} className="w-full">
                  Go to Dashboard
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
