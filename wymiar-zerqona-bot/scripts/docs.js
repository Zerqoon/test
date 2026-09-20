import fs from 'node:fs';
import { commandMeta, categories } from '../src/command-meta.js';
import { BRAND } from '../src/ui.js';
import { tierName } from '../src/permissions.js';
const lines=['# Komendy — Wymiar ZERQONA','',`Wersja ${BRAND.version} • ${Object.keys(commandMeta).length} komend.`,
  '', 'W nawiasach kwadratowych podano opcjonalne parametry. Przy komendach z `osoba` brak parametru oznacza Ciebie. `prywatnie:true` ukrywa wynik przed pozostałymi osobami.',
  '', 'Pomoc na Discordzie: `/pomoc`, następnie wybór kategorii; dokładne zasady: `/pomoc komenda:daily`.',
  '', 'Właściciel serwera ma dostęp Szefa. Pozostałe uprawnienia wynikają z ID ról w `src/config.js`, a nie z samej nazwy roli. Przy moderacji obowiązuje dodatkowo hierarchia Discord.'];
for(const [category,title] of Object.entries(categories)){
  lines.push('',`## ${title}`);
  for(const [name,item] of Object.entries(commandMeta).filter(([,m])=>m.category===category))
    lines.push('',`### /${name}`,'',item.summary,'',`Użycie: \`${item.usage}\``, '',item.details,'',`Dostęp: **${tierName(item.tier)}**${item.tier?' lub wyższy.':'.'}`);
}
fs.writeFileSync('KOMENDY.md',lines.join('\n')+'\n');
console.log(`Zapisano opisy ${Object.keys(commandMeta).length} komend w KOMENDY.md`);
