# Invention Disclosure Document

## INVENTION-001: Autonomous AI Diagnostics Agent for Computational Fluid Dynamics Simulations

**Filing Status:** PROVISIONAL — DRAFT  
**Priority Date Target:** [INSERT DATE]  
**Inventor(s):** [INSERT NAMES]  
**Assignee:** FlowForge Inc.  
**Document Version:** 1.0  
**Generated:** 2026-03-07  

---

## 1. TITLE OF INVENTION

**Computer-Implemented Method and System for Autonomous Diagnosis and Remediation of Computational Fluid Dynamics Simulation Failures Using a Stateful Multi-Phase AI Agent with Persistent Memory and Machine Learning Enrichment**

---

## 2. FIELD OF THE INVENTION

The present invention relates to computational fluid dynamics (CFD) simulation software, and more particularly to an artificial intelligence agent system that autonomously classifies user-reported simulation issues, performs multi-check diagnostic analysis, generates ordered resolution plans, executes remediation actions, and learns from interaction outcomes via a persistent memory store.

---

## 3. BACKGROUND AND PRIOR ART

### 3.1 State of the Art

Existing CFD simulation platforms (Ansys Fluent, SimScale, OpenFOAM) provide:
- Static troubleshooting documentation
- Manual parameter adjustment interfaces
- Post-hoc residual plot visualization

**Deficiencies in the prior art:**
1. No autonomous, context-aware diagnosis — engineers must manually inspect residual plots, mesh statistics, and boundary conditions to identify root causes
2. No integrated resolution planning — fixes are applied one-at-a-time without ordered action sequences
3. No learning from past interactions — each troubleshooting session starts from zero
4. No cross-domain diagnostic correlation — mesh quality issues, convergence problems, and boundary misconfigurations are diagnosed in isolation
5. No real-time early termination with AI-guided recovery — simulations diverge for hours before manual intervention

### 3.2 Unmet Need

Engineers spend 40-60% of CFD project time debugging convergence failures, mesh quality issues, and boundary condition errors. A system that autonomously diagnoses, plans, and executes remediation — while learning from outcomes — would significantly reduce engineering cycle time.

---

## 4. SUMMARY OF THE INVENTION

The invention comprises a **five-phase autonomous AI agent** for CFD simulation diagnostics:

```
Phase 1: Intent Classification
Phase 2: Multi-Check Diagnostics
Phase 3: Resolution Planning
Phase 4: Plan Execution (with approval gating)
Phase 5: Learning & Memory Persistence
```

The agent operates within a **stateful session context** that includes simulation configuration, user tier, conversation history, and compute usage metadata. A **persistent memory store** enables cross-session learning and similar-issue retrieval.

---

## 5. DETAILED DESCRIPTION

### 5.1 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CFD AI AGENT SYSTEM                       │
│                                                             │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │  Intent   │──▶│  Diagnostic  │──▶│   Resolution     │    │
│  │Classifier │   │    Engine    │   │    Planner       │    │
│  └──────────┘   └──────────────┘   └──────────────────┘    │
│       │               │                    │                │
│       ▼               ▼                    ▼                │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │ Knowledge │   │  Convergence │   │  Plan Executor   │    │
│  │   Base    │   │   Engine     │   │  (Approval-Gated)│    │
│  └──────────┘   └──────────────┘   └──────────────────┘    │
│                        │                    │                │
│                        ▼                    ▼                │
│                 ┌──────────────┐   ┌──────────────────┐    │
│                 │   Residual   │   │   Learning &     │    │
│                 │   Monitor    │   │   Memory Store   │    │
│                 │(Real-time)   │   │  (TTL + Tags)    │    │
│                 └──────────────┘   └──────────────────┘    │
│                        │                    │                │
│                        ▼                    ▼                │
│                 ┌──────────────┐   ┌──────────────────┐    │
│                 │  ML Surrogate│   │  Inference Client │    │
│                 │  Enrichment  │   │  (Predictions)    │    │
│                 └──────────────┘   └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Phase 1 — Intent Classification

**Novel aspect:** Multi-word keyword scoring with weighted confidence, entity extraction (simulation IDs, parameters, error codes, metrics), and sub-category derivation.

The system maintains a **knowledge base** of pattern objects, each comprising:
- `intent`: An enumerated intent category (13 categories defined)
- `keywords`: Weighted keyword array (multi-word keywords score higher)
- `diagnosticChecks`: Ordered list of diagnostic checks to perform
- `commonActions`: Applicable remediation action types

