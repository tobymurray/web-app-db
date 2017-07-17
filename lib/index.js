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
if (configurationMissing) process.exit(1);

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
  let adminUserPromise = dbConfig.addAppAdmin(t)
    .catch(error => onError(error));

  console.log("Creating application user...");
  let appUserPromise = dbConfig.addAppUser(t)
    .catch(error => onError(error));

  yield t.batch([
    adminUserPromise,
    appUserPromise
  ]).catch(error => onError(error));

  console.log("Creating test database");
  yield dbConfig.createTestDatabase(t)
    .catch(error => onError(error));
}

function* replacePublicSchema(t) {
  console.log("Dropping the public schema and replacing it with a new one...");
  yield t.batch([
    t.query("DROP SCHEMA \"public\""),
    dbConfig.createSchema(t)
  ]).catch(error => onError(error));
}

function* enableCiTextExtension(t) {
  if (process.env.CITEXT_EXTENSION == 'true') {
    console.log("Enabling the case-insensitive text extension (citext)...");
    yield dbConfig.enableCiTextExtension(t)
      .catch(error => onError(error));
  }
}

function* alterPrivileges(t) {
  console.log("Granting application user usage on schema...");
  yield dbConfig.grantUserUsageOnSchema(t)
    .catch(error => onError(error));

  console.log("Revoking functions privileges from public user...");
  yield dbConfig.revokeFunctionsFromPublic(t)
    .catch(error => onError(error));

  console.log("Granting tables permissions to application user...");
  let grantTablesToUserPromies = dbConfig.grantTablesToUser(t)
    .catch(error => onError(error));

  console.log("Granting sequences permissions to application user...");
  let grantSequencesToUserPromies = dbConfig.grantSequencesToUser(t)
    .catch(error => onError(error));

  console.log("Granting functions permissions to application user...");
  let grantFunctionsToUserPromies = dbConfig.grantFunctionsToUser(t)
    .catch(error => onError(error));

  yield t.batch([
    grantTablesToUserPromies,
    grantSequencesToUserPromies,
    grantFunctionsToUserPromies
  ]).catch(error => onError(error));
}

function* cloneDatabases(t) {
  console.log("Cloning test database to create development database...");
  yield dbConfig.cloneTestToDevelopment(t)
    .catch(error => onError(error));

  console.log("Cloning test database to create production database...");
  yield dbConfig.cloneTestToProduction(t)
    .catch(error => onError(error));
}

function* setDefaultSchema(t) {
  console.log("Setting the default schema for admin user");
  yield dbConfig.setAdminDefaultSchema(t)
    .catch(error => onError(error));

  console.log("Setting the default schema for application user");
  yield dbConfig.setUserDefaultSchema(t)
    .catch(error => onError(error));
}

function* createEverything() {
  var superuserDefaultDatabaseClient = pgp(superuserDefaultDatabase);
  yield superuserDefaultDatabaseClient.task(createDatabaseAndUsers)
    .catch(error => onError(error));

  var superuserTestDatabaseClient = pgp(superuserTestDatabase);
  yield superuserTestDatabaseClient.task(replacePublicSchema)
    .catch(error => onError(error));

  yield superuserTestDatabaseClient.task(enableCiTextExtension)
    .catch(error => onError(error));

  yield superuserTestDatabaseClient.task(setDefaultSchema)
    .catch(error => onError(error));

  var adminTestDatabaseClient = pgp(adminTestDatabase);
  yield adminTestDatabaseClient.task(alterPrivileges)
    .catch(error => onError(error));

  pgp.end();
  pgp = require('pg-promise')();
  superuserDefaultDatabaseClient = pgp(superuserDefaultDatabase);

  yield superuserDefaultDatabaseClient.task(cloneDatabases);
}

function onError(error) {
  console.error("Unexpectedly ran into an error: ", error);
  try {
    pgp.end();
  } catch (error) {
    // Swallow any errors at this point
    console.warn("Error while trying to clean up, feel free to ignore this: " + error);
  }
  process.exit(1);
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