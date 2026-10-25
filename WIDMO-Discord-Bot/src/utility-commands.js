import { SlashCommandBuilder, MessageFlags, version as discordVersion } from 'discord.js';
import { config } from './config.js';
import { getStats, setMemberXp } from './levels.js';
import { xpForLevel } from './level-helpers.js';
import { embed, safeText, staffTier, isBotOwner, canModerate, replyError } from './shared.js';
import { logEvent } from './logging.js';

const command = (name, description) => new SlashCommandBuilder().setName(name).setDescription(description).setDMPermission(false);
const person = o => o.setName('osoba').setDescription('Użytkownik').setRequired(true);
const reason = o => o.setName('powod').setDescription('Powód zmiany').setRequired(true).setMaxLength(350);
const xp = command('xp', 'Zarządzaj XP użytkownika (Admin, Szef i właściciel bota)');
for (const [name, description] of [['dodaj','Dodaj XP'],['usun','Odejmij XP (minimum 0)'],['ustaw','Ustaw dokładne XP']]) {
  xp.addSubcommand(s => s.setName(name).setDescription(description).addUserOption(person)
    .addIntegerOption(o => o.setName('ilosc').setDescription('Liczba XP, maksymalnie 10 000 000').setRequired(true).setMinValue(0).setMaxValue(10_000_000)).addStringOption(reason));
}
export const utilityCommands = [
  command('ping', 'Opóźnienie połączenia bota z Discordem'),
  command('botinfo', 'Informacje o działaniu i pamięci bota'),
  command('userinfo', 'Informacje o użytkowniku i jego aktywności').addUserOption(o => o.setName('osoba').setDescription('Domyślnie Twoje konto')),
  command('serverinfo', 'Informacje o serwerze'),
  command('rola-info', 'Informacje o wskazanej roli').addRoleOption(o => o.setName('rola').setDescription('Rola do sprawdzenia').setRequired(true)),
  command('uprawnienia', 'Sprawdź swój dostęp do komend bota'),
  xp,
  command('ustaw-poziom', 'Ustaw poziom użytkownika i dopasuj role (administracja)').addUserOption(person)
    .addIntegerOption(o => o.setName('poziom').setDescription('Poziom od 0 do 100').setRequired(true).setMinValue(0).setMaxValue(100)).addStringOption(reason),
];

const date = ms => Number.isFinite(ms) ? `<t:${Math.floor(ms / 1000)}:F>` : 'Brak danych';
const roleNames = member => safeText([...member.roles.cache.values()].filter(r => r.id !== member.guild.id).map(r => r.name ?? r.id).join(', ') || 'Brak', 1000);
async function audit(i, text) {
  try { await logEvent(i.client, config.channels.actions || config.channels.moderation, { title: '✨ Administracyjna korekta XP', description: text, fields: [{name:'Wykonawca · ID',value:i.user.id}] }); }
  catch (e) { console.error('[XP audit]', e); }
}

