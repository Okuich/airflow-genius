# Trade Secret Redaction Guide

## Purpose

This document identifies specific sections, algorithms, thresholds, and internal parameters across all six invention disclosures that should be **redacted or generalized** before patent filing to preserve trade secret protection. Patent claims should describe the *method* without revealing the *tuning*.

**Principle:** Patent the architecture and method. Keep the specific numbers, weights, and trained parameters as trade secrets.

---

## ID-001: AI Diagnostics Agent

### 🔴 REDACT — Specific Thresholds & Scoring Weights

| Section | Line(s) | Content to Redact | Reason |
|---------|---------|-------------------|--------|
| §5.2 Classification Algorithm | 133–134 | `Confidence = min(bestScore / totalScores + 0.3, 0.98)` and threshold `< 0.5` | The 0.3 boost constant and 0.5 clarification threshold are internal tuning — competitors can't observe these |
| §5.2 Entity Extraction Regexes | 140–142 | Exact regex patterns for sim IDs, parameters, error codes | Implementation detail; describe as "pattern-based entity extraction" in patent |
| §5.4 Convergence Thresholds | 211–213 | `maxSlope > 0.01`, `maxAmplitude > 0.5`, `|avgSlope| < 0.002`, confidence formulas | These numerical thresholds are the result of extensive tuning on real CFD data |
| §5.4 Root-Cause Heuristics | 216–228 | Specific thresholds: `skewness > 0.85`, `orthogonality < 0.5`, `AR > 100`, `pressure > 0.35`, `velocity > 0.8` | Mesh quality thresholds and relaxation factor boundaries are internal know-how |
| §5.5 Consecutive Confirmation | 254 | Default `N = 3` consecutive windows | The specific window count is a tuned parameter |
| §5.5 AI Recovery Fix Thresholds | 262–263 | `slope > 0.1` → upwind, `level > 1e3` → potential flow | Exact trigger points for recovery strategies |
| §5.6 Plan Confidence Formula | 273–276 | `+0.1` diagnostic boost, `+0.05` historical boost, cap `0.95` | Confidence scoring constants |
| §5.9 Mesh Quality Thresholds | 379–384 | Skewness `0.85`, AR `20`, y+ ranges (`≤1`, `[30,300]`, `70%`, `90%`) | Quality analysis boundaries |
| §5.9 Mesh Quality Weights | — | Rating formula weights and percentage thresholds | Internal scoring model |

### 🟡 GENERALIZE — Describe Method Without Specifics

| Section | Recommendation |
|---------|---------------|
| §5.2 Knowledge Base | List intent categories but remove the keyword-to-intent mapping details |
| §5.3 Diagnostic Checks | Keep the 23-check table (user-visible behavior) but remove the root-cause probability computation |
| §5.8 Memory TTLs | Remove specific TTL values (3600s, 7200s, 86400s) — describe as "configurable retention periods" |

---

## ID-002: Compliance Pipeline

### 🔴 REDACT — Risk Scoring Weights & Cost Models

| Section | Line(s) | Content to Redact | Reason |
|---------|---------|-------------------|--------|
| §5.5 Risk Weights | 194 | `RISK_WEIGHT = { Low: 1, Medium: 3, High: 4, Critical: 5 }` | Internal weighting model — competitors can't observe risk scores |
| §5.5 Remediation Costs | 199 | `REMEDIATION_COST = { Low: $500, Medium: $2,500, High: $10,000, Critical: $25,000 }` | Proprietary cost estimation model |
| §5.5 Repeat Violation Multiplier | 212 | `repeatViolationMultiplier = 1.5×` | Internal escalation tuning |
| §5.5 Escalation Multiplier | 215 | `escalationMultiplier = 1.3×` | Internal escalation tuning |
| §5.5 Systemic Surcharge | 224 | `cost × 1.25` for repeat violations | Pricing strategy embedded in code |
| §5.6 Severity Deadlines | 267–270 | `Critical → "immediate"`, `High → "7 days"`, etc. | Remediation timeline model |
| §5.6 Verdict Thresholds | 280–282 | `highRiskCount > 0 OR score ≥ 50` decision boundary | Internal compliance scoring |
| §5.6 SHA-256 Implementation | 250–255 | Canonicalization method and hash computation details | Describe as "cryptographic integrity verification" without revealing the exact canonicalization |

### 🟡 GENERALIZE

| Section | Recommendation |
|---------|---------------|
| §5.5 Risk Category Keywords | Remove keyword-to-category mapping (regulatory, operational, financial, reputational) |
| §5.7 AI Sync Details | Keep the sync architecture but remove the specific Gemini model name and prompt engineering approach |
| §5.2 Rule Structure | Keep the interface but remove the full rule library contents |

---

## ID-003: Surrogate Pipeline

