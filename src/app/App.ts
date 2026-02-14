import * as THREE from "three";
import { Input } from "../core/Input";
import { qs } from "../core/dom";
import { Physics } from "../physics/Physics";
import { Level } from "../world/Level";
import { Player } from "../player/Player";
import { ThirdPersonCamera } from "../player/ThirdPersonCamera";
import { UI } from "../ui/UI";
import { AudioManager } from "../audio/AudioManager";
import { PORTFOLIO_SECTIONS } from "../config/portfolio";
import type { PortfolioSectionId } from "../config/portfolio";

// __SL_NPC_DIALOGUE_OVERRIDES_V8D (generated patch: UI-name keyed NPC dialogue + display-name overrides)
function __slNormNameV8d(s: any): string {
  const t = (s == null ? "" : String(s));
  return t.replace(/\s+/g, " ").trim();
}
type __SlNpcOverrideV8d = { name: string; lines: string[] };
const __SL_NPC_OVERRIDES_V8D: Record<string, __SlNpcOverrideV8d> = Object.create(null);
(function __slInitNpcOverridesV8d(){
  function add(k: string, v: __SlNpcOverrideV8d){
    const nk = __slNormNameV8d(k);
    if (!nk) return;
    __SL_NPC_OVERRIDES_V8D[nk] = v;
  }
  function addWithAliases(k: string, v: __SlNpcOverrideV8d){
    add(k, v);
    const m = /^(.+?)\s*0?(\d+)$/.exec(__slNormNameV8d(k));
    if (m) {
      const base = __slNormNameV8d(m[1]);
      const num = parseInt(m[2], 10);
      if (!isNaN(num)) {
        add(base + " " + String(num), v);
        const num2 = String(num).padStart(2, "0");
        add(base + " " + num2, v);
      }
    }
    // Also allow matching by the NEW display name, just in case some code path uses renamed names.
    add(v.name, v);
  }

  addWithAliases("Grummy 01", { name: "Goldie Gum", lines: ["Hi, welcome to the Chloeverse! If you've never been here before, feel free to explore Chloe's Candy Castle! If you're looking for her work, feel free to explore the castle and meet everyone along the way, or press 1-4 to teleport instantly to the portals. Thanks for stopping by!"]});
  addWithAliases("Grummy 02", { name: "Rubycakes", lines: [
    "Hope you're having fun! if you're lucky, you might even catch the Candy King in town."
  ]});
  addWithAliases("Grummy 03", { name: "Scarlet Squish", lines: [
    "Chloe's first ever videos were her slime and squishy making tutorials! If you've ever enjoyed any of her content, now you know it all started from a love of making DIY squishies and slime :)"
  ]});
  addWithAliases("Grummy 04", { name: "Amberling", lines: [
    "If you ask Chloe what life is all about, she'll replay with Frog and Toad. If you know, you know."
  ]});
  addWithAliases("Grummy 05", { name: "Limesnap", lines: [
    "You're really exploring all the nooks and crannies of Candy Castle, aren't you? Here's a secret, Chloe's favorite candy isa three-way tie between Sourpatch kids Watermelon, Sourstrings, and unexpectedly, Peppermint Bark! When in doubt, the sour shall show the way!"
  ]});
  addWithAliases("Sweetbloom 01", { name: "Gumball", lines: [
    "Thanks for checking in with me! Next up is the last portal, but the real important piece of news here is that the joys of candy outweigh the health hazards of adulting...or something, right?"
  ]});
})();

function __slNpcOverrideV8d(uiName: any): __SlNpcOverrideV8d | undefined {
  const k = __slNormNameV8d(uiName);
  if (!k) return undefined;
  return __SL_NPC_OVERRIDES_V8D[k];
}

function __slNpcDisplayNameV8d(uiName: any): string {
  const o = __slNpcOverrideV8d(uiName);
  return o ? o.name : __slNormNameV8d(uiName);
}

function __slNpcLinesByUINameV8d(uiName: any): string[] | undefined {
  const o = __slNpcOverrideV8d(uiName);
  return o ? o.lines : undefined;
}

function __slTryFindNpcUiNameV8d(focus: any, ctx: any): string | undefined {
  // 1) Direct fields
  const direct = [focus?.uiName, focus?.name, focus?.dispName, focus?.label, focus?.title, focus?.npcName];
  for (let i = 0; i < direct.length; i++) {
    const k = __slNormNameV8d(direct[i]);
    if (k && __SL_NPC_OVERRIDES_V8D[k]) return k;
  }

  // 2) focus may reference an npc/entity object
  const candObjs = [focus?.npc, focus?.entity, focus?.obj, focus?.target];
  for (let i = 0; i < candObjs.length; i++) {
    const n = __slNormNameV8d(candObjs[i]?.name ?? candObjs[i]?.dispName);
    if (n && __SL_NPC_OVERRIDES_V8D[n]) return n;
  }

  // 3) If we only have an id, try to find an npc in common containers on ctx
  const fid = focus?.id;
  if (!fid || !ctx) return undefined;
  const containers = [ctx?.world?.npcs, ctx?.level?.npcs, ctx?.npcs, ctx?.scene?.npcs, ctx?.game?.npcs];
  for (let c = 0; c < containers.length; c++) {
    const arr = containers[c];
    if (!Array.isArray(arr)) continue;
    for (let j = 0; j < arr.length; j++) {
      const it = arr[j];
      if (!it) continue;
      if (it.id === fid || it.key === fid || it.npcId === fid) {
        const nm = __slNormNameV8d(it.name ?? it.dispName);
        if (nm) return nm;
      }
    }
  }
  return undefined;
}

function __slNpcLinesFromFocusV8d(focus: any, ctx: any): string[] | undefined {
  const uiName = __slTryFindNpcUiNameV8d(focus, ctx);
  return uiName ? __slNpcLinesByUINameV8d(uiName) : undefined;
}




// --- Sweetland NPC Overrides (v4) ---
type __SlNpcOverride = { displayName: string; lines: string[] };

const __SL_NPC_OVERRIDES: Record<string, __SlNpcOverride> = {
  "Grummy 01": {
    displayName: "Goldie Gum",
    lines: [
      "Hi, welcome to the Chloeverse! If you've never been here before, feel free to explore Chloe's Candy Castle! If you're looking for her work, feel free to explore the castle and meet everyone along the way, or press 1-4 to teleport instantly to the portals. Thanks for stopping by!"
    ],
  },
  "Grummy 02": {
    displayName: "Rubycakes",
    lines: [
      "Hope you're having fun! if you're lucky, you might even catch the Candy King in town."
    ],
  },
  "Grummy 03": {
    displayName: "Scarlet Squish",
    lines: [
      "Chloe's first ever videos were her slime and squishy making tutorials! If you've ever enjoyed any of her content, now you know it all started from a love of making DIY squishies and slime :)"
    ],
  },
  "Grummy 04": {
    displayName: "Amberling",
    lines: [
      "If you ask Chloe what life is all about, she'll replay with Frog and Toad. If you know, you know."
    ],
  },
  "Grummy 05": {
    displayName: "Limesnap",
    lines: [
      "You're really exploring all the nooks and crannies of Candy Castle, aren't you? Here's a secret, Chloe's favorite candy isa three-way tie between Sourpatch kids Watermelon, Sourstrings, and unexpectedly, Peppermint Bark! When in doubt, the sour shall show the way!"
    ],
  },
  "Sweetbloom 01": {
    displayName: "Gumball",
    lines: [
      "Thanks for checking in with me! Next up is the last portal, but the real important piece of news here is that the joys of candy outweigh the health hazards of adulting...or something, right?"
    ],
  },
};

function __slCanonName(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, "");
}

function __slDigitAliases(raw: string): string[] {
  const out = new Set([raw]);
  const m = String(raw).match(/^(.*?)(\d+)$/);
  if (m) {
    const prefix = m[1];
    const digits = m[2];
    const noZero = String(parseInt(digits, 10));
    const pad2 = noZero.length === 1 ? "0" + noZero : noZero;
    out.add(prefix + noZero);
    out.add(prefix + pad2);
    // Also with a space before digits if missing (helps "GummiBear 01" vs "GummiBear01")
    out.add(prefix.trimEnd() + " " + noZero);
    out.add(prefix.trimEnd() + " " + pad2);
  }
  return Array.from(out);
}

function __slBuildNpcIndex(): Map<string, __SlNpcOverride> {
  const idx = new Map<string, __SlNpcOverride>();
  const add = (k: string, v: __SlNpcOverride) => {
    if (!k) return;
    for (const a of __slDigitAliases(k)) idx.set(__slCanonName(a), v);
  };
  for (const [uiName, ov] of Object.entries(__SL_NPC_OVERRIDES)) {
    add(uiName, ov);
    add(ov.displayName, ov); // fallback if some path uses the renamed display name
  }
  return idx;
}

const __SL_NPC_INDEX = __slBuildNpcIndex();

function __slFindNpcOverride(name: any): __SlNpcOverride | undefined {
  if (typeof name !== "string") return undefined;
  const key = __slCanonName(name);
  if (!key) return undefined;
  return __SL_NPC_INDEX.get(key);
}

function __slNpcDisplayName(uiName: any): string {
  if (typeof uiName !== "string") return String(uiName ?? "");
  const ov = __slFindNpcOverride(uiName);
  return ov?.displayName ?? uiName;
}

function __slNpcLinesFromFocus(focus: any): string[] | undefined {
  const candidates: string[] = [];
  const push = (v: any) => {
    if (typeof v === "string" && v.trim()) candidates.push(v);
  };

  // Common candidate fields across iterations
  push(focus?.uiName);
  push(focus?.name);
  push(focus?.dispName);
  push(focus?.label);
  push(focus?.title);
  push(focus?.id);

  // Sometimes focus stores the npc object
  push(focus?.npc?.name);
  push(focus?.npcName);

  for (const c of candidates) {
    const ov = __slFindNpcOverride(c);
    if (ov?.lines?.length) return ov.lines;
  }

  // Fall back to existing NPC_DIALOGUE table (by whatever key a given build uses)
  try {
    // IMPORTANT: This is only evaluated at runtime (after module init),
    // so it won’t trip TDZ as long as this function isn't called during module init.
    const tbl: any = (globalThis as any).NPC_DIALOGUE ?? (typeof NPC_DIALOGUE !== "undefined" ? (NPC_DIALOGUE as any) : undefined);
    if (tbl) {
      for (const c of candidates) {
        const v = tbl[c];
        if (Array.isArray(v) && v.length) return v as string[];
      }
    }
  } catch (_) {
    // ignore
  }

  return undefined;
}
// --- end Sweetland NPC Overrides (v4) ---


// IMPORTANT:
// Do NOT import the legacy npc placement devtools here.
// Those scripts register their own keybinds (N/Enter/etc.) and can fight with the new
// NPC Possession Placement Mode (v2).

type Focus =
  | { kind: "portal"; id: PortfolioSectionId }
  | { kind: "npc"; id: string }
  | null;


// SWEETLAND_NPC_DIALOGUE_V2
// Maps the *authored* Sweet Land NPC name (what is in the GLB / level data) to the name you want shown in UI.
const SWEETLAND_NPC_NAME_OVERRIDES: Record<string, string> = {
  "Grummy 01": "Goldie Gum",
  "Grummy 02": "Rubycakes",
  "Marshie 01": "Cottonpuff",
  "Sweetie 02": "Toffies",
  "EyeBud 03": "Turbo",
  "Sweetbloom 03": "Sweetbloom",
  "GummiBear 01": "Sentinel Crystella",
  "Candy King": "The Brother",
  "Marshie 02": "Nimbuspuff",
  "Grummy 03": "Scarlet Squish",
  "Sweetie 01": "Emberblaze",
  "Grummy 05": "Limesnap",
  "Sweetie 03": "Bluefizz",
  "Marshie 03": "Berrymallow",
  "Grummy 04": "Amberling",
  "Sweetbloom 1": "Gumball",
  "Sweetbloom 02": "Vanillapop",
  "GummiBear 06": "Sentinel Raspberry",
  "GummiBear 05": "Sentinel Coolio Chew",
  "EyeBud 02": "Pedro",
  "EyeBud 01": "Jose",
  "GummiBear 02": "Sentinel Lemonsnap",
  "GummiBear 03": "Sentinel Citrusflare",
  "GummiBear 04": "Sentinel Verdy",
};

