'use strict';

const { migrateDB } = require('./app');
const { importStatement, exportStatement } = require('./app');

/*
 * Migrate database tables
 */

module.exports.migrateDB = (event, context, callback) => {
  // run database migrations with force param
  migrateDB(true)
    .then(response => {
      callback(null, { statusCode: 200, body: JSON.stringify(response) });
    })
    .catch(err => {
      callback(null, { statusCode: 500, body: JSON.stringify(err) });
    });
};

/*
 * Import monthly statements
 */

module.exports.importStatement = (event, context, callback) => {
  // set parameters
  const account = event.pathParameters.account;
  const date = event.pathParameters.date;
  // import statement
  importStatement(account, date)
    .then(response => {
      callback(null, { statusCode: 200, body: JSON.stringify(response) });
    })
    .catch(err => {
      callback(null, { statusCode: 500, body: JSON.stringify(err) });
    });
};

/*
 * Export monthly statements
 */

module.exports.exportStatement = (event, context, callback) => {
  // set parameters
  const account = event.pathParameters.account;
  const date = event.pathParameters.date;
  // export statement
  exportStatement(account, date)
    .then(response => {
      callback(null, { statusCode: 200, body: JSON.stringify(response) });
    })
    .catch(err => {
      callback(null, { statusCode: 500, body: JSON.stringify(err) });
    });
};
