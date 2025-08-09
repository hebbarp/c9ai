const chalk = require('chalk');

class Logger {
    static info(message) {
        console.log(chalk.cyan(message));
    }

    static success(message) {
        console.log(chalk.green('✓ ' + message));
    }

    static error(message) {
        console.error(chalk.red('❌ ' + message));
    }

    static warning(message) {
        console.warn(chalk.yellow('⚠ ' + message));
    }

    static debug(message) {
        if (process.env.DEBUG) {
            console.log(chalk.gray('🔍 ' + message));
        }
    }
}

module.exports = Logger;
