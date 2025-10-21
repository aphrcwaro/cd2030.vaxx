/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import path from 'path';
import fs from 'fs';

import { through, ThroughStream } from 'event-stream';
import File from 'vinyl';
import xml2js from 'xml2js';
import fancyLog from 'fancy-log';
import ansiColors from 'ansi-colors';
import iconv from '@vscode/iconv-lite-umd';
import { l10nJsonFormat, l10nJsonDetails, getL10nFilesFromXlf } from '@vscode/l10n-dev';

const REPO_ROOT_PATH = path.join(__dirname, '../..');

function log(message: any, ...rest: unknown[]): void {
	fancyLog(ansiColors.green('[i18n]'), message, ...rest);
}

export interface Language {
	id: string; // language id, e.g. zh-tw, de
	translationId?: string; // language id used in translation tools, e.g. zh-hant, de (optional, if not set, the id is used)
	folderName?: string; // language specific folder name, e.g. cht, deu  (optional, if not set, the id is used)
}

export interface InnoSetup {
	codePage: string; //code page for encoding (http://www.jrsoftware.org/ishelp/index.php?topic=langoptionssection)
}

export const defaultLanguages: Language[] = [
	{ id: 'fr', folderName: 'fra' },
	{ id: 'pt-br', folderName: 'ptb' }
];

interface Item {
	id: string;
	message: string;
	comment?: string;
}

export interface Resource {
	name: string;
	project: string;
}

interface LocalizeInfo {
	key: string;
	comment: string[];
}

module LocalizeInfo {
	export function is(value: unknown): value is LocalizeInfo {
		const candidate = value as LocalizeInfo;
		return candidate && typeof candidate.key === 'string' && (candidate.comment === undefined || (Array.isArray(candidate.comment) && candidate.comment.every(element => typeof element === 'string')));
	}
}

interface BundledFormat {
	keys: Record<string, (string | LocalizeInfo)[]>;
	messages: Record<string, string[]>;
	bundles: Record<string, string[]>;
}

module BundledFormat {
	export function is(value: any): value is BundledFormat {
		if (value === undefined) {
			return false;
		}

		const candidate = value as BundledFormat;
		const length = Object.keys(value).length;

		return length === 3 && !!candidate.keys && !!candidate.messages && !!candidate.bundles;
	}
}

type NLSKeysFormat = [string /* module ID */, string[] /* keys */];

module NLSKeysFormat {
	export function is(value: any): value is NLSKeysFormat {
		if (value === undefined) {
			return false;
		}

		const candidate = value as NLSKeysFormat;
		return Array.isArray(candidate) && Array.isArray(candidate[1]);
	}
}

interface I18nFormat {
	version: string;
	contents: {
		[module: string]: {
			[messageKey: string]: string;
		};
	};
}

export class Line {
	private buffer: string[] = [];

	constructor(indent: number = 0) {
		if (indent > 0) {
			this.buffer.push(new Array(indent + 1).join(' '));
		}
	}

	public append(value: string): Line {
		this.buffer.push(value);
		return this;
	}

	public toString(): string {
		return this.buffer.join('');
	}
}

class TextModel {
	private _lines: string[];

	constructor(contents: string) {
		this._lines = contents.split(/\r\n|\r|\n/);
	}

	public get lines(): string[] {
		return this._lines;
	}
}

export class XLF {
	private buffer: string[];
	private files: Record<string, Item[]>;
	public numberOfMessages: number;

	constructor(public project: string) {
		this.buffer = [];
		this.files = Object.create(null);
		this.numberOfMessages = 0;
	}

	public toString(): string {
		this.appendHeader();

		const files = Object.keys(this.files).sort();
		for (const file of files) {
			this.appendNewLine(`<file original="${file}" source-language="en" datatype="plaintext"><body>`, 2);
			const items = this.files[file].sort((a: Item, b: Item) => {
				return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
			});
			for (const item of items) {
				this.addStringItem(file, item);
			}
			this.appendNewLine('</body></file>');
		}
		this.appendFooter();
		return this.buffer.join('\r\n');
	}