**Intent Categories (exhaustive):**

| Category | Description |
|----------|-------------|
| `ConvergenceIssue` | Divergence, residual stagnation, oscillation |
| `MeshQuality` | Cell skewness, aspect ratio, y+ violations |
| `BoundaryMisconfiguration` | Inlet/outlet/wall condition errors |
| `NonPhysicalResults` | Negative pressures, unrealistic velocities |
| `PerformanceInterpretation` | Fan curves, pressure rise analysis |
| `BillingDispute` | Compute cost inquiries |
| `ComputeOverrun` | CPU/GPU quota exceedance |
| `ContaminationDiagnostic` | Cleanroom particle transport issues |
| `ExhaustSystemDiagnostic` | Fume hood capture velocity, backflow |
| `DataCenterDiagnostic` | Rack hotspots, containment leaks, PUE |
| `ComplianceDiagnostic` | Regulatory standard violations |
| `GeneralQuestion` | General CFD inquiries |
| `SimulationSetup` | Configuration assistance |

**Classification Algorithm:**
```
1. Normalize user input to lowercase
2. For each knowledge pattern:
   a. Score = Σ(keyword matches × word count of keyword)
   b. Multi-word keywords score proportionally higher
3. Select category with highest score
4. Confidence = min(bestScore / totalScores + 0.3, 0.98)
5. If confidence < 0.5, flag requiresClarification = true
6. Extract entities: simulation IDs, numeric parameters, error codes
7. Cache intent in memory store with session-scoped TTL (3600s)
```

**Entity Extraction** operates via regex patterns:
- Simulation IDs: `/sim[-_]?\w{3,}/i`
- Numeric parameters: `/\b\d+\.?\d*\s*(m\/s|pa|rpm|celsius|kelvin|k|%)\b/i`
- Error codes: `/\b(err|error|code)[-_]?\d+\b/i`

### 5.3 Phase 2 — Multi-Check Diagnostics

**Novel aspect:** Parallel execution of domain-specific diagnostic checks with cross-correlation root-cause analysis and ML enrichment.

**Diagnostic Checks (23 unique checks):**

| Check | Domain | Measurement |
|-------|--------|-------------|
| `ResidualTrend` | General | OLS log-slope of residual channels |
| `MeshOrthogonality` | General | Cell orthogonality statistics |
| `MeshSkewness` | General | Cell skewness distribution |
| `YPlusRange` | General | Near-wall resolution quality |
| `CourantNumber` | General | CFL condition compliance |
| `MassBalance` | General | Inlet/outlet mass flow consistency |
| `EnergyBalance` | Thermal | Energy conservation verification |
| `BoundaryConsistency` | General | BC physical consistency |
| `ReferenceValues` | General | Reference parameter validation |
| `TurbulenceRatio` | General | Turbulence model suitability |
| `ParticleResidenceTime` | Cleanroom | Contaminant clearing time |
| `ContaminantDecayRate` | Cleanroom | Particle concentration decay |
| `ISOClassCompliance` | Cleanroom | ISO 14644-1 classification |
| `LaminarCoverage` | Cleanroom | Unidirectional flow area |
| `CaptureVelocity` | Exhaust | Hood face velocity adequacy |
| `BackflowRisk` | Exhaust | Reverse flow detection |
| `SpeciesConcentration` | Exhaust | Contaminant exposure levels |
| `NegativePressure` | Exhaust | Room pressure differential |
| `RackHotspot` | Data Center | Server inlet temperature |
| `ContainmentLeak` | Data Center | Aisle containment integrity |
| `PUEDeviation` | Data Center | Power usage effectiveness |
| `CoolingCapacity` | Data Center | CRAC/CRAH adequacy |
| `ComplianceViolation` | Compliance | Regulatory standard breach |
| `RiskScoreThreshold` | Compliance | Cumulative risk assessment |
| `AuditReadiness` | Compliance | Documentation completeness |

**Root Cause Identification:**
```
1. Collect diagnostic results (pass/fail, severity, values)
2. Compute overall severity = max(individual severities)
3. Cross-correlate failed checks to identify root causes
4. Assign probability to each root cause (0-1)
5. Generate suggested fix per root cause
6. Cache report in memory store (TTL: 7200s)
```

**ML Enrichment (Novel):**
```
1. Submit feature vector to surrogate model inference client
2. Retrieve convergence risk prediction (label + confidence)
3. Retrieve efficiency prediction (label + confidence)
4. Append ML predictions to diagnostic summary
5. ML insights inform resolution plan confidence scoring
```

