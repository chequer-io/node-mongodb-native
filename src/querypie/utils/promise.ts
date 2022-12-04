/**
 * @Internal
 */
export const asRejected = <T>(promise: Promise<any>) => {
  return promise.then<T>(x => {
    throw x;
  });
};
