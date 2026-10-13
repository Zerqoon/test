import { commands } from './commands.js';
import { giveawayCommands } from './giveaways.js';
import { levelCommands } from './levels.js';
import { diagnosticCommands } from './diagnostics.js';
export const allCommands = [...commands, ...giveawayCommands, ...levelCommands, ...diagnosticCommands];
