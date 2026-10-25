import { readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
process.env.DATABASE_PATH = ':memory:';
const { ROOT, validateConfig } = await import('../src/config.js');
validateConfig({ credentials: false });
for (const folder of ['src','scripts','test']) {
  for (const file of readdirSync(path.join(ROOT, folder)).filter(f => f.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--check', path.join(ROOT, folder, file)], { encoding: 'utf8' });
    if (result.status !== 0) { console.error(result.stderr); process.exit(1); }
  }
}
for (const name of ['background.png','FONT-LICENSE.txt','widmo-logo.png','widmo-mark.png','widmo-logo-source.png']) if (!existsSync(path.join(ROOT,'assets',name))) throw new Error(`Brak assets/${name}`);
const { allCommands } = await import('../src/command-registry.js');
const json = allCommands.map(c => c.toJSON());
if (new Set(json.map(c => c.name)).size !== json.length) throw new Error('Powtórzone nazwy komend');
const { verifyCanvasRendering } = await import('../src/cards.js');
const canvasCheck = await verifyCanvasRendering();
console.log(`OK: konfiguracja, składnia, zasoby i ${json.length} definicji komend.`);
console.log(`OK: Canvas renderuje tekst ${canvasCheck.textWidth.toFixed(1)} px; ${canvasCheck.brightPixels} jasnych pikseli, PNG ${canvasCheck.pngBytes} B; font ${canvasCheck.fontFamilyBold}.`);
const { db } = await import('../src/db.js'); db.close();
