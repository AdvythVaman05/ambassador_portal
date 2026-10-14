import { PrismaClient, Prisma } from "@prisma/client";
import { generatePassword, hashPassword } from "../src/lib/password";

const db = new PrismaClient();

/** Write a plain JS value into a Json column. */
const json = (value: unknown) => value as Prisma.InputJsonValue;

/** Row-level read of a Json rubric column, so the seed does not re-parse strings. */
function rubricLength(rubric: unknown) {
  return Array.isArray(rubric) ? rubric.length : 0;
}

type Track = "A" | "B" | "C" | "D" | "E";
type SubmissionType = "link" | "link_set" | "document" | "upload" | "structured" | "roster" | "quiz";
type Tier = "applicant" | "ambassador" | "senior" | "campus_lead" | "alumnus";

const ADMIN_PASSWORD = "Circle-Operator-2026";
const REVIEWER_PASSWORD = "Circle-Review-2026";

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function hoursAgo(n: number) {
  return new Date(Date.now() - n * 3600 * 1000);
}
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400 * 1000);
}

// Cohort 01: 12 weeks, fixed so "today" falls in week 5 — enough history to populate
// every screen, early enough that later-track tasks (C2+, B3+, D7, E2/E3) are honestly
// still locked. That "mostly locked, clearly gapped" state is itself the UI to get right.
const COHORT_START = new Date();
COHORT_START.setDate(COHORT_START.getDate() - 28); // 4 weeks ago -> "now" sits in week 5
COHORT_START.setHours(0, 0, 0, 0);
const COHORT_END = addDays(COHORT_START, 84);

function weekWindow(week: number) {
  return { opensAt: addDays(COHORT_START, (week - 1) * 7), dueAt: addDays(COHORT_START, week * 7 - 1) };
}

type TaskSeed = {
  code: string;
  track: Track;
  week: number;
  title: string;
  summary: string;
  briefMd: string;
  submissionType: SubmissionType;
  typeConfig: object;
  rubric: string[];
  signalValue: number;
  opensAt?: Date;
  dueAt?: Date;
};

