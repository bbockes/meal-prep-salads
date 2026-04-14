/**
 * Generate overhead editorial food photos for each recipe via fal-ai/nano-banana-pro.
 *
 * Prerequisites:
 *   npm install
 *   export FAL_KEY="your_fal_api_key"
 *
 * Usage:
 *   node scripts/generate-recipe-images.mjs --dry-run
 *   node scripts/generate-recipe-images.mjs --slug=winter-harvest
 *   node scripts/generate-recipe-images.mjs --limit=3
 *   node scripts/generate-recipe-images.mjs --skip-existing
 *   node scripts/generate-recipe-images.mjs --batch   # no pause between images
 *   MEAL_PREP_IMAGES_BATCH=1 node …                # same as --batch (no prompts)
 *
 * After generating PNGs into `images/`, run `npm run optimize-images` to write resized WebP to
 * `public/images/` and `images/` (masters stay as PNG under `images/` only). The app loads `.webp`.
 */

import fs from 'fs';
import path from 'path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'url';
import { fal } from '@fal-ai/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'index.html');
const IMAGES_DIR = path.join(ROOT, 'images');

const PROMPT_SUFFIX = ` The bowl is viewed perfectly from above, at a strict 90-degree overhead perspective, filling most of the frame with minimal empty space. Arrange the ingredients naturally but attractively so each component is clearly visible from above, highlighting color, texture, and preparation style—e.g., sliced, roasted, crumbled, or toasted. Emphasize contrasts between elements: crisp greens, creamy components, crunchy toppings, and a light drizzle of dressing with a subtle sheen. Use natural soft daylight with even lighting and minimal shadows, a clean neutral background (light stone, marble, or wood), and a bowl that matches the salad style (rustic ceramic or modern minimal). Maintain sharp focus across the entire bowl, true-to-life colors, and realistic textures, creating a polished, professional food magazine shot without artificial colors, stylization, or unnecessary props.`;

/** Turn en/em/minus signs into ASCII `-` so pasted flags still match (e.g. `–batch` → `--batch`). */
function normalizeFlagToken(raw) {
  return String(raw).trim().replace(/[\u2013\u2014\u2212]/g, '-');
}

