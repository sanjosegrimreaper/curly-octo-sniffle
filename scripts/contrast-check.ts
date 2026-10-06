/**
 * WCAG contrast check for every theme in src/design/tokens.ts.
 *
 *   npx tsx scripts/contrast-check.ts
 *
 * Light and dark:
 *  - text, textMuted, accentInk on bg, surface, surfaceSunken     >= 4.5 (body text)
 *  - onAccent on accent                                            >= 4.5
 *  - each signal's ink on surface and on its own tint              >= 4.5
 *  - each signal's solid on surface                                >= 3   (non-text UI, WCAG 1.4.11)
 *  - focus on bg and surface                                       >= 3
 * High contrast (light and dark): the same pairs, with every text/ink pair >= 7
 * (also ink on bg). Translucent values (rgba, 'transparent') are skipped; border is not checked.
 * Exit 1 on any failure.
 */
import {
  darkPalette,
  highContrastDarkPalette,
  highContrastLightPalette,
  lightPalette,
  type Palette,
  type SignalName,
} from '../src/design/tokens';

import { color, run, table } from './lib/cli';
import { contrastRatio } from './lib/contrast';

type Pair = { fg: string; bg: string; fgColor: string; bgColor: string; min: number };

const THEMES: readonly { name: string; palette: Palette; highContrast: boolean }[] = [
  { name: 'light', palette: lightPalette, highContrast: false },
  { name: 'dark', palette: darkPalette, highContrast: false },
  { name: 'hc-light', palette: highContrastLightPalette, highContrast: true },
  { name: 'hc-dark', palette: highContrastDarkPalette, highContrast: true },
];

const TEXT_TOKENS = ['text', 'textMuted', 'accentInk'] as const;
const SURFACES = ['bg', 'surface', 'surfaceSunken'] as const;

function pairsFor(p: Palette, highContrast: boolean): Pair[] {
  const textMin = highContrast ? 7 : 4.5;
  const pairs: Pair[] = [];
  const add = (fg: string, fgColor: string, bg: string, bgColor: string, min: number) =>
    pairs.push({ fg, bg, fgColor, bgColor, min });

  for (const t of TEXT_TOKENS) for (const s of SURFACES) add(t, p[t], s, p[s], textMin);
  add('onAccent', p.onAccent, 'accent', p.accent, textMin);

  for (const name of Object.keys(p.signals) as SignalName[]) {
    const sig = p.signals[name];
    add(`${name}.ink`, sig.ink, 'surface', p.surface, textMin);
    add(`${name}.ink`, sig.ink, `${name}.tint`, sig.tint, textMin);
    if (highContrast) add(`${name}.ink`, sig.ink, 'bg', p.bg, textMin);
    add(`${name}.solid`, sig.solid, 'surface', p.surface, 3);
  }

  add('focus', p.focus, 'bg', p.bg, 3);
  add('focus', p.focus, 'surface', p.surface, 3);
  return pairs;
}

function main(): number {
  const rows: string[][] = [];
  let failures = 0;
  let checked = 0;
  const skipped: string[] = [];

  for (const theme of THEMES) {
    for (const pair of pairsFor(theme.palette, theme.highContrast)) {
      const ratio = contrastRatio(pair.fgColor, pair.bgColor);
      if (ratio === null) {
        skipped.push(`${theme.name}: ${pair.fg} (${pair.fgColor}) on ${pair.bg} (${pair.bgColor})`);
        continue;
      }
      checked++;
      const ok = ratio >= pair.min;
      if (!ok) failures++;
      rows.push([
        theme.name,
        pair.fg,
        pair.bg,
        `${pair.fgColor} / ${pair.bgColor}`,
        ok ? ratio.toFixed(2) : color.red(ratio.toFixed(2)),
        pair.min.toFixed(1),
        ok ? color.green('pass') : color.red('FAIL'),
      ]);
    }
  }

  console.log(color.bold('WCAG contrast — src/design/tokens.ts'));
  console.log('');
  console.log(table(['Theme', 'Foreground', 'Background', 'Colors', 'Ratio', 'Min', 'Result'], rows));
  if (skipped.length) {
    console.log('');
    console.log(color.dim(`Skipped (translucent or not a hex color): ${skipped.join('; ')}`));
  }
  console.log('');
  if (failures) {
    console.log(
      color.red(color.bold(`✖ ${failures} of ${checked} pairs below the minimum.`)) +
        ' Adjust the tokens in src/design/tokens.ts.',
    );
    return 1;
  }
  console.log(color.green(color.bold(`✔ All ${checked} pairs meet their minimum.`)));
  return 0;
}

run(main);
