# Docker-Notify

Docker-Notify can send you a mail or call a webhook when a Docker image gets updated. 

If you are trying to set docker-notify up on a Synology, [here](Synology%20Readme.md) is a guide for that.

## Environment Variables
* `$CONFIG_DIR` defines the directory where the config is stored

## Notification Destinations

The following notification destinations are supported:

| Type       | Description                                                                       |
| ---------- | --------------------------------------------------------------------------------- |
| smtpServer | email                                                                             |
| webHooks   | Webhook, the $msg variable can be used to insert the docker-notify update message |

## Setup

1. Copy the `config.json.example` file to `$CONFIG_DIR/config.json`
2. Fill out the `config.json` file:
    * Read the self describing schema in src/schema.json
    * If the tag is left out (example: user/repoName), you will receive a mail about any updates made (e.g. nightly builds)
    * If the repository is an official repository, you can leave out the user and just add repoName:tag as image.
3. Build the Docker container for `docker-notify`.
4. Set the variable `$CONFIG_DIR` in the docker-compose file.
5. Run the container with `docker-compose up -d`
6. If you edit settings in the config, you need to execute `docker-compose up` again.

## Example
Consider the following scenario: 
You have a server with 2 software services. 
One is a dockerized webserver and the other one is a dockerized nextcloud image with some customizations, so your `docker-compose.yml` is looking like this:
```yaml
version: '3'
services:
  webserver:
    image: apache2
    restart: always
  nextcloud:
    image: customUser/nextcloud:latest
    restart: always
```
Now you want to be notified if you may update your apache2-server and you want to be notified if you must call your ci-pipeline to rebuild your custom nextcloud-docker-image.
So, now your `docker-compose.yml` file is looking like this:
```yaml
version: '3'
services:
  webserver:
    image: apache2
    restart: always
  nextcloud:
    image: customUser/nextcloud:latest
    restart: always
  docker-notify:
    image: schlabbi/docker-notify
    restart: always
    volumes: 
      - /home/someUser/notify/cache:/usr/src/app/cache
      - /home/someUser/notify/config.json:/usr/src/app/config.json
```

The `config.json` looks like the following:
```javascript
{
    "notifyServices":[
        {
            "image": "nextcloud:fpm",
            "actions": [
                {
                    "type": "mailHook",
                    "instance": "generalMail",
                    "recipient": "info@example.org"
                },
                {
                    "type": "webHook",
                    "instance": "gitlabHook"
                }
            ]
        },
        {
            "image": "httpd",
            "actions": [
                {
                    "type": "mailHook",
                    "instance": "generalMail",
                    "recipient": "info@example.org"
                }
            ]
        }
    ],
    "smtpServer": {
        "generalMail": {
            "host": "mail.example.org",
            "port": 25,
            "username": "docker-notify@example.org",
            "password": "PASSWORD",
            "sendername": "Docker-Notify",
            "senderadress": "docker-notify@example.org"
        }
    },
    "webHooks":{
        "gitlabHook": {
            "reqUrl": "https://ci.example.org",
            "httpMethod": "POST",
            // This one is optional and will default to null.
            "httpBody": {
                "foo": [1, 2, 3]
            }
        },
        "slackHook": {
            "reqUrl": "https://hooks.slack.com/services/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w",
            "httpMethod": "POST",
            "httpHeaders": {"Content-type": "application/json"},
            "httpBody": {
                "text": "$msg"
            }
        }
    }
}
```
