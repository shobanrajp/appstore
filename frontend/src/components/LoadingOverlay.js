import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingOverlay({ isLoading, message = "Processing payment..." }) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-200">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-600" />
        <p className="text-sm font-medium text-gray-700">{message}</p>
        <p className="text-xs text-muted-foreground text-center max-w-[200px]">
           Please do not close this window or press back button.
        </p>
      </div>
    </div>
  );
}
