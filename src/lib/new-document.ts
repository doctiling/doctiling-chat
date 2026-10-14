import { hasKey } from '../i18n';
import { ApiError, type KnowledgeBaseItem } from './api';

// spec 054: the studio's per-operation cap on files (PRODUCT_LIMITS.uploadFilesPerBatch); the server enforces its own.
export const MAX_FILES_PER_BATCH = 20;

/** What the convert route accepts (the studio's "PDF, DOCX or spreadsheets" family). */
export const CONVERT_ACCEPT = '.pdf,.docx,.pptx,.odt,.odp,.rtf,.epub,.html,.htm,.txt,.md,.markdown,.csv,.xlsx,.xls,.ods';

export type KbRole = KnowledgeBaseItem['role'];

/** Creating and uploading are for administrators and above, as in the studio (the server decides; this only mirrors it). */
export const canCreateDocuments = (role: KbRole | null | undefined) => role === 'owner' || role === 'admin';
/** Indexing an existing document needs edit rights: collaborator and above. */
export const canIndexDocuments = (role: KbRole | null | undefined) => !!role && role !== 'reader';

/** The error code of a failed call, for `newDocument.errors.<code>`. */
export const errorCode = (e: unknown) => (e instanceof ApiError ? e.code : 'unknown');

/** `newDocument.errors.<code>` when the dictionary has it, the generic message otherwise. */
export const errorKey = (code: string) => (hasKey('en', `newDocument.errors.${code}`) ? `newDocument.errors.${code}` : 'newDocument.errors.unknown');
