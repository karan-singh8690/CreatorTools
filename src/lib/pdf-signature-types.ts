/**
 * PDF eSignature Types — Enterprise-Grade Digital Signing System
 *
 * Supports: Draw signature, Typed signature, Certificate-based signing,
 * Signature verification, Signature history, Multi-signer workflows,
 * Timestamping, Audit trail, Email signing requests, Legal compliance
 */

// ─── Signature Types ─────────────────────────────────────────────────────────

export type SignatureType = 'drawn' | 'typed' | 'certificate' | 'image'

export type SignatureStatus = 'pending' | 'signed' | 'verified' | 'rejected' | 'expired' | 'revoked'

export type SignaturePosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'top-right'
  | 'top-left'
  | 'top-center'
  | 'center'
  | 'custom'

export type SignatureFont =
  | 'DancingScript'
  | 'GreatVibes'
  | 'Sacramento'
  | 'AlexBrush'
  | 'Helvetica'
  | 'TimesRoman'
  | 'Courier'
  | 'Papyrus'

export type CertificateType = 'self-signed' | 'ca-issued' | 'p12-file'

export type ComplianceStandard = 'ESIGN' | 'UETA' | 'eIDAS' | 'PECB' | 'ISO-32000'

export type TimestampAuthority = 'digiCert' | 'globalsign' | 'sectigo' | 'custom'

export type SigningOrder = 'sequential' | 'parallel' | 'any'

export type AuditEventType =
  | 'document_uploaded'
  | 'signature_requested'
  | 'signature_drawn'
  | 'signature_typed'
  | 'signature_certificate'
  | 'signature_verified'
  | 'signature_rejected'
  | 'signature_revoked'
  | 'document_viewed'
  | 'document_downloaded'
  | 'email_sent'
  | 'timestamp_applied'
  | 'compliance_check'

// ─── Signature Box ────────────────────────────────────────────────────────────

export interface SignatureBox {
  /** X position in points from left */
  x: number
  /** Y position in points from bottom */
  y: number
  /** Width in points */
  width: number
  /** Height in points */
  height: number
  /** Page number (1-indexed) */
  page: number
}

// ─── Drawn Signature ──────────────────────────────────────────────────────────

export interface DrawnSignature {
  /** SVG path data from canvas drawing */
  paths: DrawnPath[]
  /** Stroke color */
  color: string
  /** Stroke width */
  strokeWidth: number
}

export interface DrawnPath {
  points: Array<{ x: number; y: number }>
  timestamp: number
}

// ─── Typed Signature ──────────────────────────────────────────────────────────

export interface TypedSignature {
  text: string
  font: SignatureFont
  fontSize: number
  color: string
  italic: boolean
  bold: boolean
}

// ─── Certificate Info ─────────────────────────────────────────────────────────

export interface CertificateInfo {
  type: CertificateType
  /** Base64-encoded certificate (for self-signed, generated on server) */
  certificateData?: string
  /** Certificate subject */
  subject?: string
  /** Certificate issuer */
  issuer?: string
  /** Serial number */
  serialNumber?: string
  /** Valid from (ISO date string) */
  validFrom?: string
  /** Valid to (ISO date string) */
  validTo?: string
  /** SHA-256 fingerprint */
  fingerprint?: string
}

// ─── Signer Info ──────────────────────────────────────────────────────────────

export interface SignerInfo {
  /** Unique signer ID */
  id: string
  /** Full name */
  name: string
  /** Email address */
  email: string
  /** Organization */
  organization?: string
  /** Title/Role */
  title?: string
  /** Signature type preference */
  signatureType: SignatureType
  /** Signature box placement */
  signatureBox: SignatureBox
  /** Signature label (e.g., "Approved by", "Signed by") */
  label?: string
  /** Status */
  status: SignatureStatus
  /** Signed timestamp (ISO string) */
  signedAt?: string
  /** IP address at signing */
  ipAddress?: string
  /** Drawn signature data */
  drawnSignature?: DrawnSignature
  /** Typed signature data */
  typedSignature?: TypedSignature
  /** Certificate info */
  certificate?: CertificateInfo
  /** Reason for signing */
  reason?: string
  /** Location of signing */
  location?: string
  /** Order in sequential signing (0 = no order) */
  order: number
}

// ─── Multi-Signer Workflow ────────────────────────────────────────────────────

export interface SigningWorkflow {
  /** Unique workflow ID */
  id: string
  /** Signing order strategy */
  signingOrder: SigningOrder
  /** All signers in the workflow */
  signers: SignerInfo[]
  /** Current signer index (for sequential) */
  currentSignerIndex: number
  /** Whether the workflow is complete */
  isComplete: boolean
  /** Deadline for signing (ISO date string) */
  deadline?: string
  /** Reminder frequency in hours */
  reminderFrequency?: number
}

