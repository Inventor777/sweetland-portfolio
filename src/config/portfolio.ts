export type PortfolioSectionId = "projects" | "work" | "collabs" | "contact";

export type PortfolioSection = {
  id: PortfolioSectionId;
  title: string;
  description: string;
  url: string;         // where to navigate users
  embedUrl?: string;   // optional separate embed URL (e.g., a public Notion page)
  hotkey: "Digit1" | "Digit2" | "Digit3" | "Digit4";
};

export const PORTFOLIO_SECTIONS: PortfolioSection[] = [
  {
    id: "projects",
    title: "Projects",
    description: "Featured builds, demos, and case studies.",
    url: "https://example.com/projects",
    hotkey: "Digit1"
  },
  {
    id: "work",
    title: "Work",
    description: "Experience, roles, and outcomes.",
    url: "https://example.com/work",
    hotkey: "Digit2"
  },
  {
    id: "collabs",
    title: "Collabs",
    description: "UGC, partnerships, and creative collaborations.",
    url: "https://example.com/collabs",
    hotkey: "Digit3"
  },
  {
    id: "contact",
    title: "Contact",
    description: "Let’s talk. Links + socials + email.",
    url: "https://example.com/contact",
    hotkey: "Digit4"
  }
];
