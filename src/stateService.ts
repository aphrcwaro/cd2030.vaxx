import { app } from 'electron';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { ThrottledDelayer } from './async';
import { Disposable } from './lifecycle-utils';

type StorageDatabase = Record<string, unknown>;

const isUndefined = (value: unknown): value is undefined => typeof value === 'undefined';
const isUndefinedOrNull = (value: unknown): value is undefined | null => value === undefined || value === null;

export const enum SaveStrategy {
	IMMEDIATE,
	DELAYED
}

interface FileStorageOptions {
	readonly storagePath: string;
	readonly saveStrategy: SaveStrategy;
}

class FileStorage extends Disposable {

	private storage: StorageDatabase = Object.create(null);
	private lastSavedStorageContents = '';

	private readonly flushDelayer: ThrottledDelayer<void>;

	private initializing: Promise<void> | undefined;
	private closing: Promise<void> | undefined;

	private readonly storagePath: string;

	constructor(options: FileStorageOptions) {
		super();

		this.storagePath = options.storagePath;
		this.flushDelayer = this._register(new ThrottledDelayer<void>(options.saveStrategy === SaveStrategy.IMMEDIATE ? 0 : 100));
	}

	async init(): Promise<void> {
		if (!this.initializing) {
			this.initializing = this.doInit();
		}

		return this.initializing;
	}

	private async doInit(): Promise<void> {
		try {
			const raw = await fs.readFile(this.storagePath, 'utf8');
			this.lastSavedStorageContents = raw;
			this.storage = JSON.parse(raw);
		} catch (error: unknown) {
			const err = error as NodeJS.ErrnoException;
			if (err?.code !== 'ENOENT') {
				console.error('FileStorage#init', error)
			}

			this.storage = Object.create(null);
			this.lastSavedStorageContents = '';
		}
	}

	getItem<T>(key: string, defaultValue: T): T;
	getItem<T>(key: string, defaultValue?: T): T | undefined;
	getItem<T>(key: string, defaultValue?: T): T | undefined {
		const value = this.storage[key];
		if (isUndefinedOrNull(value)) {
			return defaultValue;
		}

		return value as T;
	}

	setItem(key: string, data?: object | string | number | boolean | undefined | null): void {
		this.setItems([{ key, data }]);
	}

	setItems(items: readonly { key: string; data?: object | string | number | boolean | undefined | null }[]): void {
		let save = false;

		for (const { key, data } of items) {

			if (this.storage[key] === data) {
				continue;
			}

			if (isUndefinedOrNull(data)) {
				if (!isUndefined(this.storage[key])) {
					this.storage[key] = undefined;
					save = true;
				}
			} else {
				this.storage[key] = data;
				save = true;
			}
		}

		if (save) {
			void this.save();
		}
	}

	removeItem(key: string): void {
		if (!isUndefined(this.storage[key])) {
			this.storage[key] = undefined;
			void this.save();
		}
	}

	private save(): Promise<void> {
		if (this.closing) {
			return Promise.resolve();
		}

		return this.flushDelayer.trigger(() => this.doSave());
	}

	private async doSave(): Promise<void> {
		if (!this.initializing) {
			return;
		}

		await this.initializing;

		const serialized = JSON.stringify(this.storage, null, 4);
		if (serialized === this.lastSavedStorageContents) {
			return;
		}

		try {
			await fs.mkdir(dirname(this.storagePath), { recursive: true });
			const tempPath = `${this.storagePath}.tmp`;
			await fs.writeFile(tempPath, serialized, 'utf8');
			await fs.rename(tempPath, this.storagePath);
			this.lastSavedStorageContents = serialized;
		} catch (error) {
			console.error('FileStorage#doSave', error);
		}
	}

	async close(): Promise<void> {
		if (!this.closing) {
			this.closing = this.flushDelayer.trigger(() => this.doSave(), 0);
		}

		await this.closing;
	}
}

export interface StateServiceOptions {
	readonly storageName?: string;
	readonly storagePath?: string;
	readonly saveStrategy?: SaveStrategy;
}

export class StateReadonlyService extends Disposable {

	protected readonly fileStorage: FileStorage;

	constructor(options: StateServiceOptions = {}) {
		super();

		const storageFileName = options.storageName ?? 'global-state.json';
		const storagePath = options.storagePath ?? join(app.getPath('userData'), storageFileName);
		const saveStrategy = options.saveStrategy ?? SaveStrategy.DELAYED;

		this.fileStorage = this._register(new FileStorage({
			storagePath,
			saveStrategy
		}));
	}

	async init(): Promise<void> {
		await this.fileStorage.init();
	}

	async initialize(): Promise<void> {
		await this.init();
	}

	getItem<T>(key: string, defaultValue: T): T;
	getItem<T>(key: string, defaultValue?: T): T | undefined;
	getItem<T>(key: string, defaultValue?: T): T | undefined {
		return this.fileStorage.getItem(key, defaultValue);
	}
}

export class StateService extends StateReadonlyService {

	setItem(key: string, data?: object | string | number | boolean | undefined | null): void {
		this.fileStorage.setItem(key, data);
	}

	setItems(items: readonly { key: string; data?: object | string | number | boolean | undefined | null }[]): void {
		this.fileStorage.setItems(items);
	}

	removeItem(key: string): void {
		this.fileStorage.removeItem(key);
	}

	async close(): Promise<void> {
		await this.fileStorage.close();
	}
}
