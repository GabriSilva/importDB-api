const express = require('express');
const cors = require('cors');
const mysql = require('mysql');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

/* const pool = mysql.createPool({
  connectionLimit: 10,
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'db',
}); */


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

        const promises = results.map((table) => {
          return new Promise((resolve, reject) => {
            connection.query(`SELECT * FROM ${table.TABLE_NAME}`, (err, results) => {
              if (err) {
                res.status(500).send('Something went wrong with the table:', err);
                return;
              }
              resolve(results);
            })
          })
        })

        Promise.all(promises)
          .then((results) => {
            res.json(results);
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

