import {
  AppWindow,
  Blocks,
  BrainCircuit,
  Braces,
  Bot,
  ChartColumnBig,
  ChartLine,
  Cloud,
  CloudCog,
  Code,
  CodeXml,
  Cpu,
  Database,
  Frame,
  FlaskConical,
  Gauge,
  Globe,
  Headset,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  MessagesSquare,
  MonitorSmartphone,
  Palette,
  PenTool,
  Rocket,
  Search,
  Server,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react";

/**
 * Curated icon set for the CMS icon picker (Service.icon stores the key).
 *
 * Deliberately NOT `import * as lucide` — that would pull the entire ~1,500-icon
 * library into the client bundle. Add to this map to offer more choices.
 */
export const ICON_MAP = {
  AppWindow,
  Blocks,
  Bot,
  Braces,
  BrainCircuit,
  ChartColumnBig,
  ChartLine,
  Cloud,
  CloudCog,
  Code,
  CodeXml,
  Cpu,
  Database,
  Frame,
  FlaskConical,
  Gauge,
  Globe,
  Headset,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  MessagesSquare,
  MonitorSmartphone,
  Palette,
  PenTool,
  Rocket,
  Search,
  Server,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Workflow,
  Wrench,
  Zap,
} as const;

export type IconName = keyof typeof ICON_MAP;

export const ICON_NAMES = Object.keys(ICON_MAP) as IconName[];

/** Resolve a stored icon name. Falls back to Sparkles if it's unknown. */
export function iconFor(name: string) {
  return ICON_MAP[name as IconName] ?? Sparkles;
}
