class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (msg, details) => new HttpError(400, 'bad_request', msg, details);
const unauthorized = (msg = 'Log in to continue.') => new HttpError(401, 'unauthorized', msg);
const forbidden = (msg = 'You do not have access to this.') => new HttpError(403, 'forbidden', msg);
const notFound = (what = 'Item') => new HttpError(404, 'not_found', `${what} not found.`);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound };
