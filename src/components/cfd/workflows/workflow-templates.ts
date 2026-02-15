// ─── CFD Workflow Templates ─────────────────────────────────────────────────
// Predefined multi-step AI workflows for common CFD tasks.
// ──────────────────────────────────────────────────────────────────────────

import type { WorkflowTemplate } from "./workflow-types";

export const MESH_GENERATION_WORKFLOW: WorkflowTemplate = {
  id: "mesh-generation",
  name: "Mesh Generation Assistant",
  description: "Guided mesh creation from geometry analysis through quality validation and refinement.",
  icon: "mesh",
  category: "pre-processing",
  estimatedMinutes: 8,
  steps: [
    {
      id: "geometry-analysis",
      title: "Geometry Analysis",
      description: "Analyze the simulation domain geometry and identify critical features.",
      promptTemplate: `Analyze the simulation geometry for a {{domainType}} domain. 
Key dimensions: {{dimensions}}. 
Identify: sharp edges, thin walls, small gaps, curvature regions, and areas needing mesh refinement. 
Classify the geometry complexity (simple/moderate/complex) and list recommended mesh treatment zones.
Simulation name: {{simulationName}}, cell count target: {{cellCount}}.`,
      inputs: [
        {
          key: "domainType",
          label: "Domain Type",
          type: "select",
          options: [
            { label: "Internal Flow (Duct/Pipe)", value: "internal-flow" },
            { label: "External Aerodynamics", value: "external-aero" },
            { label: "HVAC Room/Zone", value: "hvac-room" },
            { label: "Turbomachinery", value: "turbomachinery" },
            { label: "Heat Exchanger", value: "heat-exchanger" },
            { label: "Cleanroom", value: "cleanroom" },
          ],
          required: true,
        },
        {
          key: "dimensions",
          label: "Key Dimensions (L×W×H or description)",
          type: "text",
          placeholder: "e.g. 10m × 4m × 3m duct",
          required: true,
        },
      ],
      autoExecute: false,
    },
    {
      id: "mesh-strategy",
      title: "Mesh Strategy Selection",
      description: "Select optimal meshing strategy based on geometry analysis.",
      promptTemplate: `Based on the geometry analysis above, recommend a meshing strategy for this {{domainType}} simulation.
Include:
1. **Mesh type** recommendation (structured hex, unstructured tet, polyhedral, hybrid)
2. **Base cell size** and growth ratios
3. **Boundary layer** mesh settings (first cell height for y+ ≈ {{targetYPlus}}, growth ratio, number of layers)
4. **Refinement zones** with specific sizing recommendations
5. **Estimated total cell count** and whether it fits the target of {{cellCount}} cells

Format as a configuration summary the user can apply directly.`,
      inputs: [
        {
          key: "targetYPlus",
          label: "Target y+ Value",
          type: "select",
          options: [
            { label: "y+ < 1 (Resolved BL)", value: "1" },
            { label: "y+ ≈ 5 (Low-Re)", value: "5" },
            { label: "y+ ≈ 30 (Wall Functions)", value: "30" },
            { label: "y+ ≈ 50 (Standard WF)", value: "50" },
          ],
          defaultValue: "30",
        },
      ],
      autoExecute: true,
    },
    {
      id: "quality-check",
      title: "Mesh Quality Validation",
      description: "Validate mesh quality metrics and identify problem cells.",
      promptTemplate: `Perform a mesh quality assessment for the configured mesh.
Check these quality metrics:
- **Orthogonality** (target > 0.3 min, > 0.7 avg)
- **Skewness** (target < 0.85 max, < 0.4 avg)
- **Aspect ratio** (target < 100 max for boundary layer, < 20 elsewhere)
- **Volume ratio** between adjacent cells (< 5:1)
- **Non-orthogonality** at boundaries

Turbulence model: {{turbulenceModel}}. Cell count: {{cellCount}}.
Flag any quality issues that could cause solver divergence and provide specific remediation steps.
Rate overall mesh quality: Excellent / Good / Acceptable / Poor / Unusable.`,
      autoExecute: true,
    },
    {
      id: "refinement-recommendations",
      title: "Adaptive Refinement",
      description: "Suggest targeted refinement regions for improved accuracy.",
      promptTemplate: `Based on the mesh quality validation, recommend adaptive refinements:

1. **Near-wall regions** that need finer resolution
2. **Wake/recirculation zones** requiring additional cells
3. **Interface regions** between different mesh types
4. **Gradient-based** refinement suggestions (where flow gradients will be highest)

Provide refinement as specific sizing adjustments with expected impact on total cell count.
Current cell count: {{cellCount}}. Domain type: {{domainType}}.
Keep total cell count within 1.5× of target unless accuracy demands otherwise.`,
      requiresConfirmation: true,
      autoExecute: false,
    },
  ],
};

