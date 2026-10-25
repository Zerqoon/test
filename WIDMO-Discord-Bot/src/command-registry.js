import { commands } from './commands.js';
import { giveawayCommands } from './giveaways.js';
import { levelCommands } from './levels.js';
import { diagnosticCommands } from './diagnostics.js';
import { extraModerationCommands } from './moderation-extra.js';
import { utilityCommands } from './utility-commands.js';
import { widmoSetupCommands } from './widmo-setup.js';
import { communityCommands } from './community.js';
export const allCommands = [...commands, ...giveawayCommands, ...levelCommands, ...diagnosticCommands, ...extraModerationCommands, ...utilityCommands, ...widmoSetupCommands, ...communityCommands];
