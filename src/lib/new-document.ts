import { hasKey } from '../i18n';
import { ApiError, type KnowledgeBaseItem } from './api';

// spec 054: the studio's per-operation cap on files (PRODUCT_LIMITS.uploadFilesPerBatch); the server enforces its own.
export const MAX_FILES_PER_BATCH = 20;
// spec 085: the studio's request-body ceiling (limits.transport.max_mb); checked before uploading so a too-large file
// is named with the limit instead of failing on the wire.
export const MAX_UPLOAD_MB = 25;

/** What the convert route accepts (the studio's "PDF, DOCX or spreadsheets" family). */
export const CONVERT_ACCEPT = '.pdf,.docx,.pptx,.odt,.odp,.rtf,.epub,.html,.htm,.txt,.md,.markdown,.csv,.xlsx,.xls,.ods';

export type KbRole = KnowledgeBaseItem['role'];

/** Creating and uploading are for administrators and above, as in the studio (the server decides; this only mirrors it). */
export const canCreateDocuments = (role: KbRole | null | undefined) => role === 'owner' || role === 'admin';
/** Indexing an existing document needs edit rights: collaborator and above. */
export const canIndexDocuments = (role: KbRole | null | undefined) => !!role && role !== 'reader';

/** The error code of a failed call, for `newDocument.errors.<code>`. */
export const errorCode = (e: unknown) =>
  e instanceof ApiError ? e.code : e instanceof TypeError ? 'network' : 'unknown';

/** Spec 085 FR-007: what the server would refuse anyway, said before the upload. */
export function precheckFile(file: File): 'file_too_large' | 'unsupported_type' | null {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return 'file_too_large';
  const ext = `.${(file.name.split('.').pop() || '').toLowerCase()}`;
  return CONVERT_ACCEPT.split(',').includes(ext) ? null : 'unsupported_type';
}

/** `newDocument.errors.<code>` when the dictionary has it, the generic message otherwise. */
export const errorKey = (code: string) => (hasKey('en', `newDocument.errors.${code}`) ? `newDocument.errors.${code}` : 'newDocument.errors.unknown');
