"use strict";

var DbUser = require('./DbUser');

class DbConfig {
  constructor(config) {
    this.databaseSchemaName = config.databaseSchemaName;
    this.adminName = config.adminName;
    this.adminPassword = config.adminPassword;
    this.userName = config.userName;
    this.userPassword = config.userPassword;

    this.testDatabaseName = config.databaseRootName + "_test";
    this.developmentDatabaseName = config.databaseRootName + "_development";
    this.productionDatabaseName = config.databaseRootName + "_production";

    this.superuserDefaultDatabase = new DbUser(config.defaultDatabase, config.superuser, config.superuserPassword);
    this.superuserTestDatabase = new DbUser(this.testDatabaseName, config.superuser, config.superuserPassword);
    this.adminTestDatabase = new DbUser(this.testDatabaseName, this.adminName, this.adminPassword);
  }

  cloneTestToDevelopment(client) {
    return client.query(this.cloneDatabaseQuery(this.testDatabaseName, this.developmentDatabaseName, this.adminName));
  }

  cloneTestToProduction(client) {
    return client.query(this.cloneDatabaseQuery(this.testDatabaseName, this.productionDatabaseName, this.adminName));
  }

  grantTablesToUser(client) {
    return client.query(this._alterDefaultPrivilegesInSchema() + " GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO \"" + this.userName + "\"");
  }

  grantSequencesToUser(client) {
    return client.query(this._alterDefaultPrivilegesInSchema() + " GRANT SELECT, USAGE ON SEQUENCES TO \"" + this.userName + "\"");
  }

  grantFunctionsToUser(client) {
    return client.query(this._alterDefaultPrivilegesInSchema() + " GRANT EXECUTE ON FUNCTIONS TO \"" + this.userName + "\"")
  }

  createSchema(client) {
    return client.query("CREATE SCHEMA \"" + this.databaseSchemaName + "\" AUTHORIZATION \"" + this.adminName + "\"")
  }

  grantUserUsageOnSchema(client) {
    return client.query("GRANT USAGE ON SCHEMA \"" + this.databaseSchemaName + "\" TO \"" + this.userName + "\"");
  }

  revokeFunctionsFromPublic(client) {
    return client.query(this.alterDefaultPrivileges() + " REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC");
  }

  cloneDatabaseQuery(templateName, newDatabaseName, owner) {
    return "CREATE DATABASE \"" + newDatabaseName + "\" WITH TEMPLATE \"" + templateName + "\" OWNER \"" + owner + "\"";
  }

  alterDefaultPrivileges() {
    return "ALTER DEFAULT PRIVILEGES FOR ROLE \"" + this.adminName + "\"";
  }

  createTestDatabase(client) {
    return this._createDatabase(client, this.testDatabaseName, this.adminName);
  }

  addAppAdmin(client) {
    return this._addUser(client, this.adminName, this.adminPassword);
  }

  addAppUser(client) {
    return this._addUser(client, this.userName, this.userPassword);
  }

  _alterDefaultPrivilegesInSchema() {
    return this.alterDefaultPrivileges(this.adminName) + " IN SCHEMA \"" + this.databaseSchemaName + "\"";
  }

  _createDatabase(client, databaseName, owner) {
    return client.query('CREATE DATABASE $1~ WITH OWNER $2~', [databaseName, owner]);
  }

  _addUser(client, name, password) {
    return client.query('CREATE USER $1~ WITH PASSWORD $2', [name, password]);
  }
}

module.exports = DbConfig;
