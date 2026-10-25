
export const TICKET_TYPES = Object.freeze({
  clan: Object.freeze({
    label: 'Clan PS99',
    prefix: 'clan-ps99',
    title: 'Zgłoszenie: Clan PS99',
    description: 'To zgłoszenie dotyczy spraw klanowych PS99. Podaj swój nick w grze, opisz sprawę i dodaj szczegóły potrzebne do weryfikacji.',
  }),
  general: Object.freeze({
    label: 'Pomoc ogólna',
    prefix: 'pomoc',
    title: 'Zgłoszenie: Pomoc ogólna',
    description: 'Opisz pytanie lub problem, podaj potrzebny kontekst i dołącz zrzuty ekranu, jeśli ułatwią rozwiązanie.',
  }),
  reward: Object.freeze({
    label: 'Odbiór nagrody',
    prefix: 'odbior-nagrody',
    title: 'Zgłoszenie: Odbiór nagrody',
    description: 'Podaj nazwę nagrody, nazwę wydarzenia lub giveaway oraz dowód wygranej. Nie wysyłaj haseł, kodów logowania ani danych konta.',
  }),
});

export function normalizeTicketType(type) {
  return Object.hasOwn(TICKET_TYPES, type) ? type : 'general';
}

export function slugify(value) {
  return String(value ?? '')
    .replace(/[łŁ]/g, 'l')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'uzytkownik';
}

export function canOpenAnotherTicket(openCount, maxOpen = 1) {
  return Number.isInteger(openCount) && openCount >= 0
    && Number.isInteger(maxOpen) && maxOpen >= 1 && openCount < maxOpen;
}

export function suggestionVoteValue(direction) {
  if (direction === 'up') return 1;
  if (direction === 'down') return -1;
  return null;
}
