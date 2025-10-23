import { app, BrowserWindow, powerMonitor, powerSaveBlocker } from 'electron';
import net from 'node:net';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { execa, ResultPromise, ExecaError } from 'execa';

import { showCrashPage, showErrorPage, showLoadingPage } from './ui-utils.js';
import { resolvePortableR } from './r-utils.js';
import { assetPath } from './path-utils.js';

// Configuration interface
interface ShinyConfig {
    appPath: string; // Path to the R Shiny app directory
    checkIntervalMs: number; // How often to check for unresponsiveness (Heartbeat)
    maxWaitMs: number; // Max time to wait for Shiny startup
    healthCheckTimeoutMs: number; // Max time for a single HTTP ping
    failureThresholdNormal: number; // Max failures before restart (normal)
    failureThresholdSuspended: number; // Max failures before restart (suspended)
}

// New: Custom error for process management
class ProcessError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ProcessError';
        Object.setPrototypeOf(this, ProcessError.prototype);
    }
}

// Custom events/listener map for RShinyManager for type safety
interface RShinyManagerEvents {
    'started': (port: number) => void;
    'restarting': (reason: string) => void;
    'crashed': (code: number | null, signal: string | null) => void;
    'stopped': () => void;
    'status': (status: 'loading' | 'running' | 'error') => void;
}

// Default configuration (if you don't pass one in, though passing it is better)
const DEFAULT_CONFIG: ShinyConfig = {
    appPath: assetPath('shiny'),
    checkIntervalMs: 5000,
    maxWaitMs: 60000,
    healthCheckTimeoutMs: 1500,
    failureThresholdNormal: 3,
    failureThresholdSuspended: 1,
};

type ExecaProcessType = ChildProcess & ResultPromise;

// ------------------------------------
//  RShinyManager Class
// ------------------------------------

class RShinyManager extends EventEmitter {

    // Redefine 'on' and 'emit' for type safety
    override on<T extends keyof RShinyManagerEvents>(event: T, listener: RShinyManagerEvents[T]): this {
        return super.on(event, listener);
    }
    override emit<T extends keyof RShinyManagerEvents>(event: T, ...args: Parameters<RShinyManagerEvents[T]>): boolean {
        return super.emit(event, ...args);
    }

    private config: ShinyConfig;
    private rProc: ExecaProcessType | undefined;

    private abortController: AbortController | undefined;
    private shuttingDown = false;
    private isStarting = false;
    private currentPort?: number;
    private heartbeat?: Timeout;
    private healthCheckRunning = false;
    private lastReloadAt = 0;
    private failures = 0;
    private suspended = false;
    private blockerId: number | null = null;

