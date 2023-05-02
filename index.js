const express = require('express');
const cors = require('cors');
const mysql = require('mysql');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

app.post('/api/insert', (req, res) => {

  const pool = mysql.createPool({
    connectionLimit: 10,
    host: req.body.hostname,
    user: req.body.username,
    password: req.body.password,
    database: req.body.databaseName,
  });

  pool.getConnection((err, connection) => {
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

