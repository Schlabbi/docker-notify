const dockerAPI = new (require('./DockerAPI').DockerAPI)();
const mailService = require('./mailService');
const Cache = require('./Cache');
const schema = require('./schema.json');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const ajv = new Ajv({allErrors: true, allowUnionTypes: true, useDefaults: true});
const axios = require('axios');
addFormats(ajv, ['email', 'hostname', 'uri']);

// Set up a minimal logger
const dateFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'long',
    hour12: false
};

const dateFormatter = new Intl.DateTimeFormat('en-US', dateFormatOptions);

const logger = {
    log: function () {
        const args = Array.prototype.slice.call(arguments);
        args.unshift(dateFormatter.format(Date.now()) + ': ');
        console.log.apply(console, args);
    },
    error: function () {
        const args = Array.prototype.slice.call(arguments);
        args.unshift(dateFormatter.format(Date.now()) + ': ');
        console.error.apply(console, args);
    }
};

// Load config file
let config;

try {
    config = require('./config.json');
}
catch (e) {
    logger.error('Config file error, exiting');
    logger.error(e.message);
    process.exit(1);
}

// Validate config file with schema validator
const validate = ajv.compile(schema);
const valid = validate(config);
if (!valid){
    logger.error(validate.errors);
    process.exit(2);
}

// Prepare variables
const notifyServices = config.notifyServices;

// Validate things, that can currently not be validated by json schema
// these things are: smtp-server referenced in notifyJob is existing and
// webhooks referenced in notifyJob is existing
if (!notifyServices.every((o) => o.actions.every((o2) => o2.type === 'webHook' ? config.webHooks[o2.instance] :
    o2.type === 'mailHook' ? config.smtpServer[o2.instance] : false))){
    logger.error('Mail/Smtp Hooks that are referenced are not defined!');
    process.exit(3);
}

config.notifyServices.forEach((o) => {
    const res = {};
    let elem = o.image;
    elem = elem.split('/');
    res.user = elem.length > 1 ? elem[0] : 'library';
    res.name = elem.length > 1 ? elem[1] : elem[0];
    // get tag if it is set
    if (res.name.split(':').length > 1){
        res.tag = res.name.split(':')[1];
        res.name = res.name.split(':')[0];
    }
    o.image = res;
});

const mailtransporterMap = new Map();

const mailHookSend = function (smtpserver, recipient, updatedString, msg){
    if (!mailtransporterMap.has(smtpserver)){
        mailtransporterMap.set(smtpserver,
            mailService(config.smtpServer[smtpserver].host, config.smtpServer[smtpserver].port, config.smtpServer[smtpserver].secure,
                config.smtpServer[smtpserver].username, config.smtpServer[smtpserver].password));
    }

    sendMail(msg, mailtransporterMap.get(smtpserver), config.smtpServer[smtpserver].sendername,
        config.smtpServer[smtpserver].senderadress, recipient, updatedString);
};

// sends an email with a given message to the receiver which is defined in the env
const sendMail = function (msg, mailTransporter, smtpSenderName, smtpSenderAddress, mailReceiver, updatedString) {
    mailTransporter.verify().then(() => {
        const mailOptions = {
            from: '"' + smtpSenderName + '" <' + smtpSenderAddress + '>',
            to: mailReceiver,
            subject: 'Docker image \'' + updatedString + '\' updated',
            text: msg
        };
        mailTransporter.sendMail(mailOptions).then((info) => {
            logger.log('Notification mail sent: ', info);
        }).catch((err) => {
            logger.error('Error while sending mail: ', err);
        });
    }).catch((err) => {
        logger.error('Error while verifying mail server connection: ', err);
    });
};

const getRepositoryInfo = function (user, name) {
    return dockerAPI.repository(user, name);
};

const getTagInfo = function (user, name) {
    return dockerAPI.tags(user, name);
};

