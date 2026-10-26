// Central, typed content for the Campus Scouts site.
// Every person, project, article and issue below is DEMONSTRATION content
// (isDemo: true) until replaced with approved material from Rothenhall.

export const ROTHENHALL_URL = "https://www.rothenhall.com/";

export type Category =
  | "AI Visibility"
  | "AEO / GEO"
  | "Go-to-Market"
  | "Startup Growth"
  | "Research Methods"
  | "Business & Technology";

export type Role = "Scout" | "Advocate" | "Lead" | "Campus Head";

export interface Contributor {
  slug: string;
  name: string;
  role: Role;
  campus: string;
  discipline: string;
  interests: string[];
  bio: string;
  contribution: string;
  isDemo: true;
}

export interface Project {
  slug: string;
  category: string;
  title: string;
  summary: string;
  contributors: string[]; // contributor slugs
  skills: string[];
  problem: string;
  methodology: string;
  evidence: string;
  findings: string;
  limitations: string;
  contribution: string;
  isDemo: true;
}

export interface Article {
  slug: string;
  category: Category;
  title: string;
  excerpt: string;
  author: string; // contributor slug
  date: string; // ISO
  readingMinutes: number;
  body: string[];
  isDemo: true;
}

export interface BriefIssue {
  slug: string;
  number: number;
  title: string;
  date: string;
  summary: string;
  headlines: { title: string; author: string }[];
  topics: string[];
  editors: string[]; // contributor slugs
  isDemo: true;
}

export interface Faq {
  q: string;
  a: string;
}

export const navItems = [
  { label: "Program", to: "/about" },
  { label: "Insights", to: "/insights" },
  { label: "Student Work", to: "/projects" },
  { label: "The Brief", to: "/brief" },
] as const;

export const contributors: Contributor[] = [
  {
    slug: "maya-okafor",
    name: "Maya Okafor",
    role: "Lead",
    campus: "Demo University",
    discipline: "Economics & Data Science",
    interests: ["AI visibility", "Research methods"],
    bio: "Studies how buyers discover software through AI assistants, and how small evidence sets can still produce honest conclusions.",
    contribution:
      "Designed a repeatable prompt-set method for auditing how AI assistants describe a business category.",
    isDemo: true,
  },
  {
    slug: "leo-brandt",
    name: "Leo Brandt",
    role: "Scout",
    campus: "Demo Institute of Technology",
    discipline: "Computer Science",
    interests: ["Go-to-market", "Automation"],
    bio: "Builds small tools that turn messy research notes into structured, comparable data.",
    contribution: "Wrote the scripts that organise industry research sources for the Brief.",
    isDemo: true,
  },
  {
    slug: "priya-raman",
    name: "Priya Raman",
    role: "Advocate",
    campus: "Demo College of Business",
    discipline: "Marketing & Strategy",
    interests: ["Startup growth", "Positioning"],
    bio: "Interested in why some young companies explain themselves clearly and others never quite do.",
    contribution: "Leads the Go-to-Market section of The Rothenhall Brief.",
    isDemo: true,
  },
  {
    slug: "tomas-alvarez",
    name: "Tomás Alvarez",
    role: "Scout",
    campus: "Demo University",
    discipline: "Design & Media",
    interests: ["Explainers", "Information design"],
    bio: "Turns research into diagrams people actually read.",
    contribution: "Designs the visual explainers that accompany Brief issues.",
    isDemo: true,
  },
];

