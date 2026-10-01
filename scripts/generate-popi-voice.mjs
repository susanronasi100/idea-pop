#!/usr/bin/env node
// Turns every line Popi says in the missions (and each story-picture page) into an
// ElevenLabs audio file, once, so the 🔊 button can play a real voice-actor read.
//
// Needs, in the repo's .env (never committed):
//   ELEVENLABS_API_KEY=...        your ElevenLabs API key
//   ELEVENLABS_VOICE_ID=...       the voice for English (from the Voice Library)
//   ELEVENLABS_VOICE_ID_FA=...    optional: a voice for Persian (defaults to the English one)
//   ELEVENLABS_MODEL=...          optional: default eleven_multilingual_v2
//   ELEVENLABS_MODEL_FA=...       optional: default eleven_v3 (has Persian)
//
// Usage (from the repo root):
//   node scripts/generate-popi-voice.mjs --dry                 count the lines and characters, make nothing
//   node scripts/generate-popi-voice.mjs --only=help-max-cross-the-river
//   node scripts/generate-popi-voice.mjs --lang=en              only English
//   node scripts/generate-popi-voice.mjs                        everything still missing
//
// Files land in frontend/public/audio/popi/<lang>/<hash>.mp3 with a manifest that maps
// each exact line to its file. Lines that already have a file are skipped, so re-running
// only pays for new or changed lines.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'frontend', 'public', 'audio', 'popi');
const MANIFEST = join(OUT, 'manifest.json');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

function loadEnv() {
  const file = join(ROOT, '.env');
  if (!existsSync(file)) return {};
  const env = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return { ...env, ...process.env };
}

// Keep in step with joinSegments in frontend/src/lib/narration.ts: the picture-book
// button speaks exactly this text, and the manifest is keyed on it.
function joinSegments(segments) {
  return segments
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .map((s) => (/[.!?…؟:]["»”']?$/.test(s) ? s : `${s}.`))
    .join(' ');
}

/** Every line the mission screens hand to Popi or to the picture-book 🔊, for one story file. */
function linesOf(story) {
  const lines = [];
  for (const page of story.opening ?? []) {
    if (page.image) lines.push(joinSegments([page.beat, page.text, page.thought?.big, page.thought?.small]));
  }
  const g = story.guide ?? {};
  for (const k of ['brief', 'your_idea', 'nature_clues', 'design_secret', 'skill', 'sketch', 'build_and_test', 'retry_tip', 'ending']) {
    if (g[k]) lines.push(g[k]);
  }
  if (story.tool?.intro) lines.push(story.tool.intro);
  if (story.define_problem?.popi) lines.push(story.define_problem.popi);
  return lines;
}

function storyFiles(lang) {
  const dir = join(ROOT, 'backend', 'content', ...(lang === 'fa' ? ['fa', 'stories'] : ['stories']));
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ slug: f.replace(/\.json$/, ''), story: JSON.parse(readFileSync(join(dir, f), 'utf8')) }));
}

async function speak(env, lang, text) {
  const voice = lang === 'fa' ? env.ELEVENLABS_VOICE_ID_FA || env.ELEVENLABS_VOICE_ID : env.ELEVENLABS_VOICE_ID;
  const model = lang === 'fa' ? env.ELEVENLABS_MODEL_FA || 'eleven_v3' : env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: model,
      // A lively, expressive read: lower stability lets the voice act; style adds character.
      voice_settings: { stability: 0.35, similarity_boost: 0.8, style: 0.55, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const env = loadEnv();
  const langs = args.lang ? [args.lang] : ['en', 'fa'];
  const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};

  const todo = [];
  for (const lang of langs) {
    manifest[lang] ??= {};
    for (const { slug, story } of storyFiles(lang)) {
      if (args.only && args.only !== slug) continue;
      for (const text of linesOf(story)) {
        if (manifest[lang][text] && existsSync(join(OUT, manifest[lang][text]))) continue;
        if (!todo.some((t) => t.lang === lang && t.text === text)) todo.push({ lang, slug, text });
      }
    }
  }

  const chars = todo.reduce((n, t) => n + t.text.length, 0);
  console.log(`${todo.length} line(s) to make, ${chars} characters (ElevenLabs bills by character).`);
  if (args.dry || todo.length === 0) return;

  if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_VOICE_ID) {
    console.error('Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to .env first.');
    process.exit(1);
  }

  for (const [i, t] of todo.entries()) {
    const file = `${t.lang}/${createHash('sha1').update(`${t.lang}\n${t.text}`).digest('hex').slice(0, 16)}.mp3`;
    mkdirSync(join(OUT, t.lang), { recursive: true });
    process.stdout.write(`[${i + 1}/${todo.length}] ${t.lang} ${t.slug}: ${t.text.slice(0, 60)}… `);
    try {
      writeFileSync(join(OUT, file), await speak(env, t.lang, t.text));
      manifest[t.lang][t.text] = file;
      writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
      console.log('ok');
    } catch (e) {
      console.log('failed');
      console.error(e.message);
      process.exit(1);
    }
  }
  console.log('Done. Rebuild the frontend so the new files are served.');
}

main();
