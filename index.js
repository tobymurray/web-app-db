"use strict";
var DbConfig = require('./lib/DbConfig');
var pgp = require('pg-promise')();

var appConfig = {
  defaultDatabase: "postgres", // Default postgres database, usually 'postgres'
  superuser: "postgres", // Superuser for postgres server e.g. 'postgres'
  superuserPassword: "password",
  databaseRootName: "min_auth", // Prefix for databases to be created - e.g. "_test" is appended to this to create the test database
  databaseSchemaName: "min_auth", // Name of the schema to replace the public schema in the created databases
  adminName: "min_auth_admin", // App administrator's name
  adminPassword: "admin_password", // App administrator's password
  userName: "min_auth_user", // App user's name
  userPassword: "user_password" // App user's password
}

var dbConfig = new DbConfig(appConfig);

var serverConfig = {
  host: '192.168.99.100', // Host for the PostgreSQL server
  port: 5432, // Port on the configured host where PostgreSQL is accessible
  max: 10, // Max number of connections
  poolIdleTimeout: 1000 // Amount of time before an idle client times out and disconnects
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
  yield superuserDefaultDatabaseClient.task(createDatabaseAndUsers)

  var superuserTestDatabaseClient = new pgp(superuserTestDatabase);
  yield superuserTestDatabaseClient.task(replacePublicSchema)

  var adminTestDatabaseClient = new pgp(adminTestDatabase);
  yield adminTestDatabaseClient.task(alterPrivileges)

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