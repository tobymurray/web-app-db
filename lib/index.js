"use strict";
const dotenv = require('dotenv').config({path: '.web-app-db'})
const DbConfig = require('./db_config');
var pgp = require('pg-promise')();

const configuration = {
  defaultDatabase: process.env["DEFAULT_DATABASE"],
  superuserName: process.env["DB_SUPERUSER_NAME"],
  superuserPassword: process.env["DB_SUPERUSER_PASSWORD"],
  userName: process.env["DB_USER"],
  userPassword: process.env["DB_PASSWORD"],
  adminName: process.env["DB_ADMIN"],
  adminPassword: process.env["DB_ADMIN_PASSWORD"],
  databaseRootName: process.env["DB_NAME"],
  databaseSchemaName: process.env["DB_SCHEMA_NAME"] || process.env["DB_NAME"],
  databaseHost: process.env["DB_HOST"],
  databasePort: process.env["DB_PORT"] || 5432,
  maxNumClients: process.env["MAX_NUM_CLIENTS"] || 5,
  timeoutMillis: process.env["TIMEOUT_MILLIS"] || 5000
}

let configurationMissing = false;
for (var key in configuration) {
  if (!configuration.hasOwnProperty(key)) continue;

  if(!configuration[key]) {
    console.error("Expecting " + key + " to be specified, but it was " + configuration[key]); 
    configurationMissing = true;
  }
}
if (configurationMissing) return;

var dbConfig = new DbConfig(configuration);

var serverConfig = {
  host: configuration.databaseHost,
  port: configuration.databasePort,
  max: configuration.maxNumClients,
  poolIdleTimeout: configuration.timeoutMillis
};

var superuserDefaultDatabase = Object.assign({}, dbConfig.superuserDefaultDatabase, serverConfig);
var superuserTestDatabase = Object.assign({}, dbConfig.superuserTestDatabase, serverConfig);
var adminTestDatabase = Object.assign({}, dbConfig.adminTestDatabase, serverConfig);

function* createDatabaseAndUsers(t) {
  yield Promise.all([
    dbConfig.addAppAdmin(t),
    dbConfig.addAppUser(t)
  ]);
  yield dbConfig.createTestDatabase(t);
}

function* replacePublicSchema(t) {
  yield Promise.all([
    t.query("DROP SCHEMA \"public\""),
    dbConfig.createSchema(t)
  ]);
}

function* alterPrivileges(t) {
  yield dbConfig.grantUserUsageOnSchema(t);
  yield dbConfig.revokeFunctionsFromPublic(t);

  yield Promise.all([
    dbConfig.grantTablesToUser(t),
    dbConfig.grantSequencesToUser(t),
    dbConfig.grantFunctionsToUser(t)
  ]);
}

function* cloneDatabases(t) {
  yield dbConfig.cloneTestToDevelopment(t);
  yield dbConfig.cloneTestToProduction(t);
}

function* createEverything() {
  var superuserDefaultDatabaseClient = new pgp(superuserDefaultDatabase);
  yield superuserDefaultDatabaseClient.task(createDatabaseAndUsers);

  var superuserTestDatabaseClient = new pgp(superuserTestDatabase);
  yield superuserTestDatabaseClient.task(replacePublicSchema);

  var adminTestDatabaseClient = new pgp(adminTestDatabase);
  yield adminTestDatabaseClient.task(alterPrivileges);
  pgp.end();
  pgp = require('pg-promise')();

  yield superuserDefaultDatabaseClient.task(cloneDatabases);
}

var generator = createEverything();

generator.next().value
  .then(function () {
    return generator.next().value;
  }).then(function () {
    return generator.next().value;
  }).then(function () {
    return generator.next().value;
  }).catch(function (err) {
    console.log(err.toString());
  });
