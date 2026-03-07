import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Cpu, HardDrive, Zap, TrendingUp, DollarSign, Users, Check,
  BarChart3, Receipt, Calculator, ArrowUpRight, Sparkles
} from "lucide-react";
import { calculateBilling, gpuUtilizationPercent, type PricingPlan, type BillingCalculation } from "@/modules/pricing";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

// Static plan data matching DB seed
const PLANS: PricingPlan[] = [
  { id: "1", name: "Starter", slug: "starter", tier_level: 1, base_price_usd: 0, billing_period: "monthly", included_gpu_hours: 10, included_cpu_hours: 50, included_storage_gb: 5, overage_gpu_rate: 3.5, overage_cpu_rate: 0.12, overage_storage_rate: 0.1, max_concurrent_jobs: 1, max_team_members: 3, features: ["Basic CFD solver", "Single-region mesh", "Community support"], is_active: true },
  { id: "2", name: "Professional", slug: "professional", tier_level: 2, base_price_usd: 499, billing_period: "monthly", included_gpu_hours: 100, included_cpu_hours: 500, included_storage_gb: 50, overage_gpu_rate: 2.8, overage_cpu_rate: 0.09, overage_storage_rate: 0.08, max_concurrent_jobs: 4, max_team_members: 10, features: ["Multi-region solver", "AI diagnostics", "Compliance reports", "Priority support", "Surrogate models"], is_active: true },
  { id: "3", name: "Enterprise", slug: "enterprise", tier_level: 3, base_price_usd: 2499, billing_period: "monthly", included_gpu_hours: 500, included_cpu_hours: 2500, included_storage_gb: 500, overage_gpu_rate: 2.2, overage_cpu_rate: 0.07, overage_storage_rate: 0.05, max_concurrent_jobs: 16, max_team_members: 50, features: ["Unlimited regions", "Full AI agent", "Custom compliance rules", "FedRAMP ready", "Dedicated support", "SLA 99.9%", "SSO/SAML"], is_active: true },
  { id: "4", name: "Enterprise Plus", slug: "enterprise-plus", tier_level: 4, base_price_usd: 9999, billing_period: "monthly", included_gpu_hours: 2500, included_cpu_hours: 10000, included_storage_gb: 2000, overage_gpu_rate: 1.5, overage_cpu_rate: 0.05, overage_storage_rate: 0.03, max_concurrent_jobs: 64, max_team_members: 500, features: ["Everything in Enterprise", "Dedicated GPU cluster", "Custom model training", "On-premise deployment", "24/7 premium support", "Custom SLA", "Data residency"], is_active: true },
];

// Mock current usage data
const MOCK_USAGE_HISTORY = Array.from({ length: 12 }, (_, i) => {
  const month = new Date(2026, i, 1).toLocaleString("default", { month: "short" });
  const gpu = Math.round(40 + Math.random() * 160);
  const cpu = gpu * 4 + Math.round(Math.random() * 200);
  return { month, gpu_hours: gpu, cpu_hours: cpu, storage_gb: 20 + i * 3, cost: 0 };
});

const tierColors: Record<string, string> = {
  starter: "bg-muted text-muted-foreground",
  professional: "bg-primary/10 text-primary",
  enterprise: "bg-chart-4/15 text-chart-4",
  "enterprise-plus": "bg-chart-5/15 text-chart-5",
};