### 5.4 Phase 2a — Convergence Diagnostic Engine

**Novel aspect:** Statistical trend classification using ordinary least-squares regression on log-transformed residual channels with configurable thresholds and multi-channel root-cause heuristics.

**Algorithm:**
```
INPUT: residuals[], meshStats, relaxationFactors, turbulenceModel

1. Compute trend window = max(20, length × 0.25)
2. Extract tail = residuals[-window:]
3. For each channel (continuity, xMom, yMom, zMom, energy, k, ε/ω):
   a. Compute logSlope via OLS on log10(values)
   b. Compute oscillationAmplitude = max(log) - min(log) over last 50 samples
4. Classify:
   a. If maxSlope > 0.01 → DIVERGENCE (confidence = min(0.5 + slope×10, 0.98))
   b. If maxAmplitude > 0.5 → OSCILLATION (confidence = min(0.4 + amp×0.4, 0.95))
   c. If |avgSlope| < 0.002 → STAGNATION (confidence = 0.85 if level > 1e-4)
5. Root-cause heuristics (switch on issueType):
   - DIVERGENCE:
     • Check mesh quality (skewness > 0.85, orthogonality < 0.5, AR > 100)
     • Check relaxation factors (pressure > 0.35, velocity > 0.8)
     • Identify fastest-growing channel
     • Generate ordered fix list with computed parameter values
   - OSCILLATION:
     • Identify worst-oscillating channel
     • Distinguish pressure-velocity coupling vs turbulence oscillation
     • Recommend model switch if k-ε oscillates in adverse pressure gradients
   - STAGNATION:
     • Check if mesh quality limits convergence
     • Check y+ consistency with wall treatment approach
     • Recommend mesh refinement or solver parameter adjustment
```

### 5.5 Phase 2b — Real-Time Residual Monitor

**Novel aspect:** Streaming residual analysis with consecutive-window divergence confirmation and automatic early termination via event bus.

**Architecture:**
```
ResidualSnapshot stream → Rolling Window Analysis → Trend Classification
                                                          │
                              ┌────────────────────────────┤
                              ▼                            ▼
                      Divergence Counter          Listener Callbacks
                              │                  (onAnalysis, onDivergence,
                              ▼                   onOscillation, onPlateau)
                     If count ≥ 3 consecutive:
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            Emit Event:          Generate AI-Guided
        "simulation.             Recovery Fixes
         early_termination"
```

**Key Innovation: Consecutive Confirmation**
- Single diverging window does NOT trigger termination
- System requires N consecutive diverging windows (default: 3)
- Prevents false positives from transient numerical spikes
- Each window analyzed independently on 4+ channels

**AI-Guided Recovery Fixes:**
- Worst-channel identification determines fix category
- Continuity divergence → pressure relaxation reduction
- Momentum divergence → velocity relaxation reduction
- High slope (>0.1) → first-order upwind stabilization recommendation
- High current level (>1e3) → potential flow initialization recommendation

### 5.6 Phase 3 — Resolution Planning

**Novel aspect:** Ordered, confidence-scored action plans with historical similarity lookup and approval gating.

```
1. Query memory store for similar resolved issues (same intent category)
2. Generate ordered action list from knowledge base patterns
3. Assign each action:
   - Unique ID
   - Type (from 22 action types)
   - Parameters (computed from diagnostic report)
   - Estimated impact description
   - Reversibility flag
   - Approval requirement flag
   - Execution order
4. Compute plan confidence:
   - Base: intent confidence
   - Boost: +0.1 if diagnostic report available
   - Boost: +0.05 if historical similar issues found
   - Cap: 0.95
5. Generate natural-language explanation
6. Estimate resolution time
7. Cache plan in memory store (TTL: 86400s)
```

**Action Types (22 unique):**

| Action | Requires Approval | Reversible |
|--------|:-:|:-:|
| AdjustMesh | Yes | Yes |
| ModifyBoundaryCondition | Yes | Yes |
| ChangeTurbulenceModel | Yes | Yes |
| AdjustRelaxationFactors | No | Yes |
| ReduceTimeStep | No | Yes |
| RefineBladeTip | Yes | Yes |
| ProvideExplanation | No | N/A |
| EscalateToSupport | No | N/A |
| ApplyCredit | Yes | No |
| SetComputeLimit | No | Yes |
| RestartSolver | No | No |
| AdjustParticleTransport | Yes | Yes |
| RefineCleanroomMesh | Yes | Yes |
| AdjustExhaustFlow | Yes | Yes |
| OptimizeHoodDesign | Yes | Yes |
| AddBackdraftDamper | Yes | Yes |
| OptimizeContainment | Yes | Yes |
| AdjustCoolingCapacity | Yes | Yes |
| RebalanceAirflow | Yes | Yes |
| RunComplianceAudit | No | N/A |
| RemediateViolation | Yes | Yes |
| GenerateAuditReport | No | N/A |