export const BOUNDARY_CONDITIONS_WORKFLOW: WorkflowTemplate = {
  id: "boundary-conditions",
  name: "Boundary Condition Setup",
  description: "Systematic boundary condition configuration with physics-based validation.",
  icon: "boundary",
  category: "pre-processing",
  estimatedMinutes: 6,
  steps: [
    {
      id: "bc-identification",
      title: "Boundary Identification",
      description: "Identify all boundary surfaces and classify their types.",
      promptTemplate: `For a {{applicationDomain}} simulation, identify and classify all boundary surfaces.

Flow configuration: {{flowConfig}}.
Working fluid: {{fluid}}.
Operating conditions: {{operatingConditions}}.

List each boundary with:
- **Name** and physical location
- **Type** (inlet, outlet, wall, symmetry, periodic, pressure-outlet, mass-flow-inlet, etc.)
- **Recommended BC type** for this application

Simulation: {{simulationName}}, turbulence model: {{turbulenceModel}}.`,
      inputs: [
        {
          key: "applicationDomain",
          label: "Application Domain",
          type: "select",
          options: [
            { label: "HVAC / Ventilation", value: "hvac" },
            { label: "Cleanroom", value: "cleanroom" },
            { label: "Data Center Cooling", value: "datacenter" },
            { label: "Exhaust System", value: "exhaust" },
            { label: "Turbomachinery", value: "turbomachinery" },
            { label: "External Flow", value: "external" },
          ],
          required: true,
        },
        {
          key: "flowConfig",
          label: "Flow Configuration",
          type: "text",
          placeholder: "e.g. 2 supply vents, 1 return, 4 walls, ceiling diffuser",
          required: true,
        },
        {
          key: "fluid",
          label: "Working Fluid",
          type: "select",
          options: [
            { label: "Air (standard)", value: "air-standard" },
            { label: "Air (humid)", value: "air-humid" },
            { label: "Water", value: "water" },
            { label: "Refrigerant (R134a)", value: "r134a" },
            { label: "Custom", value: "custom" },
          ],
          defaultValue: "air-standard",
        },
        {
          key: "operatingConditions",
          label: "Operating Conditions",
          type: "text",
          placeholder: "e.g. 25°C, 1 atm, 2 m/s supply velocity",
        },
      ],
      autoExecute: false,
    },
    {
      id: "bc-values",
      title: "Boundary Value Specification",
      description: "Set specific values for each boundary condition.",
      promptTemplate: `Based on the boundary identification, specify exact values for each boundary:

For each boundary provide:
1. **Velocity/Mass flow/Pressure** specification with exact values
2. **Turbulence** specification (TI + length scale, or k + ε/ω values)
3. **Thermal** boundary conditions (temperature, heat flux, or convection coefficient)
4. **Species** boundary conditions if applicable

Application: {{applicationDomain}}. Fluid: {{fluid}}.
Operating conditions: {{operatingConditions}}.

Format as a table ready for direct input into the solver configuration.
Include appropriate units (SI) for each value.`,
      autoExecute: true,
    },
    {
      id: "bc-validation",
      title: "Physics Validation",
      description: "Validate boundary conditions for physical consistency.",
      promptTemplate: `Validate the specified boundary conditions for physical consistency:

Check for:
1. **Mass conservation** — do inlet mass flows balance outlet conditions?
2. **Energy balance** — are thermal BCs thermodynamically consistent?
3. **Turbulence levels** — are inlet TI and length scales realistic for {{applicationDomain}}?
4. **Pressure specification** — any over-constrained or under-constrained boundaries?
5. **Numerical stability** — will these BCs cause initialization or convergence issues?
6. **Reference values** — are reference pressure and temperature set correctly?

Flag any issues with severity (Critical / Warning / Info) and provide corrections.`,
      autoExecute: true,
    },
    {
      id: "bc-best-practices",
      title: "Best Practice Recommendations",
      description: "Domain-specific tips and common pitfalls.",
      promptTemplate: `Provide domain-specific best practices for {{applicationDomain}} boundary conditions:

1. **Common pitfalls** for this application type
2. **Recommended relaxation factors** for these BCs
3. **Initialization strategy** — how to set initial conditions for fastest convergence
4. **Monitoring points** — where to place convergence monitors
5. **Expected flow features** — recirculation zones, stagnation points, high-gradient areas

Also suggest if any advanced BCs would improve accuracy:
- Non-reflecting outlets
- Turbulence profiles from database
- Time-varying inlet conditions
- Conjugate heat transfer surfaces`,
      autoExecute: true,
      requiresConfirmation: false,
    },
  ],
};