// Maps the *authored* Sweet Land NPC name -> dialogue lines.
const SWEETLAND_NPC_DIALOGUE_BY_NPC_NAME: Record<string, string[]> = {
  "Grummy 01": ["Hi, welcome to the Chloeverse! If you've never been here before, feel free to explore Chloe's Candy Castle! If you're looking for her work, feel free to explore the castle and meet everyone along the way, or press 1-4 to teleport instantly to the portals. Thanks for stopping by!"],
  "Grummy 02": ["Hope you're having fun! if you're lucky, you might even catch the Candy King in town."],
  "Marshie 01": ["You're on the right path! You've already passed the Projects portal when you spawned, and Collabs portal is coming up soon. Say hi to the Candy King for me if you see him around!"],
  "Sweetie 02": ["Did you know nobody's managed to collect all the collectibles yet? You just might be the first! Anyway, Chloe really wanted to be known as absurd in the second grade. I wonder if she still is..."],
  "EyeBud 03": ["Chloe had three pet snails when she was little. I remember her singing goodnight to us and I woke up here the very next day! I'm trying to find my siblings but I'm going as fast as I can. Say hello for me if you see them!"],
  "Sweetbloom 03": ["PASTE YOUR NEW SWEETBLOOM LINE HERE (single line)"],
  "GummiBear 01": ["Want to explore more, do you? Chloe's Candy Castle is her homebase here in the Chloeverse, and she has plans to expand! But right now, there's not much else out there. You're more than welcome to wander about if you wish, but there's so much more of the Castle to see!"],
  "Candy King": ["Hi, nice to meet ya! I'm actually Chloe's brother, but don't let the crown and scepter fool you. She put me on admin duty while she's off adventuring in new lands and going on top secret quests. She said something about being 'the first born' and how I'm supposed to be 'responsible...' As soon as she's back, it's vacation time! Oh yeah before I forget, she'd probably want me to tell you to check out all four portals and explore all of her work!"],
  "Marshie 02": ["I hope Chloe returns soon! She promised to bring back a whole bed made of cotton candy for me. By the way, if you ever bring her spicy rice cakes or Tteokbokki, she'll probably be your best friend."],
  "Grummy 03": ["Chloe's first ever videos were her slime and squishy making tutorials! If you've ever enjoyed any of her content, now you know it all started from a love of making DIY squishies and slime :)"],
  "Sweetie 01": ["Hey! A lot of people forget to talk to me while they explore, so thanks for checking in! A reward for your efforts: The sentinels around the outer edges of the Castle might have some hints about Chloe's next project."],
  "Grummy 05": ["You're really exploring all the nooks and crannies of Candy Castle, aren't you? Here's a secret, Chloe's favorite candy isa three-way tie between Sourpatch kids Watermelon, Sourstrings, and unexpectedly, Peppermint Bark! When in doubt, the sour shall show the way!"],
  "Sweetie 03": ["I hope you've been enjoying Candy Castle so far! You're almost at the last portal, so if you want to get in touch with Chloe, make sure you reach out! Even with all her adventures and quests, you can expect a quick turnaround."],
  "Marshie 03": ["Did you know Chloe once ran a slime empire in the fifth grade? Legend has it that her classroom's local buy and sell had to be shutdown because she was running an illicit snack trading business in the underbelly of her elementary school's tube slide, using her handcrafted slimes as the local currency."],
  "Grummy 04": ["If you ask Chloe what life is all about, she'll replay with Frog and Toad. If you know, you know."],
  "Sweetbloom 1": ["Thanks for checking in with me! Next up is the last portal, but the real important piece of news here is that the joys of candy outweigh the health hazards of adulting...or something, right?"],
  "Sweetbloom 02": ["Thank you for visiting Chloe's Candy Castle! If for whatever reason you're starting your journey here, you should press 1 to start from the original intended point, but it's a free country here, do as you please. If you enjoyed your time here, please be sure to let Chloe know, and we look forward to seeing you again!"],
  "GummiBear 06": ["I'm supposed to be on lookout for any potential dangers, but between you and me, I really took this job because I get to sail up and down Sugar River. Chloe also told me if anyone ever asked, that apparently something big is coming in the next few months, and she's on the lookout for potential partners!"],
  "GummiBear 05": ["I drew the last lot among my siblings for the outpost choice, but not many people bother me here, so that's cool I guess. There's one thing you should know: Chloe's working on something in stealth mode right now. I can't tell you too much, but apparently the founder era is here. Keep watch."],
  "EyeBud 02": ["Have you seen my brother Turbo? He's always off doing something or getting lost on his own..."],
  "EyeBud 01": ["Chloe's always had an interest and passion for animals! If you don't believe me, ask her. She can cite over one thousand niche animal facts in a sitting. I wonder if there is a Guinness world record for that."],
  "GummiBear 02": ["I can't guarantee your safety beyond here, but rest assured, Chloe is looking to expand her kingdom, and there have been rumors of something on the horizon..."],
  "GummiBear 03": ["Don't tell me you want to wander the wilderness for days, and that's from someone who did that before Chloe recruited me to her Candy Castle and offered me a place to stay! If you want to pass on a message to her, I'll give you a little secret. She checks her Instagram DMs a little more frequently than her email, but don't tell her you heard that from me."],
  "GummiBear 04": ["Nothing like a safe and stable job in this economy...Chloe might be away but she promised us she'd expand her kingdom and build a place of peace and happiness for us all! If you want to get in early with her, I think she's got a mailing list or something you can sign up for."],
};


const NPC_DIALOGUE: Record<string, string[]> = {
  marshie: [
    "Hi! I'm Marshie.",
    "I live in Sweet Land and I'm here to guide you around.",
    "More quests and dialogue are coming soon ✨",
  ],
  sweetie_01: [
    "Hi! I’m Sweetie 01 🍓",
    "Want to explore Sweet Land together?",
    "(More dialogue coming soon ✨)",
  ],
};

// SWEETLAND_NPC_DIALOGUE_V3
type SweetlandNpcScript = { name: string; lines: string[] };
const SWEETLAND_NPC_SCRIPTS_RAW: Array<{ from: string; to: string; lines: string[] }> = [
  {
    "from": "Grummy 01",
    "to": "Goldie Gum",
    "lines": [
      "Hi, welcome to the Chloeverse! If you've never been here before, feel free to explore Chloe's Candy Castle! If you're looking for her work, feel free to explore the castle and meet everyone along the way, or press 1-4 to teleport instantly to the portals. Thanks for stopping by!"
    ]
  },
  {
    "from": "Grummy 02",
    "to": "Rubycakes",
    "lines": [
      "Hope you're having fun! if you're lucky, you might even catch the Candy King in town."
    ]
  },
  {
    "from": "Marshie 01",
    "to": "Cottonpuff",
    "lines": [
      "You're on the right path! You've already passed the Projects portal when you spawned, and Collabs portal is coming up soon. Say hi to the Candy King for me if you see him around!"
    ]
  },
  {
    "from": "Sweetie 02",
    "to": "Toffies",
    "lines": [
      "Did you know nobody's managed to collect all the collectibles yet? You just might be the first! Anyway, Chloe really wanted to be known as absurd in the second grade. I wonder if she still is..."
    ]
  },
  {
    "from": "EyeBud 03",
    "to": "Turbo",
    "lines": [
      "Chloe had three pet snails when she was little. I remember her singing goodnight to us and I woke up here the very next day! I'm trying to find my siblings but I'm going as fast as I can. Say hello for me if you see them!"
    ]
  },
  {
    "from": "Sweetbloom 03",
    "to": "Sweetbloom",
    "lines": [
      "Not many people stop and talk to a plant! Says a lot about your kind heart that you did. Here's a tip: If you press shift to run and jump, you'll be able to make it onto the waffle slab!"
    ]
  },
  {
    "from": "GummiBear 01",
    "to": "Sentinel Crystella",
    "lines": [
      "Want to explore more, do you? Chloe's Candy Castle is her homebase here in the Chloeverse, and she has plans to expand! But right now, there's not much else out there. You're more than welcome to wander about if you wish, but there's so much more of the Castle to see!"
    ]
  },
  {
    "from": "Candy King",
    "to": "The Brother",
    "lines": [
      "Hi, nice to meet ya! I'm actually Chloe's brother, but don't let the crown and scepter fool you. She put me on admin duty while she's off adventuring in new lands and going on top secret quests. She said something about being \"the first born\" and how I'm supposed to be \"responsible...\" As soon as she's back, it's vacation time! Oh yeah before I forget, she'd probably want me to tell you to check out all four portals and explore all of her work!"
    ]
  },
  {
    "from": "Marshie 02",
    "to": "Nimbuspuff",
    "lines": [
      "I hope Chloe returns soon! She promised to bring back a whole bed made of cotton candy for me. By the way, if you ever bring her spicy rice cakes or Tteokbokki, she'll probably be your best friend."
    ]
  },
  {
    "from": "Grummy 03",
    "to": "Scarlet Squish",
    "lines": [
      "Chloe's first ever videos were her slime and squishy making tutorials! If you've ever enjoyed any of her content, now you know it all started from a love of making DIY squishies and slime :)"
    ]
  },
  {
    "from": "Sweetie 01",
    "to": "Emberblaze",
    "lines": [
      "Hey! A lot of people forget to talk to me while they explore, so thanks for checking in! A reward for your efforts: The sentinels around the outer edges of the Castle might have some hints about Chloe's next project."
    ]
  },
  {
    "from": "Grummy 05",
    "to": "Limesnap",
    "lines": [
      "You're really exploring all the nooks and crannies of Candy Castle, aren't you? Here's a secret, Chloe's favorite candy isa three-way tie between Sourpatch kids Watermelon, Sourstrings, and unexpectedly, Peppermint Bark! When in doubt, the sour shall show the way!"
    ]
  },
  {
    "from": "Sweetie 03",
    "to": "Bluefizz",
    "lines": [
      "I hope you've been enjoying Candy Castle so far! You're almost at the last portal, so if you want to get in touch with Chloe, make sure you reach out! Even with all her adventures and quests, you can expect a quick turnaround."
    ]
  },
  {
    "from": "Marshie 03",
    "to": "Berrymallow",
    "lines": [
      "Did you know Chloe once ran a slime empire in the fifth grade? Legend has it that her classroom's local buy and sell had to be shutdown because she was running an illicit snack trading business in the underbelly of her elementary school's tube slide, using her handcrafted slimes as the local currency."
    ]
  },
  {
    "from": "Grummy 04",
    "to": "Amberling",
    "lines": [
      "If you ask Chloe what life is all about, she'll replay with Frog and Toad. If you know, you know."
    ]
  },
  {
    "from": "Sweetbloom 1",
    "to": "Gumball",
    "lines": [
      "Thanks for checking in with me! Next up is the last portal, but the real important piece of news here is that the joys of candy outweigh the health hazards of adulting...or something, right?"
    ]
  },
  {
    "from": "Sweetbloom 02",
    "to": "Vanillapop",
    "lines": [
      "Thank you for visiting Chloe's Candy Castle! If for whatever reason you're starting your journey here, you should press 1 to start from the original intended point, but it's a free country here, do as you please. If you enjoyed your time here, please be sure to let Chloe know, and we look forward to seeing you again!"
    ]
  },
  {
    "from": "GummiBear 06",
    "to": "Sentinel Raspberry",
    "lines": [
      "I'm supposed to be on lookout for any potential dangers, but between you and me, I really took this job because I get to sail up and down Sugar River. Chloe also told me if anyone ever asked, that apparently something big is coming in the next few months, and she's on the lookout for potential partners!"
    ]
  },
  {
    "from": "GummiBear 05",
    "to": "Sentinel Coolio Chew",
    "lines": [
      "I drew the last lot among my siblings for the outpost choice, but not many people bother me here, so that's cool I guess. There's one thing you should know: Chloe's working on something in stealth mode right now. I can't tell you too much, but apparently the founder era is here. Keep watch."
    ]
  },
  {
    "from": "EyeBud 02",
    "to": "Pedro",
    "lines": [
      "Have you seen my brother Turbo? He's always off doing something or getting lost on his own..."
    ]
  },
  {
    "from": "EyeBud 01",
    "to": "Jose",
    "lines": [
      "Chloe's always had an interest and passion for animals! If you don't believe me, ask her. She can cite over one thousand niche animal facts in a sitting. I wonder if there is a Guinness world record for that."
    ]
  },
  {
    "from": "GummiBear 02",
    "to": "Sentinel Lemonsnap",
    "lines": [
      "I can't guarantee your safety beyond here, but rest assured, Chloe is looking to expand her kingdom, and there have been rumors of something on the horizon..."
    ]
  },
  {
    "from": "GummiBear 03",
    "to": "Sentinel Citrusflare",
    "lines": [
      "Don't tell me you want to wander the wilderness for days, and that's from someone who did that before Chloe recruited me to her Candy Castle and offered me a place to stay! If you want to pass on a message to her, I'll give you a little secret. She checks her Instagram DMs a little more frequently than her email, but don't tell her you heard that from me."
    ]
  },
  {
    "from": "GummiBear 04",
    "to": "Sentinel Verdy",
    "lines": [
      "Nothing like a safe and stable job in this economy...Chloe might be away but she promised us she'd expand her kingdom and build a place of peace and happiness for us all! If you want to get in early with her, I think she's got a mailing list or something you can sign up for."
    ]
  }
];
const __sweetlandNpcCanon = (s: string) => {
  // Canonicalize NPC keys so minor formatting differences don't break dialogue/name overrides.
  // - Treat Gruumy/Grummy as the same NPC family.
  // - Normalize numeric suffixes so 01 and 1 match.
  const t = String(s ?? "")
    .toLowerCase()
    .replace(/gruumy/g, "grummy")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!t) return "";
  const parts = t
    .split(" ")
    .filter(Boolean)
    .map((p) => (/^\d+$/.test(p) ? String(parseInt(p, 10)) : p));
  return parts.join("");
};
const SWEETLAND_NPC_SCRIPTS: Record<string, SweetlandNpcScript> = (() => {
  const out: Record<string, SweetlandNpcScript> = {};
  for (const r of SWEETLAND_NPC_SCRIPTS_RAW) {
    const v: SweetlandNpcScript = { name: r.to, lines: r.lines };
    out[__sweetlandNpcCanon(r.from)] = v;
    out[__sweetlandNpcCanon(r.to)] = v;
  }
  return out;
})();
function __sweetlandGetNpcScript(name?: string): SweetlandNpcScript | undefined {
  if (!name) return undefined;
  return SWEETLAND_NPC_SCRIPTS[__sweetlandNpcCanon(name)];
}
function __sweetlandApplyNpcRenames(level: any): void {
  try {
    const npcs = level?.npcs;
    if (!npcs || typeof npcs.values !== "function") return;
    for (const npc of npcs.values()) {
      const script = __sweetlandGetNpcScript(npc?.name);
      if (script && npc && typeof npc.name === "string" && npc.name !== script.name) npc.name = script.name;
      if (script && npc) (npc as any).__sweetlandDialogue = script.lines;
    }
  } catch (e) {
    console.warn("SWEETLAND_NPC_DIALOGUE_V3: rename failed", e);
  }
}

