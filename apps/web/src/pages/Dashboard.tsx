import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, TrendingUp, DollarSign, AlertCircle, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { useDashboardStats, useDashboardClients } from '@/hooks/useDashboard';
import { useApiClient } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const navigate = useNavigate();
  const api = useApiClient();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: clientsData, isLoading: clientsLoading, refetch } = useDashboardClients();
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleAddClient = () => {
    navigate('/onboarding');
  };

  const handleViewClient = (clientId: string) => {
    navigate(`/clients/${clientId}`);
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (!confirm(`Are you sure you want to delete "${clientName}"? This will permanently delete all associated data including recommendations and sync history.`)) {
      return;
    }

    setDeletingClientId(clientId);
    setDeleteError(null);

    try {
      await api.delete(`/api/clients/${clientId}`);
      // Refetch clients list to update UI
      refetch();
    } catch (err: any) {
      setDeleteError(err.response?.data?.error || 'Failed to delete client');
    } finally {
      setDeletingClientId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const hasClients = clientsData && clientsData.clients.length > 0;

  return (
    <main className="p-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-2 text-slate-600">Manage your clients and view performance insights</p>
        </div>
        <Button onClick={handleAddClient} size="lg">
          <Plus className="w-5 h-5 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Aggregate Stats */}
      {statsLoading ? (
        <div className="grid gap-6 mb-8 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : stats && hasClients ? (
        <div className="grid gap-6 mb-8 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Clients</CardDescription>
              <CardTitle className="text-3xl">{stats.totalClients}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Monthly Ad Spend
              </CardDescription>
              <CardTitle className="text-3xl">{formatCurrency(stats.totalMonthlySpend)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Potential Savings
              </CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {formatCurrency(stats.totalEstimatedSavings)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Active Recommendations
              </CardDescription>
              <CardTitle className="text-3xl">{stats.activeRecommendations}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      {/* Delete Error Alert */}
      {deleteError && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{deleteError}</AlertDescription>
        </Alert>
      )}

      {/* Client Cards */}
      {clientsLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : hasClients ? (
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Your Clients</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {clientsData.clients.map((client) => (
              <Card key={client.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{client.name}</CardTitle>
                  <div className="flex gap-2 mt-2">
                    {client.googleAdsConnected ? (
                      <Badge variant="success" className="text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Google Ads
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <XCircle className="w-3 h-3 mr-1" />
                        Google Ads
                      </Badge>
                    )}
                    {client.searchConsoleConnected ? (
                      <Badge variant="success" className="text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Search Console
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <XCircle className="w-3 h-3 mr-1" />
                        Search Console
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Monthly Spend</span>
                      <span className="font-semibold">{formatCurrency(client.monthlySpend)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Potential Savings</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(client.estimatedSavings)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Recommendations</span>
                      <Badge variant="secondary">{client.recommendationsCount}</Badge>
                    </div>
                    {client.lastSyncAt && (
                      <div className="text-xs text-slate-500">
                        Last synced {formatDistanceToNow(new Date(client.lastSyncAt), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => handleViewClient(client.id)}
                      className="flex-1"
                      variant="outline"
                    >
                      View Details
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClient(client.id, client.name);
                      }}
                      variant="outline"
                      size="icon"
                      disabled={deletingClientId === client.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        /* Empty state */
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Connect your first client to start analyzing their Google Ads and Search Console performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                <Plus className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No clients yet</h3>
              <p className="text-sm text-slate-600 mb-6 max-w-md">
                Add your first client to connect their Google Ads and Search Console accounts.
                We'll automatically analyze their data and provide AI-powered recommendations.
              </p>
              <Button onClick={handleAddClient}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Client
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
