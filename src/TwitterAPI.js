//const nodemailer = require('nodemailer');
import TwitterApi from 'twitter-api-v2';

class TwitterAPI {
    constructor(token) {
        this.twitterClient = new TwitterApi(token);
    }

    async tweet(msg) {
        await this.twitterClient.v1.tweet(msg);
    }
}

module.exports = { TwitterAPI: TwitterAPI };

