const nodemailer = require('nodemailer');

const mailService = (host, port, secure, username, password) => nodemailer.createTransport({
    pool: true,
    host: host,
    port: port,
    secure: secure,
    auth: {
        user: username,
        pass: password
    }
});

module.exports = mailService;