	public addFile(original: string, keys: (string | LocalizeInfo)[], messages: string[]) {
		if (keys.length === 0) {
			console.log('No keys in ' + original);
			return;
		}
		if (keys.length !== messages.length) {
			throw new Error(`Unmatching keys(${keys.length}) and messages(${messages.length}).`);
		}
		this.numberOfMessages += keys.length;
		this.files[original] = [];
		const existingKeys = new Set<string>();
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			let realKey: string | undefined;
			let comment: string | undefined;
			if (typeof key === 'string') {
				realKey = key;
				comment = undefined;
			} else if (LocalizeInfo.is(key)) {
				realKey = key.key;
				if (key.comment && key.comment.length > 0) {
					comment = key.comment.map(comment => encodeEntities(comment)).join('\r\n');
				}
			}
			if (!realKey || existingKeys.has(realKey)) {
				continue;
			}
			existingKeys.add(realKey);
			const message: string = encodeEntities(messages[i]);
			this.files[original].push({ id: realKey, message: message, comment: comment });
		}
	}

	private addStringItem(file: string, item: Item): void {
		if (!item.id || item.message === undefined || item.message === null) {
			throw new Error(`No item ID or value specified: ${JSON.stringify(item)}. File: ${file}`);
		}
		if (item.message.length === 0) {
			log(`Item with id ${item.id} in file ${file} has an empty message.`);
		}

		this.appendNewLine(`<trans-unit id="${item.id}">`, 4);
		this.appendNewLine(`<source xml:lang="en">${item.message}</source>`, 6);

		if (item.comment) {
			this.appendNewLine(`<note>${item.comment}</note>`, 6);
		}

		this.appendNewLine('</trans-unit>', 4);
	}

	private appendHeader(): void {
		this.appendNewLine('<?xml version="1.0" encoding="utf-8"?>', 0);
		this.appendNewLine('<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">', 0);
	}

	private appendFooter(): void {
		this.appendNewLine('</xliff>', 0);
	}

	private appendNewLine(content: string, indent?: number): void {
		const line = new Line(indent);
		line.append(content);
		this.buffer.push(line.toString());
	}

	static parse = function (xlfString: string): Promise<l10nJsonDetails[]> {
		return new Promise((resolve, reject) => {
			const parser = new xml2js.Parser();

			const files: { messages: Record<string, string>; name: string; language: string }[] = [];

			parser.parseString(xlfString, function (err: any, result: any) {
				if (err) {
					reject(new Error(`XLF parsing error: Failed to parse XLIFF string. ${err}`));
				}

				const fileNodes: any[] = result['xliff']['file'];
				if (!fileNodes) {
					reject(new Error(`XLF parsing error: XLIFF file does not contain "xliff" or "file" node(s) required for parsing.`));
				}

				fileNodes.forEach((file) => {
					const name = file.$.original;
					if (!name) {
						reject(new Error(`XLF parsing error: XLIFF file node does not contain original attribute to determine the original location of the resource file.`));
					}
					const language = file.$['target-language'];
					if (!language) {
						reject(new Error(`XLF parsing error: XLIFF file node does not contain target-language attribute to determine translated language.`));
					}
					const messages: Record<string, string> = {};

					const transUnits = file.body[0]['trans-unit'];
					if (transUnits) {
						transUnits.forEach((unit: any) => {
							const key = unit.$.id;
							if (!unit.target) {
								return; // No translation available
							}

							let val = unit.target[0];
							if (typeof val !== 'string') {
								// We allow empty source values so support them for translations as well.
								val = val._ ? val._ : '';
							}
							if (!key) {
								reject(new Error(`XLF parsing error: trans-unit ${JSON.stringify(unit, undefined, 0)} defined in file ${name} is missing the ID attribute.`));
								return;
							}
							messages[key] = decodeEntities(val);
						});
						files.push({ messages, name, language: language.toLowerCase() });
					}
				});

				resolve(files);
			});
		});
	};
}

function sortLanguages(languages: Language[]): Language[] {
	return languages.sort((a: Language, b: Language): number => {
		return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
	});
}

