# Docker-Notify

Docker-Notify can send you a mail when a Docker image gets updated.

## Setup

1. Copy the `config.env.template` file into `config.env`
2. Fill out the `config.env` file:
 * The `updateRecheck` field represents the interval (in minutes) in which the repositories are checked for new versions
 * Fill out the fields for SMTP. This will give `Docker-Notify` access to a mail account to send the notification mails from.
 * Set the `mailReceiver` field to the mail address which should receive the notifications.
 * Set the `repositories` field to a list of repositories (repositories are separated with a comma) in the following format: `user/repoName:tag`
 * If the repository is an official repository, you can leave out the `user` and just add `repoName:tag` to the list.
 * If the `tag` is left out (example: `user/repoName`), you will receive a mail about any updates made (e.g. nightly builds)
* Build and start the Docker container for `docker-notify` by running `docker-compose up`.
* If you add or remove a repository to/from the list, you need to execute `docker-compose up` again.
