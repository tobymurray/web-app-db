"use strict";
const dotenv = require('dotenv').config({
  path: '.web-app-db'
})
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

  if (!configuration[key]) {
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
  console.log("Creating admin user...");
  let adminUserPromise = dbConfig.addAppAdmin(t);
  console.log("Creating application user...");
  let appUserPromise = dbConfig.addAppUser(t);

  yield t.batch([
    adminUserPromise,
    appUserPromise
  ]);

  console.log("Creating test database");
  yield dbConfig.createTestDatabase(t);
}

function* replacePublicSchema(t) {
  console.log("Dropping the public schema and replacing it with a new one...");
  yield t.batch([
    t.query("DROP SCHEMA \"public\""),
    dbConfig.createSchema(t)
  ]);
}

function* enableCiTextExtension(t) {
  if (process.env.CITEXT_EXTENSION == 'true') {
    console.log("Enabling the case-insensitive text extension (citext)...");
    yield dbConfig.enableCiTextExtension(t);
  }
}

function* alterPrivileges(t) {
  console.log("Granting application user usage on schema...");
  yield dbConfig.grantUserUsageOnSchema(t);

  console.log("Revoking functions privileges from public user...");
  yield dbConfig.revokeFunctionsFromPublic(t);

  console.log("Granting tables permissions to application user...");
  let grantTablesToUserPromies = dbConfig.grantTablesToUser(t);

  console.log("Granting sequences permissions to application user...");
  let grantSequencesToUserPromies = dbConfig.grantSequencesToUser(t);

  console.log("Granting tables functions to application user...");
  let grantFunctionsToUserPromies = dbConfig.grantFunctionsToUser(t);

  yield t.batch([
    grantTablesToUserPromies,
    grantSequencesToUserPromies,
    grantFunctionsToUserPromies
  ]);
}

function* cloneDatabases(t) {
  console.log("Cloning test database to create development database...");
  yield dbConfig.cloneTestToDevelopment(t);
  console.log("Cloning test database to create production database...");
  yield dbConfig.cloneTestToProduction(t);
}

function* setDefaultSchema(t) {
  console.log("Setting the default schema for admin user");
  yield dbConfig.setAdminDefaultSchema(t);

  console.log("Setting the default schema for application user");
  yield dbConfig.setUserDefaultSchema(t);
}

function* createEverything() {
  var superuserDefaultDatabaseClient = pgp(superuserDefaultDatabase);
  yield superuserDefaultDatabaseClient.task(createDatabaseAndUsers);

  var superuserTestDatabaseClient = pgp(superuserTestDatabase);
  yield superuserTestDatabaseClient.task(replacePublicSchema);

  yield superuserTestDatabaseClient.task(enableCiTextExtension);

  yield superuserTestDatabaseClient.task(setDefaultSchema);

  var adminTestDatabaseClient = pgp(adminTestDatabase);
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
  }).then(function () {
    return generator.next().value;
  }).then(function () {
    return generator.next().value;
  }).then(function () {
    pgp.end();
    console.log("\nEverything should be good to go");
    console.log("Try connecting with psql client, e.g.:");
    console.log("    psql -U postgres -h localhost")
  }).catch(function (err) {
    console.log(err.toString());
  });
