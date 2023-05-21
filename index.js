const express = require('express');
const cors = require('cors');


const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

app.post('/api/insert', (req, res) => {

  switch (req.body.sgbdType) {
    case 'mysql':
      const mysql = require('mysql');

      var userPort;

      if (req.body.port) {
        userPort = req.body.port;
      } else {
        userPort = 3306;
      }

      const mysqlPool = mysql.createPool({
        connectionLimit: 10,
        host: req.body.hostname,
        user: req.body.username,
        password: req.body.password,
        database: req.body.databaseName,
        port: userPort,
      });

      mysqlPool.getConnection((err, connection) => {
        if (err) {
          console.log(err);
          res.status(500).send('Something went wrong with the database');
          return;
        } else {

          connection.query(`SELECT TABLE_NAME FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema='${req.body.databaseName}'`, (err, results) => {
            if (err) {
              res.status(500).send('Something went wrong with the getting the tables:', err);
              return;
            }

            const columnNamePromises = results.map((table) => {
              return new Promise((resolve, reject) => {
                connection.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '${req.body.databaseName}' AND TABLE_NAME = '${table.TABLE_NAME}'`, (err, results) => {
                  if (err) {
                    res.status(500).send('Something went wrong with the table:', err);
                    return;
                  }
                  var columns = results.map((column) => column.COLUMN_NAME);
                  resolve(columns);
                })
              })
            })

            const tablePromises = results.map((table) => {
              return new Promise((resolve, reject) => {
                connection.query(`SELECT * FROM ${table.TABLE_NAME}`, (err, results) => {
                  if (err) {
                    res.status(500).send('Something went wrong with the table:', err);
                    return;
                  }

                  var data = {
                    name: table.TABLE_NAME,
                  };
                  data.rows = results;
                  resolve(data);
                })
              })
            })

            Promise.all([...tablePromises, ...columnNamePromises])
              .then((results) => {
                var dbTables = [];

                for (let i = 0; i < results.length / 2; i++) {
                  const rows = results[i].rows;
                  const name = results[i].name;
                  const columns = results[i + results.length / 2];
                  dbTables.push({
                    name: name,
                    columns: columns,
                    rows: rows
                  });
                }

                res.json(dbTables);

              }).catch((err) => {
                res.status(500).send('Something went wrong with the table:', err);
                return;
              })
          })
        }
      })
      break;
    case 'sqlserver':
      var sql = require("mssql");

      var userPort;

      if (req.body.port) {
        userPort = req.body.port;
      } else {
        userPort = 1433;
      }

      var sqlConfig = {
        user: req.body.username,
        password: req.body.password,
        database: req.body.databaseName,
        server: req.body.hostname,
        port: userPort,
        options: {
          trustServerCertificate: true,
        }
      }
      sql.connect(sqlConfig)
        .then(() => {
          return sql.query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'`);
        })
        .then((result) => {
          const tables = result.recordset;

          const columnPromises = tables.map((table) => {
            return sql.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table.TABLE_NAME}'`)
              .then((result) => result.recordset.map((column) => column.COLUMN_NAME));
          });

          const dataPromises = tables.map((table) => {
            return sql.query(`SELECT * FROM ${table.TABLE_NAME}`)
              .then((result) => {
                const data = {
                  name: table.TABLE_NAME,
                  rows: result.recordset,
                };
                return data;
              });
          });

          return Promise.all([Promise.all(dataPromises), Promise.all(columnPromises)]);
        })
        .then(([dados, columns]) => {

          var dbTables = [];

          for (let i = 0; i < dados.length; i++) {
            const rows = dados[i].rows;
            const name = dados[i].name;
            const columnName = columns[i];

            dbTables.push({
              name: name,
              columns: columnName,
              rows: rows
            });
          }

          res.json(dbTables);
        })
        .catch((err) => {
          res.status(500).send(err);
        })
        .finally(() => {
          sql.close();
        });

      break;
    case 'postgres':
      var userPort;

      if (req.body.port) {
        userPort = req.body.port;
      } else {
        userPort = 5432;
      }

      const pgp = require('pg-promise')();
      const db = pgp({
        host: req.body.hostname,
        port: userPort,
        database: req.body.databaseName,
        user: req.body.username,
        password: req.body.password
      })

      db.any(`SELECT table_name FROM information_schema.tables WHERE table_schema = '${req.body.schema}'`)
        .then((accounts) => {
          const tablePromises = accounts.map((table) => {
            return db.any(`SELECT * FROM ${table.table_name}`)
              .then((rows) => {
                var data = {
                  name: table.table_name,
                  rows: rows,
                };
                return data;
              });
          });

          const columnPromises = accounts.map((table) => {
            return db.any(`SELECT column_name FROM information_schema.columns WHERE table_schema = '${req.body.schema}' AND table_name = '${table.table_name}'`)
              .then((result) => result.map((column) => column.column_name));
          });

          return Promise.all([Promise.all(tablePromises), Promise.all(columnPromises)]);
        }).then(([dados, columns]) => {
            var dbTables = [];
  
            for (let i = 0; i < dados.length; i++) {
              const rows = dados[i].rows;
              const name = dados[i].name;
              const columnName = columns[i];
  
              dbTables.push({
                name: name,
                columns: columnName,
                rows: rows
              });
            }
  
            res.json(dbTables);

        }).catch((err) => {
          res.status(500).send(err);
        }).finally(() => {
          db.$pool.end();
        })

      break;
    default: res.status(400).send('Invalid SGBD Type');
  }
})

app.get('/api', (req, res) => {
  res.send({
    message: 'Olá Amigo!',
  });
})

const PORT = 4242;

app.listen(PORT, () => {
  console.log('Server is running on port', PORT);
})