export const SOLVER_TUNING_WORKFLOW: WorkflowTemplate = {
  id: "solver-tuning",
  name: "Solver & Convergence Tuning",
  description: "Optimize solver settings, relaxation factors, and convergence criteria.",
  icon: "solver",
  category: "solving",
  estimatedMinutes: 5,
  steps: [
    {
      id: "solver-assessment",
      title: "Current Settings Assessment",
      description: "Evaluate current solver configuration against best practices.",
      promptTemplate: `Assess the current solver configuration:
- Turbulence model: {{turbulenceModel}}
- Cell count: {{cellCount}}
- Max iterations: {{maxIterations}}
- Current iteration: {{currentIteration}}
- Relaxation factors: pressure={{relaxPressure}}, velocity={{relaxVelocity}}, turbulence={{relaxTurbulence}}

Evaluate against best practices for this problem type.
Identify any settings that are sub-optimal or could cause convergence issues.
Rate current configuration: Optimal / Good / Needs Adjustment / Problematic.`,
      inputs: [
        {
          key: "relaxPressure",
          label: "Pressure Relaxation",
          type: "number",
          defaultValue: 0.3,
          hint: "Typical: 0.2–0.4",
        },
        {
          key: "relaxVelocity",
          label: "Velocity Relaxation",
          type: "number",
          defaultValue: 0.7,
          hint: "Typical: 0.5–0.8",
        },
        {
          key: "relaxTurbulence",
          label: "Turbulence Relaxation",
          type: "number",
          defaultValue: 0.8,
          hint: "Typical: 0.6–0.9",
        },
      ],
      autoExecute: false,
    },
    {
      id: "relaxation-optimization",
      title: "Relaxation Factor Optimization",
      description: "Calculate optimal relaxation factors for current problem.",
      promptTemplate: `Recommend optimal relaxation factors for this simulation:

Problem characteristics:
- Domain type: {{domainType}}
- Cell count: {{cellCount}}
- Turbulence model: {{turbulenceModel}}
- Flow regime: estimate from BCs

Provide a **staged strategy**:
1. **Phase 1** (iterations 1–100): aggressive relaxation for quick initialization
2. **Phase 2** (iterations 100–500): moderate relaxation for stable progress
3. **Phase 3** (500+): fine-tuned relaxation for final convergence

Include under-relaxation for: pressure, velocity, k, epsilon/omega, energy, and any species.`,
      autoExecute: true,
    },
    {
      id: "convergence-criteria",
      title: "Convergence Criteria Setup",
      description: "Define appropriate convergence criteria and monitors.",
      promptTemplate: `Define convergence criteria for this simulation:

1. **Residual targets** for each equation (continuity, momentum, energy, turbulence)
2. **Monitor points** — key physical quantities to track (drag, heat transfer, pressure drop)
3. **Convergence definition** — how many iterations monitors should be stable
4. **Max iteration limit** — recommended maximum based on problem complexity

Current max iterations: {{maxIterations}}.
Provide both residual-based AND monitor-based convergence criteria.
Explain what "converged" means for this specific application.`,
      autoExecute: true,
    },
  ],
};

