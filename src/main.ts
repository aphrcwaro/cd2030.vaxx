/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import * as fs from 'original-fs';
import { performance } from 'node:perf_hooks';
import { bootstrapESM } from './bootstrap-esm.js';
import { app, protocol, crashReporter, Menu, contentTracing } from 'electron';
import minimist from 'minimist';
import { product } from './bootstrap-meta.js';
import { getUserDataPath } from './vaxx/platform/environment/node/userDataPath.js';
import * as perf from './vaxx/base/common/performance.js';
import { resolveNLSConfiguration } from './vaxx/base/node/nls.js';
import { INLSConfiguration } from './vaxx/nls.js';
import { NativeParsedArgs } from './vaxx/platform/environment/common/argv.js';

perf.mark('code/didStartMain');

perf.mark('code/willLoadMainBundle', {
	// When built, the main bundle is a single JS file with all
	// dependencies inlined. As such, we mark `willLoadMainBundle`
	// as the start of the main bundle loading process.
	startTime: Math.floor(performance.timeOrigin)
});
perf.mark('code/didLoadMainBundle');

const args = parseCLIArgs();
// Enable sandbox globally unless
// 1) disabled via command line using either
//    `--no-sandbox` or `--disable-chromium-sandbox` argument.
// 2) argv.json contains `disable-chromium-sandbox: true`.
if (args['sandbox'] &&
	!args['disable-chromium-sandbox']) {
	app.enableSandbox();
} else if (app.commandLine.hasSwitch('no-sandbox') &&
	!app.commandLine.hasSwitch('disable-gpu-sandbox')) {
	// Disable GPU sandbox whenever --no-sandbox is used.
	app.commandLine.appendSwitch('disable-gpu-sandbox');
} else {
	app.commandLine.appendSwitch('no-sandbox');
	app.commandLine.appendSwitch('disable-gpu-sandbox');
}

// Set userData path before app 'ready' event
const userDataPath = getUserDataPath(args, product.nameShort ?? 'vaxx-dev');
app.setPath('userData', userDataPath);

// Resolve code cache path
const codeCachePath = getCodeCachePath();

// Disable default menu (https://github.com/electron/electron/issues/35512)
Menu.setApplicationMenu(null);

// Configure crash reporter
perf.mark('code/willStartCrashReporter');
// If a crash-reporter-directory is specified we store the crash reports
// in the specified directory and don't upload them to the crash server.
//
// Appcenter crash reporting is enabled if
// * enable-crash-reporter runtime argument is set to 'true'
// * --disable-crash-reporter command line parameter is not set
//
// Disable crash reporting in all other cases.
if (args['crash-reporter-directory'] || !args['disable-crash-reporter']) {
	configureCrashReporter();
}
perf.mark('code/didStartCrashReporter');

// Register custom schemes with privileges
protocol.registerSchemesAsPrivileged([
	{
		scheme: 'vaxx-webview',
		privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, allowServiceWorkers: true, codeCache: true }
	},
	{
		scheme: 'vaxx-file',
		privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true, codeCache: true }
	}
]);

/**
 * We can resolve the NLS configuration early if it is defined
 * in argv.json before `app.ready` event. Otherwise we can only
 * resolve NLS after `app.ready` event to resolve the OS locale.
 */
let nlsConfigurationPromise: Promise<INLSConfiguration> | undefined = undefined;

// Use the most preferred OS language for language recommendation.
// The API might return an empty array on Linux, such as when
// the 'C' locale is the user's only configured locale.
// No matter the OS, if the array is empty, default back to 'en'.
const osLocale = processZhLocale((app.getPreferredSystemLanguages()?.[0] ?? 'en').toLowerCase());
const userLocale = getUserDefinedLocale();
if (userLocale) {
	nlsConfigurationPromise = resolveNLSConfiguration({
		userLocale,
		osLocale,
		commit: product.commit,
		userDataPath,
		nlsMetadataPath: import.meta.dirname
	});
}

