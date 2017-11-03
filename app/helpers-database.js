'use strict';

const Sequelize = require('sequelize');

/*
 * Database initialiser
 * @param logging(boolean): toggle log output
 */

module.exports.initDB = logging => {
  return new Sequelize(
    process.env['DB_NAME'],
    process.env['DB_USERNAME'],
    process.env['DB_PASSWORD'],
    {
      host: process.env['DB_HOST'],
      port: process.env['DB_PORT'],
      dialect: 'mysql',
      logging: logging,
    }
  );
};

/*
 * Migrate database tables
 * @param sequelize(object): instance of Sequelize
 * @param force(boolean): when true migrations overwrite current db
 */

module.exports.migrateDB = (sequelize, force) => {
  return new Promise((resolve, reject) => {
    // define the database models
    const models = defineModels(sequelize);
    // run database migrations with force param
    sequelize
      .sync({ force: force })
      .then(() => {
        return resolve({ models: models });
      })
      .catch(err => {
        return reject({ status: 'error', error: err });
      });
  });
};

const defineModels = sequelize => {
  //const pk = { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true };
  // define models
  const models = {
    transactions: sequelize.define('transaction', {
      account: { type: Sequelize.STRING(10), allowNull: false },
      order: { type: Sequelize.INTEGER, allowNull: false },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      type: { type: Sequelize.STRING(3), allowNull: false },
      desc: { type: Sequelize.STRING, allowNull: false },
      amount: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
      balance: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
    }),
    tags: sequelize.define('tag', {
      //tag_id: pk,
      name: { type: Sequelize.STRING, allowNull: false },
    }),
    tag_descriptions: sequelize.define('tag_description', {
      tag_id: { type: Sequelize.INTEGER, allowNull: false },
      desc: { type: Sequelize.STRING, allowNull: false },
    }),
    expand_transactions: sequelize.define('expand_transaction', {
      transaction_id: { type: Sequelize.INTEGER, allowNull: false },
      amount: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
      tags: { type: Sequelize.TEXT, allowNull: false },
    }),
  };
  // define foreign keys constraints
  models.tag_descriptions.belongsTo(models.tags, { foreignKey: 'tag_id' });
  models.expand_transactions.belongsTo(models.transactions, {
    foreignKey: 'transaction_id',
  });
  // return models
  return models;
};

module.exports.getModels = defineModels;
module.exports.operators = Sequelize.Op;

/*
 * Create or update a model helper
 * @param model(object): instance of Sequelize:Model
 * @param record(object): single database record
 * @param condition(object): where query condition
 */

module.exports.createUpdateByPK = (model, record) => {
  return model
    .findById(record[model.primaryKeyField])
    .then(obj => {
      return obj ? obj.update(record) : model.create(record);
    })
    .catch(err => {
      return err;
    });
};

module.exports.createUpdateWhere = (model, record, condition) => {
  return model
    .findOne({ where: condition })
    .then(obj => {
      return obj ? obj.update(record) : model.create(record);
    })
    .catch(err => {
      return err;
    });
};

/*
 * Close database connect
 * @param sequelize(object): instance of Sequelize
 */

module.exports.closeDB = sequelize => {
  sequelize.close();
};
