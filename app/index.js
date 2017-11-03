'use strict';

const fs = require('fs');

const { initDB, closeDB } = require('./helpers-database');
const { migrateDB, getModels, operators } = require('./helpers-database');
const { createUpdateByPK, createUpdateWhere } = require('./helpers-database');

const { transactionSeeds } = require('./helpers-database-seeds');
const { tagSeeds, tagDescriptionSeeds } = require('./helpers-database-seeds');
const { expandedTransactionSeeds } = require('./helpers-database-seeds');

/*
 * Migrate database tables
 */

module.exports.migrateDB = force => {
  return new Promise((resolve, reject) => {
    // initialise database connection with logging param
    const sequelize = initDB(false);
    // run database migrations with force param
    migrateDB(sequelize, force)
      .then(response => {
        if (response.status == 'error') return reject(response);
        return seedTransactions(response.models, {});
      })
      .then(response => {
        if (response.status == 'error') return reject(response);
        return seedTags(response.models, response.seeds);
      })
      .then(response => {
        if (response.status == 'error') return reject(response);
        return seedTagDescriptions(response.models, response.seeds);
      })
      .then(response => {
        if (response.status == 'error') return reject(response);
        return seedExpandedTransactions(response.models, response.seeds);
      })
      .then(response => {
        if (response.status == 'error') return reject(response);
        closeDB(sequelize);
        return resolve({
          migrations: Object.keys(response.models),
          seeds: response.seeds,
        });
      })
      .catch(err => {
        closeDB(sequelize);
        return reject(err);
      });
  });
};

/*
 * Seed transactions
 */

const seedTransactions = (models, seeds) => {
  return new Promise((resolve, reject) => {
    parseTransactionSeeds(models)
      .then(response => {
        if (response.status == 'error') return reject(response);
        seeds.transactions = response;
        return resolve({ models: models, seeds: seeds });
      })
      .catch(err => {
        return reject({ status: 'error', error: err });
      });
  });
};

const parseTransactionSeeds = models => {
  return Promise.all(
    Object.keys(transactionSeeds).map(account => {
      return importTransactionSeeds(models, account);
    })
  );
};

const importTransactionSeeds = (models, account) => {
  return new Promise((resolve, reject) => {
    loadTransactionSeeds(models, account)
      .then(response => {
        if (response.status == 'error') return Promise.reject(response);
        return resolve({ account: account, statements: response });
      })
      .catch(err => {
        return reject({ status: 'error', error: err });
      });
  });
};

const loadTransactionSeeds = (models, account) => {
  return Promise.all(
    transactionSeeds[account].map(date => {
      // load statement from cvs file
      return loadStatement(account, date, models)
        .then(response => {
          if (response.status == 'error') return Promise.reject(response);
          return parseStatement(response);
        })
        .then(response => {
          if (response.status == 'error') return Promise.reject(response);
          return Promise.resolve({
            date: date,
            transactions: response.transactions,
          });
        })
        .catch(err => {
          return Promise.reject(err);
        });
    })
  );
};

/*
 * Seed tags
 */

const seedTags = (models, seeds) => {
  return new Promise((resolve, reject) => {
    parseTagSeeds(models)
      .then(response => {
        if (response.status == 'error') return reject(response);
        seeds.tags = response;
        return resolve({ models: models, seeds: seeds });
      })
      .catch(err => {
        return reject({ status: 'error', error: err });
      });
  });
};

const parseTagSeeds = models => {
  return Promise.all(
    tagSeeds.map(name => {
      // set model and record
      const model = models.tags;
      const record = { name: name };
      // create or update record
      return createUpdateWhere(model, record, record);
    })
  );
};

/*
 * Seed tag descriptions
 */

const seedTagDescriptions = (models, seeds) => {
  return new Promise((resolve, reject) => {
    parseTagDescriptionSeeds(models)
      .then(response => {
        if (response.status == 'error') return reject(response);
        seeds.tag_descriptions = response;
        return resolve({ models: models, seeds: seeds });
      })
      .catch(err => {
        return reject({ status: 'error', error: err });
      });
  });
};

