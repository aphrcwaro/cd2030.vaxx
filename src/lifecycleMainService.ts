import { app } from "electron";
import { Barrier, Promises } from "./async";
import { Disposable } from "./lifecycle-utils";
import { Emitter } from "./event";
import { isMacintosh } from "./platform";
import { StateService } from "./stateService";

export const enum ShutdownReason {

	/**
	 * The application exits normally.
	 */
	QUIT = 1,

	/**
	 * The application exits abnormally and is being
	 * killed with an exit code (e.g. from integration
	 * test run)
	 */
	KILL
}

export interface ShutdownEvent {

	/**
	 * More details why the application is shutting down.
	 */
	reason: ShutdownReason;

	/**
	 * Allows to join the shutdown. The promise can be a long running operation but it
	 * will block the application from closing.
	 */
	join(id: string, promise: Promise<void>): void;
}

export const enum LifecycleMainPhase {

	/**
	 * The first phase signals that we are about to startup.
	 */
	Starting = 1,

	/**
	 * Services are ready and first window is about to open.
	 */
	Ready = 2,

	/**
	 * This phase signals a point in time after the window has opened
	 * and is typically the best place to do work that is not required
	 * for the window to open.
	 */
	AfterWindowOpen = 3,

	/**
	 * The last phase after a window has opened and some time has passed
	 * (2-5 seconds).
	 */
	Eventually = 4
}


export class LifecycleMainService extends Disposable {

    static readonly QUIT_AND_RESTART_KEY = "quitAndRestart";

    private readonly _onBeforeShutdown = this._register(new Emitter<void>());
	readonly onBeforeShutdown = this._onBeforeShutdown.event;

    private readonly _onWillShutdown = this._register(new Emitter<ShutdownEvent>());
	readonly onWillShutdown = this._onWillShutdown.event;

    private _quitRequested = false;
	get quitRequested(): boolean { return this._quitRequested; }

    private _wasRestarted: boolean = false;
	get wasRestarted(): boolean { return this._wasRestarted; }

    private _phase = LifecycleMainPhase.Starting;
	get phase(): LifecycleMainPhase { return this._phase; }

    private windowCounter = 0;

    private pendingQuitPromise: Promise<boolean> | undefined = undefined;
	private pendingQuitPromiseResolve: { (veto: boolean): void } | undefined = undefined;

	private pendingWillShutdownPromise: Promise<void> | undefined = undefined;

    private readonly phaseWhen = new Map<LifecycleMainPhase, Barrier>();

    constructor(private readonly stateService: StateService) {
        super();
        void this.initializeState();
        this.when(LifecycleMainPhase.Ready).then(() => this.registerListeners());
    }

    private async initializeState(): Promise<void> {
        try {
            await this.stateService.initialize();
            this.resolveRestarted();
        } catch (error) {
            console.error('LifecycleMainService#initializeState', error);
        }
    }

    private resolveRestarted(): void {
        const restarted = this.stateService.getItem<boolean>(LifecycleMainService.QUIT_AND_RESTART_KEY, false);
        this._wasRestarted = !!restarted;

        if (this._wasRestarted) {
            this.stateService.removeItem(LifecycleMainService.QUIT_AND_RESTART_KEY);
        }
    }

    private registerListeners(): void {
        // before-quit: an event that is fired if application quit was
		// requested but before any window was closed.
        const beforeQuitListener = () => {
            if (this._quitRequested) return;

            this.trace('Lifecycle#app.on(before-quit)');
            this._quitRequested = true;

            // Emit event to indicate that we are about to shutdown
			this.trace('Lifecycle#onBeforeShutdown.fire()');
			this._onBeforeShutdown.fire();

            // macOS: can run without any window open. in that case we fire
			// the onWillShutdown() event directly because there is no veto
			// to be expected.
			if (isMacintosh && this.windowCounter === 0) {
				this.fireOnWillShutdown(ShutdownReason.QUIT);
			}
        };
        app.addListener('before-quit', beforeQuitListener);

        // window-all-closed: an event that only fires when the last window
		// was closed. We override this event to be in charge if app.quit()
		// should be called or not.
		const windowAllClosedListener = () => {
			this.trace('Lifecycle#app.on(window-all-closed)');

			// Windows/Linux: we quit when all windows have closed
			// Mac: we only quit when quit was requested
			if (this._quitRequested || !isMacintosh) {
				app.quit();
			}
		};
		app.addListener('window-all-closed', windowAllClosedListener);

        // will-quit: an event that is fired after all windows have been
		// closed, but before actually quitting.
		app.once('will-quit', e => {
			this.trace('Lifecycle#app.on(will-quit) - begin');

			// Prevent the quit until the shutdown promise was resolved
			e.preventDefault();

			// Start shutdown sequence
			const shutdownPromise = this.fireOnWillShutdown(ShutdownReason.QUIT);

			// Wait until shutdown is signaled to be complete
			shutdownPromise.finally(() => {
				this.trace('Lifecycle#app.on(will-quit) - after fireOnWillShutdown');

				// Resolve pending quit promise now without veto
				this.resolvePendingQuitPromise(false /* no veto */);

				// Quit again, this time do not prevent this, since our
				// will-quit listener is only installed "once". Also
				// remove any listener we have that is no longer needed

				app.removeListener('before-quit', beforeQuitListener);
				app.removeListener('window-all-closed', windowAllClosedListener);

				this.trace('Lifecycle#app.on(will-quit) - calling app.quit()');

				app.quit();
			});
		});
    }

    private resolvePendingQuitPromise(veto: boolean): void {
		if (this.pendingQuitPromiseResolve) {
			this.pendingQuitPromiseResolve(veto);
			this.pendingQuitPromiseResolve = undefined;
			this.pendingQuitPromise = undefined;
		}
	}

    private fireOnWillShutdown(reason: ShutdownReason): Promise<void> {
		if (this.pendingWillShutdownPromise) {
			return this.pendingWillShutdownPromise; // shutdown is already running
		}

		this.trace('Lifecycle#onWillShutdown.fire()');

		const joiners: Promise<void>[] = [];

		this._onWillShutdown.fire({
			reason,
			join(id, promise) {
				console.info(`Lifecycle#onWillShutdown - begin '${id}'`);
				joiners.push(promise.finally(() => {
					console.info(`Lifecycle#onWillShutdown - end '${id}'`);
				}));
			}
		});

		this.pendingWillShutdownPromise = (async () => {

			// Settle all shutdown event joiners
			try {
				await Promises.settled(joiners);
			} catch (error) {
				console.error(error);
			}

			// Then, always make sure at the end
			// the state service is flushed.
			try {
				await this.stateService.close();
			} catch (error) {
				console.error(error);
			}
		})();

		return this.pendingWillShutdownPromise;
	}

	set phase(value: LifecycleMainPhase) {
		if (value < this.phase) {
			throw new Error('Lifecycle cannot go backwards');
		}

		if (this._phase === value) {
			return;
		}

		this.trace(`lifecycle (main): phase changed (value: ${value})`);

		this._phase = value;

		const barrier = this.phaseWhen.get(this._phase);
		if (barrier) {
			barrier.open();
			this.phaseWhen.delete(this._phase);
		}
	}

    async when(phase: LifecycleMainPhase): Promise<void> {
		if (phase <= this._phase) {
			return;
		}

		let barrier = this.phaseWhen.get(phase);
		if (!barrier) {
			barrier = new Barrier();
			this.phaseWhen.set(phase, barrier);
		}

		await barrier.wait();
	}

    private trace(msg: string): void {
		console.info(msg);
	}
}
