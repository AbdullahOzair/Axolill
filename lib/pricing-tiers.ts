export type PricingTier = {
  name: string;
  price: string;
  cadence?: string;
  description: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

/** Shared tier data — homepage Pricing and portal GetStarted both read from here. */
export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Starter",
    price: "$4k",
    cadence: "/ project",
    description: "For validating an idea with a focused, polished MVP.",
    features: [
      "1 landing page or MVP",
      "Custom UI/UX design",
      "Responsive & accessible build",
      "Basic analytics setup",
      "2 weeks of support",
    ],
    cta: "Start with Starter",
  },
  {
    name: "Growth",
    price: "$12k",
    cadence: "/ project",
    description: "For teams building a real product ready to scale.",
    features: [
      "Everything in Starter",
      "Full web or mobile app",
      "Backend & database",
      "AI feature integration",
      "CI/CD & cloud deployment",
      "Priority communication",
      "8 weeks of support",
    ],
    cta: "Choose Growth",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For complex, mission-critical systems at scale.",
    features: [
      "Everything in Growth",
      "Dedicated product team",
      "Scalable architecture design",
      "Advanced security & compliance",
      "Data analytics & dashboards",
      "SLA & ongoing retainer",
    ],
    cta: "Talk to Sales",
  },
];