function envMeansBatch(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function parseArgs(argv) {
  const out = { dryRun: false, slug: null, limit: null, skipExisting: false, batch: false };
  for (const raw of argv) {
    const a = normalizeFlagToken(raw);
    if (a === '--dry-run') out.dryRun = true;
    if (a === '--skip-existing') out.skipExisting = true;
    if (
      a === '--batch' ||
      a === '--yes' ||
      a === '--no-prompt' ||
      a === '-batch' ||
      a === '-yes' ||
      a === '-no-prompt'
    ) {
      out.batch = true;
    }
    const batchEq = a.match(/^(-{1,2})batch=(.+)$/);
    if (batchEq && envMeansBatch(batchEq[2])) out.batch = true;
    const yesEq = a.match(/^(-{1,2})yes=(.+)$/);
    if (yesEq && envMeansBatch(yesEq[2])) out.batch = true;
    if (a.startsWith('--slug=')) out.slug = a.slice('--slug='.length);
    if (a.startsWith('--limit=')) out.limit = Math.max(1, parseInt(a.slice('--limit='.length), 10) || 0);
  }
  if (envMeansBatch(process.env.MEAL_PREP_IMAGES_BATCH)) out.batch = true;
  return out;
}

/** @param {import('node:readline/promises').Interface} rl */
async function promptAfterSave(rl, filePath) {
  const line = await rl.question(
    `\n  Saved: ${filePath}\n  Open the image to review.  [Enter] = approve & next recipe  ·  r = regenerate this one  ·  q = quit\n> `,
  );
  const key = line.trim().toLowerCase();
  if (key === 'q' || key === 'quit') return 'quit';
  if (key === 'r' || key === 'regenerate') return 'regenerate';
  return 'next';
}

/** Match filenames like winter-harvest.png (drops a trailing " Salad" from the card title). */
function slugForRecipe(name) {
  const base = name.replace(/\s+Salad$/i, '').trim();
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function loadRecipesFromIndexHtml() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const metaIdx = html.indexOf('const RECIPE_META_BY_ID');
  if (metaIdx === -1) throw new Error('Could not find RECIPE_META_BY_ID anchor in index.html');
  const recipesSection = html.slice(0, metaIdx);
  const recipeStart = recipesSection.indexOf('const RECIPES = [');
  if (recipeStart === -1) throw new Error('Could not find const RECIPES in index.html');
  const lastClose = recipesSection.lastIndexOf('];');
  if (lastClose === -1 || lastClose < recipeStart) throw new Error('Could not find end of RECIPES array');
  const arrStr = recipesSection.slice(recipeStart + 'const RECIPES = '.length, lastClose + 1);
  const recipes = new Function(`return ${arrStr}`)();
  if (!Array.isArray(recipes)) throw new Error('Parsed RECIPES is not an array');
  return recipes;
}

function buildPrompt(recipe) {
  const ingredientBlock = recipe.ingredients.join('; ');
  return `Create an ultra-realistic, editorial-style food photograph of a fresh salad made with the following ingredients: ${ingredientBlock}.${PROMPT_SUFFIX}`;
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const recipes = loadRecipesFromIndexHtml();
  let list = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    slug: slugForRecipe(r.name),
    prompt: buildPrompt(r),
  }));

  if (args.slug) {
    list = list.filter((r) => r.slug === args.slug);
    if (list.length === 0) {
      console.error(`No recipe with slug "${args.slug}".`);
      process.exit(1);
    }
  }
  if (args.limit) list = list.slice(0, args.limit);

  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

  if (args.dryRun) {
    console.log(
      `Would generate ${list.length} image(s) into ${IMAGES_DIR} (${args.batch ? 'batch' : 'interactive'} mode)`,
    );
    for (const r of list) {
      console.log(`  [${r.id}] ${r.slug}.png — ${r.name}`);
      console.log(`    prompt length: ${r.prompt.length} chars`);
    }
    return;
  }

  if (!process.env.FAL_KEY) {
    console.error('Set FAL_KEY in the environment (see https://fal.ai/models/fal-ai/nano-banana-pro/api).');
    process.exit(1);
  }

  fal.config({ credentials: process.env.FAL_KEY });

  console.log(
    args.batch
      ? 'Mode: batch — no prompts between images (MEAL_PREP_IMAGES_BATCH or --batch).'
      : 'Mode: interactive — press Enter after each image, or use --batch.',
  );

  const rl = args.batch ? null : readline.createInterface({ input, output });

  try {
    for (const r of list) {
      const outPath = path.join(IMAGES_DIR, `${r.slug}.png`);
      if (args.skipExisting && fs.existsSync(outPath)) {
        console.log(`Skip (exists): ${r.slug}.png`);
        continue;
      }

      let attempt = 0;
      for (;;) {
        attempt += 1;
        console.log(`Generating: ${r.name} → ${r.slug}.png${attempt > 1 ? ` (attempt ${attempt})` : ''} …`);
        const result = await fal.subscribe('fal-ai/nano-banana-pro', {
          input: {
            prompt: r.prompt,
            num_images: 1,
            aspect_ratio: '1:1',
            output_format: 'png',
            resolution: '2K',
          },
          logs: true,
        });
        const url = result.data?.images?.[0]?.url;
        if (!url) {
          console.error('Unexpected response:', JSON.stringify(result.data, null, 2));
          throw new Error('No image URL in fal response');
        }
        await downloadToFile(url, outPath);

        if (args.batch) {
          console.log(`  saved ${outPath}`);
          break;
        }

        const action = await promptAfterSave(rl, outPath);
        if (action === 'quit') {
          console.log('Stopped by user.');
          return;
        }
        if (action === 'regenerate') continue;
        break;
      }
    }
    console.log('Done.');
  } finally {
    rl?.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
