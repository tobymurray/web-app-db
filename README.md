# web-app-db
Basic PostgreSQL database structure for web app development. What this gives you:

- 3 databases, one for development, one for testing, and one for production
- Each database has its `public` schema removed
- Each database is set up to be accessed by two users, an "admin" and a "user"
- The admin is the owner of the database - able to create tables, add columns, generally change the schema and structure of the database
    - This is the user you use for deploying and upgrading your app
- The user has locked privileges so they're unable to modify the structure of the database. The user can add, remove and update rows in tables, but little else
    - This is the user you use from within your web application while it's deployed

## Why?

1. Security: Injection isn't at the top of the [OWASP Top 10](https://www.owasp.org/index.php/OWASP_Top_Ten_Cheat_Sheet) because it's hard to take advantage of. If you do make a mistake, limit the possible damage. Respect the [principle of least privilege](https://en.wikipedia.org/wiki/Principle_of_least_privilege)
2. Easier deployment: It seems counterintuitive, but the separation of concerns actually makes things more clear. You never have to worry if your database user has the right privileges - if you're doing administrative work, use the administrator. If you're not, don't.

## Installation

`npm -g install`

## Usage

First, create a `.web-app-db` configuration file. Example:

```
# The database user used by the application while it's running
DB_USER=sample_user
DB_PASSWORD=user_password

# The database user used to deploy the application
DB_ADMIN=sample_admin
DB_ADMIN_PASSWORD=admin_password

# The root name of the database - _production, _development, and _test will be appended
DB_NAME=database_root

# The schema name to use with the databases, if left empty it will default to the database root name
DB_SCHEMA_NAME=schema_name

# Host where the database server is running (IP address)
DB_HOST=192.168.1.10

# Port the database server is exposing for the database (defaults to 5432)
DB_PORT=5432
```

In the same directory as the `.web-app-db`, invoke this module with `web-app-db`.


See post here: https://technicallyrural.ca/2017/01/18/postgresql-for-web-apps/ for motivation
