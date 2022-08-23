import { UUID } from 'bson';
import EventEmitter = require('events');
import { PromiseProvider } from '../promise_provider';
import type { CancellationToken } from '../mongo_types';

/** @public */
const QpNativePromise = global.Promise;
const kIsWatching = Symbol('IsWatching');

const isDebug = process.env.NODE_ENV === 'development';
const log = (() => {
  if (!isDebug) {
    return (..._: any[]) => {};
  }

  return (...args: any[]) => {
    console.log('<QpWatchPromise>', ...args);
  };
})();

/**
 * @public
 */
class QpWatchPromise<T> {
  private static _events: EventEmitter = new EventEmitter();
  private static _isWatching: boolean = false;
  private static _count: number = 0;

  public static watch(): void {
    if (QpWatchPromise.isWatching) throw new Error('Invalid operation: already watching');
    log('static watch');

    QpWatchPromise._isWatching = true;
    QpWatchPromise._count = 0;
    PromiseProvider.set(QpWatchPromise);
  }

  public static unwatch(): void {
    if (!QpWatchPromise.isWatching) throw new Error('Invalid operation: not watching currently');
    log('static unwatch');

    QpWatchPromise._isWatching = false;
    PromiseProvider.set(QpNativePromise);
  }

  public static get isWatching(): boolean {
    return QpWatchPromise._isWatching;
  }

  public static finallyAll(token: CancellationToken): Promise<any> {
    if (!QpWatchPromise.isWatching) return Promise.reject('Currently not watched');

    return new QpNativePromise<void>((resolve, reject) => {
      setTimeout(() => {
        if (QpWatchPromise._count === 0) return resolve();

        const onCancel = () => {
          this._events.off('finally', onFinally);
          token.off('cancel', onCancel);

          reject('Operation canceled');
        };

        const onFinally = () => {
          if (QpWatchPromise._count > 0) return;

          this._events.off('finally', onFinally);
          token.off('cancel', onCancel);

          resolve();
        };

        token.once('cancel', onCancel);
        this._events.on('finally', onFinally);
      }, 0);
    });
  }

  private _native: Promise<T>;
  private [kIsWatching]: boolean = false;

  private _id: string;
  private _code?: string = undefined;

  public constructor(
    executor:
      | Promise<T>
      | ((resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void)
  ) {
    this._id = new UUID().toHexString();

    if (typeof executor === 'function') {
      this._native = new QpNativePromise(executor);
    } else {
      this._native = executor;
    }

    if (isDebug) {
      this._code = executor.toString();
      this.log('Created', this._code);
    }

    if (QpWatchPromise.isWatching) {
      this.watch();
    }
  }

  public watch() {
    if (this[kIsWatching]) return;

    this.log('watch');

    this[kIsWatching] = true;
    QpWatchPromise._count++;

    this._native
      .finally(() => {})
      .finally(() => {
        this.unwatch();
        QpWatchPromise._events.emit('finally');
      });
  }

  public unwatch() {
    if (!this[kIsWatching]) return;

    this.log('unwatch');

    this[kIsWatching] = false;
    QpWatchPromise._count--;
  }

  //#region Wrapper
  public readonly [Symbol.toStringTag]: string = 'QpWatchPromise';

  public then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2>;
  public then(...args: any[]): Promise<any> {
    this.log('then');

    this.unwatch();
    return new QpWatchPromise(this._native.then(...args));
  }
  public catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
  ): Promise<T | TResult>;
  public catch(...args: any[]): Promise<any> {
    this.log('catch');

    this.unwatch();
    return new QpWatchPromise(this._native.catch(...args));
  }

  public finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  public finally(...args: any[]): Promise<any> {
    this.log('finally');

    this.unwatch();
    return new QpWatchPromise(this._native.finally(...args));
  }
  //#endregion

  //#region Static Wrapper
  public static readonly [Symbol.species]: PromiseConstructor = QpNativePromise;

  public static reject<T = never>(reason?: any): Promise<T>;
  public static reject(reason?: any): Promise<any> {
    log('static reject');

    return new QpWatchPromise<any>(QpNativePromise.reject(reason));
  }

  public static resolve(): Promise<void>;
  public static resolve<T>(value: T | PromiseLike<T>): Promise<T>;
  public static resolve(value?: any): Promise<any> {
    log('static resolve');

    return new QpWatchPromise<any>(QpNativePromise.resolve(value));
  }

  public static all<T extends readonly unknown[] | []>(
    values: T
  ): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }>;
  public static all<T>(values: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>[]>;
  public static all(values: any): Promise<any> {
    log('static all');

    const natives = QpWatchPromise.unwatchAndGetNativeAll(values);
    return new QpWatchPromise<any>(QpNativePromise.all(natives));
  }

  public static race<T>(values: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>>;
  public static race<T extends readonly unknown[] | []>(values: T): Promise<Awaited<T[number]>>;
  public static race(values: any): Promise<any> {
    log('static race');

    const natives = QpWatchPromise.unwatchAndGetNativeAll(values);
    return new QpWatchPromise<any>(QpNativePromise.race(natives));
  }

  public static allSettled<T extends readonly unknown[] | []>(
    values: T
  ): Promise<{ -readonly [P in keyof T]: PromiseSettledResult<Awaited<T[P]>> }>;
  public static allSettled<T>(
    values: Iterable<T | PromiseLike<T>>
  ): Promise<PromiseSettledResult<Awaited<T>>[]>;
  public static allSettled(values: any): Promise<any> {
    log('static allSettled');

    const natives = QpWatchPromise.unwatchAndGetNativeAll(values);
    return new QpWatchPromise<any>(QpNativePromise.allSettled(natives));
  }
  //#endregion

  private static unwatchAndGetNativeAll(values: any) {
    const natives = values.map((value: any) => {
      if (value[kIsWatching] === undefined) return value;

      value.unwatch();

      return value;
    });

    return natives;
  }

  private log(...args: any[]) {
    log(this._id, ...args);
  }
}

export { QpWatchPromise, QpNativePromise };