export const POST_PROCESSING_WORKFLOW: WorkflowTemplate = {
  id: "post-processing",
  name: "Results Analysis & Reporting",
  description: "Systematic post-processing: extract metrics, validate physics, and generate reports.",
  icon: "postprocess",
  category: "post-processing",
  estimatedMinutes: 7,
  steps: [
    {
      id: "convergence-verification",
      title: "Convergence Verification",
      description: "Verify the solution has properly converged before extracting results.",
      promptTemplate: `Verify solution convergence:
- Simulation: {{simulationName}}
- Final iteration: {{currentIteration}} / {{maxIterations}}
- Turbulence model: {{turbulenceModel}}

Check:
1. Are residuals below target thresholds?
2. Are monitor quantities stable (< 0.1% variation over last 100 iterations)?
3. Is the mass balance closed (imbalance < 0.1%)?
4. Is the energy balance satisfied?

Rate convergence quality: Fully Converged / Acceptably Converged / Questionable / Not Converged.`,
      autoExecute: true,
    },
    {
      id: "metrics-extraction",
      title: "Key Metrics Extraction",
      description: "Extract and interpret the most important simulation metrics.",
      promptTemplate: `Extract key performance metrics for this {{applicationDomain}} simulation:

For the converged solution, calculate/report:
1. **Pressure drop** across the domain (Pa)
2. **Average velocities** at key cross-sections
3. **Temperature distribution** (min, max, average at key locations)
4. **Flow uniformity indices** where applicable
5. **Turbulence intensity** at critical locations
6. **Heat transfer coefficients** if thermal simulation

Compare each metric against:
- Industry standards / design targets
- ASHRAE / ISO guidelines if applicable
- Previous simulation results if available

Rate each metric: ✅ Within target / ⚠️ Marginal / ❌ Out of range.`,
      inputs: [
        {
          key: "applicationDomain",
          label: "Application Domain",
          type: "select",
          options: [
            { label: "HVAC / Ventilation", value: "hvac" },
            { label: "Cleanroom", value: "cleanroom" },
            { label: "Data Center", value: "datacenter" },
            { label: "Exhaust System", value: "exhaust" },
            { label: "Industrial Process", value: "industrial" },
          ],
          required: true,
        },
      ],
      autoExecute: false,
    },
    {
      id: "visualization-recommendations",
      title: "Visualization Recommendations",
      description: "Suggest the most informative visualization for this simulation.",
      promptTemplate: `Recommend visualizations for presenting the results of this {{applicationDomain}} simulation:

1. **Contour plots** — which variables on which planes/surfaces
2. **Vector plots** — where flow direction visualization is most informative
3. **Streamlines** — key seed locations for flow path visualization
4. **Iso-surfaces** — threshold values for identifying recirculation or stagnation
5. **Animation** — any transient features worth animating

For each, specify:
- Exact plane/surface location
- Color map range (min–max)
- Why this visualization is important for the stakeholder

Prioritize the top 5 most impactful visualizations.`,
      autoExecute: true,
    },
    {
      id: "report-generation",
      title: "Report Generation",
      description: "Generate a structured simulation report summary.",
      promptTemplate: `Generate a structured simulation report summary:

## Simulation Report: {{simulationName}}

Include sections:
1. **Executive Summary** — 2-3 sentence overview of findings
2. **Configuration** — mesh, solver, BCs (brief table format)
3. **Convergence** — residual history assessment
4. **Key Results** — primary metrics with pass/fail against targets
5. **Observations** — notable flow features, unexpected findings
6. **Recommendations** — design changes, further studies needed
7. **Confidence Level** — rate the reliability of these results

Application: {{applicationDomain}}.
Turbulence model: {{turbulenceModel}}, cell count: {{cellCount}}.
Format in clean markdown suitable for stakeholder review.`,
      autoExecute: true,
      requiresConfirmation: true,
    },
  ],
};

// ── Registry ────────────────────────────────────────────────────────────────

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  MESH_GENERATION_WORKFLOW,
  BOUNDARY_CONDITIONS_WORKFLOW,
  SOLVER_TUNING_WORKFLOW,
  POST_PROCESSING_WORKFLOW,
];

export function getWorkflowById(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}
