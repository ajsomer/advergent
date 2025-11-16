import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertCircle, Building2, CreditCard, Globe } from 'lucide-react';

interface GoogleAdsAccount {
  customerId: string;
  name: string;
  isManager: boolean;
  currency: string;
}

interface SearchConsoleProperty {
  siteUrl: string;
  permissionLevel: string;
}

type AccountOrProperty = GoogleAdsAccount | SearchConsoleProperty;

export default function SelectAccount() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const api = useApiClient();

  const session = searchParams.get('session');
  const clientId = searchParams.get('clientId');
  const service = searchParams.get('service') as 'ads' | 'search_console' | null;

  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [properties, setProperties] = useState<SearchConsoleProperty[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate required params
  useEffect(() => {
    if (!session || !clientId || !service) {
      setError('Missing required parameters. Please restart the connection process.');
      setLoading(false);
    }
  }, [session, clientId, service]);

  // Fetch accessible accounts/properties based on service
  useEffect(() => {
    if (!session || !clientId || !service || error) return;

    async function fetchData() {
      try {
        setLoading(true);

        if (service === 'ads') {
          const response = await api.get(`/api/google/accounts/${clientId}`, {
            params: { session },
          });

          setAccounts(response.data.accounts || []);

          // If only one account, auto-select it
          if (response.data.accounts?.length === 1) {
            setSelectedAccountId(response.data.accounts[0].customerId);
          }
        } else if (service === 'search_console') {
          const response = await api.get(`/api/google/properties/${clientId}`, {
            params: { session },
          });

          setProperties(response.data.properties || []);

          // If only one property, auto-select it
          if (response.data.properties?.length === 1) {
            setSelectedAccountId(response.data.properties[0].siteUrl);
          }
        }
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message ||
          err.response?.data?.error ||
          `Failed to fetch ${service === 'ads' ? 'Google Ads accounts' : 'Search Console properties'}`;
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [session, clientId, service, api, error]);

  const handleContinue = async () => {
    if (!selectedAccountId || !session || !clientId || !service) return;

    try {
      setConnecting(true);
      setError(null);

      await api.post('/api/google/connect', {
        clientId,
        service,
        session,
        selectedAccountId,
      });

      // Redirect back to onboarding with success
      navigate(`/onboarding?step=complete&service=${service}&clientId=${clientId}`);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to connect account';
      setError(errorMessage);
      setConnecting(false);
    }
  };

  const handleRetry = () => {
    // Restart the OAuth flow
    if (clientId) {
      navigate(`/onboarding?clientId=${clientId}`);
    } else {
      navigate('/onboarding');
    }
  };

  // Format customer ID for display (e.g., 1234567890 -> 123-456-7890)
  const formatCustomerId = (id: string): string => {
    if (!id) return '';
    const cleaned = id.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return id;
  };

  // Get permission level label and badge variant
  const getPermissionLabel = (level: string): { label: string; variant: 'default' | 'secondary' | 'outline' } => {
    switch (level) {
      case 'siteOwner':
        return { label: 'Owner', variant: 'default' };
      case 'siteFullUser':
        return { label: 'Full User', variant: 'secondary' };
      case 'siteRestrictedUser':
        return { label: 'Restricted', variant: 'outline' };
      default:
        return { label: level, variant: 'outline' };
    }
  };

  const isSearchConsole = service === 'search_console';
  const itemCount = isSearchConsole ? properties.length : accounts.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
              <p className="text-lg font-medium text-slate-700">
                Loading {isSearchConsole ? 'Search Console properties' : 'Google Ads accounts'}...
              </p>
              <p className="text-sm text-slate-500 mt-2">This may take a moment</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error && itemCount === 0) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <AlertCircle className="h-12 w-12 text-red-600" />
              </div>
              <CardTitle className="text-center">
                Unable to Load {isSearchConsole ? 'Properties' : 'Accounts'}
              </CardTitle>
              <CardDescription className="text-center">{error}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center space-x-3">
              <Button onClick={handleRetry} variant="outline">
                Try Again
              </Button>
              <Button onClick={() => navigate('/onboarding')}>
                Back to Onboarding
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (itemCount === 0) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <AlertCircle className="h-12 w-12 text-amber-600" />
              </div>
              <CardTitle className="text-center">
                No {isSearchConsole ? 'Search Console Properties' : 'Google Ads Accounts'} Found
              </CardTitle>
              <CardDescription className="text-center">
                Make sure you have access to at least one{' '}
                {isSearchConsole ? 'Search Console property' : 'Google Ads account'} and try again.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center space-x-3">
              <Button onClick={handleRetry} variant="outline">
                Try Again
              </Button>
              <Button onClick={() => navigate('/onboarding')}>
                Skip for Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Select {isSearchConsole ? 'Search Console Property' : 'Google Ads Account'}
          </h1>
          <p className="text-slate-600">
            Choose which {isSearchConsole ? 'Search Console property' : 'Google Ads account'} to connect for this client
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Account/Property Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Available {isSearchConsole ? 'Properties' : 'Accounts'}</CardTitle>
            <CardDescription>
              {itemCount} {isSearchConsole ? 'property' : 'account'}
              {itemCount !== 1 ? (isSearchConsole ? 'ies' : 's') : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Google Ads Accounts */}
              {!isSearchConsole && accounts.map((account) => (
                <button
                  key={account.customerId}
                  onClick={() => setSelectedAccountId(account.customerId)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedAccountId === account.customerId
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-5 w-5 text-slate-600" />
                        <h3 className="font-semibold text-slate-900">{account.name}</h3>
                        {account.isManager && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                            Manager
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-slate-600">
                        <div className="flex items-center space-x-1">
                          <CreditCard className="h-4 w-4" />
                          <span>{formatCustomerId(account.customerId)}</span>
                        </div>
                        <span className="text-slate-400">•</span>
                        <span>{account.currency}</span>
                      </div>
                    </div>
                    {selectedAccountId === account.customerId && (
                      <CheckCircle2 className="h-6 w-6 text-blue-600 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}

              {/* Search Console Properties */}
              {isSearchConsole && properties.map((property) => {
                const permission = getPermissionLabel(property.permissionLevel);
                return (
                  <button
                    key={property.siteUrl}
                    onClick={() => setSelectedAccountId(property.siteUrl)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedAccountId === property.siteUrl
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Globe className="h-5 w-5 text-slate-600" />
                          <h3 className="font-semibold text-slate-900 break-all">{property.siteUrl}</h3>
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant={permission.variant}>{permission.label}</Badge>
                        </div>
                      </div>
                      {selectedAccountId === property.siteUrl && (
                        <CheckCircle2 className="h-6 w-6 text-blue-600 flex-shrink-0 ml-2" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <Button
                onClick={handleContinue}
                disabled={!selectedAccountId || connecting}
                className="w-full"
              >
                {connecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-2">Need help choosing?</h4>
          <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
            {isSearchConsole ? (
              <>
                <li>Select the property that matches your client's website</li>
                <li>Domain properties (sc-domain:) cover all subdomains and protocols</li>
                <li>URL-prefix properties cover specific URLs only</li>
                <li>You can change this later by disconnecting and reconnecting</li>
              </>
            ) : (
              <>
                <li>Select the account where your client's campaigns are running</li>
                <li>Manager accounts can access multiple sub-accounts</li>
                <li>You can change this later by disconnecting and reconnecting</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
