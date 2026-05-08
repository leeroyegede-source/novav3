import { useState } from 'react';

export function useDockerRunner() {
  const [isDockerLoading, setIsDockerLoading] = useState(false);
  const [dockerPreviewUrl, setDockerPreviewUrl] = useState<string | null>(null);
  const [dockerError, setDockerError] = useState<string | null>(null);

  const runInDocker = async (projectId: string, files: any) => {
    setIsDockerLoading(true);
    setDockerError(null);
    setDockerPreviewUrl(null);

    try {
      const res = await fetch('/api/runner/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, files }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.error || 'Failed to start Docker Runner';
        const logsMsg = data.logs ? `\n\nLogs:\n${data.logs}` : '';
        throw new Error(`${errorMsg}${logsMsg}`);
      }

      setDockerPreviewUrl(data.previewUrl);
    } catch (err: any) {
      setDockerError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsDockerLoading(false);
    }
  };

  const closeDockerPreview = () => {
    setDockerPreviewUrl(null);
    setDockerError(null);
  };

  const clearDockerError = () => setDockerError(null);

  return {
    isDockerLoading,
    dockerPreviewUrl,
    dockerError,
    runInDocker,
    closeDockerPreview,
    clearDockerError
  };
}
