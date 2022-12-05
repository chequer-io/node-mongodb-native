import type { Document } from 'bson';
import { UUID } from 'bson';

import { CancellationToken, TypedEventEmitter } from '../../../mongo_types';
import { QpInvalidQpRunCommandStepException } from '../../exceptions/QpInvalidQpRunCommandStepException';
import { QpLogger } from '../../loggers/QpLogger';
import { QpRunCommandStep } from '../../models/QpRunCommandStep';
import { QpRunCommandManager } from '../../QpRunCommandManager';
import { waitEvent } from '../../utils/events-promise';
import { asRejected } from '../../utils/promise';
import type { IQpRunCommandContext } from './IQpRunCommandContext';

type QpRunCommandContextEvents = {
  'resume:pre': () => void;
  'resume:post': () => void;
  'resume:exception': () => void;
  'resume:complete': () => void;
  'cancel:abort': (message: string) => void;
};

/**
 * @public
 */
export class QpRunCommandContext implements IQpRunCommandContext {
  private readonly _id: string;

  private _command: Document;

  private _result: Document | undefined = undefined;
  private _exception: any | undefined = undefined;

  private _step: QpRunCommandStep = QpRunCommandStep.NONE;

  private _events = new TypedEventEmitter<QpRunCommandContextEvents>();

  public constructor(command: Document) {
    this._id = new UUID().toHexString();
    this._command = command;
  }

  public get Id(): string {
    return this._id;
  }

  public get Command(): Document {
    return this._command;
  }

  public set Command(command: Document) {
    this._command = command;
  }

  public get Result(): Document | undefined {
    return this._result;
  }

  public set Result(result: Document | undefined) {
    if (!result) return;

    this._result = result;
  }

  public get Exception(): any {
    return this._exception;
  }

  public get Step(): QpRunCommandStep {
    return this._step;
  }

  public async RaisePre(): Promise<void> {
    this._VerifyState(QpRunCommandStep.NONE);

    this._step = QpRunCommandStep.PRE;

    await this._WaitResumeOrAbort('resume:pre');
  }

  public async RaisePost(originalResult: Document | undefined): Promise<void> {
    this._VerifyState(QpRunCommandStep.NONE);

    this._step = QpRunCommandStep.POST;
    this._result = originalResult;

    await this._WaitResumeOrAbort('resume:post');
  }

  public async RaiseException(exception: any): Promise<void> {
    this._VerifyState(QpRunCommandStep.NONE);

    this._step = QpRunCommandStep.EXCEPTION;
    this._exception = exception;

    await this._WaitResumeOrAbort('resume:exception');
  }

  public async RaiseComplete(): Promise<void> {
    this._VerifyState(QpRunCommandStep.NONE);

    this._step = QpRunCommandStep.COMPLETE;

    await this._WaitResumeOrAbort('resume:complete');
  }

  public ResumePre(): void {
    this._VerifyState(QpRunCommandStep.PRE);

    this._Resume('resume:pre');
  }

  public ResumePost(updatedResult: Document | undefined): void {
    this._VerifyState(QpRunCommandStep.POST);

    if (updatedResult) {
      this._result = updatedResult;
    }

    this._Resume('resume:post');
  }

  public ResumeException(): void {
    this._VerifyState(QpRunCommandStep.EXCEPTION);
    this._Resume('resume:exception');
  }

  public ResumeComplete(): void {
    this._VerifyState(QpRunCommandStep.COMPLETE);
    this._Resume('resume:complete');
  }

  public Abort(message: string): void {
    this._events.emit('cancel:abort', message);
  }

  private async _WaitResumeOrAbort(
    resumeEvent: keyof QpRunCommandContextEvents & `resume:${string}`
  ): Promise<void> {
    QpRunCommandManager.Push(this);

    const cancellationToken = new CancellationToken();

    try {
      await Promise.race([
        waitEvent(this._events, resumeEvent, cancellationToken),
        asRejected<Document | undefined>(waitEvent(this._events, 'cancel:abort', cancellationToken))
      ]);
    } finally {
      cancellationToken.emit('cancel');
    }
  }

  private _Resume(resumeEvent: keyof QpRunCommandContextEvents & `resume:${string}`): void {
    this._step = QpRunCommandStep.NONE;

    this._events.emit(resumeEvent);
  }

  private _VerifyState(expected: QpRunCommandStep): void {
    if (this._step === expected) return;

    QpLogger.Global.Error(`Invalid Step: ${expected} expected, but got ${this._step}.`);

    throw new QpInvalidQpRunCommandStepException(expected, this._step);
  }
}
