VERIGUARD AI
Product Requirements Document
AI-Assisted Identity & Document Integrity Screening System
Field
Value
Problem Statement ID
26188
Problem Statement
AI-Based Fake Identity & Document Screening System
Product Name
VeriGuard AI
Document Type
Product Requirements Document (PRD)
Target Context
Smart India Hackathon / Student Prototype
Primary Users
Border/security officers, supervisors, auditors
Document Status
Product definition + implementation blueprint
Version
1.0
Executive Summary
VeriGuard AI is an AI-assisted screening and decision-support platform for identity and travel documents. It combines OCR extraction, MRZ validation, deterministic document rules, image-forensic tampering analysis, face verification, liveness checks, duplicate-identity detection, database/watchlist checks, and an explainable risk engine. The system is designed to reduce first-level screening time from minutes to seconds while improving consistency and surfacing evidence that an authorized officer can review.
The product does not make an autonomous border-admission decision and does not claim to prove that a document is genuine or fraudulent. It produces a risk assessment with supporting evidence and routes suspicious cases for secondary human verification.
1. Product Vision
Create a fast, explainable, privacy-conscious screening layer that helps authorized personnel identify suspicious identity documents and identity mismatches before manual secondary inspection.
Vision statement:
“Make identity-document screening faster and more evidence-driven without replacing authorized human judgment.”
2. Problem Definition
Border checkpoints process large volumes of passports, visas, national IDs, permits, and related travel authorizations. Manual inspection can be slow and inconsistent, while basic database lookups may not detect sophisticated visual manipulation, altered text, photo replacement, impersonation, or multiple identities.
Primary pain points:
High passenger/document volume and limited inspection time.
Repeated manual reading and verification of document fields.
Difficulty detecting digitally altered photographs, text, stamps, or dates.
Identity impersonation even when the presented document itself appears valid.
Potential use of multiple identities by the same person.
Fragmented verification signals across OCR, document rules, identity checks, and databases.
Limited explainability when an automated system flags a case.
3. Goals and Objectives
Extract structured identity and travel information from document images.
Cross-check OCR results against MRZ and document-specific rules where applicable.
Detect potential visual tampering and highlight suspicious regions.
Verify that the presented person is consistent with the document photograph.
Add liveness checks to reduce simple photo/video spoofing attempts.
Detect possible duplicate identities using face embeddings and authorized reference data.
Combine independent signals into an explainable screening risk score.
Provide a complete case report and audit trail for officer review.
Reduce first-level screening time to a few seconds on suitable hardware for the prototype.
4. Non-Goals
Autonomous final approval/denial of border entry.
Claiming universal detection of every forged document.
Direct access to classified or government-only watchlists during the student prototype.
Training OCR or face-recognition models from scratch.
Supporting every document type and every country in the first release.
Replacing trained border/security personnel.
5. Target Users and Personas
Persona
Needs
Key Actions
Screening Officer
Fast, clear first-level screening
Upload/scan, review risk, inspect evidence, escalate
Supervisor
Case oversight and consistency
Review high-risk cases, inspect history, monitor trends
Auditor
Traceability and accountability
Review logs, reports, model/rule outcomes
System Administrator
Secure operation
Manage users, roles, configuration, retention
ML/Engineering Team
Model evaluation and maintenance
Manage datasets, thresholds, model versions, metrics
6. Core Product Workflow
DOCUMENT + LIVE FACE        |        vPreprocessing / Quality Check        |        +--> OCR Extraction --------+        |                           |        +--> MRZ Analysis ----------+        |                           |        +--> Tamper Analysis -------+--> Evidence Aggregation        |                           |        +--> Face Verification -----+        |                           |        +--> Liveness --------------+        |                           |        +--> Database/Watchlist ----+                                    |                                    v                              Risk Engine                                    |                                    v                       Explainable Screening Report                                    |                         +----------+----------+                         |          |          |                        LOW       MEDIUM      HIGH                         |          |          |                         +----------+----------+                                    |                                    v                              Officer Review
7. Functional Requirements
7.1 Document Intake & Classification
Allow upload or camera capture of supported document images.
Support passport, visa, national ID, driving license, permit, and configurable future types.
Validate image quality, resolution, blur, glare, and document visibility before analysis.
Crop and perspective-correct the document where necessary.
Assign a document type manually in MVP and optionally classify it automatically in later versions.
7.2 OCR Extraction
Extract text from supported document images using a pretrained OCR engine.
Return field-level confidence scores.
Normalize dates, names, document numbers, nationality codes, and other structured fields.
Store raw OCR text separately from normalized fields.
Allow an officer to view extracted values and confidence.
7.3 MRZ Analysis
Detect and parse MRZ where available.
Validate MRZ check digits and field structure.
Compare MRZ values against OCR-extracted fields.
Flag mismatches as evidence rather than automatically declaring fraud.
7.4 Document Validation
Validate expiry and issue dates.
Validate document-number formats according to configured document/country rules.
Check logical date relationships.
Validate visa stay/entry dates where applicable.
Allow country/document rule sets to be configured independently of the AI models.
7.5 Tampering Detection
Analyze suspicious image regions for possible local manipulation.
Support photo replacement detection as a dedicated signal.
Analyze text regions for visual inconsistencies.
Analyze metadata where metadata is available.
Use forensic signals such as compression/noise/edge inconsistencies as supporting evidence.
Return tampering probability, category, and suspicious-region coordinates/heatmap when available.
Never treat a single forensic technique as definitive proof of forgery.
7.6 Face Verification
Detect the face in the document photograph.
Capture or accept a live face image/video from the authorized user.
Generate face embeddings using a pretrained recognition model.
Calculate a calibrated similarity score.
Return match/non-match plus confidence and quality indicators.
7.7 Liveness Detection
Perform basic challenge-response liveness in MVP, such as blink or head movement.
Provide a liveness status separate from face similarity.
Support a stronger anti-spoofing model in future versions.
7.8 Duplicate Identity Detection
Compare the submitted face embedding against authorized reference identities.
Surface possible matches to multiple document identities.
Return similarity evidence and candidate identities to authorized personnel.
Treat matches as leads requiring review, not definitive proof of criminal or fraudulent identity.
7.9 Database / Watchlist Integration
Provide an integration abstraction for document/person status checks.
Use a simulated database for the SIH prototype.
Support statuses such as valid, expired, flagged, revoked, and review-required.
Design the connector so an authorized external government service can replace the mock adapter later.
7.10 Risk Engine
Aggregate deterministic rules and AI-derived evidence.
Maintain category-level scores for document validity, tampering, identity, and database checks.
Return LOW, MEDIUM, or HIGH screening risk.
Display the main contributing reasons for the risk score.
Support configurable weights and thresholds.
Record model/rule versions used for each screening case.
7.11 Explainable Report
Show extracted identity fields.
Show OCR/MRZ consistency.
Show expiry/validation status.
Show tampering indicators and heatmap where available.
Show face similarity and liveness result.
Show database/watchlist result.
Show final risk level and top contributing evidence.
Provide a recommended next step such as standard review or secondary verification.
7.12 Audit Trail
Record who accessed a case.
Record screening initiation and completion times.
Record model/rule versions and outcomes.
Record officer actions and case status changes.
Protect audit logs from ordinary user modification.
8. Proposed AI/ML Stack
Capability
Recommended Technology
MVP Strategy
OCR
PaddleOCR
Use pretrained model; field parsing with rules/regex
Image processing
OpenCV
Preprocessing, cropping, perspective correction
Face detection/recognition
InsightFace / ArcFace
Pretrained inference
Liveness
Challenge-response + optional anti-spoof model
Simple challenge-response first
Tamper detection
OpenCV forensic features + scikit-learn
Feature-based baseline
Advanced tamper model
PyTorch CNN/ViT
Optional after baseline
Duplicate identity
Cosine similarity + PostgreSQL vector support
Prototype-scale vector search
Inference optimization
ONNX Runtime
Optional after accuracy baseline
9. Synthetic Dataset Strategy
Because real identity documents contain sensitive personal information, the prototype should be built primarily with synthetic documents and deliberately generated tampering cases.
Create synthetic passport/visa/ID templates with fictional identities.
Generate authentic baseline images.
Programmatically alter DOB, names, expiry dates, document numbers, photographs, stamps, and text regions.
Generate multiple compression, blur, rotation, copy-paste, and lighting variations.
Store labels for authentic/tampered and tampering category.
Maintain separate training, validation, and test sets.
10. Suggested Dataset Categories
Category
Examples
Authentic
Untouched synthetic document
Text alteration
Name, DOB, passport number, expiry change
Photo replacement
Replace or overlay document photograph
Stamp alteration
Added, removed, or modified stamp
Copy-paste
Duplicated local image region
Compression manipulation
Region recompression or mixed JPEG quality
Blur/cleanup
Selective blur or sharpening around edits
Metadata alteration
Modified or removed image metadata
11. Risk Scoring Model
Recommended principle: combine multiple evidence sources rather than trusting a single AI prediction.
Signal Category
Example Evidence
Illustrative Weight
Document validity
Expired document, invalid format
0–30
OCR/MRZ consistency
Field mismatch, failed check digit
0–25
Tampering
Photo/text/forensic anomaly
0–35
Identity
Low face similarity
0–30
Liveness
Failed challenge
0–25
Database
Expired/flagged/duplicate identity
0–40
Illustrative thresholds for the prototype: LOW = 0–29, MEDIUM = 30–59, HIGH = 60+. These thresholds must be calibrated on validation data before being presented as performance claims.
12. Example Screening Outcomes
Scenario
Signals
Expected Result
Genuine document
OCR pass, MRZ pass, face match, low tamper
LOW
Expired document
Otherwise valid, expiry failed
MEDIUM/HIGH depending on policy
Changed DOB
OCR/MRZ mismatch + local anomaly
HIGH
Wrong person
Valid document + face mismatch
HIGH
Possible duplicate identity
High face similarity to multiple identities
HIGH / secondary review
13. User Interface Requirements
13.1 Dashboard
Total screened cases.
Low/medium/high case counts.
Recent high-risk cases.
Average processing time.
Trend charts for screening outcomes.
13.2 New Screening
Document upload/capture.
Document type selection or classification.
Live camera capture.
Processing progress.
Clear quality/error messages.
13.3 Screening Result
Prominent risk level and score.
Extracted document fields.
Validation checklist.
Tampering heatmap and evidence.
Face match and liveness results.
Watchlist/database result.
Top reasons for the risk score.
Officer review/escalation action.
14. API Requirements
Method
Endpoint
Purpose
POST
/api/documents/upload
Upload a document
POST
/api/documents/{id}/ocr
Run OCR
POST
/api/documents/{id}/validate
Run document rules
POST
/api/documents/{id}/tamper-analysis
Run forensic analysis
POST
/api/face/verify
Compare document face with live face
POST
/api/face/liveness
Run liveness check
POST
/api/screening/run
Run full screening pipeline
GET
/api/screening/{case_id}
Get screening report
GET
/api/screening/history
List historical cases
GET
/api/dashboard/statistics
Get dashboard metrics
15. Data Model
Table
Key Fields
users
id, name, role, password_hash, status
persons
id, name, DOB, nationality
documents
id, person_id, type, number, issue_date, expiry_date, image_path
document_fields
id, document_id, field_name, value, confidence
screening_cases
id, document_id, face_score, tamper_score, validation_score, risk_score, risk_level
tampering_results
id, document_id, photo_score, text_score, metadata_score, overall_score
watchlist
id, document_number/person_id, reason, severity, status
audit_logs
id, user_id, case_id, action, timestamp
model_versions
id, model_name, version, checksum, deployed_at
16. High-Level System Architecture
React / Next.js Frontend          |       HTTPS/REST          |      FastAPI API          |  +-------+--------+----------------+  |       |        |                | OCR   Validation Face          Tamper  |       |        |                |  +-------+--------+----------------+          |    Evidence Aggregator          |      Risk Engine          |   PostgreSQL / Vector          |  Object Storage (images)          |      Audit Logging
17. Deployment Architecture
MVP deployment:
React frontend.
FastAPI backend.
PostgreSQL database.
Local filesystem or MinIO for prototype image storage.
Docker Compose for repeatable setup.
Scalable future deployment:
Load balancer/API gateway.
Multiple stateless FastAPI instances.
Redis-backed job queue.
Dedicated OCR/AI workers.
PostgreSQL with vector support.
Object storage such as S3-compatible storage.
Centralized monitoring and audit logging.
18. Performance Requirements
Requirement
MVP Target
Upload validation
< 1 sec after upload where feasible
OCR
< 3 sec typical document
Face verification
< 2 sec after face capture
Full screening
Target a few seconds on suitable local hardware
Dashboard load
< 2 sec for normal case volume
Availability
Suitable for demonstration; production target requires formal SLOs
19. Security & Privacy Requirements
Use HTTPS/TLS for network communication.
Hash passwords using a modern password hashing algorithm.
Use role-based access control.
Keep raw images and face embeddings server-side; do not expose embeddings to the frontend.
Encrypt sensitive data at rest where production deployment requires it.
Apply retention and deletion policies to raw document images.
Maintain immutable or protected audit records.
Avoid real personal documents in the training dataset unless legally authorized and appropriately protected.
Log model/rule versions to support reproducibility and investigation.
20. Reliability & Safety Requirements
Never represent an AI score as legal proof of fraud.
Every high-risk result must show evidence and support human review.
Handle OCR uncertainty explicitly instead of silently guessing fields.
If image quality is insufficient, request a new capture.
If an AI service fails, return a clear partial-analysis state rather than a misleading pass.
Keep deterministic validation separate from probabilistic AI scores.
21. Role-Based Access Control
Role
Permissions
Officer
Create screenings, view assigned cases, submit review outcomes
Supervisor
All officer capabilities + review/escalate cases + analytics
Auditor
Read-only case and audit access
Admin
User/configuration/model/rule management
22. Non-Functional Requirements
Modular architecture so OCR, face, tamper, and database adapters can be replaced independently.
API-first backend.
Configurable country/document rule sets.
Reproducible model versions.
Structured logs and error handling.
Unit and integration tests.
Dockerized local setup.
Accessible and understandable officer UI.
23. Testing Strategy
23.1 Functional Testing
Valid and invalid document uploads.
OCR field extraction.
MRZ parsing.
Expiry validation.
Face match and mismatch.
Liveness pass/fail.
Tampering categories.
Risk aggregation.
Audit trail.
23.2 ML Evaluation
Component
Metrics
OCR
Character/field accuracy, confidence calibration
Face verification
FAR, FRR, ROC-AUC, verification accuracy
Tampering
Precision, recall, F1, localization quality where applicable
Risk engine
False-positive rate, false-negative rate, calibration
System
Latency, throughput, failure rate
24. Acceptance Criteria
A supported document can be uploaded and processed end-to-end.
The system extracts the configured core fields and displays confidence.
MRZ information is parsed when present and compared with OCR.
Document expiry and basic structural rules are evaluated.
A tampered test document receives a tampering signal and evidence.
A wrong-person test case receives a face mismatch signal.
The system produces a LOW/MEDIUM/HIGH result with reasons.
A complete case can be retrieved later.
Officer actions are recorded in the audit trail.
No real personal identity data is required for the demonstration.
25. MVP Scope
One or two primary document types, preferably passport + visa.
Synthetic document dataset.
PaddleOCR extraction.
MRZ validation.
Basic deterministic validation.
Basic forensic tamper baseline.
Pretrained face verification.
Basic liveness.
Simulated watchlist/database.
Explainable risk engine.
React dashboard.
FastAPI backend.
PostgreSQL.
26. Future Scope
Additional national and international document formats.
Secure integration with authorized government APIs.
Advanced document-security feature detection.
Improved anti-spoofing.
Federated or privacy-preserving identity verification.
Multilingual and handwriting-aware OCR where relevant.
Offline/edge inference for constrained checkpoints.
Model monitoring and drift detection.
Distributed processing for very high-volume checkpoints.
Advanced case intelligence and network analysis.
27. Development Plan
Phase
Duration
Deliverables
Foundation
Days 1–3
Repo, environments, React, FastAPI, PostgreSQL, Docker
OCR + MRZ
Days 4–7
Extraction and structured fields
Validation
Days 8–10
Rules and consistency checks
Face
Days 11–14
Face verification + liveness
Tampering
Days 15–20
Forensic baseline + dataset
Risk Engine
Days 21–23
Evidence aggregation + explainability
Dashboard
Days 24–27
Officer UI + case history
Testing/Demo
Days 28–30
Test set, metrics, demo scenarios
28. Team Responsibilities
Role
Primary Ownership
AI/ML Engineer
OCR, tamper detection, dataset, evaluation
Computer Vision Engineer
Face verification, liveness, image preprocessing
Backend Engineer
FastAPI, PostgreSQL, risk engine, authentication
Frontend/Integration Engineer
React dashboard, camera/upload UI, integration
29. Recommended SIH Demonstration
The strongest live demo should contain three deliberately prepared scenarios:
Genuine document: OCR/MRZ consistent, face match, low tampering → LOW RISK.
Tampered document: altered DOB/photo → OCR/MRZ inconsistency + tampering evidence → HIGH RISK.
Impersonation: valid document presented by another person → face mismatch → HIGH RISK.
A fourth optional scenario can demonstrate duplicate identity detection by presenting two synthetic identities associated with highly similar face embeddings.
30. Judge Questions & Recommended Answers
Q: Can the system detect every fake passport?
A: No. It is a multi-signal decision-support system. It identifies suspicious evidence and routes cases for human verification rather than claiming perfect authenticity detection.
Q: Do you have real government database access?
A: The prototype uses a simulated secure database behind an integration interface. Authorized government connectors can replace the mock adapter in a production deployment.
Q: Why use AI if rules can validate documents?
A: Rules are excellent for deterministic checks such as expiry and format. AI/computer vision is needed for visual manipulation, face verification, and other probabilistic signals.
Q: Can face recognition be fooled?
A: It can have failure modes, which is why face similarity is combined with liveness, document consistency, and other signals rather than used as the only decision.
Q: What is innovative about the project?
A: The key innovation is multi-signal identity integrity screening with explainable evidence: OCR/MRZ, deterministic rules, image forensics, face/liveness, duplicate identity detection, and risk aggregation in one workflow.
31. Product Differentiators
Explainable rather than black-box risk output.
Cross-validation between OCR and MRZ.
Visual tampering localization rather than only a binary label.
Document-owner verification plus liveness.
Duplicate identity discovery.
Deterministic rules and AI signals kept separate and then combined.
Synthetic privacy-safe dataset generation.
Human-in-the-loop decision workflow.
32. Final Product Positioning
VeriGuard AI should be positioned as an AI-assisted screening and investigation-support platform, not as an autonomous border-control decision maker. The product's value is speed, consistency, evidence aggregation, explainability, and the ability to direct limited human attention toward cases that require deeper inspection.
33. Final Recommended Architecture
                    VERIGUARD AI        Identity & Document Integrity Screening                 React Officer UI                        |                    HTTPS/REST                        |                    FastAPI API                        |       +----------------+----------------+       |                |                |      OCR          Validation          Face   PaddleOCR       Rule Engine       InsightFace       |                |                |       +----------------+----------------+                        |                  MRZ Analysis                        |                 Tamper Analysis                        |                Liveness Analysis                        |              Database / Watchlist                        |                 Evidence Engine                        |                   Risk Engine                        |              Explainable Report                        |              Human Officer Review                        |                  Audit Database
34. Final One-Line Pitch
“VeriGuard AI is an AI-assisted identity screening platform that combines OCR, document forensics, MRZ validation, face verification, liveness detection, duplicate-identity analysis, and database checks to generate an explainable risk assessment for suspicious identity documents.”
35. Implementation Principle
Build a reliable MVP first: OCR + MRZ + validation + face verification + basic tamper detection + risk engine + dashboard. Add advanced deep-learning tamper localization, stronger anti-spoofing, vector identity search, and asynchronous scaling only after the end-to-end workflow is stable and measurable.