/*__SL_V9FIX_START__*/

// Sweetland NPC dialogue + display-name overrides (keyed by in-game UI name).
// This block also defines __slNpcDisplayNameFromPromptNameV9 to prevent runtime freezes
// if a previous patch introduced a call to it.

type __SlNpcOverride = { display: string; lines: string[] };
const __SL_V9FIX_OVERRIDES: Record<string, __SlNpcOverride> = {
  "Grummy 01": {
    display: "Goldie Gum",
    lines: [
      "Hi, welcome to the Chloeverse! If you\u2019ve never been here before, feel free to explore Chloe\u2019s Candy Castle! If you\u2019re looking for her work, feel free to explore the castle and meet everyone along the way, or press 1-4 to teleport instantly to the portals. Thanks for stopping by!"
    ]
  },
  "Grummy 02": {
    display: "Rubycakes",
    lines: ["Hope you\u2019re having fun! if you\u2019re lucky, you might even catch the Candy King in town."]
  },
  "Grummy 03": {
    display: "Scarlet Squish",
    lines: ["Chloe\u2019s first ever videos were her slime and squishy making tutorials! If you\u2019ve ever enjoyed any of her content, now you know it all started from a love of making DIY squishies and slime :)"]
  },
  "Grummy 04": {
    display: "Amberling",
    lines: ["If you ask Chloe what life is all about, she\u2019ll replay with Frog and Toad. If you know, you know."]
  },
  "Grummy 05": {
    display: "Limesnap",
    lines: ["You\u2019re really exploring all the nooks and crannies of Candy Castle, aren\u2019t you? Here\u2019s a secret, Chloe\u2019s favorite candy isa three-way tie between Sourpatch kids Watermelon, Sourstrings, and unexpectedly, Peppermint Bark! When in doubt, the sour shall show the way!"]
  },
  "Sweetbloom 01": {
    display: "Gumball",
    lines: ["Thanks for checking in with me! Next up is the last portal, but the real important piece of news here is that the joys of candy outweigh the health hazards of adulting...or something, right?"]
  }
};

