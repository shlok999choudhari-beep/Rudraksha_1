"""
Risk Scoring and Master Screening Pipeline Module for VeriGuard AI.
"""
from backend.app.risk.scoring import (
    compute_master_risk_score,
    MasterRiskAssessment,
    ScoringLayerBreakdown
)
from backend.app.risk.screener import (
    screen_document_and_identity,
    MasterScreeningReport
)

__all__ = [
    "compute_master_risk_score",
    "MasterRiskAssessment",
    "ScoringLayerBreakdown",
    "screen_document_and_identity",
    "MasterScreeningReport"
]
