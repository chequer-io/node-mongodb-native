import type { QpRunCommandStep } from '../models/QpRunCommandStep';
import { QpException } from './QpException';
import { QpExceptionLevel } from './QpExceptionLevel';

/**
 * @public
 */
export class QpInvalidQpRunCommandStepException extends QpException {
  constructor(expected: QpRunCommandStep, step: QpRunCommandStep) {
    super(QpExceptionLevel.INTERNAL, `Invalid Step: ${expected} expected, but got ${step}.`);
  }
}
