/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const es = require('event-stream');
const vfs = require('vinyl-fs');
const rename = require('gulp-rename');
const replace = require('gulp-replace');
const filter = require('gulp-filter');
const util = require('./lib/util');
const { getVersion } = require('./lib/getVersion');
const { readISODate } = require('./lib/date');
const task = require('./lib/task');
const optimize = require('./lib/optimize');
const { inlineMeta } = require('./lib/inlineMeta');
const root = path.dirname(__dirname);
const commit = getVersion(root);
const packageJson = require('../package.json');
const product = require('../product.json');
const crypto = require('crypto');
const i18n = require('./lib/i18n');
const { getProductionDependencies } = require('./lib/dependencies');
const { config } = require('./lib/electron');
const createAsar = require('./lib/asar').createAsar;
const minimist = require('minimist');
const { compileBuildWithoutManglingTask, compileBuildWithManglingTask } = require('./gulpfile.compile');
const { promisify } = require('util');
const glob = promisify(require('glob'));
const rcedit = promisify(require('rcedit'));

const vaxxResources = [];

const bootstrapEntryPoints = ['out-build/main.js'];

const bundleVaxxTask = task.define('bundle-vaxx', task.series(
	util.rimraf('out-vaxx'),
	// Optimize: bundles source files automatically based on
	// import statements based on the passed in entry points.
	// In addition, concat window related bootstrap files into
	// a single file.
	optimize.bundleTask(
		{
			out: 'out-vaxx',
			esm: {
				src: 'out-build',
				entryPoints: [
					...bootstrapEntryPoints
				]//,
				//resources: vaxxResources
			}
		}
	)
));
gulp.task(bundleVaxxTask);

const sourceMappingURLBase = `https://main.vscode-cdn.net/sourcemaps/${commit}`;
const minifyVaxxTask = task.define('minify-vaxx', task.series(
	bundleVaxxTask,
	util.rimraf('out-vaxx-min'),
	optimize.minifyTask('out-vaxx', `${sourceMappingURLBase}/core`)
));
gulp.task(minifyVaxxTask);

/**
 * Compute checksums for some files.
 *
 * @param {string} out The out folder to read the file from.
 * @param {string[]} filenames The paths to compute a checksum for.
 * @return {Object} A map of paths to checksums.
 */
function computeChecksums(out, filenames) {
	const result = {};
	filenames.forEach(function (filename) {
		const fullPath = path.join(process.cwd(), out, filename);
		result[filename] = computeChecksum(fullPath);
	});
	return result;
}

/**
 * Compute checksum for a file.
 *
 * @param {string} filename The absolute path to a filename.
 * @return {string} The checksum for `filename`.
 */
function computeChecksum(filename) {
	const contents = fs.readFileSync(filename);

	const hash = crypto
		.createHash('sha256')
		.update(contents)
		.digest('base64')
		.replace(/=+$/, '');

	return hash;
}