function __slV9fixNorm(s: any): string {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

function __slV9fixAliases(name: string): string[] {
  const n = __slV9fixNorm(name);
  const out: string[] = [];
  if (!n) return out;
  out.push(n);
  const m = n.match(/^(.*?)(?:\s+)?(\d+)$/);
  if (m) {
    const base = __slV9fixNorm(m[1]);
    const num = m[2];
    if (base) {
      if (num.length === 1) {
        out.push(base + " 0" + num);
        out.push(base + " " + num);
      } else if (num.length === 2 && num.charAt(0) === "0") {
        out.push(base + " " + String(parseInt(num, 10)));
      } else {
        out.push(base + " " + num);
      }
    }
  }
  // De-dupe while preserving order
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (let i = 0; i < out.length; i++) {
    const k = out[i];
    if (!seen.has(k)) {
      seen.add(k);
      uniq.push(k);
    }
  }
  return uniq;
}

function __slV9fixGetOverride(name: any): __SlNpcOverride | undefined {
  const aliases = __slV9fixAliases(String(name ?? ""));
  for (let i = 0; i < aliases.length; i++) {
    const k = aliases[i];
    const v = (__SL_V9FIX_OVERRIDES as any)[k] as __SlNpcOverride | undefined;
    if (v) return v;
  }
  return undefined;
}

function __slV9fixGetUiNameFromFocus(focus: any): string | undefined {
  if (!focus) return undefined;
  const candidates: any[] = [];
  // Common fields
  candidates.push(focus.uiName);
  candidates.push(focus.name);
  candidates.push(focus.dispName);
  candidates.push(focus.displayName);
  candidates.push(focus.title);
  // If we have a global NPC list, map focus.id -> npc.name
  try {
    const list = (globalThis as any).__sweetlandNpcList;
    if (Array.isArray(list) && focus.id != null) {
      for (let i = 0; i < list.length; i++) {
        const npc = list[i];
        if (npc && npc.id === focus.id && npc.name) {
          candidates.push(npc.name);
          break;
        }
      }
    }
  } catch (_) {}
  for (let i = 0; i < candidates.length; i++) {
    const v = __slV9fixNorm(candidates[i]);
    if (v) return v;
  }
  return undefined;
}

// Wrapper used by the __slLines resolver (safe even if older helper exists)
function __slNpcLinesFromFocusV9Fix(focus: any, _app: any): string[] | undefined {
  const ui = __slV9fixGetUiNameFromFocus(focus);
  if (ui) {
    const ov = __slV9fixGetOverride(ui);
    if (ov && Array.isArray(ov.lines)) return ov.lines.slice();
  }
  try {
    if (typeof (__slNpcLinesFromFocus as any) === "function") {
      return (__slNpcLinesFromFocus as any)(focus);
    }
  } catch (_) {}
  return undefined;
}

// Prevent runtime freezes: some prior patch introduced this call without defining it.
function __slNpcDisplayNameFromPromptNameV9(promptOrName: any): string {
  const raw = String(promptOrName ?? "");
  if (!raw) return raw;
  const isTalkTo = /^\s*Talk\s+to\s+/i.test(raw);
  const name = isTalkTo ? raw.replace(/^\s*Talk\s+to\s+/i, "").trim() : raw.trim();
  const ov = __slV9fixGetOverride(name);
  const mapped = ov ? ov.display : name;
  if (isTalkTo) return "Talk to " + mapped;
  return mapped;
}

/*__SL_V9FIX_END__*/



export class App {
  private canvas = qs<HTMLCanvasElement>("#c");
  private renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1200);
  private minimapCamera = new THREE.OrthographicCamera(-18, 18, 18, -18, 0.1, 600);


  // Rounded minimap (render-to-texture HUD)
  private minimapRT: THREE.WebGLRenderTarget | null = null;
  private minimapRTSize = 0;
  private minimapHudScene = new THREE.Scene();
  private minimapHudCamera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
  private minimapHudMesh: THREE.Mesh | null = null;
  private minimapHudMaterial: THREE.ShaderMaterial | null = null;
  private minimapHudLastW = 0;
  private minimapHudLastH = 0;
  private minimapHudLastSize = 0;

  private input = new Input(this.canvas);
  private physics = new Physics();
  private ui = new UI();
  private audio = new AudioManager();

  private player!: Player;
  private tpc!: ThirdPersonCamera;
  private level!: Level;

  private focus: Focus = null;

  // SWEETLAND_PORTAL_CINEMATIC_V1

  // SWEETLAND_PORTAL_CINEMATIC_V1B_RESTORE
  private exitPortalView(): void {
    // End portal lock state and restore normal gameplay camera.
    this.portalCine = null;
    this.portalUiOpen = false;
    if (this.portalGameplayFov != null) {
      this.camera.fov = this.portalGameplayFov;
      this.camera.updateProjectionMatrix();
    }
    (this.tpc as any).syncFromCamera?.();
  }
  // When entering a portal, we briefly animate (zoom) the camera toward the portal
  // and then open the corresponding portfolio section panel (iframe + link).
  private portalCine:
    | null
    | {
        phase: "enter";
        id: PortfolioSectionId;
        t: number;
        dur: number;
        fromPos: THREE.Vector3;
        fromQuat: THREE.Quaternion;
        fromFov: number;
        toPos: THREE.Vector3;
        toQuat: THREE.Quaternion;
        toFov: number;
      } = null;

  private portalUiOpen = false;

  // SWEETLAND_PORTAL_CINEMATIC_V1B_RESTORE
  // Remember the normal gameplay FOV so we can restore after portal preview.
  private portalGameplayFov: number | null = null;


  // NPC placement mode (Option A2)
  private npcPlaceActive = false;
  private npcPlaceList: { id: string; name: string }[] = [];
  private npcPlaceIndex = 0;
  private npcPlaceRotY = 0;
  private npcPlaceRay = new THREE.Raycaster();

  // SWEETLAND_CAMERA_COLLISION_V3: one-time occluder build for camera collision
  private camOccReady = false;
  private camOccluders: THREE.Object3D[] = [];
  private npcPlaceMarker = new THREE.Group();
  private npcPlaceRing: THREE.Mesh | null = null;
  private npcPlaceArrow: THREE.ArrowHelper | null = null;

  // NPC possession placement mode (v2)
  private npcPossessActive = false;
  private npcPossessList: { id: string; name: string }[] = [];
  private npcPossessIndex = 0;
  private npcPossessId: string | null = null;

  private npcPlacements: Record<string, { pos: { x: number; y: number; z: number }; rotY: number }> = {};
  private readonly npcPlacementStorageKey = "sweetland:npcPlacements:v2";

  private npcPossessHud: HTMLDivElement | null = null;


  // Reusable temp vectors (avoid allocations in the fixed loop)
  private _v1 = new THREE.Vector3();
  private _v2 = new THREE.Vector3();
  private _v3 = new THREE.Vector3();
  private _m4 = new THREE.Matrix4();

  private popFx: { mesh: THREE.Mesh; start: number; dur: number }[] = [];
  private audioCtx: AudioContext | null = null;

  // Player movement animation (for swapped player visuals like Nutty Knight)
  private playerAnimMixer: THREE.AnimationMixer | null = null;
  private playerAnimActions:
    | {
        idle?: THREE.AnimationAction;
        walk?: THREE.AnimationAction;
        run?: THREE.AnimationAction;
        jump?: THREE.AnimationAction;
        fall?: THREE.AnimationAction;
      }
    | null = null;
  private playerAnimCurrent: THREE.AnimationAction | null = null;

  // Interaction distances
  private pickupRadius = 1.15;
  private interactRadius = 2.35;

  private lastT = performance.now();
  private acc = 0;
  private fixedDt = 1 / 60;

  private coins = 0;

  async init(): Promise<void> {
    this.setupRenderer();
    this.setupScene();

    this.ui.setLoading(true);
    this.ui.setLoadingProgress(0);

    await this.physics.init();
    this.ui.setLoadingProgress(8);

    // Build world (loads Sweet_Land.glb + colliders + portals/NPCs)
    this.level = new Level(this.physics);
    await this.level.build((p01) => this.ui.setLoadingProgress(8 + p01 * 70));
    this.scene.add(this.level.scene);

    // NPC placements (persisted)
    this.loadNpcPlacements();
    this.level.applyNpcPlacements(this.npcPlacements);

    // Player
    this.player = new Player(this.physics, this.input);
    await this.player.spawn(this.level.spawn);

    // --- Player/NPC swap (Option A3): Nutty Knight as player, Sweetie 01 as NPC ---
// Sweetie_01 should exist as a normal NPC at the exact pose you captured.
// If Sweetie_01 is not already an NPC in this build, we "promote" the player's
// original Sweetie model into an NPC, then swap the player's visible model to Nutty Knight.
const sweetiePose = { x: 4.074, y: 7.74, z: -55.508, rotY: 0.036 };

this.ensureNpcFromPlayerOrMoveExisting("sweetie_01", "Sweetie 01", sweetiePose);

// Swap the visible player model to Nutty Knight (controls/physics/camera unchanged).
// This detaches Nutty Knight's visual from its NPC and removes the NPC colliders to avoid duplicates.
this.swapPlayerVisualFromNpc("nutty_knight");
    // SWEETLAND_NPC_DIALOGUE_V3: install display names + dialogue
    __sweetlandApplyNpcRenames(this.level);

this.scene.add(this.player.mesh);
    this.ui.setLoadingProgress(92);

    this.tpc = new ThirdPersonCamera(this.camera);

    // SWEETLAND_PORTAL_CINEMATIC_V1
    // When the portfolio panel closes, resume gameplay camera smoothly (no snapping).
    // SWEETLAND_PORTAL_CINEMATIC_V1B_RESTORE
    this.ui.onClosePanel = () => {
      this.exitPortalView();
    };


    // ------------------------------------------------------------
    // DevTools helper: get the current player's world position + yaw
    // Usage (in Chrome DevTools console):
    //   __sweetlandGetPlayerPose()
    //   copy(JSON.stringify(__sweetlandGetPlayerPose(), null, 2))
    // ------------------------------------------------------------
    const __w = window as any;
    __w.__sweetlandApp = this;
    __w.__sweetlandPlayer = this.player;
    __w.__sweetlandLevel = this.level;
    __w.__sweetlandGetPlayerPose = () => {
      try {
        const p: any = this.player;
        if (!p) {
          console.warn("[SweetLand] Player not ready yet.");
          return null;
        }
        const t = p.body?.translation?.();
        const body = t
          ? { x: +t.x.toFixed(3), y: +t.y.toFixed(3), z: +t.z.toFixed(3) }
          : null;

        const m = p.mesh;
        const mesh = m
          ? { x: +m.position.x.toFixed(3), y: +m.position.y.toFixed(3), z: +m.position.z.toFixed(3) }
          : null;

        const rotY = m ? +m.rotation.y.toFixed(3) : 0;
        const spawn = body ? { x: body.x, y: +(body.y - 0.8).toFixed(3), z: body.z, rotY } : null;
        const out = { body, mesh, rotY, spawn };
        console.log("[SweetLand] Player pose:", out);
        return out;
      } catch (err) {
        console.error("[SweetLand] __sweetlandGetPlayerPose failed:", err);
        return null;
      }
    };

    // Collisions → gameplay
    // Gameplay interactions are handled via proximity checks (more reliable than sensor events in some Rapier builds).

    // Buttons / UI actions
    qs<HTMLButtonElement>("#resetCoinsBtn").addEventListener("click", () => this.resetCoins());

    // Pointer lock
    this.canvas.addEventListener("click", (e) => {
      if (this.npcPlaceActive) {
        e.preventDefault?.();
        this.placeSelectedNpcAtCrosshair();
        return;
      }
      if (this.uiIsBlocking()) return;
      if (document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock();
      this.ui.setLoading(false);
    });

    // Hotkeys (capture=true so we can reliably prevent default for Tab, etc.)
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.repeat) return;

        // respawn / warp to hub
        if (e.code === "KeyR") this.warpToHub();

        // Reset coins
        if (e.code === "KeyR") this.resetCoins();


        // Music mute toggle
        if (e.code === "KeyM") {
          e.preventDefault();

          const a: any = this.audio;

          // Prefer music-only toggle (BGM). Fallback to global mute only if needed.
          const muted =
            typeof a?.toggleMusicMute === "function"
              ? a.toggleMusicMute()
              : typeof a?.toggleMute === "function"
                ? a.toggleMute()
                : null;

          console.log("[SweetLand] Music toggle:", muted ? "MUTED" : "UNMUTED");
        }

        // SWEETLAND_SFX_ENABLE_ALL_V3: universal SFX wiring + test hotkeys
        // Space -> jump SFX (does not block gameplay)
        if (!e.repeat && e.code === "Space") {
          try { (this.audio as any).playSfx?.("jump"); } catch {}
        }

        // ALT+number keys -> quick SFX test palette (non-invasive)
        if (e.altKey && !e.repeat) {
          const a: any = this.audio;
          const play = (k: string) => { try { a.playSfx?.(k); console.log("[SweetLand] SFX test:", k); } catch {} };
          switch (e.code) {
            case "Digit1": play("coin"); break;
            case "Digit2": play("pickup"); break;
            case "Digit3": play("portal_in"); break;
            case "Digit4": play("portal_out"); break;
            case "Digit5": play("jump"); break;
            case "Digit6": play("jump_spring"); break;
            case "Digit7": play("marshie_hi"); break;
            case "Digit8": play("grummy_step"); break;
            case "Digit9": play("sweetbloom_idle_loop"); break;
            case "Digit0": play("music_sting"); break;
          }
        }


// Save / clear the second waffle slab position (for JumpBridge_Slab02)
// - Stand where you want the slab (midpoint between platforms), then press Shift+J
// - Reload to see it. Press Shift+K to clear.
if (e.code === "KeyJ" && e.shiftKey) {
  const p = this.player.position;
  const rotY = this.player.mesh.rotation.y;
  const payload = {
    x: Number(p.x.toFixed(3)),
    y: Number(p.y.toFixed(3)),
    z: Number(p.z.toFixed(3)),
    rotY: Number(rotY.toFixed(3)),
  };
  try {
    window.localStorage.setItem("sweetland:slab02", JSON.stringify(payload));
  } catch {
    // ignore
  }
  // eslint-disable-next-line no-console
  console.log("[SweetLand] Saved slab02 position:", payload);
}
if (e.code === "KeyK" && e.shiftKey) {
  try {
    window.localStorage.removeItem("sweetland:slab02");
  } catch {
    // ignore
  }
  // eslint-disable-next-line no-console
  console.log("[SweetLand] Cleared slab02 position override.");
}
        // Interact
        if (e.code === "KeyE") this.interact();

        // Teleport to portal platforms 1-4 (per your spec)
        for (const sec of PORTFOLIO_SECTIONS) {
          if (e.code === sec.hotkey) this.teleportToSection(sec.id);
        }
      },
      { capture: true }
    );

    this.resize();
    window.addEventListener("resize", () => this.resize());

    this.ui.setLoadingProgress(100);
    // ✅ Wait for the first click (user gesture) then hide loading + lock mouse
    window.addEventListener(
      "pointerdown",
      () => {
        this.ensureAudio();
        try { this.audio.onFirstGesture(); } catch {}
        this.ui.setLoading(false);              // hide the blur overlay
        this.canvas.requestPointerLock?.();     // enable mouse-look
      },
      { once: true }
    );


    // Start loop
    // SWEETLAND_AUDIO_V1E: hook UI open/close to portal music + sfx
    try {
      const uiAny: any = this.ui as any;
      if (!uiAny.__slAudioWrapped) {
        const origOpenSection = uiAny.openSection.bind(uiAny);
        uiAny.openSection = (id: any) => {
          try { this.audio.onPortalPanelOpen(id); } catch {}
          return origOpenSection(id);
        };
        const prevClose = uiAny.onClosePanel;
        uiAny.onClosePanel = () => {
          try { if (typeof prevClose === 'function') prevClose(); } catch {}
          try { this.audio.onPortalPanelClose(); } catch {}
        };
        uiAny.__slAudioWrapped = true;
      }
    } catch {}

    requestAnimationFrame((t) => this.frame(t));
  }

  private setupRenderer(): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
  }

  private setupScene(): void {
    this.scene.background = new THREE.Color(0x7bc8ff);

    // Sky dome
    const skyGeo = new THREE.SphereGeometry(420, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x7bc8ff, side: THREE.BackSide });

    // NPC placement mode: mouse wheel rotates the selected NPC.
    window.addEventListener(
      "wheel",
      (e) => {
        if (!this.npcPlaceActive) return;
        e.preventDefault();
        const dir = e.deltaY > 0 ? 1 : -1;
        this.rotateSelectedNpc(dir);
      },
      { passive: false }
    );

    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);

    // Puffy clouds (billboard sprites)
    const cloudTex = (() => {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 256;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);

      const blob = (x: number, y: number, r: number, a: number) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      };

      // Cluster of soft circles
      blob(170, 145, 95, 0.75);
      blob(250, 118, 110, 0.78);
      blob(330, 150, 85, 0.72);
      blob(230, 165, 120, 0.55);
      blob(285, 165, 100, 0.50);

      return new THREE.CanvasTexture(c);
    })();
    cloudTex.colorSpace = THREE.SRGBColorSpace;

    const cloudGroup = new THREE.Group();
    cloudGroup.name = "clouds";
    this.scene.add(cloudGroup);

    for (let i = 0; i < 14; i++) {
      const mat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false });
      mat.opacity = 0.9;
      mat.rotation = (Math.random() - 0.5) * 0.6;

      const s = new THREE.Sprite(mat);
      const a = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const r = 260 + Math.random() * 110;
      s.position.set(Math.cos(a) * r, 95 + Math.random() * 55, Math.sin(a) * r);
      const sc = 55 + Math.random() * 65;
      s.scale.set(sc, sc * 0.55, 1);
      cloudGroup.add(s);
    }

    // Lights
    const amb = new THREE.AmbientLight(0xffffff, 0.72);
    this.scene.add(amb);

    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    sun.position.set(18, 45, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 220;
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0xfff5fb, 0.25);
    fill.position.set(-18, 18, -18);
    this.scene.add(fill);
  
    this.setupNpcPlacementHelpers();
}

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private frame(tNow: number): void {
    const dt = Math.min(0.05, (tNow - this.lastT) / 1000);
    this.lastT = tNow;

    // Mouse look
    const { dx, dy } = this.input.consumeMouseDelta();
    if (dx || dy) this.tpc.updateFromMouse(dx, dy);

    // Auto-respawn if falling forever
    if (this.player.position.y < -55) this.warpToHub();

    // Fixed-step physics for stability
    this.acc += dt;
    while (this.acc >= this.fixedDt) {
      this.fixedUpdate(this.fixedDt, tNow / 1000);
      this.acc -= this.fixedDt;
    }

    this.render();

    requestAnimationFrame((t) => this.frame(t));
  }

  private fixedUpdate(dt: number, t: number): void {
    // Ladder proximity (Minecraft-style climbing)
    const ladder = this.level.getLadderAt(this.player.position);
    this.player.setLadder(ladder);

    const __portalLock = !!this.portalCine || this.portalUiOpen;
    if (!__portalLock) {
      this.player.update(dt, this.tpc.yaw);
    } else {
      // Consume mouse deltas so they don't accumulate while pointer is unlocked.
      this.input.consumeMouseDelta();
    }

    this.physics.step();

    this.player.syncFromPhysics();

    this.updatePlayerMovementAnimation(dt);

    this.updateNpcPossess();

    this.level.update(t);

    this.updateInteractions();

    this.updatePopFx(t);


    // SWEETLAND_AUDIO_V1E: update zone BGM
    try { this.audio.update(dt, this.player.position as any, this.level as any); } catch {}

    // SWEETLAND_CAMERA_COLLISION_V3: build occluders once so camera push-in can ignore walls/terrain
    if (!this.camOccReady && this.level && (this.tpc as any)?.setOccluders) {
      try {
        const anyLevel: any = this.level as any;
        const occ: THREE.Object3D[] = [];

        // Prefer any explicit "solid/static/collidable meshes" list if the Level exposes one.
        const prefer =
          anyLevel.solidMeshes ||
          anyLevel.staticMeshes ||
          anyLevel.collidableMeshes ||
          anyLevel.worldMeshes ||
          null;

        if (Array.isArray(prefer) && prefer.length) {
          for (const o of prefer) if (o) occ.push(o);
        } else if (anyLevel.scene && typeof anyLevel.scene.traverse === "function") {
          anyLevel.scene.traverse((o: any) => {
            if (!o || !o.isMesh) return;

            const n = String(o.name || "").toLowerCase();
            // Filter out common non-occluders (coins/NPCs/portals/player visuals). Keep unnamed meshes.
            if (n) {
              if (
                n.includes("coin") ||
                n.includes("collect") ||
                n.includes("npc") ||
                n.includes("portal") ||
                n.includes("player") ||
                n.includes("nutty") ||
                n.includes("sweetie")
              ) return;
            }

            occ.push(o);
          });
        }

        this.camOccluders = occ;
        (this.tpc as any).setOccluders(occ);
        this.camOccReady = true;
      } catch (_e) {
        // If anything goes wrong, don't spam every frame.
        this.camOccReady = true;
      }
    }


    const __portalCamLock = this.updatePortalCinematic(dt);
    if (!__portalCamLock) {
      this.tpc.update(this.player.position, dt);
    }

    this.updateMinimapCamera();

    this.updateNpcPlacementMarker();
  }


  private interact(): void {
    if (this.npcPlaceActive) return;
    if (!this.focus) return;


    // SWEETLAND_PORTAL_CINEMATIC_V1
    if (this.portalCine || this.portalUiOpen) return;
    if (this.uiIsBlocking()) return;

    if (this.focus.kind === "portal") {
      this.enterPortal(this.focus.id as PortfolioSectionId);
      return;
    }

    if (this.focus.kind === "npc") {
      const npc = this.level.npcs.get(this.focus.id);
    const npcName = npc?.name ?? "Friend";
    const __slScript = __sweetlandGetNpcScript(npcName);
    const __slDisplayName = __slScript?.name ?? npcName;
    
// __SL_NPC_DIALOGUE_OVERRIDES_V9
const __slNpcOverrideByUiNameV9 = {
  "Grummy 01": { displayName: "Goldie Gum", lines: [
    "Hi, welcome to the Chloeverse! If you\'ve never been here before, feel free to explore Chloe\'s Candy Castle! If you\'re looking for her work, feel free to explore the castle and meet everyone along the way, or press 1-4 to teleport instantly to the portals. Thanks for stopping by!"
  ]},
  "Grummy 02": { displayName: "Rubycakes", lines: [
    "Hope you\'re having fun! if you\'re lucky, you might even catch the Candy King in town."
  ]},
  "Grummy 03": { displayName: "Scarlet Squish", lines: [
    "Chloe\'s first ever videos were her slime and squishy making tutorials! If you\'ve ever enjoyed any of her content, now you know it all started from a love of making DIY squishies and slime :)"
  ]},
  "Grummy 04": { displayName: "Amberling", lines: [
    "If you ask Chloe what life is all about, she\'ll replay with Frog and Toad. If you know, you know."
  ]},
  "Grummy 05": { displayName: "Limesnap", lines: [
    "You\'re really exploring all the nooks and crannies of Candy Castle, aren\'t you? Here\'s a secret, Chloe\'s favorite candy isa three-way tie between Sourpatch kids Watermelon, Sourstrings, and unexpectedly, Peppermint Bark! When in doubt, the sour shall show the way!"
  ]},
  "Sweetbloom 01": { displayName: "Gumball", lines: [
    "Thanks for checking in with me! Next up is the last portal, but the real important piece of news here is that the joys of candy outweigh the health hazards of adulting...or something, right?"
  ]}
} as any;

function __slNormNpcKeyV9(s: any): string {
  if (!s) return "";
  const t = String(s).replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  return t.toLowerCase();
}

function __slKeyAliasesV9(raw: string): string[] {
  const out: string[] = [];
  const t = raw.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return out;
  out.push(t);
  const m = t.match(/^(.*?)(\s+)(0?)(\d+)$/);
  if (m) {
    const base = m[1].trim();
    const n = parseInt(m[4], 10);
    if (!isNaN(n)) {
      const n1 = String(n);
      const n2 = String(n).padStart(2, "0");
      out.push(base + " " + n1);
      out.push(base + " " + n2);
    }
  }
  return Array.from(new Set(out));
}

function __slDeriveUiFromIdV9(id: any): string {
  if (!id) return "";
  const t = String(id).replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const parts = t.split(" ");
  const out: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    if (/^\d+$/.test(p)) { out.push(String(parseInt(p,10)).padStart(2,"0")); continue; }
    out.push(p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
  }
  return out.join(" ");
}

function __slFindOverrideV9(key: any): any {
  const raw = String(key || "");
  const aliases = __slKeyAliasesV9(raw);
  for (const a of aliases) {
    const normA = __slNormNpcKeyV9(a);
    const keys = Object.keys(__slNpcOverrideByUiNameV9);
    for (const k of keys) {
      if (__slNormNpcKeyV9(k) === normA) return (__slNpcOverrideByUiNameV9 as any)[k];
    }
  }
  return null;
}

function __slCandidateKeysFromFocusV9(focus: any): string[] {
  const cand: string[] = [];
  if (!focus) return cand;
  const fields = ["uiName","name","dispName","displayName","label","title","ui","promptName","npcName","id"];
  for (const f of fields) {
    const v = (focus as any)[f];
    if (typeof v === "string" && v.trim()) cand.push(v);
  }
  if ((focus as any).id) cand.push(__slDeriveUiFromIdV9((focus as any).id));
  return Array.from(new Set(cand.filter(Boolean)));
}

function __slNpcLinesByUiNameV9(focus: any): string[] | null {
  const keys = __slCandidateKeysFromFocusV9(focus);
  for (const k of keys) {
    const ov = __slFindOverrideV9(k);
    if (ov && ov.lines) return ov.lines as string[];
  }
  try {
    const gid = String((focus && (focus as any).id) || "");
    const g = globalThis as any;
    if (!g.__slMissingNpcV9) g.__slMissingNpcV9 = {};
    if (gid && !g.__slMissingNpcV9[gid]) {
      g.__slMissingNpcV9[gid] = true;
      console.warn("[sweetland v9] No dialogue override match. focus.id=", gid, "candidates=", keys);
    }
  } catch (e) {}
  return null;
}

function __slNpcDisplayNameFromPromptNameV9(name: any): string {
  const ov = __slFindOverrideV9(name);
  return (ov && ov.displayName) ? String(ov.displayName) : String(name || "");
}
const __slLines = (__slScript?.lines ?? __slNpcLinesFromFocusV8d(this.focus, this) ?? __slNpcLinesByUiNameV9(this.focus) ?? (NPC_DIALOGUE as any)[this.focus.id] ?? ["Hi! (Dialogue coming soon.)"]) as string[];
    this.ui.openDialogue(__slDisplayName, __slLines);
      return;
    }
    // NOTE: We can add portal/other interactions here later.
  }

  private updateInteractions(): void {
    // --- Collectibles (always active)
    const pt = this.player.body.translation();
    this._v1.set(pt.x, pt.y, pt.z);

    const basePickupR2 = this.pickupRadius * this.pickupRadius;

    // Procedural coins we spawned
    const coinsToCollect: string[] = [];
    for (const [id, c] of this.level.coins) {
      // coin mesh position is in world coords (Level.scene)
      const dx = c.mesh.position.x - this._v1.x;
      const dy = c.mesh.position.y - this._v1.y;
      const dz = c.mesh.position.z - this._v1.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 <= basePickupR2) coinsToCollect.push(id);
    }
    for (const id of coinsToCollect) {
      const c = this.level.coins.get(id);
      if (!c) continue;
      const popPos = c.mesh.position.clone();
      this.level.collectCoin(id);
      this.coins += 1;
      this.ui.setCoins(this.coins);
      this.triggerPopFx(popPos);
      this.playPopSound();
      try { this.audio.playSfx("coin"); } catch {}
    }

    // Baked-in pickups (discovered in Level.ts)