    constructor(config?: Partial<ShinyConfig>) {
        super();
        // Use spread operator for merging config
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // ------------------------------------
    //  Public Control (Start, Teardown, Restart)
    // ------------------------------------

    public async startAndServe(window: BrowserWindow) {
        if (this.isStarting || this.rProc) return;
        this.isStarting = true;

        this.emit('status', 'loading');
        showLoadingPage(window);

        try {
            // Check if app is already running and healthy
            if (await this.isAppRunningAndHealthy()) {
                await window.loadURL(this.getAppUrl());
                this.emit('started', this.currentPort!);
                this.startHeartbeat(window)
                return
            }

            await this.teardown(false);
            const port = await this.getPort();
            this.currentPort = port;

            console.log(`Starting Shiny app at ${this.config.appPath} on port ${port}...`);

            // Refactored: Removed unused 'window' argument
            await this.startRAndShinyProcess();

            await this.waitForShiny();
            await window.loadURL(this.getAppUrl());

            this.emit('started', port);
            this.emit('status', 'running');

            this.startHeartbeat(window);
            this.monitorRProcess(window);

            this.preventSleep(true);
        } catch (err: any) {
            const message = err instanceof ExecaError ? err.stderr || err.message : err?.message ?? err;
            console.error('Failed to start Shiny:', err);

            this.emit('status', 'error');
            showErrorPage(window, `Failed to start Shiny: ${message}`);
        } finally {
            this.isStarting = false;
            this.suspended = false;
        }
    }

    public async teardown(emitEvent: boolean = true): Promise<void> {
        this.shuttingDown = true;
        this.stopHeartbeat();

        this.preventSleep(false);

        // Cleanup: Simplified check
        if (this.rProc) {
            console.log(`Killing R process (PID: ${this.rProc.pid})...`);

            try {
                if (this.abortController) {
                    this.abortController.abort();
                } else {
                    this.rProc.kill("SIGTERM");
                }
                // Wait for the process to exit after sending the signal
                await this.rProc;
            } catch (e) {
                // Ignore the AbortError/CancelError which is expected during teardown
                const error = e as ExecaError;
                if (!error.isCanceled && !(e instanceof Error && e.name === 'AbortError')) {
                    console.warn('Error during teardown:', e);
                }
            }
        }

        this.rProc = undefined;
        this.abortController = undefined;
        this.currentPort = undefined;
        this.failures = 0;
        this.shuttingDown = false;

        if (emitEvent) this.emit('stopped');
    }

    public restart(window: BrowserWindow): void {
        console.log('--- Process Manager: Attempting Restart ---');
        this.teardown(true)
            .then(() => {
                setTimeout(() => this.startAndServe(window), 500);
            })
            .catch(err => console.error('Restart failed during teardown:', err));
    }

    // ------------------------------------
    //  Process Execution
    // ------------------------------------

    // Refactored: Removed unused 'window' argument
    private async startRAndShinyProcess(): Promise<void> {
        const r = resolvePortableR();

        const version = app.getVersion()

        const expr = `
            options(app.version='${version.replace(/'/g, "\\'")}')
            dir <- tempfile('healthz'); dir.create(dir)
            writeLines('pong', file.path(dir, 'ping.txt'))
            shiny::addResourcePath('healthz', dir)
            shiny::runApp('${this.toPosix(this.config.appPath)}', host='127.0.0.1', port=${this.currentPort})
        `.trim();

        const utf8Env = {
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US.UTF-8',
            LC_CTYPE: 'en_US.UTF-8',
            R_ENCODING: 'UTF-8',
        }

        // 1. Initialize AbortController
        this.abortController = new AbortController();

        // 2. Pass the signal to execa() for cancellation
        this.rProc = execa(r.bin, ['--vanilla', '--silent', '-e', expr], {
            env: { ...process.env, ...r.env, ...utf8Env },
            windowsHide: true,
            reject: false,
            stdio: 'pipe',
            cancelSignal: this.abortController.signal // Cancellation signal
        }) as ExecaProcessType;

        this.rProc.stdout?.on('data', (b: Buffer) => { process.stdout.write(b.toString()); });
        this.rProc.stderr?.on('data', (b: Buffer) => { process.stderr.write(b.toString()); });
    }

    private monitorRProcess(window: BrowserWindow): void {
        this.rProc?.then(result => {
            console.log(`R process finished gracefully. Output: ${result.stdout}`);
        }).catch((error: ExecaError) => {
            // Check for both the old isCanceled flag and the new AbortError style
            if (!this.shuttingDown && !error.isCanceled && error.exitCode !== 0) {
                // This block handles actual crashes, not clean cancellations
                this.handleCrash(window, error.exitCode!, error.signal!);
            }
        }).finally(() => {
            this.rProc = undefined;
            this.stopHeartbeat();
        });
    }

    // ------------------------------------
    //  Heartbeat & Health Check
    // ------------------------------------

    private async isAppRunningAndHealthy(): Promise<boolean> {
        return !!this.rProc && (await this.tryPing());
    }

    private stopHeartbeat() {
        if (this.heartbeat) clearInterval(this.heartbeat);
        this.heartbeat = undefined;
    }

    private startHeartbeat(window: BrowserWindow) {
        this.stopHeartbeat();
        this.heartbeat = setInterval(() => this.ensureHealthy(window), this.config.checkIntervalMs);
    }

    private async ensureHealthy(window: BrowserWindow) {
        if (this.isStarting || this.shuttingDown || this.healthCheckRunning) return;
        this.healthCheckRunning = true;

        const port = this.currentPort;
        if (!port) {
            this.healthCheckRunning = false;
            return;
        }

        // if resuming from sleep, force the first check to restart on failure
        if (await this.isAppRunningAndHealthy()) {
            this.failures = 0;
            this.suspended = false;
            this.healthCheckRunning = false;
            return;
        }

        this.failures += 1;
        const threshold = this.suspended ? this.config.failureThresholdSuspended : this.config.failureThresholdNormal;
        if (this.failures >= threshold) {
            const isAlive = !!this.rProc;

            if (!isAlive) {
                this.emit('restarting', 'R process dead/unresponsive');
                this.failures = 0;
                await this.startAndServe(window);
            } else {
                const now = Date.now();
                // R is alive but socket stalled: reload renderer only
                if (!window.isDestroyed() && now - this.lastReloadAt > 10000) {
                    window.webContents.reloadIgnoringCache();
                    this.lastReloadAt = now;
                }
                this.failures = 0
            }
        }

        this.healthCheckRunning = false;
    }

    private async tryPing(): Promise<boolean> {
        try {
            // FIX: Removed extra '}' at the end of the URL
            const url = `${this.getAppUrl()}/healthz/ping.txt`;
            const res = await this.fetchWithTimeout(url, this.config.healthCheckTimeoutMs);
            return !!res && res.ok
        } catch {
            return false;
        }
    }

    private async fetchWithTimeout(url: string, ms: number) {
        const signal = AbortSignal.timeout(ms);;
        try {
            return await fetch(url, { signal, cache: 'no-store' as RequestCache });
        } catch (e) {
            throw e;
        }
    }

    // ------------------------------------
    //  Utilities and Helpers
    // ------------------------------------

    /**
     * @summary Abstraction for the base Shiny app URL.
     * @returns The full base URL string.
     */
    private getAppUrl(): string {
        const port = this.currentPort;
        if (!port) {
            throw new Error("Cannot get app URL: currentPort is not set.");
        }
        return `http://127.0.0.1:${port}`;
    }

    public bindPowerEvents(window: BrowserWindow) {
        powerMonitor.on('suspend', () => {
            console.log('System is going to sleep');
            this.suspended = true;
            this.stopHeartbeat();
        });

        powerMonitor.on('resume', async () => {
            console.log('System has resumed from sleep');
            setTimeout(async () => {
                if (!await this.isAppRunningAndHealthy()) {
                    console.log('R process is not alive after resume, starting new one.');
                    await this.startAndServe(window);
                } else {
                    console.log('R process is still alive, reloading the window and resuming heartbeat.');
                    if (!window.isDestroyed()) window.webContents.reloadIgnoringCache();
                    this.startHeartbeat(window);
                }
            }, 1500);
        });
    }

    private async getPort(): Promise<number> {
        return new Promise((resolve, reject) => {
            const s = net.createServer(sock => sock.end())
            s.on('error', reject)
            s.listen(0, '127.0.0.1', () => {
                const addr = s.address();
                s.close(() => typeof addr === 'object' && addr ? resolve(addr.port as number) : reject(new ProcessError('no port available')));
            });
        });
    }

    private handleCrash(window: BrowserWindow, code: number | null, sig: string | null) {
        const msg = `R process crashed (code ${code}, signal ${sig ?? 'none'})`

        this.emit('crashed', code, sig);
        this.emit('status', 'error');

        if (!this.isStarting && window && !window.isDestroyed()) {
            showCrashPage(window, msg);
        }

        this.teardown(true).catch(e => console.error("Teardown error after crash:", e));
    }

    private wait(ms: number): Promise<void> {
        return new Promise(r => setTimeout(r, ms));
    }

    private async waitForShiny() {
        const url = this.getAppUrl();
        const start = Date.now();
        const deadline = this.config.maxWaitMs; // Use config property instead of hardcoded 60000
        let i = 0;
        while (Date.now() - start < deadline) {
            i++;
            try {
                const res = await this.fetchWithTimeout(url, this.config.healthCheckTimeoutMs); // Use config property
                if (res && res.ok) return;
            } catch {
                // Ignore fetch errors during retry
            }
            await this.wait(Math.min(250 * i, 1500));
        }
        throw new ProcessError(`Shiny did not respond within ${this.config.maxWaitMs / 1000}s`);
    }

    private preventSleep(on: boolean) {
        if (on && this.blockerId == null) this.blockerId = powerSaveBlocker.start('prevent-app-suspension')
        if (!on && this.blockerId != null) { powerSaveBlocker.stop(this.blockerId); this.blockerId = null }
    }

    private toPosix(p: string): string {
        return p.replace(/\\/g, '/');
    }
}

export const rShinyManager = new RShinyManager();
