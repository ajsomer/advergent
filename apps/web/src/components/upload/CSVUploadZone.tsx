import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileSpreadsheet, CheckCircle, AlertCircle, Loader2, X, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApiClient, useAuthReady, AuthenticationError } from '@/lib/api';

interface UploadResult {
  sessionId: string;
  totalFiles: number;
  imported: Array<{
    fileName: string;
    fileType: string;
    description: string;
    rowCount: number;
  }>;
  skipped: Array<{
    fileName: string;
    reason: string;
  }>;
  failed: Array<{
    fileName: string;
    error: string;
  }>;
  dateRange: { start: string; end: string } | null;
}

interface CSVUploadZoneProps {
  clientId: string;
  onUploadComplete?: (result: UploadResult) => void;
}

export function CSVUploadZone({ clientId, onUploadComplete }: CSVUploadZoneProps) {
  const apiClient = useApiClient();
  const { isReady: isAuthReady } = useAuthReady();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    // Check if authentication is ready before attempting upload
    if (!isAuthReady) {
      setError('Authentication is still loading. Please wait a moment and try again.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    setResult(null);

    const formData = new FormData();
    acceptedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await apiClient.post(
        `/api/clients/${clientId}/csv-upload`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const progress = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setUploadProgress(progress);
          },
        }
      );

      setResult(response.data);
      onUploadComplete?.(response.data);
    } catch (err: unknown) {
      // Handle specific error types
      if (err instanceof AuthenticationError) {
        setError('Authentication failed. Please refresh the page and try again.');
      } else {
        const axiosError = err as { response?: { status?: number; data?: { error?: string } } };
        const status = axiosError.response?.status;

        if (status === 401) {
          setError('Session expired or not authenticated. Please refresh the page to re-authenticate.');
        } else if (status === 403) {
          setError('You do not have permission to upload files for this client.');
        } else if (status === 404) {
          setError('Client not found. Please check the client ID and try again.');
        } else {
          const serverMessage = axiosError.response?.data?.error;
          setError(serverMessage || 'Upload failed. Please try again.');
        }
      }
    } finally {
      setIsUploading(false);
    }
  }, [clientId, onUploadComplete, apiClient, isAuthReady]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    disabled: isUploading || !isAuthReady,
  });

  const resetUpload = () => {
    setResult(null);
    setError(null);
    setUploadProgress(0);
  };

  // Show results
  if (result) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-green-700 text-lg">
              <CheckCircle className="h-5 w-5" />
              Upload Complete
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={resetUpload}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Range */}
          {result.dateRange && (
            <p className="text-sm text-slate-500">
              Date Range: {result.dateRange.start} to {result.dateRange.end}
            </p>
          )}

          {/* Imported Files */}
          {result.imported.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Imported:</h4>
              <div className="space-y-1">
                {result.imported.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{file.description}</span>
                    <Badge variant="secondary">{file.rowCount} rows</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skipped Files */}
          {result.skipped.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-2">
                Skipped (not needed for analysis):
              </h4>
              <p className="text-sm text-slate-400">
                {result.skipped.map((f) => f.reason.split(' (')[0]).join(', ')}
              </p>
            </div>
          )}

          {/* Failed Files */}
          {result.failed.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-red-600 mb-2">Failed:</h4>
              <div className="space-y-1">
                {result.failed.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>{file.fileName}: {file.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button onClick={resetUpload} className="w-full">
            Upload More Files
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show error
  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <p className="text-red-700 font-medium mb-2">Upload Failed</p>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <Button variant="outline" onClick={resetUpload}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show upload zone
  return (
    <Card>
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors duration-200
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'}
            ${isUploading || !isAuthReady ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />

          {!isAuthReady ? (
            <div className="space-y-4">
              <Loader2 className="h-12 w-12 mx-auto text-slate-400 animate-spin" />
              <p className="font-medium text-slate-500">Initializing...</p>
              <p className="text-sm text-slate-400">Please wait while we set up your session</p>
            </div>
          ) : isUploading ? (
            <div className="space-y-4">
              <Loader2 className="h-12 w-12 mx-auto text-blue-500 animate-spin" />
              <p className="font-medium text-slate-700">Uploading...</p>
              <div className="max-w-xs mx-auto bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-slate-500">{uploadProgress}%</p>
            </div>
          ) : (
            <div className="space-y-4">
              {isDragActive ? (
                <Upload className="h-12 w-12 mx-auto text-blue-500" />
              ) : (
                <FileSpreadsheet className="h-12 w-12 mx-auto text-slate-400" />
              )}
              <div>
                <p className="font-medium text-slate-700">
                  Upload Google Ads Reports
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {isDragActive
                    ? 'Drop the files here...'
                    : 'Drag and drop CSV files, or click to select'}
                </p>
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <p>We'll automatically detect and import:</p>
                <p>Search terms, Keywords, Auction insights, Campaigns, Devices, Trends</p>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
          <p className="font-medium mb-1">How to export from Google Ads:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Go to Google Ads &rarr; Overview tab</li>
            <li>Click "Download" icon in the top right</li>
            <li>Select all reports and download</li>
            <li>Upload all files here - we'll handle the rest!</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