const bakedToCollect: { id: string; pos: THREE.Vector3 }[] = [];
for (const [id, p] of this.level.bakedPickups) {
  if (p.collected) continue;

  const isInstanced =
    (p as any).instanced &&
    (p.mesh as any)?.isInstancedMesh &&
    typeof (p as any).instanceId === "number";

  if (!isInstanced && !p.mesh.visible) continue;

  const cl = (p as any).centerLocal as THREE.Vector3 | undefined;

  if (isInstanced) {
    const inst = p.mesh as unknown as THREE.InstancedMesh;
    inst.updateWorldMatrix(true, false);

    // instanceWorld = inst.matrixWorld * instanceMatrix
    inst.getMatrixAt((p as any).instanceId, this._m4);
    this._m4.multiplyMatrices(inst.matrixWorld, this._m4);

    if (cl) this._v2.copy(cl).applyMatrix4(this._m4);
    else this._v2.set(0, 0, 0).applyMatrix4(this._m4);
  } else {
    (p.mesh as any).updateWorldMatrix(true, false);
    if (cl) this._v2.copy(cl).applyMatrix4((p.mesh as any).matrixWorld);
    else p.mesh.getWorldPosition(this._v2);
  }

  const dx = this._v2.x - this._v1.x;
  const dy = this._v2.y - this._v1.y;
  const dz = this._v2.z - this._v1.z;
  const d2 = dx * dx + dy * dy + dz * dz;

  const r = Math.min(2.8, Math.max(this.pickupRadius, p.maxDim ? p.maxDim * 0.75 : this.pickupRadius));
  const r2 = r * r;

  if (d2 <= r2) bakedToCollect.push({ id, pos: this._v2.clone() });
}

