import type { RoleProfile } from "./role-data";

export interface ConsentItem {
  id: string;
  label: string;
  required: boolean;
  description?: string;
}

/** Base consents shown to every role */
const BASE_CONSENTS: ConsentItem[] = [
  {
    id: "terms",
    label: "I agree to the Terms of Service and Privacy Policy",
    required: true,
  },
  {
    id: "data-processing",
    label: "I consent to processing of simulation data for service delivery",
    required: true,
  },
];

/** Role-specific consents that appear via progressive disclosure */
const ROLE_CONSENTS: Record<string, ConsentItem[]> = {
  "cfd-engineer": [
    {
      id: "gpu-fair-use",
      label: "I accept the GPU Compute Fair Use Policy",
      required: true,
      description: "Trial includes up to 500 GPU-hours per month on shared A100 clusters.",
    },
  ],
  "engineering-manager": [
    {
      id: "gpu-fair-use",
      label: "I accept the GPU Compute Fair Use Policy",
      required: true,
      description: "Trial includes up to 500 GPU-hours per month on shared A100 clusters.",
    },
    {
      id: "team-data",
      label: "I consent to team usage analytics for workspace administration",
      required: true,
      description: "Aggregated compute and activity metrics visible to workspace owners.",
    },
  ],
  "facilities-manager": [
    {
      id: "sensor-data",
      label: "I consent to ingestion and storage of facility sensor data",
      required: true,
      description: "Particle counts, temperature, and airflow readings stored for monitoring.",
    },
    {
      id: "anomaly-alerts",
      label: "I opt in to automated anomaly alert notifications",
      required: false,
      description: "Receive email/SMS alerts when zone metrics exceed thresholds.",
    },
  ],
  "rd-director": [
    {
      id: "gpu-fair-use",
      label: "I accept the GPU Compute Fair Use Policy",
      required: true,
      description: "Trial includes up to 500 GPU-hours per month on shared A100 clusters.",
    },
    {
      id: "ml-training",
      label: "I consent to use of simulation data for ML surrogate model training",
      required: true,
      description: "Your simulation results may be used to train organization-scoped ML models.",
    },
    {
      id: "fedramp-ack",
      label: "I acknowledge FedRAMP compliance features are preview-only during trial",
      required: true,
    },
  ],
  "product-development": [
    {
      id: "gpu-fair-use",
      label: "I accept the GPU Compute Fair Use Policy",
      required: true,
      description: "Trial includes up to 500 GPU-hours per month on shared A100 clusters.",
    },
    {
      id: "export-reports",
      label: "I accept the Report Export License terms",
      required: false,
      description: "Generated compliance PDF reports include FlowForge watermark during trial.",
    },
  ],
  other: [],
};

export function getConsentsForRole(role: RoleProfile | null): ConsentItem[] {
  if (!role) return BASE_CONSENTS;
  const extra = ROLE_CONSENTS[role.id] ?? [];
  return [...BASE_CONSENTS, ...extra];
}