function packageTask(platform, arch, sourceFolderName, destinationFolderName, opts) {
	opts = opts || {};

	const destination = path.join(path.dirname(root), destinationFolderName);
	platform = platform || process.platform;

	const task = () => {
		const electron = require('@vscode/gulp-electron');
		const json = require('gulp-json-editor');

		const out = sourceFolderName;

		const checksums = computeChecksums(out, [
			/*
			'vs/base/parts/sandbox/electron-browser/preload.js',
			'vs/workbench/workbench.desktop.main.js',
			'vs/workbench/workbench.desktop.main.css',
			'vs/code/electron-browser/workbench/workbench.html',
			'vs/code/electron-browser/workbench/workbench.js'
			*/
		]);

		const src = gulp.src(out + '/**', { base: '.' })
			.pipe(rename(function (path) { path.dirname = path.dirname.replace(new RegExp('^' + out), 'out'); }))
			.pipe(util.setExecutableBit(['**/*.sh']));

		const sources = src
			.pipe(filter(['**', '!**/*.{js,css}.map'], { dot: true }));

		let version = packageJson.version;
		const quality = product.quality;

		if (quality && quality !== 'stable') {
			version += '-' + quality;
		}

		const name = product.nameShort;
		const packageJsonUpdates = { name, version };

		if (platform === 'linux') {
			packageJsonUpdates.desktopName = `${product.applicationName}.desktop`;
		}

		let packageJsonContents;
		const packageJsonStream = gulp.src(['package.json'], { base: '.' })
			.pipe(json(packageJsonUpdates))
			.pipe(es.through(function (file) {
				packageJsonContents = file.contents.toString();
				this.emit('data', file);
			}));

		let productJsonContents;
		const productJsonStream = gulp.src(['product.json'], { base: '.' })
			.pipe(json({ commit, date: readISODate('out-build'), /*checksums,*/ version }))
			.pipe(es.through(function (file) {
				productJsonContents = file.contents.toString();
				this.emit('data', file);
			}));

		const root = path.resolve(path.join(__dirname, '..'));
		const licenseGlobs = [product.licenseFileName, 'ThirdPartyNotices.txt'];
		if (fs.existsSync(path.join(root, 'licenses'))) {
			licenseGlobs.push('licenses/**');
		}
		const license = gulp.src(licenseGlobs, { base: '.', allowEmpty: true });

		const jsFilter = util.filter(data => !data.isDirectory() && /\.js$/.test(data.path));
		const productionDependencies = getProductionDependencies(root);
		const dependenciesSrc = productionDependencies.map(d => path.relative(root, d)).map(d => [`${d}/**`, `!${d}/**/{test,tests}/**`]).flat().concat('!**/*.mk');

		const deps = gulp.src(dependenciesSrc, { base: '.', dot: true })
			.pipe(filter(['**', `!**/${config.version}/**`, '!**/bin/darwin-arm64-87/**', '!**/package-lock.json', '!**/yarn.lock', '!**/*.{js,css}.map']))
			.pipe(util.cleanNodeModules(path.join(__dirname, '.moduleignore')))
			.pipe(util.cleanNodeModules(path.join(__dirname, `.moduleignore.${process.platform}`)))
			.pipe(jsFilter)
			.pipe(util.rewriteSourceMappingURL(sourceMappingURLBase))
			.pipe(jsFilter.restore)
			.pipe(createAsar(path.join(process.cwd(), 'node_modules'), [
				'**/*.node',
				'**/@vscode/ripgrep/bin/*',
				'**/*.wasm',
				'**/@vscode/vsce-sign/bin/*'
			], [
				'**/*.mk',
				'!node_modules/vsda/**' // stay compatible with extensions that depend on us shipping `vsda` into ASAR
			], [
				'node_modules/vsda/**' // retain copy of `vsda` in node_modules for internal use
			], 'node_modules.asar'));

		const app = gulp.src([
			'app/**',
			'!app/**/.git/**',           // optional: skip any nested git data
			'!app/**/.Rproj.user/**'     // optional: skip RStudio temp state
		], { base: 'app', dot: true, allowEmpty: true });

		let all = util.mergeStreams(
			packageJsonStream,
			productJsonStream,
			license,
			sources,
			deps,
			app
		);

		if (platform === 'win32') {
			all = util.mergeStreams(all, gulp.src([
				'resources/win32/code_70x70.png',
				'resources/win32/code_150x150.png'
			], { base: '.' }));
		} else if (platform === 'linux') {
			all = util.mergeStreams(all, gulp.src('resources/linux/code.png', { base: '.' }));
		} else if (platform === 'darwin') {
			const shortcut = gulp.src('resources/darwin/bin/code.sh')
				.pipe(replace('@@APPNAME@@', product.applicationName))
				.pipe(rename('bin/code'));
			const darwinStreams = [shortcut];
			all = util.mergeStreams(all, ...darwinStreams);
		}

		let result = all
			.pipe(util.skipDirectories())
			.pipe(util.fixWin32DirectoryPermissions())
			.pipe(filter(['**', '!**/.github/**'], { dot: true })) // https://github.com/microsoft/vscode/issues/116523
			.pipe(electron({ ...config, platform, arch: arch === 'armhf' ? 'arm' : arch, ffmpegChromium: false }))
			.pipe(filter(['**', '!LICENSE', '!version'], { dot: true }));

		if (platform === 'linux') {
			result = util.mergeStreams(result, gulp.src('resources/completions/bash/code', { base: '.' })
				.pipe(replace('@@APPNAME@@', product.applicationName))
				.pipe(rename(function (f) { f.basename = product.applicationName; })));

			result = util.mergeStreams(result, gulp.src('resources/completions/zsh/_code', { base: '.' })
				.pipe(replace('@@APPNAME@@', product.applicationName))
				.pipe(rename(function (f) { f.basename = '_' + product.applicationName; })));
		}

		if (platform === 'win32') {
			result = util.mergeStreams(result, gulp.src('resources/win32/bin/code.js', { base: 'resources/win32', allowEmpty: true }));

			result = util.mergeStreams(result, gulp.src('resources/win32/bin/code.cmd', { base: 'resources/win32' })
				.pipe(replace('@@NAME@@', product.nameShort))
				.pipe(rename(function (f) { f.basename = product.applicationName; })));

			result = util.mergeStreams(result, gulp.src('resources/win32/bin/code.sh', { base: 'resources/win32' })
				.pipe(replace('@@NAME@@', product.nameShort))
				.pipe(replace('@@PRODNAME@@', product.nameLong))
				.pipe(replace('@@VERSION@@', version))
				.pipe(replace('@@COMMIT@@', commit))
				.pipe(replace('@@APPNAME@@', product.applicationName))
				.pipe(replace('@@QUALITY@@', quality))
				.pipe(rename(function (f) { f.basename = product.applicationName; f.extname = ''; })));

			result = util.mergeStreams(result, gulp.src('resources/win32/VisualElementsManifest.xml', { base: 'resources/win32' })
				.pipe(rename(product.nameShort + '.VisualElementsManifest.xml')));

			if (quality === 'stable' || quality === 'insider') {
				const appxSourcePath = path.join(root, '.build', 'win32', 'appx');
				if (fs.existsSync(appxSourcePath)) {
					result = util.mergeStreams(result, gulp.src('.build/win32/appx/**', { base: '.build/win32' }));
				}
				const rawVersion = version.replace(/-\w+$/, '').split('.');
				const appxVersion = `${rawVersion[0]}.0.${rawVersion[1]}.${rawVersion[2]}`;
				const appxManifestPath = path.join(root, 'resources', 'win32', 'appx', 'AppxManifest.xml');
				if (fs.existsSync(appxManifestPath)) {
					result = util.mergeStreams(result, gulp.src('resources/win32/appx/AppxManifest.xml', { base: '.' })
						.pipe(replace('@@AppxPackageName@@', product.win32AppUserModelId))
						.pipe(replace('@@AppxPackageVersion@@', appxVersion))
						.pipe(replace('@@AppxPackageDisplayName@@', product.nameLong))
						.pipe(replace('@@AppxPackageDescription@@', product.win32NameVersion))
						.pipe(replace('@@ApplicationIdShort@@', product.win32RegValueName))
						.pipe(replace('@@ApplicationExe@@', product.nameShort + '.exe'))
						.pipe(replace('@@FileExplorerContextMenuID@@', quality === 'stable' ? 'OpenWithCode' : 'OpenWithCodeInsiders'))
						.pipe(replace('@@FileExplorerContextMenuCLSID@@', product.win32ContextMenu[arch].clsid))
						.pipe(replace('@@FileExplorerContextMenuDLL@@', `${quality === 'stable' ? 'code' : 'code_insider'}_explorer_command_${arch}.dll`))
						.pipe(rename(f => f.dirname = `appx/manifest`)));
				}
			}
		} else if (platform === 'linux') {
			result = util.mergeStreams(result, gulp.src('resources/linux/bin/code.sh', { base: '.' })
				.pipe(replace('@@PRODNAME@@', product.nameLong))
				.pipe(replace('@@APPNAME@@', product.applicationName))
				.pipe(rename('bin/' + product.applicationName)));
		}

		result = inlineMeta(result, {
			targetPaths: bootstrapEntryPoints,
			packageJsonFn: () => packageJsonContents,
			productJsonFn: () => productJsonContents
		});

		return result.pipe(vfs.dest(destination));
	};
	task.taskName = `package-${platform}-${arch}`;
	return task;
}

