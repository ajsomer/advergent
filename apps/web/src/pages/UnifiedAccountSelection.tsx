import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Building2, Globe, LayoutDashboard } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

    // Validate required params
    useEffect(() => {
        if (!session || !clientId) {
            setError('Missing required parameters. Please restart the connection process.');
            setLoading(false);
        }
    }, [session, clientId]);

    // Fetch all lists in parallel
    useEffect(() => {
        if (!session || !clientId || error) return;

        async function fetchAllData() {
            try {
                setLoading(true);

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
                console.error('Error fetching accounts:', err);
                setError('Failed to fetch account lists. Please try again.');
            } finally {
                setLoading(false);
            }
        }

        fetchAllData();
    }, [session, clientId, api, error]);

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
                            ) : (
                                <div className="p-4 bg-amber-50 rounded-md border border-amber-200">
                                    <p className="text-sm text-amber-800 font-medium mb-1">Google Ads Not Available</p>
                                    <p className="text-xs text-amber-700">
                                        Google Ads API access is not currently available. You can still connect Search Console and GA4.
                                    </p>
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
                                disabled={connecting || (!selectedAdsId && !selectedScUrl && !selectedGa4Id)}
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
