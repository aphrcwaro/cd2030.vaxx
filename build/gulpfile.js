/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

// Increase max listeners for event emitters
require('events').EventEmitter.defaultMaxListeners = 100;

const gulp = require('gulp');
const util = require('./lib/util');
const task = require('./lib/task');
const { transpileTask, compileTask, watchTask } = require('./lib/compilation');

// SWC Client Transpile
const transpileSWCTask = task.define('transpile-esbuild', task.series(util.rimraf('out'), transpileTask('src', 'out', true)));
gulp.task(transpileSWCTask);

// Transpile only
const transpileClientTask = task.define('transpile', task.series(util.rimraf('out'), transpileTask('src', 'out')));
gulp.task(transpileClientTask);

// Fast compile for development time
const compileClientTask = task.define('compile', task.series(util.rimraf('out'), compileTask('src', 'out', false)));
gulp.task(compileClientTask);

const watchClientTask = task.define('watch', task.series(util.rimraf('out'), task.parallel(watchTask('out', false))));
gulp.task(watchClientTask);

// Default
gulp.task('default', compileClientTask);

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
	process.exit(1);
});

// Load all the gulpfiles only if running tasks other than the editor tasks
require('glob').sync('gulpfile.*.js', { cwd: __dirname })
	.forEach(f => require(`./${f}`));