function stripComments(content: string): string {
	// Copied from stripComments.js
	//
	// First group matches a double quoted string
	// Second group matches a single quoted string
	// Third group matches a multi line comment
	// Forth group matches a single line comment
	// Fifth group matches a trailing comma
	const regexp = /("[^"\\]*(?:\\.[^"\\]*)*")|('[^'\\]*(?:\\.[^'\\]*)*')|(\/\*[^\/\*]*(?:(?:\*|\/)[^\/\*]*)*?\*\/)|(\/{2,}.*?(?:(?:\r?\n)|$))|(,\s*[}\]])/g;
	const result = content.replace(regexp, (match, _m1: string, _m2: string, m3: string, m4: string, m5: string) => {
		// Only one of m1, m2, m3, m4, m5 matches
		if (m3) {
			// A block comment. Replace with nothing
			return '';
		} else if (m4) {
			// Since m4 is a single line comment is is at least of length 2 (e.g. //)
			// If it ends in \r?\n then keep it.
			const length = m4.length;
			if (m4[length - 1] === '\n') {
				return m4[length - 2] === '\r' ? '\r\n' : '\n';
			} else {
				return '';
			}
		} else if (m5) {
			// Remove the trailing comma
			return match.substring(1);
		} else {
			// We match a string
			return match;
		}
	});
	return result;
}

function processCoreBundleFormat(base: string, fileHeader: string, languages: Language[], json: NLSKeysFormat, emitter: ThroughStream) {
	const languageDirectory = path.join(REPO_ROOT_PATH, '..', 'vaxx-loc', 'i18n');
	if (!fs.existsSync(languageDirectory)) {
		log(`No Vaxx localization repository found. Looking at ${languageDirectory}`);
		log(`To bundle translations please check out the vaxx-loc repository as a sibling of the vaxx repository.`);
	}
	const sortedLanguages = sortLanguages(languages);
	sortedLanguages.forEach((language) => {
		if (process.env['VAXX_BUILD_VERBOSE']) {
			log(`Generating nls bundles for: ${language.id}`);
		}

		const languageFolderName = language.translationId || language.id;
		const i18nFile = path.join(languageDirectory, `vaxx-language-pack-${languageFolderName}`, 'translations', 'main.i18n.json');
		let allMessages: I18nFormat | undefined;
		if (fs.existsSync(i18nFile)) {
			const content = stripComments(fs.readFileSync(i18nFile, 'utf8'));
			allMessages = JSON.parse(content);
		}

		let nlsIndex = 0;
		const nlsResult: Array<string | undefined> = [];
		for (const [moduleId, nlsKeys] of json) {
			const moduleTranslations = allMessages?.contents[moduleId];
			for (const nlsKey of nlsKeys) {
				nlsResult.push(moduleTranslations?.[nlsKey]); // pushing `undefined` is fine, as we keep english strings as fallback for monaco editor in the build
				nlsIndex++;
			}
		}

		emitter.queue(new File({
			contents: Buffer.from(`${fileHeader}
globalThis._VAXX_NLS_MESSAGES=${JSON.stringify(nlsResult)};
globalThis._VAXX_NLS_LANGUAGE=${JSON.stringify(language.id)};`),
			base,
			path: `${base}/nls.messages.${language.id}.js`
		}));
	});
}

export function processNlsFiles(opts: { out: string; fileHeader: string; languages: Language[] }): ThroughStream {
	return through(function (this: ThroughStream, file: File) {
		const fileName = path.basename(file.path);
		if (fileName === 'nls.keys.json') {
			try {
				const contents = file.contents!.toString('utf8');
				const json = JSON.parse(contents);
				if (NLSKeysFormat.is(json)) {
					processCoreBundleFormat(file.base, opts.fileHeader, opts.languages, json, this);
				}
			} catch (error) {
				this.emit('error', `Failed to read component file: ${error}`);
			}
		}
		this.queue(file);
	});
}

const workbenchProject: string = 'vaxx-workbench',
	setupProject: string = 'vaxx-setup';

export function getResource(sourceFile: string): Resource {
	if (/^vaxx/.test(sourceFile)) {
		return { name: 'vaxx/platform', project: workbenchProject };
	}

	throw new Error(`Could not identify the XLF bundle for ${sourceFile}`);
}