// ─── Email Signing Request ────────────────────────────────────────────────────

export interface EmailSigningRequest {
  /** Request ID */
  id: string
  /** Document ID */
  documentId: string
  /** Document name */
  documentName: string
  /** Recipient email */
  recipientEmail: string
  /** Recipient name */
  recipientName: string
  /** Sender name */
  senderName: string
  /** Message to recipient */
  message?: string
  /** Request status */
  status: 'sent' | 'delivered' | 'opened' | 'signed' | 'expired' | 'bounced'
  /** Sent timestamp */
  sentAt?: string
  /** Expiry timestamp */
  expiresAt?: string
  /** Access token for signing */
  accessToken?: string
}

// ─── Audit Event ──────────────────────────────────────────────────────────────

export interface AuditEvent {
  /** Event ID */
  id: string
  /** Timestamp */
  timestamp: string
  /** Event type */
  type: AuditEventType
  /** Actor (signer ID or system) */
  actor: string
  /** Actor name */
  actorName: string
  /** Description */
  description: string
  /** IP address */
  ipAddress?: string
  /** User agent */
  userAgent?: string
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

// ─── Signature Verification ───────────────────────────────────────────────────

export interface SignatureVerification {
  /** Whether the signature is valid */
  isValid: boolean
  /** Signer information */
  signer: {
    name: string
    email?: string
    organization?: string
  }
  /** Signature type */
  type: SignatureType
  /** When the signature was applied */
  signedAt?: string
  /** Certificate details */
  certificate?: CertificateInfo
  /** Whether the document was modified after signing */
  documentModified: boolean
  /** Timestamp authority verification */
  timestampValid?: boolean
  /** Compliance checks */
  compliance: ComplianceCheck[]
  /** Trust level */
  trustLevel: 'none' | 'basic' | 'enhanced' | 'qualified'
  /** Verification warnings */
  warnings: string[]
  /** Verification errors */
  errors: string[]
}

// ─── Compliance Check ─────────────────────────────────────────────────────────

export interface ComplianceCheck {
  standard: ComplianceStandard
  passed: boolean
  requirements: Array<{
    name: string
    description: string
    passed: boolean
    details?: string
  }>
}

// ─── Timestamp Info ───────────────────────────────────────────────────────────

export interface TimestampInfo {
  authority: TimestampAuthority
  authorityUrl?: string
  timestampToken?: string
  timestampDate?: string
  verified: boolean
  hashAlgorithm: string
}

// ─── Main Options ─────────────────────────────────────────────────────────────

export interface SignatureOptions {
  /** Signature type */
  type: SignatureType

  // ── Drawn Signature ──
  drawnSignature?: DrawnSignature

  // ── Typed Signature ──
  typedSignature?: TypedSignature

  // ── Certificate-Based ──
  certificate?: CertificateInfo

  // ── Image Signature ──
  imageBuffer?: Buffer
  imageMimeType?: 'image/png' | 'image/jpeg'

  // ── Signer Info ──
  signerName: string
  signerEmail?: string
  signerOrganization?: string
  signerTitle?: string
  reason?: string
  location?: string

  // ── Position ──
  position: SignaturePosition
  signatureBox?: SignatureBox
  customX?: number
  customY?: number

  // ── Appearance ──
  showDate: boolean
  showName: boolean
  showReason: boolean
  showLocation: boolean
  showOrganization: boolean
  opacity: number

  // ── Page Range ──
  pageRange: 'all' | 'first' | 'last' | 'custom'
  customPages?: number[]

  // ── Multi-Signer ──
  workflow?: SigningWorkflow

  // ── Timestamp ──
  enableTimestamp: boolean
  timestampAuthority?: TimestampAuthority

  // ── Audit Trail ──
  enableAuditTrail: boolean

  // ── Compliance ──
  complianceStandards: ComplianceStandard[]

