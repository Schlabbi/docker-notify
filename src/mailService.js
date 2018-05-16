const nodemailer = require('nodemailer');

let mailService = (host, port, secure, username, password) => {
    return transporter = nodemailer.createTransport({
        pool: true,
        host: host,
        port: port,
        secure: secure,
        auth: {
            user: username,
            pass: password
        }
    });
};

module.exports = mailService;