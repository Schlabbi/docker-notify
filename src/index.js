const dockerAPI = require('docker-hub-api');
const mailService = require('./mailService');

//parse repositories from env
let repositories = process.env.repositories.split(',').map((elem) => {
    let res = {};
    elem = elem.split('/');
    res.user = elem.length > 1 ? elem[1] : 'library';
    res.name = elem[0];
    return res;
}); 

//get variables from env
let smtpHost = process.env.smtpHost;
let smtpPort = Number(process.env.smtpPort);
let smtpSecure = process.env.smtpSecure == "true";
let smtpSenderName = process.env.smtpSenderName;
let smtpSenderAddress = process.env.smtpSenderAddress;
let smtpUsername = process.env.smtpUsername;
let smtpPassword = process.env.smtpPassword;

let mailReceiver = process.env.mailReceiver;

let mailTransporter = mailService(smtpHost, smtpPort, smtpSecure, smtpUsername, smtpPassword);

let sendMail = function(msg) {
    mailTransporter.verify().then(() => {
        let mailOptions = {
            from: '"' + smtpSenderName + '" <' + smtpSenderAddress + '>',
            to: mailReceiver,
            subject: "Docker image updated",
            text: msg
        };
        mailTransporter.sendMail(mailOptions).then(console.log).catch(console.error);
    }).catch((err) => {
        console.error(err);
    });
};

sendMail("Hi")

console.log(repositories);