// Pass in the locale to Electron so that the
// Windows Control Overlay is rendered correctly on Windows.
// For now, don't pass in the locale on macOS due to
// https://github.com/microsoft/vscode/issues/167543.
// If the locale is `qps-ploc`, the Microsoft
// Pseudo Language Language Pack is being used.
// In that case, use `en` as the Electron locale.

if (process.platform === 'win32' || process.platform === 'linux') {
	const electronLocale = (!userLocale || userLocale === 'qps-ploc') ? 'en' : userLocale;
	app.commandLine.appendSwitch('lang', electronLocale);
}

// Load our code once ready
app.once('ready', function () {
	if (args['trace']) {
		let traceOptions: Electron.TraceConfig | Electron.TraceCategoriesAndOptions;
		if (args['trace-memory-infra']) {
			const customCategories = args['trace-category-filter']?.split(',') || [];
			customCategories.push('disabled-by-default-memory-infra', 'disabled-by-default-memory-infra.v8.code_stats');
			traceOptions = {
				included_categories: customCategories,
				excluded_categories: ['*'],
				memory_dump_config: {
					allowed_dump_modes: ['light', 'detailed'],
					triggers: [
						{
							type: 'periodic_interval',
							mode: 'detailed',
							min_time_between_dumps_ms: 10000
						},
						{
							type: 'periodic_interval',
							mode: 'light',
							min_time_between_dumps_ms: 1000
						}
					]
				}
			};
		} else {
			traceOptions = {
				categoryFilter: args['trace-category-filter'] || '*',
				traceOptions: args['trace-options'] || 'record-until-full,enable-sampling'
			};
		}

		contentTracing.startRecording(traceOptions).finally(() => onReady());
	} else {
		onReady();
	}
});

async function onReady() {
	perf.mark('code/mainAppReady');

	try {
		const [, nlsConfig] = await Promise.all([
			mkdirpIgnoreError(codeCachePath),
			resolveNlsConfiguration()
		]);

		await startup(codeCachePath, nlsConfig);
	} catch (error) {
		console.error(error);
	}
}

/**
 * Main startup routine
 */
async function startup(codeCachePath: string | undefined, nlsConfig: INLSConfiguration): Promise<void> {
	process.env['VAXX_NLS_CONFIG'] = JSON.stringify(nlsConfig);
	process.env['VAXX_CODE_CACHE_PATH'] = codeCachePath || '';

	// Bootstrap ESM
	await bootstrapESM();

	// Load Main
	//await import('./vs/code/electron-main/main.js');
	await import('./main1.js')
	perf.mark('code/didRunMainBundle');
}

function configureCrashReporter(): void {
	let crashReporterDirectory = args['crash-reporter-directory'];
	let submitURL = '';
	if (crashReporterDirectory) {
		crashReporterDirectory = path.normalize(crashReporterDirectory);

		if (!path.isAbsolute(crashReporterDirectory)) {
			console.error(`The path '${crashReporterDirectory}' specified for --crash-reporter-directory must be absolute.`);
			app.exit(1);
		}

		if (!fs.existsSync(crashReporterDirectory)) {
			try {
				fs.mkdirSync(crashReporterDirectory, { recursive: true });
			} catch (error) {
				console.error(`The path '${crashReporterDirectory}' specified for --crash-reporter-directory does not seem to exist or cannot be created.`);
				app.exit(1);
			}
		}

		// Crashes are stored in the crashDumps directory by default, so we
		// need to change that directory to the provided one
		console.log(`Found --crash-reporter-directory argument. Setting crashDumps directory to be '${crashReporterDirectory}'`);
		app.setPath('crashDumps', crashReporterDirectory);
	}

	// Start crash reporter for all processes
	const productName = (product.crashReporter ? product.crashReporter.productName : undefined) || product.nameShort;
	const companyName = (product.crashReporter ? product.crashReporter.companyName : undefined) || 'APHRC';
	const uploadToServer = Boolean(!process.env['VAXX_DEV'] && submitURL && !crashReporterDirectory);
	crashReporter.start({
		companyName,
		productName: process.env['VAXX_DEV'] ? `${productName} Dev` : productName,
		submitURL,
		uploadToServer,
		compress: true
	});
}

