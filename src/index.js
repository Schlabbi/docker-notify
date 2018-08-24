const dockerAPI = require('docker-hub-api');
const mailService = require('./mailService');
const Cache = require('./Cache');
const schema = require('./schema.json');
const Ajv = require('ajv');
const ajv = new Ajv({allErrors: true, useDefaults: true});
const rpn = require('request-promise-native');

//Load config file
let config;

try {
    config = require('./config.json')
}
catch (e) {
    console.error("Config file error, exiting");
    console.error(e.message);
    process.exit(1);
}

//Validate config file with schema validator
let validate = ajv.compile(schema);
let valid = validate(config);
if (!valid){
    console.error(validate.errors);
    process.exit(2);
}

//Prepare variables
let notifyServices = config.notifyServices;

//Validate things, that can currently not be validated by json schema
//these things are: smtp-server referenced in notifyJob is existing and
//webhooks referenced in notifyJob is existing
if(!notifyServices.every(o => o.actions.every(o2 => o2.type === "webHook" ? config.webHooks[o2.instance] :
    o2.type === "mailHook" ? config.smtpServer[o2.instance] : false))){
    console.error("Mail/Smtp Hooks that are referenced are not defined!");
    process.exit(3);
}

config.notifyServices.forEach(o => {
    let res = {};
    let elem = o.image;
    elem = elem.split('/');
    res.user = elem.length > 1 ? elem[0] : 'library';
    res.name = elem.length > 1 ? elem[1] : elem[0];
    //get tag if it is set
    if(res.name.split(':').length > 1){
        res.tag = res.name.split(':')[1];
        res.name = res.name.split(':')[0];
    }
    o.image = res;
});

let mailtransporterMap = new Map();

let mailHookSend = function(smtpserver, recipient, msg){
    if(!mailtransporterMap.has(smtpserver)){
        mailtransporterMap.set(smtpserver,
            mailService(config.smtpServer[smtpserver].host, config.smtpServer[smtpserver].port, config.smtpServer[smtpserver].secure,
                config.smtpServer[smtpserver].username, config.smtpServer[smtpserver].password))
    }

    sendMail(msg, mailtransporterMap.get(smtpserver), config.smtpServer[smtpserver].senderName,
        config.smtpServer[smtpserver].senderadress, recipient);
};

//sends an email with a given message to the receiver which is defined in the env
let sendMail = function(msg, mailTransporter, smtpSenderName, smtpSenderAddress, mailReceiver) {
    mailTransporter.verify().then(() => {
        let mailOptions = {
            from: '"' + smtpSenderName + '" <' + smtpSenderAddress + '>',
            to: mailReceiver,
            subject: "Docker image updated",
            text: msg
        };
        mailTransporter.sendMail(mailOptions).then((info) => {
            console.log("Notification mail sent: ", info);
        }).catch((err) => {
            console.error("Error while sending mail: ", err);
        });
    }).catch((err) => {
        console.error(err);
    });
};

let getRepositoryInfo = function(user, name) {
    return dockerAPI.repository(user, name);
};

let getTagInfo = function(user, name) {
    return dockerAPI.tags(user, name);
};

let checkRepository = function(job, repoCache) {
    return new Promise((resolve, reject) => {
        
        let checkUpdateDates = function(repoInfo) {
            let updated;
            if(repoCache) {
                let cachedDate = Date.parse(repoCache.lastUpdated);
                let currentDate = Date.parse(repoInfo.last_updated);
                updated = cachedDate < currentDate;
            } else {
                updated = false; 
            }
            resolve({
                lastUpdated: repoInfo.last_updated,
                name: repoInfo.name,
                user: repoInfo.user,
                updated: updated,
                job: job
            });
        };

        repository = job.image;

        if(repository.tag) {
            getTagInfo(repository.user, repository.name).then((tags) => {
                let tagInfo = tags.filter((elem) => elem.name == repository.tag)[0];
                tagInfo.user = repository.user;
                tagInfo.name = repository.name;
                checkUpdateDates(tagInfo);
            });
        } else {
            getRepositoryInfo(repository.user, repository.name).then(checkUpdateDates).catch((err) => {
                console.error("Error while fetching repo info: ", err);
                reject();
            });
        }
    });
};

let checkForUpdates = function() {
    console.log("Checking for updated repositories");
    Cache.getCache().then((cache) => {
        let repoChecks = [];
        for(let job of notifyServices) {
            repoChecks.push(checkRepository(job, cache[job.image.user + "/" + job.image.name]));
        }
        Promise.all(repoChecks).then((checkResult) => {
            let newCache = {};
            let updatedRepos = [];
            for(let res of checkResult) {
                newCache[res.user + "/" + res.name] = {
                    user: res.user,
                    name: res.name,
                    lastUpdated: res.lastUpdated
                };
                if(res.updated) {
                    let updatedString = res.user == "library" ? res.name : res.user + "/" + res.name;
                    updatedRepos.push({
                        job: res.job,
                        updatedString: updatedString
                    });
                }
            }
            Cache.writeCache(JSON.stringify(newCache)).then(() => {
                if(updatedRepos.length > 0) {
                    updatedRepos.forEach(o => o.job.actions.forEach(o2 => {
                        if(o2.type == "webHook"){
                            let webHook = config.webHooks[o2.instance];
                            let options = {method: webHook.httpMethod, uri: webHook.reqUrl};

                            rpn(options)
                                .then(function (parsedBody) {
                                    console.log("WebHook Action for image [" + JSON.stringify(o.job.image) + "] successfully");
                                })
                                .catch(function (err) {
                                    console.error("WebHook Action for image [" + JSON.stringify(o.job.image) + "] failed");
                                    console.log(err);
                                });
                        }
                        else if(o2.type == "mailHook"){
                            mailHookSend(o2.instance, o2.recipient, "The following docker image was updated: "
                                + JSON.stringify(o.job.image));
                        }
                        else{
                            console.error("Trying to execute an unknown hook(" + o2.type + "), falling back to printing to console");
                            console.error("Image: " + JSON.stringify(o.job.image));
                        }
                    }));
                }
            }).catch((err) => {
                console.error("Error while writing cache file: ", err);
            })
        }).catch((err) => {
            console.error("Error while checking for updates: ", err);
        })
    }).catch((err) => {
        console.error("Cannot open cache: ", err);
    });
};

let checkInterval = Number(process.env.checkInterval);

checkForUpdates();

setInterval(checkForUpdates, 1000 * 60 * (checkInterval || 60));