const checkRepository = function (job, repoCache) {
    return new Promise((resolve, reject) => {

        const checkUpdateDates = function (repoInfo, tag) {
            if (!repoInfo) {
                logger.error('Repository not found: ', repository.name);
                return;
            }

            let updated;
            if (repoCache) {
                const cachedDate = Date.parse(repoCache.lastUpdated);
                const currentDate = Date.parse(repoInfo.last_updated);
                updated = cachedDate < currentDate;
            } else {
                updated = false;
            }
            resolve({
                lastUpdated: repoInfo.last_updated,
                name: repoInfo.name,
                user: repoInfo.user,
                tag: tag ? tag : null,
                updated: updated,
                job: job
            });
        };

        const repository = job.image;

        if (repository.tag) {
            getTagInfo(repository.user, repository.name).then((tags) => {
                const tagInfo = tags.filter((elem) => elem.name == repository.tag)[0];

                if (tagInfo == undefined) {
                    logger.error('Cannot find tag for repository: ', repository.name);
                    return;
                }

                tagInfo.user = repository.user;
                tagInfo.name = repository.name;
                checkUpdateDates(tagInfo, repository.tag);
            }).catch(logger.error);
        } else {
            getRepositoryInfo(repository.user, repository.name).then(checkUpdateDates).catch((err) => {
                logger.error('Error while fetching repo info: ', err);
                reject();
            });
        }
    });
};

const checkForUpdates = function () {
    logger.log('Checking for updated repositories');
    Cache.getCache().then((cache) => {
        const repoChecks = [];
        for (const job of notifyServices) {
            let key = job.image.user + '/' + job.image.name;
            if (job.image.tag) {
                key += ':' + job.image.tag;
            }
            logger.log('Checking: ', key);
            repoChecks.push(checkRepository(job, cache[key]));
        }
        Promise.all(repoChecks).then((checkResult) => {
            const newCache = {};
            const updatedRepos = [];
            for (const res of checkResult) {
                let key = res.user + '/' + res.name;
                const cacheObj = {
                    user: res.user,
                    name: res.name,
                    lastUpdated: res.lastUpdated
                };

                if (res.tag) {
                    key += ':' + res.tag;
                    cacheObj.tag = res.tag;
                }

                newCache[key] = cacheObj;

                if (res.updated) {
                    let updatedString = res.user == 'library' ? res.name : res.user + '/' + res.name;
                    if (res.tag) {
                        updatedString += ':' + res.tag;
                    }
                    updatedRepos.push({
                        job: res.job,
                        updatedString: updatedString
                    });
                }
            }
            Cache.writeCache(JSON.stringify(newCache)).then(() => {
                if (updatedRepos.length > 0) {
                    updatedRepos.forEach((o) => o.job.actions.forEach((o2) => {
                        if (o2.type == 'webHook'){
                            const webHook = config.webHooks[o2.instance];
                            const message = webHook.httpBody;
                            Object.keys(message).forEach((key) => {
                                if (typeof message[key] == 'string') {
                                    message[key] = message[key].replace('$msg', 'Docker image \'' + o.updatedString + '\' was updated:\n' + JSON.stringify(o.job.image));
                                }
                            });

                            axios({
                                method: webHook.httpMethod,
                                url: webHook.reqUrl,
                                headers: webHook.httpHeaders,
                                data: webHook.httpBody
                            }).then((body) => {
                                logger.log('WebHook Action for image [' + JSON.stringify(o.job.image) + '] successfully. Response: ', body);
                            }).catch((err) => {
                                logger.error('WebHook Action for image [' + JSON.stringify(o.job.image) + '] failed');
                                logger.log(err);
                            });
                        }
                        else if (o2.type == 'mailHook'){
                            mailHookSend(o2.instance, o2.recipient, o.updatedString, 'Docker image \'' + o.updatedString + '\' was updated:\n'
                                + JSON.stringify(o.job.image, null, 2));
                        }
                        else {
                            logger.error('Trying to execute an unknown hook(' + o2.type + '), falling back to printing to console');
                            logger.error('Image: ' + JSON.stringify(o.job.image));
                        }
                    }));
                }
            }).catch((err) => {
                logger.error('Error while writing cache file: ', err);
            });
        }).catch((err) => {
            logger.error('Error while checking for updates: ', err);
        });
    }).catch((err) => {
        logger.error('Cannot open cache: ', err);
    });
};

const checkInterval = Number(config.checkInterval);

checkForUpdates();

setInterval(checkForUpdates, 1000 * 60 * (checkInterval || 60));