const TASKS: TaskSeed[] = [
  {
    code: "A1",
    track: "A",
    week: 1,
    title: "Claim your ground",
    summary: "One page you own, at a URL you control.",
    briefMd:
      "Put up one page at a URL you control: a custom domain, or a free host if that is what you have. It should say who you are, what you are becoming, and what you are working on right now. No template bio. Write it like someone who knows exactly what they are doing, even if you do not feel like that yet.\n\nWhat good looks like: three short paragraphs, one clear sentence anyone could repeat about what you do, and a way to reach you.",
    submissionType: "link",
    typeConfig: { link: { label: "Your page", placeholder: "https://yourname.dev", noteLabel: "Anything we should know before we look" } },
    rubric: [
      "The page is live at a URL you control",
      "States who you are and what you are working on, plainly",
      "Has a way to reach you",
      "Reads like it was written by a person, not filled from a template",
    ],
    signalValue: 30,
  },
  {
    code: "A2",
    track: "A",
    week: 1,
    title: "One name, everywhere",
    summary: "Identical name, handle, headline and bio across five profiles.",
    briefMd:
      "Pick one version of your name and one headline. Use exactly that on LinkedIn, GitHub, X, your college profile, and the page you just built in A1. This is the single cheapest thing you can do to stop being three different half-people to anything trying to figure out who you are.\n\nWhat good looks like: five URLs, and a name and headline that match word for word across all of them.",
    submissionType: "link_set",
    typeConfig: {
      link_set: {
        rows: [
          { key: "own_page", label: "Your own page", placeholder: "https://yourname.dev" },
          { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/..." },
          { key: "github", label: "GitHub", placeholder: "https://github.com/..." },
          { key: "x", label: "X / Twitter", placeholder: "https://x.com/..." },
          { key: "college", label: "College profile", placeholder: "https://..." },
        ],
      },
    },
    rubric: [
      "All five URLs are live and belong to you",
      "The exact same name is used on every profile",
      "The exact same one-line headline is used on every profile",
    ],
    signalValue: 30,
  },
  {
    code: "A3",
    track: "A",
    week: 2,
    title: "Be machine-readable",
    summary: "Person JSON-LD with sameAs pointing at all five profiles.",
    briefMd:
      "Add Person structured data (JSON-LD, schema.org) to your page's HTML head, with a sameAs array pointing at every profile from A2. This is what tells a search engine, and eventually an assistant, that all five of those pages are the same human. Run it through Google's Rich Results Test and screenshot a pass.\n\nWhat good looks like: valid JSON-LD, no errors in the test, all five sameAs links present.",
    submissionType: "upload",
    typeConfig: { upload: { maxFiles: 3, label: "Rich Results Test screenshot(s)", captionLabel: "Paste your JSON-LD snippet here" } },
    rubric: [
      "Valid Person JSON-LD is present on the page",
      "sameAs includes all five A2 profiles",
      "Rich Results Test shows no errors",
    ],
    signalValue: 30,
  },
  {
    code: "A4",
    track: "A",
    week: 2,
    title: "Pick your lane",
    summary: "One narrow topic you will own for twelve weeks.",
    briefMd:
      "Choose one narrow topic. Not \"marketing\", not \"tech\". Something specific enough that in twelve weeks you could plausibly be the sharpest undergraduate voice on it. Write 300 words: why you, why this, why now.\n\nWhat good looks like: a topic narrow enough to sound almost too specific, and a rationale that is really about you, not a mission statement.",
    submissionType: "document",
    typeConfig: { document: { minWords: 250, maxWords: 400, placeholder: "My lane is..." } },
    rubric: [
      "The topic is genuinely narrow, not a broad category",
      "The rationale is specific to the writer, not generic",
      "Between 250 and 400 words",
    ],
    signalValue: 30,
  },
  {
    code: "A5",
    track: "A",
    week: 3,
    title: "The baseline",
    summary: "Eight-question prompt set, two assistants, five runs each.",
    briefMd:
      "Run the supplied eight-question prompt set about your lane and your name, across two AI assistants, five runs each question. Record the verbatim answer every time, and mark whether you were named. This is tedious on purpose. It is the same discipline Rothenhall runs for its own clients, and it is the only way a mention rate means anything.\n\nWhat good looks like: eighty rows, no shortcuts, verbatim answers, not summaries.",
    submissionType: "structured",
    typeConfig: {
      structured: {
        minRows: 10,
        columns: [
          { key: "prompt", label: "Prompt", type: "text" },
          { key: "surface", label: "Assistant", type: "select", options: ["ChatGPT", "Claude", "Perplexity", "Gemini"] },
          { key: "run", label: "Run #", type: "select", options: ["1", "2", "3", "4", "5"] },
          { key: "named", label: "Named you?", type: "select", options: ["Yes", "No"] },
          { key: "answer", label: "Verbatim answer", type: "textarea" },
        ],
      },
    },
    rubric: [
      "At least the required number of rows, five runs per prompt",
      "Answers are verbatim, not summarised",
      "Named yes/no is marked honestly for every row",
    ],
    signalValue: 30,
  },
  {
    code: "B1",
    track: "B",
    week: 3,
    title: "The teardown",
    summary: "900 to 1400 words. Mechanism, not opinion.",
    briefMd:
      "Take one thing in your lane apart. Not a hot take, a teardown: how it actually works, step by step, with the part most people get wrong. 900 to 1400 words, published on your own site.\n\nWhat good looks like: a reader finishes knowing something true they did not know before, stated plainly enough to repeat to a friend.",
    submissionType: "link",
    typeConfig: { link: { label: "Published URL", placeholder: "https://yourname.dev/..." } },
    rubric: [
      "900 to 1400 words",
      "Explains a mechanism, not just an opinion",
      "Published on a URL you control",
      "Not generic unsourced prose",
    ],
    signalValue: 60,
  },
  {
    code: "B2",
    track: "B",
    week: 5,
    title: "Primary research",
    summary: "Go get a number nobody has. Method, n and limits disclosed.",
    briefMd:
      "Go get a number that did not exist before you got it. Survey 30 peers, pull a public dataset and do something new with it, or run 20 prompts and count. State your method well enough that someone else could repeat it, state your sample size, and state the honest limits of what you found.\n\nWhat good looks like: a number nobody can just Google, and a method section that would survive a skeptical question.",
    submissionType: "link",
    typeConfig: { link: { label: "Published URL", placeholder: "https://yourname.dev/..." } },
    rubric: [
      "States a number that did not exist before this piece",
      "Method is described well enough to repeat",
      "Sample size stated, and limits stated honestly",
      "Published on a URL you control",
      "Not generic unsourced prose",
    ],
    signalValue: 60,
  },
  {
    code: "B3",
    track: "B",
    week: 7,
    title: "The interview",
    summary: "One operator or founder in your lane.",
    briefMd:
      "Interview one operator, founder, or senior practitioner working in your lane. Publish the transcript, lightly cleaned up, plus a short close on what you actually concluded from talking to them.\n\nWhat good looks like: real follow-up questions, not a script read in order, and a conclusion that could not have been written before the conversation happened.",
    submissionType: "link",
    typeConfig: { link: { label: "Published URL", placeholder: "https://yourname.dev/..." } },
    rubric: [
      "A real transcript, not a paraphrase",
      "Evidence of follow-up questions, not a fixed script",
      "A short closing take that draws on the conversation",
      "Published on a URL you control",
    ],
    signalValue: 60,
  },
  {
    code: "B4",
    track: "B",
    week: 9,
    title: "The explainer",
    summary: "BLUF, question-shaped H2s, atomic sections, per SOP-6.",
    briefMd:
      "Write the definitive explanation of one concept in your lane. Structure it per the house rule: the answer first, then headings shaped as the questions a reader actually has, each section standing on its own.\n\nWhat good looks like: a reader could skip straight to any heading and get a complete answer.",
    submissionType: "link",
    typeConfig: { link: { label: "Published URL", placeholder: "https://yourname.dev/..." } },
    rubric: [
      "Leads with the answer, not a wind-up",
      "Headings are shaped as real reader questions",
      "Each section is complete without needing the others",
      "Published on a URL you control",
    ],
    signalValue: 60,
  },
  {
    code: "B5",
    track: "B",
    week: 11,
    title: "The argument",
    summary: "A position you would defend, counter-argument answered.",
    briefMd:
      "Take a position in your lane you would actually defend in public. State the strongest version of the counter-argument, and answer it honestly, not by strawmanning it.\n\nWhat good looks like: a reader who disagreed with you going in has to admit you dealt with their best point.",
    submissionType: "link",
    typeConfig: { link: { label: "Published URL", placeholder: "https://yourname.dev/..." } },
    rubric: [
      "States a real, specific position",
      "States the strongest counter-argument fairly",
      "Answers it honestly, not with a strawman",
      "Published on a URL you control",
    ],
    signalValue: 60,
  },
  {
    code: "C1",
    track: "C",
    week: 4,
    title: "Ten conversations",
    summary: "What ten peers want their name known for.",
    briefMd:
      "Ask ten peers two questions: what they would want their own name known for, and what they think happens when someone searches it today. Write down what they actually said, not your summary of it.\n\nWhat good looks like: ten real people, real answers, and something you noticed across all ten that you did not expect.",
    submissionType: "roster",
    typeConfig: {
      roster: {
        minRows: 10,
        fields: [
          { key: "name", label: "Name", type: "text" },
          { key: "wantsKnownFor", label: "What they want to be known for", type: "textarea" },
          { key: "whatHappensNow", label: "What they think happens when searched today", type: "textarea" },
        ],
      },
    },
    rubric: ["At least ten people", "Answers are specific, not paraphrased into one voice", "A genuine observation across the set is named"],
    signalValue: 40,
  },
  {
    code: "C2",
    track: "C",
    week: 6,
    title: "The room",
    summary: "A 45-minute campus session. We supply the deck.",
    briefMd:
      "Run a 45-minute session on your campus in your lane. We supply the deck and the handout, you book the room and bring the people. Send photos, an attendee count, and the feedback form results.\n\nWhat good looks like: a real room, real attendance, and honest feedback, good or bad.",
    submissionType: "upload",
    typeConfig: { upload: { maxFiles: 6, label: "Photos and feedback summary", captionLabel: "Attendee count and one thing that went well or badly" } },
    rubric: ["The session actually happened, evidenced by photos", "An honest attendee count is given", "Feedback results are included, not just a claim it went well"],
    signalValue: 80,
  },
  {
    code: "C3",
    track: "C",
    week: 8,
    title: "The club",
    summary: "A club, cell or department co-hosts the next one.",
    briefMd:
      "Get one campus club, the placement cell, or a department to formally co-host your next session. Written confirmation, not a verbal maybe.\n\nWhat good looks like: a name, a role, and a date, in writing.",
    submissionType: "roster",
    typeConfig: { roster: { minRows: 1, fields: [{ key: "org", label: "Club, cell or department", type: "text" }, { key: "contact", label: "Contact name and role", type: "text" }, { key: "confirmation", label: "What they confirmed, in their words", type: "textarea" }] } },
    rubric: ["A specific organisation is named", "A named contact with a role is given", "Confirmation is in the organisation's own words, not paraphrased"],
    signalValue: 60,
  },
  {
    code: "C4",
    track: "C",
    week: 10,
    title: "The cohort",
    summary: "Three peers onto the waitlist, verified by email.",
    briefMd:
      "Bring three real peers onto the waitlist for what comes after this. Real people with real intent. Each one confirms by email, no bulk sign-ups.\n\nWhat good looks like: three people who would actually say yes if you called them right now.",
    submissionType: "roster",
    typeConfig: { roster: { minRows: 3, fields: [{ key: "name", label: "Name", type: "text" }, { key: "email", label: "Email used to confirm", type: "text" }, { key: "why", label: "Why they said yes", type: "textarea" }] } },
    rubric: ["Three real people, each independently confirmed", "No sign of bulk or fake sign-ups", "A real reason is given for each, not a form answer"],
    signalValue: 40,
  },
  {
    code: "C5",
    track: "C",
    week: 12,
    title: "The showcase",
    summary: "A public campus showcase of your work.",
    briefMd:
      "Run a public showcase on campus of the work from these twelve weeks. Bring the room you built in C2 and C3 back together and show them what you made.\n\nWhat good looks like: an audience seeing the actual arc of the work, not a slide about it.",
    submissionType: "upload",
    typeConfig: { upload: { maxFiles: 8, label: "Photos and a short recap", captionLabel: "What you showed and how it landed" } },
    rubric: ["The showcase actually happened", "It covers the real arc of the twelve weeks", "Evidence of an actual audience, not just the ambassador"],
    signalValue: 80,
  },
  {
    code: "D1",
    track: "D",
    week: 1,
    title: "What an answer engine actually does",
    summary: "Retrieval, grounding, and why a good page is not enough.",
    briefMd:
      "A short module on how a grounded assistant actually builds an answer: retrieval first, generation second, and why ranking well and being named are no longer the same problem.",
    submissionType: "quiz",
    typeConfig: {
      quiz: {
        questions: [
          { prompt: "A grounded assistant answers mainly from:", options: ["Model weights alone", "Live retrieval plus model weights", "A fixed lookup table", "Whatever ranks first on Google"], correctIndex: 1 },
          { prompt: "Ranking #1 in search results guarantees an AI citation.", options: ["True", "False"], correctIndex: 1 },
        ],
      },
    },
    rubric: ["Both questions answered correctly"],
    signalValue: 15,
    opensAt: weekWindow(1).opensAt,
    dueAt: weekWindow(8).dueAt,
  },
  {
    code: "D2",
    track: "D",
    week: 1,
    title: "Retrieval mechanics",
    summary: "Why being findable and being recommended are different problems.",
    briefMd: "Why a company (or a person) can be well known and still be invisible to every assistant that matters, and what actually closes that gap.",
    submissionType: "quiz",
    typeConfig: {
      quiz: {
        questions: [
          { prompt: "The overlap between top-10 Google rank and AI citation has:", options: ["Stayed constant", "Risen toward 100%", "Fallen sharply", "Never been measured"], correctIndex: 2 },
          { prompt: "A page can rank well and still never be cited by an assistant.", options: ["True", "False"], correctIndex: 0 },
        ],
      },
    },
    rubric: ["Both questions answered correctly"],
    signalValue: 15,
    opensAt: weekWindow(1).opensAt,
    dueAt: weekWindow(8).dueAt,
  },
  {
    code: "D3",
    track: "D",
    week: 1,
    title: "Entities and sameAs",
    summary: "Why a name collision costs you everything.",
    briefMd: "What an entity is to a machine, why sameAs matters, and how a name collision with someone else quietly erases you from consideration.",
    submissionType: "quiz",
    typeConfig: {
      quiz: {
        questions: [
          { prompt: "sameAs in Person schema is used to:", options: ["Improve page load speed", "Link separate profiles as one entity", "Hide a profile from search", "Rank a page higher"], correctIndex: 1 },
          { prompt: "A name collision with an unrelated, larger entity can make you harder to find, not easier.", options: ["True", "False"], correctIndex: 0 },
        ],
      },
    },
    rubric: ["Both questions answered correctly"],
    signalValue: 15,
    opensAt: weekWindow(1).opensAt,
    dueAt: weekWindow(8).dueAt,
  },
  {
    code: "D4",
    track: "D",
    week: 1,
    title: "Extractable content",
    summary: "BLUF, question headings, atomic sections.",
    briefMd: "The page-restructure rules that make a page quotable by a model: answer first, question-shaped headings, sections that stand alone.",
    submissionType: "quiz",
    typeConfig: {
      quiz: {
        questions: [
          { prompt: "BLUF stands for:", options: ["Best Layout, Uniform Format", "Bottom Line Up Front", "Broad Linking, Unified Framing", "Basic Language, User Friendly"], correctIndex: 1 },
          { prompt: "A section that requires the whole page to make sense is easier for a model to extract and quote.", options: ["True", "False"], correctIndex: 1 },
        ],
      },
    },
    rubric: ["Both questions answered correctly"],
    signalValue: 15,
    opensAt: weekWindow(1).opensAt,
    dueAt: weekWindow(8).dueAt,
  },
  {
    code: "D5",
    track: "D",
    week: 1,
    title: "The measurement standard",
    summary: "n>=5, rates not positions, two geographies.",
    briefMd: "Why one lucky screenshot means nothing, and what an actual measurement standard requires: repeated runs, a real sample, distributions instead of a single position.",
    submissionType: "quiz",
    typeConfig: {
      quiz: {
        questions: [
          { prompt: "The house measurement standard requires at minimum:", options: ["One run, any assistant", "n>=5 runs per prompt", "A single screenshot", "Only ChatGPT"], correctIndex: 1 },
          { prompt: "Reporting a single run as a fixed rank is acceptable if the result looks good.", options: ["True", "False"], correctIndex: 1 },
        ],
      },
    },
    rubric: ["Both questions answered correctly"],
    signalValue: 15,
    opensAt: weekWindow(1).opensAt,
    dueAt: weekWindow(8).dueAt,
  },
  {
    code: "D6",
    track: "D",
    week: 1,
    title: "Claims discipline",
    summary: "Banned phrasings, A/B/C source grading, never guarantee.",
    briefMd: "The house rules for stating a number honestly: never claim a rank, never guarantee placement, and how a claim gets graded A, B, or C by its source.",
    submissionType: "quiz",
    typeConfig: {
      quiz: {
        questions: [
          { prompt: "\"We rank #1 in ChatGPT\" is:", options: ["A fine claim if it is true that day", "A banned phrasing, citation is probabilistic", "Only banned if false", "Required by the measurement standard"], correctIndex: 1 },
          { prompt: "A Grade C stat (single source, possibly biased) can be quoted bare, without attribution or caveat.", options: ["True", "False"], correctIndex: 1 },
        ],
      },
    },
    rubric: ["Both questions answered correctly"],
    signalValue: 15,
    opensAt: weekWindow(1).opensAt,
    dueAt: weekWindow(8).dueAt,
  },
  {
    code: "D7",
    track: "D",
    week: 8,
    title: "The assessment",
    summary: "A graded practical: audit a supplied page.",
    briefMd:
      "Eight questions covering everything from D1 to D6, plus one graded practical: you are given a real page and asked to audit it against the house standard, in your own words.\n\nWhat good looks like: the practical reads like you actually did the audit, not like you recited the modules back.",
    submissionType: "quiz",
    typeConfig: {
      quiz: {
        questions: [
          { prompt: "Retrieval-first means an assistant's answer is built mainly from:", options: ["Model weights alone", "Live retrieval plus model weights", "Cached search snippets only", "Whatever the user typed"], correctIndex: 1 },
          { prompt: "sameAs in Person schema exists to:", options: ["Speed up page load", "Link separate profiles as one entity", "Rank a page higher", "Hide a profile"], correctIndex: 1 },
          { prompt: "BLUF means the page should:", options: ["Bury the answer in the conclusion", "Lead with the answer", "Use only bullet points", "Avoid headings"], correctIndex: 1 },
          { prompt: "The house measurement standard's minimum run count per prompt is:", options: ["1", "3", "5", "10"], correctIndex: 2 },
          { prompt: "\"Guaranteed AI placement\" is:", options: ["A strong differentiator to advertise", "Banned, citation cannot be guaranteed", "Fine with a small disclaimer", "Only banned for competitors"], correctIndex: 1 },
          { prompt: "A Grade A claim requires:", options: ["Any single mention", "Your own n>=5 measurement", "A competitor's blog post", "Nothing, if it sounds right"], correctIndex: 1 },
          { prompt: "An entity collision with a larger, unrelated brand tends to:", options: ["Have no effect", "Make you easier to find", "Bury you in retrieval", "Only matter for companies"], correctIndex: 2 },
          { prompt: "A page section written to stand alone, without the rest of the page, is:", options: ["Bad practice", "Easier for a model to extract and quote", "Irrelevant to AEO", "Only useful for SEO, not AEO"], correctIndex: 1 },
        ],
      },
    },
    rubric: ["Six of eight or better on the multiple choice", "The practical shows real analysis of the supplied page, not recited definitions"],
    signalValue: 60,
  },
  {
    code: "E1",
    track: "E",
    week: 3,
    title: "Baseline measurement",
    summary: "The same submission as A5, recorded to the measurement corpus.",
    briefMd:
      "This is the same baseline you ran for A5. Confirm it here so it is recorded against the measurement standard as your week-3 baseline, the number everything else in this program will be measured against.",
    submissionType: "structured",
    typeConfig: {
      structured: {
        minRows: 10,
        columns: [
          { key: "prompt", label: "Prompt", type: "text" },
          { key: "surface", label: "Assistant", type: "select", options: ["ChatGPT", "Claude", "Perplexity", "Gemini"] },
          { key: "run", label: "Run #", type: "select", options: ["1", "2", "3", "4", "5"] },
          { key: "named", label: "Named you?", type: "select", options: ["Yes", "No"] },
        ],
      },
    },
    rubric: ["Matches the method used in A5", "At least the required number of rows"],
    signalValue: 20,
  },
  {
    code: "E2",
    track: "E",
    week: 7,
    title: "Mid re-measure",
    summary: "Identical prompt set, identical method.",
    briefMd: "Run the exact same prompt set from your baseline, the same way, so the comparison is honest. Do not change the questions to flatter the result.",
    submissionType: "structured",
    typeConfig: {
      structured: {
        minRows: 10,
        columns: [
          { key: "prompt", label: "Prompt", type: "text" },
          { key: "surface", label: "Assistant", type: "select", options: ["ChatGPT", "Claude", "Perplexity", "Gemini"] },
          { key: "run", label: "Run #", type: "select", options: ["1", "2", "3", "4", "5"] },
          { key: "named", label: "Named you?", type: "select", options: ["Yes", "No"] },
        ],
      },
    },
    rubric: ["Identical prompt set to the baseline", "At least the required number of rows"],
    signalValue: 30,
  },
  {
    code: "E3",
    track: "E",
    week: 12,
    title: "Final re-measure and your page",
    summary: "Final numbers, plus your own before-and-after page.",
    briefMd:
      "Run the final measurement, then publish your own before-and-after page: baseline, mid, final, honestly reported, method disclosed. This is the terminal artifact of the whole program, and it is yours to keep.",
    submissionType: "link",
    typeConfig: { link: { label: "Published before-and-after page", placeholder: "https://yourname.dev/..." } },
    rubric: ["All three measurement points reported", "Method disclosed, limits stated honestly", "Published on a URL you control"],
    signalValue: 50,
  },
];

const MODULES = [
  { code: "D1", order: 1, title: "What an answer engine actually does", summary: "Retrieval first, generation second.", bodyMd: "A grounded assistant, ChatGPT search, Claude, Perplexity, Google AI Overviews, does not answer purely from what it memorised in training. It retrieves live pages and sources first, then generates an answer grounded in what it found. That single fact explains almost everything else in this program: a page that cannot be fetched, parsed, or trusted cannot be retrieved, no matter how good it is. Ranking well in a search index and being retrieved and named by an assistant are related but genuinely separate problems, and the gap between them is where this whole discipline lives." },
  { code: "D2", order: 2, title: "Retrieval mechanics", summary: "Why ranking and being recommended are different problems.", bodyMd: "The overlap between a top-ten Google ranking and an actual AI citation has been falling, and depending on the study it sits somewhere between roughly one in six and one in two. That is not a rounding error, it is a structural shift: an assistant only cites what it can retrieve cleanly, parse confidently, and trust enough to attribute. A company, or a person, can be strong on every traditional signal and still be functionally invisible to every assistant a buyer actually asks." },
  { code: "D3", order: 3, title: "Entities and sameAs", summary: "Why a name collision costs you everything.", bodyMd: "To a machine, you are not a name, you are an entity: a bundle of facts that either resolve consistently across the web or do not. sameAs is the schema.org property that tells a crawler \"these five URLs are the same person.\" Without it, and without a consistent name and bio across every profile, a search engine or an assistant has to guess whether your GitHub and your LinkedIn are even the same human. A name collision with a bigger, unrelated entity is worse: you are not merely ambiguous, you are quietly outranked by someone else's footprint every time your name comes up." },
  { code: "D4", order: 4, title: "Extractable content", summary: "BLUF, question headings, atomic sections.", bodyMd: "Write for extraction, not just for reading. BLUF, bottom line up front, means the answer comes before the wind-up, because a model pulling a quotable claim out of your page will grab the first clear sentence it finds. Headings shaped as the actual questions a reader has beat clever section titles, because a model matches a query to a heading far more literally than a human would. And every section should stand on its own: if a paragraph only makes sense with three paragraphs of context above it, it is much harder for anything to lift and quote cleanly." },
  { code: "D5", order: 5, title: "The measurement standard", summary: "n>=5, rates not positions, two geographies.", bodyMd: "One screenshot of one answer proves nothing, because these systems are not deterministic: ask the same question five times and you can get five different answers. The house standard is n>=5 runs per prompt, across at least two geographies where that is possible, reported as a rate, not a position. \"We rank #1 in ChatGPT\" is not just bad practice, it is often not even a coherent claim, because there is no fixed rank to hold. What you can honestly say is \"named in 4 of 5 runs.\" That sentence is defensible in a way a screenshot never is." },
  { code: "D6", order: 6, title: "Claims discipline", summary: "Banned phrasings, A/B/C source grading, never guarantee.", bodyMd: "Never guarantee AI placement, to anyone, ever, because nobody controls a retrieval system closely enough to promise an outcome inside it. Grade every number by its source: A is your own n>=5 measurement, B is two or more independent sources, C is a single source, and a Grade C stat only ever gets quoted with its attribution and its caveat attached, never bare. This is not caution for its own sake. It is the difference between a claim that survives a skeptical question and one that does not, and in a business built on measurement integrity, that difference is the entire product." },
];

const REWARDS = [
  { code: "circle_access", name: "Cohort directory and alumni access", description: "Peer network across every campus in the cohort, granted the moment you join.", tierGate: "ambassador" as Tier, signalGate: 0, fulfilmentType: "digital" as const },
  { code: "certificate", name: "Verified certificate", description: "A certificate that verifies at a public URL, once the assessment is passed.", tierGate: "senior" as Tier, signalGate: 500, fulfilmentType: "digital" as const },
  { code: "kit", name: "Physical kit", description: "T-shirt, stickers, and a notebook. Shipped once you are Senior, not at signup.", tierGate: "senior" as Tier, signalGate: 500, fulfilmentType: "shipped" as const },
  { code: "byline", name: "Byline on rothenhall.com", description: "A real published article under your name, canonical back to your own site.", tierGate: "campus_lead" as Tier, signalGate: 800, fulfilmentType: "digital" as const },
  { code: "operator_session", name: "1:1 operator session", description: "Forty-five minutes with a practising operator, career and craft.", tierGate: "campus_lead" as Tier, signalGate: 800, fulfilmentType: "scheduled" as const },
  { code: "observer_seat", name: "Founders Circle observer seat", description: "For the top three of the cohort. Access to rooms with real founders.", tierGate: "campus_lead" as Tier, signalGate: 900, fulfilmentType: "digital" as const },
  { code: "priority_interview", name: "Priority interview", description: "For the top three of the cohort. The honest version of the internship promise.", tierGate: "campus_lead" as Tier, signalGate: 900, fulfilmentType: "scheduled" as const },
  { code: "case_study", name: "Your before-and-after case study", description: "Your own published measurement story, from week one to week twelve.", tierGate: "alumnus" as Tier, signalGate: 1000, fulfilmentType: "digital" as const },
  { code: "lor", name: "Signed letter of recommendation", description: "Specific and evidence-backed, naming the graded work behind it.", tierGate: "alumnus" as Tier, signalGate: 1000, fulfilmentType: "digital" as const },
];

const CAMPUSES = [
  { name: "NIT Trichy", city: "Tiruchirappalli" },
  { name: "BITS Pilani", city: "Pilani" },
  { name: "IIT Bombay", city: "Mumbai" },
  { name: "IIM Ahmedabad", city: "Ahmedabad" },
  { name: "Christ University", city: "Bengaluru" },
  { name: "Manipal Institute of Technology", city: "Manipal" },
  { name: "Shiv Nadar University", city: "Delhi NCR" },
  { name: "Symbiosis, Pune", city: "Pune" },
];

const COLORS = ["#9a7a4a", "#a85c30", "#7c6238", "#8a4a26", "#5c5648", "#b79a6b", "#c67c48", "#3a352c"];

type AmbassadorSeed = {
  name: string;
  campus: string;
  lane: string;
  bio: string;
  color: string;
  progress: number; // 0..1, how far through the "available by week 5" tasks they are
};

const AMBASSADORS: AmbassadorSeed[] = [
  { name: "Ananya Rao", campus: "NIT Trichy", lane: "Developer tooling for solo founders", bio: "Third-year CS, building in public, writes about the tools nobody explains properly.", color: COLORS[0], progress: 0.92 },
  { name: "Devansh Kapoor", campus: "BITS Pilani", lane: "Climate tech go-to-market", bio: "Studying the business side of hard climate problems, not just the engineering.", color: COLORS[1], progress: 0.7 },
  { name: "Meera Suresh", campus: "IIT Bombay", lane: "Product design for regional languages", bio: "Design student obsessed with what \"good UX\" means outside English-first products.", color: COLORS[2], progress: 0.55 },
  { name: "Rahul Verma", campus: "Manipal Institute of Technology", lane: "Fintech for first-time earners", bio: "Writes about money products built for people getting their first payslip.", color: COLORS[3], progress: 0.4 },
  { name: "Priya Nair", campus: "Christ University", lane: "The creator economy in tier-2 India", bio: "Tracks how creators outside the metros actually build an audience and get paid.", color: COLORS[4], progress: 0.8 },
  { name: "Aditya Singh", campus: "Shiv Nadar University", lane: "Applied AI/ML research, explained plainly", bio: "Research-track undergrad who translates papers into things a founder can use.", color: COLORS[5], progress: 0.85 },
  { name: "Kavya Reddy", campus: "Symbiosis, Pune", lane: "Sustainability reporting for small businesses", bio: "Believes ESG for small business is mostly unbuilt, not just unsold.", color: COLORS[6], progress: 0.25 },
  { name: "Arjun Malhotra", campus: "IIM Ahmedabad", lane: "GTM motion design for B2B SaaS", bio: "MBA candidate, previously grew a campus startup to its first hundred customers.", color: COLORS[7], progress: 0.5 },
  { name: "Sneha Iyer", campus: "NIT Trichy", lane: "Health tech access in tier-2 and tier-3 cities", bio: "Pre-med turned builder, writes about the last mile of healthcare delivery.", color: COLORS[0], progress: 0.35 },
  { name: "Vikram Rao", campus: "BITS Pilani", lane: "Hardware and robotics for Indian manufacturing", bio: "Runs the campus robotics club, writing to bring manufacturing founders into the loop.", color: COLORS[1], progress: 0.6 },
];

async function main() {
  // This file invents ten people, their work, their Signal and a certificate that verifies
  // publicly. Run against a real database and the programme has a fake cohort in it that
  // looks identical to the real thing. So it refuses outside development unless someone
  // says the quiet part out loud with ALLOW_DEMO_SEED=1.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
    console.error(
      "Refusing to seed demo data into a production database.\n"
        + "  Real accounts come from scripts/bootstrap.ts (first admin) and the admin console.\n"
        + "  If you really mean it, re-run with ALLOW_DEMO_SEED=1."
    );
    process.exit(1);
  }

  console.log("Seeding Campus Circle...");

  // Clean slate.
  // Identity and audit rows point at users, so they go first.
  await db.auditEvent.deleteMany();
  await db.session.deleteMany();
  await db.magicLink.deleteMany();
  await db.signalLedger.deleteMany();
  await db.review.deleteMany();
  await db.submission.deleteMany();
  await db.rewardGrant.deleteMany();
  await db.certificate.deleteMany();
  await db.moduleProgress.deleteMany();
  await db.reward.deleteMany();
  await db.libraryModule.deleteMany();
  await db.task.deleteMany();
  await db.announcement.deleteMany();
  await db.application.deleteMany();
  await db.membership.deleteMany();
  await db.campus.deleteMany();
  await db.user.deleteMany();
  await db.cohort.deleteMany();

  const cohort = await db.cohort.create({
    data: { name: "Campus Circle, Cohort 01", startsAt: COHORT_START, endsAt: COHORT_END, status: "active" },
  });

  const campusRows = await Promise.all(
    CAMPUSES.map((c) => db.campus.create({ data: { name: c.name, city: c.city, cohortId: cohort.id } }))
  );
  const campusByName = new Map(campusRows.map((c) => [c.name, c]));

  // Demo credentials. Operators get fixed, typeable passwords because they are re-typed
  // during every review pass; ambassadors get random ones, printed once at the end of the
  // seed. This is seed data for a preview cohort, not a production bootstrap.
  const credentials: { email: string; password: string; who: string }[] = [];

  const admin = await db.user.create({
    data: {
      email: "kunal@rothenhall.com",
      name: "Kunal Mehta",
      role: "admin",
      avatarColor: "#1a1712",
      passwordHash: hashPassword(ADMIN_PASSWORD),
      passwordSetAt: new Date(),
    },
  });
  credentials.push({ email: admin.email, password: ADMIN_PASSWORD, who: "admin" });
  const reviewer = await db.user.create({
    data: {
      email: "ishaan@rothenhall.com",
      name: "Ishaan Verma",
      role: "reviewer",
      avatarColor: "#7c6238",
      passwordHash: hashPassword(REVIEWER_PASSWORD),
      passwordSetAt: new Date(),
    },
  });
  credentials.push({ email: reviewer.email, password: REVIEWER_PASSWORD, who: "reviewer" });

  const ambassadorUsers = [];
  for (const a of AMBASSADORS) {
    const ambassadorPassword = generatePassword();
    const user = await db.user.create({
      data: {
        email: `${a.name.toLowerCase().replace(/\s+/g, ".")}@campus.circle`,
        name: a.name,
        role: "ambassador",
        passwordHash: hashPassword(ambassadorPassword),
        passwordSetAt: new Date(),
        lane: a.lane,
        bio: a.bio,
        avatarColor: a.color,
        pageUrl: `https://${a.name.toLowerCase().split(" ")[0]}.dev`,
        showInDirectory: true,
        showOnLeaderboard: true,
      },
    });
    await db.membership.create({
      data: {
        userId: user.id,
        cohortId: cohort.id,
        campusId: campusByName.get(a.campus)!.id,
        tier: "ambassador",
        joinedAt: addDays(COHORT_START, -3),
      },
    });
    credentials.push({ email: user.email, password: ambassadorPassword, who: "ambassador" });
    ambassadorUsers.push({ ...user, progress: a.progress });
  }

  const taskRows: Awaited<ReturnType<typeof db.task.create>>[] = [];
  for (const t of TASKS) {
    const win = weekWindow(t.week);
    const row = await db.task.create({
      data: {
        cohortId: cohort.id,
        track: t.track,
        code: t.code,
        week: t.week,
        title: t.title,
        summary: t.summary,
        briefMd: t.briefMd,
        submissionType: t.submissionType,
        typeConfig: json(t.typeConfig),
        rubric: json(t.rubric),
        signalValue: t.signalValue,
        opensAt: t.opensAt ?? win.opensAt,
        dueAt: t.dueAt ?? win.dueAt,
      },
    });
    taskRows.push(row);
  }
  const taskByCode = new Map(taskRows.map((t) => [t.code, t]));

  for (const m of MODULES) {
    await db.libraryModule.create({ data: { code: m.code, title: m.title, summary: m.summary, bodyMd: m.bodyMd, order: m.order } });
  }

  const rewardRows = [];
  for (const r of REWARDS) {
    rewardRows.push(
      await db.reward.create({
        data: { code: r.code, name: r.name, description: r.description, tierGate: r.tierGate, signalGate: r.signalGate, fulfilmentType: r.fulfilmentType },
      })
    );
  }
  const rewardByCode = new Map(rewardRows.map((r) => [r.code, r]));

  // "Available by week 5" tasks in the order an ambassador would naturally clear them.
  const EARLY_CODES = ["A1", "A2", "A3", "A4", "A5", "D1", "D2", "D3", "D4", "D5", "D6", "C1", "B1", "E1"];

  // Curated ages (hours) for the four submissions currently sitting in the review queue,
  // chosen so the oldest breaches the 48h target and the admin alarm has something real to show.
  const B2_QUEUE_AGES: Record<string, number> = {
    "Ananya Rao": 61,
    "Devansh Kapoor": 58,
    "Priya Nair": 31,
    "Meera Suresh": 12,
    "Arjun Malhotra": 4,
  };

  /** The app computes these server-side on submit; the seed has to agree with it. */
  function withDerived(task: (typeof taskRows)[number], content: object) {
    const c = content as Record<string, unknown>;
    if (task.submissionType === "quiz" && Array.isArray(c.answers)) {
      const config = (task.typeConfig ?? {}) as { quiz?: { questions?: { correctIndex: number }[] } };
      const questions = config.quiz?.questions ?? [];
      const correct = questions.reduce((s, q, i) => s + ((c.answers as number[])[i] === q.correctIndex ? 1 : 0), 0);
      return { ...c, score: correct, total: questions.length || (c.answers as number[]).length };
    }
    return c;
  }

  function snapshotUrlFor(task: (typeof taskRows)[number], content: object) {
    const c = content as { url?: string };
    return task.submissionType === "link" && c.url ? c.url : null;
  }

  /**
   * Moves someone's tier and Signal to a demo value the calendar has not reached yet.
   * The gap is written to the ledger as an operator adjustment rather than only onto the
   * membership total: Signal is only worth anything if the ledger explains every point of it.
   */
  async function topUpSignal(userId: string, target: number, tier: "campus_lead" | "senior") {
    const current = await db.membership.findUniqueOrThrow({ where: { userId } });
    const delta = target - current.signalTotal;
    if (delta > 0) {
      await db.signalLedger.create({
        data: {
          userId,
          taskCode: "ADJ",
          taskTitle: "Signal recognised at enrolment",
          delta,
          reason: "Operator adjustment: work recognised from before this cohort",
          createdAt: addDays(COHORT_START, -2),
        },
      });
    }
    await db.membership.update({ where: { userId }, data: { tier, signalTotal: Math.max(target, current.signalTotal) } });
  }

  async function accept(user: { id: string; name: string }, task: (typeof taskRows)[number], content: object, submittedAgo: number, reviewedAgo: number) {
    const sub = await db.submission.create({
      data: {
        taskId: task.id,
        userId: user.id,
        status: "accepted",
        content: json(withDerived(task, content)),
        snapshotUrl: snapshotUrlFor(task, content),
        submittedAt: hoursAgo(submittedAgo),
      },
    });
    await db.review.create({
      data: {
        submissionId: sub.id,
        reviewerId: admin.id,
        decision: "accepted",
        rubricResults: json(Array(rubricLength(task.rubric)).fill(true)),
        feedbackMd: "Clean. Nothing to add.",
        reviewedAt: hoursAgo(reviewedAgo),
      },
    });
    await db.signalLedger.create({
      data: { userId: user.id, submissionId: sub.id, taskCode: task.code, taskTitle: task.title, delta: task.signalValue, reason: "Submission accepted", createdAt: hoursAgo(reviewedAgo) },
    });
    return task.signalValue;
  }

  async function submitPending(user: { id: string }, task: (typeof taskRows)[number], content: object, ageHours: number) {
    await db.submission.create({
      data: { taskId: task.id, userId: user.id, status: "submitted", content: json(withDerived(task, content)), snapshotUrl: snapshotUrlFor(task, content), submittedAt: hoursAgo(ageHours) },
    });
  }

  async function changesRequested(user: { id: string }, task: (typeof taskRows)[number], content: object) {
    const sub = await db.submission.create({
      data: { taskId: task.id, userId: user.id, status: "changes_requested", content: json(withDerived(task, content)), snapshotUrl: snapshotUrlFor(task, content), submittedAt: daysAgo(3) },
    });
    const rubricLen = rubricLength(task.rubric);
    const results = Array(rubricLen).fill(true);
    results[rubricLen - 1] = false;
    await db.review.create({
      data: {
        submissionId: sub.id,
        reviewerId: admin.id,
        decision: "changes_requested",
        rubricResults: json(results),
        feedbackMd: "Close. The last line of the rubric is the gap here, see the note on that line. Fix that and resubmit, everything else clears.",
        reviewedAt: daysAgo(2),
      },
    });
  }

  function sampleContent(task: (typeof taskRows)[number], name: string, lane: string) {
    switch (task.submissionType) {
      case "link":
        return { url: `https://${name.toLowerCase().split(" ")[0]}.dev/${task.code.toLowerCase()}`, note: "" };
      case "link_set":
        return {
          rows: [
            { key: "own_page", url: `https://${name.toLowerCase().split(" ")[0]}.dev` },
            { key: "linkedin", url: `https://linkedin.com/in/${name.toLowerCase().replace(/\s+/g, "")}` },
            { key: "github", url: `https://github.com/${name.toLowerCase().replace(/\s+/g, "")}` },
            { key: "x", url: `https://x.com/${name.toLowerCase().replace(/\s+/g, "")}` },
            { key: "college", url: `https://college.edu/~${name.toLowerCase().replace(/\s+/g, "")}` },
          ],
        };
      case "document":
        return { body: `My lane is ${lane.toLowerCase()}. I picked it because it sits exactly at the point I already spend my time thinking about, and because almost nobody my age is writing about it with any rigor. Most coverage here is either a press release or a hot take with no method behind it. Twelve weeks is enough to become the most careful undergraduate voice on this, not the loudest.`, wordCount: 62 };
      case "upload":
        return { files: [{ name: "evidence-1.jpg", caption: "Evidence attached for review." }] };
      case "structured":
        return { rows: Array.from({ length: 10 }, (_, i) => ({ prompt: `Who should I follow on ${lane.toLowerCase()}?`, surface: i % 2 === 0 ? "ChatGPT" : "Claude", run: String((i % 5) + 1), named: i > 6 ? "Yes" : "No" })) };
      case "roster":
        return { rows: Array.from({ length: 10 }, (_, i) => ({ name: `Peer ${i + 1}`, wantsKnownFor: "Being genuinely useful in their field", whatHappensNow: "Nothing specific comes up when searched" })) };
      case "quiz":
        return { answers: [1, 1], practicalText: "" }; // score/total are added by withDerived()
      default:
        return {};
    }
  }

  const ledgerSummaryLines: string[] = [];

  for (const amb of ambassadorUsers) {
    let total = 0;
    const cutoff = Math.round(EARLY_CODES.length * amb.progress);
    for (let i = 0; i < EARLY_CODES.length; i++) {
      const task = taskByCode.get(EARLY_CODES[i])!;
      const content = sampleContent(task, amb.name, amb.lane!);
      if (i < cutoff) {
        const daysBack = 15 - i; // spread reviews out realistically over the last few weeks
        total += await accept(amb, task, content, daysBack * 24 + 6, daysBack * 24);
      } else if (i === cutoff && amb.progress < 0.95) {
        await changesRequested(amb, task, content);
      }
      // else: not attempted yet — reads as "missed" or "open" depending on the task's own due date.
    }

    // B2 (this week's live task): queue members are mid-review, everyone else is either
    // done, working on it, or hasn't started — a realistic week-5 spread.
    const b2 = taskByCode.get("B2")!;
    const content = sampleContent(b2, amb.name, amb.lane!);
    if (B2_QUEUE_AGES[amb.name] !== undefined) {
      await submitPending(amb, b2, content, B2_QUEUE_AGES[amb.name]);
    } else if (amb.progress > 0.85) {
      total += await accept(amb, b2, content, 30, 18);
    }
    // otherwise: still open, no submission yet — shows as "open, N days left" on Home.

    await db.membership.update({ where: { userId: amb.id }, data: { signalTotal: total } });
    await db.rewardGrant.create({
      data: {
        userId: amb.id,
        rewardId: rewardByCode.get("circle_access")!.id,
        status: "fulfilled",
        earnedAt: addDays(COHORT_START, -5),
        claimedAt: addDays(COHORT_START, -4),
        fulfilledAt: addDays(COHORT_START, -3),
      },
    });
    ledgerSummaryLines.push(`  ${amb.name.padEnd(16)} ${total} Signal`);
  }

  // Module progress: everyone who's cleared D1-D4 in their task loop above also gets the
  // matching LibraryModule marked complete, so /library agrees with /tasks.
  const moduleRows = await db.libraryModule.findMany();
  for (const amb of ambassadorUsers) {
    const cutoff = Math.round(EARLY_CODES.length * amb.progress);
    const doneCodes = EARLY_CODES.slice(0, cutoff).filter((c) => c.startsWith("D"));
    for (const code of doneCodes) {
      const mod = moduleRows.find((m) => m.code === code);
      if (mod) await db.moduleProgress.create({ data: { userId: amb.id, moduleId: mod.id, completedAt: daysAgo(10) } });
    }
  }

  // One demo-only certificate + a fuller reward ladder, so the verify page, the admin
  // fulfilment queue, and the "claimed/fulfilled" pill states all have something real to
  // render. Noted here because it runs slightly ahead of what week 5 would honestly allow.
  const star = ambassadorUsers.find((a) => a.name === "Aditya Singh")!;
  await topUpSignal(star.id, 860, "campus_lead");
  await db.certificate.create({ data: { userId: star.id, publicId: "cc01-aditya-singh-7f3a", assessmentScore: 92, issuedAt: daysAgo(5) } });
  await db.rewardGrant.create({ data: { userId: star.id, rewardId: rewardByCode.get("certificate")!.id, status: "fulfilled", earnedAt: daysAgo(8), claimedAt: daysAgo(6), fulfilledAt: daysAgo(5) } });
  await db.rewardGrant.create({ data: { userId: star.id, rewardId: rewardByCode.get("kit")!.id, status: "claimed", detail: "Shiv Nadar University hostel address on file", earnedAt: daysAgo(9), claimedAt: daysAgo(2) } });
  await db.rewardGrant.create({ data: { userId: star.id, rewardId: rewardByCode.get("byline")!.id, status: "earned", earnedAt: daysAgo(4) } });
  await db.rewardGrant.create({ data: { userId: star.id, rewardId: rewardByCode.get("operator_session")!.id, status: "earned", earnedAt: daysAgo(4) } });

  const secondSenior = ambassadorUsers.find((a) => a.name === "Priya Nair")!;
  await topUpSignal(secondSenior.id, 540, "senior");
  await db.rewardGrant.create({ data: { userId: secondSenior.id, rewardId: rewardByCode.get("kit")!.id, status: "earned", earnedAt: daysAgo(6) } });

  await db.announcement.create({
    data: { cohortId: cohort.id, bodyMd: "Reviews on B2 are running slightly behind this week, we are aware and clearing the queue. Nothing you need to do differently.", publishedAt: daysAgo(1) },
  });
  await db.announcement.create({
    data: { cohortId: cohort.id, bodyMd: "C2 room-session decks are up in the Library. Book your room early, the good slots on most campuses go fast in week 6.", publishedAt: daysAgo(6) },
  });

  const applicantNames = [
    { name: "Ishita Bose", campus: "Jadavpur University", field: "Climate policy", status: "pending" as const },
    { name: "Yash Thakur", campus: "VIT Vellore", field: "Consumer fintech", status: "pending" as const },
    { name: "Riya Chatterjee", campus: "Ashoka University", field: "Media and platforms", status: "pending" as const },
    { name: "Farhan Sheikh", campus: "IIT Kharagpur", field: "Applied robotics", status: "accepted" as const },
    { name: "Ojas Patil", campus: "COEP Pune", field: "Supply chain tech", status: "rejected" as const },
  ];
  for (const a of applicantNames) {
    await db.application.create({
      data: {
        name: a.name,
        email: `${a.name.toLowerCase().replace(/\s+/g, ".")}@example.edu`,
        campus: a.campus,
        city: "",
        field: a.field,
        answerText:
          "It named three well-known people in the field and one company blog, but never a single student or early-career voice, even ones publishing genuinely good work I follow myself. It's clearly weighting existing reputation heavily rather than actual output quality, which feels like exactly the gap this program is pointed at.",
        status: a.status,
      },
    });
  }

  console.log(`Cohort: ${cohort.name}`);
  console.log(`Window: ${COHORT_START.toDateString()} -> ${COHORT_END.toDateString()}`);
  console.log(`Admin sign-in: ${admin.email}`);
  console.log("\nSeeded passwords (shown once — this database is a preview cohort):");
  for (const c of credentials) console.log(`  ${c.who.padEnd(10)} ${c.email.padEnd(34)} ${c.password}`);
  console.log("Ambassador Signal totals:");
  console.log(ledgerSummaryLines.join("\n"));
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