export function createXlfFilesForCoreBundle(): ThroughStream {
	return through(function (this: ThroughStream, file: File) {
		const basename = path.basename(file.path);
		if (basename === 'nls.metadata.json') {
			if (file.isBuffer()) {
				const xlfs: Record<string, XLF> = Object.create(null);
				const json: BundledFormat = JSON.parse((file.contents as Buffer).toString('utf8'));
				for (const coreModule in json.keys) {
					const projectResource = getResource(coreModule);
					const resource = projectResource.name;
					const project = projectResource.project;

					const keys = json.keys[coreModule];
					const messages = json.messages[coreModule];
					if (keys.length !== messages.length) {
						this.emit('error', `There is a mismatch between keys and messages in ${file.relative} for module ${coreModule}`);
						return;
					} else {
						let xlf = xlfs[resource];
						if (!xlf) {
							xlf = new XLF(project);
							xlfs[resource] = xlf;
						}
						xlf.addFile(`src/${coreModule}`, keys, messages);
					}
				}
				for (const resource in xlfs) {
					const xlf = xlfs[resource];
					const filePath = `${xlf.project}/${resource.replace(/\//g, '_')}.xlf`;
					const xlfFile = new File({
						path: filePath,
						contents: Buffer.from(xlf.toString(), 'utf8')
					});
					this.queue(xlfFile);
				}
			} else {
				this.emit('error', new Error(`File ${file.relative} is not using a buffer content`));
				return;
			}
		} else {
			this.emit('error', new Error(`File ${file.relative} is not a core meta data file.`));
			return;
		}
	});
}

export function createXlfFilesForIsl(): ThroughStream {
	return through(function (this: ThroughStream, file: File) {
		let projectName: string,
			resourceFile: string;
		if (path.basename(file.path) === 'messages.en.isl') {
			projectName = setupProject;
			resourceFile = 'messages.xlf';
		} else {
			throw new Error(`Unknown input file ${file.path}`);
		}

		const xlf = new XLF(projectName),
			keys: string[] = [],
			messages: string[] = [];

		const model = new TextModel(file.contents!.toString());
		let inMessageSection = false;
		model.lines.forEach(line => {
			if (line.length === 0) {
				return;
			}
			const firstChar = line.charAt(0);
			switch (firstChar) {
				case ';':
					// Comment line;
					return;
				case '[':
					inMessageSection = '[Messages]' === line || '[CustomMessages]' === line;
					return;
			}
			if (!inMessageSection) {
				return;
			}
			const sections: string[] = line.split('=');
			if (sections.length !== 2) {
				throw new Error(`Badly formatted message found: ${line}`);
			} else {
				const key = sections[0];
				const value = sections[1];
				if (key.length > 0 && value.length > 0) {
					keys.push(key);
					messages.push(value);
				}
			}
		});

		const originalPath = file.path.substring(file.cwd.length + 1, file.path.split('.')[0].length).replace(/\\/g, '/');
		xlf.addFile(originalPath, keys, messages);

		// Emit only upon all ISL files combined into single XLF instance
		const newFilePath = path.join(projectName, resourceFile);
		const xlfFile = new File({ path: newFilePath, contents: Buffer.from(xlf.toString(), 'utf-8') });
		this.queue(xlfFile);
	});
}

function createI18nFile(name: string, messages: any): File {
	const result = Object.create(null);
	result[''] = [
		'--------------------------------------------------------------------------------------------',
		'Copyright (c) Microsoft Corporation. All rights reserved.',
		'Licensed under the MIT License. See License.txt in the project root for license information.',
		'--------------------------------------------------------------------------------------------',
		'Do not edit this file. It is machine generated.'
	];
	for (const key of Object.keys(messages)) {
		result[key] = messages[key];
	}

	let content = JSON.stringify(result, null, '\t');
	if (process.platform === 'win32') {
		content = content.replace(/\n/g, '\r\n');
	}
	return new File({
		path: path.join(name + '.i18n.json'),
		contents: Buffer.from(content, 'utf8')
	});
}

interface I18nPack {
	version: string;
	contents: {
		[path: string]: Record<string, string>;
	};
}

const i18nPackVersion = '1.0.0';

export interface TranslationPath {
	id: string;
	resourceName: string;
}

function getRecordFromL10nJsonFormat(l10nJsonFormat: l10nJsonFormat): Record<string, string> {
	const record: Record<string, string> = {};
	for (const key of Object.keys(l10nJsonFormat).sort()) {
		const value = l10nJsonFormat[key];
		record[key] = typeof value === 'string' ? value : value.message;
	}
	return record;
}

