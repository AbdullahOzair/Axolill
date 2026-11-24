export const INQUIRY_TYPES = ["IDEA", "PROJECT", "GUIDANCE"] as const;
export type InquiryType = typeof INQUIRY_TYPES[number];

export const INQUIRY_STAGES = ["new", "contacted", "qualified", "meeting", "proposal", "negotiation", "converted", "lost"] as const;
export type InquiryStage = typeof INQUIRY_STAGES[number];
export const STAGE_LABELS: Record<InquiryStage, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified", meeting: "Meeting Scheduled",
  proposal: "Proposal Sent", negotiation: "Negotiation", converted: "Converted", lost: "Lost",
};

export const INQUIRY_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type InquiryPriority = typeof INQUIRY_PRIORITIES[number];

export const INQUIRY_GROUPS = ["creative", "technology", "growth"] as const;
export type InquiryGroup = typeof INQUIRY_GROUPS[number];
export const GROUP_LABELS: Record<InquiryGroup, string> = {
  creative: "Creative & Design", technology: "Technology & Development", growth: "Marketing & Growth",
};

export const IDEA_CATEGORIES = [
  "A new business", "A website or application", "An innovative product",
  "An AI-powered solution", "Something else", "Still exploring",
] as const;
export const GUIDANCE_CATEGORIES = [
  "Growing my business", "Improving my website", "Building a digital presence",
  "Automating my business", "Choosing the right technology", "General consultation",
] as const;
export const CONSULTATION_METHODS = ["Google Meet", "Phone or WhatsApp", "Email", "No preference"] as const;

export const INQUIRY_COUNTRIES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
  "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM " +
  "US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

const regions = new Intl.DisplayNames(["en"], { type: "region" });
export function inquiryCountry(code: string) {
  return INQUIRY_COUNTRIES.includes(code) ? regions.of(code) ?? code : code;
}

export type InquiryServiceChoice = {
  key: string;
  serviceId: string;
  label: string;
  group: InquiryGroup;
};

export function inquiryServiceChoices(
  services: { id: string; title: string; items: string[] }[],
  mapping: Record<string, InquiryGroup>,
): InquiryServiceChoice[] {
  return services.flatMap((service) => {
    const items = [...new Set(service.items.map((item) => item.trim()).filter(Boolean))];
    return (items.length ? items : [service.title]).map((label) => {
      const key = JSON.stringify([service.id, label]);
      const byLabel = label.toLowerCase();
      const group = mapping[key] ??
        (/market|social|seo|advertis|growth|campaign|content|email/.test(byLabel) ? "growth" :
          /design|brand|creative|graphics|visual|ui\/ux|ux\/ui/.test(byLabel) ? "creative" :
          /market|growth/.test(service.title.toLowerCase()) && !/develop|engineer|website|automation|app\b/.test(byLabel) ? "growth" :
          "technology");
      return { key, serviceId: service.id, label, group };
    });
  });
}
