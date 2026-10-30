export const REQUESTER_BINDINGS_VERSION = 1;
export const REQUESTER_BINDINGS = Object.freeze({
  'screen.accept': { arity: 1, args: ['string'], result: 'string' },
  'screen.display': { arity: 2, args: ['string', 'string'], result: 'integer' },
  'pathway.send': { arity: 3, args: ['string', 'string', 'integer'], result: 'string' },
});