export function prepareI18nPackFiles(resultingTranslationPaths: TranslationPath[]): NodeJS.ReadWriteStream {
	const parsePromises: Promise<l10nJsonDetails[]>[] = [];
	const mainPack: I18nPack = { version: i18nPackVersion, contents: {} };
	const errors: unknown[] = [];
	return through(function (this: ThroughStream, xlf: File) {
		let project = path.basename(path.dirname(path.dirname(xlf.relative)));
		// strip `-new` since vscode-extensions-loc uses the `-new` suffix to indicate that it's from the new loc pipeline
		const resource = path.basename(path.basename(xlf.relative, '.xlf'), '-new');
		const contents = xlf.contents!.toString();
		log(`Found ${project}: ${resource}`);
		const parsePromise = getL10nFilesFromXlf(contents);
		parsePromises.push(parsePromise);
		parsePromise.then(
			resolvedFiles => {
				resolvedFiles.forEach(file => {
					const path = file.name;
					const firstSlash = path.indexOf('/');

					mainPack.contents[path.substring(firstSlash + 1)] = getRecordFromL10nJsonFormat(file.messages);
				});
			}
		).catch(reason => {
			errors.push(reason);
		});
	}, function () {
		Promise.all(parsePromises)
			.then(() => {
				if (errors.length > 0) {
					throw errors;
				}
				const translatedMainFile = createI18nFile('./main', mainPack);
				resultingTranslationPaths.push({ id: 'vaxx', resourceName: 'main.i18n.json' });

				this.queue(translatedMainFile);
				this.queue(null);
			})
			.catch((reason) => {
				this.emit('error', reason);
			});
	});
}

export function prepareIslFiles(language: Language, innoSetupConfig: InnoSetup): ThroughStream {
	const parsePromises: Promise<l10nJsonDetails[]>[] = [];

	return through(function (this: ThroughStream, xlf: File) {
		const stream = this;
		const parsePromise = XLF.parse(xlf.contents!.toString());
		parsePromises.push(parsePromise);
		parsePromise.then(
			resolvedFiles => {
				resolvedFiles.forEach(file => {
					const translatedFile = createIslFile(file.name, file.messages, language, innoSetupConfig);
					stream.queue(translatedFile);
				});
			}
		).catch(reason => {
			this.emit('error', reason);
		});
	}, function () {
		Promise.all(parsePromises)
			.then(() => { this.queue(null); })
			.catch(reason => {
				this.emit('error', reason);
			});
	});
}

function createIslFile(name: string, messages: l10nJsonFormat, language: Language, innoSetup: InnoSetup): File {
	const content: string[] = [];
	let originalContent: TextModel;
	if (path.basename(name) === 'Default') {
		originalContent = new TextModel(fs.readFileSync(name + '.isl', 'utf8'));
	} else {
		originalContent = new TextModel(fs.readFileSync(name + '.en.isl', 'utf8'));
	}
	originalContent.lines.forEach(line => {
		if (line.length > 0) {
			const firstChar = line.charAt(0);
			if (firstChar === '[' || firstChar === ';') {
				content.push(line);
			} else {
				const sections: string[] = line.split('=');
				const key = sections[0];
				let translated = line;
				if (key) {
					const translatedMessage = messages[key];
					if (translatedMessage) {
						translated = `${key}=${translatedMessage}`;
					}
				}

				content.push(translated);
			}
		}
	});

	const basename = path.basename(name);
	const filePath = `${basename}.${language.id}.isl`;
	const encoded = iconv.encode(Buffer.from(content.join('\r\n'), 'utf8').toString(), innoSetup.codePage);

	return new File({
		path: filePath,
		contents: Buffer.from(encoded),
	});
}

function encodeEntities(value: string): string {
	const result: string[] = [];
	for (let i = 0; i < value.length; i++) {
		const ch = value[i];
		switch (ch) {
			case '<':
				result.push('&lt;');
				break;
			case '>':
				result.push('&gt;');
				break;
			case '&':
				result.push('&amp;');
				break;
			default:
				result.push(ch);
		}
	}
	return result.join('');
}

function decodeEntities(value: string): string {
	return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
