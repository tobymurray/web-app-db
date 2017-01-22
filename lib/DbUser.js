"use strict";

class DbUser {
  constructor(database, user, password) {
    this.database = database;
    this.user = user;
    this.password = password;
  }

  toString() {
    return {
      database: this.database,
      user: this.user,
      password: this.password
    }
  }
}

module.exports = DbUser;