const parseTagDescriptionSeeds = models => {
  return Promise.all(
    tagDescriptionSeeds.map(obj => {
      return parseTagDescriptionTags(models, obj)
        .then(response => {
          if (response.status == 'error') return reject(response);
          return Promise.resolve(response);
        })
        .catch(err => {
          return Promise.reject({ status: 'error', error: err });
        });
    })
  );
};

const parseTagDescriptionTags = (models, obj) => {
  return Promise.all(
    obj[1].map(name => {
      // find records
      return models.tags.findOne({ where: { name: name } }).then(record => {
        return record
          ? storeTagDescriptions(models, obj, record)
          : Promise.reject({ status: 'error', error: 'No records' });
      });
    })
  );
};

const storeTagDescriptions = (models, obj, tag) => {
  // set model and record
  const model = models.tag_descriptions;
  const record = { tag_id: tag.id, desc: obj[0] };
  // create or update record
  return createUpdateWhere(model, record, record);
};

/*
 * Seed expanded transactions
 */

const seedExpandedTransactions = (models, seeds) => {
  return new Promise((resolve, reject) => {
    parseExpandedTransactionSeeds(models)
      .then(response => {
        if (response.status == 'error') return reject(response);
        seeds.expand_transactions = response;
        return resolve({ models: models, seeds: seeds });
      })
      .catch(err => {
        return reject({ status: 'error', error: err });
      });
  });
};

const parseExpandedTransactionSeeds = models => {
  return Promise.all(
    expandedTransactionSeeds.map(obj => {
      return parseExpandedTransactionTags(models, obj)
        .then(response => {
          if (response.status == 'error') return reject(response);
          return Promise.resolve(response);
        })
        .catch(err => {
          return Promise.reject({ status: 'error', error: err });
        });
    })
  );
};

const parseExpandedTransactionTags = (models, obj) => {
  return Promise.all(
    obj[1].map(transaction => {
      const t = obj[0];
      const where = { date: t[0], desc: t[1], amount: t[2], balance: t[3] };
      // find records
      return models.transactions.findOne({ where: where }).then(record => {
        return record
          ? storeExpandedTransaction(models, transaction, record)
          : Promise.reject({ status: 'error', error: 'No records' });
      });
    })
  );
};

const storeExpandedTransaction = (models, obj, transaction) => {
  // set model and record
  const model = models.expand_transactions;
  const record = {
    transaction_id: transaction.id,
    amount: obj[0],
    tags: JSON.stringify(obj[1]),
  };
  // create or update record
  return createUpdateWhere(model, record, record);
};

/*
 * Import monthly statements
 */

module.exports.importStatement = (account, date) => {
  return new Promise((resolve, reject) => {
    // initialise database connection with logging param
    const sequelize = initDB(false);
    const models = getModels(sequelize);
    // load statement from cvs file
    loadStatement(account, date, models)
      .then(response => {
        if (response.status == 'error') return reject(response);
        return parseStatement(response);
      })
      .then(response => {
        if (response.status == 'error') return reject(response);
        closeDB(sequelize);
        return resolve(response);
      })
      .catch(err => {
        closeDB(sequelize);
        return reject(err);
      });
  });
};

const loadStatement = (account, date, models) => {
  return new Promise((resolve, reject) => {
    // load cvs file
    const file = './data/' + account + '/' + date + '.csv';
    fs.readFile(file, 'utf8', (err, data) => {
      if (err) return reject({ status: 'error', error: err });
      return resolve({ account: account, models: models, data: data.trim() });
    });
  });
};

const parseStatement = response => {
  return new Promise((resolve, reject) => {
    parseTransactions(response)
      .then(response => {
        return resolve({ transactions: response });
      })
      .catch(err => {
        return reject({ status: 'error', error: err });
      });
  });
};

const parseTransactions = response => {
  return Promise.all(
    response.data.split(/[\r\n]+/).map((transaction, index) => {
      // set model, record and where query
      const model = response.models.transactions;
      const record = formatTransaction(response.account, index, transaction);
      const where = Object.assign({}, record);
      delete where.order;
      // create or update record
      return createUpdateWhere(model, record, where);
    })
  );
};

