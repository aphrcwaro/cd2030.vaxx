import { app, BrowserWindow } from 'electron';
import net from 'node:net';
import { execa } from 'execa';
import { showCrashPage, showErrorPage, showLoadingPage } from './ui-utils';
import { resolvePortableR } from './r-utils';
import { assetPath } from './path-utils';

class RShinyManager {
    private rProc: any;
    private shuttingDown = false;
    private isStarting = false;

    public async startAndServe(window: BrowserWindow) {
        if (this.isStarting) return;
        this.isStarting = true;
        showLoadingPage(window);

        try {
            await this.teardown();
            const port = await this.getPort();
            await this.startRAndShinyProcess(window, port);
            await this.waitForShiny(port);
            await window.loadURL(`http://127.0.0.1:${port}`);
        } catch (err: any) {
            console.error('Failed to start Shiny:', err);
            showErrorPage(window, `Failed to start Shiny: ${err?.message ?? err}`);
        } finally {
            this.isStarting = false;
        }
    }

    public async teardown(): Promise<void> {
        this.shuttingDown = true;
        if (this.rProc && !this.rProc.killed) {
            console.log('Killing R process...');
            try {
                this.rProc.kill('SIGTERM');
                await this.rProc; // Wait for the process to exit
            } catch (e) {
                // Ignore exit errors on forced kill
                console.warn('Error during teardown:', e);
            }
        }
        this.rProc = undefined;
        this.shuttingDown = false;
    }

    private async getPort(): Promise<number> {
        return new Promise((resolve, reject) => {
            const s = net.createServer(sock => sock.end())
            s.on('error', reject)
            s.listen(0, '127.0.0.1', () => {
                const addr = s.address();
                s.close(() => typeof addr === 'object' && addr ? resolve(addr.port as number) : reject(new Error('no port')));
            });
        });
    }

    private async startRAndShinyProcess(window: BrowserWindow, port: number): Promise<void> {
        const r = resolvePortableR();
        const shinyDir = assetPath('shiny');
        const version = app.getVersion()
        const expr = `
            options(app.version='${version.replace(/'/g, "\\'")}')
            shiny::runApp('${this.toPosix(shinyDir)}', host='127.0.0.1', port=${port})
        `;

        const utf8Env = {
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US.UTF-8',
            LC_CTYPE: 'en_US.UTF-8',
            R_ENCODING: 'UTF-8',
        }

        this.rProc = execa(r.bin, ['--vanilla', '--silent', '-e', expr], {
            env: { ...process.env, ...r.env, ...utf8Env },
            windowsHide: true,
            reject: false,
            stdio: 'pipe'
        });

        this.rProc.stdout?.on('data', (b: Buffer) => { process.stdout.write(b.toString()); });
        this.rProc.stderr?.on('data', (b: Buffer) => { process.stderr.write(b.toString()); });

        this.rProc.on('error', (err: Error) => this.handleCrash(window, -1, err.message))
        this.rProc.on('exit', (code: number | null, sig: string | null) => {
            if (!this.shuttingDown && code !== 0) {
                console.error('R process exited unexpectedly.', { code, sig });
                this.handleCrash(window, code, sig);
            }
        });
    }

    private handleCrash(window: BrowserWindow, code: number | null, sig: string | null) {
         const msg = `R process crashed (code ${code}, signal ${sig ?? 'none'})`
        if (!this.isStarting && window && !window.isDestroyed()) {
            showCrashPage(window, msg);
        }
    }

    private async fetchWithTimeout(url: string, ms: number) {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), ms);
        try {
            return await fetch(url, { signal: ctl.signal });
        } finally {
            clearTimeout(t);
        }
    }

    private wait (ms: number): Promise<void> {
        return new Promise(r => setTimeout(r, ms));
    }

    private async waitForShiny(port: number) {
        const url = `http://127.0.0.1:${port}`;
        const start = Date.now();
        const deadline = 30000;
        let i = 0;
        while (Date.now() - start < deadline) {
            i++;
            try {
                const res = await this.fetchWithTimeout(url, 1500);
                if (res && res.ok) return;
            } catch {
                // Ignore fetch errors during retry
            }
            await this.wait(Math.min(250 * i, 1500));
        }
        throw new Error('Shiny did not respond within 30s');
    }

    private toPosix(p: string): string {
        return p.replace(/\\/g, '/');
    }
}

export const rShinyManager = new RShinyManager();