for (const it of bakedToCollect) {
  const p = this.level.bakedPickups.get(it.id);
  if (!p || p.collected) continue;

  this.level.collectBakedPickup(it.id);
  this.coins += 1;
  this.ui.setCoins(this.coins);

  this.triggerPopFx(it.pos);
  this.playPopSound();
      try { this.audio.playSfx("coin"); } catch {}
}

    // --- Focus / prompts (disabled while UI is open)
        if (this.npcPlaceActive) {
      // Placement mode owns the prompt; do not update focus.
      this.focus = null;
      this.updateNpcPlacementPrompt();
      return;
    }
    if (this.npcPossessActive) {
      // Possession placement mode: disable focus/prompts.
      this.focus = null;
      this.ui.showPrompt(null);
      return;
    }

    if (this.uiIsBlocking()) {
      if (this.focus !== null) {
        this.focus = null;
        this.ui.showPrompt(null);
      }
      return;
    }

    const interactR2 = this.interactRadius * this.interactRadius;
    let best: Focus = null;
    let bestD2 = Infinity;

    // Portals
    for (const [id, p] of this.level.portals) {
      p.group.getWorldPosition(this._v2);
      const dx = this._v2.x - this._v1.x;
      const dy = this._v2.y - this._v1.y;
      const dz = this._v2.z - this._v1.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 <= interactR2 && d2 < bestD2) {
        bestD2 = d2;
        best = { kind: "portal", id: id as PortfolioSectionId };
      }
    }

    // NPCs
    for (const [id, n] of this.level.npcs) {
      n.group.getWorldPosition(this._v2);
      const dx = this._v2.x - this._v1.x;
      const dy = this._v2.y - this._v1.y;
      const dz = this._v2.z - this._v1.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 <= interactR2 && d2 < bestD2) {
        bestD2 = d2;
        best = { kind: "npc", id };
      }
    }

    // Update focus + prompt if changed
    const same =
      (this.focus === null && best === null) ||
      (this.focus !== null && best !== null && this.focus.kind === best.kind && (this.focus as any).id === (best as any).id);

    if (!same) {
      this.focus = best;
      if (best === null) {
        this.ui.showPrompt(null);
      } else if (best.kind === "portal") {
        this.ui.showPrompt(`Enter ${String(best.id).toUpperCase()} portal`);
      } else if (best.kind === "npc") {
        const npc = this.level.npcs.get(best.id);
        const rawName = npc?.name ?? "Friend";
        const dispName = SWEETLAND_NPC_NAME_OVERRIDES[rawName] ?? rawName;
        if (npc && this.focus) (this.focus as any).uiName = dispName;
        this.ui.showPrompt(npc ? `Talk to ${__slNpcDisplayNameFromPromptNameV9(__slNpcDisplayNameV8d(__slNpcDisplayName(dispName)))}` : "Talk");
      }
    }
  }



  // -----------------------------
  // NPC Placement Mode (Option A2)
  // -----------------------------

  private setupNpcPlacementHelpers(): void {
    this.npcPlaceMarker.name = "npc_place_marker";

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.05, 32),
      new THREE.MeshBasicMaterial({ color: 0xffff66, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI * 0.5;
    ring.renderOrder = 999;
    ring.visible = false;

    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.05, 0), 1.25, 0xff66ff);
    arrow.visible = false;

    this.npcPlaceMarker.add(ring);
    this.npcPlaceMarker.add(arrow);
    this.scene.add(this.npcPlaceMarker);

    this.npcPlaceRing = ring;
    this.npcPlaceArrow = arrow;
  }

  private toggleNpcPlacement(): void {
    this.npcPlaceActive = !this.npcPlaceActive;

    if (this.npcPlaceActive) {
      this.npcPlaceList =
        (this.level as any)?.getNpcList?.() ??
        Array.from(this.level.npcs, ([id, n]) => ({ id, name: n.name })).sort((a, b) => a.name.localeCompare(b.name));

      this.npcPlaceIndex = 0;
      if (!this.npcPlaceList.length) {
        console.warn("[SweetLand] No NPCs found to place.");
        this.npcPlaceActive = false;
        return;
      }

      const sel = this.npcPlaceList[this.npcPlaceIndex];
      const npc = this.level.npcs.get(sel.id);
      this.npcPlaceRotY = npc ? npc.group.rotation.y : 0;

      console.log("[SweetLand] NPC placement mode ON.");
      console.log("  Controls: P toggle | N next NPC | Mouse wheel rotate | Click to place | G save here | C pilot | M main | Enter prints placements");

      this.updateNpcPlacementPrompt();
      this.updateNpcPlacementMarker();
    } else {
      console.log("[SweetLand] NPC placement mode OFF.");
      // The normal focus system will restore the prompt as you walk around.
      this.ui.showPrompt(null);
      if (this.npcPlaceRing) this.npcPlaceRing.visible = false;
      if (this.npcPlaceArrow) this.npcPlaceArrow.visible = false;
    }
  }

  private cycleNpcPlacement(): void {
    if (!this.npcPlaceActive) return;
    if (!this.npcPlaceList.length) return;

    this.npcPlaceIndex = (this.npcPlaceIndex + 1) % this.npcPlaceList.length;
    const sel = this.npcPlaceList[this.npcPlaceIndex];
    const npc = this.level.npcs.get(sel.id);
    this.npcPlaceRotY = npc ? npc.group.rotation.y : 0;

    this.updateNpcPlacementPrompt();
    this.updateNpcPlacementMarker();
  }

  private dumpNpcPlacements(): void {
    (this.level as any)?.dumpNpcPlacements?.();
  }

  // -----------------------------
  // NPC Possession Placement Mode (v2)
  // -----------------------------

  private loadNpcPlacements(): void {
    try {
      const raw = localStorage.getItem(this.npcPlacementStorageKey);
      if (!raw) {
        this.npcPlacements = {};
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") this.npcPlacements = parsed;
      else this.npcPlacements = {};
    } catch {
      this.npcPlacements = {};
    }
  }

  private saveNpcPlacements(): void {
    try {
      localStorage.setItem(this.npcPlacementStorageKey, JSON.stringify(this.npcPlacements ?? {}));
    } catch {
      // ignore (storage may be blocked)
    }
  }

  private ensureNpcPossessHud(): void {
    if (this.npcPossessHud) return;
    const hud = document.createElement("div");
    hud.style.position = "fixed";
    hud.style.left = "12px";
    hud.style.top = "12px";
    hud.style.zIndex = "9999";
    hud.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    hud.style.fontSize = "12px";
    hud.style.whiteSpace = "pre";
    hud.style.padding = "10px 12px";
    hud.style.borderRadius = "10px";
    hud.style.background = "rgba(0,0,0,0.55)";
    hud.style.color = "#fff";
    hud.style.pointerEvents = "none";
    hud.style.display = "none";
    document.body.appendChild(hud);
    this.npcPossessHud = hud;
  }

  private renderNpcPossessHud(msg: string | null = null): void {
    this.ensureNpcPossessHud();
    if (!this.npcPossessHud) return;

    if (!this.npcPossessActive) {
      this.npcPossessHud.style.display = "none";
      return;
    }

    this.npcPossessHud.style.display = "block";

    const sel = this.npcPossessList[this.npcPossessIndex];
    const selName = sel ? `${sel.name} (${sel.id})` : "(none)";
    const savedCount = Object.keys(this.npcPlacements ?? {}).length;

    this.npcPossessHud.textContent =
      "NPC Possession Placement (v2)\n" +
      "---------------------------\n" +
      "F7 / Esc: exit\n" +
      "Tab / Shift+Tab: cycle NPC\n" +
      "WASD + Shift + Space: move\n" +
      "Enter: SAVE current NPC\n" +
      "Backspace: CLEAR all\n" +
      "C: copy JSON   G: download JSON\n" +
      "U: warp to hub\n\n" +
      `Selected: ${selName}  [${this.npcPossessList.length ? this.npcPossessIndex + 1 : 0}/${this.npcPossessList.length}]\n` +
      `Saved: ${savedCount}\n` +
      (msg ? `\n${msg}` : "");
  }

  private refreshNpcPossessList(): void {
    this.npcPossessList =
      (this.level as any)?.getNpcList?.() ??
      Array.from(this.level.npcs, ([id, n]) => ({ id, name: n.name })).sort((a, b) => a.name.localeCompare(b.name));

    if (this.npcPossessIndex < 0) this.npcPossessIndex = 0;
    if (this.npcPossessIndex >= this.npcPossessList.length) this.npcPossessIndex = 0;
  }

  private toggleNpcPossessMode(): void {
    this.npcPossessActive = !this.npcPossessActive;

    if (this.npcPossessActive) {
      this.refreshNpcPossessList();
      if (!this.npcPossessList.length) {
        console.warn("[SweetLand] No NPCs found to possess.");
        this.npcPossessActive = false;
        this.renderNpcPossessHud("No NPCs found.");
        return;
      }

      // Disable NPC colliders while placing so you don't get stuck on stacked NPCs.
      try {
        (this.level as any)?.setAllNpcCollidersEnabled?.(false);
      } catch {
        // ignore
      }

      // Use a larger capsule while placing so jumping/collisions behave like NPCs.
      this.player.setCapsulePreset("npc");

      // Hide the player mesh so it feels like you're piloting the NPC.
      this.player.mesh.visible = false;

      // Start on current index
      this.possessSelect(this.npcPossessIndex);

      this.renderNpcPossessHud("Placement mode ON.");
    } else {
      // Exit: re-enable colliders, show player again, and snap NPCs to saved placements.
      try {
        (this.level as any)?.applyNpcPlacements?.(this.npcPlacements);
      } catch {
        // ignore
      }

      try {
        (this.level as any)?.setAllNpcCollidersEnabled?.(true);
      } catch {
        // ignore
      }

      // Restore normal player capsule for the shipped experience.
      this.player.setCapsulePreset("player");
      this.player.mesh.visible = true;
      this.npcPossessId = null;

      this.renderNpcPossessHud("Placement mode OFF.");
      // Hide after a brief moment so the user sees "OFF"
      window.setTimeout(() => {
        if (!this.npcPossessActive) this.renderNpcPossessHud(null);
      }, 250);
    }
  }

  private possessSelect(index: number): void {
    if (!this.npcPossessList.length) return;

    // Wrap index
    const n = this.npcPossessList.length;
    this.npcPossessIndex = ((index % n) + n) % n;

    const sel = this.npcPossessList[this.npcPossessIndex];
    this.npcPossessId = sel.id;

    // Teleport the (hidden) player body to the NPC's current position so movement starts from there.
    const tr = (this.level as any)?.getNpcTransform?.(sel.id) ?? null;
    const pos: THREE.Vector3 = tr?.pos ? tr.pos : this.level.npcs.get(sel.id)?.group.position.clone() ?? new THREE.Vector3(0, 0, 0);
    const rotY: number = tr?.rotY ?? this.level.npcs.get(sel.id)?.group.rotation.y ?? 0;

    // Player mesh y = bodyY - footOffset, so offset by +footOffset to put feet on the ground.
    this.player.setPosition(new THREE.Vector3(pos.x, pos.y + this.player.getFootOffset(), pos.z));
    this.player.mesh.rotation.y = rotY;

    this.renderNpcPossessHud(`Selected: ${sel.name}`);
  }

  private possessCycle(dir: number): void {
    if (!this.npcPossessActive) return;
    if (!this.npcPossessList.length) return;
    this.possessSelect(this.npcPossessIndex + dir);
  }

  private updateNpcPossess(): void {
    if (!this.npcPossessActive) return;
    if (!this.npcPossessId) return;

    const npc = this.level.npcs.get(this.npcPossessId);
    if (!npc) return;

    // Make the NPC model follow the player's controlled body.
    // Make the NPC model follow the player's controlled body (physics translation).
    const t = this.player.body.translation();
    const y = t.y - this.player.getFootOffset();
    npc.group.position.set(t.x, y, t.z);
    npc.group.rotation.y = this.player.mesh.rotation.y;

  }

  private saveCurrentNpcPlacement(): void {
    if (!this.npcPossessActive) return;
    const id = this.npcPossessId;
    if (!id) return;

    const t = this.player.body.translation();
    const pos = new THREE.Vector3(t.x, t.y - this.player.getFootOffset(), t.z);
    const rotY = this.player.mesh.rotation.y;

    this.npcPlacements[id] = { pos: { x: pos.x, y: pos.y, z: pos.z }, rotY };
    this.saveNpcPlacements();

    // Also apply immediately to the level so reload + exit matches.
    try {
      (this.level as any)?.setNpcTransform?.(id, new THREE.Vector3(pos.x, pos.y, pos.z), rotY);
    } catch {
      // ignore
    }

    const sel = this.npcPossessList[this.npcPossessIndex];
    this.renderNpcPossessHud(`SAVED: ${sel?.name ?? id}`);
    console.log("[SweetLand] NPC placement saved:", id, this.npcPlacements[id]);
  }

  private clearNpcPlacements(): void {
    if (!this.npcPossessActive) return;

    this.npcPlacements = {};
    this.saveNpcPlacements();

    try {
      (this.level as any)?.resetAllNpcsToSpawn?.();
    } catch {
      // ignore
    }

    this.renderNpcPossessHud("CLEARED all saved placements.");
    console.log("[SweetLand] NPC placements cleared.");
  }

  private async copyNpcPlacements(): Promise<void> {
    try {
      const txt = JSON.stringify(this.npcPlacements ?? {}, null, 2);
      await navigator.clipboard.writeText(txt);
      this.renderNpcPossessHud("COPIED placements JSON to clipboard.");
      console.log("[SweetLand] Copied NPC placements to clipboard.");
    } catch (e) {
      this.renderNpcPossessHud("COPY failed (see console).");
      console.warn("[SweetLand] Clipboard copy failed", e);
    }
  }

  private downloadNpcPlacements(): void {
    try {
      const txt = JSON.stringify(this.npcPlacements ?? {}, null, 2);
      const blob = new Blob([txt], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sweetland_npc_placements.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      this.renderNpcPossessHud("DOWNLOADED placements JSON.");
    } catch (e) {
      this.renderNpcPossessHud("DOWNLOAD failed (see console).");
      console.warn("[SweetLand] Download failed", e);
    }
  }


  private updateNpcPlacementPrompt(): void {
    if (!this.npcPlaceActive) return;
    const sel = this.npcPlaceList[this.npcPlaceIndex];
    if (!sel) return;

    this.ui.showPrompt(
      `PLACE NPC (${this.npcPlaceIndex + 1}/${this.npcPlaceList.length}): ${sel.name}  |  Click: place  |  Wheel: rotate  |  G: place here | C: pilot | M: main | N: next  |  Enter: print  |  P: exit`
    );
  }

  private updateNpcPlacementMarker(): void {
    if (!this.npcPlaceRing || !this.npcPlaceArrow) return;

    if (!this.npcPlaceActive || !this.npcPlaceList.length) {
      this.npcPlaceRing.visible = false;
      this.npcPlaceArrow.visible = false;
      return;
    }

    const sel = this.npcPlaceList[this.npcPlaceIndex];
    const npc = sel ? this.level.npcs.get(sel.id) : null;
    if (!npc) {
      this.npcPlaceRing.visible = false;
      this.npcPlaceArrow.visible = false;
      return;
    }

    const wp = new THREE.Vector3();
npc.group.getWorldPosition(wp);
this.npcPlaceMarker.position.set(wp.x, wp.y + 0.03, wp.z);
    this.npcPlaceRing.visible = true;

    const d = new THREE.Vector3(Math.sin(this.npcPlaceRotY), 0, Math.cos(this.npcPlaceRotY));
    if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
    this.npcPlaceArrow.setDirection(d.normalize());
    this.npcPlaceArrow.visible = true;
  }

  private rotateSelectedNpc(dir: number): void {
    if (!this.npcPlaceActive) return;
    const sel = this.npcPlaceList[this.npcPlaceIndex];
    const npc = sel ? this.level.npcs.get(sel.id) : null;
    if (!sel || !npc) return;

    const step = Math.PI / 12; // 15 degrees
    this.npcPlaceRotY += step * dir;

    const twoPi = Math.PI * 2;
    while (this.npcPlaceRotY > twoPi) this.npcPlaceRotY -= twoPi;
    while (this.npcPlaceRotY < -twoPi) this.npcPlaceRotY += twoPi;

    // Persist rotation only (keep same position)
    (this.level as any)?.setNpcPlacement?.(sel.id, npc.group.position.clone(), this.npcPlaceRotY, true);

    this.updateNpcPlacementPrompt();
    this.updateNpcPlacementMarker();
  }

  private isObjectInNpc(obj: THREE.Object3D): boolean {
    let o: THREE.Object3D | null = obj;
    while (o) {
      if (this.level.npcs.has(o.name)) return true;
      o = o.parent;
    }
    return false;
  }

  private placeSelectedNpcAtCrosshair(): void {
    if (!this.npcPlaceActive) return;
    if (this.uiIsBlocking()) return;

    const sel = this.npcPlaceList[this.npcPlaceIndex];
    if (!sel) return;

    // Ray from the camera through the center of the screen (crosshair)
    this.camera.getWorldPosition(this._v2);
    this.camera.getWorldDirection(this._v3);
    this._v3.normalize();

    this.npcPlaceRay.set(this._v2, this._v3);
    this.npcPlaceRay.far = 250;

    const hits = this.npcPlaceRay.intersectObjects(this.level.scene.children, true);
    let point: THREE.Vector3 | null = null;
    for (const h of hits) {
      const obj = h.object as THREE.Object3D;
      if (!obj.visible) continue;
      if (obj.name?.startsWith("coin_")) continue;
      if (this.isObjectInNpc(obj)) continue;
      point = h.point.clone();
      break;
    }

    if (!point) {
      console.warn("[SweetLand] No surface hit; aim at a platform/ground and click again.");
      return;
    }

    const pos = point.clone();
    pos.y += 0.02; // tiny lift to avoid z-fighting with the surface

    // Convert world hit point -> NPC parent-local space (prevents offset placement)
const npc = this.level.npcs.get(sel.id);
let posLocal = pos.clone();
if (npc?.group.parent) {
  npc.group.parent.updateMatrixWorld(true);
  posLocal = npc.group.parent.worldToLocal(pos.clone());
}

const ok = (this.level as any)?.setNpcPlacement?.(sel.id, posLocal, this.npcPlaceRotY, true);

if (ok !== false) {
  if (npc) {
    npc.group.position.copy(posLocal);
    npc.group.rotation.y = this.npcPlaceRotY;
  }
}

console.log(`[SweetLand] Placed NPC ${sel.name} (${sel.id}) at { x: ${posLocal.x.toFixed(3)}, y: ${posLocal.y.toFixed(3)}, z: ${posLocal.z.toFixed(3)}, rotY: ${this.npcPlaceRotY.toFixed(4)} }`);

    this.updateNpcPlacementPrompt();
    this.updateNpcPlacementMarker();
  }
  
  private ensureRoundedMinimapResources(mmSize: number, mmPad: number, w: number, h: number): void {
    const dpr = this.renderer.getPixelRatio();
    const rtSize = Math.max(64, Math.floor(mmSize * dpr));

    if (!this.minimapRT || this.minimapRTSize !== rtSize) {
      if (this.minimapRT) this.minimapRT.dispose();
      this.minimapRT = new THREE.WebGLRenderTarget(rtSize, rtSize, {
        depthBuffer: true,
        stencilBuffer: false,
      });
      this.minimapRT.texture.name = "SweetLand_MinimapRT";
      this.minimapRTSize = rtSize;

      if (this.minimapHudMaterial) {
        this.minimapHudMaterial.uniforms.tMap.value = this.minimapRT.texture;
      }
    }

    if (!this.minimapHudMaterial) {
      this.minimapHudMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          tMap: { value: this.minimapRT!.texture },
          uRadius: { value: 0.12 },
          uAASoft: { value: 1.5 / rtSize }, // UV units (~1.5px)
          uBright: { value: 1.15 },
 // UV units
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `precision highp float;
uniform sampler2D tMap;
uniform float uRadius;     // UV units
uniform float uAASoft;     // UV units (soft edge)
uniform float uBright;     // brightness multiplier

varying vec2 vUv;

float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 uv = vUv;
  uv.y = 1.0 - uv.y;

  vec3 col = texture2D(tMap, uv).rgb;
        // SweetLand minimap brightness boost (match main scene exposure)
        col = min(col * 1.25, vec3(1.0));
// Approx linear->sRGB + slight lift (ShaderMaterial doesn't automatically apply output encoding)
  col = pow(col, vec3(1.0 / 2.2));
  col *= uBright;
  col = min(col, vec3(1.0));

  vec2 p = vUv - 0.5;
  vec2 b = vec2(0.5);
  float d = sdRoundRect(p, b, uRadius);

  float aa = max(0.0005, uAASoft);
  float alpha = 1.0 - smoothstep(0.0, aa, d);

  gl_FragColor = vec4(col, alpha);
}`,
      });

      this.minimapHudMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.minimapHudMaterial);
      this.minimapHudScene.add(this.minimapHudMesh);
    }

    if (this.minimapHudLastW !== w || this.minimapHudLastH !== h) {
      this.minimapHudCamera.left = 0;
      this.minimapHudCamera.right = w;
      this.minimapHudCamera.top = h;
      this.minimapHudCamera.bottom = 0;
      this.minimapHudCamera.near = -10;
      this.minimapHudCamera.far = 10;
      this.minimapHudCamera.updateProjectionMatrix();
      this.minimapHudLastW = w;
      this.minimapHudLastH = h;
    }

    if (this.minimapHudMesh && this.minimapHudLastSize !== mmSize) {
      this.minimapHudMesh.scale.set(mmSize, mmSize, 1);

      const radiusPx = Math.max(10, Math.min(22, mmSize * 0.12));
      this.minimapHudMaterial!.uniforms.uRadius.value = radiusPx / mmSize;
      this.minimapHudMaterial!.uniforms.uAASoft.value = 1.5 / mmSize;
      this.minimapHudMaterial!.uniforms.uBright.value = 1.15;

      this.minimapHudLastSize = mmSize;
    }

    if (this.minimapHudMesh) {
      const x = w - mmPad - mmSize / 2;
      const y = h - mmPad - mmSize / 2;
      this.minimapHudMesh.position.set(x, y, 0);
    }
  }