export async function handleUtilityCommand(i) {
  if (!i.isChatInputCommand() || !utilityCommands.some(c => c.name === i.commandName)) return false;
  try {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (!i.guild || i.guildId !== config.guildId) throw new Error('Tej komendy użyj na skonfigurowanym serwerze.');
    let card;
    if (i.commandName === 'ping') {
      const latency = i.client.ws?.ping;
      card = embed('🏓 Pong!', `Gateway: **${latency >= 0 ? `${Math.round(latency)} ms` : 'oczekiwanie na pomiar'}**`);
    } else if (i.commandName === 'botinfo') {
      const seconds = Math.floor(process.uptime());
      card = embed('👻 Informacje o bocie', `Czas działania: **${Math.floor(seconds / 3600)} h ${Math.floor(seconds % 3600 / 60)} min**\nPamięć procesu: **${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB**\nNode.js: **${process.version}**\nDiscord.js: **${discordVersion}**\nDane: **SQLite — XP, ostrzeżenia, giveaway i voice**`);
    } else if (i.commandName === 'userinfo') {
      const user = i.options.getUser('osoba') ?? i.user;
      const member = await i.guild.members.fetch({ user: user.id, force: true });
      const stats = getStats(i.guildId, user.id);
      card = embed(`👤 ${safeText(member.displayName ?? user.username, 200)}`)
        .addFields({name:'ID',value:user.id},{name:'Konto utworzone',value:date(user.createdTimestamp),inline:true},
          {name:'Na serwerze od',value:date(member.joinedTimestamp),inline:true},{name:'Poziom i XP',value:`LV ${stats.level} • ${stats.xp.toLocaleString('pl-PL')} XP`,inline:true},
          {name:'Wiadomości zakwalifikowane',value:String(stats.messages),inline:true},{name:'Role',value:roleNames(member)});
      const avatar = member.displayAvatarURL?.({ extension:'png',size:256 }); if (avatar) card.setThumbnail(avatar);
    } else if (i.commandName === 'serverinfo') {
      const guild = i.guild;
      card = embed(`🏰 ${safeText(guild.name, 220)}`).addFields(
        {name:'ID serwera',value:guild.id},{name:'Właściciel serwera',value:`<@${guild.ownerId}>`,inline:true},
        {name:'Utworzony',value:date(guild.createdTimestamp),inline:true},{name:'Członkowie',value:String(guild.memberCount),inline:true},
        {name:'Kanały',value:String(guild.channels.cache.size),inline:true},{name:'Role',value:String(guild.roles.cache.size),inline:true},
        {name:'Boosty',value:String(guild.premiumSubscriptionCount ?? 0),inline:true});
      const icon = guild.iconURL?.({size:256}); if (icon) card.setThumbnail(icon);
    } else if (i.commandName === 'rola-info') {
      const role = i.options.getRole('rola', true);
      card = embed(`🏷️ ${safeText(role.name, 220)}`).addFields({name:'ID roli',value:role.id},
        {name:'Kolor',value:role.hexColor ?? '#000000',inline:true},{name:'Pozycja',value:String(role.position),inline:true},
        {name:'Zarządzana przez integrację',value:role.managed ? 'Tak' : 'Nie',inline:true},
        {name:'Utworzona',value:date(role.createdTimestamp)},{name:'Uprawnienia Discord',value:safeText(role.permissions?.toArray().join(', ') || 'Brak dodatkowych uprawnień',1000)});
    } else if (i.commandName === 'uprawnienia') {
      const actor = await i.guild.members.fetch({user:i.user.id,force:true});
      const tier = staffTier(actor);
      const names = ['Użytkownik','Helper','Admin','Szef / właściciel serwera','Właściciel bota — dostęp po ID'];
      card = embed('🔑 Twoje uprawnienia', `Twoje ID: **${actor.id}**\nDostęp: **${names[tier]}**\n${isBotOwner(actor) ? 'Masz dostęp do wszystkich komend bota bez wymaganych ról.' : 'Dostęp jest ustalany na podstawie Twoich ról i właściciela serwera.'}`)
        .addFields({name:'Komendy publiczne',value:'✅ Tak',inline:true},{name:'Timeout, clear, warn',value:tier>=1?'✅ Tak':'❌ Nie',inline:true},
          {name:'Ban, kick, publikacja i XP',value:tier>=2?'✅ Tak':'❌ Nie',inline:true},
          {name:'Uprawnienia samego bota',value:'Nadal musi mieć wymagane uprawnienia Discord i odpowiednio wysoką rolę. Sprawdź /konfiguracja.'});
    } else {
      const actor = await i.guild.members.fetch({user:i.user.id,force:true});
      if (staffTier(actor) < 2) throw new Error('Zarządzanie XP wymaga Admina, Szefa lub właściciela bota.');
      const user = i.options.getUser('osoba', true);
      const member = await i.guild.members.fetch({user:user.id,force:true});
      if (member.user.bot) throw new Error('Nie można zmieniać XP botom.');
      if (!isBotOwner(actor) && actor.id !== member.id && !canModerate(actor, member, 2)) throw new Error('Nie możesz zmieniać XP osobie o równych lub wyższych uprawnieniach.');
      const reason = i.options.getString('powod', true).trim();
      if (!reason) throw new Error('Podaj powód zmiany.');
      // Read and commit without an intervening await, so simultaneous corrections do not lose XP.
      const before = getStats(i.guildId, member.id);
      let total;
      if (i.commandName === 'ustaw-poziom') {
        const level = i.options.getInteger('poziom', true);
        if (!Number.isInteger(level) || level < 0 || level > 100) throw new Error('Poziom musi mieścić się w zakresie 0–100.');
        total = xpForLevel(level);
      } else {
        const amount = i.options.getInteger('ilosc', true), sub = i.options.getSubcommand();
        if (!Number.isInteger(amount) || amount < 0 || amount > 10_000_000) throw new Error('Podaj liczbę XP od 0 do 10 000 000.');
        if (!['dodaj','usun','ustaw'].includes(sub)) throw new Error('Nieznana operacja XP.');
        total = sub === 'dodaj' ? before.xp + amount : sub === 'usun' ? Math.max(0, before.xp - amount) : amount;
      }
      const after = await setMemberXp(member, total);
      const text = `<@${member.id}> • ${member.id}\nXP: **${before.xp} → ${after.xp}**\nPoziom: **${before.level} → ${after.level}**\nPowód: ${reason}\nRole poziomów zostaną dopasowane; ewentualne błędy są ponawiane. Licznik wiadomości bez zmian.`;
      card = embed('✨ Zmieniono XP', text);
      await i.editReply({embeds:[card],allowedMentions:{parse:[]}});
      await audit(i,text); return true;
    }
    await i.editReply({embeds:[card],allowedMentions:{parse:[]}});
  } catch (e) {
    console.error('[utility]', i.commandName, e);
    await replyError(i, e.code === 10007 ? 'Ta osoba nie jest na tym serwerze.' : safeText(e.message, 1500));
  }
  return true;
}