### 🔴 REDACT — Feature Engineering & Model Parameters

| Section | Line(s) | Content to Redact | Reason |
|---------|---------|-------------------|--------|
| §4.1.1 Feature Vector | 124–134 | The exact 23 feature names and their order | Feature engineering is the core competitive advantage — describe as "multi-dimensional feature vector derived from simulation configuration" |
| §4.1.3 Turbulence Intensity Formula | 160 | `I = 0.16 · Re^(-1/8)` | Empirical constant 0.16 is a tuned parameter |
| §4.1.3 Composite MQS Formula | 165–166 | `0.3·(1-skew) + 0.3·ortho + 0.2·(1-AR/100) + 0.2·(1-nonOrtho/100)` | The specific weights (0.3, 0.3, 0.2, 0.2) are proprietary |
| §4.5 Overfit Detection | 240–242 | `trainMSE / testMSE < 0.5` threshold | Overfit detection boundary is tuned know-how |
| §4.6 Retrain Threshold | 249 | `RETRAIN_THRESHOLD = 10` | Business-critical parameter controlling model freshness |
| §4.8 Confidence Estimation | 313 | Mahalanobis-like distance computation details | The specific confidence formula is internal IP |
| §4.4 Normalization | 214–215 | `σ < 1e-12 → σ = 1` guard | Numerical stability detail |

### 🟡 GENERALIZE

| Section | Recommendation |
|---------|---------------|
| §4.2 Label Computation | Keep label types but remove the efficiency rating ordinal mapping (Poor=0...Excellent=3) |
| §4.3 Geometry Clusters | Describe clustering concept but remove specific cluster names ("duct_channel", "heat_exchanger", "server_rack") |
| §4.5 Training Split | Remove specific split ratio (80/20) — describe as "configurable holdout validation" |

---

## ID-004: GPU Scheduling

### 🔴 REDACT — Classification Thresholds & Priority Weights

| Section | Line(s) | Content to Redact | Reason |
|---------|---------|-------------------|--------|
| §4.2 Cell Count Thresholds | 77–80 | `Small: <500K`, `Medium: 500K–2M`, `Large: 2M–10M`, `Massive: >10M` | Classification boundaries are internal tuning |
| §4.2 Resource Allocations | 77–80 | Specific GPU/CPU/Memory per size (e.g., "4 GPU, 32 CPU, 128 GB") | Resource estimation model is proprietary |
| §4.2 Complexity Multipliers Table | 160–165 | `Transient: CPU ×2, Memory ×1.5, Duration ×2`, `Rotating: GPU +1` | Physics multipliers are the core trade secret |
| §4.3 Priority Weight Multipliers | 91–92 | `Low: 1.5×, Normal: 1.0×, High: 0.8×, Critical: 0.5×` | SLA differentiation model |
| §4.3 Priority Rank Values | 99 | `Critical=0, High=1, Normal=2, Low=3` | Internal priority encoding |
| §4.3 Queue Depth | 102 | `default 50` | Capacity planning parameter |
| §4.5 Usage Thresholds | 127–129 | `Free: 5 GPU-hr, Pro: 100 GPU-hr, Enterprise: 1000 GPU-hr` | Pricing strategy — highly sensitive |
| §4.5 Warning Levels | 131–133 | `75% → approaching, 90% → critical, 100% → exceeded` | Enforcement boundary tuning |

### 🟡 GENERALIZE

| Section | Recommendation |
|---------|---------------|
| §4.4 Preemption Algorithm | Keep the method (priority-gated, non-destructive) but remove the iteration order details |
| §4.6 Autoscaling Hooks | Describe hook interface without threshold/cooldown values |

---

## ID-005: Cleanroom Anomaly Detection

### 🔴 REDACT — Anomaly Scoring & ISO Classification Model

| Section | Line(s) | Content to Redact | Reason |
|---------|---------|-------------------|--------|
| §4.3 Z-Score Threshold | 94, 210 | `Default z-score threshold: 2.0` | Statistical detection sensitivity parameter |
| §4.3 Recency Window | 91, 210 | `last 3 samples` check window | Detection window size |
| §4.3 Minimum Samples | 91, 209 | `Minimum 4 samples per zone` | Statistical significance threshold |
| §4.5 Particle Estimation Formula | 137–138 | `(1 - retention) × 10⁷` | The mapping constant (10⁷) is a calibrated parameter |
| §4.5 Laminar Penalties | 142–143 | `< 0.60 → +2`, `< 0.80 → +1` | Penalty model boundaries |
| §4.5 ACR Penalty | 145 | `ACH < 20 → +1 class` | Minimum ACR threshold |
| §4.5 Trend Thresholds | 147–149 | Slope threshold values and trend sample minimum | Trend detection tuning |
| §4.5 Confidence Multipliers | 152–155 | `×0.6` for low samples, `×0.8` for retention volatility, `×0.85` for laminar volatility | Confidence scoring model |
| §4.5 Volatility Threshold | 282 | `CV > 15%` warning threshold | Internal quality gate |
| Subsystem E | 176–178 | Blanking panel coverage %, cable cutout seal fraction, door seal quality metrics | Containment assessment scoring |

