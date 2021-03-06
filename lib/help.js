const MAX_LINE_WIDTH = process.stdout.columns || 200;
const MIN_OFFSET = 25;
const reAstral = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
const ansiRegex = /\x1B\[([0-9]{1,3}(;[0-9]{1,3})*)?[m|K]/g;
let chalk;

function initChalk() {
    if (!chalk) {
        const ChalkInstance = require('chalk').Instance;

        chalk = new ChalkInstance({
            level: Number(process.stdout.isTTY)
        });
    }

    return chalk;
}

function stringLength(str) {
    return str
        .replace(ansiRegex, '')
        .replace(reAstral, ' ')
        .length;
}

function pad(width, str) {
    // str.padEnd(width + str.length - stringLength(str))
    return str + ' '.repeat(width - stringLength(str));
}

function breakByLines(str, offset) {
    const words = str.split(' ');
    const maxWidth = MAX_LINE_WIDTH - offset || 0;
    const lines = [];
    let line = '';

    while (words.length) {
        const word = words.shift();

        if (!line || (line.length + word.length + 1) < maxWidth) {
            line += (line ? ' ' : '') + word;
        } else {
            lines.push(line);
            words.unshift(word);
            line = '';
        }
    }

    lines.push(line);

    return lines
        .map((line, idx) => (idx && offset ? pad(offset, '') : '') + line)
        .join('\n');
}

function args(command) {
    return command.params.args
        .map(({ name, required }) => required ? '<' + name + '>' : '[' + name + ']')
        .join(' ');
}

function valuesSortedByKey(dict) {
    return Object.keys(dict)
        .sort()
        .map(key => dict[key]);
}

function commandsHelp(command) {
    if (!command.hasCommands()) {
        return '';
    }

    const lines = valuesSortedByKey(command.commands).map(subcommand => ({
        name: chalk.green(subcommand.name) + chalk.gray(
            (subcommand.params.maxCount ? ' ' + args(subcommand) : '')
        ),
        description: subcommand.meta.description || ''
    }));
    const maxNameLength = lines.reduce(
        (max, line) => Math.max(max, stringLength(line.name)),
        MIN_OFFSET - 2
    );

    return [
        '',
        'Commands:',
        '',
        ...lines.map(line => (
            '    ' + pad(maxNameLength, line.name) +
            '    ' + breakByLines(line.description, maxNameLength + 8)
        )),
        ''
    ].join('\n');
}

function optionsHelp(command) {
    if (!command.hasOptions()) {
        return '';
    }

    const hasShortOptions = Object.keys(command.short).length > 0;
    const lines = valuesSortedByKey(command.long).map(option => ({
        name: option.usage
            .replace(/^(?:-., |)/, (m) =>
                m || (hasShortOptions ? '    ' : '')
            )
            .replace(/(^|\s)(-[^\s,]+)/ig, (m, p, flag) =>
                p + chalk.yellow(flag)
            ),
        description: option.description
    }));
    const maxNameLength = lines.reduce(
        (max, line) => Math.max(max, stringLength(line.name)),
        MIN_OFFSET - 2
    );

    // Prepend the help information
    return [
        '',
        'Options:',
        '',
        ...lines.map(line => (
            '    ' + pad(maxNameLength, line.name) +
            '    ' + breakByLines(line.description, maxNameLength + 8)
        )),
        ''
    ].join('\n');
}

/**
 * Return program help documentation.
 *
 * @return {String}
 * @api private
 */
module.exports = function getCommandHelp(command, commandPath) {
    initChalk();

    commandPath = Array.isArray(commandPath) && commandPath.length
        ? commandPath.concat(command.name).join(' ')
        : command.name;

    return [
        (command.meta.description ? command.meta.description + '\n\n' : '') +
        'Usage:\n\n' +
            '    ' + chalk.cyan(commandPath) +
            (command.params.maxCount ? ' ' + chalk.magenta(args(command)) : '') +
            (command.hasOptions() ? ' [' + chalk.yellow('options') + ']' : '') +
            (command.hasCommands() ? ' [' + chalk.green('command') + ']' : ''),
        commandsHelp(command) +
        optionsHelp(command)
    ].join('\n');
};