private render(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;

  // --- minimap (render to texture, then draw rounded quad) ---
  const mmSize = Math.floor(Math.min(w, h) * 0.26);
  const mmPad = 16;
  this.ensureRoundedMinimapResources(mmSize, mmPad, w, h);

  if (this.minimapRT) {
    const rt = this.minimapRTSize;
    this.renderer.setRenderTarget(this.minimapRT);
    this.renderer.setViewport(0, 0, rt, rt);
    this.renderer.setScissorTest(false);
    this.renderer.clear();
    this.renderer.render(this.scene, this.minimapCamera);
    this.renderer.setRenderTarget(null);
  }

  // --- main view ---
  this.renderer.setViewport(0, 0, w, h);
  this.renderer.setScissorTest(false);
  this.renderer.render(this.scene, this.camera);

  // --- minimap overlay ---
  if (this.minimapHudMesh) {
    const prevAutoClear = this.renderer.autoClear;
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.renderer.render(this.minimapHudScene, this.minimapHudCamera);
    this.renderer.autoClear = prevAutoClear;
  }
}


  private updateMinimapCamera(): void {
    const p = this.player.position;
    this.minimapCamera.position.set(p.x, p.y + 55, p.z);
    this.minimapCamera.up.set(0, 0, -1);
    this.minimapCamera.lookAt(p.x, p.y, p.z);
    this.minimapCamera.updateProjectionMatrix();
  }

  private uiIsBlocking(): boolean {
    const panelOpen = !qs<HTMLElement>("#panel").classList.contains("hidden");
    const dialogueOpen = !qs<HTMLElement>("#dialogue").classList.contains("hidden");
    return panelOpen || dialogueOpen;
  }

  // SWEETLAND_PORTAL_CINEMATIC_V1
  private enterPortal(id: PortfolioSectionId): void {
    if (this.portalCine || this.portalUiOpen) return;
    const portal = this.level.portals.get(id);
    if (!portal) return;

    // SWEETLAND_PORTAL_CINEMATIC_V1B_RESTORE
    if (this.portalGameplayFov == null) this.portalGameplayFov = this.camera.fov;

    // Hide prompt and clear focus immediately.
    this.focus = null;
    this.ui.showPrompt(null);

    // Compute a camera pose on the same side as the player, but closer to the portal.
    const portalPos = new THREE.Vector3();
    portal.group.getWorldPosition(portalPos);

    const side = this.player.position.clone().sub(portalPos);
    side.y = 0;
    if (side.lengthSq() < 1e-6) {
      portal.group.getWorldDirection(side);
      side.y = 0;
    }
    if (side.lengthSq() < 1e-6) side.set(0, 0, 1);
    side.normalize();

    const toPos = portalPos
      .clone()
      .addScaledVector(side, 4.2)
      .add(new THREE.Vector3(0, 2.2, 0));

    const lookAt = portalPos.clone().add(new THREE.Vector3(0, 2.4, 0));
    const dummy = new THREE.PerspectiveCamera();
    dummy.position.copy(toPos);
    dummy.lookAt(lookAt);

    this.portalCine = {
      phase: "enter",
      id,
      t: 0,
      dur: 0.65,
      fromPos: this.camera.position.clone(),
      fromQuat: this.camera.quaternion.clone(),
      fromFov: this.camera.fov,
      toPos,
      toQuat: dummy.quaternion.clone(),
      toFov: 34
    };

    // Release pointer lock so the user can click the preview link.
    try {
      if (document.pointerLockElement) document.exitPointerLock();
    } catch {}
  }

  private updatePortalCinematic(dt: number): boolean {
    if (this.portalCine) {
      const c = this.portalCine;
      c.t += dt;
      const u = Math.min(1, c.t / c.dur);
      const e = u * u * (3 - 2 * u); // smoothstep

      this.camera.position.lerpVectors(c.fromPos, c.toPos, e);
      this.camera.quaternion.copy(c.fromQuat).slerp(c.toQuat, e);
      this.camera.fov = c.fromFov + (c.toFov - c.fromFov) * e;
      this.camera.updateProjectionMatrix();

      if (u >= 1) {
        this.portalCine = null;
        this.portalUiOpen = true;
        this.ui.openSection(c.id);
        (this.tpc as any).syncFromCamera?.();
      }
      return true;
    }

    // While the panel is open, keep the camera fixed in the cinematic view.
    if (this.portalUiOpen) {
      // SWEETLAND_PORTAL_CINEMATIC_V1B_RESTORE
      // Auto-heal: if the UI panel is already hidden, resume gameplay camera.
      try {
        const el = document.getElementById("panel");
        if (el && el.classList.contains("hidden")) {
          this.exitPortalView();
          return false;
        }
      } catch {}
      return true;
    }

    return false;
  }

  private teleportToSection(id: PortfolioSectionId): void {
    const spot = this.level.portals.get(id)?.teleportTo;
    if (!spot) return;
    // teleport a little above to avoid embedding
    this.player.setPosition(spot.clone().add(new THREE.Vector3(0, 0.6, 0)));
  }

  private warpToHub(): void {
    // Patched: custom hub/respawn destination (body coords)
    this.player.setPosition(new THREE.Vector3(-33.7, 6.921, 22.758));
    // Optional facing
    if ((this.player as any).setRotationY) (this.player as any).setRotationY(1.939);
}

  private resetCoins(): void {
    this.coins = 0;
    this.ui.setCoins(this.coins);
    this.level.respawnCoins();
  }