### 🟡 GENERALIZE

| Section | Recommendation |
|---------|---------------|
| §4.4 AI Model | Remove "Gemini 3 Flash" — describe as "large language model with structured output" |
| §4.5 ISO Limits Table | These are public standards — keep as-is (not a trade secret) |
| §4.2 Ingestion Constraints | ACH range [0, 1000] and retention [0, 1] are physical bounds — keep |

---

## ID-006: ML-Guided Mesh Refinement

### 🔴 REDACT — Refinement Factors & Convergence Thresholds

| Section | Line(s) | Content to Redact | Reason |
|---------|---------|-------------------|--------|
| §4.2 Coarse Multiplier | 75, 194 | `0.25×` (start at 25% of target) | Initial mesh fraction is tuned know-how |
| §4.3 Termination Thresholds | 215–219 | `metricChange < 1.0%` (convergence), `< 0.1%` (stalling), `4.0×` cell cap | Triple termination thresholds are the key optimization |
| §4.4 Refinement Factor Formula | 235 | `max(0.3, 1 − gradientMagnitude × 100)` | Factor computation is proprietary |
| §4.4 Refine Fraction | 109 | `refineFraction × 4` candidate selection | Selection ratio |
| §4.5 Confidence Stratification | 129–133 | `> 0.8 HIGH`, `0.5–0.8 MEDIUM`, `< 0.5 LOW` boundaries | ML confidence thresholds |
| §4.5 Efficiency Modulation | 267–268 | `reduce by 50%` / `increase by 50%` refineFraction adjustments | Modulation magnitudes |
| §4.5 Uniform Fallback | 154 | `1.5× uniform growth` | Fallback growth rate |
| §4.5 Min Size Extra Reduction | 149 | `×0.8` for near-wall/gradient regions | Asymmetric sizing constant |
| §4.5 Max Refinement Levels | 151 | `capped at 10` | Implementation limit |
| GCI Parameters | 168–169 | `r = √2`, safety factor `F_s = 1.25` | These are from Roache's published method but the specific choices are tuned |
| GCI Threshold | 183 | `gciThresholdPercent = 3.0%` | Independence threshold |
| Asymptotic Range | 179 | `±10%` tolerance | Range check tolerance |

### 🟡 GENERALIZE

| Section | Recommendation |
|---------|---------------|
| §4.5 Weighted Gradient | Keep the concept of weighted averaging but remove the exact formula |
| §4.2 N^(−1/3) Scaling | This is standard physics — keep in patent (not a trade secret) |
| GCI Method | Richardson extrapolation is published — keep the method, redact only our specific parameter choices |

---

## Summary: Redaction Count by Disclosure

| Disclosure | 🔴 Sections to Redact | 🟡 Sections to Generalize |
|-----------|----------------------|--------------------------|
| **ID-001** AI Diagnostics | 9 | 3 |
| **ID-002** Compliance Pipeline | 8 | 3 |
| **ID-003** Surrogate Pipeline | 7 | 3 |
| **ID-004** GPU Scheduling | 8 | 2 |
| **ID-005** Cleanroom Anomaly | 10 | 3 |
| **ID-006** Mesh Refinement | 12 | 3 |
| **TOTAL** | **54** | **17** |

---

## Recommended Filing Strategy

### For Each Disclosure:

1. **Replace specific numbers** with phrases like "a predetermined threshold," "a configurable parameter," or "a weighted combination"
2. **Keep architectural diagrams** — these describe the method (patentable) not the tuning (trade secret)
3. **Keep interface definitions** — TypeScript interfaces describe structure, not values
4. **Remove all default values** — these are tuning parameters
5. **Remove formula constants** — replace `0.16 · Re^(-1/8)` with "an empirically-derived turbulence intensity estimate based on Reynolds number"
6. **Keep the claim structure** — claims should reference "a threshold" not "a threshold of 0.85"

### What Stays in the Patent:
- System architecture and data flow
- The *existence* of multi-factor scoring models (but not the weights)
- Interface contracts and data structures
- The *method* of classification, scoring, and decision-making
- Novel algorithmic approaches (e.g., triple termination, non-destructive preemption)

### What Stays as Trade Secret:
- All numerical thresholds and default values
- Scoring weights and multipliers
- Feature vector composition and ordering
- Trained model weights and normalization parameters
- Confidence formula constants
- Pricing tier limits and warning levels
- Regex patterns and keyword mappings
