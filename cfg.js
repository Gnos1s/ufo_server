// configuration

module.exports = {
  START_B1: 100000,
  MAX_WORK_TO_GET: 50000,    // limit to prevent DoS via large get requests
  MIN_BIT_LENGTH: 3456,      // 3456 == 3840 * 0.90
  ACTIVE_UFOS: 13,
};