export default function Billing() {
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan>(PLANS[1]);
  const [gpuSlider, setGpuSlider] = useState([120]);
  const [cpuSlider, setCpuSlider] = useState([600]);
  const [storageSlider, setStorageSlider] = useState([40]);

  const billing: BillingCalculation = useMemo(
    () => calculateBilling(selectedPlan, gpuSlider[0], cpuSlider[0], storageSlider[0]),
    [selectedPlan, gpuSlider, cpuSlider, storageSlider]
  );

  const gpuUtil = gpuUtilizationPercent(gpuSlider[0], selectedPlan.included_gpu_hours);

  // Add cost to usage history
  const historyWithCost = MOCK_USAGE_HISTORY.map((m) => {
    const calc = calculateBilling(selectedPlan, m.gpu_hours, m.cpu_hours, m.storage_gb);
    return { ...m, cost: Math.round(calc.total_amount) };
  });

  const allPlanComparisons = PLANS.map((p) => {
    const calc = calculateBilling(p, gpuSlider[0], cpuSlider[0], storageSlider[0]);
    return { plan: p.name, total: Math.round(calc.total_amount), savings: Math.round(calc.savings_vs_payg) };
  });

  return (
    <div className="min-h-screen bg-background p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Usage & Billing</h1>
          <p className="text-muted-foreground mt-1">Per-GPU-hour metering with tiered enterprise plans</p>
        </div>
        <Badge variant="outline" className="text-sm gap-1.5 px-3 py-1.5">
          <Sparkles className="h-3.5 w-3.5" /> {selectedPlan.name} Plan
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10"><Zap className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">GPU Hours Used</p>
                <p className="text-2xl font-bold text-foreground">{gpuSlider[0]}<span className="text-sm font-normal text-muted-foreground">/{selectedPlan.included_gpu_hours}</span></p>
              </div>
            </div>
            <Progress value={gpuUtil} className="mt-3 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-chart-2/15"><Cpu className="h-5 w-5 text-chart-2" /></div>
              <div>
                <p className="text-sm text-muted-foreground">CPU Hours Used</p>
                <p className="text-2xl font-bold text-foreground">{cpuSlider[0]}<span className="text-sm font-normal text-muted-foreground">/{selectedPlan.included_cpu_hours}</span></p>
              </div>
            </div>
            <Progress value={Math.min(100, (cpuSlider[0] / selectedPlan.included_cpu_hours) * 100)} className="mt-3 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-chart-3/15"><DollarSign className="h-5 w-5 text-chart-3" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Current Bill</p>
                <p className="text-2xl font-bold text-foreground">${billing.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
            {billing.overage_amount > 0 && (
              <p className="text-xs text-destructive mt-2 flex items-center gap-1"><ArrowUpRight className="h-3 w-3" />${billing.overage_amount.toFixed(2)} overage</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-chart-4/15"><TrendingUp className="h-5 w-5 text-chart-4" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Savings vs PAYG</p>
                <p className="text-2xl font-bold text-chart-4">${billing.savings_vs_payg.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="calculator" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="calculator" className="gap-1.5"><Calculator className="h-4 w-4" />Cost Calculator</TabsTrigger>
          <TabsTrigger value="plans" className="gap-1.5"><BarChart3 className="h-4 w-4" />Plans</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5"><Receipt className="h-4 w-4" />Usage History</TabsTrigger>
        </TabsList>

        {/* Cost Calculator Tab */}
        <TabsContent value="calculator" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sliders */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Usage Simulator</CardTitle>
                <CardDescription>Drag sliders to estimate your monthly cost</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Zap className="h-4 w-4" />GPU Hours</span>
                    <span className="font-mono font-semibold text-foreground">{gpuSlider[0]}h</span>
                  </div>
                  <Slider value={gpuSlider} onValueChange={setGpuSlider} max={5000} step={10} className="w-full" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Cpu className="h-4 w-4" />CPU Hours</span>
                    <span className="font-mono font-semibold text-foreground">{cpuSlider[0]}h</span>
                  </div>
                  <Slider value={cpuSlider} onValueChange={setCpuSlider} max={20000} step={50} className="w-full" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5"><HardDrive className="h-4 w-4" />Storage (GB)</span>
                    <span className="font-mono font-semibold text-foreground">{storageSlider[0]} GB</span>
                  </div>
                  <Slider value={storageSlider} onValueChange={setStorageSlider} max={5000} step={10} className="w-full" />
                </div>

                {/* Plan selector */}
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Selected Plan</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PLANS.map((p) => (
                      <Button
                        key={p.slug}
                        variant={selectedPlan.slug === p.slug ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedPlan(p)}
                        className="justify-start text-xs"
                      >
                        {p.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Invoice Preview</CardTitle>
                <CardDescription>Estimated billing for current usage</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billing.line_items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-2">
                            {item.description}
                            {item.type === "overage" && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Overage</Badge>}
                            {item.type === "included" && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Included</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{item.type === "base" ? "—" : item.quantity.toFixed(1)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{item.unit_price === 0 ? "—" : `$${item.unit_price.toFixed(2)}`}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium">${item.total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell colSpan={3} className="font-semibold">Total</TableCell>
                      <TableCell className="text-right font-mono font-bold text-lg">${billing.total_amount.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Plan comparison bar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Plan Comparison at Current Usage</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={allPlanComparisons}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="plan" className="text-xs fill-muted-foreground" />
                  <YAxis className="text-xs fill-muted-foreground" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Monthly Cost" />
                  <Bar dataKey="savings" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} name="Savings vs PAYG" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {PLANS.map((plan) => (
              <Card key={plan.slug} className={`relative overflow-hidden transition-all ${selectedPlan.slug === plan.slug ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md"}`}>
                {plan.slug === "enterprise" && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-bl-lg">POPULAR</div>
                )}
                <CardHeader>
                  <Badge className={`w-fit ${tierColors[plan.slug] || ""}`}>{plan.name}</Badge>
                  <div className="mt-3">
                    <span className="text-3xl font-bold text-foreground">${plan.base_price_usd.toLocaleString()}</span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
                  <CardDescription className="mt-1">{plan.included_gpu_hours} GPU hrs included</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>GPU overage</span>
                      <span className="font-mono">${plan.overage_gpu_rate}/hr</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>CPU hours</span>
                      <span className="font-mono">{plan.included_cpu_hours}h</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Storage</span>
                      <span className="font-mono">{plan.included_storage_gb} GB</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Concurrent jobs</span>
                      <span className="font-mono">{plan.max_concurrent_jobs}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span><Users className="h-3 w-3 inline mr-1" />Team seats</span>
                      <span className="font-mono">{plan.max_team_members}</span>
                    </div>
                  </div>
                  <div className="border-t border-border pt-3 space-y-1.5">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                  <Button
                    variant={selectedPlan.slug === plan.slug ? "default" : "outline"}
                    className="w-full"
                    onClick={() => setSelectedPlan(plan)}
                  >
                    {selectedPlan.slug === plan.slug ? "Current Plan" : "Select Plan"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Usage History Tab */}
        <TabsContent value="history" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">GPU Usage Trend</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyWithCost}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                    <Area type="monotone" dataKey="gpu_hours" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} name="GPU Hours" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Monthly Cost Trend</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyWithCost}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} formatter={(v: number) => [`$${v}`, "Cost"] } />
                    <Area type="monotone" dataKey="cost" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.15} name="Cost ($)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* History table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">GPU Hours</TableHead>
                    <TableHead className="text-right">CPU Hours</TableHead>
                    <TableHead className="text-right">Storage</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyWithCost.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium">{row.month}</TableCell>
                      <TableCell className="text-right font-mono">{row.gpu_hours}h</TableCell>
                      <TableCell className="text-right font-mono">{row.cpu_hours}h</TableCell>
                      <TableCell className="text-right font-mono">{row.storage_gb} GB</TableCell>
                      <TableCell className="text-right font-mono font-semibold">${row.cost.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
