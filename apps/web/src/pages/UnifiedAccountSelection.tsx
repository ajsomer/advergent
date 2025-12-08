import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClerk, useAuth } from '@clerk/clerk-react';
import { useApiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Building2, Globe, LayoutDashboard, Upload, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CSVUploadZone } from '@/components/upload/CSVUploadZone';
import { log } from '@/lib/logger';

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

interface GA4Property {
    propertyId: string;
    displayName: string;
    industryCategory?: string;
}

export default function UnifiedAccountSelection() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const clerk = useClerk();
    const { getToken, isLoaded: isClerkLoaded } = useAuth();
    const api = useApiClient();

    const session = searchParams.get('session');
    const clientId = searchParams.get('clientId');

    const [adsAccounts, setAdsAccounts] = useState<GoogleAdsAccount[]>([]);
    const [scProperties, setScProperties] = useState<SearchConsoleProperty[]>([]);
    const [ga4Properties, setGa4Properties] = useState<GA4Property[]>([]);

    const [selectedAdsId, setSelectedAdsId] = useState<string>('');
    const [selectedScUrl, setSelectedScUrl] = useState<string>('');
    const [selectedGa4Id, setSelectedGa4Id] = useState<string>('');

    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // CSV upload state for when Google Ads API is unavailable
    const [showCsvUpload, setShowCsvUpload] = useState(false);
    const [csvUploadComplete, setCsvUploadComplete] = useState(false);

    // Session readiness state - we need to reload Clerk session after OAuth redirect
    const [sessionReady, setSessionReady] = useState(false);
    const [sessionError, setSessionError] = useState<string | null>(null);
    const [sessionReloading, setSessionReloading] = useState(false);

    // Reload Clerk session after OAuth redirect
    // Per Clerk docs: use getToken({ skipCache: true }) to force a fresh token
    // https://clerk.com/docs/guides/sessions/force-token-refresh
    const reloadClerkSession = useCallback(async () => {
        if (!isClerkLoaded) {
            log.debug('Clerk not loaded yet, waiting...');
            return;
        }

        setSessionReloading(true);
        setSessionError(null);

        try {
            log.info('Reloading Clerk session after OAuth redirect');

            // Per Clerk best practices: use skipCache to force a fresh token after redirects
            // This ensures we get a newly minted token rather than a potentially stale cached one
            let token = await getToken({ skipCache: true });

            if (!token && clerk.session) {
                // Session exists but token is null - reload the session first
                log.info('Token not available, reloading Clerk session...');
                await clerk.session.reload();

                // Wait a moment for session state to propagate
                await new Promise(resolve => setTimeout(resolve, 500));

                // Try getting a fresh token again with skipCache
                token = await getToken({ skipCache: true });
            }

            if (!token) {
                // Still no token - try a few more times with backoff
                for (let attempt = 1; attempt <= 3; attempt++) {
                    log.warn(`Token still null after reload, retry attempt ${attempt}/3`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));

                    if (clerk.session) {
                        await clerk.session.reload();
                    }

                    // Always use skipCache after redirect/reload
                    token = await getToken({ skipCache: true });
                    if (token) break;
                }
            }

            if (token) {
                log.info('Clerk session ready, token obtained successfully');
                setSessionReady(true);
            } else {
                throw new Error('Unable to obtain authentication token after multiple attempts');
            }
        } catch (err: any) {
            log.error('Failed to reload Clerk session', { error: err.message });
            setSessionError(
                'Failed to initialize your session. This can happen after returning from Google OAuth. ' +
                'Please try refreshing the page or restarting the onboarding process.'
            );
        } finally {
            setSessionReloading(false);
        }
    }, [clerk, getToken, isClerkLoaded]);

    // Reload session on mount when coming from OAuth redirect (session param present)
    useEffect(() => {
        if (session && isClerkLoaded && !sessionReady && !sessionError) {
            reloadClerkSession();
        }
    }, [session, isClerkLoaded, sessionReady, sessionError, reloadClerkSession]);

    // Validate required params
    useEffect(() => {
        if (!session || !clientId) {
            setError('Missing required parameters. Please restart the connection process.');
            setLoading(false);
        }
    }, [session, clientId]);

    // Fetch all lists in parallel - only after session is ready
    useEffect(() => {
        if (!session || !clientId || error || !sessionReady) return;

        async function fetchAllData() {
            try {
                setLoading(true);
                log.info('Fetching Google accounts after session ready');

                const [adsRes, scRes, ga4Res] = await Promise.all([
                    api.get(`/api/google/accounts/${clientId}`, { params: { session } }),
                    api.get(`/api/google/properties/${clientId}`, { params: { session } }),
                    api.get(`/api/google/ga4-properties/${clientId}`, { params: { session } })
                ]);

                setAdsAccounts(adsRes.data.accounts || []);
                setScProperties(scRes.data.properties || []);
                setGa4Properties(ga4Res.data.properties || []);

                // Auto-select if only one option
                if (adsRes.data.accounts?.length === 1) setSelectedAdsId(adsRes.data.accounts[0].customerId);
                if (scRes.data.properties?.length === 1) setSelectedScUrl(scRes.data.properties[0].siteUrl);
                if (ga4Res.data.properties?.length === 1) setSelectedGa4Id(ga4Res.data.properties[0].propertyId);

            } catch (err: any) {
                log.error('Error fetching accounts', { error: err.message });
                setError('Failed to fetch account lists. Please try again.');
            } finally {
                setLoading(false);
            }
        }

        fetchAllData();
    }, [session, clientId, api, error, sessionReady]);

    const handleConnect = async () => {
        if (!session || !clientId) return;

        try {
            setConnecting(true);
            setError(null);

            await api.post('/api/google/connect-unified', {
                clientId,
                session,
                googleAdsId: selectedAdsId || undefined,
                searchConsoleUrl: selectedScUrl || undefined,
                ga4PropertyId: selectedGa4Id || undefined,
            });

            // Redirect to onboarding complete with all connected services
            const connectedServices = [];
            if (selectedAdsId) connectedServices.push('ads');
            if (csvUploadComplete) connectedServices.push('ads_csv');
            if (selectedScUrl) connectedServices.push('search_console');
            if (selectedGa4Id) connectedServices.push('ga4');

            navigate(`/onboarding?step=complete&services=${connectedServices.join(',')}&clientId=${clientId}`);
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to connect accounts';
            setError(errorMessage);
            setConnecting(false);
        }
    };

    const handleRetry = () => {
        navigate(`/onboarding?clientId=${clientId}`);
    };

    const handleRetrySession = () => {
        setSessionError(null);
        setSessionReady(false);
        reloadClerkSession();
    };

    const handleRefreshPage = () => {
        window.location.reload();
    };

    // Show session initialization state - before anything else can happen
    if (session && (!sessionReady && !sessionError)) {
        return (
            <div className="min-h-screen bg-slate-50 py-12 px-4">
                <div className="max-w-3xl mx-auto">
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
                            <p className="text-lg font-medium text-slate-700">Initializing session...</p>
                            <p className="text-sm text-slate-500 mt-2">
                                Setting up your authentication after Google OAuth
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    // Show session error state with recovery options
    if (sessionError) {
        return (
            <div className="min-h-screen bg-slate-50 py-12 px-4">
                <div className="max-w-3xl mx-auto">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-center mb-4">
                                <AlertCircle className="h-12 w-12 text-amber-600" />
                            </div>
                            <CardTitle className="text-center">Session Initialization Failed</CardTitle>
                            <CardDescription className="text-center mt-2">
                                {sessionError}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center space-y-4">
                            <div className="flex justify-center space-x-3">
                                <Button
                                    onClick={handleRetrySession}
                                    variant="outline"
                                    disabled={sessionReloading}
                                    className="gap-2"
                                >
                                    {sessionReloading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="h-4 w-4" />
                                    )}
                                    Retry Session
                                </Button>
                                <Button onClick={handleRefreshPage} variant="outline">
                                    Refresh Page
                                </Button>
                                <Button onClick={() => navigate('/onboarding')}>
                                    Restart Onboarding
                                </Button>
                            </div>
                            <p className="text-xs text-slate-500 text-center max-w-md mt-4">
                                If this issue persists, try signing out and signing back in,
                                or contact support for assistance.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 py-12 px-4">
                <div className="max-w-3xl mx-auto">
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
                            <p className="text-lg font-medium text-slate-700">Loading your Google accounts...</p>
                            <p className="text-sm text-slate-500 mt-2">This may take a moment</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (error && !adsAccounts.length && !scProperties.length && !ga4Properties.length) {
        return (
            <div className="min-h-screen bg-slate-50 py-12 px-4">
                <div className="max-w-3xl mx-auto">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-center mb-4">
                                <AlertCircle className="h-12 w-12 text-red-600" />
                            </div>
                            <CardTitle className="text-center">Unable to Load Accounts</CardTitle>
                            <CardDescription className="text-center">{error}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex justify-center space-x-3">
                            <Button onClick={handleRetry} variant="outline">Try Again</Button>
                            <Button onClick={() => navigate('/onboarding')}>Back to Onboarding</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Select Accounts</h1>
                    <p className="text-slate-600">Choose the accounts you want to connect for this client</p>
                </div>

                {error && (
                    <Alert className="mb-6 border-red-200 bg-red-50">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800">{error}</AlertDescription>
                    </Alert>
                )}

                <Card>
                    <CardContent className="p-6 space-y-8">
                        {/* Google Ads Selection */}
                        <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Building2 className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900">Google Ads</h3>
                                    <p className="text-sm text-slate-500">Select the ad account to manage</p>
                                </div>
                            </div>

                            {adsAccounts.length > 0 ? (
                                <Select value={selectedAdsId} onValueChange={setSelectedAdsId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Google Ads Account" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {adsAccounts.map((account) => (
                                            <SelectItem key={account.customerId} value={account.customerId}>
                                                {account.name} ({account.customerId})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : showCsvUpload ? (
                                <div className="space-y-3">
                                    <CSVUploadZone
                                        clientId={clientId!}
                                        onUploadComplete={() => setCsvUploadComplete(true)}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowCsvUpload(false)}
                                        className="text-slate-500"
                                    >
                                        Cancel CSV Upload
                                    </Button>
                                </div>
                            ) : csvUploadComplete ? (
                                <div className="p-4 bg-green-50 rounded-md border border-green-200">
                                    <p className="text-sm text-green-800 font-medium mb-1">Google Ads Data Uploaded</p>
                                    <p className="text-xs text-green-700">
                                        Your CSV data has been imported successfully. Continue to connect other services.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 bg-amber-50 rounded-md border border-amber-200">
                                    <p className="text-sm text-amber-800 font-medium mb-1">Google Ads API Not Available</p>
                                    <p className="text-xs text-amber-700 mb-3">
                                        Google Ads API access is not currently available. You can upload your Google Ads data via CSV instead.
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowCsvUpload(true)}
                                        className="gap-2"
                                    >
                                        <Upload className="h-4 w-4" />
                                        Upload CSV Reports
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="h-px bg-slate-200" />

                        {/* Search Console Selection */}
                        <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <Globe className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900">Search Console</h3>
                                    <p className="text-sm text-slate-500">Select the property for organic data</p>
                                </div>
                            </div>

                            {scProperties.length > 0 ? (
                                <Select value={selectedScUrl} onValueChange={setSelectedScUrl}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Search Console Property" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {scProperties.map((property) => (
                                            <SelectItem key={property.siteUrl} value={property.siteUrl}>
                                                {property.siteUrl}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="p-4 bg-slate-50 rounded-md border border-slate-200 text-sm text-slate-500 text-center">
                                    No Search Console properties found
                                </div>
                            )}
                        </div>

                        <div className="h-px bg-slate-200" />

                        {/* GA4 Selection */}
                        <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <div className="p-2 bg-orange-100 rounded-lg">
                                    <LayoutDashboard className="h-5 w-5 text-orange-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900">Google Analytics 4</h3>
                                    <p className="text-sm text-slate-500">Select the GA4 property</p>
                                </div>
                            </div>

                            {ga4Properties.length > 0 ? (
                                <Select value={selectedGa4Id} onValueChange={setSelectedGa4Id}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select GA4 Property" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ga4Properties.map((property) => (
                                            <SelectItem key={property.propertyId} value={property.propertyId}>
                                                {property.displayName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="p-4 bg-slate-50 rounded-md border border-slate-200 text-sm text-slate-500 text-center">
                                    No GA4 properties found
                                </div>
                            )}
                        </div>

                        <div className="pt-6">
                            <Button
                                onClick={handleConnect}
                                className="w-full"
                                size="lg"
                                disabled={connecting || (!selectedAdsId && !selectedScUrl && !selectedGa4Id && !csvUploadComplete)}
                            >
                                {connecting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Connecting Accounts...
                                    </>
                                ) : (
                                    'Connect Selected Accounts'
                                )}
                            </Button>
                            <p className="text-xs text-slate-500 text-center mt-4">
                                You can skip any service by leaving it unselected.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