const formatTransaction = (account, index, transaction) => {
  const obj = transaction.split(',');
  // format table fields
  const date = formatDateFromStr(obj[0]);
  const amount = obj[5] ? -parseFloat(obj[5]) : parseFloat(obj[6]);
  // return table record
  return {
    account: account,
    order: index,
    date: date,
    type: obj[1],
    desc: obj[4],
    amount: amount,
    balance: parseFloat(obj[7]),
  };
};

const formatDateFromStr = str => {
  const date = str.split('/');
  return date[2] + '-' + date[1] + '-' + date[0];
};

/*
 * Export monthly statements
 */

module.exports.exportStatement = (account, date) => {
  return new Promise((resolve, reject) => {
    // initialise database connection with logging param
    const sequelize = initDB(false);
    const models = getModels(sequelize);
    // get statement from database
    fetchStatement(account, date, models)
      .then(response => {
        if (response.status == 'error') return reject(response);
        return formatTransactions(response);
      })
      .then(response => {
        return fetchTagDescriptions(models, response);
      })
      .then(response => {
        return fetchExpandedTransactions(models, response);
      })
      .then(response => {
        return resolve(response);
      })
      .catch(err => {
        closeDB(sequelize);
        return reject(err);
      });
  });
};

const fetchStatement = (account, date, models) => {
  return new Promise((resolve, reject) => {
    // set model and where query
    const model = models.transactions;
    const where = {
      account: account,
      date: fetchStatementDateQuery(date),
    };
    // find records
    model
      .findAll({ where: where, order: ['order'] })
      .then(records => {
        return records.length
          ? resolve(records)
          : reject({ status: 'error', error: 'No records' });
      })
      .then(response => {
        return resolve(response);
      });
  });
};

const fetchStatementDateQuery = str => {
  // set date params
  const year = parseInt(str.substr(0, 4));
  const month = parseInt(str.substr(4, 2));
  // set date strings
  const dateFrom = year + '-' + formatDateWithLeadingZero(month) + '-06';
  const dateTo = formatDateWithMonthIncrement(year, month) + '-06';
  // return date query
  return { [operators.gte]: dateFrom, [operators.lt]: dateTo };
};

const formatDateWithMonthIncrement = (year, month) => {
  month = month == 12 ? 1 : month + 1;
  year = month == 1 ? year + 1 : year;
  return year + '-' + formatDateWithLeadingZero(month);
};

const formatDateWithLeadingZero = date => {
  return date < 10 ? '0' + date : date;
};

const formatTransactions = transactions => {
  return transactions.map(transaction => {
    return {
      id: transaction.dataValues.id,
      order: transaction.dataValues.order,
      date: transaction.dataValues.date,
      type: transaction.dataValues.type,
      desc: transaction.dataValues.desc,
      amount: transaction.dataValues.amount,
      balance: transaction.dataValues.balance,
    };
  });
};

const fetchTagDescriptions = (models, transactions) => {
  return Promise.all(
    transactions.map(transaction => {
      // set model and where query
      const model = models.tag_descriptions;
      const where = { desc: transaction.desc };
      // find records
      return model
        .findAll({ where: where })
        .then(records => {
          return fetchStatementTags(models, records);
        })
        .then(response => {
          transaction.tags = response;
          return Promise.resolve(transaction);
        });
    })
  );
};

const fetchStatementTags = (models, tagDescriptions) => {
  return Promise.all(
    tagDescriptions.map(description => {
      // find record
      return models.tags.findById(description.tag_id).then(record => {
        return Promise.resolve(record.name);
      });
    })
  );
};

const fetchExpandedTransactions = (models, transactions) => {
  return Promise.all(
    transactions.map(transaction => {
      // set model and where query
      const model = models.expand_transactions;
      const where = { transaction_id: transaction.id };
      // find records
      return model.findAll({ where: where }).then(response => {
        if (response.length)
          transaction.expanded = formatExpandedTransactions(response);
        return Promise.resolve(transaction);
      });
    })
  );
};

const formatExpandedTransactions = records => {
  return records.map(record => {
    return {
      amount: record.amount,
      tags: JSON.parse(record.tags),
    };
  });
};
