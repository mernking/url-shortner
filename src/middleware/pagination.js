/**
 * Pagination middleware for limit-offset pagination
 * Adds pagination parameters to req.query with validation
 * @param {number} maxLimit - Maximum allowed limit (default: 20)
 */
const paginationMiddleware = (maxLimit = 20) => {
  return (req, res, next) => {
    let { limit, offset } = req.query;

    // Parse and validate limit
    limit = parseInt(limit, 10);
    if (isNaN(limit) || limit <= 0) {
      limit = 10; // default limit
    } else if (limit > maxLimit) {
      limit = maxLimit;
    }

    // Parse and validate offset
    offset = parseInt(offset, 10);
    if (isNaN(offset) || offset < 0) {
      offset = 0; // default offset
    }

    // Add pagination info to req.query
    req.query.limit = limit;
    req.query.offset = offset;

    next();
  };
};

module.exports = paginationMiddleware;