### 5.7 Phase 4 — Plan Execution

**Novel aspect:** Sequential, approval-gated execution with side-effect tracking and automatic failure halt.

```
1. Sort actions by execution order
2. For each action:
   a. If requiresApproval: skip (record "awaiting user approval")
   b. Execute action via domain-specific handler
   c. Record: success, output, sideEffects, error, durationMs
   d. If failed: halt execution, set plan status = Failed
3. Set plan status = Completed (if all succeeded) or Failed
4. Generate execution summary
5. Determine if follow-up is required
6. Return PlanExecutionResult with actionResults array
```

### 5.8 Phase 5 — Learning & Memory Persistence

**Novel aspect:** Interaction recording with satisfaction scoring and cross-session similar-issue retrieval.

**Memory Store Interface:**
```typescript
interface MemoryStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  getByTag(tag: string): Promise<MemoryEntry[]>;
  recordInteraction(record: InteractionRecord): Promise<void>;
  getInteractionHistory(userId: string, limit: number): Promise<InteractionRecord[]>;
  getSimilarIssues(intent: AgentIntent, limit: number): Promise<InteractionRecord[]>;
  clear(): Promise<void>;
}
```

**Interaction Record Structure:**
- Session ID, User ID
- Classified intent
- Diagnostic report
- Resolution plan
- Execution result
- User satisfaction score (1-5)
- Whether resolved without escalation
- Total duration (milliseconds)

**Similar Issue Retrieval Algorithm:**
```
1. Filter interactions by: same intent category AND resolvedWithoutEscalation = true
2. Sort by intent confidence (descending)
3. Return top N (configurable, default: 3)
```

### 5.9 Mesh Quality Analyzer (Supporting Component)

**Novel aspect:** Statistical mesh quality analysis with wall-resolution-aware rating and auto-generated remediation suggestions.

**Analysis Algorithm:**
```
INPUT: cellSkewness[], aspectRatios[], yPlusValues[]

1. Count cells exceeding skewness threshold (default: 0.85)
2. Count cells exceeding aspect ratio threshold (default: 20)
3. Compute y+ statistics (min, max, mean, median)
4. Rate wall resolution:
   - Wall-resolved mode: Good if max y+ ≤ 1, Acceptable if mean ≤ 1 & max ≤ 5
   - Wall-function mode: Good if 90%+ cells in [30, 300], Acceptable if 70%+
5. Generate context-specific suggestions:
   - Skewness > 0.95: "Highly degenerate cells — re-mesh with smaller base size"
   - Aspect ratio > 100: "Extreme stretching — reduce BL growth rate"
   - y+ outside range: Specific first-cell-height adjustment guidance
```

---

## 6. CLAIMS (DRAFT)

### Independent Claims

**Claim 1.** A computer-implemented method for autonomous diagnosis and remediation of computational fluid dynamics simulation failures, the method comprising:
- (a) receiving natural language input describing a simulation issue from a user;
- (b) classifying the input into one of a plurality of predefined intent categories using a weighted keyword scoring algorithm that assigns higher scores to multi-word keyword matches;
- (c) extracting named entities including simulation identifiers, numeric parameters, and error codes from the input;
- (d) selecting a set of diagnostic checks from a knowledge base based on the classified intent;
- (e) executing the diagnostic checks against simulation data including residual histories, mesh statistics, and boundary conditions;
- (f) performing root-cause analysis by cross-correlating diagnostic check results;
- (g) generating an ordered resolution plan comprising a sequence of remediation actions with computed parameters, approval gating, and reversibility flags;
- (h) executing the resolution plan with sequential action processing, approval gating for destructive actions, and automatic halt on failure;
- (i) recording the interaction outcome including user satisfaction and escalation status in a persistent memory store; and
- (j) using recorded interactions to improve future diagnostic accuracy through similar-issue retrieval.

**Claim 2.** A computer-implemented method for real-time detection of computational fluid dynamics solver divergence comprising:
- (a) continuously receiving residual snapshot data from a running CFD solver;
- (b) maintaining a rolling window of residual values for a plurality of solver channels;
- (c) computing ordinary least-squares regression slopes on log-transformed residual values for each channel;
- (d) computing peak-to-peak amplitude on log-transformed values for oscillation detection;
- (e) classifying the solver trend as one of: converging, diverging, oscillating, or plateau;
- (f) requiring N consecutive diverging classifications before confirming divergence to prevent false positives;
- (g) upon confirmed divergence, automatically terminating the simulation and emitting an event;
- (h) generating channel-specific remediation suggestions based on which solver channel exhibits the worst divergence slope.

**Claim 3.** A system for autonomous CFD simulation diagnostics comprising:
- a stateful AI agent with persistent memory store supporting TTL-based caching, tag-based retrieval, and interaction history;
- a knowledge base mapping intent categories to diagnostic check sequences and remediation action types;
- a convergence diagnostic engine performing statistical trend analysis on multi-channel residual data;
- a real-time residual monitor with consecutive-window divergence confirmation;
- an ML surrogate model integration layer providing convergence risk and efficiency predictions;
- a resolution planner generating ordered, confidence-scored action plans with approval gating;
- a plan executor with sequential processing, side-effect tracking, and automatic failure halt.

### Dependent Claims

**Claim 4.** The method of Claim 1, wherein the diagnostic checks include domain-specific checks for cleanroom contamination (particle residence time, ISO class compliance, laminar coverage), exhaust systems (capture velocity, backflow risk, species concentration), and data centers (rack hotspots, containment leaks, PUE deviation).

**Claim 5.** The method of Claim 1, wherein the resolution plan confidence is computed based on intent classification confidence, presence of diagnostic data, and availability of historically similar resolved issues.

**Claim 6.** The method of Claim 2, wherein the remediation suggestions are channel-specific: continuity channel divergence triggers pressure relaxation factor reduction, momentum channel divergence triggers velocity relaxation factor reduction, and slopes exceeding 0.1 trigger discretization scheme downgrade recommendations.

**Claim 7.** The system of Claim 3, wherein the memory store implements similar-issue retrieval by filtering recorded interactions by matching intent category and successful resolution status, sorted by classification confidence.

---

## 7. FIGURES (TO BE PREPARED BY PATENT ARTIST)

1. **FIG. 1** — System architecture block diagram (as shown in Section 5.1)
2. **FIG. 2** — Intent classification flowchart (keyword scoring → entity extraction → confidence computation)
3. **FIG. 3** — Convergence diagnostic engine data flow (residual channels → log-slope → classification → root-cause)
4. **FIG. 4** — Real-time residual monitor state machine (feed → analyze → classify → confirm → terminate)
5. **FIG. 5** — Resolution plan execution flowchart (sort → approve → execute → halt-on-failure)
6. **FIG. 6** — Memory store interaction lifecycle (record → retrieve → similarity search)
7. **FIG. 7** — ML enrichment data flow (feature vector → inference client → prediction → report augmentation)

---

## 8. SOURCE CODE REFERENCES

| Component | File | Lines |
|-----------|------|-------|
| Agent Core | `src/modules/cfd/agent/cfd-ai-agent.ts` | 1–693 |
| Agent Types | `src/modules/cfd/agent/types.ts` | 1–241 |
| Memory Store | `src/modules/cfd/agent/memory-store.ts` | 1–98 |
| Convergence Engine | `src/modules/cfd/diagnostics/convergence-engine.ts` | 1–251 |
| Mesh Quality Analyzer | `src/modules/cfd/diagnostics/mesh-quality-analyzer.ts` | 1–197 |
| Residual Monitor | `src/modules/cfd/diagnostics/residual-monitor.ts` | 1–352 |
| Inference Client | `src/modules/cfd/inference/inference-client.ts` | * |

---

## 9. PRIOR ART SEARCH NOTES

**To be completed by patent counsel.** Key areas to search:
- US Patent Class: G06F 30/20 (Design optimisation), G06N 20/00 (Machine learning)
- Keywords: "CFD diagnostics", "solver convergence detection", "simulation troubleshooting agent"
- Known prior art: Ansys Minerva (workflow only, no autonomous diagnosis), SimScale (no AI agent)

---

## 10. CONFIDENTIALITY NOTICE

This document contains proprietary and confidential information of FlowForge Inc. It is intended solely for use in preparing patent applications. Distribution is restricted to authorized patent counsel and named inventors.
