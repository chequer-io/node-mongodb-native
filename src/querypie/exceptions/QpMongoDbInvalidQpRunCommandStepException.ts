import type { QpRunCommandStep } from '../models/QpRunCommandStep';
import { QpExceptionLevel } from './QpExceptionLevel';
import { QpMongoDbException } from './QpMongoDbException';

/**
 * @public
 */
export class QpMongoDbInvalidQpRunCommandStepException extends QpMongoDbException {
  constructor(expected: QpRunCommandStep, step: QpRunCommandStep) {
    super(QpExceptionLevel.INTERNAL, `Invalid Step: ${expected} expected, but got ${step}.`);
  }
}