// ---------------------------------------------------------------------------
// Player/NPC swap helpers
// ---------------------------------------------------------------------------
private _playerVisualHeight = 2.2;

private ensureNpcFromPlayerOrMoveExisting(
  id: string,
  name: string,
  pose: { x: number; y: number; z: number; rotY: number }
): void {
  // Capture the current player visual height (used to scale Nutty Knight).
  const currentVis = this.pickBestVisualChild(this.player.mesh);
  const curH = currentVis ? this.measureObjectHeight(currentVis) : 0;
  if (curH > 0.1) this._playerVisualHeight = curH;

  // If the NPC already exists, just move it.
  if ((this.level as any).setNpcPose && this.level.npcs.has(id)) {
    (this.level as any).setNpcPose(id, pose);
    return;
  }

  // Otherwise: detach the current player visual (Sweetie_01) and re-use it as an NPC.
  const vis = this.detachBestVisualChild(this.player.mesh);
  if (!vis) {
    console.warn(`[SweetLand] Could not detach player visual for '${id}'.`);
    return;
  }

  const h = this.measureObjectHeight(vis);
  if (h > 0.1) this._playerVisualHeight = h;

  if ((this.level as any).spawnNpcFromVisual) {
    (this.level as any).spawnNpcFromVisual(id, name, vis, pose);
  } else {
    console.warn("[SweetLand] Level.spawnNpcFromVisual not found; cannot create Sweetie NPC.");
  }
}

private swapPlayerVisualFromNpc(npcId: string): void {
  const npc = this.level.npcs.get(npcId);
  if (!npc) {
    console.warn(`[SweetLand] NPC '${npcId}' not found; cannot swap player visual.`);
    return;
  }

  // Choose the most "visual" child from the NPC group.
  const src = this.pickBestVisualChild(npc.group);
  if (!src) {
    console.warn(`[SweetLand] NPC '${npcId}' has no visual child to swap.`);
    return;
  }

  // Detach from NPC group so we keep the exact loaded model (skinned meshes safe).
  npc.group.remove(src);

  // Normalize and scale to match the player's old height.
  this.normalizeToFeetAndCenter(src);

  const srcH = this.measureObjectHeight(src);
  if (srcH > 0.1 && this._playerVisualHeight > 0.1) {
    const sc = this._playerVisualHeight / srcH;
    src.scale.multiplyScalar(sc);
    // Re-normalize after scaling.
    this.normalizeToFeetAndCenter(src);
  }

  // Remove any previous swapped visual.
  for (const ch of [...this.player.mesh.children]) {
    if ((ch as any)?.name === "__playerVisualSwap") this.player.mesh.remove(ch);
  }

  // Hide remaining children in the player mesh (old visuals, debug meshes, etc.).
  for (const ch of this.player.mesh.children) ch.visible = false;

  src.name = "__playerVisualSwap";
  this.player.mesh.add(src);

  // Hook up movement animations for this swapped-in visual (idle/walk/run when available).
  this.setupPlayerMovementAnimations(src, (npc as any).clips as any);

  // Remove the original NPC colliders/entry so you don't have duplicates or invisible blockers.
  if ((this.level as any).removeNpc) {
    (this.level as any).removeNpc(npcId);
  } else if ((this.level as any).setNpcPose) {
    (this.level as any).setNpcPose(npcId, { x: 0, y: -9999, z: 0, rotY: 0 });
  }
}

private setupPlayerMovementAnimations(
  root: THREE.Object3D,
  clipsMaybe: THREE.AnimationClip[] | undefined
): void {
  // Stop any previous mixer/actions.
  try {
    this.playerAnimMixer?.stopAllAction();
  } catch {}

  this.playerAnimMixer = null;
  this.playerAnimActions = null;
  this.playerAnimCurrent = null;

  const clips = Array.isArray(clipsMaybe) ? clipsMaybe : undefined;
  if (!clips || clips.length === 0) {
    console.warn("[SweetLand] No animation clips found for swapped player visual.");
    return;
  }

  // Create a mixer targeting the swapped model root (works for skinned meshes).
  const mixer = new THREE.AnimationMixer(root);

  const find = (re: RegExp) => clips.find((c) => re.test(c.name));

  const idleClip =
    find(/idle|stand|breath|wait/i) ??
    // Some exports name the default clip "Armature|Action" etc.
    clips[0];

  const walkClip = find(/walk/i);
  const runClip = find(/run|jog|sprint/i);
  const jumpClip = find(/jump|hop/i);
  const fallClip = find(/fall|air|drop/i);

  const idle = idleClip ? mixer.clipAction(idleClip) : undefined;
  const walk = walkClip ? mixer.clipAction(walkClip) : undefined;
  const run = runClip ? mixer.clipAction(runClip) : undefined;
  const jump = jumpClip ? mixer.clipAction(jumpClip) : undefined;
  const fall = fallClip ? mixer.clipAction(fallClip) : undefined;

  // Configure actions
  for (const a of [idle, walk, run, fall]) {
    if (!a) continue;
    a.enabled = true;
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = false;
  }

  if (jump) {
    jump.enabled = true;
    jump.setLoop(THREE.LoopOnce, 1);
    jump.clampWhenFinished = true;
  }

  // Start idle by default.
  if (idle) {
    idle.reset().fadeIn(0.01).play();
    this.playerAnimCurrent = idle;
  } else if (walk) {
    walk.reset().fadeIn(0.01).play();
    this.playerAnimCurrent = walk;
  } else if (run) {
    run.reset().fadeIn(0.01).play();
    this.playerAnimCurrent = run;
  }

  this.playerAnimMixer = mixer;
  this.playerAnimActions = { idle, walk, run, jump, fall };
}

private setPlayerAnim(next: THREE.AnimationAction | undefined, fade = 0.12): void {
  if (!next) return;
  if (this.playerAnimCurrent === next) return;

  try {
    next.reset();
    next.enabled = true;

    if (this.playerAnimCurrent) {
      // Smoothly blend between actions.
      this.playerAnimCurrent.fadeOut(fade);
      next.fadeIn(fade).play();
    } else {
      next.fadeIn(0.01).play();
    }

    this.playerAnimCurrent = next;
  } catch {
    // ignore
  }
}

private updatePlayerMovementAnimation(dt: number): void {
  if (!this.playerAnimMixer || !this.playerAnimActions) return;

  // Best-effort: read player velocity from Rapier rigid body.
  let vx = 0;
  let vy = 0;
  let vz = 0;

  try {
    const b: any = (this.player as any).body;
    const lv = b?.linvel?.();
    if (lv) {
      vx = Number(lv.x) || 0;
      vy = Number(lv.y) || 0;
      vz = Number(lv.z) || 0;
    }
  } catch {}

  const speed = Math.hypot(vx, vz);

  // Best-effort grounded flag (varies by Player implementation).
  const pAny: any = this.player as any;
  const grounded =
    (typeof pAny.isGrounded === "boolean" ? pAny.isGrounded : undefined) ??
    (typeof pAny.grounded === "boolean" ? pAny.grounded : undefined) ??
    (typeof pAny.onGround === "boolean" ? pAny.onGround : undefined) ??
    true;

  const A = this.playerAnimActions;

  // State selection
  const WALK_TH = 0.20;
  const RUN_TH = 3.35;

  let desired: THREE.AnimationAction | undefined = A.idle;

  if (!grounded) {
    // Airborne: prefer jump on upward velocity, else fall.
    if (vy > 1.2 && A.jump) desired = A.jump;
    else if (A.fall) desired = A.fall;
    else desired = A.idle;
  } else if (speed > RUN_TH && A.run) {
    desired = A.run;
  } else if (speed > WALK_TH && A.walk) {
    desired = A.walk;
  } else {
    desired = A.idle ?? A.walk ?? A.run;
  }

  // Adjust playback speed so walk/run roughly match movement.
  if (desired === A.walk && A.walk) {
    A.walk.timeScale = THREE.MathUtils.clamp(speed / 2.15, 0.7, 1.7);
  } else if (desired === A.run && A.run) {
    A.run.timeScale = THREE.MathUtils.clamp(speed / 4.2, 0.8, 2.0);
  } else if (desired) {
    desired.timeScale = 1.0;
  }

  this.setPlayerAnim(desired, 0.12);

  // Advance the mixer.
  this.playerAnimMixer.update(dt);
}

private pickBestVisualChild(root: THREE.Object3D): THREE.Object3D | null {
  const children = (root as any)?.children as THREE.Object3D[] | undefined;
  if (!children || children.length === 0) return null;

  const score = (o: THREE.Object3D) => {
    let meshes = 0;
    o.traverse((n: any) => {
      if (n?.isMesh || n?.isSkinnedMesh) meshes++;
    });
    return meshes;
  };

  let best: THREE.Object3D | null = null;
  let bestScore = -1;

  for (const c of children) {
    if (!c) continue;
    const s = score(c);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }

  return best ?? children[0];
}

private detachBestVisualChild(root: THREE.Object3D): THREE.Object3D | null {
  const best = this.pickBestVisualChild(root);
  if (!best) return null;
  try {
    root.remove(best);
  } catch {
    // ignore
  }
  return best;
}

private measureObjectHeight(obj: THREE.Object3D): number {
  try {
    obj.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(obj);
    const s = new THREE.Vector3();
    b.getSize(s);
    return isFinite(s.y) ? s.y : 0;
  } catch {
    return 0;
  }
}

private normalizeToFeetAndCenter(obj: THREE.Object3D): void {
  try {
    obj.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3();
    b.getCenter(c);
    const feetY = b.min.y;

    // Move pivot so feet sit at y=0, centered on x/z.
    obj.position.sub(new THREE.Vector3(c.x, feetY, c.z));
  } catch {
    // ignore
  }
}

private ensureAudio(): void {
  if (this.audioCtx) return;
  const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  try {
    this.audioCtx = new AC();
    // some browsers start suspended until first gesture — pointerdown calls this
    if (this.audioCtx.state === "suspended") this.audioCtx.resume().catch(() => {});
  } catch {
    this.audioCtx = null;
  }
}

private playPopSound(): void {
  const ctx = this.audioCtx;
  if (!ctx) return;

  try {
    const t0 = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(520, t0);
    osc.frequency.exponentialRampToValueAtTime(240, t0 + 0.08);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.096, t0 + 0.01); // [SweetLand] volume scaled 0.8 pop
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + 0.13);
  } catch {
    // ignore audio failures
  }
}

private triggerPopFx(pos: THREE.Vector3): void {
  // Simple "pop" — a tiny sphere that scales up and fades out
  const geom = new THREE.SphereGeometry(0.12, 10, 8);
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 });
  const m = new THREE.Mesh(geom, mat);
  m.position.copy(pos);
  m.position.y += 0.35;
  this.scene.add(m);

  this.popFx.push({ mesh: m, start: performance.now() * 0.001, dur: 0.35 });
}

private updatePopFx(t: number): void {
  if (this.popFx.length === 0) return;
  const keep: typeof this.popFx = [];

  for (const fx of this.popFx) {
    const age = t - fx.start;
    const u = age / fx.dur;

    if (u >= 1) {
      this.scene.remove(fx.mesh);
      (fx.mesh.geometry as any)?.dispose?.();
      (fx.mesh.material as any)?.dispose?.();
      continue;
    }

    const s = 1 + u * 1.8;
    fx.mesh.scale.set(s, s, s);
    fx.mesh.position.y += 0.005;
    const mat = fx.mesh.material as any;
    if (mat) mat.opacity = 0.95 * (1 - u);

    keep.push(fx);
  }

  this.popFx = keep;
}
}
