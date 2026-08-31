export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type ScreeningDecision = 'APPROVED_FOR_CLEARANCE' | 'SECONDARY_INSPECTION_REQUIRED' | 'RECAPTURE_REQUESTED';

export interface LayerScore {
  trust_score: number;
  risk_level: RiskLevel;
}

export interface RiskAssessment {
  overall_trust_score: number;
  overall_risk_level: RiskLevel;
  screening_decision: ScreeningDecision;
  document_integrity_layer: LayerScore;
  data_consistency_layer: LayerScore;
  forensic_tampering_layer: LayerScore;
  biometric_identity_layer: LayerScore;
  critical_violations: string[];
  warning_flags: string[];
  recommendation: string;
}

export interface FieldComparison {
  field_name: string;
  viz_value: string;
  mrz_value: string;
  match: boolean;
  similarity_score: number;
}

export interface CrossValidationReport {
  is_consistent: boolean;
  field_comparisons: FieldComparison[];
}

export interface ChecksumBreakdown {
  field_name: string;
  valid: boolean;
}

export interface MrzParsedResult {
  document_number: string;
  surname: string;
  given_names: string;
  is_valid: boolean;
  checksum_breakdown: ChecksumBreakdown[];
}

export interface ScreeningResponse {
  screening_id: string;
  risk_assessment: RiskAssessment;
  normalized_document_base64: string;
  annotated_evidence_base64: string;
  ela_heatmap_base64: string;
  noise_heatmap_base64: string;
  doc_face_crop_base64: string;
  live_face_crop_base64: string;
  cross_validation_report: CrossValidationReport;
  mrz_parsed_result: MrzParsedResult;
}