  // ── Email Request ──
  emailRequests?: EmailSigningRequest[]
}

// ─── Preview ──────────────────────────────────────────────────────────────────

export interface SignaturePreview {
  totalPages: number
  affectedPages: number
  signatureDimensions: { width: number; height: number }
  signaturePosition: { x: number; y: number }
  estimatedSizeIncrease: number
  existingSignatures: number
  existingSignatureDetails: Array<{
    signer: string
    date: string
    type: string
    valid: boolean
  }>
  warnings: string[]
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface SignatureResult {
  signedBuffer: Buffer
  originalSize: number
  signedSize: number
  sizeIncrease: number
  pagesSigned: number
  totalPages: number
  signatureId: string
  signerId: string
  operations: SignatureOperation[]
  auditEvents: AuditEvent[]
  durationMs: number
}

export interface SignatureOperation {
  type: string
  description: string
  itemsProcessed: number
}

// ─── Batch ────────────────────────────────────────────────────────────────────

export interface BatchSignatureResult {
  results: Array<{
    fileId: string
    fileName: string
    success: boolean
    error?: string
    pagesSigned?: number
    signatureId?: string
  }>
  summary: {
    total: number
    success: number
    errors: number
  }
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface SignatureHistoryEntry {
  id: string
  documentId: string
  documentName: string
  signerName: string
  signerEmail: string
  signatureType: SignatureType
  status: SignatureStatus
  signedAt: string
  reason?: string
  location?: string
  certificateFingerprint?: string
  verified: boolean
}

// ─── Legal Compliance ─────────────────────────────────────────────────────────

export const COMPLIANCE_REQUIREMENTS: Record<ComplianceStandard, Array<{
  name: string
  description: string
}>> = {
  ESIGN: [
    { name: 'Intent to Sign', description: 'Signer must demonstrate clear intent to sign electronically' },
    { name: 'Consent', description: 'All parties must consent to electronic signing' },
    { name: 'Association', description: 'Signature must be associated with the signer and document' },
    { name: 'Record Retention', description: 'Signed documents must be retained and accessible' },
    { name: 'Attribution', description: 'Signature must be attributable to the signing party' },
  ],
  UETA: [
    { name: 'Electronic Signature', description: 'Electronic sound, symbol, or process attached to record' },
    { name: 'Intent', description: 'Executed or adopted with intent to sign' },
    { name: 'Attribution', description: 'Attributable to the person who signed' },
    { name: 'Alteration Detection', description: 'Changes to document after signing must be detectable' },
  ],
  eIDAS: [
    { name: 'Identification', description: 'Signer must be identified' },
    { name: 'Non-Repudiation', description: 'Signature must ensure non-repudiation' },
    { name: 'Integrity', description: 'Document integrity must be assured' },
    { name: 'Qualified Certificate', description: 'Advanced signatures require qualified certificates' },
    { name: 'Timestamp', description: 'Trusted timestamp for when signature was applied' },
  ],
  PECB: [
    { name: 'Audit Logging', description: 'Complete audit trail of all signing activities' },
    { name: 'Access Control', description: 'Role-based access to signing operations' },
    { name: 'Data Protection', description: 'Personal data protection during signing process' },
  ],
  'ISO-32000': [
    { name: 'PDF Signature Dictionary', description: 'Conformant signature dictionary in PDF' },
    { name: 'Byte Range', description: 'Correct byte range specification for signature' },
    { name: 'Certificate Chain', description: 'Valid certificate chain for signature validation' },
    { name: 'Revocation Check', description: 'Certificate revocation status verification' },
  ],
}

// ─── Signature Fonts Library ──────────────────────────────────────────────────

export const SIGNATURE_FONTS: Array<{
  id: SignatureFont
  name: string
  style: 'script' | 'formal' | 'casual'
  preview: string
}> = [
  { id: 'DancingScript', name: 'Dancing Script', style: 'script', preview: 'Your Name' },
  { id: 'GreatVibes', name: 'Great Vibes', style: 'script', preview: 'Your Name' },
  { id: 'Sacramento', name: 'Sacramento', style: 'script', preview: 'Your Name' },
  { id: 'AlexBrush', name: 'Alex Brush', style: 'script', preview: 'Your Name' },
  { id: 'Helvetica', name: 'Helvetica', style: 'formal', preview: 'Your Name' },
  { id: 'TimesRoman', name: 'Times Roman', style: 'formal', preview: 'Your Name' },
  { id: 'Courier', name: 'Courier', style: 'formal', preview: 'Your Name' },
  { id: 'Papyrus', name: 'Papyrus', style: 'casual', preview: 'Your Name' },
]

// ─── Default Options ──────────────────────────────────────────────────────────

export function getDefaultSignatureOptions(type: SignatureType = 'drawn'): SignatureOptions {
  const base: SignatureOptions = {
    type,
    signerName: '',
    position: 'bottom-right',
    showDate: true,
    showName: true,
    showReason: false,
    showLocation: false,
    showOrganization: false,
    opacity: 1.0,
    pageRange: 'all',
    enableTimestamp: true,
    enableAuditTrail: true,
    complianceStandards: ['ESIGN', 'UETA'],
  }

  switch (type) {
    case 'drawn':
      return {
        ...base,
        drawnSignature: {
          paths: [],
          color: '#000000',
          strokeWidth: 2,
        },
      }
    case 'typed':
      return {
        ...base,
        typedSignature: {
          text: '',
          font: 'DancingScript',
          fontSize: 24,
          color: '#000000',
          italic: false,
          bold: false,
        },
      }
    case 'certificate':
      return {
        ...base,
        certificate: {
          type: 'self-signed',
        },
        complianceStandards: ['ESIGN', 'UETA', 'eIDAS'],
      }
    case 'image':
      return {
        ...base,
      }
  }
}
