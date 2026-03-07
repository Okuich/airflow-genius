/**
 * Usage-Based Pricing Engine
 * 
 * Calculates billing based on per-GPU-hour metering with tiered enterprise plans.
 * Supports included allowances, overage rates, and volume discounts.
 */

export interface PricingPlan {
  id: string;
  name: string;
  slug: string;
  tier_level: number;
  base_price_usd: number;
  billing_period: string;
  included_gpu_hours: number;
  included_cpu_hours: number;
  included_storage_gb: number;
  overage_gpu_rate: number;
  overage_cpu_rate: number;
  overage_storage_rate: number;
  max_concurrent_jobs: number;
  max_team_members: number;
  features: string[];
  is_active: boolean;
}

export interface UsageMeter {
  id: string;
  organization_id: string;
  user_id: string;
  simulation_id: string | null;
  meter_type: 'gpu_hour' | 'cpu_hour' | 'storage_gb';
  quantity: number;
  unit_price_usd: number;
  billable: boolean;
  recorded_at: string;
  billing_period_start: string;
  billing_period_end: string;
  metadata: Record<string, unknown>;
}

export interface UsageSummary {
  gpu_hours: number;
  cpu_hours: number;
  storage_gb: number;
  included_gpu_hours: number;
  included_cpu_hours: number;
  included_storage_gb: number;
  overage_gpu_hours: number;
  overage_cpu_hours: number;
  overage_storage_gb: number;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  type: 'base' | 'included' | 'overage';
}

export interface BillingCalculation {
  plan: PricingPlan;
  usage: UsageSummary;
  line_items: InvoiceLineItem[];
  base_amount: number;
  overage_amount: number;
  total_amount: number;
  savings_vs_payg: number;
}

/** Calculate overage for a single resource type */
function calcOverage(used: number, included: number): number {
  return Math.max(0, used - included);
}

/** Pay-as-you-go reference rate (highest tier rate) for savings calculation */
const PAYG_GPU_RATE = 4.50;
const PAYG_CPU_RATE = 0.15;
const PAYG_STORAGE_RATE = 0.12;

export function calculateBilling(
  plan: PricingPlan,
  gpuHours: number,
  cpuHours: number,
  storageGb: number
): BillingCalculation {
  const overageGpu = calcOverage(gpuHours, plan.included_gpu_hours);
  const overageCpu = calcOverage(cpuHours, plan.included_cpu_hours);
  const overageStorage = calcOverage(storageGb, plan.included_storage_gb);

  const line_items: InvoiceLineItem[] = [
    {
      description: `${plan.name} Plan — Base`,
      quantity: 1,
      unit_price: plan.base_price_usd,
      total: plan.base_price_usd,
      type: 'base',
    },
  ];

  if (plan.included_gpu_hours > 0) {
    line_items.push({
      description: `Included GPU Hours (${Math.min(gpuHours, plan.included_gpu_hours).toFixed(1)} of ${plan.included_gpu_hours})`,
      quantity: Math.min(gpuHours, plan.included_gpu_hours),
      unit_price: 0,
      total: 0,
      type: 'included',
    });
  }

  const gpuOverageTotal = overageGpu * plan.overage_gpu_rate;
  const cpuOverageTotal = overageCpu * plan.overage_cpu_rate;
  const storageOverageTotal = overageStorage * plan.overage_storage_rate;

  if (overageGpu > 0) {
    line_items.push({
      description: `GPU Overage Hours`,
      quantity: overageGpu,
      unit_price: plan.overage_gpu_rate,
      total: gpuOverageTotal,
      type: 'overage',
    });
  }

  if (overageCpu > 0) {
    line_items.push({
      description: `CPU Overage Hours`,
      quantity: overageCpu,
      unit_price: plan.overage_cpu_rate,
      total: cpuOverageTotal,
      type: 'overage',
    });
  }

  if (overageStorage > 0) {
    line_items.push({
      description: `Storage Overage (GB)`,
      quantity: overageStorage,
      unit_price: plan.overage_storage_rate,
      total: storageOverageTotal,
      type: 'overage',
    });
  }

  const overage_amount = gpuOverageTotal + cpuOverageTotal + storageOverageTotal;
  const total_amount = plan.base_price_usd + overage_amount;

  // Calculate savings vs pure pay-as-you-go
  const payg_total = gpuHours * PAYG_GPU_RATE + cpuHours * PAYG_CPU_RATE + storageGb * PAYG_STORAGE_RATE;
  const savings_vs_payg = Math.max(0, payg_total - total_amount);

  return {
    plan,
    usage: {
      gpu_hours: gpuHours,
      cpu_hours: cpuHours,
      storage_gb: storageGb,
      included_gpu_hours: plan.included_gpu_hours,
      included_cpu_hours: plan.included_cpu_hours,
      included_storage_gb: plan.included_storage_gb,
      overage_gpu_hours: overageGpu,
      overage_cpu_hours: overageCpu,
      overage_storage_gb: overageStorage,
    },
    line_items,
    base_amount: plan.base_price_usd,
    overage_amount,
    total_amount,
    savings_vs_payg,
  };
}

/** Project annual revenue at scale */
export function projectAnnualRevenue(
  customerCount: number,
  avgGpuHoursPerMonth: number,
  plan: PricingPlan
): number {
  const monthly = calculateBilling(plan, avgGpuHoursPerMonth, avgGpuHoursPerMonth * 5, avgGpuHoursPerMonth * 0.5);
  return monthly.total_amount * 12 * customerCount;
}

/** Estimate GPU utilization percentage */
export function gpuUtilizationPercent(used: number, included: number): number {
  if (included === 0) return used > 0 ? 100 : 0;
  return Math.min(100, (used / included) * 100);
}