export const projects: Project[] = [
  {
    slug: "ai-visibility-audit",
    category: "AI Visibility Audit",
    title: "How do AI assistants describe campus coffee roasters?",
    summary:
      "A structured audit of how answer engines describe a local business category, and which public sources they appear to rely on.",
    contributors: ["maya-okafor", "leo-brandt"],
    skills: ["Prompt design", "Source analysis", "Spreadsheet modelling"],
    problem:
      "Small businesses rarely know how AI assistants describe them, or whether those descriptions are accurate.",
    methodology:
      "A fixed set of 40 buyer-style questions run across several assistants, with answers coded for mentions, accuracy and cited sources.",
    evidence:
      "Illustrative sample only: answer transcripts and a coding sheet would be attached here.",
    findings:
      "Illustrative: businesses with consistent, well-structured public information were described more accurately. No real results are claimed.",
    limitations:
      "Small sample, answers change over time, and assistants do not always disclose sources.",
    contribution: "Maya designed the method; Leo built the coding sheet and source tracker.",
    isDemo: true,
  },
  {
    slug: "industry-research-brief",
    category: "Industry Research Brief",
    title: "Climate software buyers: what questions come first?",
    summary:
      "A desk-research brief mapping the early questions buyers ask before shortlisting climate software vendors.",
    contributors: ["priya-raman"],
    skills: ["Desk research", "Synthesis", "Writing"],
    problem: "Vendors often answer the questions buyers ask last, not the ones they ask first.",
    methodology:
      "Review of public forums, analyst summaries and vendor FAQs, grouped into a buyer-question map.",
    evidence: "Illustrative sample only: source list and question map.",
    findings:
      "Illustrative: early questions focused on data requirements and integration effort rather than features.",
    limitations: "Public sources only; no buyer interviews were conducted.",
    contribution: "Researched and written by Priya; reviewed before publication.",
    isDemo: true,
  },
  {
    slug: "growth-experiment",
    category: "Growth Experiment",
    title: "Does a clearer one-line description change sign-ups for a student society?",
    summary:
      "A small, documented A/B experiment on a society's landing page, run with the society's permission.",
    contributors: ["tomas-alvarez", "priya-raman"],
    skills: ["Experiment design", "Copywriting", "Analysis"],
    problem: "Student societies struggle to explain what they do in one sentence.",
    methodology:
      "Two page variants, equal traffic split over two weeks, sign-up as the single metric.",
    evidence: "Illustrative sample only: variant screenshots and a results table.",
    findings:
      "Illustrative: the outcome is shown as an example of reporting format, not a real result.",
    limitations: "Low traffic, short duration, no significance claimed.",
    contribution: "Tomás designed variants; Priya wrote copy and the write-up.",
    isDemo: true,
  },
];

export const articles: Article[] = [
  {
    slug: "what-is-ai-visibility",
    category: "AI Visibility",
    title: "What AI visibility actually means for a small business",
    excerpt:
      "When a buyer asks an assistant for a recommendation, which businesses get named, and why?",
    author: "maya-okafor",
    date: "2026-10-12",
    readingMinutes: 6,
    body: [
      "Search used to return a list of links. AI assistants increasingly return an answer. That shift changes what it means to be visible.",
      "This demonstration article outlines the basic idea and points to Rothenhall Partners for the authoritative view.",
    ],
    isDemo: true,
  },
  {
    slug: "aeo-geo-explained",
    category: "AEO / GEO",
    title: "AEO and GEO, explained without the acronyms",
    excerpt: "Answer Engine Optimization and Generative Engine Optimization, in plain language.",
    author: "leo-brandt",
    date: "2026-10-05",
    readingMinutes: 5,
    body: ["A plain-language introduction to two terms that are often used loosely."],
    isDemo: true,
  },
  {
    slug: "positioning-before-promotion",
    category: "Go-to-Market",
    title: "Positioning before promotion",
    excerpt:
      "Why the clearest companies decide what they are before deciding where to shout about it.",
    author: "priya-raman",
    date: "2026-09-28",
    readingMinutes: 7,
    body: [
      "Promotion amplifies whatever message already exists. That makes positioning the first job.",
    ],
    isDemo: true,
  },
  {
    slug: "small-samples-honest-conclusions",
    category: "Research Methods",
    title: "Small samples, honest conclusions",
    excerpt: "How to write up student research without overstating what the evidence shows.",
    author: "maya-okafor",
    date: "2026-09-21",
    readingMinutes: 4,
    body: ["Good research says exactly as much as the evidence supports, and no more."],
    isDemo: true,
  },
  {
    slug: "early-stage-growth-loops",
    category: "Startup Growth",
    title: "Growth loops for teams of two",
    excerpt: "What growth looks like before there is a growth team.",
    author: "priya-raman",
    date: "2026-09-14",
    readingMinutes: 6,
    body: ["Early teams grow through repeatable habits rather than large campaigns."],
    isDemo: true,
  },
  {
    slug: "diagrams-that-get-read",
    category: "Business & Technology",
    title: "Diagrams that actually get read",
    excerpt: "A short guide to turning a research finding into a single, honest visual.",
    author: "tomas-alvarez",
    date: "2026-09-07",
    readingMinutes: 3,
    body: ["One idea per diagram. Label everything. Remove what does not help."],
    isDemo: true,
  },
];

