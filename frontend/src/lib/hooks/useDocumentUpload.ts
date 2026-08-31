'use client';

import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ACCEPTED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  type DocumentType,
  type UploadedDocument,
} from '@/lib/types/document';
import { uploadDocument } from '@/lib/api/documents';
import { formatBytes } from '@/lib/utils/formatters';
import { useToast } from '@/components/ui/Toast';

/** Client-side gate, so an obviously wrong file never reaches the network. */
export function validateFile(file: File): string | null {
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`;
  }
  const accepted = ACCEPTED_MIME_TYPES as readonly string[];
  if (file.type && !accepted.includes(file.type)) {
    return 'Use a JPEG, PNG, WebP or PDF scan of the data page.';
  }
  return null;
}

export interface UseDocumentUploadResult {
  document: UploadedDocument | null;
  uploading: boolean;
  error: string | null;
  upload: (file: File, documentType: DocumentType) => Promise<UploadedDocument | null>;
  clear: () => void;
}

export function useDocumentUpload(): UseDocumentUploadResult {
  const toast = useToast();
  const [document, setDocument] = useState<UploadedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: { file: File; documentType: DocumentType }) => uploadDocument(input),
  });

  const upload = useCallback(
    async (file: File, documentType: DocumentType) => {
      const rejection = validateFile(file);
      if (rejection) {
        setError(rejection);
        return null;
      }

      setError(null);
      try {
        const result = await mutation.mutateAsync({ file, documentType });
        setDocument(result);

        // Surfaced immediately: a POOR capture wastes the whole run, and the
        // officer should re-take before the analysis rather than after.
        if (!result.quality.isAcceptable) {
          toast.push({
            tone: 'warning',
            title: 'Capture quality is below the threshold',
            description: 'Review the quality checks and re-capture before continuing.',
          });
        }
        return result;
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : 'The document could not be uploaded.';
        setError(message);
        return null;
      }
    },
    [mutation, toast],
  );

  const clear = useCallback(() => {
    setDocument(null);
    setError(null);
  }, []);

  return { document, uploading: mutation.isPending, error, upload, clear };
}
