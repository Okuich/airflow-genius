export interface ServiceNode {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  status: "healthy" | "degraded" | "offline";
  metrics?: { label: string; value: string }[];
}

export interface Tier {
  id: string;
  label: string;
  color: string;
  nodes: ServiceNode[];
}

export type Region = "primary" | "secondary";

export interface RegionConfig {
  id: Region;
  label: string;
  location: string;
  status: "active" | "standby" | "syncing";
}