function patchWin32DependenciesTask(destinationFolderName) {
	const cwd = path.join(path.dirname(root), destinationFolderName);

	return async () => {
		const deps = await glob('**/*.node', { cwd });
		console.log(deps)
		const packageJson = JSON.parse(await fs.promises.readFile(path.join(cwd, 'resources', 'app', 'package.json'), 'utf8'));
		const product = JSON.parse(await fs.promises.readFile(path.join(cwd, 'resources', 'app', 'product.json'), 'utf8'));
		const baseVersion = packageJson.version.replace(/-.*$/, '');

		await Promise.all(deps.map(async dep => {
			const basename = path.basename(dep);

			await rcedit(path.join(cwd, dep), {
				'file-version': baseVersion,
				'version-string': {
					'CompanyName': 'African Population and Health Research Center',
					'FileDescription': product.nameLong,
					'FileVersion': packageJson.version,
					'InternalName': basename,
					'LegalCopyright': 'Copyright (C) 2025 APHRC. All rights reserved',
					'OriginalFilename': basename,
					'ProductName': product.nameLong,
					'ProductVersion': packageJson.version
				}
			});
		}));
	};
}

const buildRoot = path.dirname(root);

const BUILD_TARGETS = [
	{ platform: 'win32', arch: 'x64' },
	{ platform: 'win32', arch: 'arm64' },
	{ platform: 'darwin', arch: 'x64', opts: { stats: true } },
	{ platform: 'darwin', arch: 'arm64', opts: { stats: true } },
	{ platform: 'linux', arch: 'x64' },
	{ platform: 'linux', arch: 'armhf' },
	{ platform: 'linux', arch: 'arm64' },
];
BUILD_TARGETS.forEach(buildTarget => {
	const dashed = (str) => (str ? `-${str}` : ``);
	const platform = buildTarget.platform;
	const arch = buildTarget.arch;
	const opts = buildTarget.opts;

	const [vaxx, vaxxMin] = ['', 'min'].map(minified => {
		const sourceFolderName = `out-vaxx${dashed(minified)}`;
		const destinationFolderName = `Vaxx${dashed(platform)}${dashed(arch)}`;

		const tasks = [
			util.rimraf(path.join(buildRoot, destinationFolderName)),
			packageTask(platform, arch, sourceFolderName, destinationFolderName, opts)
		];

		if (platform === 'win32') {
			tasks.push(patchWin32DependenciesTask(destinationFolderName));
		}

		const vaxxTask = task.define(`vaxx${dashed(platform)}${dashed(arch)}${dashed(minified)}`, task.series(
			minified ? compileBuildWithManglingTask : compileBuildWithoutManglingTask,
			minified ? minifyVaxxTask : bundleVaxxTask,
			task.series(...tasks)
		));
		gulp.task(vaxxTask);

		return vaxxTask;
	});

	if (process.platform === platform && process.arch === arch) {
		gulp.task(task.define('vaxx', task.series(vaxx)));
		gulp.task(task.define('vaxx-min', task.series(vaxxMin)));
	}
});

// #region nls

const innoSetupConfig = {
	'fr': { codePage: 'CP1252' },
	'pt-br': { codePage: 'CP1252' }
};

gulp.task(task.define(
	'vaxx-translations-export',
	task.series(
		function () {
			const pathToMetadata = './out-build/nls.metadata.json';
			const pathToSetup = 'build/win32/i18n/messages.en.isl';

			return util.mergeStreams(
				gulp.src(pathToMetadata).pipe(i18n.createXlfFilesForCoreBundle()),
				gulp.src(pathToSetup).pipe(i18n.createXlfFilesForIsl())
			).pipe(vfs.dest('../vaxx-translations-export'));
		}
	)
));

gulp.task('vaxx-translations-import', function () {
	const options = minimist(process.argv.slice(2), {
		string: 'location',
		default: {
			location: '../vaxx-translations-import'
		}
	});
	return util.mergeStreams(...[...i18n.defaultLanguages, ...i18n.extraLanguages].map(language => {
		const id = language.id;
		return gulp.src(`${options.location}/${id}/vaxx-setup/messages.xlf`)
			.pipe(i18n.prepareIslFiles(language, innoSetupConfig[language.id]))
			.pipe(vfs.dest(`./build/win32/i18n`));
	}));
});

// #endregion
