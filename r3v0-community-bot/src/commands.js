import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { config } from './config.js';
import { items } from './shop.js';
import { handlePublic } from './commands-public.js';
import { handleAdmin } from './commands-admin.js';

const choices=Object.entries(items).map(([value,item])=>({name:item.name,value}));
const user=o=>o.setName('osoba').setDescription('Osoba na serwerze').setRequired(true);
const reason=o=>o.setName('powod').setDescription('Powód działania').setMaxLength(400).setRequired(true);
const amount=o=>o.setName('ilosc').setDescription('Liczba').setMinValue(1).setMaxValue(1_000_000_000).setRequired(true);

export const commands=[
  new SlashCommandBuilder().setName('pomoc').setDescription('Lista komend i możliwości bota'),
  new SlashCommandBuilder().setName('ping').setDescription('Sprawdź opóźnienie bota'),
  new SlashCommandBuilder().setName('profil').setDescription('Graficzny profil gracza').addUserOption(o=>o.setName('osoba').setDescription('Osoba (domyślnie Ty)')),
  new SlashCommandBuilder().setName('ranga').setDescription('Graficzna karta poziomu i postępu').addUserOption(o=>o.setName('osoba').setDescription('Osoba (domyślnie Ty)')),
  new SlashCommandBuilder().setName('top').setDescription('Graficzna tabela najlepszych')
    .addStringOption(o=>o.setName('typ').setDescription('Ranking').addChoices({name:'Poziomy',value:'xp'},{name:'Monety',value:'balance'})),
  new SlashCommandBuilder().setName('portfel').setDescription('Graficzna karta ekonomii').addUserOption(o=>o.setName('osoba').setDescription('Osoba (domyślnie Ty)')),
  new SlashCommandBuilder().setName('daily').setDescription('Odbierz codzienne monety (co 24 godziny)'),
  new SlashCommandBuilder().setName('praca').setDescription('Zarabiaj monety (co 45 minut)'),
  new SlashCommandBuilder().setName('przelew').setDescription('Przelej monety innej osobie').addUserOption(user).addIntegerOption(amount),
  new SlashCommandBuilder().setName('sklep').setDescription('Zobacz przedmioty i tytuły'),
  new SlashCommandBuilder().setName('kup').setDescription('Kup przedmiot w sklepie').addStringOption(o=>o.setName('przedmiot').setDescription('Wybierz przedmiot').setRequired(true).addChoices(...choices)),
  new SlashCommandBuilder().setName('plecak').setDescription('Zobacz swój ekwipunek'),
  new SlashCommandBuilder().setName('uzyj').setDescription('Aktywuj przedmiot lub ustaw tytuł').addStringOption(o=>o.setName('przedmiot').setDescription('Przedmiot z plecaka').setRequired(true).addChoices(...choices)),
  new SlashCommandBuilder().setName('moneta').setDescription('Rzut monetą (opcjonalnie za stawkę)')
    .addStringOption(o=>o.setName('strona').setDescription('Twój wybór').setRequired(true).addChoices({name:'Orzeł',value:'orzel'},{name:'Reszka',value:'reszka'}))
    .addIntegerOption(o=>o.setName('stawka').setDescription('Stawka 1–100000').setMinValue(1).setMaxValue(100000)),
  new SlashCommandBuilder().setName('sloty').setDescription('Automat: 3 symbole i wygrane')
    .addIntegerOption(o=>o.setName('stawka').setDescription('Stawka 1–100000').setRequired(true).setMinValue(1).setMaxValue(100000)),
  new SlashCommandBuilder().setName('kostka').setDescription('Rzuć kością od 2 do 100 ścian')
    .addIntegerOption(o=>o.setName('sciany').setDescription('Liczba ścian (domyślnie 6)').setMinValue(2).setMaxValue(100)),
  new SlashCommandBuilder().setName('wrozba').setDescription('Zapytaj magiczną ósemkę').addStringOption(o=>o.setName('pytanie').setDescription('Twoje pytanie').setRequired(true).setMaxLength(160)),
  new SlashCommandBuilder().setName('kpn').setDescription('Kamień, papier, nożyce').addStringOption(o=>o.setName('wybor').setDescription('Twój ruch').setRequired(true)
    .addChoices({name:'Kamień',value:'kamien'},{name:'Papier',value:'papier'},{name:'Nożyce',value:'nozyce'})),
  new SlashCommandBuilder().setName('ankieta').setDescription('Szybka ankieta od 2 do 4 odpowiedzi')
    .addStringOption(o=>o.setName('pytanie').setDescription('Temat ankiety').setMaxLength(150).setRequired(true))
    .addStringOption(o=>o.setName('opcja1').setDescription('Opcja 1').setMaxLength(80).setRequired(true))
    .addStringOption(o=>o.setName('opcja2').setDescription('Opcja 2').setMaxLength(80).setRequired(true))
    .addStringOption(o=>o.setName('opcja3').setDescription('Opcja 3').setMaxLength(80))
    .addStringOption(o=>o.setName('opcja4').setDescription('Opcja 4').setMaxLength(80)),
  new SlashCommandBuilder().setName('pokoj').setDescription('Otwórz panel swojego pokoju głosowego'),
  new SlashCommandBuilder().setName('userinfo').setDescription('Informacje o użytkowniku').addUserOption(o=>o.setName('osoba').setDescription('Osoba (domyślnie Ty)')),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Informacje o serwerze'),
  new SlashCommandBuilder().setName('diagnostyka').setDescription('Szef: sprawdź ID, role i uprawnienia bota'),
  new SlashCommandBuilder().setName('ostrzezenia').setDescription('Sprawdź ostrzeżenia (swoje lub jako moderator cudze)')
    .addUserOption(o=>o.setName('osoba').setDescription('Użytkownik')),
  new SlashCommandBuilder().setName('warn').setDescription('Helper: nadaj ostrzeżenie').addUserOption(user).addStringOption(reason),
  new SlashCommandBuilder().setName('unwarn').setDescription('Helper: usuń ostrzeżenie po numerze')
    .addIntegerOption(o=>o.setName('numer').setDescription('ID ostrzeżenia').setMinValue(1).setRequired(true)),
  new SlashCommandBuilder().setName('wyczysc').setDescription('Helper: usuń 1–100 nowych wiadomości')
    .addIntegerOption(o=>o.setName('ilosc').setDescription('Liczba wiadomości').setMinValue(1).setMaxValue(100).setRequired(true)),
  new SlashCommandBuilder().setName('timeout').setDescription('Moderator: nałóż przerwę do 28 dni').addUserOption(user)
    .addIntegerOption(o=>o.setName('minuty').setDescription('Czas przerwy w minutach (1–40320)').setMinValue(1).setMaxValue(40320).setRequired(true)).addStringOption(reason),
  new SlashCommandBuilder().setName('untimeout').setDescription('Moderator: zakończ przerwę').addUserOption(user).addStringOption(reason),
  new SlashCommandBuilder().setName('mute').setDescription('Moderator: wycisz osobę przez przerwę Discord').addUserOption(user)
    .addIntegerOption(o=>o.setName('minuty').setDescription('Czas wyciszenia (1–40320 minut)').setMinValue(1).setMaxValue(40320).setRequired(true)).addStringOption(reason),
  new SlashCommandBuilder().setName('unmute').setDescription('Moderator: zdejmij wyciszenie/przerwę').addUserOption(user).addStringOption(reason),
  new SlashCommandBuilder().setName('kick').setDescription('Moderator: wyrzuć użytkownika').addUserOption(user).addStringOption(reason),
  new SlashCommandBuilder().setName('ban').setDescription('Moderator: zbanuj użytkownika').addUserOption(user).addStringOption(reason),
  new SlashCommandBuilder().setName('unban').setDescription('Moderator: zdejmij bana')
    .addStringOption(o=>o.setName('id').setDescription('ID użytkownika').setRequired(true)).addStringOption(reason),
  new SlashCommandBuilder().setName('slowmode').setDescription('Moderator: ustaw odstęp między wiadomościami')
    .addIntegerOption(o=>o.setName('sekundy').setDescription('0–21600 sekund').setMinValue(0).setMaxValue(21600).setRequired(true)),
  new SlashCommandBuilder().setName('zamknij').setDescription('Moderator: zablokuj pisanie na kanale'),
  new SlashCommandBuilder().setName('otworz').setDescription('Moderator: odblokuj pisanie na kanale'),
  new SlashCommandBuilder().setName('rola').setDescription('Szef: nadaj lub zdejmij rolę')
    .addSubcommand(s=>s.setName('nadaj').setDescription('Nadaj rolę').addUserOption(user).addRoleOption(o=>o.setName('rola').setDescription('Rola').setRequired(true)))
    .addSubcommand(s=>s.setName('zdejmij').setDescription('Zdejmij rolę').addUserOption(user).addRoleOption(o=>o.setName('rola').setDescription('Rola').setRequired(true))),
  new SlashCommandBuilder().setName('xp').setDescription('Szef: ręczne korekty doświadczenia')
    .addSubcommand(s=>s.setName('dodaj').setDescription('Dodaj XP').addUserOption(user).addIntegerOption(amount))
    .addSubcommand(s=>s.setName('odejmij').setDescription('Odejmij XP').addUserOption(user).addIntegerOption(amount))
    .addSubcommand(s=>s.setName('ustaw').setDescription('Ustaw XP').addUserOption(user).addIntegerOption(amount)),
  new SlashCommandBuilder().setName('monety_admin').setDescription('Szef: ręczne korekty ekonomii')
    .addSubcommand(s=>s.setName('dodaj').setDescription('Dodaj monety').addUserOption(user).addIntegerOption(amount))
    .addSubcommand(s=>s.setName('odejmij').setDescription('Odejmij monety').addUserOption(user).addIntegerOption(amount))
    .addSubcommand(s=>s.setName('ustaw').setDescription('Ustaw monety').addUserOption(user).addIntegerOption(amount)),
];

export const commandPayload=commands.map(command=>command.toJSON());
export async function handleCommand(i,store){
  if(!i.inGuild()||i.guildId!==config.guildId){
    return i.reply({content:'Ten bot jest skonfigurowany dla jednego serwera.',flags:MessageFlags.Ephemeral});
  }
  if(await handlePublic(i,store))return;
  if(await handleAdmin(i,store))return;
  await i.reply({content:'Nieznana komenda.',ephemeral:true});
}
