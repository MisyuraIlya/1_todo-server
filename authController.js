// GLOBAL
import randtoken from 'rand-token';
import nodemailer from 'nodemailer';
import { compareSync, genSaltSync, hashSync } from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

// LOCAL
import db from './config.js';
import httpStatusCodes from './httpStatusCodes.js';

function query(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
}

function sendResponse(response, data = null, status = null, error = null) {
  return response.status(httpStatusCodes.status[status]).json({ status: httpStatusCodes.status[status], data, error });
}

function sendEmail(emaill, token) {
  const mail = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'spetsar97ilya@gmail.com',
      pass: 'kpxoemypopltbmje',
    },
  });

  const mailOptions = {
    from: 'spetsar97ilya@gmail.com',
    to: 'misyurailya5@gmail.com',
    subject: 'Email verification ',
    html: `<p>You requested for email verification, kindly use this <a href="http://dev.local:3006/api/verify-email?token=${token}">link</a> to verify your email address</p>`,

  };

  mail.sendMail(mailOptions, (error, info) => {
    if (error) {
      return 1;
    }
    return 0;
  });
}

class authContoller {
  async SignUp(request, response) {
    const { email } = request.body;
    const sql = 'SELECT id, email, name FROM users WHERE email = ?';
    const result = await query(sql, email);
    if (typeof result !== 'undefined' && result.length > 0) {
      const results = JSON.parse(JSON.stringify(result));
      results.map((rs) => {
        sendResponse(response, null, 'BAD_REQUEST', `member with this - ${rs.email} already registered`);
        return true;
      });
    } else {
      const id = uuidv4();
      const { name } = request.body;
      const { lastname } = request.body;
      const { email } = request.body;
      const { phone } = request.body;
      const salt = genSaltSync(15);
      const password = hashSync(request.body.password, salt);
      const sql = 'INSERT INTO users (id, name, lastname, email, password, phone, created, status) VALUES(?, ?, ?, ?, ?, ?, now(), \'DISABLED\') ';
      const sql2 = 'INSERT INTO verefication (id, email, token, verify, created, updated) VALUES(?, ?, NULL, 0, now(), now())';
      const result = await query(sql, [id, name, lastname, email, password, phone]);
      const result2 = await query(sql2, [id, email]);
      sendResponse(response, result2, 'OK', null);
    }
  }

  async SendEmail(request, response) {
    const { email } = request.body;
    const sql = 'SELECT * FROM verefication WHERE email = ?';
    const result = await query(sql, email);
    if (result.length > 0) {
      const token = randtoken.generate(20);
      if (result[0].verify == 0) {
        const sent = sendEmail(email, token);
        if (sent != '0') {
          const sql = 'UPDATE verefication SET ? WHERE email = ? ';
          db.query(sql, token, email, (error, result) => {
            if (error) throw error;
          });
          sendResponse(response, { type: 'success', msg: 'The verefication link has been sent to your email address' }, 'OK', null);
        } else {
          sendResponse(response, { type: 'error', msg: 'Something goes wrong. Please try again' }, 'BAD_REQUEST', null);
        }
      }
    } else {
      sendResponse(response, { type: 'error', msg: 'The Email is not registered' }, 'BAD_REQUEST', null);
    }
    response.redirect('/');
  }

  async VerifyEmail(request, response) {
    const { token } = request.query;
    const sql = 'SELECT * FROM verefication WHERE token = ?';
    db.query(sql, token, (err, result) => {
      if (err) throw err;
      if (result[0].verify == 0) {
        if (result.length > 0) {
          const data = {
            verify: 1,
          };
          const sql = 'UPDATE verefication SET ? WHERE email = ? ';
          db.query(sql, data, result[0].email, (err, result) => {
            if (err) throw err;
          });
          sendResponse(response, { type: 'success', msg: 'Your email has been verified' }, 'BAD_REQUEST', null);
        } else {
          sendResponse(response, { type: 'success', msg: 'The email has already verified' }, 'BAD_REQUEST', null);
        }
      } else {
        sendResponse(response, { type: 'error', msg: 'The email has been already verified' }, 'BAD_REQUEST', null);
      }
      response.redirect('/');
    });
  }

  async SignIn(request, response) {
    const { email } = request.query;
    const sql = 'SELECT id, email, password FROM users WHERE email = ? AND status = \'ACTIVE\' ';
    db.query(sql, email, (err, result, fields) => {
      if (err) {
        sendResponse(response, null, 'BAD_REQUEST', 'Error bad request');
      } else if (result.length <= 0) {
        sendResponse(response, null, 'BAD_REQUEST', 'Inccorect username or password');
      } else {
        const sqlStatus = 'SELECT status FROM users WHERE email = ?  ';
        db.query(sqlStatus, email, (err, resultStatus, fields) => {
          if (resultStatus[0].status != 'ACTIVE') {
            sendResponse(response, null, 'BAD_REQUEST', 'Verify account in email before signin');
          } else {
            const results = JSON.parse(JSON.stringify(result));
            results.map((rs) => {
              const password = compareSync(request.query.password, rs.password);
              if (password) {
                console.log('session start');
                request.session.loggedin = true;
                request.session.username = email;
                response.redirect('/api/home');
                console.log('created session');
                sendResponse(response, { type: 'success', msg: 'the session created' }, 'OK', null);
              } else {
                sendResponse(response, null, 'BAD_REQUEST', 'Password inccorect');
              }
            });
          }
        });
      }
    });
  }

  async Home(request, response) {
    if (request.session.loggedin) {
      response.send(`Welcome back, ${request.session.username}!`);
    } else {
      response.send('Please login to view this page!');
    }
    response.end();
  }

  async LogOut(request, response) {
    request.session.destroy();
    response.redirect('/login');
  }

  async ResetPassword(request, response) {
    const { email } = request.body;
    const sql = 'SELECT * FROM users WHERE email = ? ';
    db.query(sql, email, (err, result) => {
      if (err) throw err;
      if (result[0].email.length > 0) {
        const token = randtoken.generate(20);
        const sent = sendEmail(email, token);
        if (sent != '0') {
          const sql = 'UPDATE users SET ? WHERE email = ?';
          db.query(sql, token, email, (err, result) => {
            if (err) throw err;
          });
          sendResponse(response, { type: 'success', msg: 'The reset password link has been sent to your email address' }, 'OK', null);
        } else {
          sendResponse(response, { type: 'error', msg: 'Something goes to wrong. Please try again' }, 'BAD_REQUEST', null);
        }
      } else {
        sendResponse(response, { type: 'error', msg: 'The Email is not registered with us' }, 'BAD_REQUEST', null);
      }

      request.flash(type, msg);
      response.redirect('/');
    });
  }

  async UpdatePassword(request, response) {
    const { token } = req.body;
    const sql = 'SELECT * FROM users WHERE token = ?';
    db.query(sql, token, (err, result) => {
      if (err) throw err;
      if (result.length > 0) {
        const saltRounds = 10;
        const salt = genSaltSync(15);
        const password = hashSync(req.body.password, salt);
        const data = {
          password,
        };
        const sql = 'UPDATE users SET ? WHERE email = ?';
        db.query(sql, data, result[0].email, (err, result) => {
          if (err) throw err;
        });
        sendResponse(response, { type: 'success', msg: 'Your password has been updated successfully' }, 'OK', null);
      } else {
        sendResponse(response, { type: 'error', msg: 'Invalid link; please try again' }, 'BAD_REQUEST', null);
      }
      res.redirect('/');
    });
  }
}

export default new authContoller();