function parseCLIArgs(): NativeParsedArgs {
	return minimist(process.argv, {
		string: [
			'user-data-dir',
			'locale',
			'crash-reporter-directory'
		],
		boolean: [
			'disable-chromium-sandbox',
		],
		default: {
			'sandbox': true
		},
		alias: {
			'no-sandbox': 'sandbox'
		}
	});
}

function getCodeCachePath(): string | undefined {

	// explicitly disabled via CLI args
	if (process.argv.indexOf('--no-cached-data') > 0) {
		return undefined;
	}

	// running out of sources
	if (process.env['VAXX_DEV']) {
		return undefined;
	}

	// require commit id
	const commit = product.commit;
	if (!commit) {
		return undefined;
	}

	return path.join(userDataPath, 'CachedData', commit);
}

async function mkdirpIgnoreError(dir: string | undefined): Promise<string | undefined> {
	if (typeof dir === 'string') {
		try {
			await fs.promises.mkdir(dir, { recursive: true });

			return dir;
		} catch (error) {
			// ignore
		}
	}

	return undefined;
}

//#region NLS Support

function processZhLocale(appLocale: string): string {
	if (appLocale.startsWith('zh')) {
		const region = appLocale.split('-')[1];

		// On Windows and macOS, Chinese languages returned by
		// app.getPreferredSystemLanguages() start with zh-hans
		// for Simplified Chinese or zh-hant for Traditional Chinese,
		// so we can easily determine whether to use Simplified or Traditional.
		// However, on Linux, Chinese languages returned by that same API
		// are of the form zh-XY, where XY is a country code.
		// For China (CN), Singapore (SG), and Malaysia (MY)
		// country codes, assume they use Simplified Chinese.
		// For other cases, assume they use Traditional.
		if (['hans', 'cn', 'sg', 'my'].includes(region)) {
			return 'zh-cn';
		}

		return 'zh-tw';
	}

	return appLocale;
}

/**
 * Resolve the NLS configuration
 */
async function resolveNlsConfiguration(): Promise<INLSConfiguration> {

	// First, we need to test a user defined locale.
	// If it fails we try the app locale.
	// If that fails we fall back to English.

	const nlsConfiguration = nlsConfigurationPromise ? await nlsConfigurationPromise : undefined;
	if (nlsConfiguration) {
		return nlsConfiguration;
	}

	// Try to use the app locale which is only valid
	// after the app ready event has been fired.

	let userLocale = app.getLocale();
	if (!userLocale) {
		return {
			userLocale: 'en',
			osLocale,
			resolvedLanguage: 'en',
			defaultMessagesFile: path.join(import.meta.dirname, 'nls.messages.json'),

			// NLS: below 2 are a relic from old times only used by vaxx-nls and deprecated
			locale: 'en',
			availableLanguages: {}
		};
	}

	// See above the comment about the loader and case sensitiveness
	userLocale = processZhLocale(userLocale.toLowerCase());

	return resolveNLSConfiguration({
		userLocale,
		osLocale,
		commit: product.commit,
		userDataPath,
		nlsMetadataPath: import.meta.dirname
	});
}

/**
 * Language tags are case insensitive however an ESM loader is case sensitive
 * To make this work on case preserving & insensitive FS we do the following:
 * the language bundles have lower case language tags and we always lower case
 * the locale we receive from the user or OS.
 */
function getUserDefinedLocale(): string | undefined {
	const locale = args['locale'];
	if (locale) {
		return locale.toLowerCase(); // a directly provided --locale always wins
	}

	return undefined;
}

//#endregion
