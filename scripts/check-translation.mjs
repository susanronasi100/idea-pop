#!/usr/bin/env node
// Checks that a translated content JSON has exactly the same shape as its
// English source: same keys, same array lengths, and untouched values for
// every key the app matches on (step names, groups, emoji, images, answers).
// Only human-readable strings may differ.
//
// Usage: node scripts/check-translation.mjs <english.json> <translated.json>

import { readFileSync } from 'node:fs';

const FROZEN_KEYS = new Set([
  'step', 'kind', 'key', 'group', 'image', 'image_url', 'scene_image', 'emoji',
  'habitat', 'age_tier', 'age_mode', 'answer', 'higher_is_better',
  'fork_to_step', 'skill_refs', 'locked',
]);

// Keys whose value is language-specific and may differ in length (e.g. answer keywords).
const FREE_KEYS = new Set(['keywords']);

const [, , enPath, faPath] = process.argv;
if (!enPath || !faPath) {
  console.error('usage: check-translation.mjs <english.json> <translated.json>');
  process.exit(2);
}

const errors = [];
const untranslated = [];

function walk(en, fa, path, frozen) {
  const where = path || '(root)';
  if (Array.isArray(en)) {
    if (!Array.isArray(fa)) return errors.push(`${where}: expected an array`);
    if (en.length !== fa.length) {
      return errors.push(`${where}: array length ${fa.length}, expected ${en.length}`);
    }
    en.forEach((v, i) => walk(v, fa[i], `${path}[${i}]`, frozen));
    return;
  }
  if (en !== null && typeof en === 'object') {
    if (fa === null || typeof fa !== 'object' || Array.isArray(fa)) {
      return errors.push(`${where}: expected an object`);
    }
    const ek = Object.keys(en).sort().join(',');
    const fk = Object.keys(fa).sort().join(',');
    if (ek !== fk) return errors.push(`${where}: keys [${fk}], expected [${ek}]`);
    for (const k of Object.keys(en)) {
      if (FREE_KEYS.has(k)) continue;
      walk(en[k], fa[k], path ? `${path}.${k}` : k, frozen || FROZEN_KEYS.has(k));
    }
    return;
  }
  if (typeof en === 'string' && !frozen) {
    if (typeof fa !== 'string') return errors.push(`${where}: expected a string`);
    // Latin-only text that still matches the English was probably missed.
    if (fa === en && /[a-z]{3,}/i.test(en) && !/[؀-ۿ]/.test(fa)) {
      untranslated.push(where);
    }
    return;
  }
  if (JSON.stringify(en) !== JSON.stringify(fa)) {
    errors.push(`${where}: must stay ${JSON.stringify(en)}, got ${JSON.stringify(fa)}`);
  }
}

const en = JSON.parse(readFileSync(enPath, 'utf8'));
let fa;
try {
  fa = JSON.parse(readFileSync(faPath, 'utf8'));
} catch (e) {
  console.error(`${faPath}: invalid JSON: ${e.message}`);
  process.exit(1);
}
walk(en, fa, '', false);

for (const u of untranslated) console.warn(`warning: ${u} looks untranslated`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}
console.log(`ok: ${faPath}`);
