// 54 redactable items extracted from docs/patent/TRADE-SECRET-REDACTION-GUIDE.md
// Each will be encrypted via the trade-secret-vault edge function (AES-256-GCM)

export interface TradeSecretSeed {
  title: string;
  description: string;
  content: string;
  classification: "confidential" | "restricted" | "top_secret";
  category:
    | "threshold"
    | "weight"
    | "formula"
    | "model"
    | "dataset"
    | "pricing";
  related_invention: string;
}

export const TRADE_SECRET_SEEDS: TradeSecretSeed[] = [
  // ===== ID-001: AI Diagnostics Agent (9) =====
  {
    title: "Classification confidence formula",
    description: "§5.2 confidence boost & clarification threshold",
    content:
      "Confidence = min(bestScore / totalScores + 0.3, 0.98)\nClarification triggered when confidence < 0.5",
    classification: "restricted",
    category: "formula",
    related_invention: "ID-001",
  },
  {
    title: "Entity extraction regex patterns",
    description: "§5.2 sim ID, parameter, error code regexes",
    content:
      "sim_id: /sim[-_]?([a-z0-9]{6,})/i\nparam: /(?:param(?:eter)?|setting)\\s+([a-z_]+)\\s*=\\s*([\\d.eE+-]+)/i\nerror_code: /(?:error|err)[\\s:]+([A-Z]{2,}\\d{2,})/",
    classification: "confidential",
    category: "formula",
    related_invention: "ID-001",
  },
  {
    title: "Convergence detection thresholds",
    description: "§5.4 slope/amplitude detection limits",
    content:
      "maxSlope > 0.01 → diverging\nmaxAmplitude > 0.5 → oscillating\n|avgSlope| < 0.002 → stalled",
    classification: "restricted",
    category: "threshold",
    related_invention: "ID-001",
  },
  {
    title: "Root-cause heuristic thresholds",
    description: "§5.4 mesh & solver root-cause boundaries",
    content:
      "skewness > 0.85 → mesh quality issue\northogonality < 0.5 → mesh quality issue\nAR > 100 → aspect ratio issue\npressure relax > 0.35 → solver instability\nvelocity relax > 0.8 → solver instability",
    classification: "top_secret",
    category: "threshold",
    related_invention: "ID-001",
  },
  {
    title: "Consecutive confirmation window N",
    description: "§5.5 default consecutive windows for state confirmation",
    content: "N = 3 consecutive windows required to confirm a state change",
    classification: "confidential",
    category: "threshold",
    related_invention: "ID-001",
  },
  {
    title: "AI recovery fix triggers",
    description: "§5.5 thresholds that trigger upwind / potential-flow recovery",
    content:
      "slope > 0.1 → switch to upwind discretization\nresidual level > 1e3 → fall back to potential flow init",
    classification: "restricted",
    category: "threshold",
    related_invention: "ID-001",
  },
  {
    title: "Plan confidence boost constants",
    description: "§5.6 diagnostic + historical boosts and cap",
    content:
      "+0.1 diagnostic boost\n+0.05 historical boost\nFinal cap = 0.95",
    classification: "confidential",
    category: "weight",
    related_invention: "ID-001",
  },
  {
    title: "Mesh quality threshold table",
    description: "§5.9 skewness, AR, y+ ranges and coverage requirements",
    content:
      "skewness max 0.85\naspect ratio max 20\ny+ ranges: ≤1 (resolved), [30,300] (wall-fn)\nCoverage: 70% in target band, 90% within tolerance band",
    classification: "top_secret",
    category: "threshold",
    related_invention: "ID-001",
  },
  {
    title: "Mesh quality rating weights",
    description: "§5.9 internal rating formula weights & percentage thresholds",
    content:
      "Rating = 0.4·skewScore + 0.3·orthoScore + 0.2·ARScore + 0.1·yPlusScore\nExcellent ≥ 0.9, Good ≥ 0.75, Acceptable ≥ 0.6, Poor < 0.6",
    classification: "top_secret",
    category: "weight",
    related_invention: "ID-001",
  },

  // ===== ID-002: Compliance Pipeline (8) =====
  {
    title: "Risk severity weight map",
    description: "§5.5 RISK_WEIGHT for severity-to-score conversion",
    content:
      "RISK_WEIGHT = { Low: 1, Medium: 3, High: 4, Critical: 5 }",
    classification: "top_secret",
    category: "weight",
    related_invention: "ID-002",
  },
  {
    title: "Remediation cost model",
    description: "§5.5 USD cost per severity tier",
    content:
      "REMEDIATION_COST = { Low: $500, Medium: $2,500, High: $10,000, Critical: $25,000 }",
    classification: "top_secret",
    category: "pricing",
    related_invention: "ID-002",
  },
  {
    title: "Repeat violation multiplier",
    description: "§5.5 escalation factor for repeat findings",
    content: "repeatViolationMultiplier = 1.5×",
    classification: "restricted",
    category: "weight",
    related_invention: "ID-002",
  },
  {
    title: "Escalation multiplier",
    description: "§5.5 multiplier applied on tier escalation",
    content: "escalationMultiplier = 1.3×",
    classification: "restricted",
    category: "weight",
    related_invention: "ID-002",
  },
  {
    title: "Systemic surcharge",
    description: "§5.5 surcharge applied to systemic/repeat issues",
    content: "systemicSurcharge = cost × 1.25",
    classification: "restricted",
    category: "pricing",
    related_invention: "ID-002",
  },
  {
    title: "Severity remediation deadlines",
    description: "§5.6 deadline-by-severity model",
    content:
      "Critical → immediate\nHigh → 7 days\nMedium → 30 days\nLow → 90 days",
    classification: "confidential",
    category: "threshold",
    related_invention: "ID-002",
  },
  {
    title: "Verdict decision boundary",
    description: "§5.6 fail/pass thresholds",
    content: "Fail if highRiskCount > 0 OR overallScore ≥ 50",
    classification: "restricted",
    category: "threshold",
    related_invention: "ID-002",
  },
  {
    title: "SHA-256 canonicalization scheme",
    description: "§5.6 evidence canonicalization order before hashing",
    content:
      "Canonical form: sort keys lexicographically, normalize whitespace, drop nulls, JSON-stringify with no spaces, then SHA-256",
    classification: "confidential",
    category: "formula",
    related_invention: "ID-002",
  },

  // ===== ID-003: Surrogate Pipeline (7) =====
  {
    title: "23-feature vector composition",
    description: "§4.1.1 ordered feature names — core competitive advantage",
    content:
      "Feature order: [reynolds, mach, prandtl, turbulenceIntensity, cellCount, skewness, orthogonality, aspectRatio, yPlusMean, yPlusMax, inletVelocity, hydraulicDiameter, viscosityRatio, energyEqOn, transientFlag, rotatingFrame, meshGrowthRate, refinementLevels, prismLayers, firstCellHeight, domainVolume, surfaceArea, geometryComplexity]",
    classification: "top_secret",
    category: "model",
    related_invention: "ID-003",
  },
  {
    title: "Turbulence intensity empirical constant",
    description: "§4.1.3 I = 0.16 · Re^(-1/8)",
    content: "Empirical constant 0.16 in I = 0.16 · Re^(-1/8)",
    classification: "restricted",
    category: "formula",
    related_invention: "ID-003",
  },
  {
    title: "Composite MQS formula weights",
    description: "§4.1.3 weighting of skewness, orthogonality, AR, non-ortho",
    content:
      "MQS = 0.3·(1-skew) + 0.3·ortho + 0.2·(1-AR/100) + 0.2·(1-nonOrtho/100)",
    classification: "top_secret",
    category: "weight",
    related_invention: "ID-003",
  },
  {
    title: "Overfit detection threshold",
    description: "§4.5 train/test MSE ratio guard",
    content: "Overfit flagged if trainMSE / testMSE < 0.5",
    classification: "restricted",
    category: "threshold",
    related_invention: "ID-003",
  },
  {
    title: "Retrain trigger threshold",
    description: "§4.6 sample-count threshold to schedule retrain",
    content: "RETRAIN_THRESHOLD = 10 new validated samples",
    classification: "restricted",
    category: "threshold",
    related_invention: "ID-003",
  },
  {
    title: "Confidence (Mahalanobis) computation",
    description: "§4.8 distance-to-training-distribution formula",
    content:
      "confidence = exp(-0.5 · sqrt((x-μ)ᵀ · Σ⁻¹ · (x-μ)) / dim) clipped to [0.05, 0.99]",
    classification: "top_secret",
    category: "formula",
    related_invention: "ID-003",
  },
  {
    title: "Normalization stability guard",
    description: "§4.4 σ guard for near-zero variance features",
    content: "If σ < 1e-12 then σ := 1 (prevents divide-by-zero)",
    classification: "confidential",
    category: "threshold",
    related_invention: "ID-003",
  },

  // ===== ID-004: GPU Scheduling (8) =====
  {
    title: "Cell-count size classification thresholds",
    description: "§4.2 size buckets",
    content:
      "Small: <500K\nMedium: 500K–2M\nLarge: 2M–10M\nMassive: >10M cells",
    classification: "restricted",
    category: "threshold",
    related_invention: "ID-004",
  },
  {
    title: "Resource allocation per size",
    description: "§4.2 GPU/CPU/Memory per classification",
    content:
      "Small: 1 GPU, 8 CPU, 32 GB\nMedium: 2 GPU, 16 CPU, 64 GB\nLarge: 4 GPU, 32 CPU, 128 GB\nMassive: 8 GPU, 64 CPU, 256 GB",
    classification: "top_secret",
    category: "weight",
    related_invention: "ID-004",
  },
  {
    title: "Physics complexity multipliers",
    description: "§4.2 multipliers for transient/rotating/etc.",
    content:
      "Transient: CPU ×2, Memory ×1.5, Duration ×2\nRotating: GPU +1\nMultiphase: Memory ×1.75, Duration ×1.5\nCombustion: GPU +2, Duration ×3",
    classification: "top_secret",
    category: "weight",
    related_invention: "ID-004",
  },
  {
    title: "Priority weight multipliers (queue)",
    description: "§4.3 SLA-tier wait-time multipliers",
    content: "Low: 1.5×, Normal: 1.0×, High: 0.8×, Critical: 0.5×",
    classification: "top_secret",
    category: "weight",
    related_invention: "ID-004",
  },
  {
    title: "Priority rank encoding",
    description: "§4.3 internal numeric priority order",
    content: "Critical=0, High=1, Normal=2, Low=3",
    classification: "confidential",
    category: "threshold",
    related_invention: "ID-004",
  },
  {
    title: "Default queue depth",
    description: "§4.3 capacity planning parameter",
    content: "Default queue depth = 50 jobs",
    classification: "confidential",
    category: "threshold",
    related_invention: "ID-004",
  },
  {
    title: "Tier GPU-hour allocations",
    description: "§4.5 monthly included GPU-hours per pricing tier",
    content:
      "Free: 5 GPU-hr\nPro: 100 GPU-hr\nEnterprise: 1000 GPU-hr",
    classification: "top_secret",
    category: "pricing",
    related_invention: "ID-004",
  },
  {
    title: "Usage warning thresholds",
    description: "§4.5 enforcement boundaries",
    content:
      "75% → approaching limit\n90% → critical\n100% → exceeded (block new jobs)",
    classification: "restricted",
    category: "threshold",
    related_invention: "ID-004",
  },

  // ===== ID-005: Cleanroom Anomaly (10) =====
  {
    title: "Z-score anomaly threshold",
    description: "§4.3 statistical detection sensitivity",
    content: "Default z-score threshold = 2.0",
    classification: "restricted",
    category: "threshold",
    related_invention: "ID-005",
  },
  {
    title: "Recency window size",
    description: "§4.3 most-recent samples checked for anomaly",
    content: "Recency window = last 3 samples",
    classification: "confidential",
    category: "threshold",
    related_invention: "ID-005",
  },
  {
    title: "Minimum samples per zone",
    description: "§4.3 statistical significance gate",
    content: "Minimum 4 samples per zone before scoring",
    classification: "confidential",
    category: "threshold",
    related_invention: "ID-005",
  },
  {
    title: "Particle estimation calibration",
    description: "§4.5 retention-to-particle mapping",
    content: "estimatedParticles = (1 - retention) × 1e7",
    classification: "top_secret",
    category: "formula",
    related_invention: "ID-005",
  },
  {
    title: "Laminar stability penalties",
    description: "§4.5 ISO class penalty for low laminar score",
    content: "laminarStability < 0.60 → +2 class\nlaminarStability < 0.80 → +1 class",
    classification: "restricted",
    category: "weight",
    related_invention: "ID-005",
  },
  {
    title: "ACR penalty threshold",
    description: "§4.5 air change rate penalty",
    content: "ACH < 20 → +1 ISO class penalty",
    classification: "restricted",
    category: "threshold",
    related_invention: "ID-005",
  },
  {
    title: "Trend slope thresholds",
    description: "§4.5 worsening/improving trend boundaries",
    content:
      "slope > +0.05/sample → worsening\nslope < -0.05/sample → improving\nMinimum 5 samples to compute trend",
    classification: "restricted",
    category: "threshold",
    related_invention: "ID-005",
  },
  {
    title: "Confidence multipliers",
    description: "§4.5 confidence dampers",
    content:
      "×0.6 when sample count below minimum\n×0.8 when retention CV high\n×0.85 when laminar CV high",
    classification: "restricted",
    category: "weight",
    related_invention: "ID-005",
  },
  {
    title: "Volatility CV warning threshold",
    description: "§4.5 internal quality gate",
    content: "Coefficient of variation > 15% → emit volatility warning",
    classification: "confidential",
    category: "threshold",
    related_invention: "ID-005",
  },
  {
    title: "Containment subsystem scoring",
    description: "Subsystem E: panel/cutout/door scoring",
    content:
      "Blanking panel coverage: 100% required, each <5% gap = -1 pt\nCable cutout seal fraction < 0.95 → +1 class\nDoor seal quality < 0.9 → +1 class",
    classification: "top_secret",
    category: "weight",
    related_invention: "ID-005",
  },

  // ===== ID-006: ML-Guided Mesh Refinement (12) =====
  {
    title: "Coarse start multiplier",
    description: "§4.2 starting mesh fraction of target",
    content: "Coarse multiplier = 0.25× (start at 25% of target cell count)",
    classification: "restricted",
    category: "threshold",
    related_invention: "ID-006",
  },
  {
    title: "Triple termination thresholds",
    description: "§4.3 convergence/stalling/cell-cap limits",
    content:
      "metricChange < 1.0% → converged\nmetricChange < 0.1% → stalling\ncells > 4.0× target → cap reached",
    classification: "top_secret",
    category: "threshold",
    related_invention: "ID-006",
  },
  {
    title: "Refinement factor formula",
    description: "§4.4 gradient-driven refinement factor",
    content: "factor = max(0.3, 1 − gradientMagnitude × 100)",
    classification: "top_secret",
    category: "formula",
    related_invention: "ID-006",
  },
  {
    title: "Refine fraction selection ratio",
    description: "§4.4 candidate selection multiplier",
    content: "Candidates = refineFraction × 4 of total cells",
    classification: "restricted",
    category: "threshold",
    related_invention: "ID-006",
  },
  {
    title: "ML confidence stratification",
    description: "§4.5 HIGH/MEDIUM/LOW confidence boundaries",
    content: "> 0.8 HIGH\n0.5–0.8 MEDIUM\n< 0.5 LOW",
    classification: "restricted",
    category: "threshold",
    related_invention: "ID-006",
  },
  {
    title: "Efficiency modulation magnitudes",
    description: "§4.5 refineFraction adjustment based on efficiency",
    content:
      "Low efficiency → reduce refineFraction by 50%\nHigh efficiency → increase refineFraction by 50%",
    classification: "restricted",
    category: "weight",
    related_invention: "ID-006",
  },
  {
    title: "Uniform fallback growth rate",
    description: "§4.5 growth rate when ML model unavailable",
    content: "Uniform fallback = 1.5× cell-count growth per pass",
    classification: "confidential",
    category: "threshold",
    related_invention: "ID-006",
  },
  {
    title: "Min-size extra reduction multiplier",
    description: "§4.5 near-wall / gradient region tightening",
    content: "Min size × 0.8 in near-wall and high-gradient regions",
    classification: "restricted",
    category: "weight",
    related_invention: "ID-006",
  },
  {
    title: "Maximum refinement levels",
    description: "§4.5 hard implementation cap",
    content: "Max refinement levels = 10",
    classification: "confidential",
    category: "threshold",
    related_invention: "ID-006",
  },
  {
    title: "GCI parameter choices",
    description: "Roache GCI refinement ratio and safety factor",
    content: "r = √2 (refinement ratio)\nF_s = 1.25 (safety factor)",
    classification: "restricted",
    category: "formula",
    related_invention: "ID-006",
  },
  {
    title: "GCI independence threshold",
    description: "Mesh independence cutoff",
    content: "gciThresholdPercent = 3.0%",
    classification: "restricted",
    category: "threshold",
    related_invention: "ID-006",
  },
  {
    title: "Asymptotic range tolerance",
    description: "Tolerance for asymptotic-range check",
    content: "Asymptotic range tolerance = ±10%",
    classification: "confidential",
    category: "threshold",
    related_invention: "ID-006",
  },
];