export const briefIssues: BriefIssue[] = [
  {
    slug: "issue-003",
    number: 3,
    title: "When the answer replaces the search",
    date: "2026-10-16",
    summary:
      "Scouts look at how buyers use AI assistants to shortlist vendors, what Rothenhall means by AI visibility, and a field note from a campus research sprint.",
    headlines: [
      { title: "The shortlist now starts in a chat window", author: "maya-okafor" },
      { title: "Inside Rothenhall: the idea behind Cailyx", author: "priya-raman" },
      { title: "Field note: one week, forty prompts", author: "leo-brandt" },
    ],
    topics: ["AI visibility", "Rothenhall", "Research", "Community"],
    editors: ["maya-okafor", "priya-raman", "leo-brandt", "tomas-alvarez"],
    isDemo: true,
  },
  {
    slug: "issue-002",
    number: 2,
    title: "Positioning is a research problem",
    date: "2026-10-09",
    summary:
      "On why positioning starts with listening, plus a buyer-question map for climate software.",
    headlines: [
      { title: "Listen first, then position", author: "priya-raman" },
      { title: "Mapping the first buyer questions", author: "priya-raman" },
    ],
    topics: ["Go-to-market", "Research"],
    editors: ["priya-raman", "tomas-alvarez"],
    isDemo: true,
  },
  {
    slug: "issue-001",
    number: 1,
    title: "Introducing The Rothenhall Brief",
    date: "2026-10-02",
    summary:
      "The first issue: who writes the Brief, how it is reviewed, and what to expect each week.",
    headlines: [{ title: "Why Scouts write this publication", author: "maya-okafor" }],
    topics: ["Community", "Rothenhall"],
    editors: ["maya-okafor"],
    isDemo: true,
  },
];

export const faqs: Faq[] = [
  {
    q: "What is Campus Scouts?",
    a: "A student initiative of Rothenhall Partners. Scouts research, write, create and run projects related to AI visibility, go-to-market and business growth, and produce The Rothenhall Brief.",
  },
  {
    q: "Who can apply?",
    a: "Currently enrolled students who are curious, proactive and willing to finish what they start. No particular degree is required.",
  },
  {
    q: "What is the expected time commitment?",
    a: "Participation is flexible and part-time, designed to fit around studies. Expectations are discussed during selection.",
  },
  {
    q: "Is this a paid position?",
    a: "No. Campus Scouts is not a paid role. Its value is practical experience, demonstrable work and authorship.",
  },
  {
    q: "What kinds of work can I contribute?",
    a: "Research, articles, data analysis, technical projects, design, explainers, content and campus initiatives.",
  },
  {
    q: "How does progression work?",
    a: "Roles move from Scout to Advocate, Lead and Campus Head as responsibility grows, based on the quality and consistency of contribution. There are no fixed thresholds.",
  },
  {
    q: "How does the newsletter work?",
    a: "Scouts research and write The Rothenhall Brief each week. Rothenhall supplies or approves official company information and reviews each issue before release.",
  },
  {
    q: "Will my work be published?",
    a: "Selected contributions may be published after editorial review and with your consent. Publication is not guaranteed.",
  },
  {
    q: "Are merchandise or rewards guaranteed?",
    a: "No. Recognition focuses on attribution and visibility of your work, not merchandise or rewards.",
  },
  {
    q: "Does participation guarantee an internship or job?",
    a: "No. Participation does not guarantee an internship, employment or any recommendation.",
  },
];

export const progression: { role: Role; summary: string }[] = [
  {
    role: "Scout",
    summary: "Contributes research, writing or project work and learns the editorial process.",
  },
  {
    role: "Advocate",
    summary: "Contributes consistently and helps bring others into projects on campus.",
  },
  {
    role: "Lead",
    summary: "Coordinates a project, section of the Brief or small team of contributors.",
  },
  {
    role: "Campus Head",
    summary: "Takes responsibility for the initiative's activity and quality on a campus.",
  },
];

export const getContributor = (slug: string) => contributors.find((c) => c.slug === slug);
export const getProject = (slug: string) => projects.find((p) => p.slug === slug);
export const getArticle = (slug: string) => articles.find((a) => a.slug === slug);
export const getIssue = (slug: string) => briefIssues.find((i) => i.slug === slug);

export const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
