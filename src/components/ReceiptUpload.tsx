import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2, FileText } from 'lucide-react';
import { supabase, getCurrentWorkspace, getCurrentUser } from '../lib/supabase';

// Define types directly since database.types doesn't have documents table yet
type DocumentStatus = 'uploaded' | 'processing' | 'processed' | 'error';
type DocumentType = 'receipt' | 'invoice' | 'statement' | 'other';

interface UploadedFile {
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'processing' | 'success' | 'error';
  error?: string;
  documentId?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg', 
  'image/jpg', 
  'image/png', 
  'image/gif', 
  'image/webp',
  'application/pdf'  // Added PDF support
];
const N8N_WEBHOOK_URL = 'https://primary-production-6ccfb.up.railway.app/webhook/receipt-ocr-supabase';

export const ReceiptUpload: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate SHA256 hash for duplicate detection
  const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Validate file
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: 'Invalid file type. Please upload an image (JPEG, PNG, GIF, WebP) or PDF.' };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: 'File too large. Maximum size is 10MB.' };
    }
    return { valid: true };
  };

  // Handle file selection
  const handleFiles = useCallback(async (fileList: FileList) => {
    const newFiles: UploadedFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const validation = validateFile(file);
      
      if (!validation.valid) {
        newFiles.push({
          file,
          preview: '',
          status: 'error',
          error: validation.error
        });
      } else {
        const preview = URL.createObjectURL(file);
        newFiles.push({
          file,
          preview,
          status: 'pending'
        });
      }
    }

    setFiles(prev => [...prev, ...newFiles]);

    // Auto-upload valid files
    for (const uploadedFile of newFiles) {
      if (uploadedFile.status === 'pending') {
        await uploadFile(uploadedFile);
      }
    }
  }, []);

  // Upload file to Supabase
  const uploadFile = async (uploadedFile: UploadedFile) => {
    const fileIndex = files.findIndex(f => f.file === uploadedFile.file);
    
    // Update status to uploading
    setFiles(prev => {
      const updated = [...prev];
      if (fileIndex !== -1) {
        updated[fileIndex] = { ...updated[fileIndex], status: 'uploading' };
      }
      return updated;
    });

    try {
      // Get workspace and user
      const [workspace, user] = await Promise.all([
        getCurrentWorkspace(),
        getCurrentUser()
      ]);

      if (!workspace || !user) {
        throw new Error('Unable to get workspace or user information');
      }

      // Calculate file hash for duplicate detection
      const fileHash = await calculateFileHash(uploadedFile.file);

      // Type workspace properly
      const workspaceId = (workspace as any)?.id;
      if (!workspaceId) {
        throw new Error('Workspace ID not found');
      }
      
      // Check for duplicate - Toggle this for testing
      const ENABLE_DUPLICATE_CHECK = false; // Set to false to allow duplicate uploads
      
      if (ENABLE_DUPLICATE_CHECK) {
        const { data: existingDoc } = await supabase
          .from('documents')
          .select('id, filename')
          .eq('workspace_id', workspaceId)
          .eq('sha256_hash', fileHash)
          .eq('document_type', 'receipt')
          .single();

        if (existingDoc) {
          throw new Error(`Duplicate receipt: ${(existingDoc as any).filename} already uploaded`);
        }
      } else {
        console.log('⚠️ Duplicate checking disabled - same file can be uploaded multiple times');
      }

      // Generate unique filename
      const timestamp = Date.now();
      const fileExt = uploadedFile.file.name.split('.').pop();
      const fileName = `${workspaceId}/${timestamp}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from('receipts')
        .upload(fileName, uploadedFile.file, {
          contentType: uploadedFile.file.type,
          upsert: false
        });

      if (storageError) {
        // If bucket doesn't exist, create it and retry
        if (storageError.message.includes('bucket')) {
          console.log('Creating receipts bucket...');
          // Note: Bucket creation needs to be done via Supabase dashboard or admin API
          throw new Error('Receipts storage bucket not configured. Please contact support.');
        }
        throw storageError;
      }

      // Get user profile for created_by
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!profile) {
        throw new Error('User profile not found');
      }

      const profileId = (profile as any)?.id;
      if (!profileId) {
        throw new Error('Profile ID not found');
      }

      // Create document record
      const { data: document, error: dbError } = await supabase
        .from('documents')
        .insert({
          workspace_id: workspaceId,
          filename: uploadedFile.file.name,
          file_size: uploadedFile.file.size,
          mime_type: uploadedFile.file.type,
          document_type: 'receipt' as DocumentType,
          storage_path: storageData.path,
          storage_bucket: 'receipts',
          sha256_hash: fileHash,
          processing_status: 'uploaded' as DocumentStatus,
          metadata: {
            original_name: uploadedFile.file.name,
            upload_timestamp: new Date().toISOString(),
            upload_source: 'web_ui'
          },
          created_by: profileId,
          updated_by: profileId
        } as any)
        .select()
        .single();

      if (dbError) {
        throw dbError;
      }

      const documentId = (document as any)?.id;
      if (!documentId) {
        console.error('Document created but no ID returned');
      }

      // Update status to processing
      setFiles(prev => {
        const updated = [...prev];
        const index = updated.findIndex(f => f.file === uploadedFile.file);
        if (index !== -1) {
          updated[index] = { 
            ...updated[index], 
            status: 'processing',
            documentId: documentId
          };
        }
        return updated;
      });

      // Trigger n8n webhook for OCR processing with security data
      if (documentId) {
        const webhookPayload = {
          // CRITICAL SECURITY DATA
          supabase_user_id: user.id,
          workspace_id: workspaceId,
          source: 'clear-piggy-dashboard',
          user_email: user.email || '',
          timestamp: new Date().toISOString(),
          
          // Document data
          document_id: documentId,
          storage_path: storageData.path,
          storage_bucket: 'receipts',
          filename: uploadedFile.file.name,
          mime_type: uploadedFile.file.type,
          supabase_url: process.env.REACT_APP_SUPABASE_URL
        };
        
        console.log('Sending webhook with workspace security:', {
          workspace_id: workspaceId,
          user_id: user.id
        });
        
        const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload)
        });

        if (!webhookResponse.ok) {
          console.error('Webhook failed:', await webhookResponse.text());
          // Don't throw - OCR can be retried later
        }
      }

      // Update status to success
      setFiles(prev => {
        const updated = [...prev];
        const index = updated.findIndex(f => f.file === uploadedFile.file);
        if (index !== -1) {
          updated[index] = { ...updated[index], status: 'success' };
        }
        return updated;
      });

      // Set up real-time listener for processing updates
      if (documentId) {
        const channel = supabase
          .channel(`document-${documentId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'documents',
              filter: `id=eq.${documentId}`
            },
            (payload) => {
              console.log('Document updated:', payload);
              // You can update UI here based on processing status
            }
          )
          .subscribe();

        // Cleanup listener after 5 minutes
        setTimeout(() => {
          channel.unsubscribe();
        }, 5 * 60 * 1000);
      }

    } catch (error) {
      console.error('Upload error:', error);
      setFiles(prev => {
        const updated = [...prev];
        const index = updated.findIndex(f => f.file === uploadedFile.file);
        if (index !== -1) {
          updated[index] = { 
            ...updated[index], 
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed'
          };
        }
        return updated;
      });
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const updated = [...prev];
      // Clean up preview URL
      if (updated[index].preview) {
        URL.revokeObjectURL(updated[index].preview);
      }
      updated.splice(index, 1);
      return updated;
    });
  };

  const clearAll = () => {
    files.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setFiles([]);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Upload Receipts
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Drag and drop receipt images or PDFs, or click to browse. Files will be automatically processed with OCR.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 ${
          isDragging
            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileInputChange}
        />

        <div className="flex flex-col items-center justify-center text-center cursor-pointer">
          <div className="mb-4 p-4 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50">
            <Upload className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {isDragging ? 'Drop receipts here' : 'Click or drag receipts to upload'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Supports JPEG, PNG, GIF, WebP, and PDF up to 10MB
          </p>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Uploaded Files ({files.length})
            </h3>
            <button
              onClick={clearAll}
              className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              Clear All
            </button>
          </div>

          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center space-x-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
            >
              {/* Preview */}
              <div className="flex-shrink-0">
                {file.preview ? (
                  <img
                    src={file.preview}
                    alt={file.file.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {file.file.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(file.file.size / 1024).toFixed(1)} KB
                </p>
                {file.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {file.error}
                  </p>
                )}
              </div>

              {/* Status */}
              <div className="flex-shrink-0">
                {file.status === 'pending' && (
                  <div className="text-gray-400">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                )}
                {file.status === 'uploading' && (
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                )}
                {file.status === 'processing' && (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
                    <span className="text-xs text-green-600">OCR Processing</span>
                  </div>
                )}
                {file.status === 'success' && (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                )}
                {file.status === 'error' && (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
              </div>

              {/* Remove Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                className="flex-shrink-0 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};