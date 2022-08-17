import EventEmitter = require('events');
import type { CancellationToken } from '../mongo_types';
import { PromiseProvider } from '../promise_provider';

/** @public */
const QpNativePromise = global.Promise;
const kIsWatching = Symbol('IsWatching');

const newId = (() => {
  let id = 0;
  return () => {
    return ++id;
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
    console.log('QpWatchPromise', 'static watch');

    QpWatchPromise._isWatching = true;
    QpWatchPromise._count = 0;
    PromiseProvider.set(QpWatchPromise);
  }

  public static unwatch(): void {
    if (!QpWatchPromise.isWatching) throw new Error('Invalid operation: not watching currently');
    console.log('QpWatchPromise', 'static unwatch');

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

  private __id: number;
  private __code: string | undefined = undefined;
  private __stack: string | undefined = undefined;

  public constructor(
    executor:
      | Promise<T>
      | ((resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void)
  ) {
    this.__id = newId();
    this.__code = executor.toString();
    this.__stack = new Error().stack;

    if (typeof executor === 'function') {
      this._native = new QpNativePromise(executor);
    } else {
      this._native = executor;
    }

    if (QpWatchPromise.isWatching) {
      this.watch();
    }
  }

  public watch() {
    if (this[kIsWatching]) return;
    this[kIsWatching] = true;
    QpWatchPromise._count++;
    console.log('QpWatchPromise', 'watch', this.__id, this.__code, this.__stack);

    this._native
      .finally(() => {})
      .finally(() => {
        this.unwatch();
        QpWatchPromise._events.emit('finally');
      });
  }

  public unwatch() {
    if (!this[kIsWatching]) return;
    console.log('QpWatchPromise', 'unwatch', this.__id);
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
    this.unwatch();

    return new QpWatchPromise(this._native.then(...args));
  }
  public catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
  ): Promise<T | TResult>;
  public catch(...args: any[]): Promise<any> {
    this.unwatch();

    return new QpWatchPromise(this._native.catch(...args));
  }

  public finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  public finally(...args: any[]): Promise<any> {
    this.unwatch();

    return new QpWatchPromise(this._native.finally(...args));
  }
  //#endregion

  //#region Static Wrapper
  public static readonly [Symbol.species]: PromiseConstructor = QpNativePromise;

  public static reject<T = never>(reason?: any): Promise<T>;
  public static reject(reason?: any): Promise<any> {
    return new QpWatchPromise<any>(QpNativePromise.reject(reason));
  }

  public static resolve(): Promise<void>;
  public static resolve<T>(value: T | PromiseLike<T>): Promise<T>;
  public static resolve(value?: any): Promise<any> {
    return new QpWatchPromise<any>(QpNativePromise.resolve(value));
  }

  public static all<T extends readonly unknown[] | []>(
    values: T
  ): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }>;
  public static all<T>(values: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>[]>;
  public static all(values: any): Promise<any> {
    const natives = values.map((value: any) => {
      if (value[kIsWatching] === undefined) return value;

      value.unwatch();

      return value._native;
    });

    return new QpWatchPromise<any>(QpNativePromise.all(natives));
  }

  public static race<T>(values: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>>;
  public static race<T extends readonly unknown[] | []>(values: T): Promise<Awaited<T[number]>>;
  public static race(values: any): Promise<any> {
    const natives = values.map((value: any) => {
      if (value[kIsWatching] === undefined) return value;

      value.unwatch();

      return value._native;
    });

    return new QpWatchPromise<any>(QpNativePromise.race(natives));
  }

  public static allSettled<T extends readonly unknown[] | []>(
    values: T
  ): Promise<{ -readonly [P in keyof T]: PromiseSettledResult<Awaited<T[P]>> }>;
  public static allSettled<T>(
    values: Iterable<T | PromiseLike<T>>
  ): Promise<PromiseSettledResult<Awaited<T>>[]>;
  public static allSettled(values: any): Promise<any> {
    const natives = values.map((value: any) => {
      if (value[kIsWatching] === undefined) return value;

      value.unwatch();

      return value._native;
    });

    return new QpWatchPromise<any>(QpNativePromise.allSettled(natives));
  }
  //#endregion
}

export { QpWatchPromise, QpNativePromise };
